import { colorOf, sectorOf } from "./wheel";

const featureSeq = (spinsOldestFirst: number[], feature: "color" | "sector"): number[] => {
  if (feature === "color") return spinsOldestFirst.map((n) => (colorOf(n) === "red" ? 1 : colorOf(n) === "black" ? -1 : 0));
  return spinsOldestFirst.map((n) => {
    const s = sectorOf(n);
    return s === "Voisins" ? 1 : s === "Tiers" ? 0 : -1;
  });
};

export interface CycleHit {
  period: number;
  strength: number;
  pValueApprox: number;
}

export const findCycles = (spinsOldestFirst: number[], feature: "color" | "sector" = "color"): CycleHit[] => {
  const xs = featureSeq(spinsOldestFirst, feature);
  const n = xs.length;
  if (n < 30) return [];
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  const centered = xs.map((v) => v - mean);
  const denom = centered.reduce((acc, v) => acc + v * v, 0);
  if (denom === 0) return [];
  const out: CycleHit[] = [];
  for (let p = 2; p <= Math.min(40, Math.floor(n / 2)); p++) {
    let num = 0;
    for (let i = 0; i + p < n; i++) num += centered[i] * centered[i + p];
    const r = num / denom;
    const strength = Math.abs(r);
    const pVal = Math.exp(-strength * Math.sqrt(n - p) * 0.5);
    if (strength > 0.1) out.push({ period: p, strength, pValueApprox: Math.min(1, pVal) });
  }
  return out.sort((a, b) => b.strength - a.strength).slice(0, 10);
};
