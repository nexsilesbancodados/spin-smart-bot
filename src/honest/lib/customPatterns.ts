import { colorOf, sectorOf, terminalOf, SLOTS, DOZEN_1, DOZEN_2, DOZEN_3, COLUMN_1, COLUMN_2, COLUMN_3 } from "./wheel";

export type Feature = "number" | "color" | "sector" | "dozen" | "column" | "terminal" | "parity" | "high-low";

export const features: Array<{ id: Feature; label: string }> = [
  { id: "color", label: "Cor" },
  { id: "sector", label: "Setor" },
  { id: "dozen", label: "Dúzia" },
  { id: "column", label: "Coluna" },
  { id: "terminal", label: "Terminal" },
  { id: "parity", label: "Par/Ímpar" },
  { id: "high-low", label: "Alto/Baixo" },
  { id: "number", label: "Número exato" },
];

export const valueOf = (n: number, feature: Feature): string => {
  switch (feature) {
    case "number":
      return String(n);
    case "color":
      return colorOf(n);
    case "sector":
      return sectorOf(n);
    case "terminal":
      return `T${terminalOf(n)}`;
    case "parity":
      return n === 0 ? "zero" : n % 2 === 0 ? "par" : "impar";
    case "high-low":
      return n === 0 ? "zero" : n <= 18 ? "baixo" : "alto";
    case "dozen":
      return DOZEN_1.has(n) ? "D1" : DOZEN_2.has(n) ? "D2" : DOZEN_3.has(n) ? "D3" : "zero";
    case "column":
      return COLUMN_1.has(n) ? "C1" : COLUMN_2.has(n) ? "C2" : COLUMN_3.has(n) ? "C3" : "zero";
  }
};

export const possibleValues = (feature: Feature): string[] => {
  switch (feature) {
    case "number":
      return Array.from({ length: SLOTS }, (_, n) => String(n));
    case "color":
      return ["red", "black", "green"];
    case "sector":
      return ["Voisins", "Tiers", "Orphelins"];
    case "terminal":
      return Array.from({ length: 10 }, (_, t) => `T${t}`);
    case "parity":
      return ["par", "impar", "zero"];
    case "high-low":
      return ["baixo", "alto", "zero"];
    case "dozen":
      return ["D1", "D2", "D3", "zero"];
    case "column":
      return ["C1", "C2", "C3", "zero"];
  }
};

export interface PatternRule {
  id: string;
  name: string;
  triggerFeature: Feature;
  triggerValue: string;
  triggerStreak: number;
  expectFeature: Feature;
  expectValue: string;
  enabled: boolean;
}

export interface PatternEvaluation {
  rule: PatternRule;
  triggerFires: number;
  hits: number;
  hitRate: number;
  baselineRate: number;
  z: number;
  signal: boolean;
  currentStreak: number;
}

const baselineCountForValue = (feature: Feature, value: string): number => {
  let count = 0;
  for (let n = 0; n < SLOTS; n++) if (valueOf(n, feature) === value) count += 1;
  return count;
};

export const evaluateRule = (rule: PatternRule, spinsNewestFirst: number[]): PatternEvaluation => {
  const oldest = spinsNewestFirst.slice().reverse();
  let fires = 0;
  let hits = 0;
  let streak = 0;
  for (let i = 0; i < oldest.length; i++) {
    const v = valueOf(oldest[i], rule.triggerFeature);
    if (v === rule.triggerValue) streak += 1;
    else streak = 0;
    if (streak >= rule.triggerStreak && i + 1 < oldest.length) {
      fires += 1;
      const next = oldest[i + 1];
      if (valueOf(next, rule.expectFeature) === rule.expectValue) hits += 1;
    }
  }

  let currentStreak = 0;
  for (let i = 0; i < spinsNewestFirst.length; i++) {
    if (valueOf(spinsNewestFirst[i], rule.triggerFeature) === rule.triggerValue) currentStreak += 1;
    else break;
  }

  const baselineCount = baselineCountForValue(rule.expectFeature, rule.expectValue);
  const baselineRate = baselineCount / SLOTS;
  const hitRate = fires > 0 ? hits / fires : 0;
  const variance = fires > 0 ? (baselineRate * (1 - baselineRate)) / fires : 0;
  const sd = Math.sqrt(Math.max(1e-9, variance));
  const z = sd > 0 ? (hitRate - baselineRate) / sd : 0;
  const signal = currentStreak >= rule.triggerStreak;

  return {
    rule,
    triggerFires: fires,
    hits,
    hitRate,
    baselineRate,
    z,
    signal,
    currentStreak,
  };
};

export const defaultRules: PatternRule[] = [
  {
    id: "3-red-to-black",
    name: "3 vermelhos → preto",
    triggerFeature: "color",
    triggerValue: "red",
    triggerStreak: 3,
    expectFeature: "color",
    expectValue: "black",
    enabled: true,
  },
  {
    id: "2-voisins-to-orphelins",
    name: "2 Voisins → Orphelins",
    triggerFeature: "sector",
    triggerValue: "Voisins",
    triggerStreak: 2,
    expectFeature: "sector",
    expectValue: "Orphelins",
    enabled: true,
  },
  {
    id: "dozen1-streak-to-dozen3",
    name: "2 D1 → D3",
    triggerFeature: "dozen",
    triggerValue: "D1",
    triggerStreak: 2,
    expectFeature: "dozen",
    expectValue: "D3",
    enabled: true,
  },
];
