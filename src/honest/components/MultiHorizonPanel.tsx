import { memo, useMemo } from "react";
import { useSignalAgent } from "../lib/signalAgent";
import { useHonestStore } from "../lib/store";
import { buildHorizonPredictions } from "../lib/multiHorizon";
import { detectRegime } from "../lib/regimeDetector";
import { SLOTS } from "../lib/wheel";
import { Card, SectionHeader, Pill } from "./ui";

const MultiHorizonPanel = memo(() => {
  const latest = useSignalAgent((s) => s.latest);
  const spins = useHonestStore((s) => s.spins);

  const spinsKey = useMemo(() => spins.slice(0, 50).map((s) => s.n).join(","), [spins]);

  const regime = useMemo(() => detectRegime(spinsKey.split(",").map(Number)), [spinsKey]);

  const predictions = useMemo(() => {
    if (!latest) return [];
    const probs = new Float32Array(SLOTS);
    let total = 0;
    for (let i = 0; i < latest.topPicks.length; i++) {
      probs[latest.topPicks[i]] = latest.topProbs[i];
      total += latest.topProbs[i];
    }
    const remaining = SLOTS - latest.topPicks.length;
    if (remaining > 0) {
      const each = Math.max(0, (1 - total) / remaining);
      for (let n = 0; n < SLOTS; n++) {
        if (!latest.topPicks.includes(n)) probs[n] = each;
      }
    }
    return buildHorizonPredictions(latest.topPicks, probs, [1, 3, 5, 10]);
  }, [latest]);

  if (!latest) return null;

  const categories = Array.from(new Set(predictions.map((p) => p.label)));

  return (
    <Card>
      <SectionHeader
        title="🎯 Predições Multi-Horizonte"
        subtitle="Probabilidade cumulativa de acerto nas próximas 1, 3, 5 ou 10 rodadas. Coberturas maiores = hit rate naturalmente mais alto."
        actions={
          <Pill accent={regime.regime === "uniform" ? "neutral" : regime.regime === "color-streak" ? "warn" : regime.regime === "sector-streak" ? "info" : "neutral"}>
            Regime: {regime.regime} ({(regime.confidence * 100).toFixed(0)}%)
          </Pill>
        }
      />

      <div className="mb-3 text-[11px] text-neutral-400 leading-relaxed border-l-2 border-amber-500/40 pl-3">
        <strong className="text-amber-300">Regime detectado:</strong> {regime.description}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-neutral-500">
              <th className="p-2 font-medium">Aposta</th>
              <th className="p-2 font-medium">Cobertura</th>
              <th className="p-2 font-medium text-center">1 spin</th>
              <th className="p-2 font-medium text-center">3 spins</th>
              <th className="p-2 font-medium text-center">5 spins</th>
              <th className="p-2 font-medium text-center">10 spins</th>
              <th className="p-2 font-medium text-right">E[spins até hit]</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => {
              const horizons = predictions.filter((p) => p.label === cat).sort((a, b) => a.horizon - b.horizon);
              const ref = horizons[0];
              return (
                <tr key={cat} className="border-t border-neutral-800 hover:bg-neutral-900/40">
                  <td className="p-2 font-semibold text-neutral-200">{cat}</td>
                  <td className="p-2 font-mono text-neutral-400">{ref.coverage} nº</td>
                  {[1, 3, 5, 10].map((h) => {
                    const p = horizons.find((x) => x.horizon === h);
                    if (!p) return <td key={h} className="p-2 text-center text-neutral-500">—</td>;
                    const liftVsBaseline = p.hitProbabilityCumulative / Math.max(p.baselineCumulative, 1e-9);
                    return (
                      <td key={h} className="p-2 text-center">
                        <div className="flex flex-col items-center">
                          <span className={`font-mono font-bold ${p.hitProbabilityCumulative > 0.5 ? "text-emerald-300" : p.hitProbabilityCumulative > 0.25 ? "text-amber-300" : "text-neutral-300"}`}>
                            {(p.hitProbabilityCumulative * 100).toFixed(0)}%
                          </span>
                          {liftVsBaseline > 1.05 && (
                            <span className="text-[9px] text-emerald-400 font-mono">+{((liftVsBaseline - 1) * 100).toFixed(0)}%</span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td className="p-2 text-right font-mono text-neutral-400">
                    {isFinite(ref.expectedSpinsToHit) ? `~${ref.expectedSpinsToHit.toFixed(1)}` : "∞"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[10px] text-neutral-500 leading-relaxed">
        <strong>Como ler:</strong> "Top-5 plenos · 5 spins · 50%" significa que há ~50% de chance do top-5 sair em alguma das próximas 5 rodadas. Coberturas grandes (Voisins, cor, dúzia) naturalmente têm hit rate alto em horizontes maiores. <strong>Lembre:</strong> EV de longo prazo é −2,7%, mesmo com hit rate aparente alto.
      </p>
    </Card>
  );
});
MultiHorizonPanel.displayName = "MultiHorizonPanel";
export default MultiHorizonPanel;
