import { SLOTS, VOISINS, TIERS, ORPHELINS, sectorOf, terminalOf, colorOf } from "./wheel";

export interface MarkovModel {
  order: number;
  smoothing: number;
  counts: Map<string, Float32Array>;
  totals: Map<string, number>;
}

export const createMarkov = (order: number, smoothing = 0.5): MarkovModel => ({
  order,
  smoothing,
  counts: new Map(),
  totals: new Map(),
});

const keyOf = (seq: number[], i: number, order: number): string =>
  seq.slice(i - order, i).join(",");

export const trainMarkov = (model: MarkovModel, sequence: number[]): void => {
  const past = sequence.slice().reverse();
  for (let i = model.order; i < past.length; i++) {
    const k = keyOf(past, i, model.order);
    const next = past[i];
    let arr = model.counts.get(k);
    if (!arr) {
      arr = new Float32Array(SLOTS);
      model.counts.set(k, arr);
    }
    arr[next] += 1;
    model.totals.set(k, (model.totals.get(k) ?? 0) + 1);
  }
};

export const predictMarkov = (model: MarkovModel, context: number[]): Float32Array => {
  const probs = new Float32Array(SLOTS);
  const baseUniform = 1 / SLOTS;
  if (context.length < model.order) {
    probs.fill(baseUniform);
    return probs;
  }
  const k = context.slice(0, model.order).reverse().join(",");
  const arr = model.counts.get(k);
  const total = model.totals.get(k) ?? 0;
  const smooth = model.smoothing;
  const denom = total + smooth * SLOTS;
  for (let i = 0; i < SLOTS; i++) {
    const c = arr ? arr[i] : 0;
    probs[i] = (c + smooth) / denom;
  }
  return probs;
};

export interface SectorTransitions {
  matrix: number[][];
  totals: number[];
  labels: string[];
}

export const buildSectorTransitions = (spins: number[]): SectorTransitions => {
  const labels = ["Voisins", "Tiers", "Orphelins"] as const;
  const idx = (s: string) => labels.indexOf(s as (typeof labels)[number]);
  const matrix: number[][] = labels.map(() => labels.map(() => 0));
  const totals: number[] = labels.map(() => 0);
  const seq = spins.slice().reverse();
  for (let i = 1; i < seq.length; i++) {
    const a = idx(sectorOf(seq[i - 1]));
    const b = idx(sectorOf(seq[i]));
    if (a >= 0 && b >= 0) {
      matrix[a][b] += 1;
      totals[a] += 1;
    }
  }
  return { matrix, totals, labels: labels.slice() as string[] };
};

export interface NGramHit {
  pattern: number[];
  count: number;
  expected: number;
  lift: number;
}

export const topNGrams = (spins: number[], n: number, top = 8): NGramHit[] => {
  const seq = spins.slice().reverse();
  if (seq.length < n + 1) return [];
  const map = new Map<string, number>();
  for (let i = 0; i <= seq.length - n; i++) {
    const slice = seq.slice(i, i + n).join(",");
    map.set(slice, (map.get(slice) ?? 0) + 1);
  }
  const totalWindows = seq.length - n + 1;
  const baseProb = Math.pow(1 / SLOTS, n);
  const expected = baseProb * totalWindows;
  return [...map.entries()]
    .filter(([, c]) => c > 1)
    .map(([k, c]) => ({
      pattern: k.split(",").map(Number),
      count: c,
      expected,
      lift: c / Math.max(expected, 1e-9),
    }))
    .sort((a, b) => b.lift - a.lift)
    .slice(0, top);
};

export const logLossModel = (
  model: MarkovModel,
  testSequence: number[]
): { logLoss: number; accuracy: number; baseline: number; samples: number } => {
  const seq = testSequence.slice().reverse();
  if (seq.length <= model.order) return { logLoss: 0, accuracy: 0, baseline: Math.log(SLOTS), samples: 0 };
  let loss = 0;
  let hits = 0;
  let total = 0;
  for (let i = model.order; i < seq.length; i++) {
    const ctx = seq.slice(i - model.order, i).reverse();
    const probs = predictMarkov(model, ctx);
    const truth = seq[i];
    loss += -Math.log(Math.max(probs[truth], 1e-9));
    const pred = predTop(probs);
    if (pred === truth) hits++;
    total++;
  }
  return {
    logLoss: loss / total,
    accuracy: hits / total,
    baseline: Math.log(SLOTS),
    samples: total,
  };
};

export const predTop = (probs: Float32Array): number => {
  let best = 0;
  for (let i = 1; i < probs.length; i++) if (probs[i] > probs[best]) best = i;
  return best;
};

