import { runPatternBank, ActivatedRule, summarizeLearning } from "./patternLearning";
import { computeUnifiedSignal, UnifiedCandidate } from "./unifiedAnalysis";
import type { SignalRecord } from "./signalAgent";

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

export const computeMasterSignal = (
  history: number[],
  latest: SignalRecord | null
): { ranked: MasterCandidate[]; summary: MasterSummary } => {
  const patternRules = history.length > 0 ? runPatternBank(history) : [];
  const unified = history.length >= 10 ? computeUnifiedSignal(history, latest) : [];

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

  const ranked = Array.from(map.values()).map((c) => {
    const acc = c.prob * c.edgeQuality * (0.55 + 0.45 * c.confidence);
    return { ...c, accuracyScore: acc };
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
