import { runPatternBank, ActivatedRule, summarizeLearning, getRankedLearnedPatterns } from "./patternLearning";
import { computeUnifiedSignal, UnifiedCandidate } from "./unifiedAnalysis";
import { computeAntiStickPenalty } from "./masterSignalState";
import type { SignalRecord } from "./signalAgent";
import { DOZEN_1, DOZEN_2, DOZEN_3, COLUMN_1, COLUMN_2, COLUMN_3 } from "./wheel";
import {
  buildMarkov2,
  markov2Predict,
  dozenOf,
  columnOf,
  gapStats,
  detectCycles,
  NON_ZERO_DOZENS,
  NON_ZERO_COLUMNS,
  GroupCode,
  ColumnCode,
} from "./groupAnalysis";

export interface MasterCandidate {
  id: string;
  targetLabel: string;
  targetType: string;
  numbers: number[];
  numbersKey: string;
  payout: number;
  baseline: number;
  coverage: number;

  prob: number;
  lift: number;
  confidence: number;
  edgeQuality: number;
  accuracyScore: number;

  patternRule: ActivatedRule | null;
  unifiedCandidate: UnifiedCandidate | null;
  sources: string[];
  reasoning: string;
}

export interface MasterSummary {
  total: number;
  patternsActive: number;
  unifiedAvailable: boolean;
  learnedTotal: number;
  learnedAccuracy: number;
  bankSize: number;
  trackedRules: number;
}

const numbersKey = (numbers: Iterable<number>): string =>
  Array.from(numbers).sort((a, b) => a - b).join(",");

const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x));

const sampleConfidence = (n: number): number => Math.min(1, n / 30);

const edgeQualityFromLift = (lift: number): number => {
  if (lift <= 0.95) return 0.55;
  if (lift < 1.05) return 0.85;
  return Math.min(1.3, 0.95 + (lift - 1) * 0.5);
};

const fromPatternRule = (rule: ActivatedRule): MasterCandidate => {
  const numbersArr = Array.from(rule.numbers);
  const probFinal = rule.attempts >= 5 ? rule.learnedAccuracy : Math.max(rule.learnedAccuracy, rule.baseline);
  const lift = probFinal / Math.max(1e-9, rule.baseline);
  const sampleConf = sampleConfidence(rule.attempts);
  const edgeQ = edgeQualityFromLift(lift);
  return {
    id: `pat-${rule.ruleId}`,
    targetLabel: rule.targetLabel,
    targetType: rule.targetType,
    numbers: numbersArr,
    numbersKey: numbersKey(numbersArr),
    payout: rule.payout,
    baseline: rule.baseline,
    coverage: numbersArr.length,

    prob: probFinal,
    lift,
    confidence: 0.55 * sampleConf + 0.45 * rule.baseConfidence,
    edgeQuality: edgeQ,
    accuracyScore: 0,

    patternRule: rule,
    unifiedCandidate: null,
    sources: [`padrão aprendido (${rule.group})`],
    reasoning: rule.description,
  };
};

const fromUnifiedCandidate = (uc: UnifiedCandidate): MasterCandidate => {
  const edgeQ = edgeQualityFromLift(uc.lift);
  return {
    id: `uni-${uc.id}`,
    targetLabel: uc.target,
    targetType: uc.kind,
    numbers: uc.numbers,
    numbersKey: numbersKey(uc.numbers),
    payout: uc.payout,
    baseline: uc.baseline,
    coverage: uc.coverage,

    prob: uc.prob,
    lift: uc.lift,
    confidence: uc.confidence,
    edgeQuality: edgeQ,
    accuracyScore: 0,

    patternRule: null,
    unifiedCandidate: uc,
    sources: uc.sources,
    reasoning: uc.reasoning,
  };
};

const merge = (a: MasterCandidate, b: MasterCandidate): MasterCandidate => {
  const weightA = a.confidence * (a.lift > 1 ? a.lift : 1);
  const weightB = b.confidence * (b.lift > 1 ? b.lift : 1);
  const totalW = weightA + weightB || 1;
  const prob = (a.prob * weightA + b.prob * weightB) / totalW;
  const lift = prob / Math.max(1e-9, a.baseline);
  const confidence = Math.min(
    1,
    0.5 * a.confidence + 0.5 * b.confidence + 0.15
  );
  const edgeQ = edgeQualityFromLift(lift);

  const winner = a.patternRule ? a : b;
  const patternRule = a.patternRule ?? b.patternRule;
  const unifiedCandidate = a.unifiedCandidate ?? b.unifiedCandidate;
  const sources = Array.from(new Set([...a.sources, ...b.sources]));
  const reasoning = patternRule
    ? `${patternRule.description} (+ análise unificada confirma)`
    : winner.reasoning;

  return {
    id: a.id,
    targetLabel: winner.targetLabel,
    targetType: winner.targetType,
    numbers: winner.numbers,
    numbersKey: winner.numbersKey,
    payout: winner.payout,
    baseline: winner.baseline,
    coverage: winner.coverage,
    prob,
    lift,
    confidence,
    edgeQuality: edgeQ,
    accuracyScore: 0,
    patternRule,
    unifiedCandidate,
    sources,
    reasoning,
  };
};

