import { SLOTS, sectorOf, terminalOf, VOISINS, TIERS, ORPHELINS } from "./wheel";
import { createMarkov, trainMarkov, predictMarkov, type MarkovModel } from "./learning";
import { buildPatternMatcherProbs } from "./patternMatcher";
import { detectRegime } from "./regimeDetector";

export type ProbVector = Float32Array;

export interface ModelHandle {
  id: string;
  name: string;
  description: string;
  predict: (context: number[]) => ProbVector;
  update: (sequence: number[]) => void;
  weight: number;
  rollingLogLoss: number;
  predictions: number;
  hits: number;
}

const uniform = (): ProbVector => {
  const p = new Float32Array(SLOTS);
  p.fill(1 / SLOTS);
  return p;
};

const normalize = (v: ProbVector): ProbVector => {
  let sum = 0;
  for (let i = 0; i < v.length; i++) sum += v[i];
  if (sum <= 0) return uniform();
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i] / sum;
  return out;
};

const makeMarkovHandle = (order: number): ModelHandle => {
  let model: MarkovModel = createMarkov(order, 0.5);
  return {
    id: `markov-${order}`,
    name: `Markov ordem ${order}`,
    description: `Cadeia de Markov ordem ${order} com suavização Laplace 0,5`,
    weight: 1,
    rollingLogLoss: Math.log(SLOTS),
    predictions: 0,
    hits: 0,
    predict: (ctx) => predictMarkov(model, ctx),
    update: (seq) => {
      model = createMarkov(order, 0.5);
      trainMarkov(model, seq);
    },
  };
};

const makeFrequencyHandle = (halfLife = 60): ModelHandle => {
  let counts = new Float32Array(SLOTS);
  return {
    id: "freq-exp",
    name: "Frequência exponencial",
    description: `Frequência com decaimento exponencial (meia-vida ${halfLife} giros)`,
    weight: 0.6,
    rollingLogLoss: Math.log(SLOTS),
    predictions: 0,
    hits: 0,
    predict: () => {
      const probs = new Float32Array(SLOTS);
      const smoothing = 0.5;
      let total = 0;
      for (let i = 0; i < SLOTS; i++) {
        probs[i] = counts[i] + smoothing;
        total += probs[i];
      }
      for (let i = 0; i < SLOTS; i++) probs[i] /= total;
      return probs;
    },
    update: (seq) => {
      counts = new Float32Array(SLOTS);
      const decay = Math.pow(0.5, 1 / halfLife);
      const newestFirst = seq;
      for (let i = 0; i < newestFirst.length; i++) {
        const n = newestFirst[i];
        if (n >= 0 && n < SLOTS) counts[n] += Math.pow(decay, i);
      }
    },
  };
};

const makePageRankTransitionHandle = (iterations = 30): ModelHandle => {
  let stationary: ProbVector = new Float32Array(SLOTS).fill(1 / SLOTS);
  return {
    id: "pagerank",
    name: "PageRank de transições",
    description: "Caminhada aleatória na matriz de transição (estacionária)",
    weight: 0.5,
    rollingLogLoss: Math.log(SLOTS),
    predictions: 0,
    hits: 0,
    predict: () => stationary,
    update: (seq) => {
      const matrix: number[][] = Array.from({ length: SLOTS }, () => new Array(SLOTS).fill(0));
      const rowTotal = new Array(SLOTS).fill(0);
      const oldest = seq.slice().reverse();
      for (let i = 1; i < oldest.length; i++) {
        const a = oldest[i - 1];
        const b = oldest[i];
        matrix[a][b] += 1;
        rowTotal[a] += 1;
      }
      const transitions: number[][] = matrix.map((row, i) =>
        row.map((v) => (rowTotal[i] > 0 ? v / rowTotal[i] : 1 / SLOTS))
      );
      let vec = new Float32Array(SLOTS).fill(1 / SLOTS);
      const damping = 0.85;
      for (let it = 0; it < iterations; it++) {
        const next = new Float32Array(SLOTS);
        for (let j = 0; j < SLOTS; j++) {
          let s = 0;
          for (let i = 0; i < SLOTS; i++) s += vec[i] * transitions[i][j];
          next[j] = damping * s + (1 - damping) / SLOTS;
        }
        vec = next;
      }
      stationary = normalize(vec);
    },
  };
};

