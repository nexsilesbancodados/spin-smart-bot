import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createEnsemble, type EnsembleEngine } from "./ensemble";
import { topK } from "./learning";
import { createLSTM, predict as lstmPredict, trainOnSequence, type LSTMModel } from "./lstm";
import { SLOTS, colorOf, sectorOf, VOISINS, TIERS, ORPHELINS } from "./wheel";
import { useHonestStore } from "./store";
import { playSignalChord, playHitSound, playMissSound, showBrowserNotification, useNotifications, speakSignal } from "./notifications";
import { evaluateFilter, useEntryFilter } from "./entryFilter";
import { fireWebhook } from "./webhook";
import { usePerf } from "./perf";
import { runAutoPauseCheck } from "./autoPause";
import { runAutoTuneCheck } from "./autoTuner";
import { logActivity } from "./activityFeed";
import { useABTest } from "./abTest";
import { toastHit, toastMiss, toastSignal } from "./toast";
import { recordCurrentActivations, usePatternLearning } from "./patternLearning";
import {
  mineRecentPatterns,
  useAutoDiscovery,
  activateDiscovered,
  lensTargetMatches,
} from "./autoDiscovery";

export interface SignalRecord {
  id: string;
  t: number;
  contextLen: number;
  topPicks: number[];
  topProbs: number[];
  mainPick: number;
  mainProb: number;
  confidenceScore: number;
  sector: string;
  color: string;
  actualNumber: number | null;
  resolvedAt: number | null;
  hitMain: boolean | null;
  hitTop5: boolean | null;
  hitNeighbors: boolean | null;
  explanation?: string[];
  modelContributions?: Array<{ id: string; name: string; weight: number; topPickProb: number }>;
  emitted?: boolean;
  filteredReason?: string;
}

export interface SignalAgentConfig {
  enabled: boolean;
  threshold: number;
  lstmEnabled: boolean;
  lstmHiddenSize: number;
  trainOnEverySpin: boolean;
  trainingWindow: number;
  ensembleWeight: number;
  lstmWeight: number;
  useWorker: boolean;
  dynamicThreshold: boolean;
  hourFilterEnabled: boolean;
  hoursAllowed: number[];
}

interface SignalAgentStore {
  config: SignalAgentConfig;
  history: SignalRecord[];
  pending: SignalRecord[];
  latest: SignalRecord | null;
  trainedSpins: number;
  setConfig: (patch: Partial<SignalAgentConfig>) => void;
  clearHistory: () => void;
  pushPrediction: (s: SignalRecord) => void;
  pushSignal: (s: SignalRecord) => void;
  resolvePending: (actual: number) => SignalRecord[];
  setLatest: (s: SignalRecord | null) => void;
  setTrainedSpins: (n: number) => void;
}

const defaultConfig: SignalAgentConfig = {
  enabled: true,
  threshold: 0.045,
  lstmEnabled: true,
  lstmHiddenSize: 24,
  trainOnEverySpin: true,
  trainingWindow: 300,
  ensembleWeight: 0.7,
  lstmWeight: 0.3,
  useWorker: false,
  dynamicThreshold: false,
  hourFilterEnabled: false,
  hoursAllowed: Array.from({ length: 24 }, (_, h) => h),
};

