import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createIdbStorage } from "./idbStorage";

export interface Spin {
  n: number;
  t: number;
  source: "manual" | "live" | "extension" | "import";
}

export interface SessionState {
  startedAt: number | null;
  initial: number;
  current: number;
  spinsThisSession: number;
  stake: number;
  stopLossPct: number;
  targetPct: number;
  maxRounds: number;
  maxMinutes: number;
  betType: "straight" | "even";
}

export interface BetResult {
  t: number;
  delta: number;
  stake: number;
  balanceAfter: number;
}

export interface SessionRecord {
  id: string;
  startedAt: number;
  endedAt: number;
  initial: number;
  final: number;
  pnl: number;
  pnlPct: number;
  rounds: number;
  stakeAvg: number;
  stopLossPct: number;
  targetPct: number;
  reachedStop: boolean;
  reachedTarget: boolean;
  reachedMaxRounds: boolean;
  betType: "straight" | "even";
  bets: BetResult[];
  worstStreak: number;
  respectedLimits: boolean;
}


interface HonestStore {
  spins: Spin[];
  session: SessionState;
  sessionBets: BetResult[];
  history: SessionRecord[];
  windowSize: 20 | 50 | 100 | 500;

  addSpin: (n: number, source?: Spin["source"]) => void;
  addSpins: (nums: number[], source?: Spin["source"]) => void;
  setLiveSpins: (nums: number[]) => void;
  clearSpins: () => void;
  removeLast: () => void;

  startSession: (initial: number) => void;
  endSession: () => SessionRecord | null;
  recordResult: (delta: number) => void;
  updateSessionConfig: (patch: Partial<SessionState>) => void;
  setWindow: (w: HonestStore["windowSize"]) => void;

  clearHistory: () => void;
}

const defaultSession: SessionState = {
  startedAt: null,
  initial: 0,
  current: 0,
  spinsThisSession: 0,
  stake: 5,
  stopLossPct: 20,
  targetPct: 20,
  maxRounds: 60,
  maxMinutes: 60,
  betType: "straight",
};

const computeWorstStreak = (bets: BetResult[]): number => {
  let worst = 0;
  let cur = 0;
  for (const b of bets) {
    if (b.delta < 0) {
      cur += 1;
      if (cur > worst) worst = cur;
    } else {
      cur = 0;
    }
  }
  return worst;
};

const wasRespected = (
  session: SessionState,
  final: number,
  rounds: number,
  bets: BetResult[]
): boolean => {
  const stopAt = session.initial * (1 - session.stopLossPct / 100);
  if (final < stopAt - 0.01) return false;
  if (rounds > session.maxRounds + 1) return false;
  const escalations = bets.reduce((acc, b, i) => {
    if (i === 0) return acc;
    const prev = bets[i - 1];
    if (prev.delta < 0 && b.stake > prev.stake * 1.5) acc += 1;
    return acc;
  }, 0);
  if (escalations >= 3) return false;
  return true;
};

export const useHonestStore = create<HonestStore>()(
  persist(
    (set) => ({
      spins: [],
      session: defaultSession,
      sessionBets: [],
      history: [],
      windowSize: 50,

      addSpin: (n, source = "manual") =>
        set((s) => ({
          spins: [{ n, t: Date.now(), source }, ...s.spins].slice(0, 50000),
        })),

      addSpins: (nums, source = "import") =>
        set((s) => {
          const now = Date.now();
          const added = nums.map((n, i) => ({ n, t: now - i, source }));
          return { spins: [...added, ...s.spins].slice(0, 50000) };
        }),

      setLiveSpins: (nums) =>
        set(() => {
          const now = Date.now();
          const spins: Spin[] = nums.slice(0, 2000).map((n, i) => ({
            n,
            t: now - i * 1000,
            source: "live" as const,
          }));
          return { spins };
        }),

      clearSpins: () => set({ spins: [] }),

      removeLast: () => set((s) => ({ spins: s.spins.slice(1) })),

      startSession: (initial) =>
        set((s) => ({
          session: {
            ...s.session,
            startedAt: Date.now(),
            initial,
            current: initial,
            spinsThisSession: 0,
          },
          sessionBets: [],
        })),

      endSession: () => {
        let record: SessionRecord | null = null;
        set((s) => {
          if (!s.session.startedAt) return s;
          const stopAt = s.session.initial * (1 - s.session.stopLossPct / 100);
          const targetAt = s.session.initial * (1 + s.session.targetPct / 100);
          const stakeAvg =
            s.sessionBets.length > 0
              ? s.sessionBets.reduce((a, b) => a + b.stake, 0) / s.sessionBets.length
              : s.session.stake;
          record = {
            id: `s_${s.session.startedAt}`,
            startedAt: s.session.startedAt,
            endedAt: Date.now(),
            initial: s.session.initial,
            final: s.session.current,
            pnl: s.session.current - s.session.initial,
            pnlPct:
              s.session.initial > 0
                ? ((s.session.current - s.session.initial) / s.session.initial) * 100
                : 0,
            rounds: s.session.spinsThisSession,
            stakeAvg,
            stopLossPct: s.session.stopLossPct,
            targetPct: s.session.targetPct,
            reachedStop: s.session.current <= stopAt,
            reachedTarget: s.session.current >= targetAt,
            reachedMaxRounds: s.session.spinsThisSession >= s.session.maxRounds,
            betType: s.session.betType,
            bets: s.sessionBets,
            worstStreak: computeWorstStreak(s.sessionBets),
            respectedLimits: wasRespected(
              s.session,
              s.session.current,
              s.session.spinsThisSession,
              s.sessionBets
            ),
          };
          return {
            session: { ...s.session, startedAt: null },
            sessionBets: [],
            history: [record, ...s.history].slice(0, 500),
          };
        });
        return record;
      },

      recordResult: (delta) =>
        set((s) => {
          if (!s.session.startedAt) return s;
          const newBalance = s.session.current + delta;
          const bet: BetResult = {
            t: Date.now(),
            delta,
            stake: s.session.stake,
            balanceAfter: newBalance,
          };
          return {
            session: {
              ...s.session,
              current: newBalance,
              spinsThisSession: s.session.spinsThisSession + 1,
            },
            sessionBets: [...s.sessionBets, bet],
          };
        }),

      updateSessionConfig: (patch) =>
        set((s) => ({ session: { ...s.session, ...patch } })),

      setWindow: (w) => set({ windowSize: w }),

      clearHistory: () => set({ history: [] }),
    }),
    {
      name: "roleta-vision-honest-v1",
      storage: createIdbStorage<HonestStore>(),
    }
  )
);

export const selectWindowSpins = (s: HonestStore): number[] =>
  s.spins.slice(0, s.windowSize).map((x) => x.n);

export const selectAllSpinNumbers = (s: HonestStore): number[] => s.spins.map((x) => x.n);
