import { memo, useMemo, useState } from "react";
import { useHonestStore } from "../lib/store";
import { detectDealerChange } from "../lib/dealerChange";

const alertStyle = {
  ok: "bg-neutral-900/50 border-neutral-700 text-neutral-300",
  watch: "bg-amber-950/30 border-amber-700/50 text-amber-200",
  alert: "bg-orange-950/30 border-orange-700/50 text-orange-200",
} as const;

const directionEmoji = { up: "▲", down: "▼", stable: "▬" };

const DealerChangeAlert = memo(() => {
  const spins = useHonestStore((s) => s.spins);
  const [windowSize, setWindowSize] = useState(30);
  const [expanded, setExpanded] = useState(false);
  const report = useMemo(
    () => detectDealerChange(spins.map((s) => s.n), windowSize),
    [spins, windowSize]
  );

  return (
    <section className={`rounded-xl border p-3 ${alertStyle[report.alertLevel]}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider">
            {report.alertLevel === "alert" ? "🚨 " : report.alertLevel === "watch" ? "⚠ " : "✓ "}
            Detector de mudança de dealer / drift
          </h3>
          <p className="text-[11px] mt-0.5 leading-relaxed">{report.message}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={windowSize}
            onChange={(e) => setWindowSize(Number(e.target.value))}
            className="bg-neutral-950 border border-neutral-700 rounded-md px-2 py-1 text-[11px]"
          >
            <option value={20}>20 vs 20</option>
            <option value={30}>30 vs 30</option>
            <option value={50}>50 vs 50</option>
            <option value={100}>100 vs 100</option>
          </select>
          {report.metrics.length > 0 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-[10px] underline opacity-70 hover:opacity-100"
            >
              {expanded ? "ocultar" : "detalhes"}
            </button>
          )}
        </div>
      </div>
      {expanded && report.metrics.length > 0 && (
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px]">
          {report.metrics.map((m) => (
            <div key={m.name} className="rounded border border-neutral-700 bg-neutral-950/60 p-1.5">
              <div className="flex items-center justify-between">
                <span className="text-neutral-300 font-semibold">{m.name}</span>
                <span
                  className={`font-mono ${
                    Math.abs(m.z) >= 2 ? "text-amber-300" : "text-neutral-400"
                  }`}
                >
                  {directionEmoji[m.direction]} z={m.z.toFixed(1)}
                </span>
              </div>
              <div className="text-neutral-500 font-mono">
                {(m.earlier * 100).toFixed(0)}% → {(m.recent * 100).toFixed(0)}%
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
});
DealerChangeAlert.displayName = "DealerChangeAlert";
export default DealerChangeAlert;
