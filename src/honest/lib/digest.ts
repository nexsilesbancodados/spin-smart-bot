import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useSignalAgent } from "./signalAgent";

interface DigestState {
  enabled: boolean;
  intervalMinutes: number;
  lastDigestAt: number | null;
  unreadCount: number;
  setEnabled: (v: boolean) => void;
  setInterval: (v: number) => void;
  bumpUnread: () => void;
  markRead: () => void;
}

export const useDigest = create<DigestState>()(
  persist(
    (set) => ({
      enabled: false,
      intervalMinutes: 15,
      lastDigestAt: null,
      unreadCount: 0,
      setEnabled: (v) => set({ enabled: v }),
      setInterval: (v) => set({ intervalMinutes: v }),
      bumpUnread: () => set((s) => ({ unreadCount: s.unreadCount + 1 })),
      markRead: () => set({ unreadCount: 0, lastDigestAt: Date.now() }),
    }),
    { name: "rv-digest-v1" }
  )
);

export interface DigestData {
  windowMinutes: number;
  totalSignals: number;
  hitRate: number;
  topPick: number | null;
  topPickCount: number;
}

export const buildDigest = (windowMinutes: number): DigestData => {
  const cutoff = Date.now() - windowMinutes * 60_000;
  const history = useSignalAgent.getState().history.filter((s) => s.t >= cutoff);
  const resolved = history.filter((s) => s.actualNumber !== null);
  const hits = resolved.filter((s) => s.hitTop5).length;
  const picks = new Map<number, number>();
  for (const s of history) picks.set(s.mainPick, (picks.get(s.mainPick) ?? 0) + 1);
  const topEntry = [...picks.entries()].sort((a, b) => b[1] - a[1])[0];
  return {
    windowMinutes,
    totalSignals: history.length,
    hitRate: resolved.length > 0 ? hits / resolved.length : 0,
    topPick: topEntry?.[0] ?? null,
    topPickCount: topEntry?.[1] ?? 0,
  };
};