const numbersFromSet = (set: Set<number>): number[] => Array.from(set);

const overdueBoost = (history: number[]): { dozen: Record<string, number>; column: Record<string, number> } => {
  const dSeries = history.map(dozenOf).filter((c) => c !== "Z") as GroupCode[];
  const cSeries = history.map(columnOf).filter((c) => c !== "Z") as ColumnCode[];
  const dGap = dSeries.length >= 5 ? gapStats<string>(dSeries, NON_ZERO_DOZENS as string[]) : null;
  const cGap = cSeries.length >= 5 ? gapStats<string>(cSeries, NON_ZERO_COLUMNS as string[]) : null;
  const dBoost: Record<string, number> = {};
  const cBoost: Record<string, number> = {};
  if (dGap) {
    for (const k of NON_ZERO_DOZENS) {
      const meanGap = dGap.meanGap[k];
      const currGap = dGap.currentGap[k];
      dBoost[k] = meanGap > 0 && currGap > meanGap * 1.5 ? 1 + Math.min(0.25, (currGap - meanGap * 1.5) / meanGap / 5) : 1;
    }
  }
  if (cGap) {
    for (const k of NON_ZERO_COLUMNS) {
      const meanGap = cGap.meanGap[k];
      const currGap = cGap.currentGap[k];
      cBoost[k] = meanGap > 0 && currGap > meanGap * 1.5 ? 1 + Math.min(0.25, (currGap - meanGap * 1.5) / meanGap / 5) : 1;
    }
  }
  return { dozen: dBoost, column: cBoost };
};

const cycleBoost = (history: number[]): { dozen: string | null; column: string | null } => {
  const dSeries = history.map(dozenOf).filter((c) => c !== "Z") as GroupCode[];
  const cSeries = history.map(columnOf).filter((c) => c !== "Z") as ColumnCode[];
  const dCycle = dSeries.length >= 6 ? detectCycles<string>(dSeries) : null;
  const cCycle = cSeries.length >= 6 ? detectCycles<string>(cSeries) : null;
  let dPred: string | null = null;
  let cPred: string | null = null;
  if (dCycle?.found && dCycle.pattern.length > 0) {
    dPred = dCycle.pattern[dSeries.length % dCycle.cycleLength];
  }
  if (cCycle?.found && cCycle.pattern.length > 0) {
    cPred = cCycle.pattern[cSeries.length % cCycle.cycleLength];
  }
  return { dozen: dPred, column: cPred };
};

const dozenSetsByKey: Record<string, { set: Set<number>; label: string; range: string }> = {
  D1: { set: DOZEN_1, label: "1ª Dúzia", range: "1-12" },
  D2: { set: DOZEN_2, label: "2ª Dúzia", range: "13-24" },
  D3: { set: DOZEN_3, label: "3ª Dúzia", range: "25-36" },
};
const colSetsByKey: Record<string, { set: Set<number>; label: string; range: string }> = {
  C1: { set: COLUMN_1, label: "1ª Coluna", range: "1,4,…,34" },
  C2: { set: COLUMN_2, label: "2ª Coluna", range: "2,5,…,35" },
  C3: { set: COLUMN_3, label: "3ª Coluna", range: "3,6,…,36" },
};

