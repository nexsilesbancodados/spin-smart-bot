import { SLOTS, sectorOf, colorOf } from "./wheel";

export type Conditioner = "color" | "sector" | "parity" | "high-low";

const conditionerKey = (n: number, type: Conditioner): string => {
  switch (type) {
    case "color":
      return colorOf(n) === "red" ? "Vermelho" : colorOf(n) === "black" ? "Preto" : "Zero";
    case "sector":
      return sectorOf(n);
    case "parity":
      return n === 0 ? "Zero" : n % 2 === 0 ? "Par" : "Ímpar";
    case "high-low":
      return n === 0 ? "Zero" : n <= 18 ? "Baixo" : "Alto";
  }
};

export interface ConditionalDistribution {
  conditioner: Conditioner;
  conditionValue: string;
  matches: number;
  nextDist: Record<string, number>;
  baselineDist: Record<string, number>;
  topNumbers: Array<{ n: number; count: number; prob: number }>;
}

const allCategoryValues: Record<Conditioner, string[]> = {
  color: ["Vermelho", "Preto", "Zero"],
  sector: ["Voisins", "Tiers", "Orphelins"],
  parity: ["Par", "Ímpar", "Zero"],
  "high-low": ["Baixo", "Alto", "Zero"],
};

const baselineCount = (type: Conditioner, value: string): number => {
  let c = 0;
  for (let n = 0; n < SLOTS; n++) if (conditionerKey(n, type) === value) c += 1;
  return c;
};

export const computeConditional = (spinsNewestFirst: number[], type: Conditioner): ConditionalDistribution[] => {
  const oldest = spinsNewestFirst.slice().reverse();
  const out: ConditionalDistribution[] = [];
  const values = allCategoryValues[type];

  for (const value of values) {
    const counts: Record<string, number> = {};
    const numCounts = new Map<number, number>();
    for (const v of values) counts[v] = 0;
    let matches = 0;

    for (let i = 0; i < oldest.length - 1; i++) {
      if (conditionerKey(oldest[i], type) === value) {
        const next = oldest[i + 1];
        const nextKey = conditionerKey(next, type);
        counts[nextKey] = (counts[nextKey] ?? 0) + 1;
        numCounts.set(next, (numCounts.get(next) ?? 0) + 1);
        matches += 1;
      }
    }

    const nextDist: Record<string, number> = {};
    for (const v of values) nextDist[v] = matches > 0 ? counts[v] / matches : 0;
    const baselineDist: Record<string, number> = {};
    for (const v of values) baselineDist[v] = baselineCount(type, v) / SLOTS;

    const topNumbers = Array.from(numCounts.entries())
      .map(([n, c]) => ({ n, count: c, prob: matches > 0 ? c / matches : 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    out.push({
      conditioner: type,
      conditionValue: value,
      matches,
      nextDist,
      baselineDist,
      topNumbers,
    });
  }

  return out;
};

export const computeAllConditionals = (spinsNewestFirst: number[]) => ({
  color: computeConditional(spinsNewestFirst, "color"),
  sector: computeConditional(spinsNewestFirst, "sector"),
  parity: computeConditional(spinsNewestFirst, "parity"),
  highLow: computeConditional(spinsNewestFirst, "high-low"),
});
