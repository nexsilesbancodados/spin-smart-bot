import { memo, useEffect, useState } from "react";
import { useSpinRhythm } from "../lib/gameTimer";

const GameTimer = memo(() => {
  const rhythm = useSpinRhythm();
  const [, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  if (rhythm.samples < 3 || !rhythm.estimatedNextAt) return null;

  const remaining = rhythm.estimatedNextAt - Date.now();
  const elapsedFromLast = rhythm.lastSpinAt ? Date.now() - rhythm.lastSpinAt : 0;
  const progressFraction = Math.min(1, elapsedFromLast / rhythm.medianIntervalMs);
  const sLeft = Math.max(0, Math.ceil(remaining / 1000));

  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-neutral-900/70 border border-neutral-700"
      title={`Estimativa: próximo giro em ~${sLeft}s · intervalo médio ${(rhythm.medianIntervalMs / 1000).toFixed(0)}s`}
    >
      <span className="text-[9px] text-neutral-500 font-mono shrink-0">~next</span>
      <div className="w-12 h-1 bg-neutral-800 rounded-full overflow-hidden">
        <div
          className={progressFraction >= 1 ? "h-1 bg-emerald-500 animate-pulse" : "h-1 bg-amber-500"}
          style={{ width: `${Math.min(100, progressFraction * 100)}%` }}
        />
      </div>
      <span className="text-[10px] font-mono text-neutral-300 shrink-0">{sLeft > 0 ? `${sLeft}s` : "agora"}</span>
    </div>
  );
});
GameTimer.displayName = "GameTimer";
export default GameTimer;
