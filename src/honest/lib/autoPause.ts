import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useHonestStore } from "./store";
import { useSignalAgent } from "./signalAgent";
import { detectTilt } from "./tilt";

interface AutoPauseConfig {
  enabled: boolean;
  pauseOnCriticalTilt: boolean;
  pauseOnSessionLimits: boolean;
  pauseOnConsecutiveMisses: boolean;
  maxConsecutiveMisses: number;
  pauseAt: number | null;
  resumeAt: number | null;
  pauseReason: string | null;
}

interface Store extends AutoPauseConfig {
  setConfig: (patch: Partial<AutoPauseConfig>) => void;
  setPauseState: (reason: string | null, until?: number) => void;
}

const defaults: AutoPauseConfig = {
  enabled: true,
  pauseOnCriticalTilt: true,
  pauseOnSessionLimits: true,
  pauseOnConsecutiveMisses: false,
  maxConsecutiveMisses: 5,
  pauseAt: null,
  resumeAt: null,
  pauseReason: null,
};

export const useAutoPause = create<Store>()(
  persist(
    (set) => ({
      ...defaults,
      setConfig: (patch) => set(patch),
      setPauseState: (reason, until) =>
        set({
          pauseReason: reason,
          pauseAt: reason ? Date.now() : null,
          resumeAt: until ?? null,
        }),
    }),
    { name: "rv-auto-pause-v1" }
  )
);

let lastCheck = 0;

export const runAutoPauseCheck = () => {
  const now = Date.now();
  if (now - lastCheck < 1500) return;
  lastCheck = now;

  const cfg = useAutoPause.getState();
  if (!cfg.enabled) return;

  if (cfg.resumeAt && now < cfg.resumeAt) return;
  if (cfg.resumeAt && now >= cfg.resumeAt) {
    useSignalAgent.getState().setConfig({ enabled: true });
    cfg.setPauseState(null);
  }

  const session = useHonestStore.getState().session;
  const sessionBets = useHonestStore.getState().sessionBets;
  const history = useHonestStore.getState().history;

  if (cfg.pauseOnCriticalTilt) {
    const signals = detectTilt({ session, sessionBets, history, now });
    const critical = signals.find((s) => s.severity === "critical");
    if (critical) {
      useSignalAgent.getState().setConfig({ enabled: false });
      useAutoPause.getState().setPauseState(`Tilt crítico: ${critical.title}`, now + 5 * 60_000);
      return;
    }
  }

  if (cfg.pauseOnSessionLimits && session.startedAt) {
    const stopAt = session.initial * (1 - session.stopLossPct / 100);
    const targetAt = session.initial * (1 + session.targetPct / 100);
    if (session.current <= stopAt) {
      useSignalAgent.getState().setConfig({ enabled: false });
      useAutoPause.getState().setPauseState("Stop loss atingido", now + 60 * 60_000);
      return;
    }
    if (session.current >= targetAt) {
      useSignalAgent.getState().setConfig({ enabled: false });
      useAutoPause.getState().setPauseState("Meta atingida", now + 60 * 60_000);
      return;
    }
  }

  if (cfg.pauseOnConsecutiveMisses) {
    const sigHistory = useSignalAgent.getState().history;
    const resolved = sigHistory.filter((s) => s.actualNumber !== null);
    if (resolved.length >= cfg.maxConsecutiveMisses) {
      const last = resolved.slice(0, cfg.maxConsecutiveMisses);
      if (last.every((s) => s.hitTop5 === false)) {
        useSignalAgent.getState().setConfig({ enabled: false });
        useAutoPause.getState().setPauseState(`${cfg.maxConsecutiveMisses} misses seguidos`, now + 15 * 60_000);
      }
    }
  }
};
