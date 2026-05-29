import { create } from "zustand";
import { persist } from "zustand/middleware";
import { SLOTS, HOUSE_EDGE, VOISINS, TIERS, ORPHELINS, RED, BLACK, DOZEN_1, DOZEN_2, DOZEN_3, COLUMN_1, COLUMN_2, COLUMN_3, physicalNeighbors } from "./wheel";
import { evaluateRule, type PatternRule } from "./customPatterns";
import { createEnsemble } from "./ensemble";

export type SelectionMode =
  | "manual"
  | "voisins"
  | "tiers"
  | "orphelins"
  | "red"
  | "black"
  | "dozen-1"
  | "dozen-2"
  | "dozen-3"
  | "column-1"
  | "column-2"
  | "column-3"
  | "ensemble-top-n"
  | "coldest-n"
  | "hottest-n"
  | "neighbors-of";

export interface CustomStrategy {
  id: string;
  name: string;
  selectionMode: SelectionMode;
  manualNumbers: number[];
  topN: number;
  neighborCenter: number;
  neighborRadius: number;
  triggers: PatternRule[];
  triggerLogic: "AND" | "OR" | "ANY";
  enabled: boolean;
}

interface StrategyStore {
  strategies: CustomStrategy[];
  add: (s: CustomStrategy) => void;
  update: (id: string, patch: Partial<CustomStrategy>) => void;
  remove: (id: string) => void;
  reorder: (from: number, to: number) => void;
}

const newStrategy = (id: string): CustomStrategy => ({
  id,
  name: "Nova estratégia",
  selectionMode: "voisins",
  manualNumbers: [],
  topN: 5,
  neighborCenter: 0,
  neighborRadius: 2,
  triggers: [],
  triggerLogic: "ANY",
  enabled: true,
});

export const useCustomStrategies = create<StrategyStore>()(
  persist(
    (set) => ({
      strategies: [newStrategy(`s_${Date.now()}`)],
      add: (s) => set((st) => ({ strategies: [...st.strategies, s] })),
      update: (id, patch) =>
        set((st) => ({
          strategies: st.strategies.map((s) => (s.id === id ? { ...s, ...patch } : s)),
        })),
      remove: (id) =>
        set((st) => ({ strategies: st.strategies.filter((s) => s.id !== id) })),
      reorder: (from, to) =>
        set((st) => {
          const arr = st.strategies.slice();
          const [m] = arr.splice(from, 1);
          arr.splice(to, 0, m);
          return { strategies: arr };
        }),
    }),
    { name: "rv-custom-strategies-v1" }
  )
);

export const makeStrategy = (): CustomStrategy => newStrategy(`s_${Date.now()}_${Math.floor(Math.random() * 1000)}`);

const setToArray = (s: Set<number>): number[] => Array.from(s);

export const resolveNumbers = (
  strategy: CustomStrategy,
  spinsNewestFirst: number[]
): number[] => {
  switch (strategy.selectionMode) {
    case "manual":
      return strategy.manualNumbers.filter((n) => n >= 0 && n <= 36);
    case "voisins":
      return setToArray(VOISINS);
    case "tiers":
      return setToArray(TIERS);
    case "orphelins":
      return setToArray(ORPHELINS);
    case "red":
      return setToArray(RED);
    case "black":
      return setToArray(BLACK);
    case "dozen-1":
      return setToArray(DOZEN_1);
    case "dozen-2":
      return setToArray(DOZEN_2);
    case "dozen-3":
      return setToArray(DOZEN_3);
    case "column-1":
      return setToArray(COLUMN_1);
    case "column-2":
      return setToArray(COLUMN_2);
    case "column-3":
      return setToArray(COLUMN_3);
    case "neighbors-of":
      return [strategy.neighborCenter, ...physicalNeighbors(strategy.neighborCenter, strategy.neighborRadius)];
    case "hottest-n": {
      const counts = new Array<number>(SLOTS).fill(0);
      for (const n of spinsNewestFirst.slice(0, 100)) counts[n] += 1;
      return counts
        .map((c, i) => ({ c, i }))
        .sort((a, b) => b.c - a.c)
        .slice(0, strategy.topN)
        .map((x) => x.i);
    }
    case "coldest-n": {
      const idx = new Array<number>(SLOTS).fill(-1);
      for (let i = 0; i < spinsNewestFirst.length; i++) {
        if (idx[spinsNewestFirst[i]] === -1) idx[spinsNewestFirst[i]] = i;
      }
      return idx
        .map((v, i) => ({ v: v === -1 ? spinsNewestFirst.length : v, i }))
        .sort((a, b) => b.v - a.v)
        .slice(0, strategy.topN)
        .map((x) => x.i);
    }
    case "ensemble-top-n": {
      if (spinsNewestFirst.length < 5) return [];
      const ens = createEnsemble();
      ens.train(spinsNewestFirst);
      const probs = ens.predict().combined;
      return Array.from(probs)
        .map((p, n) => ({ p, n }))
        .sort((a, b) => b.p - a.p)
        .slice(0, strategy.topN)
        .map((x) => x.n);
    }
  }
};

