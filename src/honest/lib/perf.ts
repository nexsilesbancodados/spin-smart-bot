import { create } from "zustand";

interface PerfSample {
  t: number;
  agentTickMs: number;
  fps: number;
  memoryMb: number | null;
  spinsCount: number;
}

interface PerfStore {
  samples: PerfSample[];
  agentTickHistory: number[];
  recordAgentTick: (ms: number) => void;
  recordSample: (s: Omit<PerfSample, "t">) => void;
  clear: () => void;
}

export const usePerf = create<PerfStore>((set) => ({
  samples: [],
  agentTickHistory: [],
  recordAgentTick: (ms) =>
    set((s) => ({
      agentTickHistory: [...s.agentTickHistory, ms].slice(-50),
    })),
  recordSample: (s) =>
    set((state) => ({
      samples: [...state.samples, { ...s, t: Date.now() }].slice(-120),
    })),
  clear: () => set({ samples: [], agentTickHistory: [] }),
}));

let fpsSamples: number[] = [];
let lastFpsT = performance.now();
let fpsFrames = 0;

const trackFps = () => {
  fpsFrames += 1;
  const now = performance.now();
  if (now - lastFpsT >= 1000) {
    const fps = (fpsFrames * 1000) / (now - lastFpsT);
    fpsSamples.push(fps);
    if (fpsSamples.length > 10) fpsSamples.shift();
    fpsFrames = 0;
    lastFpsT = now;
  }
  requestAnimationFrame(trackFps);
};

interface PerformanceMemory {
  usedJSHeapSize: number;
}

interface PerformanceWithMemory extends Performance {
  memory?: PerformanceMemory;
}

export const getCurrentFps = (): number => {
  if (fpsSamples.length === 0) return 0;
  return fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length;
};

export const getMemoryMb = (): number | null => {
  const perf = performance as PerformanceWithMemory;
  if (perf.memory) {
    return perf.memory.usedJSHeapSize / (1024 * 1024);
  }
  return null;
};

export const startPerfTracking = () => {
  if (typeof window === "undefined") return;
  requestAnimationFrame(trackFps);
};

export const measureAsync = async <T,>(label: string, fn: () => Promise<T>): Promise<T> => {
  const t0 = performance.now();
  const result = await fn();
  const ms = performance.now() - t0;
  if (label === "agent-tick") usePerf.getState().recordAgentTick(ms);
  return result;
};

export const measure = <T,>(label: string, fn: () => T): T => {
  const t0 = performance.now();
  const result = fn();
  const ms = performance.now() - t0;
  if (label === "agent-tick") usePerf.getState().recordAgentTick(ms);
  return result;
};
