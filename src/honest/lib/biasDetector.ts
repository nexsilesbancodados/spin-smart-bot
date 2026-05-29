import { SLOTS } from "./wheel";

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

const chiSqPValue = (chi2: number, df: number): number => {
  if (chi2 <= 0 || df <= 0) return 1;
  return 1 - gammaInc(df / 2, chi2 / 2);
};

const erfInv = (x: number): number => {
  const a = 0.147;
  const ln = Math.log(1 - x * x);
  const t1 = 2 / (Math.PI * a) + ln / 2;
  return Math.sign(x) * Math.sqrt(Math.sqrt(t1 * t1 - ln / a) - t1);
};

const zForConfidence = (confidence: number): number => {
  return Math.SQRT2 * erfInv(confidence);
};

export interface PerNumberBias {
  number: number;
  observed: number;
  expected: number;
  z: number;
  ciLow: number;
  ciHigh: number;
  pRaw: number;
  pBonferroni: number;
  significant: boolean;
}

export interface BiasReport {
  totalSpins: number;
  chi2: number;
  df: number;
  pUniform: number;
  alpha: number;
  bonferroniAlpha: number;
  significantNumbers: PerNumberBias[];
  perNumber: PerNumberBias[];
  sampleVerdict: "insufficient" | "weak" | "moderate" | "strong";
  conclusion: string;
}

const sampleVerdict = (n: number): BiasReport["sampleVerdict"] => {
  if (n < 500) return "insufficient";
  if (n < 2000) return "weak";
  if (n < 5000) return "moderate";
  return "strong";
};

const normalCdf = (z: number): number => {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014337 * Math.exp(-(z * z) / 2);
  const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z > 0 ? 1 - p : p;
};

export const detectWheelBias = (spinsNewestFirst: number[], alpha = 0.05): BiasReport => {
  const counts = new Array<number>(SLOTS).fill(0);
  for (const n of spinsNewestFirst) if (n >= 0 && n < SLOTS) counts[n] += 1;
  const total = spinsNewestFirst.length;
  const expected = total / SLOTS;

  let chi2 = 0;
  if (expected > 0) {
    for (let i = 0; i < SLOTS; i++) {
      const diff = counts[i] - expected;
      chi2 += (diff * diff) / expected;
    }
  }
  const df = SLOTS - 1;
  const pUniform = chiSqPValue(chi2, df);
  const bonferroniAlpha = alpha / SLOTS;
  const zCritBonf = zForConfidence(1 - bonferroniAlpha);
  const variance = expected * (1 - 1 / SLOTS);
  const sd = Math.sqrt(Math.max(1e-9, variance));

  const perNumber: PerNumberBias[] = [];
  for (let i = 0; i < SLOTS; i++) {
    const z = total > 0 ? (counts[i] - expected) / sd : 0;
    const pRaw = total > 0 ? 2 * (1 - normalCdf(Math.abs(z))) : 1;
    const pBonferroni = Math.min(1, pRaw * SLOTS);
    const ciLow = expected - zCritBonf * sd;
    const ciHigh = expected + zCritBonf * sd;
    perNumber.push({
      number: i,
      observed: counts[i],
      expected,
      z,
      ciLow,
      ciHigh,
      pRaw,
      pBonferroni,
      significant: counts[i] < ciLow || counts[i] > ciHigh,
    });
  }
  const significantNumbers = perNumber.filter((p) => p.significant);
  const verdict = sampleVerdict(total);

  let conclusion = "";
  if (verdict === "insufficient") {
    conclusion = `Amostra insuficiente (${total} giros). Para afirmar viés numa casa específica com 95% de confiança são necessários ao menos 5.000 giros da MESMA mesa física. Resultado atual: compatível com roda justa.`;
  } else if (significantNumbers.length === 0) {
    conclusion = `Distribuição compatível com roda justa após correção Bonferroni (α=${bonferroniAlpha.toFixed(4)}). Nenhum número apresenta desvio significativo.`;
  } else if (verdict === "weak") {
    conclusion = `${significantNumbers.length} número(s) saíram fora do intervalo de confiança 95% (Bonferroni). Amostra ainda fraca — pode ser ruído. Continue coletando da MESMA mesa para confirmar.`;
  } else {
    conclusion = `${significantNumbers.length} número(s) com desvio significativo após Bonferroni. Numa mesa específica e com ${total} giros, isto SUGERE viés físico. Confirme com mais dados antes de tomar qualquer decisão. NÃO use isto para apostar sem entender risco.`;
  }
  return {
    totalSpins: total,
    chi2,
    df,
    pUniform,
    alpha,
    bonferroniAlpha,
    significantNumbers,
    perNumber,
    sampleVerdict: verdict,
    conclusion,
  };
};
