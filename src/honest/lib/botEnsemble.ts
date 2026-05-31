import { runPatternBank, ActivatedRule } from "./patternLearning";
import { activateDiscovered, AutoDiscoveryActivation } from "./autoDiscovery";

export type BotSpecialty =
  | "color"
  | "parity"
  | "highlow"
  | "dozen"
  | "column"
  | "sector"
  | "terminal"
  | "neighbors"
  | "number"
  | "pleno";

const SPECIALTY_LABELS: Record<BotSpecialty, { icon: string; name: string }> = {
  color: { icon: "🎨", name: "Especialistas em Cor" },
  parity: { icon: "⚖", name: "Especialistas em Par/Ímpar" },
  highlow: { icon: "↕", name: "Especialistas em Alto/Baixo" },
  dozen: { icon: "🎯", name: "Especialistas em Dúzia" },
  column: { icon: "📊", name: "Especialistas em Coluna" },
  sector: { icon: "🌀", name: "Especialistas em Setor" },
  terminal: { icon: "🔢", name: "Especialistas em Terminal" },
  neighbors: { icon: "🎰", name: "Especialistas em Vizinhos" },
  number: { icon: "🎲", name: "Especialistas em Número" },
  pleno: { icon: "🎲", name: "Especialistas em Pleno" },
};

export interface BotVote {
  numbersKey: string;
  numbers: number[];
  targetLabel: string;
  weight: number;
  botCount: number;
  hits: number;
  attempts: number;
  weightedAccuracy: number;
  baseline: number;
  payout: number;
  topRule: ActivatedRule | AutoDiscoveryActivation | null;
}

export interface SpecialtyConsensus {
  specialty: BotSpecialty;
  icon: string;
  name: string;
  totalBots: number;
  votingBots: number;
  validatedBots: number;
  consensus: BotVote | null;
  alternatives: BotVote[];
}

export interface BotEnsembleSummary {
  totalActiveBots: number;
  totalValidatedBots: number;
  specialties: SpecialtyConsensus[];
  overallWinner: { specialty: BotSpecialty; vote: BotVote } | null;
}

const isAutoDiscovery = (
  r: ActivatedRule | AutoDiscoveryActivation
): r is AutoDiscoveryActivation => "ruleId" in r && (r as any).group?.startsWith?.("auto-discovered");

const learnedAccuracyOf = (r: ActivatedRule | AutoDiscoveryActivation): number =>
  isAutoDiscovery(r) ? r.learnedAccuracy : (r as ActivatedRule).learnedAccuracy;

const attemptsOf = (r: ActivatedRule | AutoDiscoveryActivation): number =>
  isAutoDiscovery(r) ? r.attempts : (r as ActivatedRule).attempts;

const hitsOf = (r: ActivatedRule | AutoDiscoveryActivation): number =>
  isAutoDiscovery(r) ? r.hits : (r as ActivatedRule).hits;

const sortedKey = (numbers: Iterable<number>): string =>
  Array.from(numbers)
    .sort((a, b) => a - b)
    .join(",");

const computeVoteWeight = (rule: ActivatedRule | AutoDiscoveryActivation): number => {
  const learned = learnedAccuracyOf(rule);
  const attempts = attemptsOf(rule);
  const sampleConfidence = Math.min(1, attempts / 15);
  const strength = (rule as ActivatedRule).baseConfidence ?? 0.5;
  return learned * (0.4 + 0.6 * sampleConfidence) * (0.5 + 0.5 * strength);
};

const buildConsensusForSpecialty = (
  specialty: BotSpecialty,
  rules: Array<ActivatedRule | AutoDiscoveryActivation>
): SpecialtyConsensus => {
  const meta = SPECIALTY_LABELS[specialty];
  if (rules.length === 0) {
    return {
      specialty,
      icon: meta.icon,
      name: meta.name,
      totalBots: 0,
      votingBots: 0,
      validatedBots: 0,
      consensus: null,
      alternatives: [],
    };
  }

  const voteMap = new Map<string, BotVote>();
  let validatedCount = 0;

  for (const rule of rules) {
    const numbersArr = Array.from(rule.numbers);
    const key = sortedKey(numbersArr);
    const weight = computeVoteWeight(rule);
    const learned = learnedAccuracyOf(rule);
    const baseline = rule.baseline;
    const attempts = attemptsOf(rule);
    if (attempts >= 8 && learned > baseline * 1.15) validatedCount++;

    const existing = voteMap.get(key);
    if (existing) {
      existing.weight += weight;
      existing.botCount += 1;
      existing.hits += hitsOf(rule);
      existing.attempts += attemptsOf(rule);
      const existingW = (existing as any)._sumLearned || 0;
      const existingC = (existing as any)._sumWeight || 0;
      (existing as any)._sumLearned = existingW + learned * weight;
      (existing as any)._sumWeight = existingC + weight;
      existing.weightedAccuracy =
        (existing as any)._sumWeight > 0
          ? (existing as any)._sumLearned / (existing as any)._sumWeight
          : learned;
      if (weight > (existing.topRule ? computeVoteWeight(existing.topRule) : 0)) {
        existing.topRule = rule;
      }
    } else {
      const newVote: BotVote = {
        numbersKey: key,
        numbers: numbersArr,
        targetLabel: rule.targetLabel,
        weight,
        botCount: 1,
        hits: hitsOf(rule),
        attempts: attemptsOf(rule),
        weightedAccuracy: learned,
        baseline,
        payout: rule.payout,
        topRule: rule,
      };
      (newVote as any)._sumLearned = learned * weight;
      (newVote as any)._sumWeight = weight;
      voteMap.set(key, newVote);
    }
  }

  const sortedVotes = Array.from(voteMap.values()).sort((a, b) => b.weight - a.weight);

  return {
    specialty,
    icon: meta.icon,
    name: meta.name,
    totalBots: rules.length,
    votingBots: voteMap.size,
    validatedBots: validatedCount,
    consensus: sortedVotes[0] || null,
    alternatives: sortedVotes.slice(1, 4),
  };
};

export const computeBotEnsemble = (history: number[]): BotEnsembleSummary => {
  const activated = history.length > 0 ? runPatternBank(history) : [];
  const discovered = history.length > 0 ? activateDiscovered(history) : [];
  const allRules: Array<ActivatedRule | AutoDiscoveryActivation> = [
    ...activated,
    ...discovered.filter((d) => d.attempts >= 2),
  ];

  const grouped = new Map<BotSpecialty, Array<ActivatedRule | AutoDiscoveryActivation>>();
  for (const r of allRules) {
    const specialty = r.targetType as BotSpecialty;
    if (!grouped.has(specialty)) grouped.set(specialty, []);
    grouped.get(specialty)!.push(r);
  }

  const specialties: SpecialtyConsensus[] = (Object.keys(SPECIALTY_LABELS) as BotSpecialty[]).map(
    (sp) => buildConsensusForSpecialty(sp, grouped.get(sp) ?? [])
  );

  specialties.sort((a, b) => (b.consensus?.weight ?? 0) - (a.consensus?.weight ?? 0));

  const totalActiveBots = allRules.length;
  const totalValidatedBots = specialties.reduce((acc, s) => acc + s.validatedBots, 0);

  const withConsensus = specialties.filter((s) => s.consensus);
  let overallWinner: { specialty: BotSpecialty; vote: BotVote } | null = null;
  if (withConsensus.length > 0) {
    overallWinner = {
      specialty: withConsensus[0].specialty,
      vote: withConsensus[0].consensus!,
    };
  }

  return {
    totalActiveBots,
    totalValidatedBots,
    specialties,
    overallWinner,
  };
};
