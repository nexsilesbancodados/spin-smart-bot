import { SLOTS, HOUSE_EDGE, sectorOf, terminalOf, colorOf, VOISINS, TIERS, ORPHELINS, RED, BLACK } from "./wheel";
import { createEnsemble, type EnsembleEngine } from "./ensemble";

export type StrategyId =
  | "ensemble-top1"
  | "ensemble-top5"
  | "ensemble-anti-top5"
  | "coldest-number"
  | "hottest-sector"
  | "always-red"
  | "always-dozen-1"
  | "voisins-flat";

export interface StrategyResult {
  id: StrategyId;
  name: string;
  description: string;
  rounds: number;
  hits: number;
  totalWagered: number;
  totalPnL: number;
  hitRate: number;
  realizedEdge: number;
  expectedEdge: number;
  curve: number[];
}

const wagerPerRound = 1;

const computeNumberWager = (numbers: Set<number>): number => numbers.size * wagerPerRound;

const computePayout = (actual: number, numbers: Set<number>): number => {
  return numbers.has(actual) ? 35 * wagerPerRound + wagerPerRound : 0;
};

const computeEvenWager = (members: Set<number>): number => wagerPerRound;
const computeEvenPayout = (actual: number, members: Set<number>): number => (members.has(actual) ? 2 * wagerPerRound : 0);

interface StrategyImpl {
  id: StrategyId;
  name: string;
  description: string;
  numbersForRound: (params: {
    historyOlderFirst: number[];
    historyIndex: number;
    ensemble: EnsembleEngine;
  }) => { numbers: Set<number>; wager: number; payout: (actual: number) => number };
}

const STRATEGIES: StrategyImpl[] = [
  {
    id: "ensemble-top1",
    name: "Ensemble Top 1",
    description: "Aposta no número com maior probabilidade segundo o ensemble",
    numbersForRound: ({ ensemble }) => {
      const { combined } = ensemble.predict();
      let best = 0;
      for (let i = 1; i < SLOTS; i++) if (combined[i] > combined[best]) best = i;
      const numbers = new Set([best]);
      return { numbers, wager: computeNumberWager(numbers), payout: (a) => computePayout(a, numbers) };
    },
  },
  {
    id: "ensemble-top5",
    name: "Ensemble Top 5",
    description: "Aposta nos 5 números com maior probabilidade segundo o ensemble",
    numbersForRound: ({ ensemble }) => {
      const { combined } = ensemble.predict();
      const idx = Array.from(combined).map((p, i) => ({ p, i }));
      idx.sort((a, b) => b.p - a.p);
      const numbers = new Set(idx.slice(0, 5).map((x) => x.i));
      return { numbers, wager: computeNumberWager(numbers), payout: (a) => computePayout(a, numbers) };
    },
  },
  {
    id: "ensemble-anti-top5",
    name: "Contra Top 5",
    description: "Aposta nos 5 números com MENOR probabilidade segundo o ensemble (anti-tendência)",
    numbersForRound: ({ ensemble }) => {
      const { combined } = ensemble.predict();
      const idx = Array.from(combined).map((p, i) => ({ p, i }));
      idx.sort((a, b) => a.p - b.p);
      const numbers = new Set(idx.slice(0, 5).map((x) => x.i));
      return { numbers, wager: computeNumberWager(numbers), payout: (a) => computePayout(a, numbers) };
    },
  },
  {
    id: "coldest-number",
    name: "Mais frio (maior gap)",
    description: "Aposta no número há mais tempo sem sair na janela",
    numbersForRound: ({ historyOlderFirst, historyIndex }) => {
      const recent = historyOlderFirst.slice(Math.max(0, historyIndex - 200), historyIndex).reverse();
      const gaps = new Array(SLOTS).fill(recent.length);
      for (let i = 0; i < recent.length; i++) if (gaps[recent[i]] === recent.length) gaps[recent[i]] = i;
      let coldest = 0;
      for (let i = 1; i < SLOTS; i++) if (gaps[i] > gaps[coldest]) coldest = i;
      const numbers = new Set([coldest]);
      return { numbers, wager: computeNumberWager(numbers), payout: (a) => computePayout(a, numbers) };
    },
  },
  {
    id: "hottest-sector",
    name: "Setor mais quente",
    description: "Aposta em todos os números do setor (Voisins/Tiers/Orphelins) mais frequente nos últimos 50 giros",
    numbersForRound: ({ historyOlderFirst, historyIndex }) => {
      const recent = historyOlderFirst.slice(Math.max(0, historyIndex - 50), historyIndex);
      const counts: Record<string, number> = { Voisins: 0, Tiers: 0, Orphelins: 0 };
      for (const n of recent) counts[sectorOf(n)] += 1;
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
      const members = top === "Voisins" ? VOISINS : top === "Tiers" ? TIERS : ORPHELINS;
      const numbers = new Set(Array.from(members));
      return { numbers, wager: computeNumberWager(numbers), payout: (a) => computePayout(a, numbers) };
    },
  },
  {
    id: "always-red",
    name: "Sempre vermelho",
    description: "Aposta 1 unidade em vermelho a cada rodada (dinheiro igualado)",
    numbersForRound: () => ({
      numbers: new Set(RED),
      wager: computeEvenWager(RED),
      payout: (a) => computeEvenPayout(a, RED),
    }),
  },
  {
    id: "always-dozen-1",
    name: "Sempre 1ª dúzia",
    description: "Aposta 1 unidade na 1ª dúzia a cada rodada (paga 3:1)",
    numbersForRound: () => {
      const dz = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
      return {
        numbers: dz,
        wager: wagerPerRound,
        payout: (a) => (dz.has(a) ? 3 * wagerPerRound : 0),
      };
    },
  },
  {
    id: "voisins-flat",
    name: "Voisins fixo",
    description: "Aposta no setor Voisins (17 números) sempre, 17 unidades por rodada",
    numbersForRound: () => ({
      numbers: new Set(Array.from(VOISINS)),
      wager: computeNumberWager(new Set(Array.from(VOISINS))),
      payout: (a) => computePayout(a, new Set(Array.from(VOISINS))),
    }),
  },
];

