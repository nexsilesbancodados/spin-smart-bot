import { SLOTS, sectorOf, colorOf, DOZEN_1, DOZEN_2, DOZEN_3 } from "./wheel";

export type FingerprintType = "exact" | "color" | "sector" | "dozen" | "parity";

const colorKey = (n: number) => (colorOf(n) === "red" ? "R" : colorOf(n) === "black" ? "B" : "G");
const sectorKey = (n: number) => (sectorOf(n) === "Voisins" ? "V" : sectorOf(n) === "Tiers" ? "T" : "O");
const dozenKey = (n: number) => (DOZEN_1.has(n) ? "1" : DOZEN_2.has(n) ? "2" : DOZEN_3.has(n) ? "3" : "0");
const parityKey = (n: number) => (n === 0 ? "Z" : n % 2 === 0 ? "P" : "I");

const fingerprintOf = (slice: number[], type: FingerprintType): string => {
  switch (type) {
    case "exact":
      return slice.join(",");
    case "color":
      return slice.map(colorKey).join("");
    case "sector":
      return slice.map(sectorKey).join("");
    case "dozen":
      return slice.map(dozenKey).join("");
    case "parity":
      return slice.map(parityKey).join("");
  }
};

export interface PatternMatch {
  type: FingerprintType;
  length: number;
  pattern: string;
  totalMatches: number;
  nextDistribution: Record<number, number>;
  topNextNumbers: Array<{ n: number; count: number; prob: number }>;
  topNextLabel?: { label: string; count: number; prob: number };
}

export const findCurrentPattern = (
  spinsNewestFirst: number[],
  length: number,
  type: FingerprintType
): PatternMatch | null => {
  if (spinsNewestFirst.length < length + 2) return null;
  const current = spinsNewestFirst.slice(0, length).reverse();
  const target = fingerprintOf(current, type);

  const oldest = spinsNewestFirst.slice().reverse();
  const nextDistribution: Record<number, number> = {};
  let totalMatches = 0;
  for (let i = 0; i <= oldest.length - length - 1; i++) {
    const slice = oldest.slice(i, i + length);
    if (fingerprintOf(slice, type) === target) {
      const next = oldest[i + length];
      nextDistribution[next] = (nextDistribution[next] ?? 0) + 1;
      totalMatches += 1;
    }
  }

  if (totalMatches === 0) return null;

  const topNextNumbers = Object.entries(nextDistribution)
    .map(([n, c]) => ({ n: Number(n), count: c, prob: c / totalMatches }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  let topNextLabel: { label: string; count: number; prob: number } | undefined;
  if (type === "color") {
    const colorCounts: Record<string, number> = { R: 0, B: 0, G: 0 };
    for (const [n, c] of Object.entries(nextDistribution)) {
      colorCounts[colorKey(Number(n))] += c;
    }
    const [k, v] = Object.entries(colorCounts).sort((a, b) => b[1] - a[1])[0];
    topNextLabel = { label: k === "R" ? "Vermelho" : k === "B" ? "Preto" : "Verde (0)", count: v, prob: v / totalMatches };
  } else if (type === "sector") {
    const sCounts: Record<string, number> = { V: 0, T: 0, O: 0 };
    for (const [n, c] of Object.entries(nextDistribution)) sCounts[sectorKey(Number(n))] += c;
    const [k, v] = Object.entries(sCounts).sort((a, b) => b[1] - a[1])[0];
    topNextLabel = { label: k === "V" ? "Voisins" : k === "T" ? "Tiers" : "Orphelins", count: v, prob: v / totalMatches };
  } else if (type === "dozen") {
    const dCounts: Record<string, number> = { "0": 0, "1": 0, "2": 0, "3": 0 };
    for (const [n, c] of Object.entries(nextDistribution)) dCounts[dozenKey(Number(n))] += c;
    const sorted = Object.entries(dCounts).sort((a, b) => b[1] - a[1]);
    const [k, v] = sorted[0];
    topNextLabel = {
      label: k === "0" ? "Zero" : `${k}ª Dúzia`,
      count: v,
      prob: v / totalMatches,
    };
  }

  return {
    type,
    length,
    pattern: target,
    totalMatches,
    nextDistribution,
    topNextNumbers,
    topNextLabel,
  };
};

export const buildPatternMatcherProbs = (spinsNewestFirst: number[]): Float32Array => {
  const probs = new Float32Array(SLOTS);
  const smoothing = 0.5;

  const matches: Array<{ match: PatternMatch; weight: number }> = [];
  for (const config of [
    { type: "color" as const, length: 3, weight: 0.5 },
    { type: "color" as const, length: 5, weight: 0.8 },
    { type: "sector" as const, length: 3, weight: 0.7 },
    { type: "sector" as const, length: 5, weight: 1.0 },
    { type: "dozen" as const, length: 4, weight: 0.6 },
    { type: "parity" as const, length: 4, weight: 0.4 },
    { type: "exact" as const, length: 2, weight: 1.0 },
    { type: "exact" as const, length: 3, weight: 1.5 },
  ]) {
    const m = findCurrentPattern(spinsNewestFirst, config.length, config.type);
    if (m && m.totalMatches >= 2) matches.push({ match: m, weight: config.weight });
  }

  if (matches.length === 0) {
    probs.fill(1 / SLOTS);
    return probs;
  }

  const totalWeight = matches.reduce((a, b) => a + b.weight, 0);
  if (totalWeight < 1e-9) {
    probs.fill(1 / SLOTS);
    return probs;
  }
  probs.fill(0);
  for (const { match, weight } of matches) {
    const denom = match.totalMatches + smoothing * SLOTS;
    const w = weight / totalWeight;
    for (let n = 0; n < SLOTS; n++) {
      const c = match.nextDistribution[n] ?? 0;
      probs[n] += w * ((c + smoothing) / denom);
    }
  }
  let sum = 0;
  for (let n = 0; n < SLOTS; n++) sum += probs[n];
  if (sum > 1e-9) {
    for (let n = 0; n < SLOTS; n++) probs[n] /= sum;
  } else {
    probs.fill(1 / SLOTS);
  }
  return probs;
};

export const fingerprintLabel: Record<FingerprintType, string> = {
  exact: "Sequência exata",
  color: "Padrão de cor",
  sector: "Padrão de setor",
  dozen: "Padrão de dúzia",
  parity: "Padrão par/ímpar",
};
