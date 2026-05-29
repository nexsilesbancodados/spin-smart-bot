import { SLOTS, sectorOf, colorOf, VOISINS, TIERS, ORPHELINS } from "./wheel";

export interface TrendPoint {
  window: number;
  voisins: number;
  tiers: number;
  orphelins: number;
  red: number;
  black: number;
  zero: number;
}

export const buildTrends = (spinsNewestFirst: number[], windowSize = 50): TrendPoint[] => {
  const points: TrendPoint[] = [];
  for (let start = spinsNewestFirst.length - windowSize; start >= 0; start -= windowSize / 2) {
    const window = spinsNewestFirst.slice(start, start + windowSize);
    if (window.length < windowSize / 2) continue;
    let voisins = 0, tiers = 0, orphelins = 0, red = 0, black = 0, zero = 0;
    for (const n of window) {
      const sec = sectorOf(n);
      const col = colorOf(n);
      if (sec === "Voisins") voisins++;
      else if (sec === "Tiers") tiers++;
      else if (sec === "Orphelins") orphelins++;
      if (col === "red") red++;
      else if (col === "black") black++;
      else zero++;
    }
    const total = window.length;
    points.push({
      window: spinsNewestFirst.length - start,
      voisins: voisins / total,
      tiers: tiers / total,
      orphelins: orphelins / total,
      red: red / total,
      black: black / total,
      zero: zero / total,
    });
  }
  return points.reverse();
};

export interface SequencePattern {
  pattern: number[];
  count: number;
  expected: number;
  lift: number;
}

export const mineSequences = (spinsNewestFirst: number[], length = 3, minCount = 2, top = 10): SequencePattern[] => {
  if (spinsNewestFirst.length < length + 1) return [];
  const seq = spinsNewestFirst.slice().reverse();
  const map = new Map<string, number>();
  for (let i = 0; i <= seq.length - length; i++) {
    const key = seq.slice(i, i + length).join(",");
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  const totalWindows = seq.length - length + 1;
  const baseProb = Math.pow(1 / SLOTS, length);
  const expected = baseProb * totalWindows;
  return [...map.entries()]
    .filter(([, c]) => c >= minCount)
    .map(([k, c]) => ({
      pattern: k.split(",").map(Number),
      count: c,
      expected,
      lift: c / Math.max(expected, 1e-9),
    }))
    .sort((a, b) => b.lift - a.lift)
    .slice(0, top);
};

export interface WheelHeat {
  number: number;
  count: number;
  ratio: number;
  z: number;
  position: number;
}

export const buildWheelHeat = (spinsNewestFirst: number[], windowSize = 100): WheelHeat[] => {
  const window = spinsNewestFirst.slice(0, windowSize);
  const counts = new Array<number>(SLOTS).fill(0);
  for (const n of window) if (n >= 0 && n < SLOTS) counts[n]++;
  const expected = window.length / SLOTS;
  const sd = Math.sqrt(Math.max(1e-9, window.length * (1 / SLOTS) * (1 - 1 / SLOTS)));
  const wheel = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
  return wheel.map((n, position) => ({
    number: n,
    count: counts[n],
    ratio: window.length > 0 ? counts[n] / window.length : 0,
    z: sd > 0 ? (counts[n] - expected) / sd : 0,
    position,
  }));
};

export const buildArcStats = (spinsNewestFirst: number[], windowSize = 100) => {
  const window = spinsNewestFirst.slice(0, windowSize);
  let voisins = 0, tiers = 0, orphelins = 0;
  for (const n of window) {
    if (VOISINS.has(n)) voisins++;
    else if (TIERS.has(n)) tiers++;
    else if (ORPHELINS.has(n)) orphelins++;
  }
  return { voisins, tiers, orphelins, total: window.length };
};
