import { memo, useMemo } from "react";
import { WHEEL, RED, VOISINS, TIERS, ORPHELINS } from "../lib/wheel";
import { numberFrequencies } from "../lib/stats";

const size = 420;
const cx = size / 2;
const cy = size / 2;
const R = size / 2 - 35;

const sectorColor = (n: number) =>
  VOISINS.has(n) ? "#22d3ee33" : TIERS.has(n) ? "#10b98133" : ORPHELINS.has(n) ? "#a855f733" : "transparent";

const RealWheelMap = memo(({ spins, lastSpin }: { spins: number[]; lastSpin?: number }) => {
  const counts = useMemo(() => numberFrequencies(spins), [spins]);
  const max = useMemo(() => Math.max(1, ...counts), [counts]);
  const expected = spins.length / 37;
  const sd = Math.sqrt(Math.max(1e-9, spins.length * (1 / 37) * (1 - 1 / 37)));
  const angleStep = (2 * Math.PI) / WHEEL.length;

  return (
    <div className="flex flex-col items-center">
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-md h-auto">
        <circle cx={cx} cy={cy} r={R + 20} fill="#0a0a0a" stroke="#262626" strokeWidth="1" />
        {WHEEL.map((num, i) => {
          const a = i * angleStep - Math.PI / 2;
          const x = cx + R * Math.cos(a);
          const y = cy + R * Math.sin(a);
          const isLast = num === lastSpin;
          const fill = num === 0 ? "#16a34a" : RED.has(num) ? "#dc2626" : "#27272a";
          const heat = counts[num] / max;
          const z = sd > 0 ? (counts[num] - expected) / sd : 0;
          const heatRing = z > 1.5 ? "#f97316" : z < -1.5 ? "#3b82f6" : null;
          const ringWidth = Math.min(4, Math.max(1, Math.abs(z) * 1.2));
          return (
            <g key={num}>
              <circle cx={x} cy={y} r={16} fill={sectorColor(num)} opacity="0.6" />
              {heat > 0 && (
                <circle cx={x} cy={y} r={20 + heat * 8} fill={heatRing ?? "#fbbf24"} opacity={heat * 0.35} />
              )}
              {heatRing && <circle cx={x} cy={y} r={14} fill="none" stroke={heatRing} strokeWidth={ringWidth} opacity="0.85" />}
              <circle
                cx={x}
                cy={y}
                r={isLast ? 13 : 11}
                fill={fill}
                stroke={isLast ? "#fbbf24" : "none"}
                strokeWidth={isLast ? 2.5 : 0}
              />
              <text
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="central"
                fill="white"
                fontSize={isLast ? 11 : 9}
                fontWeight="bold"
                fontFamily="ui-monospace, monospace"
                style={{ pointerEvents: "none" }}
              >
                {num}
              </text>
            </g>
          );
        })}
        <circle cx={cx} cy={cy} r={36} fill="#0a0a0a" stroke="#404040" strokeWidth="0.5" />
        <text x={cx} y={cy - 4} textAnchor="middle" fill="#a3a3a3" fontSize="9" fontWeight="700" letterSpacing="2">
          ROLETA
        </text>
        <text x={cx} y={cy + 8} textAnchor="middle" fill="#525252" fontSize="6" letterSpacing="1">
          EU · 37
        </text>
      </svg>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-[10px] text-neutral-400">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#22d3ee55" }} /> Voisins (17)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#10b98155" }} /> Tiers (12)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#a855f755" }} /> Orphelins (8)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full border border-orange-500" /> Quente (descritivo)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full border border-blue-500" /> Ausente
        </span>
      </div>
    </div>
  );
});
RealWheelMap.displayName = "RealWheelMap";
export default RealWheelMap;