export const useSignalAgent = create<SignalAgentStore>()(
  persist(
    (set, get) => ({
      config: defaultConfig,
      history: [],
      pending: [],
      latest: null,
      trainedSpins: 0,
      setConfig: (patch) => set((s) => ({ config: { ...s.config, ...patch } })),
      clearHistory: () => set({ history: [], pending: [] }),
      pushPrediction: (sig) =>
        set((s) => ({ pending: [sig, ...s.pending].slice(0, 50), latest: sig })),
      pushSignal: (sig) =>
        set((s) => {
          const updated = { ...sig, emitted: true };
          const exists = s.pending.findIndex((p) => p.id === sig.id);
          const pending = exists >= 0
            ? s.pending.map((p, i) => (i === exists ? updated : p))
            : [updated, ...s.pending].slice(0, 50);
          return { pending, latest: updated };
        }),
      resolvePending: (actual) => {
        const current = get();
        if (current.pending.length === 0) return [];
        const sig = current.pending[current.pending.length - 1];
        const updated: SignalRecord = {
          ...sig,
          actualNumber: actual,
          resolvedAt: Date.now(),
          hitMain: sig.mainPick === actual,
          hitTop5: sig.topPicks.includes(actual),
          hitNeighbors: sig.topPicks.includes(actual),
        };
        set({
          pending: current.pending.slice(0, -1),
          history: [updated, ...current.history].slice(0, 500),
        });
        return [updated];
      },
      setLatest: (sig) => set({ latest: sig }),
      setTrainedSpins: (n) => set({ trainedSpins: n }),
    }),
    {
      name: "roleta-vision-signal-agent-v1",
      partialize: (s) => ({ config: s.config, history: s.history }),
    }
  )
);

let ensembleSingleton: EnsembleEngine | null = null;
let lstmSingleton: LSTMModel | null = null;
let lastProcessedSpinCount = -1;
let lastTrainedHash = "";

const getEnsemble = (): EnsembleEngine => {
  if (!ensembleSingleton) ensembleSingleton = createEnsemble();
  return ensembleSingleton;
};

const getLSTM = (hiddenSize: number): LSTMModel => {
  if (!lstmSingleton || lstmSingleton.hiddenSize !== hiddenSize) {
    lstmSingleton = createLSTM(hiddenSize);
  }
  return lstmSingleton;
};

const blendDistributions = (a: Float32Array, b: Float32Array, wA: number, wB: number): Float32Array => {
  const out = new Float32Array(SLOTS);
  const total = wA + wB;
  if (total <= 0) {
    out.fill(1 / SLOTS);
    return out;
  }
  for (let i = 0; i < SLOTS; i++) out[i] = (a[i] * wA + b[i] * wB) / total;
  let sum = 0;
  for (let i = 0; i < SLOTS; i++) sum += out[i];
  if (sum > 0) for (let i = 0; i < SLOTS; i++) out[i] /= sum;
  return out;
};

const confidenceFromTopProb = (mainProb: number): number => {
  const baseline = 1 / SLOTS;
  const ratio = mainProb / baseline;
  return Math.max(0, Math.min(1, (ratio - 1) / 4));
};

export interface AgentTick {
  signal: SignalRecord | null;
  shouldEmit: boolean;
  ensembleTopProb: number;
  lstmTopProb: number | null;
}

