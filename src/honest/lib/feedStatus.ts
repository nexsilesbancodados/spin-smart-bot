import { create } from "zustand";

export type FeedStatusValue = "connecting" | "connected" | "polling-only" | "disconnected";

interface FeedStatusStore {
  status: FeedStatusValue;
  lastUpdate: number | null;
  lastPoll: number | null;
  lastSource: string | null;
  mesa: string | null;
  pollEnabled: boolean;
  pollInterval: number;
  errorMessage: string | null;
  totalPolls: number;
  totalErrors: number;
  totalInjected: number;
  setStatus: (s: FeedStatusValue) => void;
  pollOk: (source: string, injected: number, mesa?: string | null) => void;
  touch: (source: string) => void;
  setError: (msg: string | null) => void;
  setPollEnabled: (v: boolean) => void;
  setPollInterval: (ms: number) => void;
}

export const useFeedStatus = create<FeedStatusStore>((set) => ({
  status: "connecting",
  lastUpdate: null,
  lastPoll: null,
  lastSource: null,
  mesa: null,
  pollEnabled: true,
  pollInterval: 3000,
  errorMessage: null,
  totalPolls: 0,
  totalErrors: 0,
  totalInjected: 0,
  setStatus: (status) => set({ status }),
  pollOk: (source, injected, mesa) =>
    set((s) => ({
      lastPoll: Date.now(),
      lastSource: source,
      mesa: mesa ?? s.mesa,
      status: "connected",
      errorMessage: null,
      totalPolls: s.totalPolls + 1,
      totalInjected: s.totalInjected + injected,
      lastUpdate: injected > 0 ? Date.now() : s.lastUpdate,
    })),
  touch: (source) =>
    set({ lastUpdate: Date.now(), lastSource: source, status: "connected", errorMessage: null }),
  setError: (msg) =>
    set((s) => ({
      errorMessage: msg,
      totalErrors: msg ? s.totalErrors + 1 : s.totalErrors,
      status: msg ? "disconnected" : s.status,
    })),
  setPollEnabled: (v) => set({ pollEnabled: v }),
  setPollInterval: (ms) => set({ pollInterval: Math.max(2000, ms) }),
}));
