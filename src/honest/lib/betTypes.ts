import { SLOTS, HOUSE_EDGE, RED, BLACK, VOISINS, TIERS, ORPHELINS, DOZEN_1, DOZEN_2, DOZEN_3, COLUMN_1, COLUMN_2, COLUMN_3, physicalNeighbors, sectorOf } from "./wheel";

export type BetTypeId =
  | "pleno-top1"
  | "pleno-top3"
  | "pleno-top5"
  | "cavalo-vizinhos"
  | "trio-top3"
  | "square-top4"
  | "linha-top6"
  | "duzia-dominante"
  | "coluna-dominante"
  | "cor-dominante"
  | "cor-anti"
  | "voisins"
  | "tiers"
  | "orphelins"
  | "vizinhos-5"
  | "vizinhos-9"
  | "cobertura-24"
  | "cobertura-30";

export interface BetContext {
  topPicks: number[];
  topProbs: number[];
  mainPick: number;
  recentSpins: number[];
  modelProbs: Float32Array;
}

export interface BetSignal {
  id: BetTypeId;
  label: string;
  category: "Pleno" | "Vizinhança" | "Combinada" | "Externa" | "Setor" | "Cobertura";
  numbers: Set<number>;
  coverage: number;
  coveragePct: number;
  unitsRisked: number;
  payoutOnHit: number;
  hitProbabilityBaseline: number;
  hitProbabilityModel: number;
  modelLift: number;
  expectedReturnBaseline: number;
  expectedReturnModel: number;
  evRatioPerUnit: number;
  variance: number;
  sharpe: number;
  confidence: number;
  rankingScore: number;
  kellyFraction: number;
  recommendedStakePct: number;
  description: string;
}

export type RiskProfile = "conservative" | "balanced" | "aggressive";

const setOf = (...nums: number[]) => new Set(nums);

const sumModelProbs = (numbers: Set<number>, modelProbs: Float32Array): number => {
  let s = 0;
  for (const n of numbers) s += modelProbs[n] ?? 0;
  return s;
};

const evaluateBet = (
  id: BetTypeId,
  label: string,
  category: BetSignal["category"],
  numbers: Set<number>,
  unitsRisked: number,
  payoutOnHit: number,
  modelProbs: Float32Array,
  description: string
): BetSignal => {
  const coverage = numbers.size;
  const hitProbabilityBaseline = coverage / SLOTS;
  const hitProbabilityModel = sumModelProbs(numbers, modelProbs);
  const modelLift = hitProbabilityBaseline > 0 ? hitProbabilityModel / hitProbabilityBaseline : 1;

  const netHit = payoutOnHit - unitsRisked;
  const netMiss = -unitsRisked;
  const expectedReturnBaseline = hitProbabilityBaseline * netHit + (1 - hitProbabilityBaseline) * netMiss;
  const expectedReturnModel = hitProbabilityModel * netHit + (1 - hitProbabilityModel) * netMiss;
  const evRatioPerUnit = unitsRisked > 0 ? expectedReturnModel / Math.max(unitsRisked, 1) : 0;

  const variance =
    hitProbabilityModel * Math.pow(netHit - expectedReturnModel, 2) +
    (1 - hitProbabilityModel) * Math.pow(netMiss - expectedReturnModel, 2);
  const stddev = Math.sqrt(Math.max(1e-9, variance));
  const sharpe = stddev > 0 ? expectedReturnModel / stddev : 0;
  const confidence = Math.min(1, Math.max(0, modelLift > 1 ? Math.log(modelLift + 1) / 2 : 0));

  const b = unitsRisked > 0 ? netHit / unitsRisked : 0;
  const p = hitProbabilityModel;
  const q = 1 - p;
  const rawKelly = b > 0 ? (b * p - q) / b : 0;
  const kellyFraction = Math.max(0, Math.min(0.25, rawKelly));
  const recommendedStakePct = kellyFraction * 0.5;

  return {
    id,
    label,
    category,
    numbers,
    coverage,
    coveragePct: hitProbabilityBaseline,
    unitsRisked,
    payoutOnHit,
    hitProbabilityBaseline,
    hitProbabilityModel,
    modelLift,
    expectedReturnBaseline,
    expectedReturnModel,
    evRatioPerUnit,
    variance,
    sharpe,
    confidence,
    rankingScore: 0,
    kellyFraction,
    recommendedStakePct,
    description,
  };
};