const evalTriggers = (strategy: CustomStrategy, spinsNewestFirst: number[]): boolean => {
  if (strategy.triggers.length === 0) return true;
  const results = strategy.triggers.map((t) => {
    if (!t.enabled) return null;
    const ev = evaluateRule(t, spinsNewestFirst);
    return ev.signal;
  }).filter((v): v is boolean => v !== null);
  if (results.length === 0) return true;
  switch (strategy.triggerLogic) {
    case "AND":
      return results.every((r) => r);
    case "OR":
    case "ANY":
      return results.some((r) => r);
  }
};

export interface CustomBacktestResult {
  strategyId: string;
  strategyName: string;
  rounds: number;
  triggered: number;
  hits: number;
  totalWagered: number;
  totalPnL: number;
  hitRate: number;
  realizedEdge: number;
  expectedEdge: number;
  curve: number[];
}

export const runCustomBacktest = (
  strategy: CustomStrategy,
  spinsNewestFirst: number[]
): CustomBacktestResult => {
  const olderFirst = spinsNewestFirst.slice().reverse();
  let bal = 0;
  let rounds = 0;
  let hits = 0;
  let triggered = 0;
  let totalWagered = 0;
  const curve: number[] = [0];

  for (let i = 20; i < olderFirst.length; i++) {
    const contextNewestFirst = olderFirst.slice(0, i).reverse();
    if (!evalTriggers(strategy, contextNewestFirst)) {
      curve.push(bal);
      continue;
    }
    triggered += 1;
    const nums = resolveNumbers(strategy, contextNewestFirst);
    if (nums.length === 0) {
      curve.push(bal);
      continue;
    }
    const actual = olderFirst[i];
    const isNumberBet = nums.length <= 12 || (nums.length >= 17 && nums.length < 18);
    const wager = isNumberBet ? nums.length : 1;
    const hit = nums.includes(actual);
    const payout = hit ? (isNumberBet ? 36 : Math.floor(SLOTS / nums.length) + 1) : 0;
    bal += payout - wager;
    totalWagered += wager;
    rounds += 1;
    if (hit) hits += 1;
    curve.push(bal);
  }

  return {
    strategyId: strategy.id,
    strategyName: strategy.name,
    rounds,
    triggered,
    hits,
    totalWagered,
    totalPnL: bal,
    hitRate: rounds > 0 ? hits / rounds : 0,
    realizedEdge: totalWagered > 0 ? bal / totalWagered : 0,
    expectedEdge: -HOUSE_EDGE,
    curve,
  };
};

export const SELECTION_LABELS: Record<SelectionMode, string> = {
  manual: "Números manuais",
  voisins: "Voisins du Zéro (17)",
  tiers: "Tiers du Cylindre (12)",
  orphelins: "Orphelins (8)",
  red: "Vermelho",
  black: "Preto",
  "dozen-1": "1ª Dúzia (1-12)",
  "dozen-2": "2ª Dúzia (13-24)",
  "dozen-3": "3ª Dúzia (25-36)",
  "column-1": "Coluna 1",
  "column-2": "Coluna 2",
  "column-3": "Coluna 3",
  "ensemble-top-n": "Top N do ensemble",
  "coldest-n": "N mais frios (maior gap)",
  "hottest-n": "N mais quentes",
  "neighbors-of": "Vizinhos físicos de N",
};
