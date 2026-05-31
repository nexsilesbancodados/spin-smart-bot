import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getPatternBank, patternBankSize, PatternActivation } from "./patternBank";

export interface PatternStat {
  hits: number;
  attempts: number;
  lastHitAt: number | null;
  lastAttemptAt: number | null;
  weight: number;
}

interface PatternLearningStore {
  stats: Record<string, PatternStat>;
  totalLearned: number;
  lastLearnedSpinT: number | null;
  pendingByRule: Record<string, { numbers: number[]; spinT: number }>;
  recordPending: (
    pendings: Array<{ ruleId: string; numbers: number[]; spinT: number }>
  ) => void;
  resolveWith: (actualNumber: number, spinT: number) => { ruleId: string; hit: boolean }[];
  reset: () => void;
}

const initialStat = (): PatternStat => ({
  hits: 0,
  attempts: 0,
  lastHitAt: null,
  lastAttemptAt: null,
  weight: 0,
});

const wilsonLowerBound = (hits: number, attempts: number, z = 1.96): number => {
  if (attempts === 0) return 0;
  const p = hits / attempts;
  const denom = 1 + (z * z) / attempts;
  const center = (p + (z * z) / (2 * attempts)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p)) / attempts + (z * z) / (4 * attempts * attempts))) / denom;
  return Math.max(0, center - margin);
};

export const wilsonInterval = (
  hits: number,
  attempts: number,
  z = 1.96
): { lower: number; upper: number; center: number } => {
  if (attempts === 0) return { lower: 0, upper: 0, center: 0 };
  const p = hits / attempts;
  const denom = 1 + (z * z) / attempts;
  const center = (p + (z * z) / (2 * attempts)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p)) / attempts + (z * z) / (4 * attempts * attempts))) / denom;
  return {
    lower: Math.max(0, center - margin),
    upper: Math.min(1, center + margin),
    center,
  };
};

export const bayesianCredibleInterval = (
  hits: number,
  attempts: number,
  priorAlpha = 1,
  priorBeta = 1
): { mean: number; lower: number; upper: number } => {
  const a = hits + priorAlpha;
  const b = attempts - hits + priorBeta;
  const mean = a / (a + b);
  const variance = (a * b) / ((a + b) * (a + b) * (a + b + 1));
  const stddev = Math.sqrt(variance);
  return {
    mean,
    lower: Math.max(0, mean - 1.96 * stddev),
    upper: Math.min(1, mean + 1.96 * stddev),
  };
};

export const usePatternLearning = create<PatternLearningStore>()(
  persist(
    (set, get) => ({
      stats: {},
      totalLearned: 0,
      lastLearnedSpinT: null,
      pendingByRule: {},

      recordPending: (pendings) =>
        set((s) => {
          const next = { ...s.pendingByRule };
          for (const p of pendings) {
            next[p.ruleId] = { numbers: p.numbers, spinT: p.spinT };
          }
          return { pendingByRule: next };
        }),

      resolveWith: (actualNumber, spinT) => {
        const s = get();
        const result: { ruleId: string; hit: boolean }[] = [];
        const nextStats = { ...s.stats };
        const drop: string[] = [];

        for (const [ruleId, p] of Object.entries(s.pendingByRule)) {
          if (p.spinT === spinT) continue;
          drop.push(ruleId);
          const stat = nextStats[ruleId] ?? initialStat();
          const hit = p.numbers.includes(actualNumber);
          const newAttempts = stat.attempts + 1;
          const newHits = stat.hits + (hit ? 1 : 0);
          // Reinforcement: Wilson lower bound for stable estimate,
          // but recent hit/miss gets an instantaneous nudge so
          // patterns adapt faster than the pure Bayesian rate would.
          const wilsonW = wilsonLowerBound(newHits, newAttempts);
          const recentNudge = hit ? 0.05 : -0.03;
          const weight = Math.max(0, Math.min(1, wilsonW + recentNudge));
          nextStats[ruleId] = {
            hits: newHits,
            attempts: newAttempts,
            lastHitAt: hit ? spinT : stat.lastHitAt,
            lastAttemptAt: spinT,
            weight,
          };
          result.push({ ruleId, hit });
        }

        const nextPending = { ...s.pendingByRule };
        for (const id of drop) delete nextPending[id];

        set({
          stats: nextStats,
          pendingByRule: nextPending,
          totalLearned: s.totalLearned + result.length,
          lastLearnedSpinT: spinT,
        });
        return result;
      },

      reset: () => set({ stats: {}, pendingByRule: {}, totalLearned: 0, lastLearnedSpinT: null }),
    }),
    {
      name: "rv-pattern-learning-v1",
      partialize: (s) => ({ stats: s.stats, totalLearned: s.totalLearned }),
    }
  )
);

