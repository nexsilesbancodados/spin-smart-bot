import { memo, useEffect, useState } from "react";
import { useDigest, buildDigest } from "../lib/digest";
import { colorOf } from "../lib/wheel";

const ballBg = (n: number) => {
  const c = colorOf(n);
  if (c === "green") return "bg-emerald-600";
  if (c === "red") return "bg-red-600";
  return "bg-neutral-800";
};

const DigestPopup = memo(() => {
  const enabled = useDigest((s) => s.enabled);
  const intervalMinutes = useDigest((s) => s.intervalMinutes);
  const lastDigestAt = useDigest((s) => s.lastDigestAt);
  const markRead = useDigest((s) => s.markRead);
  const [open, setOpen] = useState(false);
  const [digest, setDigest] = useState<ReturnType<typeof buildDigest> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      const since = lastDigestAt ?? Date.now() - intervalMinutes * 60_000;
      const elapsed = Date.now() - since;
      if (elapsed >= intervalMinutes * 60_000) {
        const d = buildDigest(intervalMinutes);
        if (d.totalSignals > 0) {
          setDigest(d);
          setOpen(true);
        } else {
          markRead();
        }
      }
    };
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, [enabled, intervalMinutes, lastDigestAt, markRead]);

  if (!open || !digest) return null;

  return (
    <div className="fixed bottom-24 right-6 z-40 max-w-xs bg-neutral-900 border border-amber-500/50 rounded-2xl shadow-2xl p-4 animate-[slide-up_0.3s_ease]">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] uppercase tracking-wider text-amber-400 font-bold">
          📰 Resumo {digest.windowMinutes}min
        </div>
        <button
          onClick={() => {
            markRead();
            setOpen(false);
          }}
          className="text-neutral-500 hover:text-neutral-200 text-sm"
        >
          ✕
        </button>
      </div>
      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-neutral-400">Sinais emitidos</span>
          <span className="font-bold text-amber-300 font-mono">{digest.totalSignals}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-neutral-400">Hit rate top-5</span>
          <span className="font-bold font-mono">{(digest.hitRate * 100).toFixed(1)}%</span>
        </div>
        {digest.topPick !== null && (
          <div className="flex items-center justify-between">
            <span className="text-neutral-400">Pick mais frequente</span>
            <div className="flex items-center gap-1.5">
              <div className={`${ballBg(digest.topPick)} text-white text-[10px] font-bold w-6 h-6 rounded flex items-center justify-center`}>
                {digest.topPick}
              </div>
              <span className="text-[10px] text-neutral-500 font-mono">{digest.topPickCount}×</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
DigestPopup.displayName = "DigestPopup";
export default DigestPopup;
