import { SLOTS, colorOf, sectorOf } from "./wheel";

export type FeatureSelector = "number" | "color-red" | "color-black" | "sector-voisins" | "sector-tiers" | "sector-orphelins" | "parity-odd";

const featureValue = (n: number, feature: FeatureSelector): number => {
  switch (feature) {
    case "number":
      return n;
    case "color-red":
      return colorOf(n) === "red" ? 1 : 0;
    case "color-black":
      return colorOf(n) === "black" ? 1 : 0;
    case "sector-voisins":
      return sectorOf(n) === "Voisins" ? 1 : 0;
    case "sector-tiers":
      return sectorOf(n) === "Tiers" ? 1 : 0;
    case "sector-orphelins":
      return sectorOf(n) === "Orphelins" ? 1 : 0;
    case "parity-odd":
      return n !== 0 && n % 2 === 1 ? 1 : 0;
  }
};

export const computeAutocorrelation = (spinsOldestFirst: number[], feature: FeatureSelector, maxLag = 30): Array<{ lag: number; r: number }> => {
  const xs = spinsOldestFirst.map((n) => featureValue(n, feature));
  const n = xs.length;
  if (n < 10) return [];
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  const denom = xs.reduce((acc, v) => acc + (v - mean) * (v - mean), 0);
  if (denom === 0) return Array.from({ length: maxLag + 1 }, (_, lag) => ({ lag, r: lag === 0 ? 1 : 0 }));
  const result: Array<{ lag: number; r: number }> = [];
  for (let lag = 0; lag <= maxLag; lag++) {
    let num = 0;
    for (let i = 0; i + lag < n; i++) {
      num += (xs[i] - mean) * (xs[i + lag] - mean);
    }
    result.push({ lag, r: num / denom });
  }
  return result;
};

void SLOTS;