export const runAgentTick = (): AgentTick => {
  const spins = useHonestStore.getState().spins.map((s) => s.n);
  if (spins.length < 6) return { signal: null, shouldEmit: false, ensembleTopProb: 0, lstmTopProb: null };

  const agent = useSignalAgent.getState();
  if (!agent.config.enabled) return { signal: null, shouldEmit: false, ensembleTopProb: 0, lstmTopProb: null };

  const ensemble = getEnsemble();
  const ensembleSeq = spins.slice(0, agent.config.trainingWindow);
  const hash = `${ensembleSeq.length}:${ensembleSeq.slice(0, 5).join(",")}`;
  if (hash !== lastTrainedHash) {
    ensemble.train(ensembleSeq);
    lastTrainedHash = hash;
  }
  const ensembleResult = ensemble.predict();
  const ensembleProbs = ensembleResult.combined;

  let lstmProbs: Float32Array | null = null;
  if (agent.config.lstmEnabled) {
    const lstm = getLSTM(agent.config.lstmHiddenSize);
    if (agent.config.trainOnEverySpin && spins.length !== lastProcessedSpinCount) {
      trainOnSequence(lstm, spins.slice(0, 80), 32);
      lastProcessedSpinCount = spins.length;
      useSignalAgent.getState().setTrainedSpins(lstm.trainedSteps);
    }
    lstmProbs = lstmPredict(lstm, spins.slice(0, 20));
  }

  const combined = lstmProbs
    ? blendDistributions(ensembleProbs, lstmProbs, agent.config.ensembleWeight, agent.config.lstmWeight)
    : ensembleProbs;

  const top = topK(combined, 5);
  const mainPick = top[0].n;
  const mainProb = top[0].p;
  const conf = confidenceFromTopProb(mainProb);

  const modelContributions = ensembleResult.perModel
    .map((pm) => ({
      id: pm.model.id,
      name: pm.model.name,
      weight: pm.model.weight,
      topPickProb: pm.probs[mainPick],
    }))
    .sort((a, b) => b.weight * b.topPickProb - a.weight * a.topPickProb);

  const baseline = 1 / SLOTS;
  const explanation: string[] = [];
  const topContrib = modelContributions[0];
  if (topContrib && topContrib.topPickProb > baseline * 1.2) {
    explanation.push(
      `Modelo dominante: ${topContrib.name} dá ${(topContrib.topPickProb * 100).toFixed(2)}% ao ${mainPick} (peso ${topContrib.weight.toFixed(2)})`
    );
  }
  const liftRatio = mainProb / baseline;
  if (liftRatio > 1.5) {
    explanation.push(`Probabilidade ${liftRatio.toFixed(2)}× acima do baseline uniforme (1/37).`);
  }
  if (lstmProbs && lstmProbs[mainPick] > baseline * 1.3) {
    explanation.push(`LSTM concorda: ${(lstmProbs[mainPick] * 100).toFixed(2)}% para o ${mainPick}.`);
  }
  const lastFew = spins.slice(0, 8);
  const sectorMembers = sectorOf(mainPick) === "Voisins" ? VOISINS : sectorOf(mainPick) === "Tiers" ? TIERS : ORPHELINS;
  const sectorRecent = lastFew.filter((n) => sectorMembers.has(n)).length;
  if (sectorRecent >= 4) explanation.push(`Setor ${sectorOf(mainPick)} esteve em ${sectorRecent}/8 últimos giros.`);
  const colorRecent = lastFew.filter((n) => colorOf(n) === colorOf(mainPick)).length;
  if (colorRecent >= 5) explanation.push(`Cor ${colorOf(mainPick)} em ${colorRecent}/8 recentes.`);
  if (explanation.length === 0) explanation.push("Distribuição plana, top pick marginalmente acima do acaso.");

  const signal: SignalRecord = {
    id: `sig_${Date.now()}_${Math.floor(mainPick * 100 + mainProb * 1000)}`,
    t: Date.now(),
    contextLen: spins.length,
    topPicks: top.map((x) => x.n),
    topProbs: top.map((x) => x.p),
    mainPick,
    mainProb,
    confidenceScore: conf,
    sector: sectorOf(mainPick),
    color: colorOf(mainPick),
    actualNumber: null,
    resolvedAt: null,
    hitMain: null,
    hitTop5: null,
    hitNeighbors: null,
    explanation,
    modelContributions,
  };

  useSignalAgent.getState().pushPrediction(signal);

  const ab = useABTest.getState();
  if (ab.enabled) {
    if (signal.mainProb >= ab.configA.threshold) ab.pushPredictionA(signal);
    if (signal.mainProb >= ab.configB.threshold) ab.pushPredictionB(signal);
  }

  const calibratedProb = (() => {
    if (!agent.config.dynamicThreshold) return mainProb;
    const hist = useSignalAgent.getState().history;
    const resolved = hist.filter((s) => s.actualNumber !== null);
    if (resolved.length < 15) return mainProb;
    const lo = mainProb * 0.7;
    const hi = Math.max(mainProb * 1.5, mainProb + 0.02);
    const bucket = resolved.filter((s) => s.mainProb >= lo && s.mainProb <= hi);
    if (bucket.length < 5) return mainProb;
    const observed = bucket.filter((s) => s.hitMain).length / bucket.length;
    const meanPred = bucket.reduce((a, s) => a + s.mainProb, 0) / bucket.length;
    if (meanPred <= 1e-6) return mainProb;
    const ratio = Math.max(0.3, Math.min(2.0, observed / meanPred));
    return mainProb * ratio;
  })();

  let effectiveThreshold = agent.config.threshold;
  if (agent.config.dynamicThreshold) {
    const history = useSignalAgent.getState().history;
    const resolved = history.filter((s) => s.actualNumber !== null).slice(0, 30);
    if (resolved.length >= 8) {
      const hitRate = resolved.filter((s) => s.hitTop5).length / resolved.length;
      const baseline = 5 / SLOTS;
      const lift = hitRate / baseline;

      let brierSum = 0;
      for (const s of resolved) {
        const p = Math.max(0, Math.min(1, (s.topProbs || []).slice(0, 5).reduce((a, b) => a + b, 0)));
        const y = s.hitTop5 ? 1 : 0;
        brierSum += (p - y) ** 2;
      }
      const brier = brierSum / resolved.length;
      const naiveBrier = baseline * (1 - baseline);
      const skill = naiveBrier > 0 ? 1 - brier / naiveBrier : 0;

      let multiplier = 1;
      if (skill > 0.15 && lift > 1.3) multiplier = 0.72;
      else if (skill > 0.05 && lift > 1.15) multiplier = 0.85;
      else if (skill < -0.15 || lift < 0.7) multiplier = 1.5;
      else if (skill < -0.05 || lift < 0.85) multiplier = 1.25;

      effectiveThreshold = Math.max(0.025, Math.min(0.18, agent.config.threshold * multiplier));
    }
  }

  if (agent.config.hourFilterEnabled) {
    const currentHour = new Date().getHours();
    if (!agent.config.hoursAllowed.includes(currentHour)) {
      return { signal, shouldEmit: false, ensembleTopProb: ensembleProbs[mainPick], lstmTopProb: lstmProbs ? lstmProbs[mainPick] : null };
    }
  }

  const shouldEmit = calibratedProb >= effectiveThreshold;
  return { signal, shouldEmit, ensembleTopProb: ensembleProbs[mainPick], lstmTopProb: lstmProbs ? lstmProbs[mainPick] : null };
};

