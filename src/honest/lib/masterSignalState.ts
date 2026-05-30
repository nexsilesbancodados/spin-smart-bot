import { create } from "zustand";

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

export const useMasterSignalState = create<MasterSignalState>((set, get) => ({
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
}));

export const computeAntiStickPenalty = (
  numbersKey: string,
  currentSpinCount: number
): { penalty: number; recentCount: number; recentMisses: number } => {
  const recent = useMasterSignalState.getState().recent;
  let recentCount = 0;
  let recentMisses = 0;
  for (const w of recent) {
    if (w.numbersKey === numbersKey && currentSpinCount - w.shownAtSpinCount <= WINDOW) {
      recentCount++;
      if (w.resolved && w.hit === false) recentMisses++;
    }
  }
  let penalty = 1.0;
  if (recentCount >= 4) penalty *= 0.55;
  else if (recentCount >= 3) penalty *= 0.7;
  else if (recentCount >= 2) penalty *= 0.85;
  if (recentMisses >= 2) penalty *= 0.7;
  if (recentMisses >= 3) penalty *= 0.5;
  return { penalty, recentCount, recentMisses };
};