const makeSectorBoostHandle = (): ModelHandle => {
  let weights: Record<string, number> = { Voisins: 1, Tiers: 1, Orphelins: 1 };
  return {
    id: "sector-boost",
    name: "Boost por setor recente",
    description: "Reforça números do setor predominante nos últimos 20 giros",
    weight: 0.4,
    rollingLogLoss: Math.log(SLOTS),
    predictions: 0,
    hits: 0,
    predict: () => {
      const probs = new Float32Array(SLOTS);
      let total = 0;
      for (let n = 0; n < SLOTS; n++) {
        const sec = sectorOf(n);
        probs[n] = weights[sec] / (sec === "Voisins" ? VOISINS.size : sec === "Tiers" ? TIERS.size : ORPHELINS.size);
        total += probs[n];
      }
      for (let n = 0; n < SLOTS; n++) probs[n] /= total;
      return probs;
    },
    update: (seq) => {
      const recent = seq.slice(0, 20);
      const counts = { Voisins: 0.5, Tiers: 0.5, Orphelins: 0.5 } as Record<string, number>;
      for (const n of recent) counts[sectorOf(n)] += 1;
      const baseProb = { Voisins: 17 / 37, Tiers: 12 / 37, Orphelins: 8 / 37 } as Record<string, number>;
      const w: Record<string, number> = {};
      const recentN = Math.max(1, recent.length);
      for (const k of Object.keys(counts)) {
        const obs = counts[k] / (recentN + 1.5);
        const exp = baseProb[k];
        w[k] = obs / exp;
      }
      weights = w;
    },
  };
};

const makePatternMatcherHandle = (): ModelHandle => {
  let lastSeq: number[] = [];
  return {
    id: "pattern-matcher",
    name: "Pattern Matcher",
    description: "Procura padrões iguais aos últimos giros no histórico e usa o que veio depois.",
    weight: 0.9,
    rollingLogLoss: Math.log(SLOTS),
    predictions: 0,
    hits: 0,
    predict: () => buildPatternMatcherProbs(lastSeq),
    update: (seq) => {
      lastSeq = seq;
    },
  };
};

const makeTerminalDriftHandle = (): ModelHandle => {
  let termWeights = new Array<number>(10).fill(1);
  return {
    id: "terminal-drift",
    name: "Drift de terminais",
    description: "Probabilidade reforçada pelos terminais (0–9) mais frequentes recentemente",
    weight: 0.35,
    rollingLogLoss: Math.log(SLOTS),
    predictions: 0,
    hits: 0,
    predict: () => {
      const probs = new Float32Array(SLOTS);
      let total = 0;
      for (let n = 0; n < SLOTS; n++) {
        const t = terminalOf(n);
        const sizeOfTerm = t <= 6 ? 4 : 3;
        probs[n] = termWeights[t] / sizeOfTerm;
        total += probs[n];
      }
      for (let n = 0; n < SLOTS; n++) probs[n] /= total;
      return probs;
    },
    update: (seq) => {
      const recent = seq.slice(0, 50);
      const counts = new Array<number>(10).fill(0.5);
      for (const n of recent) counts[terminalOf(n)] += 1;
      const totalCount = counts.reduce((a, b) => a + b, 0);
      for (let i = 0; i < 10; i++) {
        const sizeOfTerm = i <= 6 ? 4 : 3;
        const expected = sizeOfTerm / 37;
        const observed = counts[i] / totalCount;
        termWeights[i] = observed / expected;
      }
    },
  };
};

export interface EnsembleResult {
  combined: ProbVector;
  perModel: Array<{ model: ModelHandle; probs: ProbVector }>;
  baselineLogLoss: number;
}

export interface EnsembleEngine {
  models: ModelHandle[];
  predict: () => EnsembleResult;
  train: (sequence: number[]) => void;
  observe: (actual: number) => void;
  reset: () => void;
}

