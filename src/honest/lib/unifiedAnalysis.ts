import {
  RED,
  BLACK,
  DOZEN_1,
  DOZEN_2,
  DOZEN_3,
  COLUMN_1,
  COLUMN_2,
  COLUMN_3,
  VOISINS,
  TIERS,
  ORPHELINS,
  physicalNeighbors,
  colorOf,
  sectorOf,
} from "./wheel";
import {
  buildMarkov1,
  buildMarkov2,
  markov2Predict,
  dozenOf,
  columnOf,
  NON_ZERO_DOZENS,
  NON_ZERO_COLUMNS,
} from "./groupAnalysis";
import type { SignalRecord } from "./signalAgent";

export type BetKind =
  | "pleno"
  | "neighbors5"
  | "neighbors9"
  | "dozen"
  | "column"
  | "color"
  | "parity"
  | "highlow"
  | "sector";

export interface UnifiedCandidate {
  id: string;
  kind: BetKind;
  label: string;
  target: string;
  coverage: number;
  numbers: number[];
  payout: number;
  baseline: number;
  prob: number;
  lift: number;
  ev: number;
  kelly: number;
  confidence: number;
  sources: string[];
  reasoning: string;
}

const weightedRate = (matches: boolean[], halfLife: number): number => {
  let num = 0;
  let den = 0;
  matches.forEach((m, i) => {
    const w = Math.pow(0.5, i / halfLife);
    den += w;
    if (m) num += w;
  });
  return den > 0 ? num / den : 0;
};

const safeRatio = (a: number, b: number, fallback = 1): number =>
  b > 1e-9 ? a / b : fallback;

const clampProb = (p: number): number => Math.max(0.001, Math.min(0.999, p));

const computeKelly = (prob: number, payout: number): number => {
  const b = payout;
  const f = (prob * (b + 1) - 1) / b;
  return Math.max(0, Math.min(0.5, f));
};

const computeEV = (prob: number, payout: number): number => {
  return prob * payout - (1 - prob) * 1;
};

interface BlendInputs {
  recent: number;
  markov1: number | null;
  markov2: number | null;
  agentSupport: number | null;
  baseline: number;
}

const blendProb = (i: BlendInputs): { prob: number; weights: { recent: number; m1: number; m2: number; agent: number } } => {
  const w = { recent: 0.3, m1: 0.2, m2: 0.25, agent: 0.25 };
  let used = 0;
  let total = 0;
  total += i.recent * w.recent;
  used += w.recent;
  if (i.markov1 !== null) {
    total += i.markov1 * w.m1;
    used += w.m1;
  }
  if (i.markov2 !== null) {
    total += i.markov2 * w.m2;
    used += w.m2;
  }
  if (i.agentSupport !== null) {
    total += i.agentSupport * w.agent;
    used += w.agent;
  }
  if (used <= 0) return { prob: i.baseline, weights: w };
  return { prob: total / used, weights: w };
};

const confidenceFromSamples = (n: number, lift: number): number => {
  const sample = Math.min(1, n / 60);
  const liftFactor = Math.min(1.4, Math.max(0.3, lift));
  return Math.max(0, Math.min(1, sample * (liftFactor / 1.4)));
};

const agentProbInSet = (latest: SignalRecord | null, members: Set<number>): number => {
  if (!latest) return 0;
  let s = 0;
  for (let i = 0; i < latest.topPicks.length; i++) {
    if (members.has(latest.topPicks[i])) s += latest.topProbs[i] ?? 0;
  }
  return s;
};

