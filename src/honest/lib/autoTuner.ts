import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useSignalAgent, type SignalRecord } from "./signalAgent";
import { SLOTS } from "./wheel";
import { logActivity } from "./activityFeed";

export interface TuneEvent {
  t: number;
  param: string;
  oldValue: number;
  newValue: number;
  reason: string;
}

interface AutoTunerStore {
  enabled: boolean;
  tuningInterval: number;
  signalsRequired: number;
  history: TuneEvent[];
  lastTuneAt: number;
  setEnabled: (v: boolean) => void;
  setInterval: (v: number) => void;
  setSignalsRequired: (v: number) => void;
  recordEvent: (e: TuneEvent) => void;
  clearHistory: () => void;
}

export const useAutoTuner = create<AutoTunerStore>()(
  persist(
    (set) => ({
      enabled: false,
      tuningInterval: 50,
      signalsRequired: 30,
      history: [],
      lastTuneAt: 0,
      setEnabled: (v) => set({ enabled: v }),
      setInterval: (v) => set({ tuningInterval: v }),
      setSignalsRequired: (v) => set({ signalsRequired: v }),
      recordEvent: (e) =>
        set((s) => ({
          history: [e, ...s.history].slice(0, 200),
          lastTuneAt: Date.now(),
        })),
      clearHistory: () => set({ history: [] }),
    }),
    { name: "rv-auto-tuner-v1" }
  )
);

interface ResolvedSignals {
  total: number;
  hitTop1: number;
  hitTop5: number;
  hitRate1: number;
  hitRate5: number;
  baseline1: number;
  baseline5: number;
}

const summarizeSignals = (signals: SignalRecord[]): ResolvedSignals => {
  const resolved = signals.filter((s) => s.actualNumber !== null);
  const hitTop1 = resolved.filter((s) => s.hitMain === true).length;
  const hitTop5 = resolved.filter((s) => s.hitTop5 === true).length;
  return {
    total: resolved.length,
    hitTop1,
    hitTop5,
    hitRate1: resolved.length > 0 ? hitTop1 / resolved.length : 0,
    hitRate5: resolved.length > 0 ? hitTop5 / resolved.length : 0,
    baseline1: 1 / SLOTS,
    baseline5: 5 / SLOTS,
  };
};

const splitByLstmDominant = (signals: SignalRecord[]) => {
  const lstmDominant: SignalRecord[] = [];
  const ensembleDominant: SignalRecord[] = [];
  for (const s of signals) {
    if (!s.modelContributions || s.modelContributions.length === 0) continue;
    const top = s.modelContributions[0];
    if (top.name.toLowerCase().includes("lstm")) lstmDominant.push(s);
    else ensembleDominant.push(s);
  }
  return { lstmDominant, ensembleDominant };
};

const STEP = {
  threshold: 0.005,
  weight: 0.05,
  trainingWindow: 30,
};

const CLAMP = {
  threshold: { min: 0.03, max: 0.15 },
  weight: { min: 0.1, max: 0.95 },
  trainingWindow: { min: 50, max: 1000 },
};

const clamp = (v: number, { min, max }: { min: number; max: number }) => Math.max(min, Math.min(max, v));

let lastSignalCountAtTune = 0;

