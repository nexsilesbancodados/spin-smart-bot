import { create } from "zustand";
import { persist } from "zustand/middleware";

interface RecentWinner {
  id: string;
  numbersKey: string;
  shownAtSpinCount: number;
  resolved: boolean;
  hit: boolean | null;
}

interface MasterSignalState {
  recent: RecentWinner[];
  shownAtSpins: number;
  recordShown: (id: string, numbersKey: string, spinCount: number) => void;
  resolveLast: (actualNumber: number, candidateNumbers: number[][]) => void;
  reset: () => void;
}

const WINDOW = 8;

export const useMasterSignalState = create<MasterSignalState>()(
  persist(
    (set, get) => ({
      recent: [],
      shownAtSpins: 0,

      recordShown: (id, numbersKey, spinCount) => {
        const last = get().recent[0];
        if (last && last.id === id && last.shownAtSpinCount === spinCount) return;
        set((s) => ({
          recent: [
            { id, numbersKey, shownAtSpinCount: spinCount, resolved: false, hit: null },
            ...s.recent,
          ].slice(0, WINDOW),
          shownAtSpins: spinCount,
        }));
      },

      resolveLast: (actualNumber, candidateNumbers) => {
        set((s) => {
          const next = s.recent.map((w, i) => {
            if (w.resolved) return w;
            const numbers = candidateNumbers[i];
            if (!numbers) return w;
            const hit = numbers.includes(actualNumber);
            return { ...w, resolved: true, hit };
          });
          return { recent: next };
        });
      },

      reset: () => set({ recent: [], shownAtSpins: 0 }),
    }),
    {
      name: "rv-master-signal-state-v1",
      partialize: (s) => ({ recent: s.recent, shownAtSpins: s.shownAtSpins }),
    }
  )
);

const MISS_COOLDOWN_SPINS = 5;

export const computeAntiStickPenalty = (
  numbersKey: string,
  currentSpinCount: number
): { penalty: number; recentCount: number; recentMisses: number; cooldown: boolean } => {
  const recent = useMasterSignalState.getState().recent;
  let recentCount = 0;
  let recentMisses = 0;
  let cooldown = false;
  for (const w of recent) {
    if (w.numbersKey !== numbersKey) continue;
    const age = currentSpinCount - w.shownAtSpinCount;
    if (age <= WINDOW) {
      recentCount++;
      if (w.resolved && w.hit === false) recentMisses++;
    }
    if (w.resolved && w.hit === false && age <= MISS_COOLDOWN_SPINS) {
      cooldown = true;
    }
  }
  let penalty = 1.0;
  if (recentCount >= 4) penalty *= 0.55;
  else if (recentCount >= 3) penalty *= 0.7;
  else if (recentCount >= 2) penalty *= 0.85;
  if (recentMisses >= 2) penalty *= 0.7;
  if (recentMisses >= 3) penalty *= 0.5;
  if (cooldown) penalty *= 0.4;
  return { penalty, recentCount, recentMisses, cooldown };
};
