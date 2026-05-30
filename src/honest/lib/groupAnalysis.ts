import { DOZEN_1, DOZEN_2, DOZEN_3, COLUMN_1, COLUMN_2, COLUMN_3 } from "./wheel";

export type GroupCode = "D1" | "D2" | "D3" | "Z";
export type ColumnCode = "C1" | "C2" | "C3" | "Z";

export const dozenOf = (n: number): GroupCode => {
  if (n === 0) return "Z";
  if (DOZEN_1.has(n)) return "D1";
  if (DOZEN_2.has(n)) return "D2";
  return "D3";
};

export const columnOf = (n: number): ColumnCode => {
  if (n === 0) return "Z";
  if (COLUMN_1.has(n)) return "C1";
  if (COLUMN_2.has(n)) return "C2";
  return "C3";
};

export const NON_ZERO_DOZENS: GroupCode[] = ["D1", "D2", "D3"];
export const NON_ZERO_COLUMNS: ColumnCode[] = ["C1", "C2", "C3"];

const erfc = (x: number): number => {
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x);
  return 1 - y;
};
export const pTwoSided = (z: number): number => Math.min(1, erfc(Math.abs(z) / Math.SQRT2));

export interface MarkovTransition<T extends string> {
  matrix: Record<T, Record<T, number>>;
  rowTotals: Record<T, number>;
  probs: Record<T, Record<T, number>>;
  total: number;
}

export const buildMarkov1 = <T extends string>(
  series: T[],
  keys: T[]
): MarkovTransition<T> => {
  const matrix = {} as Record<T, Record<T, number>>;
  const rowTotals = {} as Record<T, number>;
  const probs = {} as Record<T, Record<T, number>>;
  keys.forEach((k) => {
    matrix[k] = {} as Record<T, number>;
    rowTotals[k] = 0;
    probs[k] = {} as Record<T, number>;
    keys.forEach((k2) => {
      matrix[k][k2] = 0;
      probs[k][k2] = 0;
    });
  });
  for (let i = 0; i < series.length - 1; i++) {
    const curr = series[i + 1];
    const next = series[i];
    if (matrix[curr] && matrix[curr][next] !== undefined) {
      matrix[curr][next]++;
      rowTotals[curr]++;
    }
  }
  keys.forEach((k) => {
    const total = rowTotals[k];
    if (total > 0) {
      keys.forEach((k2) => {
        probs[k][k2] = matrix[k][k2] / total;
      });
    }
  });
  return { matrix, rowTotals, probs, total: series.length - 1 };
};

export interface Markov2Result<T extends string> {
  counts: Map<string, Map<T, number>>;
  totals: Map<string, number>;
}

export const buildMarkov2 = <T extends string>(series: T[]): Markov2Result<T> => {
  const counts = new Map<string, Map<T, number>>();
  const totals = new Map<string, number>();
  for (let i = 0; i < series.length - 2; i++) {
    const a = series[i + 2];
    const b = series[i + 1];
    const next = series[i];
    const key = `${a}|${b}`;
    if (!counts.has(key)) counts.set(key, new Map());
    const m = counts.get(key)!;
    m.set(next, (m.get(next) || 0) + 1);
    totals.set(key, (totals.get(key) || 0) + 1);
  }
  return { counts, totals };
};

export const markov2Predict = <T extends string>(
  m2: Markov2Result<T>,
  context: [T, T],
  keys: T[],
  baseline: Record<T, number>,
  alpha = 1
): { probs: Record<T, number>; samples: number } => {
  const key = `${context[0]}|${context[1]}`;
  const total = m2.totals.get(key) || 0;
  const inner = m2.counts.get(key) || new Map<T, number>();
  const probs = {} as Record<T, number>;
  const denom = total + alpha * keys.length;
  keys.forEach((k) => {
    const count = inner.get(k) || 0;
    const prior = (baseline[k] ?? 1 / keys.length) * alpha;
    probs[k] = (count + prior) / denom;
  });
  return { probs, samples: total };
};

export interface RunStats<T extends string> {
  longestByGroup: Record<T, number>;
  currentRun: { value: T | null; length: number };
  expectedRunMean: number;
  observedRunMean: Record<T, number>;
  runs: Record<T, number[]>;
}

