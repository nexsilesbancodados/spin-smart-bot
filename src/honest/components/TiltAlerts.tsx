import { memo, useMemo } from "react";
import { useHonestStore } from "../lib/store";
import { detectTilt } from "../lib/tilt";

const severityClass = {
  info: "border-sky-700/40 bg-sky-950/30 text-sky-200",
  warning: "border-amber-700/50 bg-amber-950/30 text-amber-200",
  critical: "border-red-700/50 bg-red-950/40 text-red-200",
} as const;

const severityIcon = { info: "ℹ️", warning: "⚠️", critical: "🛑" } as const;

const TiltAlerts = memo(() => {
  const session = useHonestStore((s) => s.session);
  const sessionBets = useHonestStore((s) => s.sessionBets);
  const history = useHonestStore((s) => s.history);

  const signals = useMemo(
    () => detectTilt({ session, sessionBets, history }),
    [session, sessionBets, history]
  );

  if (signals.length === 0) return null;

  return (
    <div className="space-y-2" role="alert" aria-live="polite">
      {signals.map((sig) => (
        <div key={sig.id} className={`rounded-lg border p-3 ${severityClass[sig.severity]}`}>
          <div className="flex items-start gap-2">
            <span className="text-lg leading-none">{severityIcon[sig.severity]}</span>
            <div className="flex-1">
              <p className="font-bold text-sm">{sig.title}</p>
              <p className="text-xs mt-1 opacity-90 leading-relaxed">{sig.detail}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
});
TiltAlerts.displayName = "TiltAlerts";
export default TiltAlerts;