export const computeMasterSignal = (
  history: number[],
  latest: SignalRecord | null
): { ranked: MasterCandidate[]; summary: MasterSummary } => {
  const patternRules = history.length > 0 ? runPatternBank(history) : [];
  const unified = history.length >= 10 ? computeUnifiedSignal(history, latest) : [];
  const overdue = history.length >= 12 ? overdueBoost(history) : null;
  const cycles = history.length >= 12 ? cycleBoost(history) : null;

  const map = new Map<string, MasterCandidate>();
  for (const rule of patternRules) {
    if (rule.attempts < 1 && rule.baseConfidence < 0.4) continue;
    const cand = fromPatternRule(rule);
    const existing = map.get(cand.numbersKey);
    if (existing) {
      const merged = merge(existing, cand);
      map.set(cand.numbersKey, merged);
    } else {
      map.set(cand.numbersKey, cand);
    }
  }
  for (const uc of unified) {
    const cand = fromUnifiedCandidate(uc);
    const existing = map.get(cand.numbersKey);
    if (existing) {
      const merged = merge(existing, cand);
      map.set(cand.numbersKey, merged);
    } else {
      map.set(cand.numbersKey, cand);
    }
  }

  if (overdue) {
    for (const [k, b] of Object.entries(overdue.dozen)) {
      if (b > 1.0) {
        const def = dozenSetsByKey[k];
        if (!def) continue;
        const arr = numbersFromSet(def.set);
        const key = arr.sort((a, b2) => a - b2).join(",");
        const existing = map.get(key);
        if (existing) {
          existing.prob = Math.min(0.95, existing.prob * b);
          existing.lift = existing.prob / existing.baseline;
          existing.sources = Array.from(new Set([...existing.sources, `gap-overdue (×${b.toFixed(2)})`]));
        }
      }
    }
    for (const [k, b] of Object.entries(overdue.column)) {
      if (b > 1.0) {
        const def = colSetsByKey[k];
        if (!def) continue;
        const arr = numbersFromSet(def.set);
        const key = arr.sort((a, b2) => a - b2).join(",");
        const existing = map.get(key);
        if (existing) {
          existing.prob = Math.min(0.95, existing.prob * b);
          existing.lift = existing.prob / existing.baseline;
          existing.sources = Array.from(new Set([...existing.sources, `gap-overdue (×${b.toFixed(2)})`]));
        }
      }
    }
  }

  if (cycles) {
    if (cycles.dozen) {
      const def = dozenSetsByKey[cycles.dozen];
      if (def) {
        const arr = numbersFromSet(def.set);
        const key = arr.sort((a, b2) => a - b2).join(",");
        const existing = map.get(key);
        if (existing) {
          existing.prob = Math.min(0.95, existing.prob * 1.15);
          existing.lift = existing.prob / existing.baseline;
          existing.confidence = Math.min(1, existing.confidence + 0.1);
          existing.sources = Array.from(new Set([...existing.sources, "ciclo detectado"]));
        }
      }
    }
    if (cycles.column) {
      const def = colSetsByKey[cycles.column];
      if (def) {
        const arr = numbersFromSet(def.set);
        const key = arr.sort((a, b2) => a - b2).join(",");
        const existing = map.get(key);
        if (existing) {
          existing.prob = Math.min(0.95, existing.prob * 1.15);
          existing.lift = existing.prob / existing.baseline;
          existing.confidence = Math.min(1, existing.confidence + 0.1);
          existing.sources = Array.from(new Set([...existing.sources, "ciclo detectado"]));
        }
      }
    }
  }

  const learnedAll = getRankedLearnedPatterns(8);
  for (const cand of map.values()) {
    let topMatch: (typeof learnedAll)[number] | null = null;
    for (const r of learnedAll) {
      if (cand.targetType === "dozen" && r.group.startsWith("dozen-")) {
        if (!topMatch || r.wilsonLower > topMatch.wilsonLower) topMatch = r;
      } else if (cand.targetType === "column" && r.group.startsWith("column-")) {
        if (!topMatch || r.wilsonLower > topMatch.wilsonLower) topMatch = r;
      } else if (cand.targetType === "color" && r.group.startsWith("color-")) {
        if (!topMatch || r.wilsonLower > topMatch.wilsonLower) topMatch = r;
      } else if (cand.targetType === "terminal" && r.group.startsWith("terminal-")) {
        if (!topMatch || r.wilsonLower > topMatch.wilsonLower) topMatch = r;
      }
    }
    if (topMatch && topMatch.wilsonLower > cand.baseline) {
      cand.confidence = Math.min(1, cand.confidence + 0.08);
      cand.sources = Array.from(new Set([...cand.sources, `família ${topMatch.group} W95L=${(topMatch.wilsonLower * 100).toFixed(0)}%`]));
    }
  }

  const spinCount = history.length;
  const ranked = Array.from(map.values()).map((c) => {
    const stick = computeAntiStickPenalty(c.numbersKey, spinCount);
    const acc = c.prob * c.edgeQuality * (0.55 + 0.45 * c.confidence) * stick.penalty;
    const sources = stick.penalty < 1
      ? [...c.sources, `anti-stick ×${stick.penalty.toFixed(2)} (${stick.recentCount}× recente, ${stick.recentMisses} miss)`]
      : c.sources;
    return { ...c, accuracyScore: acc, sources };
  });

  ranked.sort((a, b) => b.accuracyScore - a.accuracyScore);

  const learningSummary = summarizeLearning();
  const summary: MasterSummary = {
    total: ranked.length,
    patternsActive: patternRules.length,
    unifiedAvailable: unified.length > 0,
    learnedTotal: learningSummary.totalLearned,
    learnedAccuracy: learningSummary.overallAccuracy,
    bankSize: learningSummary.bank,
    trackedRules: learningSummary.tracked,
  };

  void sigmoid;
  return { ranked, summary };
};
