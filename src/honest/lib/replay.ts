import { create } from "zustand";

interface ReplayState {
  active: boolean;
  index: number;
  speed: number;
  source: number[];
  start: (spinsOldestFirst: number[], speed?: number) => void;
  next: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  setSpeed: (s: number) => void;
  jumpTo: (i: number) => void;
}

export const useReplay = create<ReplayState>((set, get) => ({
  active: false,
  index: 0,
  speed: 1,
  source: [],
  start: (spinsOldestFirst, speed = 1) => set({ active: true, index: 0, source: spinsOldestFirst, speed }),
  next: () => {
    const { index, source } = get();
    if (index + 1 >= source.length) set({ active: false });
    else set({ index: index + 1 });
  },
  pause: () => set({ active: false }),
  resume: () => set({ active: true }),
  stop: () => set({ active: false, index: 0, source: [] }),
  setSpeed: (s) => set({ speed: s }),
  jumpTo: (i) => set({ index: Math.max(0, Math.min(get().source.length - 1, i)) }),
}));
