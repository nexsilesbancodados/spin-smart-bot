import { memo, useMemo } from "react";
import { useSignalAgent } from "../lib/signalAgent";
import { Card, SectionHeader, Pill } from "./ui";

const BINS = [
  { lo: 0.0, hi: 0.04 },
  { lo: 0.04, hi: 0.06 },
  { lo: 0.06, hi: 0.08 },
  { lo: 0.08, hi: 0.12 },
  { lo: 0.12, hi: 0.18 },
  { lo: 0.18, hi: 1.0 },
];

const CalibrationCurve = memo(() => {
  const history = useSignalAgent((s) => s.history);

  const data = useMemo(() => {
    const resolved = history.filter((s) => s.actualNumber !== null);
    if (resolved.length < 15) return null;

    const buckets = BINS.map((bin) => {
      const items = resolved.filter((s) => s.mainProb >= bin.lo && s.mainProb < bin.hi);
      const n = items.length;
      const hits = items.filter((s) => s.hitMain).length;
      const meanPred = n > 0 ? items.reduce((a, s) => a + s.mainProb, 0) / n : (bin.lo + bin.hi) / 2;
      const observed = n > 0 ? hits / n : 0;
      return {
        bin,
        n,
        hits,
        meanPred,
        observed,
        gap: observed - meanPred,
      };
    });

    const usable = buckets.filter((b) => b.n >= 3);
    const ece =
      resolved.length > 0
        ? usable.reduce((acc, b) => acc + (b.n / resolved.length) * Math.abs(b.gap), 0)
        : 0;

    let brier = 0;
    for (const s of resolved) {
      const p = Math.max(0, Math.min(1, s.mainProb));
      const y = s.hitMain ? 1 : 0;
      brier += (p - y) ** 2;
    }
    brier /= resolved.length;

    return { buckets, usable, ece, brier, total: resolved.length };
  }, [history]);

  if (!data) {
    return (
      <Card padding="sm">
        <SectionHeader title="Curva de calibração" eyebrow="Inteligência" />
        <div className="text-[11px] text-neutral-500 italic py-2 text-center">
          Aguardando ≥15 sinais resolvidos
        </div>
      </Card>
    );
  }

  const W = 280;
  const H = 180;

  return (
    <Card padding="sm">
      <SectionHeader
        title="Curva de calibração (reliability)"
        eyebrow="Inteligência"
        subtitle={
          <span className="text-[10px] text-neutral-500">
            Predito vs observado · {data.total} sinais · diagonal = perfeito
          </span>
        }
      />

      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <Pill accent={data.ece < 0.04 ? "good" : data.ece < 0.08 ? "warn" : "bad"}>
          ECE: {(data.ece * 100).toFixed(2)}%
        </Pill>
        <Pill accent="neutral">Brier: {data.brier.toFixed(4)}</Pill>
        <span className="text-[10px] text-neutral-500 italic">
          {data.ece < 0.04 ? "bem calibrado" : data.ece < 0.08 ? "calibração razoável" : "subes/supercon­fiante"}
        </span>
      </div>

      <div className="bg-neutral-950 rounded border border-neutral-800 p-2 mb-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-44" preserveAspectRatio="none">
          <line x1={0} y1={H} x2={W} y2={0} stroke="#525252" strokeDasharray="3 3" strokeWidth={0.5} />
          {data.usable.map((b, i) => {
            const cx = b.meanPred * W * 5;
            const cy = H - b.observed * H * 5;
            const r = 3 + Math.min(8, b.n / 4);
            const isOver = b.observed < b.meanPred;
            return (
              <g key={i}>
                <line
                  x1={cx}
                  y1={cy}
                  x2={cx}
                  y2={H - b.meanPred * H * 5}
                  stroke={isOver ? "#f43f5e" : "#10b981"}
                  strokeWidth={1}
                />
                <circle cx={cx} cy={cy} r={r} fill={isOver ? "#f43f5e" : "#10b981"} fillOpacity={0.7} />
                <text x={cx + r + 2} y={cy + 3} fontSize="9" fill="#a3a3a3">
                  n={b.n}
                </text>
              </g>
            );
          })}
          <text x={5} y={H - 4} fontSize="9" fill="#737373">0%</text>
          <text x={5} y={10} fontSize="9" fill="#737373">20%</text>
          <text x={W - 28} y={H - 4} fontSize="9" fill="#737373">predito</text>
        </svg>
      </div>

      <div className="space-y-0.5 text-[10px]">
        {data.usable.map((b, i) => {
          const direction =
            Math.abs(b.gap) < 0.02
              ? "≈ esperado"
              : b.gap > 0
              ? `obs +${(b.gap * 100).toFixed(1)}pp`
              : `obs ${(b.gap * 100).toFixed(1)}pp`;
          const tone =
            Math.abs(b.gap) < 0.02
              ? "text-neutral-400"
              : b.gap > 0
              ? "text-emerald-300"
              : "text-red-300";
          return (
            <div key={i} className="flex items-center gap-2 bg-neutral-900/50 rounded px-1.5 py-1">
              <span className="text-neutral-300 font-mono w-20 shrink-0">
                {(b.bin.lo * 100).toFixed(0)}-{(b.bin.hi * 100).toFixed(0)}%
              </span>
              <span className="text-neutral-500 font-mono shrink-0 w-12">
                pred {(b.meanPred * 100).toFixed(1)}%
              </span>
              <span className="text-neutral-200 font-mono shrink-0 w-12">
                obs {(b.observed * 100).toFixed(1)}%
              </span>
              <span className={`flex-1 text-right font-mono font-bold ${tone}`}>{direction}</span>
              <span className="text-neutral-500 font-mono shrink-0 w-10 text-right">{b.n}n</span>
            </div>
          );
        })}
      </div>

      <div className="text-[9px] text-neutral-600 italic mt-2 text-center">
        ECE = erro de calibração esperado · gap positivo = modelo subestima · negativo = superestima
      </div>
    </Card>
  );
});
CalibrationCurve.displayName = "CalibrationCurve";

export default CalibrationCurve;