export const runAutoTuneCheck = () => {
  const tuner = useAutoTuner.getState();
  if (!tuner.enabled) return;

  const agent = useSignalAgent.getState();
  const totalResolved = agent.history.filter((s) => s.actualNumber !== null).length;
  if (totalResolved < tuner.signalsRequired) return;
  if (totalResolved - lastSignalCountAtTune < tuner.tuningInterval) return;
  lastSignalCountAtTune = totalResolved;

  const recent = agent.history.slice(0, 100);
  const summary = summarizeSignals(recent);

  if (summary.total < 20) return;

  const lift5 = summary.hitRate5 / summary.baseline5;

  if (lift5 < 0.6) {
    const newT = clamp(agent.config.threshold + STEP.threshold * 2, CLAMP.threshold);
    if (newT !== agent.config.threshold) {
      logActivity("tune-applied", `Auto-tune: parâmetro ajustado`, undefined);
      tuner.recordEvent({
        t: Date.now(),
        param: "threshold",
        oldValue: agent.config.threshold,
        newValue: newT,
        reason: `Hit rate top-5 ${(summary.hitRate5 * 100).toFixed(1)}% bem abaixo do baseline. Subiu limiar pra emitir menos sinais.`,
      });
      agent.setConfig({ threshold: newT });
    }
  } else if (lift5 > 1.5) {
    const newT = clamp(agent.config.threshold - STEP.threshold, CLAMP.threshold);
    if (newT !== agent.config.threshold) {
      logActivity("tune-applied", `Auto-tune: parâmetro ajustado`, undefined);
      tuner.recordEvent({
        t: Date.now(),
        param: "threshold",
        oldValue: agent.config.threshold,
        newValue: newT,
        reason: `Hit rate top-5 ${(summary.hitRate5 * 100).toFixed(1)}% acima do baseline. Baixou limiar pra emitir mais sinais.`,
      });
      agent.setConfig({ threshold: newT });
    }
  }

  if (agent.config.lstmEnabled && recent.length >= 30) {
    const { lstmDominant, ensembleDominant } = splitByLstmDominant(recent);
    if (lstmDominant.length >= 8 && ensembleDominant.length >= 8) {
      const lstmRate = summarizeSignals(lstmDominant).hitRate5;
      const ensRate = summarizeSignals(ensembleDominant).hitRate5;
      const ratio = lstmRate / Math.max(0.001, ensRate);
      if (ratio > 1.3) {
        const newLstm = clamp(agent.config.lstmWeight + STEP.weight, CLAMP.weight);
        if (newLstm !== agent.config.lstmWeight) {
          logActivity("tune-applied", `Auto-tune: parâmetro ajustado`, undefined);
      tuner.recordEvent({
            t: Date.now(),
            param: "lstmWeight",
            oldValue: agent.config.lstmWeight,
            newValue: newLstm,
            reason: `LSTM hit ${(lstmRate * 100).toFixed(1)}% vs ensemble ${(ensRate * 100).toFixed(1)}%. Aumentou peso do LSTM.`,
          });
          agent.setConfig({ lstmWeight: newLstm, ensembleWeight: clamp(1 - newLstm, CLAMP.weight) });
        }
      } else if (ratio < 0.7) {
        const newLstm = clamp(agent.config.lstmWeight - STEP.weight, CLAMP.weight);
        if (newLstm !== agent.config.lstmWeight) {
          logActivity("tune-applied", `Auto-tune: parâmetro ajustado`, undefined);
      tuner.recordEvent({
            t: Date.now(),
            param: "lstmWeight",
            oldValue: agent.config.lstmWeight,
            newValue: newLstm,
            reason: `LSTM hit ${(lstmRate * 100).toFixed(1)}% vs ensemble ${(ensRate * 100).toFixed(1)}%. Diminuiu peso do LSTM.`,
          });
          agent.setConfig({ lstmWeight: newLstm, ensembleWeight: clamp(1 - newLstm, CLAMP.weight) });
        }
      }
    }
  }

  if (summary.total >= 50 && summary.hitRate5 < summary.baseline5 * 0.7) {
    const newWindow = clamp(agent.config.trainingWindow + STEP.trainingWindow, CLAMP.trainingWindow);
    if (newWindow !== agent.config.trainingWindow) {
      logActivity("tune-applied", `Auto-tune: parâmetro ajustado`, undefined);
      tuner.recordEvent({
        t: Date.now(),
        param: "trainingWindow",
        oldValue: agent.config.trainingWindow,
        newValue: newWindow,
        reason: `Performance fraca. Aumentando janela de treino pra ${newWindow} (mais contexto).`,
      });
      agent.setConfig({ trainingWindow: newWindow });
    }
  }
};