export const createEnsemble = (): EnsembleEngine => {
  const models: ModelHandle[] = [
    makeMarkovHandle(1),
    makeMarkovHandle(2),
    makeMarkovHandle(3),
    makeMarkovHandle(4),
    makeFrequencyHandle(60),
    makePageRankTransitionHandle(),
    makeSectorBoostHandle(),
    makeTerminalDriftHandle(),
    makePatternMatcherHandle(),
  ];

  let lastSequence: number[] = [];
  let lastPredictions: Record<string, ProbVector> = {};

  const predict = (): EnsembleResult => {
    const perModel: Array<{ model: ModelHandle; probs: ProbVector }> = [];
    const combined = new Float32Array(SLOTS);
    let totalWeight = 0;
    for (const m of models) {
      const probs = m.predict(lastSequence);
      perModel.push({ model: m, probs });
      const w = Math.max(0.01, m.weight);
      for (let i = 0; i < SLOTS; i++) combined[i] += probs[i] * w;
      totalWeight += w;
    }
    if (totalWeight > 1e-6) {
      for (let i = 0; i < SLOTS; i++) combined[i] /= totalWeight;
      let sumCombined = 0;
      for (let i = 0; i < SLOTS; i++) sumCombined += combined[i];
      if (sumCombined > 1e-6) {
        for (let i = 0; i < SLOTS; i++) combined[i] /= sumCombined;
      } else {
        combined.fill(1 / SLOTS);
      }
    } else {
      combined.fill(1 / SLOTS);
    }
    lastPredictions = Object.fromEntries(perModel.map((p) => [p.model.id, p.probs]));
    return { combined, perModel, baselineLogLoss: Math.log(SLOTS) };
  };

  const train = (sequence: number[]) => {
    lastSequence = sequence;
    for (const m of models) m.update(sequence);
    if (sequence.length >= 20) {
      const regime = detectRegime(sequence, 50);
      const weightMap: Record<string, number> = {
        "markov-1": regime.recommendedWeights.markov,
        "markov-2": regime.recommendedWeights.markov,
        "markov-3": regime.recommendedWeights.markov,
        "markov-4": regime.recommendedWeights.markov,
        "freq-exp": regime.recommendedWeights.frequency,
        "pagerank": regime.recommendedWeights.pageRank,
        "sector-boost": regime.recommendedWeights.sector,
        "pattern-matcher": regime.recommendedWeights.pattern,
        "terminal-drift": regime.recommendedWeights.frequency,
      };
      const blend = Math.min(1, regime.confidence);
      for (const m of models) {
        const target = weightMap[m.id] ?? 1;
        m.weight = m.weight * (1 - blend * 0.4) + target * (blend * 0.4);
        if (!Number.isFinite(m.weight)) m.weight = 1;
      }
    }
  };

  const observe = (actual: number) => {
    for (const m of models) {
      const probs = lastPredictions[m.id];
      if (!probs) continue;
      const p = Math.max(probs[actual], 1e-9);
      const newLoss = -Math.log(p);
      const alpha = 0.05;
      m.rollingLogLoss = m.rollingLogLoss * (1 - alpha) + newLoss * alpha;
      m.predictions += 1;
      let best = 0;
      for (let i = 1; i < SLOTS; i++) if (probs[i] > probs[best]) best = i;
      if (best === actual) m.hits += 1;
    }
    const baseline = Math.log(SLOTS);
    let totalImprovement = 0;
    for (const m of models) totalImprovement += Math.max(0, baseline - m.rollingLogLoss);
    for (const m of models) {
      const improvement = Math.max(0, baseline - m.rollingLogLoss);
      const ratio = totalImprovement > 1e-9 ? improvement / totalImprovement : 1 / models.length;
      const newWeight = 0.2 + 0.8 * ratio;
      m.weight = Number.isFinite(newWeight) ? newWeight : 1 / models.length;
    }
  };

  const reset = () => {
    for (const m of models) {
      m.weight = 1;
      m.rollingLogLoss = Math.log(SLOTS);
      m.predictions = 0;
      m.hits = 0;
    }
    lastSequence = [];
    lastPredictions = {};
  };

  return { models, predict, train, observe, reset };
};

export const calibrationBuckets = (
  pairs: Array<{ predictedProb: number; hit: boolean }>,
  buckets = 10
): Array<{ bucket: number; predicted: number; observed: number; count: number }> => {
  const out: Array<{ sum: number; count: number; hits: number }> = Array.from({ length: buckets }, () => ({
    sum: 0,
    count: 0,
    hits: 0,
  }));
  for (const p of pairs) {
    const bIdx = Math.min(buckets - 1, Math.floor(p.predictedProb * buckets));
    out[bIdx].sum += p.predictedProb;
    out[bIdx].count += 1;
    if (p.hit) out[bIdx].hits += 1;
  }
  return out.map((b, i) => ({
    bucket: i,
    predicted: b.count > 0 ? b.sum / b.count : (i + 0.5) / buckets,
    observed: b.count > 0 ? b.hits / b.count : 0,
    count: b.count,
  }));
};