const dominantSet = (recent: number[], sets: Array<{ set: Set<number>; label?: string }>): { set: Set<number>; label?: string } => {
  const counts = sets.map(({ set }) => recent.slice(0, 20).filter((n) => set.has(n)).length);
  const maxIdx = counts.indexOf(Math.max(...counts));
  return sets[maxIdx];
};

const oppositeColor = (recent: number[]): Set<number> => {
  const r = recent.slice(0, 20).filter((n) => RED.has(n)).length;
  const b = recent.slice(0, 20).filter((n) => BLACK.has(n)).length;
  return r >= b ? BLACK : RED;
};

export const generateAllBets = (ctx: BetContext): BetSignal[] => {
  const out: BetSignal[] = [];
  const { topPicks, mainPick, recentSpins, modelProbs } = ctx;

  out.push(evaluateBet("pleno-top1", `Pleno ${mainPick}`, "Pleno", setOf(mainPick), 1, 36, modelProbs, "Pleno no top-1 do ensemble."));

  if (topPicks.length >= 3)
    out.push(evaluateBet("pleno-top3", "3 plenos (top-3)", "Pleno", new Set(topPicks.slice(0, 3)), 3, 36, modelProbs, "3 plenos nos 3 mais prováveis."));

  if (topPicks.length >= 5)
    out.push(evaluateBet("pleno-top5", "5 plenos (top-5)", "Pleno", new Set(topPicks.slice(0, 5)), 5, 36, modelProbs, "5 plenos. Coverage 13.5%."));

  out.push(evaluateBet("cavalo-vizinhos", `Cavalo ${mainPick} + 1V`, "Vizinhança", new Set([mainPick, ...physicalNeighbors(mainPick, 1)]), 3, 36, modelProbs, "Pleno top-1 + 2 vizinhos físicos."));

  out.push(evaluateBet("vizinhos-5", `${mainPick} ± 2V`, "Vizinhança", new Set([mainPick, ...physicalNeighbors(mainPick, 2)]), 5, 36, modelProbs, "Top-1 com 5 vizinhos físicos."));

  out.push(evaluateBet("vizinhos-9", `${mainPick} ± 4V`, "Vizinhança", new Set([mainPick, ...physicalNeighbors(mainPick, 4)]), 9, 36, modelProbs, "Top-1 com 9 vizinhos físicos."));

  if (topPicks.length >= 3)
    out.push(evaluateBet("trio-top3", "Trio top-3 (plenos)", "Combinada", new Set(topPicks.slice(0, 3)), 3, 36, modelProbs, "3 plenos com payout pleno em cada."));

  if (topPicks.length >= 4)
    out.push(evaluateBet("square-top4", "Square top-4", "Combinada", new Set(topPicks.slice(0, 4)), 4, 36, modelProbs, "4 plenos."));

  if (topPicks.length >= 6)
    out.push(evaluateBet("linha-top6", "Linha top-6", "Combinada", new Set(topPicks.slice(0, 6)), 6, 36, modelProbs, "6 plenos."));

  const dDozen = dominantSet(recentSpins, [
    { set: DOZEN_1, label: "1ª Dúzia" },
    { set: DOZEN_2, label: "2ª Dúzia" },
    { set: DOZEN_3, label: "3ª Dúzia" },
  ]);
  out.push(evaluateBet("duzia-dominante", `${dDozen.label} (dominante)`, "Externa", dDozen.set, 1, 3, modelProbs, "Dúzia mais vista nos últimos 20 giros."));

  const dColumn = dominantSet(recentSpins, [
    { set: COLUMN_1, label: "Coluna 1" },
    { set: COLUMN_2, label: "Coluna 2" },
    { set: COLUMN_3, label: "Coluna 3" },
  ]);
  out.push(evaluateBet("coluna-dominante", `${dColumn.label} (dominante)`, "Externa", dColumn.set, 1, 3, modelProbs, "Coluna mais frequente recente."));

  const dColor = dominantSet(recentSpins, [
    { set: RED, label: "Vermelho" },
    { set: BLACK, label: "Preto" },
  ]);
  out.push(evaluateBet("cor-dominante", `${dColor.label} (dominante)`, "Externa", dColor.set, 1, 2, modelProbs, "Cor mais vista recente."));

  out.push(evaluateBet("cor-anti", "Cor oposta (anti)", "Externa", oppositeColor(recentSpins), 1, 2, modelProbs, "Mean reversion na cor."));

  out.push(evaluateBet("voisins", "Voisins du Zéro", "Setor", VOISINS, 9, 45, modelProbs, "Setor do zero. 17 nº. 9 fichas."));
  out.push(evaluateBet("tiers", "Tiers du Cylindre", "Setor", TIERS, 6, 42, modelProbs, "Setor oposto ao zero. 12 nº. 6 fichas."));
  out.push(evaluateBet("orphelins", "Orphelins", "Setor", ORPHELINS, 5, 40, modelProbs, "Setores soltos. 8 nº. 5 fichas."));

  const sortedByModel = Array.from(modelProbs)
    .map((p, n) => ({ p, n }))
    .sort((a, b) => b.p - a.p);
  out.push(evaluateBet("cobertura-24", "Cobertura 24 nº (top modelo)", "Cobertura", new Set(sortedByModel.slice(0, 24).map((x) => x.n)), 24, 36, modelProbs, "24 plenos baseados em ranking do modelo."));
  out.push(evaluateBet("cobertura-30", "Cobertura 30 nº (anti-risco)", "Cobertura", new Set(sortedByModel.slice(0, 30).map((x) => x.n)), 30, 36, modelProbs, "30 plenos. Hit rate ~81%, payout líquido negativo."));

  return out;
};