let unsubscribe: (() => void) | null = null;
let lastSpinKey = "";

export const startAgentLoop = () => {
  if (unsubscribe) return;
  unsubscribe = useHonestStore.subscribe((state) => {
    const newest = state.spins[0];
    if (!newest) return;
    const key = `${newest.t}:${newest.n}`;
    if (key === lastSpinKey) return;
    const previousKey = lastSpinKey;
    lastSpinKey = key;
    if (previousKey === "") return;

    usePatternLearning.getState().resolveWith(newest.n, newest.t);
    useAutoDiscovery.getState().resolve(newest.n, lensTargetMatches);
    const resolved = useSignalAgent.getState().resolvePending(newest.n);
    const abState = useABTest.getState();
    if (abState.enabled) {
      abState.resolveA(newest.n);
      abState.resolveB(newest.n);
    }
    for (const r of resolved) {
      if (r.hitMain || r.hitTop5) {
        playHitSound();
        useEntryFilter.getState().pushResult(true);
        if (r.emitted) toastHit(r.mainPick, r.actualNumber ?? -1, !!r.hitMain);
      } else {
        playMissSound();
        useEntryFilter.getState().pushResult(false);
        if (r.emitted) toastMiss(r.mainPick, r.actualNumber ?? -1);
      }
      logActivity(
        "signal-resolved",
        r.hitMain ? `EXATO no ${r.mainPick}` : r.hitTop5 ? `Top 5 hit (saiu ${r.actualNumber})` : `Errou (predito ${r.mainPick}, saiu ${r.actualNumber})`,
        undefined
      );
    }

    runAutoPauseCheck();
    runAutoTuneCheck();
    const historyForLearning = useHonestStore.getState().spins.map((s) => s.n);
    recordCurrentActivations(historyForLearning, newest.t);

    const spinCount = historyForLearning.length;
    if (spinCount % 5 === 0 && spinCount >= 10) {
      const mined = mineRecentPatterns(historyForLearning, spinCount);
      if (mined.length > 0) useAutoDiscovery.getState().registerDiscoveries(mined);
    }
    const activations = activateDiscovered(historyForLearning);
    useAutoDiscovery.getState().recordPending(activations.map((a) => a.ruleId));
    const t0 = performance.now();
    const tick = runAgentTick();
    usePerf.getState().recordAgentTick(performance.now() - t0);

    if (tick.signal && tick.shouldEmit) {
      const spins = useHonestStore.getState().spins.map((s) => s.n);
      const evalResult = evaluateFilter({
        spinsNewestFirst: spins,
        candidateConfidence: tick.signal.confidenceScore,
        candidateMainProb: tick.signal.mainProb,
        candidateMainPick: tick.signal.mainPick,
        candidateSector: tick.signal.sector,
        candidateColor: tick.signal.color,
      });
      useEntryFilter.getState().pushCandidate(evalResult.passed);

      if (evalResult.passed) {
        useSignalAgent.getState().pushSignal(tick.signal);
        logActivity(
          "signal-emitted",
          `Sinal ${tick.signal.mainPick} (${(tick.signal.mainProb * 100).toFixed(1)}%)`,
          `Setor ${tick.signal.sector} · ${evalResult.passingConditions}/${evalResult.totalActiveConditions} condições`
        );
        fireWebhook(tick.signal).catch(() => undefined);
        const notifyThreshold = useNotifications.getState().signalThresholdConfidence;
        if (tick.signal.confidenceScore >= notifyThreshold) {
          playSignalChord();
          speakSignal(tick.signal.mainPick, tick.signal.sector, tick.signal.mainProb);
          toastSignal(tick.signal.mainPick, tick.signal.mainProb, tick.signal.sector);
          showBrowserNotification(
            `🎯 Sinal: ${tick.signal.mainPick}`,
            `Top 5: ${tick.signal.topPicks.join(", ")} · ${(tick.signal.mainProb * 100).toFixed(1)}% · ${tick.signal.sector}`,
            "/icon-192.png"
          );
        }
      }
    }
  });
};