export const topK = (probs: Float32Array, k: number): Array<{ n: number; p: number }> => {
  const arr = Array.from(probs).map((p, n) => ({ n, p }));
  arr.sort((a, b) => b.p - a.p);
  return arr.slice(0, k);
};

export const shuffleArray = <T,>(arr: T[], rng = Math.random): T[] => {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

export const synthRandomSpins = (n: number, rng = Math.random): number[] => {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(Math.floor(rng() * SLOTS));
  return out;
};

export interface FalsifierReport {
  trainSize: number;
  testSize: number;
  real: { logLoss: number; accuracy: number; samples: number };
  shuffled: { logLoss: number; accuracy: number; samples: number };
  synthetic: { logLoss: number; accuracy: number; samples: number };
  uniformBaseline: { logLoss: number; accuracy: number };
  verdict: "no_edge" | "marginal" | "investigate";
  message: string;
}

export const runFalsifier = (spins: number[], order = 2, trainFraction = 0.7): FalsifierReport => {
  const oldestFirst = spins.slice().reverse();
  const splitIdx = Math.floor(oldestFirst.length * trainFraction);
  const train = oldestFirst.slice(0, splitIdx);
  const test = oldestFirst.slice(splitIdx);

  const evaluate = (seq: number[]) => {
    const m = createMarkov(order);
    trainMarkov(m, seq.slice(0, splitIdx).slice().reverse());
    const r = logLossModel(m, seq.slice(splitIdx).slice().reverse());
    return { logLoss: r.logLoss, accuracy: r.accuracy, samples: r.samples };
  };

  const realModel = createMarkov(order);
  trainMarkov(realModel, train.slice().reverse());
  const realRep = logLossModel(realModel, test.slice().reverse());

  const shuffled = shuffleArray(spins);
  const shufRep = evaluate(shuffled.slice().reverse());

  const synth = synthRandomSpins(spins.length);
  const synthRep = evaluate(synth.slice().reverse());

  const uniformLogLoss = Math.log(SLOTS);
  const uniformAcc = 1 / SLOTS;

  const realImprovement = uniformLogLoss - realRep.logLoss;
  const shufImprovement = uniformLogLoss - shufRep.logLoss;
  const noiseFloor = Math.abs(shufImprovement) + Math.abs(uniformLogLoss - synthRep.logLoss);
  const signal = realImprovement - noiseFloor;

  let verdict: FalsifierReport["verdict"];
  let message: string;
  if (signal <= 0.01) {
    verdict = "no_edge";
    message =
      "Modelo NÃO supera o acaso. Embaralhar a história ou usar ruído puro produz desempenho equivalente. Não existe padrão preditivo aprendível no histórico.";
  } else if (signal < 0.05) {
    verdict = "marginal";
    message =
      "Diferença marginal sobre o ruído. Pode ser overfit do split de teste. Colete MAIS dados da mesma mesa antes de qualquer interpretação.";
  } else {
    verdict = "investigate";
    message =
      "Desempenho acima do baseline. Possivelmente: viés físico de mesa específica, ou amostra pequena com falso positivo. Repita com mais dados antes de qualquer interpretação. NÃO use para apostar.";
  }

  return {
    trainSize: train.length,
    testSize: test.length,
    real: { logLoss: realRep.logLoss, accuracy: realRep.accuracy, samples: realRep.samples },
    shuffled: { logLoss: shufRep.logLoss, accuracy: shufRep.accuracy, samples: shufRep.samples },
    synthetic: { logLoss: synthRep.logLoss, accuracy: synthRep.accuracy, samples: synthRep.samples },
    uniformBaseline: { logLoss: uniformLogLoss, accuracy: uniformAcc },
    verdict,
    message,
  };
};

export interface PatternMemory {
  totalSpins: number;
  sectorTransitions: SectorTransitions;
  bigrams: NGramHit[];
  trigrams: NGramHit[];
  lastSectors: string[];
  lastTerminals: number[];
  lastColors: string[];
}

export const buildMemory = (spins: number[]): PatternMemory => ({
  totalSpins: spins.length,
  sectorTransitions: buildSectorTransitions(spins),
  bigrams: topNGrams(spins, 2),
  trigrams: topNGrams(spins, 3, 5),
  lastSectors: spins.slice(0, 12).map(sectorOf),
  lastTerminals: spins.slice(0, 12).map(terminalOf),
  lastColors: spins.slice(0, 12).map(colorOf),
});

export const sectorIndexes = (): { name: string; members: number[] }[] => [
  { name: "Voisins", members: Array.from(VOISINS) },
  { name: "Tiers", members: Array.from(TIERS) },
  { name: "Orphelins", members: Array.from(ORPHELINS) },
];
