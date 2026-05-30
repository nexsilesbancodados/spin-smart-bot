import { create } from "zustand";
import { persist } from "zustand/middleware";

export type EngineKind =
  | "pattern-bank"
  | "unified-recency"
  | "unified-markov"
  | "unified-agent"
  | "gap-overdue"
  | "cycle-detect"
  | "cross-lens"
  | "ngram";

interface EngineStats {
  contributed: number;
  hitsWhenContributed: number;
  contributedRecent: number;
  hitsRecent: number;
  weight: number;
  lastUpdate: number | null;
}

interface EngineWeightStore {
  stats: Record<EngineKind, EngineStats>;
  pendingContributors: { spinT: number; engines: EngineKind[] }[];
  recordContribution: (engines: EngineKind[], spinT: number) => void;
  resolveContribution: (spinT: number, hit: boolean) => void;
  reset: () => void;
}

const RECENT_WINDOW = 30;

const blankStats = (): EngineStats => ({
  contributed: 0,
  hitsWhenContributed: 0,
  contributedRecent: 0,
  hitsRecent: 0,
  weight: 1.0,
  lastUpdate: null,
});

const initialStats = (): Record<EngineKind, EngineStats> => ({
  "pattern-bank": blankStats(),
  "unified-recency": blankStats(),
  "unified-markov": blankStats(),
  "unified-agent": blankStats(),
  "gap-overdue": blankStats(),
  "cycle-detect": blankStats(),
  "cross-lens": blankStats(),
  ngram: blankStats(),
});

const computeWeight = (s: EngineStats): number => {
  const minSample = 8;
  if (s.contributed < minSample) return 1.0;
  const recentRate =
    s.contributedRecent > 0 ? s.hitsRecent / s.contributedRecent : 0;
  const longRate = s.contributed > 0 ? s.hitsWhenContributed / s.contributed : 0;
  const blend = s.contributedRecent >= minSample ? recentRate : longRate;
  return Math.max(0.5, Math.min(1.6, 0.7 + 1.2 * blend));
};

export const useEngineWeights = create<EngineWeightStore>()(
  persist(
    (set, get) => ({
      stats: initialStats(),
      pendingContributors: [],

      recordContribution: (engines, spinT) => {
        const s = get();
        const last = s.pendingContributors[0];
        if (last && last.spinT === spinT) return;
        const nextStats = { ...s.stats };
        for (const e of engines) {
          const cur = nextStats[e] ?? blankStats();
          nextStats[e] = {
            ...cur,
            contributed: cur.contributed + 1,
            contributedRecent: cur.contributedRecent + 1,
          };
        }
        const pending = [{ spinT, engines }, ...s.pendingContributors].slice(0, 30);
        set({ stats: nextStats, pendingContributors: pending });
      },

      resolveContribution: (spinT, hit) => {
        const s = get();
        const idx = s.pendingContributors.findIndex((p) => p.spinT !== spinT);
        if (idx < 0) return;
        const entry = s.pendingContributors[idx];
        const nextStats = { ...s.stats };
        for (const e of entry.engines) {
          const cur = nextStats[e] ?? blankStats();
          const next: EngineStats = {
            ...cur,
            hitsWhenContributed: cur.hitsWhenContributed + (hit ? 1 : 0),
            hitsRecent: cur.hitsRecent + (hit ? 1 : 0),
            lastUpdate: spinT,
          };
          if (next.contributedRecent > RECENT_WINDOW) {
            const drop = next.contributedRecent - RECENT_WINDOW;
            next.contributedRecent -= drop;
            next.hitsRecent = Math.max(0, next.hitsRecent - Math.round(drop * (next.hitsRecent / Math.max(1, next.contributedRecent))));
          }
          next.weight = computeWeight(next);
          nextStats[e] = next;
        }
        const nextPending = [...s.pendingContributors.slice(0, idx), ...s.pendingContributors.slice(idx + 1)];
        set({ stats: nextStats, pendingContributors: nextPending });
      },

      reset: () => set({ stats: initialStats(), pendingContributors: [] }),
    }),
    {
      name: "rv-engine-weights-v1",
      partialize: (s) => ({ stats: s.stats }),
    }
  )
);

export const getEngineWeight = (engine: EngineKind): number => {
  return useEngineWeights.getState().stats[engine]?.weight ?? 1.0;
};

export const summarizeEngines = (): Array<{
  engine: EngineKind;
  hits: number;
  attempts: number;
  rate: number;
  weight: number;
  recentRate: number;
}> => {
  const { stats } = useEngineWeights.getState();
  const out: ReturnType<typeof summarizeEngines> = [];
  for (const [engine, s] of Object.entries(stats) as Array<[EngineKind, EngineStats]>) {
    out.push({
      engine,
      hits: s.hitsWhenContributed,
      attempts: s.contributed,
      rate: s.contributed > 0 ? s.hitsWhenContributed / s.contributed : 0,
      weight: s.weight,
      recentRate: s.contributedRecent > 0 ? s.hitsRecent / s.contributedRecent : 0,
    });
  }
  return out.sort((a, b) => b.weight - a.weight);
};
