import { create } from "zustand";
import { persist } from "zustand/middleware";

export type BetOutcome = "win" | "loss" | "void";

export interface BetEntry {
  id: string;
  t: number;
  betType: string;
  payout: number;
  stake: number;
  outcome: BetOutcome | null;
  pickedNumber?: number;
  actualNumber?: number;
  delta: number;
  note?: string;
}

interface BetTrackerStore {
  entries: BetEntry[];
  addEntry: (e: Omit<BetEntry, "id" | "t" | "delta" | "outcome"> & { outcome?: BetOutcome | null }) => void;
  resolveEntry: (id: string, outcome: BetOutcome, actualNumber?: number) => void;
  removeEntry: (id: string) => void;
  clearAll: () => void;
}

const computeDelta = (e: Pick<BetEntry, "outcome" | "stake" | "payout">): number => {
  if (e.outcome === "win") return e.stake * e.payout;
  if (e.outcome === "loss") return -e.stake;
  return 0;
};

export const useBetTracker = create<BetTrackerStore>()(
  persist(
    (set) => ({
      entries: [],
      addEntry: (e) => {
        const entry: BetEntry = {
          id: `bet-${Date.now()}-${Math.floor((performance.now() % 1) * 1e6)}`,
          t: Date.now(),
          betType: e.betType,
          payout: e.payout,
          stake: e.stake,
          outcome: e.outcome ?? null,
          pickedNumber: e.pickedNumber,
          actualNumber: e.actualNumber,
          note: e.note,
          delta: 0,
        };
        entry.delta = computeDelta(entry);
        set((s) => ({ entries: [entry, ...s.entries].slice(0, 500) }));
      },
      resolveEntry: (id, outcome, actualNumber) =>
        set((s) => ({
          entries: s.entries.map((e) =>
            e.id === id
              ? { ...e, outcome, actualNumber, delta: computeDelta({ ...e, outcome }) }
              : e
          ),
        })),
      removeEntry: (id) => set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),
      clearAll: () => set({ entries: [] }),
    }),
    {
      name: "rv-bet-tracker-v1",
      partialize: (s) => ({ entries: s.entries }),
    }
  )
);

export interface TrackerStats {
  total: number;
  resolved: number;
  wins: number;
  losses: number;
  pnl: number;
  staked: number;
  roi: number;
  winRate: number;
  avgStake: number;
  bestStreak: number;
  worstStreak: number;
  currentStreak: number;
  currentStreakKind: "win" | "loss" | null;
}

export const computeTrackerStats = (entries: BetEntry[]): TrackerStats => {
  const resolved = entries.filter((e) => e.outcome === "win" || e.outcome === "loss");
  const wins = resolved.filter((e) => e.outcome === "win");
  const losses = resolved.filter((e) => e.outcome === "loss");
  const pnl = resolved.reduce((acc, e) => acc + e.delta, 0);
  const staked = resolved.reduce((acc, e) => acc + e.stake, 0);

  let best = 0, worst = 0, curr = 0, kind: "win" | "loss" | null = null;
  let currentStreak = 0;
  let currentStreakKind: "win" | "loss" | null = null;
  for (const e of [...resolved].reverse()) {
    const k: "win" | "loss" = e.outcome === "win" ? "win" : "loss";
    if (kind === k) curr++;
    else {
      kind = k;
      curr = 1;
    }
    if (k === "win" && curr > best) best = curr;
    if (k === "loss" && curr > worst) worst = curr;
  }
  if (resolved.length > 0) {
    const last = resolved[0];
    currentStreakKind = last.outcome === "win" ? "win" : "loss";
    for (const e of resolved) {
      if ((e.outcome === "win" ? "win" : "loss") === currentStreakKind) currentStreak++;
      else break;
    }
  }

  return {
    total: entries.length,
    resolved: resolved.length,
    wins: wins.length,
    losses: losses.length,
    pnl,
    staked,
    roi: staked > 0 ? pnl / staked : 0,
    winRate: resolved.length > 0 ? wins.length / resolved.length : 0,
    avgStake: resolved.length > 0 ? staked / resolved.length : 0,
    bestStreak: best,
    worstStreak: worst,
    currentStreak,
    currentStreakKind,
  };
};
