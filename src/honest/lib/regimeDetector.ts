import { sectorOf, colorOf, VOISINS, TIERS, ORPHELINS } from "./wheel";

export type Regime = "uniform" | "color-streak" | "sector-streak" | "high-variance" | "concentrated";

export interface RegimeReport {
  regime: Regime;
  confidence: number;
  description: string;
  windowSize: number;
  metrics: {
    colorEntropy: number;
    sectorConcentration: number;
    repeatRate: number;
    distinctRatio: number;
  };
  recommendedWeights: {
    markov: number;
    frequency: number;
    pageRank: number;
    sector: number;
    pattern: number;
  };
}

const entropy = (counts: number[]): number => {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  let h = 0;
  for (const c of counts) {
    if (c === 0) continue;
    const p = c / total;
    h -= p * Math.log2(p);
  }
  return h;
};

export const detectRegime = (spinsNewestFirst: number[], windowSize = 50): RegimeReport => {
  const window = spinsNewestFirst.slice(0, windowSize);
  if (window.length < 10) {
    return {
      regime: "uniform",
      confidence: 0,
      description: "Amostra insuficiente para identificar regime.",
      windowSize: window.length,
      metrics: { colorEntropy: 0, sectorConcentration: 0, repeatRate: 0, distinctRatio: 0 },
      recommendedWeights: { markov: 1, frequency: 1, pageRank: 1, sector: 1, pattern: 1 },
    };
  }

  const colorCounts = [0, 0, 0];
  const sectorCounts = { Voisins: 0, Tiers: 0, Orphelins: 0 };
  const numCounts = new Map<number, number>();
  let repeats = 0;
  let prevColor = "";

  for (let i = 0; i < window.length; i++) {
    const n = window[i];
    const c = colorOf(n);
    if (c === "red") colorCounts[0]++;
    else if (c === "black") colorCounts[1]++;
    else colorCounts[2]++;

    sectorCounts[sectorOf(n)]++;
    numCounts.set(n, (numCounts.get(n) ?? 0) + 1);

    if (i > 0 && c === prevColor) repeats++;
    prevColor = c;
  }

  const colorEnt = entropy(colorCounts) / Math.log2(3);
  const maxSector = Math.max(sectorCounts.Voisins / VOISINS.size, sectorCounts.Tiers / TIERS.size, sectorCounts.Orphelins / ORPHELINS.size);
  const expectedSector = window.length / 37;
  const sectorConcentration = expectedSector > 0 ? maxSector / expectedSector : 1;
  const repeatRate = window.length > 1 ? repeats / (window.length - 1) : 0;
  const distinctRatio = numCounts.size / window.length;

  let regime: Regime = "uniform";
  let confidence = 0;
  let description = "Distribuição compatível com aleatoriedade.";
  let recommendedWeights = { markov: 1, frequency: 1, pageRank: 1, sector: 1, pattern: 1 };

  if (repeatRate > 0.7) {
    regime = "color-streak";
    confidence = Math.min(1, (repeatRate - 0.5) * 2);
    description = `Repetição de cor alta (${(repeatRate * 100).toFixed(0)}% mesma cor seguida). Pattern matcher e Markov ganham peso.`;
    recommendedWeights = { markov: 1.5, frequency: 0.6, pageRank: 0.8, sector: 1.0, pattern: 1.8 };
  } else if (sectorConcentration > 1.4) {
    regime = "sector-streak";
    confidence = Math.min(1, (sectorConcentration - 1) * 1.2);
    description = `Setor concentrado (${sectorConcentration.toFixed(2)}× expectativa). Boost sector + frequency.`;
    recommendedWeights = { markov: 1.0, frequency: 1.5, pageRank: 1.2, sector: 1.8, pattern: 1.0 };
  } else if (colorEnt < 0.85) {
    regime = "high-variance";
    confidence = (0.85 - colorEnt) * 4;
    description = `Distribuição desigual de cores (entropia ${colorEnt.toFixed(2)}/1.0).`;
    recommendedWeights = { markov: 1.0, frequency: 1.3, pageRank: 1.1, sector: 1.2, pattern: 1.0 };
  } else if (distinctRatio < 0.5) {
    regime = "concentrated";
    confidence = (0.5 - distinctRatio) * 2;
    description = `Poucos números distintos (${numCounts.size}/${window.length}). Frequency + pattern matcher dominantes.`;
    recommendedWeights = { markov: 0.8, frequency: 1.8, pageRank: 0.9, sector: 1.0, pattern: 1.6 };
  }

  return {
    regime,
    confidence,
    description,
    windowSize: window.length,
    metrics: { colorEntropy: colorEnt, sectorConcentration, repeatRate, distinctRatio },
    recommendedWeights,
  };
};
