import { memo, useEffect } from "react";
import { useToast } from "../lib/toast";

const Toaster = memo(() => {
  const toasts = useToast((s) => s.toasts);
  const dismiss = useToast((s) => s.dismiss);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) => {
      const remaining = Math.max(0, t.at + t.ttl - Date.now());
      return setTimeout(() => dismiss(t.id), remaining);
    });
    return () => timers.forEach((t) => clearTimeout(t));
  }, [toasts, dismiss]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-[120px] right-4 z-50 flex flex-col gap-2 pointer-events-none max-w-xs">
      {toasts.map((t) => {
        const accent =
          t.kind === "hit"
            ? "border-emerald-500/60 bg-emerald-950/95 text-emerald-100"
            : t.kind === "miss"
            ? "border-red-500/50 bg-red-950/95 text-red-100"
            : t.kind === "signal"
            ? "border-amber-400/70 bg-neutral-950/95 text-amber-100 shadow-amber-500/30"
            : t.kind === "warn"
            ? "border-amber-600/50 bg-amber-950/95 text-amber-100"
            : "border-neutral-700 bg-neutral-950/95 text-neutral-100";

        return (
          <div
            key={t.id}
            className={`border rounded-xl px-3 py-2 shadow-2xl backdrop-blur pointer-events-auto cursor-pointer [animation:slideInRight_0.25s_ease-out] ${accent}`}
            onClick={() => dismiss(t.id)}
          >
            <div className="text-[12px] font-black leading-tight">{t.title}</div>
            {t.body && <div className="text-[10px] opacity-80 mt-0.5 font-mono">{t.body}</div>}
          </div>
        );
      })}
    </div>
  );
});
Toaster.displayName = "Toaster";

export default Toaster;