export interface ActivatedRule extends PatternActivation {
  ruleId: string;
  group: string;
  description: string;
  baseConfidence: number;
  learnedAccuracy: number;
  attempts: number;
  hits: number;
  combinedScore: number;
}

export const runPatternBank = (history: number[]): ActivatedRule[] => {
  if (history.length === 0) return [];
  const bank = getPatternBank();
  const stats = usePatternLearning.getState().stats;
  const out: ActivatedRule[] = [];
  for (const rule of bank) {
    const activation = rule.activate(history);
    if (!activation) continue;
    const stat = stats[rule.id] ?? initialStat();
    const learned = stat.attempts > 0 ? wilsonLowerBound(stat.hits, stat.attempts) : 0;
    const fresh = stat.attempts < 5 ? activation.baseline : 0;
    const learnedAccuracy = Math.max(learned, fresh);
    const baseConfidence = activation.strength;
    const sampleWeight = Math.min(1, stat.attempts / 25);
    const combinedScore =
      learnedAccuracy *
      (0.5 + 0.5 * baseConfidence) *
      (0.6 + 0.4 * sampleWeight);
    out.push({
      ...activation,
      ruleId: rule.id,
      group: rule.group,
      description: rule.description,
      baseConfidence,
      learnedAccuracy,
      attempts: stat.attempts,
      hits: stat.hits,
      combinedScore,
    });
  }
  out.sort((a, b) => b.combinedScore - a.combinedScore);
  return out;
};

export const recordCurrentActivations = (history: number[], spinT: number): number => {
  if (history.length === 0) return 0;
  const activated = runPatternBank(history);
  const top = activated.slice(0, 80);
  const pendings = top.map((a) => ({
    ruleId: a.ruleId,
    numbers: Array.from(a.numbers),
    spinT,
  }));
  usePatternLearning.getState().recordPending(pendings);
  return pendings.length;
};

export const summarizeLearning = () => {
  const { stats, totalLearned } = usePatternLearning.getState();
  const bank = patternBankSize();
  const ruleMap = new Map(getPatternBank().map((r) => [r.id, r]));
  let tracked = 0;
  let totalHits = 0;
  let totalAttempts = 0;
  let bestWeight = 0;
  let bestId = "";
  const byGroup: Record<string, { hits: number; attempts: number; rules: number }> = {};
  for (const [id, s] of Object.entries(stats)) {
    if (s.attempts > 0) {
      tracked++;
      totalHits += s.hits;
      totalAttempts += s.attempts;
      if (s.weight > bestWeight) {
        bestWeight = s.weight;
        bestId = id;
      }
      const rule = ruleMap.get(id);
      if (rule) {
        const g = byGroup[rule.group] || { hits: 0, attempts: 0, rules: 0 };
        g.hits += s.hits;
        g.attempts += s.attempts;
        g.rules += 1;
        byGroup[rule.group] = g;
      }
    }
  }
  return {
    bank,
    tracked,
    totalLearned,
    totalHits,
    totalAttempts,
    overallAccuracy: totalAttempts > 0 ? totalHits / totalAttempts : 0,
    bestWeight,
    bestId,
    byGroup,
  };
};

export interface RankedLearnedPattern {
  ruleId: string;
  group: string;
  description: string;
  hits: number;
  attempts: number;
  accuracy: number;
  wilsonLower: number;
  wilsonUpper: number;
  bayesianMean: number;
  bayesianLower: number;
  bayesianUpper: number;
  lastHitAt: number | null;
  lastAttemptAt: number | null;
}

export const getRankedLearnedPatterns = (
  minAttempts = 5
): RankedLearnedPattern[] => {
  const { stats } = usePatternLearning.getState();
  const ruleMap = new Map(getPatternBank().map((r) => [r.id, r]));
  const out: RankedLearnedPattern[] = [];
  for (const [id, s] of Object.entries(stats)) {
    if (s.attempts < minAttempts) continue;
    const rule = ruleMap.get(id);
    if (!rule) continue;
    const wilson = wilsonInterval(s.hits, s.attempts);
    const bayes = bayesianCredibleInterval(s.hits, s.attempts);
    out.push({
      ruleId: id,
      group: rule.group,
      description: rule.description,
      hits: s.hits,
      attempts: s.attempts,
      accuracy: s.hits / s.attempts,
      wilsonLower: wilson.lower,
      wilsonUpper: wilson.upper,
      bayesianMean: bayes.mean,
      bayesianLower: bayes.lower,
      bayesianUpper: bayes.upper,
      lastHitAt: s.lastHitAt,
      lastAttemptAt: s.lastAttemptAt,
    });
  }
  out.sort((a, b) => b.wilsonLower - a.wilsonLower);
  return out;
};
