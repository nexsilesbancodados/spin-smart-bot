export const WHEEL = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
  24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
] as const;

export const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
export const BLACK = new Set([2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35]);

export const VOISINS = new Set([22, 18, 29, 7, 28, 12, 35, 3, 26, 0, 32, 15, 19, 4, 21, 2, 25]);
export const TIERS = new Set([27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33]);
export const ORPHELINS = new Set([17, 34, 6, 1, 20, 14, 31, 9]);
export const JEU_ZERO = new Set([12, 35, 3, 26, 0, 32, 15]);

export const COLUMN_1 = new Set([1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34]);
export const COLUMN_2 = new Set([2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35]);
export const COLUMN_3 = new Set([3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36]);

export const DOZEN_1 = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
export const DOZEN_2 = new Set([13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24]);
export const DOZEN_3 = new Set([25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36]);

export const HOUSE_EDGE = 0.027;
export const SLOTS = 37;

export type Color = "red" | "black" | "green";
export const colorOf = (n: number): Color => (n === 0 ? "green" : RED.has(n) ? "red" : "black");

export type Sector = "Voisins" | "Tiers" | "Orphelins";
export const sectorOf = (n: number): Sector =>
  VOISINS.has(n) ? "Voisins" : TIERS.has(n) ? "Tiers" : "Orphelins";

export const wheelIndex = (n: number) => WHEEL.indexOf(n as (typeof WHEEL)[number]);

export const physicalNeighbors = (n: number, radius: number): number[] => {
  const i = wheelIndex(n);
  if (i < 0) return [];
  const out: number[] = [];
  for (let k = -radius; k <= radius; k++) {
    if (k === 0) continue;
    const j = (i + k + WHEEL.length) % WHEEL.length;
    out.push(WHEEL[j]);
  }
  return out;
};

export const TERMINAL_SIZE: Record<number, number> = {
  0: 4, 1: 4, 2: 4, 3: 4, 4: 4, 5: 4, 6: 4,
  7: 3, 8: 3, 9: 3,
};

export const terminalOf = (n: number) => n % 10;
export const numbersWithTerminal = (t: number): number[] => {
  const out: number[] = [];
  for (let n = 0; n <= 36; n++) if (n % 10 === t) out.push(n);
  return out;
};