export const computeUnifiedSignal = (
  spins: number[],
  latest: SignalRecord | null
): UnifiedCandidate[] => {
  if (spins.length < 10) return [];

  const candidates: UnifiedCandidate[] = [];

  const dozenSeries = spins.map(dozenOf).filter((c) => c !== "Z") as string[];
  const colSeries = spins.map(columnOf).filter((c) => c !== "Z") as string[];
  const colorSeries: string[] = [];
  const paritySeries: string[] = [];
  const highlowSeries: string[] = [];
  for (const n of spins) {
    if (n === 0) continue;
    colorSeries.push(colorOf(n) === "red" ? "R" : "B");
    paritySeries.push(n % 2 === 0 ? "P" : "I");
    highlowSeries.push(n > 18 ? "H" : "L");
  }
  const sectorSeries = spins.map((n) => sectorOf(n));

  const dozenM1 = buildMarkov1<string>(dozenSeries, NON_ZERO_DOZENS as string[]);
  const colM1 = buildMarkov1<string>(colSeries, NON_ZERO_COLUMNS as string[]);
  const colorM1 = buildMarkov1<string>(colorSeries, ["R", "B"]);
  const parityM1 = buildMarkov1<string>(paritySeries, ["P", "I"]);
  const highlowM1 = buildMarkov1<string>(highlowSeries, ["H", "L"]);
  const sectorM1 = buildMarkov1<string>(sectorSeries, ["Voisins", "Tiers", "Orphelins"]);

  const dozenM2 = buildMarkov2<string>(dozenSeries);
  const colM2 = buildMarkov2<string>(colSeries);

  const dozenHead = dozenSeries[0];
  const dozenPrev = dozenSeries[1] ?? dozenHead;
  const dozenBaseline: Record<string, number> = { D1: 1 / 3, D2: 1 / 3, D3: 1 / 3 };
  const dozenM2Pred = markov2Predict<string>(
    dozenM2,
    [dozenPrev, dozenHead],
    NON_ZERO_DOZENS as string[],
    dozenBaseline
  );

  const colHead = colSeries[0];
  const colPrev = colSeries[1] ?? colHead;
  const colBaseline: Record<string, number> = { C1: 1 / 3, C2: 1 / 3, C3: 1 / 3 };
  const colM2Pred = markov2Predict<string>(
    colM2,
    [colPrev, colHead],
    NON_ZERO_COLUMNS as string[],
    colBaseline
  );

  const dozenSets: Array<{ key: string; label: string; range: string; set: Set<number> }> = [
    { key: "D1", label: "1ª Dúzia", range: "1–12", set: DOZEN_1 },
    { key: "D2", label: "2ª Dúzia", range: "13–24", set: DOZEN_2 },
    { key: "D3", label: "3ª Dúzia", range: "25–36", set: DOZEN_3 },
  ];
  const colSets: Array<{ key: string; label: string; range: string; set: Set<number> }> = [
    { key: "C1", label: "1ª Coluna", range: "1,4,…,34", set: COLUMN_1 },
    { key: "C2", label: "2ª Coluna", range: "2,5,…,35", set: COLUMN_2 },
    { key: "C3", label: "3ª Coluna", range: "3,6,…,36", set: COLUMN_3 },
  ];

  const window = spins.slice(0, 80);
  const baselineDozen = 12 / 37;

  for (const d of dozenSets) {
    const matches = window.map((n) => d.set.has(n));
    const recent = weightedRate(matches, 25);
    const m1 = dozenM1.probs[dozenHead]?.[d.key] ?? null;
    const m2 = dozenM2Pred.probs[d.key] ?? null;
    const agent = latest ? agentProbInSet(latest, d.set) : null;
    const blend = blendProb({
      recent,
      markov1: m1,
      markov2: m2,
      agentSupport: agent !== null ? Math.min(1, agent / baselineDozen / 2.5) * baselineDozen * 2.5 : null,
      baseline: baselineDozen,
    });
    const prob = clampProb(blend.prob);
    const lift = prob / baselineDozen;
    const sources: string[] = ["recência ponderada"];
    if (m1 !== null) sources.push("Markov-1");
    if (m2 !== null) sources.push(`Markov-2 (n=${dozenM2Pred.samples})`);
    if (agent !== null && agent > 0) sources.push("agente IA");
    const reasoning = `recente ${(recent * 100).toFixed(0)}% · M1 ${m1 !== null ? (m1 * 100).toFixed(0) + "%" : "—"} · M2 ${m2 !== null ? (m2 * 100).toFixed(0) + "%" : "—"}${agent !== null ? ` · IA ${(agent * 100).toFixed(0)}%` : ""}`;
    candidates.push({
      id: `dozen-${d.key}`,
      kind: "dozen",
      label: "Dúzia",
      target: `${d.label} (${d.range})`,
      coverage: 12,
      numbers: Array.from(d.set),
      payout: 2,
      baseline: baselineDozen,
      prob,
      lift,
      ev: computeEV(prob, 2),
      kelly: computeKelly(prob, 2),
      confidence: confidenceFromSamples(window.length, lift),
      sources,
      reasoning,
    });
  }

  for (const c of colSets) {
    const matches = window.map((n) => c.set.has(n));
    const recent = weightedRate(matches, 25);
    const m1 = colM1.probs[colHead]?.[c.key] ?? null;
    const m2 = colM2Pred.probs[c.key] ?? null;
    const agent = latest ? agentProbInSet(latest, c.set) : null;
    const blend = blendProb({
      recent,
      markov1: m1,
      markov2: m2,
      agentSupport: agent !== null ? Math.min(1, agent / baselineDozen / 2.5) * baselineDozen * 2.5 : null,
      baseline: baselineDozen,
    });
    const prob = clampProb(blend.prob);
    const lift = prob / baselineDozen;
    const sources: string[] = ["recência"];
    if (m1 !== null) sources.push("Markov-1");
    if (m2 !== null) sources.push(`Markov-2 (n=${colM2Pred.samples})`);
    if (agent !== null && agent > 0) sources.push("agente IA");
    const reasoning = `recente ${(recent * 100).toFixed(0)}% · M1 ${m1 !== null ? (m1 * 100).toFixed(0) + "%" : "—"} · M2 ${m2 !== null ? (m2 * 100).toFixed(0) + "%" : "—"}`;
    candidates.push({
      id: `col-${c.key}`,
      kind: "column",
      label: "Coluna",
      target: `${c.label} (${c.range})`,
      coverage: 12,
      numbers: Array.from(c.set),
      payout: 2,
      baseline: baselineDozen,
      prob,
      lift,
      ev: computeEV(prob, 2),
      kelly: computeKelly(prob, 2),
      confidence: confidenceFromSamples(window.length, lift),
      sources,
      reasoning,
    });
  }

  const evens: Array<{ key: string; label: string; payout: number; baseline: number; set: Set<number>; series: string[]; m1: Record<string, number> | undefined; head: string }> = [
    {
      key: "red",
      label: "🔴 Vermelho",
      payout: 1,
      baseline: 18 / 37,
      set: RED,
      series: colorSeries,
      m1: colorM1.probs[colorSeries[0]],
      head: colorSeries[0],
    },
    {
      key: "black",
      label: "⚫ Preto",
      payout: 1,
      baseline: 18 / 37,
      set: BLACK,
      series: colorSeries,
      m1: colorM1.probs[colorSeries[0]],
      head: colorSeries[0],
    },
    {
      key: "even",
      label: "Par",
      payout: 1,
      baseline: 18 / 37,
      set: new Set([2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36]),
      series: paritySeries,
      m1: parityM1.probs[paritySeries[0]],
      head: paritySeries[0],
    },
    {
      key: "odd",
      label: "Ímpar",
      payout: 1,
      baseline: 18 / 37,
      set: new Set([1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35]),
      series: paritySeries,
      m1: parityM1.probs[paritySeries[0]],
      head: paritySeries[0],
    },
    {
      key: "high",
      label: "19–36 (alto)",
      payout: 1,
      baseline: 18 / 37,
      set: new Set(Array.from({ length: 18 }, (_, i) => i + 19)),
      series: highlowSeries,
      m1: highlowM1.probs[highlowSeries[0]],
      head: highlowSeries[0],
    },
    {
      key: "low",
      label: "1–18 (baixo)",
      payout: 1,
      baseline: 18 / 37,
      set: new Set(Array.from({ length: 18 }, (_, i) => i + 1)),
      series: highlowSeries,
      m1: highlowM1.probs[highlowSeries[0]],
      head: highlowSeries[0],
    },
  ];

  const evenKeyMap: Record<string, string> = {
    red: "R",
    black: "B",
    even: "P",
    odd: "I",
    high: "H",
    low: "L",
  };

  for (const e of evens) {
    const matches = window.map((n) => e.set.has(n));
    const recent = weightedRate(matches, 25);
    const m1Key = evenKeyMap[e.key];
    const m1 = e.m1?.[m1Key] ?? null;
    const agent = latest ? agentProbInSet(latest, e.set) : null;
    const blend = blendProb({
      recent,
      markov1: m1,
      markov2: null,
      agentSupport: agent !== null ? Math.min(1, agent / e.baseline / 2.5) * e.baseline * 2.5 : null,
      baseline: e.baseline,
    });
    const prob = clampProb(blend.prob);
    const lift = prob / e.baseline;
    candidates.push({
      id: `even-${e.key}`,
      kind: e.key === "red" || e.key === "black" ? "color" : e.key === "even" || e.key === "odd" ? "parity" : "highlow",
      label: e.label.startsWith("🔴") || e.label.startsWith("⚫") ? "Cor" : e.key === "even" || e.key === "odd" ? "Paridade" : "Alto/Baixo",
      target: e.label,
      coverage: 18,
      numbers: Array.from(e.set),
      payout: 1,
      baseline: e.baseline,
      prob,
      lift,
      ev: computeEV(prob, 1),
      kelly: computeKelly(prob, 1),
      confidence: confidenceFromSamples(window.length, lift),
      sources: ["recência", m1 !== null ? "Markov-1" : "", agent !== null && agent > 0 ? "agente IA" : ""].filter(Boolean),
      reasoning: `recente ${(recent * 100).toFixed(0)}% · M1 ${m1 !== null ? (m1 * 100).toFixed(0) + "%" : "—"}${agent ? ` · IA ${(agent * 100).toFixed(0)}%` : ""}`,
    });
  }

  if (latest) {
    candidates.push({
      id: "pleno-top1",
      kind: "pleno",
      label: "Pleno",
      target: `Nº ${latest.mainPick}`,
      coverage: 1,
      numbers: [latest.mainPick],
      payout: 35,
      baseline: 1 / 37,
      prob: clampProb(latest.mainProb),
      lift: latest.mainProb / (1 / 37),
      ev: computeEV(latest.mainProb, 35),
      kelly: computeKelly(latest.mainProb, 35),
      confidence: latest.confidenceScore,
      sources: ["agente IA (ensemble + LSTM)"],
      reasoning: `top do agente: ${latest.mainPick} a ${(latest.mainProb * 100).toFixed(1)}%`,
    });

    const top5Set = new Set(latest.topPicks.slice(0, 5));
    const top5Prob = latest.topProbs.slice(0, 5).reduce((a, b) => a + b, 0);
    candidates.push({
      id: "top5",
      kind: "pleno",
      label: "Top-5 (plenos)",
      target: latest.topPicks.slice(0, 5).join(", "),
      coverage: 5,
      numbers: Array.from(top5Set),
      payout: 35 / 5,
      baseline: 5 / 37,
      prob: clampProb(top5Prob),
      lift: top5Prob / (5 / 37),
      ev: computeEV(top5Prob, 35 / 5),
      kelly: computeKelly(top5Prob, 35 / 5),
      confidence: latest.confidenceScore,
      sources: ["agente IA top-5"],
      reasoning: `cobertura ${latest.topPicks.slice(0, 5).join(", ")} = ${(top5Prob * 100).toFixed(1)}%`,
    });

    const neighbors = physicalNeighbors(latest.mainPick, 2);
    const v5 = new Set([latest.mainPick, ...neighbors]);
    let v5Prob = 0;
    for (const n of v5) {
      const idx = latest.topPicks.indexOf(n);
      if (idx >= 0) v5Prob += latest.topProbs[idx];
    }
    const matches = window.map((n) => v5.has(n));
    const recentV5 = weightedRate(matches, 25);
    const blendedV5 = clampProb(0.5 * v5Prob + 0.5 * recentV5);
    candidates.push({
      id: "vizinhos5",
      kind: "neighbors5",
      label: "Vizinhos ±2",
      target: `${latest.mainPick} + ${neighbors.join(", ")}`,
      coverage: 5,
      numbers: Array.from(v5),
      payout: 35 / 5,
      baseline: 5 / 37,
      prob: blendedV5,
      lift: blendedV5 / (5 / 37),
      ev: computeEV(blendedV5, 35 / 5),
      kelly: computeKelly(blendedV5, 35 / 5),
      confidence: latest.confidenceScore * 0.85,
      sources: ["vizinhos físicos do top do agente", "recência ponderada"],
      reasoning: `5 nº ao redor de ${latest.mainPick} · recente ${(recentV5 * 100).toFixed(0)}% · IA ${(v5Prob * 100).toFixed(0)}%`,
    });
  }

  const sectorSets: Array<{ key: string; label: string; payout: number; baseline: number; set: Set<number> }> = [
    { key: "Voisins", label: "Voisins du Zéro", payout: 35 / 17, baseline: 17 / 37, set: VOISINS },
    { key: "Tiers", label: "Tiers du Cylindre", payout: 35 / 12, baseline: 12 / 37, set: TIERS },
    { key: "Orphelins", label: "Orphelins", payout: 35 / 8, baseline: 8 / 37, set: ORPHELINS },
  ];

  for (const s of sectorSets) {
    const matches = window.map((n) => s.set.has(n));
    const recent = weightedRate(matches, 25);
    const m1 = sectorM1.probs[sectorSeries[0]]?.[s.key] ?? null;
    const agent = latest ? agentProbInSet(latest, s.set) : null;
    const blend = blendProb({
      recent,
      markov1: m1,
      markov2: null,
      agentSupport: agent !== null ? Math.min(1, agent / s.baseline / 2.5) * s.baseline * 2.5 : null,
      baseline: s.baseline,
    });
    const prob = clampProb(blend.prob);
    const lift = prob / s.baseline;
    candidates.push({
      id: `sector-${s.key}`,
      kind: "sector",
      label: "Setor",
      target: s.label,
      coverage: s.set.size,
      numbers: Array.from(s.set),
      payout: s.payout,
      baseline: s.baseline,
      prob,
      lift,
      ev: computeEV(prob, s.payout),
      kelly: computeKelly(prob, s.payout),
      confidence: confidenceFromSamples(window.length, lift),
      sources: ["setor físico", "recência", m1 !== null ? "Markov-1" : ""].filter(Boolean),
      reasoning: `recente ${(recent * 100).toFixed(0)}% · M1 ${m1 !== null ? (m1 * 100).toFixed(0) + "%" : "—"}`,
    });
  }

  // Rank by EV with confidence multiplier
  candidates.sort((a, b) => {
    const scoreA = a.ev * (0.5 + 0.5 * a.confidence) + (a.lift > 1 ? 0.01 * a.lift : 0);
    const scoreB = b.ev * (0.5 + 0.5 * b.confidence) + (b.lift > 1 ? 0.01 * b.lift : 0);
    return scoreB - scoreA;
  });

  return candidates;
};
