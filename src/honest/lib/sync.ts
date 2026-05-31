import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";

// The user_state table is created by a migration not yet reflected in the
// auto-generated Supabase types. Cast for this module only.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

const SYNC_KEYS = [
  "roleta-vision-honest-v1",
  "roleta-vision-signal-agent-v1",
  "rv-pattern-learning-v1",
  "rv-autodiscovery-v1",
  "rv-engine-weights-v1",
  "rv-master-signal-state-v1",
  "rv-bet-tracker-v1",
  "rv-autobet-v1",
  "rv-webhook-v1",
  "rv-ui-prefs-v1",
  "rv-notifications-v1",
  "rv-ab-test-v1",
  "rv-auto-tuner-v1",
  "rv-digest-v1",
  "rv-entry-filter-v1",
  "rv-profiles-v1",
  "rv-risk-profile-v1",
  "rv-custom-strategies-v1",
  "rv-annotations-v1",
];

type SyncStatus = "idle" | "pulling" | "pushing" | "synced" | "error" | "offline";

interface SyncStore {
  status: SyncStatus;
  lastPullAt: number | null;
  lastPushAt: number | null;
  pendingKeys: number;
  errorMessage: string | null;
  setStatus: (status: SyncStatus, error?: string) => void;
  markPulled: () => void;
  markPushed: (count: number) => void;
}

export const useSync = create<SyncStore>((set) => ({
  status: "idle",
  lastPullAt: null,
  lastPushAt: null,
  pendingKeys: 0,
  errorMessage: null,
  setStatus: (status, error) =>
    set({ status, errorMessage: error ?? null }),
  markPulled: () =>
    set({ status: "synced", lastPullAt: Date.now(), errorMessage: null }),
  markPushed: (count) =>
    set({
      status: "synced",
      lastPushAt: Date.now(),
      pendingKeys: count,
      errorMessage: null,
    }),
}));

const lastPushedValues = new Map<string, string>();
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let started = false;

const pullAllState = async (userId: string): Promise<{ ok: boolean; error?: string }> => {
  useSync.getState().setStatus("pulling");
  try {
    const { data, error } = await db
      .from("user_state")
      .select("key, value")
      .eq("user_id", userId);
    if (error) {
      useSync.getState().setStatus("error", error.message);
      return { ok: false, error: error.message };
    }
    if (!data) {
      useSync.getState().markPulled();
      return { ok: true };
    }
    for (const row of data as Array<{ key: string; value: unknown }>) {
      if (!SYNC_KEYS.includes(row.key)) continue;
      try {
        const str = JSON.stringify(row.value);
        const existing = localStorage.getItem(row.key);
        if (existing !== str) {
          localStorage.setItem(row.key, str);
        }
        lastPushedValues.set(row.key, str);
      } catch {
        /* skip */
      }
    }
    useSync.getState().markPulled();
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    useSync.getState().setStatus("error", msg);
    return { ok: false, error: msg };
  }
};

const collectChanges = (): Array<{ key: string; value: unknown }> => {
  const changes: Array<{ key: string; value: unknown }> = [];
  for (const key of SYNC_KEYS) {
    const current = localStorage.getItem(key);
    if (current === null) continue;
    if (lastPushedValues.get(key) === current) continue;
    try {
      const parsed = JSON.parse(current);
      changes.push({ key, value: parsed });
    } catch {
      /* skip */
    }
  }
  return changes;
};

const pushChanges = async (userId: string): Promise<void> => {
  const changes = collectChanges();
  if (changes.length === 0) {
    useSync.getState().markPushed(0);
    return;
  }
  useSync.getState().setStatus("pushing");
  try {
    const now = new Date().toISOString();
    const updates = changes.map((c) => ({
      user_id: userId,
      key: c.key,
      value: c.value,
      updated_at: now,
    }));
    const { error } = await db
      .from("user_state")
      .upsert(updates, { onConflict: "user_id,key" });
    if (error) {
      useSync.getState().setStatus("error", error.message);
      return;
    }
    for (const c of changes) {
      const str = localStorage.getItem(c.key);
      if (str !== null) lastPushedValues.set(c.key, str);
    }
    useSync.getState().markPushed(changes.length);
  } catch (err) {
    useSync.getState().setStatus("error", err instanceof Error ? err.message : String(err));
  }
};

const schedulePush = (userId: string, delay = 4000) => {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void pushChanges(userId);
  }, delay);
};

const startWatching = (userId: string) => {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(() => {
    const changes = collectChanges();
    if (changes.length > 0) {
      useSync.getState().setStatus("pushing");
      useSync.setState({ pendingKeys: changes.length });
      schedulePush(userId, 1000);
    }
  }, 6000);
};

const stopWatching = () => {
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
};

export const startSync = async () => {
  if (started) return;
  started = true;
  const user = useAuth.getState().user;
  if (!user) return;
  const result = await pullAllState(user.id);
  if (result.ok) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("sync:pulled"));
    }
    startWatching(user.id);
    void pushChanges(user.id);
  }
};

export const stopSync = () => {
  started = false;
  stopWatching();
  lastPushedValues.clear();
  useSync.setState({
    status: "idle",
    lastPullAt: null,
    lastPushAt: null,
    pendingKeys: 0,
    errorMessage: null,
  });
};

export const forceSyncPull = async () => {
  const user = useAuth.getState().user;
  if (!user) return;
  await pullAllState(user.id);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("sync:pulled"));
  }
};

export const forceSyncPush = async () => {
  const user = useAuth.getState().user;
  if (!user) return;
  await pushChanges(user.id);
};
