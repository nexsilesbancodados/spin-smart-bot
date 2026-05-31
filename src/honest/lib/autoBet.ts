import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AutoBetRecord {
  id: string;
  t: number;
  spinT: number | null;
  spinN: number | null;
  numbersKey: string;
  numbers: number[];
  targetLabel: string;
  targetType: string;
  payout: number;
  stake: number;
  prob: number;
  resolved: boolean;
  hit: boolean | null;
  delta: number;
  bankAfter: number;
}

export interface AutoBetConfig {
  enabled: boolean;
  stake: number;
  startingBank: number;
  currentBank: number;
  maxConsecutiveLosses: number;
  stopOnDrawdownPct: number;
  onlyStrict: boolean;
}

interface AutoBetStore {
  config: AutoBetConfig;
  pending: AutoBetRecord[];
  history: AutoBetRecord[];
  totalBets: number;
  totalHits: number;
  totalStaked: number;
  totalPnL: number;
  pausedReason: string | null;
  setConfig: (patch: Partial<AutoBetConfig>) => void;
  toggleEnabled: () => void;
  registerBet: (input: {
    numbersKey: string;
    numbers: number[];
    targetLabel: string;
    targetType: string;
    payout: number;
    prob: number;
    spinT: number;
  }) => void;
  resolveBets: (actualNumber: number, spinT: number, spinN: number) => void;
  reset: () => void;
  resetBank: () => void;
  clearHistory: () => void;
}

const DEFAULT_CONFIG: AutoBetConfig = {
  enabled: false,
  stake: 5,
  startingBank: 200,
  currentBank: 200,
  maxConsecutiveLosses: 6,
  stopOnDrawdownPct: 20,
  onlyStrict: true,
};

const safeNumber = (n: number): number => (isFinite(n) ? n : 0);

let seq = 0;

export const useAutoBet = create<AutoBetStore>()(
  persist(
    (set, get) => ({
      config: DEFAULT_CONFIG,
      pending: [],
      history: [],
      totalBets: 0,
      totalHits: 0,
      totalStaked: 0,
      totalPnL: 0,
      pausedReason: null,

      setConfig: (patch) =>
        set((s) => ({ config: { ...s.config, ...patch } })),

      toggleEnabled: () =>
        set((s) => ({
          config: { ...s.config, enabled: !s.config.enabled },
          pausedReason: !s.config.enabled ? null : s.pausedReason,
        })),

      registerBet: (input) => {
        const s = get();
        if (!s.config.enabled || s.pausedReason) return;
        if (s.pending.some((p) => p.numbersKey === input.numbersKey)) return;
        if (s.config.currentBank < s.config.stake) {
          set({ pausedReason: "Banca insuficiente para a próxima aposta" });
          return;
        }
        const record: AutoBetRecord = {
          id: `ab-${Date.now()}-${seq++}`,
          t: Date.now(),
          spinT: input.spinT,
          spinN: null,
          numbersKey: input.numbersKey,
          numbers: input.numbers,
          targetLabel: input.targetLabel,
          targetType: input.targetType,
          payout: input.payout,
          stake: s.config.stake,
          prob: input.prob,
          resolved: false,
          hit: null,
          delta: 0,
          bankAfter: s.config.currentBank,
        };
        set({
          pending: [record, ...s.pending].slice(0, 30),
          totalBets: s.totalBets + 1,
          totalStaked: safeNumber(s.totalStaked + s.config.stake),
        });
      },

      resolveBets: (actualNumber, spinT, spinN) => {
        const s = get();
        if (s.pending.length === 0) return;
        const stillPending: AutoBetRecord[] = [];
        const resolvedThisRound: AutoBetRecord[] = [];
        let bank = s.config.currentBank;
        let hitsAdded = 0;
        let pnlAdded = 0;
        for (const p of s.pending) {
          if (p.spinT !== null && p.spinT === spinT) {
            stillPending.push(p);
            continue;
          }
          const hit = p.numbers.includes(actualNumber);
          const delta = hit ? p.stake * p.payout : -p.stake;
          bank = safeNumber(bank + delta);
          const resolved: AutoBetRecord = {
            ...p,
            spinT,
            spinN,
            resolved: true,
            hit,
            delta,
            bankAfter: bank,
          };
          resolvedThisRound.push(resolved);
          if (hit) hitsAdded++;
          pnlAdded += delta;
        }
        let pausedReason: string | null = s.pausedReason;
        if (resolvedThisRound.length > 0) {
          const lastN = [...resolvedThisRound, ...s.history].slice(0, s.config.maxConsecutiveLosses);
          const allLost = lastN.length >= s.config.maxConsecutiveLosses && lastN.every((r) => r.resolved && r.hit === false);
          if (allLost) pausedReason = `Auto-pausa: ${s.config.maxConsecutiveLosses} perdas seguidas`;
          const drawdown = (s.config.startingBank - bank) / Math.max(1, s.config.startingBank);
          if (drawdown >= s.config.stopOnDrawdownPct / 100) {
            pausedReason = `Auto-pausa: drawdown ${(drawdown * 100).toFixed(1)}% atingiu o limite`;
          }
          if (bank <= 0) pausedReason = "Banca zerada";
        }
        set({
          pending: stillPending,
          history: [...resolvedThisRound, ...s.history].slice(0, 200),
          totalHits: s.totalHits + hitsAdded,
          totalPnL: safeNumber(s.totalPnL + pnlAdded),
          config: { ...s.config, currentBank: bank },
          pausedReason,
        });
      },

      reset: () =>
        set({
          config: DEFAULT_CONFIG,
          pending: [],
          history: [],
          totalBets: 0,
          totalHits: 0,
          totalStaked: 0,
          totalPnL: 0,
          pausedReason: null,
        }),

      resetBank: () =>
        set((s) => ({
          config: { ...s.config, currentBank: s.config.startingBank },
          pausedReason: null,
        })),

      clearHistory: () =>
        set({
          history: [],
          pending: [],
          totalBets: 0,
          totalHits: 0,
          totalStaked: 0,
          totalPnL: 0,
        }),
    }),
    {
      name: "rv-autobet-v1",
      partialize: (s) => ({
        config: s.config,
        history: s.history,
        totalBets: s.totalBets,
        totalHits: s.totalHits,
        totalStaked: s.totalStaked,
        totalPnL: s.totalPnL,
      }),
    }
  )
);

export const autoBetStats = () => {
  const s = useAutoBet.getState();
  const winRate = s.totalBets > 0 ? s.totalHits / s.totalBets : 0;
  const roi = s.totalStaked > 0 ? s.totalPnL / s.totalStaked : 0;
  return { winRate, roi };
};
