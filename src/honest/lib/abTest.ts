import { create } from "zustand";
import { persist } from "zustand/middleware";
import { SLOTS } from "./wheel";
import type { SignalRecord } from "./signalAgent";

export interface ABVariantConfig {
  name: string;
  threshold: number;
  topNHit: number;
}

interface ABTestStore {
  enabled: boolean;
  configA: ABVariantConfig;
  configB: ABVariantConfig;
  pendingA: SignalRecord[];
  pendingB: SignalRecord[];
  historyA: SignalRecord[];
  historyB: SignalRecord[];
  setEnabled: (v: boolean) => void;
  setConfigA: (patch: Partial<ABVariantConfig>) => void;
  setConfigB: (patch: Partial<ABVariantConfig>) => void;
  pushPredictionA: (s: SignalRecord) => void;
  pushPredictionB: (s: SignalRecord) => void;
  resolveA: (actual: number) => SignalRecord | null;
  resolveB: (actual: number) => SignalRecord | null;
  clearHistory: () => void;
}

const defaultA: ABVariantConfig = { name: "Conservador", threshold: 0.055, topNHit: 5 };
const defaultB: ABVariantConfig = { name: "Agressivo", threshold: 0.030, topNHit: 5 };

export const useABTest = create<ABTestStore>()(
  persist(
    (set, get) => ({
      enabled: false,
      configA: defaultA,
      configB: defaultB,
      pendingA: [],
      pendingB: [],
      historyA: [],
      historyB: [],
      setEnabled: (v) => set({ enabled: v }),
      setConfigA: (patch) => set((s) => ({ configA: { ...s.configA, ...patch } })),
      setConfigB: (patch) => set((s) => ({ configB: { ...s.configB, ...patch } })),
      pushPredictionA: (sig) =>
        set((s) => ({ pendingA: [sig, ...s.pendingA].slice(0, 30) })),
      pushPredictionB: (sig) =>
        set((s) => ({ pendingB: [sig, ...s.pendingB].slice(0, 30) })),
      resolveA: (actual) => {
        const s = get();
        if (s.pendingA.length === 0) return null;
        const sig = s.pendingA[s.pendingA.length - 1];
        const topPicks = sig.topPicks.slice(0, s.configA.topNHit);
        const updated: SignalRecord = {
          ...sig,
          actualNumber: actual,
          resolvedAt: Date.now(),
          hitMain: sig.mainPick === actual,
          hitTop5: topPicks.includes(actual),
          hitNeighbors: topPicks.includes(actual),
        };
        set({
          pendingA: s.pendingA.slice(0, -1),
          historyA: [updated, ...s.historyA].slice(0, 300),
        });
        return updated;
      },
      resolveB: (actual) => {
        const s = get();
        if (s.pendingB.length === 0) return null;
        const sig = s.pendingB[s.pendingB.length - 1];
        const topPicks = sig.topPicks.slice(0, s.configB.topNHit);
        const updated: SignalRecord = {
          ...sig,
          actualNumber: actual,
          resolvedAt: Date.now(),
          hitMain: sig.mainPick === actual,
          hitTop5: topPicks.includes(actual),
          hitNeighbors: topPicks.includes(actual),
        };
        set({
          pendingB: s.pendingB.slice(0, -1),
          historyB: [updated, ...s.historyB].slice(0, 300),
        });
        return updated;
      },
      clearHistory: () => set({ historyA: [], historyB: [], pendingA: [], pendingB: [] }),
    }),
    {
      name: "rv-ab-test-v1",
      partialize: (s) => ({ enabled: s.enabled, configA: s.configA, configB: s.configB, historyA: s.historyA, historyB: s.historyB }),
    }
  )
);

export interface VariantStats {
  emitted: number;
  resolved: number;
  hitMain: number;
  hitTop: number;
  hitRateMain: number;
  hitRateTop: number;
  liftTop: number;
  baselineMain: number;
  baselineTop: number;
}

export const computeVariantStats = (history: SignalRecord[], topN: number): VariantStats => {
  const resolved = history.filter((s) => s.actualNumber !== null);
  const hitMain = resolved.filter((s) => s.hitMain === true).length;
  const hitTop = resolved.filter((s) => s.hitTop5 === true).length;
  const baselineMain = 1 / SLOTS;
  const baselineTop = topN / SLOTS;
  const hitRateMain = resolved.length > 0 ? hitMain / resolved.length : 0;
  const hitRateTop = resolved.length > 0 ? hitTop / resolved.length : 0;
  return {
    emitted: history.length,
    resolved: resolved.length,
    hitMain,
    hitTop,
    hitRateMain,
    hitRateTop,
    liftTop: baselineTop > 0 ? hitRateTop / baselineTop : 0,
    baselineMain,
    baselineTop,
  };
};
