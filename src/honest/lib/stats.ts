import { SLOTS } from "./wheel";

export type Verdict = "aleatorio" | "leve" | "incomum";

export interface SectorAnalysis {
  name: string;
  size: number;
  observed: number;
  expected: number;
  p: number;
  z: number;
  verdict: Verdict;
  message: string;
}

const verdictFor = (z: number): Verdict =>
  Math.abs(z) < 2 ? "aleatorio" : Math.abs(z) < 3 ? "leve" : "incomum";

const messageFor = (v: Verdict): string => {
  switch (v) {
    case "aleatorio":
      return "Dentro da variação normal (aleatório).";
    case "leve":
      return "Desvio leve — esperado acontecer com frequência só por acaso. Sem valor preditivo.";
    case "incomum":
      return "Desvio incomum nesta amostra — ainda assim, não prevê o próximo giro; só justifica coletar MAIS dados da MESMA mesa física.";
  }
};

export const analyzeGroup = (name: string, members: Set<number>, spins: number[]): SectorAnalysis => {
  const size = members.size;
  const n = spins.length;
  const p = size / SLOTS;
  const expected = n * p;
  const observed = spins.reduce((acc, x) => acc + (members.has(x) ? 1 : 0), 0);
  const variance = expected * (1 - p);
  const z = variance > 0 ? (observed - expected) / Math.sqrt(variance) : 0;
  const verdict = verdictFor(z);
  return { name, size, observed, expected, p, z, verdict, message: messageFor(verdict) };
};

export interface ChiSquareResult {
  chi2: number;
  df: number;
  pApprox: number;
  uniformCompatible: boolean;
  summary: string;
}

const gammaInc = (s: number, x: number): number => {
  if (x < 0 || s <= 0) return 0;
  let sum = 1 / s;
  let term = sum;
  for (let k = 1; k < 200; k++) {
    term *= x / (s + k);
    sum += term;
    if (Math.abs(term) < 1e-12 * Math.abs(sum)) break;
  }
  return Math.exp(-x + s * Math.log(x) - lnGamma(s)) * sum;
};

const lnGamma = (z: number): number => {
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
  z -= 1;
  let x = c[0];
  for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
};

const chiSqPValue = (chi2: number, df: number): number => {
  if (chi2 <= 0 || df <= 0) return 1;
  return 1 - gammaInc(df / 2, chi2 / 2);
};

export const chiSquareUniform = (spins: number[]): ChiSquareResult => {
  const counts = new Array<number>(SLOTS).fill(0);
  for (const n of spins) if (n >= 0 && n < SLOTS) counts[n]++;
  const expected = spins.length / SLOTS;
  let chi2 = 0;
  if (expected > 0) {
    for (let i = 0; i < SLOTS; i++) {
      const diff = counts[i] - expected;
      chi2 += (diff * diff) / expected;
    }
  }
  const df = SLOTS - 1;
  const pApprox = chiSqPValue(chi2, df);
  const uniformCompatible = pApprox > 0.05;
  const summary = uniformCompatible
    ? `Distribuição compatível com o acaso (p ≈ ${pApprox.toFixed(3)} > 0,05).`
    : `Distribuição com desvio (p ≈ ${pApprox.toFixed(3)}). Não prevê o próximo giro; sugere coletar mais dados da MESMA mesa.`;
  return { chi2, df, pApprox, uniformCompatible, summary };
};

export const concentrationIndex = (spins: number[]): number => {
  if (spins.length === 0) return 0;
  const counts = new Array<number>(SLOTS).fill(0);
  for (const n of spins) if (n >= 0 && n < SLOTS) counts[n]++;
  const total = spins.length;
  let h = 0;
  for (let i = 0; i < SLOTS; i++) {
    const p = counts[i] / total;
    if (p > 0) h -= p * Math.log(p);
  }
  const hMax = Math.log(SLOTS);
  const norm = h / hMax;
  return Math.round((1 - norm) * 100);
};

export interface CountedItem {
  value: number;
  count: number;
  expected: number;
  z: number;
  verdict: Verdict;
}

export const countAndScore = (spins: number[], groups: Map<number, Set<number>>): CountedItem[] => {
  const n = spins.length;
  const items: CountedItem[] = [];
  for (const [value, members] of groups) {
    const p = members.size / SLOTS;
    const expected = n * p;
    const observed = spins.reduce((acc, x) => acc + (members.has(x) ? 1 : 0), 0);
    const variance = expected * (1 - p);
    const z = variance > 0 ? (observed - expected) / Math.sqrt(variance) : 0;
    items.push({ value, count: observed, expected, z, verdict: verdictFor(z) });
  }
  return items;
};

export const gapByNumber = (spins: number[]): Record<number, number> => {
  const gaps: Record<number, number> = {};
  for (let n = 0; n < SLOTS; n++) {
    const idx = spins.indexOf(n);
    gaps[n] = idx < 0 ? spins.length : idx;
  }
  return gaps;
};

export const numberFrequencies = (spins: number[]): number[] => {
  const counts = new Array<number>(SLOTS).fill(0);
  for (const n of spins) if (n >= 0 && n < SLOTS) counts[n]++;
  return counts;
};