export const stopAgentLoop = () => {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
};

export interface AgentStats {
  totalSignals: number;
  resolved: number;
  mainHits: number;
  top5Hits: number;
  mainHitRate: number;
  top5HitRate: number;
  baselineMain: number;
  baselineTop5: number;
  byConfidenceBucket: Array<{ low: number; high: number; count: number; mainHits: number; top5Hits: number }>;
}

export const computeAgentStats = (history: SignalRecord[]): AgentStats => {
  const resolved = history.filter((s) => s.actualNumber !== null);
  const total = history.length;
  const mainHits = resolved.filter((s) => s.hitMain === true).length;
  const top5Hits = resolved.filter((s) => s.hitTop5 === true).length;
  const buckets = [
    { low: 0, high: 0.2 },
    { low: 0.2, high: 0.4 },
    { low: 0.4, high: 0.6 },
    { low: 0.6, high: 0.8 },
    { low: 0.8, high: 1.01 },
  ];
  const byConfidenceBucket = buckets.map((b) => {
    const inBucket = resolved.filter((s) => s.confidenceScore >= b.low && s.confidenceScore < b.high);
    return {
      low: b.low,
      high: b.high,
      count: inBucket.length,
      mainHits: inBucket.filter((s) => s.hitMain === true).length,
      top5Hits: inBucket.filter((s) => s.hitTop5 === true).length,
    };
  });
  return {
    totalSignals: total,
    resolved: resolved.length,
    mainHits,
    top5Hits,
    mainHitRate: resolved.length > 0 ? mainHits / resolved.length : 0,
    top5HitRate: resolved.length > 0 ? top5Hits / resolved.length : 0,
    baselineMain: 1 / SLOTS,
    baselineTop5: 5 / SLOTS,
    byConfidenceBucket,
  };
};
