import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Annotation {
  id: string;
  spinTimestamp: number;
  text: string;
  tag?: "dealer-change" | "lost-feed" | "bet-placed" | "stop-recommended" | "note";
  createdAt: number;
}

interface AnnotationsStore {
  annotations: Annotation[];
  add: (a: Omit<Annotation, "id" | "createdAt">) => void;
  remove: (id: string) => void;
  forSpin: (spinTimestamp: number) => Annotation[];
  clear: () => void;
}

export const useAnnotations = create<AnnotationsStore>()(
  persist(
    (set, get) => ({
      annotations: [],
      add: (a) =>
        set((s) => ({
          annotations: [
            ...s.annotations,
            { ...a, id: `ann_${Date.now()}_${Math.floor(Math.random() * 1000)}`, createdAt: Date.now() },
          ].slice(-500),
        })),
      remove: (id) => set((s) => ({ annotations: s.annotations.filter((a) => a.id !== id) })),
      forSpin: (spinTimestamp) =>
        get().annotations.filter((a) => Math.abs(a.spinTimestamp - spinTimestamp) < 30_000),
      clear: () => set({ annotations: [] }),
    }),
    { name: "rv-annotations-v1" }
  )
);
