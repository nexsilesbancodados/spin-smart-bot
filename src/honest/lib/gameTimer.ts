import { useEffect, useState } from "react";
import { useHonestStore } from "./store";

export interface SpinRhythm {
  avgIntervalMs: number;
  medianIntervalMs: number;
  samples: number;
  lastSpinAt: number | null;
  estimatedNextAt: number | null;
}

export const useSpinRhythm = (): SpinRhythm => {
  const spins = useHonestStore((s) => s.spins);
  const [rhythm, setRhythm] = useState<SpinRhythm>({
    avgIntervalMs: 30_000,
    medianIntervalMs: 30_000,
    samples: 0,
    lastSpinAt: null,
    estimatedNextAt: null,
  });

  useEffect(() => {
    if (spins.length < 5) {
      setRhythm((r) => ({ ...r, lastSpinAt: spins[0]?.t ?? null, samples: spins.length }));
      return;
    }
    const intervals: number[] = [];
    const recent = spins.slice(0, 20);
    for (let i = 1; i < recent.length; i++) {
      const dt = recent[i - 1].t - recent[i].t;
      if (dt > 5_000 && dt < 5 * 60_000) intervals.push(dt);
    }
    if (intervals.length === 0) return;
    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const sorted = intervals.slice().sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const lastSpinAt = spins[0].t;
    setRhythm({
      avgIntervalMs: avg,
      medianIntervalMs: median,
      samples: intervals.length,
      lastSpinAt,
      estimatedNextAt: lastSpinAt + median,
    });
  }, [spins]);

  return rhythm;
};
