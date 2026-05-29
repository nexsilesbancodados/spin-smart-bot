import { create } from "zustand";

export type ActivityKind =
  | "signal-emitted"
  | "signal-resolved"
  | "filter-blocked"
  | "tune-applied"
  | "agent-paused"
  | "agent-resumed"
  | "feed-error"
  | "dealer-drift"
  | "anomaly-detected"
  | "session-started"
  | "session-ended"
  | "manual-action";

export interface ActivityEvent {
  id: string;
  t: number;
  kind: ActivityKind;
  title: string;
  detail?: string;
  meta?: Record<string, unknown>;
}

interface ActivityStore {
  events: ActivityEvent[];
  push: (e: Omit<ActivityEvent, "id">) => void;
  clear: () => void;
}

export const useActivityFeed = create<ActivityStore>((set) => ({
  events: [],
  push: (e) =>
    set((s) => ({
      events: [
        { ...e, id: `evt_${Date.now()}_${Math.floor(Math.random() * 1000)}` },
        ...s.events,
      ].slice(0, 500),
    })),
  clear: () => set({ events: [] }),
}));

export const logActivity = (kind: ActivityKind, title: string, detail?: string, meta?: Record<string, unknown>) => {
  useActivityFeed.getState().push({ t: Date.now(), kind, title, detail, meta });
};

export const ACTIVITY_LABELS: Record<ActivityKind, { emoji: string; color: string }> = {
  "signal-emitted": { emoji: "🎯", color: "text-amber-300" },
  "signal-resolved": { emoji: "✓", color: "text-emerald-300" },
  "filter-blocked": { emoji: "🚫", color: "text-sky-300" },
  "tune-applied": { emoji: "🧠", color: "text-purple-300" },
  "agent-paused": { emoji: "⏸", color: "text-amber-300" },
  "agent-resumed": { emoji: "▶", color: "text-emerald-300" },
  "feed-error": { emoji: "⚠", color: "text-red-300" },
  "dealer-drift": { emoji: "🎭", color: "text-orange-300" },
  "anomaly-detected": { emoji: "🚨", color: "text-red-300" },
  "session-started": { emoji: "🏁", color: "text-emerald-300" },
  "session-ended": { emoji: "🛑", color: "text-neutral-300" },
  "manual-action": { emoji: "✋", color: "text-neutral-300" },
};
