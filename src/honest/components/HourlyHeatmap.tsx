import { memo, useMemo } from "react";
import { useSignalAgent } from "../lib/signalAgent";
import { useBetTracker } from "../lib/betTracker";
import { SLOTS } from "../lib/wheel";
import { Card, SectionHeader } from "./ui";

interface HourBucket {
  hour: number;
  signals: number;
  hits: number;
  hitRate: number;
  bets: number;
  pnl: number;
  roi: number;
}

const HourlyHeatmap = memo(() => {
  const history = useSignalAgent((s) => s.history);
  const bets = useBetTracker((s) => s.entries);

  const buckets = useMemo<HourBucket[]>(() => {
    const arr: HourBucket[] = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      signals: 0,
      hits: 0,
      hitRate: 0,
      bets: 0,
      pnl: 0,
      roi: 0,
    }));
    let stakedByHour: number[] = new Array(24).fill(0);
    const resolved = history.filter((s) => s.actualNumber !== null);
    for (const s of resolved) {
      const h = new Date(s.resolvedAt ?? s.t).getHours();
      arr[h].signals++;
      if (s.hitTop5) arr[h].hits++;
    }
    const resolvedBets = bets.filter((b) => b.outcome === "win" || b.outcome === "loss");
    for (const b of resolvedBets) {
      const h = new Date(b.t).getHours();
      arr[h].bets++;
      arr[h].pnl += b.delta;
      stakedByHour[h] += b.stake;
    }
    for (let h = 0; h < 24; h++) {
      arr[h].hitRate = arr[h].signals > 0 ? arr[h].hits / arr[h].signals : 0;
      arr[h].roi = stakedByHour[h] > 0 ? arr[h].pnl / stakedByHour[h] : 0;
    }
    return arr;
  }, [history, bets]);

  const totalSignals = buckets.reduce((a, b) => a + b.signals, 0);
  const baseline = 5 / SLOTS;

  if (totalSignals < 5) {
    return (
      <Card padding="sm">
        <SectionHeader title="Desempenho por hora" eyebrow="Ferramenta" />
        <div className="text-[11px] text-neutral-500 italic py-2 text-center">
          Aguardando ≥5 sinais resolvidos (atual: {totalSignals})
        </div>
      </Card>
    );
  }

  const best = [...buckets]
    .filter((b) => b.signals >= 3)
    .sort((a, b) => b.hitRate - a.hitRate)
    .slice(0, 2);
  const worst = [...buckets]
    .filter((b) => b.signals >= 3)
    .sort((a, b) => a.hitRate - b.hitRate)
    .slice(0, 2);

  const cellColor = (b: HourBucket) => {
    if (b.signals === 0) return "bg-neutral-900/50 border-neutral-800";
    if (b.hitRate > baseline * 1.4) return "bg-emerald-700 border-emerald-500";
    if (b.hitRate > baseline * 1.15) return "bg-emerald-900/70 border-emerald-700";
    if (b.hitRate < baseline * 0.7) return "bg-red-900/70 border-red-700";
    return "bg-neutral-800 border-neutral-700";
  };

  return (
    <Card padding="sm">
      <SectionHeader
        title="Desempenho por hora"
        eyebrow="Ferramenta"
        subtitle={
          <span className="text-[10px] text-neutral-500">
            Hit rate top-5 por hora (baseline 13,5%) · {totalSignals} sinais resolvidos
          </span>
        }
      />

      <div className="grid grid-cols-12 gap-0.5 mb-2">
        {buckets.map((b) => (
          <div
            key={b.hour}
            className={`aspect-square border rounded text-[8px] flex flex-col items-center justify-center font-bold transition ${cellColor(b)}`}
            title={`${b.hour}h · ${b.signals} sinais · ${(b.hitRate * 100).toFixed(0)}% hit · ROI ${(b.roi * 100).toFixed(0)}%`}
          >
            <span className="text-[9px] text-white/80 leading-none">{b.hour}h</span>
            {b.signals > 0 && (
              <span className="text-[8px] text-white font-mono leading-tight mt-0.5">
                {(b.hitRate * 100).toFixed(0)}%
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-1">
        {best.length > 0 && (
          <div className="bg-emerald-950/40 rounded p-1.5 border border-emerald-800/40">
            <div className="text-[9px] text-emerald-400/80 uppercase tracking-wider font-bold">🔥 Melhores</div>
            {best.map((h) => (
              <div key={h.hour} className="text-[11px] text-emerald-200 font-bold">
                {h.hour}h <span className="font-mono opacity-70">({(h.hitRate * 100).toFixed(0)}% · {h.signals}n)</span>
              </div>
            ))}
          </div>
        )}
        {worst.length > 0 && (
          <div className="bg-red-950/40 rounded p-1.5 border border-red-800/40">
            <div className="text-[9px] text-red-400/80 uppercase tracking-wider font-bold">❄ Piores</div>
            {worst.map((h) => (
              <div key={h.hour} className="text-[11px] text-red-200 font-bold">
                {h.hour}h <span className="font-mono opacity-70">({(h.hitRate * 100).toFixed(0)}% · {h.signals}n)</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="text-[9px] text-neutral-600 italic mt-2 text-center">
        Amostras pequenas tem variância alta — pelo menos 10 sinais/hora pra confiar.
      </div>
    </Card>
  );
});
HourlyHeatmap.displayName = "HourlyHeatmap";

export default HourlyHeatmap;
