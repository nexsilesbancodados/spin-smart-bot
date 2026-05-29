import { SLOTS } from "./wheel";

export interface PairMatrix {
  matrix: number[][];
  rowTotals: number[];
  maxCount: number;
}

export const buildPairMatrix = (spinsNewestFirst: number[]): PairMatrix => {
  const matrix: number[][] = Array.from({ length: SLOTS }, () => new Array(SLOTS).fill(0));
  const rowTotals = new Array(SLOTS).fill(0);
  const oldest = spinsNewestFirst.slice().reverse();
  let maxCount = 0;
  for (let i = 1; i < oldest.length; i++) {
    const a = oldest[i - 1];
    const b = oldest[i];
    matrix[a][b] += 1;
    rowTotals[a] += 1;
    if (matrix[a][b] > maxCount) maxCount = matrix[a][b];
  }
  return { matrix, rowTotals, maxCount };
};

export interface HourBucket {
  hour: number;
  total: number;
  byColor: { red: number; black: number; green: number };
  bySector: { Voisins: number; Tiers: number; Orphelins: number };
}

import { colorOf, sectorOf } from "./wheel";

export const buildHourHeatmap = (spins: Array<{ n: number; t: number }>): HourBucket[] => {
  const buckets: HourBucket[] = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    total: 0,
    byColor: { red: 0, black: 0, green: 0 },
    bySector: { Voisins: 0, Tiers: 0, Orphelins: 0 },
  }));
  for (const s of spins) {
    const h = new Date(s.t).getHours();
    const b = buckets[h];
    b.total += 1;
    b.byColor[colorOf(s.n) as keyof typeof b.byColor] += 1;
    b.bySector[sectorOf(s.n)] += 1;
  }
  return buckets;
};