export const runLengthStats = <T extends string>(
  series: T[],
  keys: T[]
): RunStats<T> => {
  const runs = {} as Record<T, number[]>;
  keys.forEach((k) => (runs[k] = []));
  let currVal: T | null = null;
  let currLen = 0;
  for (let i = series.length - 1; i >= 0; i--) {
    const v = series[i];
    if (v !== currVal) {
      if (currVal !== null && runs[currVal]) runs[currVal].push(currLen);
      currVal = v;
      currLen = 1;
    } else {
      currLen++;
    }
  }
  if (currVal !== null && runs[currVal]) runs[currVal].push(currLen);

  const longestByGroup = {} as Record<T, number>;
  const observedRunMean = {} as Record<T, number>;
  keys.forEach((k) => {
    longestByGroup[k] = runs[k].length > 0 ? Math.max(...runs[k]) : 0;
    observedRunMean[k] =
      runs[k].length > 0 ? runs[k].reduce((a, b) => a + b, 0) / runs[k].length : 0;
  });

  let currentRun: { value: T | null; length: number } = { value: null, length: 0 };
  if (series.length > 0) {
    const head = series[0];
    let len = 1;
    for (let i = 1; i < series.length; i++) {
      if (series[i] === head) len++;
      else break;
    }
    currentRun = { value: head, length: len };
  }

  return {
    longestByGroup,
    currentRun,
    expectedRunMean: 1 / (1 - 1 / keys.length),
    observedRunMean,
    runs,
  };
};

export interface GapStats<T extends string> {
  meanGap: Record<T, number>;
  expectedGap: number;
  currentGap: Record<T, number>;
  maxGap: Record<T, number>;
}

export const gapStats = <T extends string>(
  series: T[],
  keys: T[]
): GapStats<T> => {
  const gaps = {} as Record<T, number[]>;
  const lastSeen = {} as Record<T, number | null>;
  const currentGap = {} as Record<T, number>;
  keys.forEach((k) => {
    gaps[k] = [];
    lastSeen[k] = null;
    currentGap[k] = -1;
  });

  for (let i = series.length - 1; i >= 0; i--) {
    const v = series[i];
    if (lastSeen[v] !== null && lastSeen[v] !== undefined) {
      gaps[v].push(i - (lastSeen[v] as number));
    }
    lastSeen[v] = i;
  }
  keys.forEach((k) => {
    if (lastSeen[k] !== null && lastSeen[k] !== undefined) {
      currentGap[k] = lastSeen[k] as number;
    } else {
      currentGap[k] = series.length;
    }
  });

  const meanGap = {} as Record<T, number>;
  const maxGap = {} as Record<T, number>;
  keys.forEach((k) => {
    meanGap[k] = gaps[k].length > 0 ? gaps[k].reduce((a, b) => a + b, 0) / gaps[k].length : 0;
    maxGap[k] = gaps[k].length > 0 ? Math.max(...gaps[k]) : 0;
  });

  return {
    meanGap,
    expectedGap: keys.length,
    currentGap,
    maxGap,
  };
};

export const detectCycles = <T extends string>(series: T[], minLength = 3, maxLength = 5): {
  found: boolean;
  cycleLength: number;
  pattern: T[];
  occurrences: number;
} => {
  if (series.length < minLength * 2) return { found: false, cycleLength: 0, pattern: [], occurrences: 0 };
  for (let len = minLength; len <= maxLength; len++) {
    const tail = series.slice(0, len);
    let occ = 0;
    let matching = true;
    for (let i = 0; i + len < series.length && i < 30; i += len) {
      for (let j = 0; j < len; j++) {
        if (series[i + j] !== tail[j]) {
          matching = false;
          break;
        }
      }
      if (matching) occ++;
      else break;
    }
    if (occ >= 2) {
      return { found: true, cycleLength: len, pattern: tail.slice().reverse(), occurrences: occ };
    }
  }
  return { found: false, cycleLength: 0, pattern: [], occurrences: 0 };
};

export interface AlternationStats {
  changesObserved: number;
  changesExpected: number;
  alternationRate: number;
  expectedAlternationRate: number;
  z: number;
  p: number;
  verdict: "clustering" | "expected" | "alternation";
}

export const alternationStats = <T extends string>(
  series: T[],
  keys: T[]
): AlternationStats => {
  if (series.length < 5) {
    return {
      changesObserved: 0,
      changesExpected: 0,
      alternationRate: 0,
      expectedAlternationRate: 0,
      z: 0,
      p: 1,
      verdict: "expected",
    };
  }
  let changes = 0;
  for (let i = 0; i < series.length - 1; i++) {
    if (series[i] !== series[i + 1]) changes++;
  }
  const trials = series.length - 1;
  const pExp = (keys.length - 1) / keys.length;
  const expected = trials * pExp;
  const variance = trials * pExp * (1 - pExp);
  const sigma = Math.sqrt(Math.max(0.0001, variance));
  const z = sigma > 0 ? (changes - expected) / sigma : 0;
  const p = pTwoSided(z);
  const verdict: AlternationStats["verdict"] =
    Math.abs(z) < 1.5 ? "expected" : z > 0 ? "alternation" : "clustering";
  return {
    changesObserved: changes,
    changesExpected: expected,
    alternationRate: changes / trials,
    expectedAlternationRate: pExp,
    z,
    p,
    verdict,
  };
};
