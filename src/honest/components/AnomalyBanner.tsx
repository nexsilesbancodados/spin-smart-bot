import { memo, useEffect, useMemo, useState } from "react";
import { useHonestStore } from "../lib/store";
import { chiSquareUniform, concentrationIndex } from "../lib/stats";
import { detectDealerChange } from "../lib/dealerChange";

interface Anomaly {
  id: string;
  severity: "info" | "warn" | "critical";
  title: string;
  detail: string;
}

const AnomalyBanner = memo(() => {
  const spins = useHonestStore((s) => s.spins.map((x) => x.n));
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const anomalies = useMemo((): Anomaly[] => {
    const out: Anomaly[] = [];
    if (spins.length < 30) return out;

    const window50 = spins.slice(0, 50);
    const chi = chiSquareUniform(window50);
    if (chi.pApprox < 0.02) {
      out.push({
        id: "chi-low-p",
        severity: "critical",
        title: "Distribuição com desvio significativo",
        detail: `Qui-quadrado p = ${chi.pApprox.toFixed(3)} nos últimos 50 giros. Algo fugiu do uniforme.`,
      });
    } else if (chi.pApprox < 0.05) {
      out.push({
        id: "chi-warn-p",
        severity: "warn",
        title: "Distribuição com leve desvio",
        detail: `p = ${chi.pApprox.toFixed(3)}. Vale observar.`,
      });
    }

    const ci = concentrationIndex(window50);
    if (ci >= 28) {
      out.push({
        id: "concentration-high",
        severity: "warn",
        title: "Concentração alta na janela",
        detail: `Índice ${ci}/100. Amostra recente longe do uniforme.`,
      });
    }

    const dealer = detectDealerChange(spins, 30);
    if (dealer.alertLevel === "alert") {
      out.push({
        id: "dealer-alert",
        severity: "critical",
        title: "Drift de dealer / mesa detectado",
        detail: dealer.message,
      });
    }

    let streak = 1;
    for (let i = 1; i < spins.length && spins[i] === spins[0]; i++) streak++;
    if (streak >= 3) {
      out.push({
        id: `repeat-${spins[0]}-${streak}`,
        severity: "info",
        title: `Repetição: ${spins[0]} × ${streak}`,
        detail: `O número ${spins[0]} saiu ${streak} vezes seguidas.`,
      });
    }

    return out;
  }, [spins]);

  useEffect(() => {
    if (anomalies.length === 0) setDismissed(new Set());
  }, [anomalies.length]);

  const visible = anomalies.filter((a) => !dismissed.has(a.id));
  if (visible.length === 0) return null;

  return (
    <div data-tour="anomaly" className="space-y-2">
      {visible.map((a) => (
        <div
          key={a.id}
          className={`rounded-xl border p-3 flex items-start gap-3 ${
            a.severity === "critical"
              ? "bg-red-950/30 border-red-700/50 text-red-100"
              : a.severity === "warn"
                ? "bg-amber-950/30 border-amber-700/50 text-amber-100"
                : "bg-sky-950/30 border-sky-700/50 text-sky-100"
          }`}
        >
          <span className="text-lg shrink-0">
            {a.severity === "critical" ? "🚨" : a.severity === "warn" ? "⚠️" : "ℹ️"}
          </span>
          <div className="flex-1">
            <div className="font-bold text-sm">{a.title}</div>
            <p className="text-xs mt-0.5 opacity-90 leading-relaxed">{a.detail}</p>
          </div>
          <button
            onClick={() => setDismissed((prev) => new Set([...prev, a.id]))}
            className="text-xs opacity-60 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
});
AnomalyBanner.displayName = "AnomalyBanner";
export default AnomalyBanner;