const RISK_WEIGHTS: Record<RiskProfile, { ev: number; sharpe: number; hitRate: number; confidence: number }> = {
  conservative: { ev: 0.2, sharpe: 0.5, hitRate: 0.2, confidence: 0.1 },
  balanced: { ev: 0.35, sharpe: 0.25, hitRate: 0.15, confidence: 0.25 },
  aggressive: { ev: 0.5, sharpe: 0.1, hitRate: 0.05, confidence: 0.35 },
};

const normalize = (vals: number[]): number[] => {
  if (vals.length === 0) return [];
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min;
  if (range === 0) return vals.map(() => 0.5);
  return vals.map((v) => (v - min) / range);
};

export const rankBets = (bets: BetSignal[], profile: RiskProfile = "balanced"): BetSignal[] => {
  if (bets.length === 0) return [];
  const w = RISK_WEIGHTS[profile];
  const evNorm = normalize(bets.map((b) => b.evRatioPerUnit));
  const sharpeNorm = normalize(bets.map((b) => b.sharpe));
  const hitNorm = normalize(bets.map((b) => b.hitProbabilityModel));
  const confNorm = normalize(bets.map((b) => b.confidence));

  return bets
    .map((b, i) => ({
      ...b,
      rankingScore: w.ev * evNorm[i] + w.sharpe * sharpeNorm[i] + w.hitRate * hitNorm[i] + w.confidence * confNorm[i],
    }))
    .sort((a, b) => b.rankingScore - a.rankingScore);
};

export const filterBetsByCategory = (bets: BetSignal[], category: BetSignal["category"] | "all"): BetSignal[] => {
  if (category === "all") return bets;
  return bets.filter((b) => b.category === category);
};

export const houseEdgeRef = HOUSE_EDGE;

void sectorOf;