export const listStrategies = (): Array<{ id: StrategyId; name: string; description: string }> =>
  STRATEGIES.map((s) => ({ id: s.id, name: s.name, description: s.description }));

export const runBacktest = (spinsNewestFirst: number[], strategyId: StrategyId): StrategyResult => {
  const impl = STRATEGIES.find((s) => s.id === strategyId);
  if (!impl) throw new Error(`Unknown strategy ${strategyId}`);
  const olderFirst = spinsNewestFirst.slice().reverse();
  if (olderFirst.length < 20) {
    return {
      id: strategyId,
      name: impl.name,
      description: impl.description,
      rounds: 0,
      hits: 0,
      totalWagered: 0,
      totalPnL: 0,
      hitRate: 0,
      realizedEdge: 0,
      expectedEdge: -HOUSE_EDGE,
      curve: [],
    };
  }
  const ensemble = createEnsemble();
  let balance = 0;
  let hits = 0;
  let rounds = 0;
  let totalWagered = 0;
  const curve: number[] = [0];
  const warmup = 10;
  for (let i = warmup; i < olderFirst.length; i++) {
    const trainingSeq = olderFirst.slice(Math.max(0, i - 200), i).reverse();
    ensemble.train(trainingSeq);
    const { numbers, wager, payout } = impl.numbersForRound({
      historyOlderFirst: olderFirst,
      historyIndex: i,
      ensemble,
    });
    const actual = olderFirst[i];
    const gross = payout(actual);
    const net = gross - wager;
    balance += net;
    totalWagered += wager;
    rounds += 1;
    if (gross > 0) hits += 1;
    ensemble.observe(actual);
    curve.push(balance);
    void numbers;
  }
  return {
    id: strategyId,
    name: impl.name,
    description: impl.description,
    rounds,
    hits,
    totalWagered,
    totalPnL: balance,
    hitRate: rounds > 0 ? hits / rounds : 0,
    realizedEdge: totalWagered > 0 ? balance / totalWagered : 0,
    expectedEdge: -HOUSE_EDGE,
    curve,
  };
};

export const runAllBacktests = (spinsNewestFirst: number[]): StrategyResult[] => {
  return STRATEGIES.map((s) => runBacktest(spinsNewestFirst, s.id));
};

void colorOf;
void terminalOf;
void BLACK;
