import { memo, useMemo, useState } from "react";
import { useHonestStore } from "../lib/store";
import { WHEEL, colorOf, physicalNeighbors } from "../lib/wheel";
import { Card, SectionHeader } from "./ui";

const SIZE = 260;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R_OUTER = 120;
const R_INNER = 78;
const R_TEXT = 99;

const polar = (angle: number, r: number) => ({
  x: CX + r * Math.cos(angle),
  y: CY + r * Math.sin(angle),
});

const arcPath = (i: number) => {
  const total = WHEEL.length;
  const sweep = (Math.PI * 2) / total;
  const start = -Math.PI / 2 + i * sweep - sweep / 2;
  const end = start + sweep;
  const p1 = polar(start, R_OUTER);
  const p2 = polar(end, R_OUTER);
  const p3 = polar(end, R_INNER);
  const p4 = polar(start, R_INNER);
  return `M ${p1.x} ${p1.y} A ${R_OUTER} ${R_OUTER} 0 0 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${R_INNER} ${R_INNER} 0 0 0 ${p4.x} ${p4.y} Z`;
};

const textPos = (i: number) => {
  const total = WHEEL.length;
  const sweep = (Math.PI * 2) / total;
  const angle = -Math.PI / 2 + i * sweep;
  return polar(angle, R_TEXT);
};

const HotColdWheel = memo(() => {
  const spins = useHonestStore((s) => s.spins);
  const windowSize = useHonestStore((s) => s.windowSize);
  const [selected, setSelected] = useState<number | null>(null);
  const [neighborRadius, setNeighborRadius] = useState(2);

  const stats = useMemo(() => {
    const recent = spins.slice(0, windowSize);
    const counts = new Array(37).fill(0);
    recent.forEach((s) => {
      counts[s.n] = (counts[s.n] || 0) + 1;
    });
    const expected = recent.length / 37;
    const max = Math.max(...counts, 1);
    const hot = counts.map((c, i) => ({ n: i, count: c, hotness: max > 0 ? c / max : 0, dev: c - expected }));
    return { hot, total: recent.length, expected };
  }, [spins, windowSize]);

  const neighbors = useMemo(() => {
    if (selected === null) return new Set<number>();
    const ns = physicalNeighbors(selected, neighborRadius);
    return new Set([selected, ...ns]);
  }, [selected, neighborRadius]);

  const fillFor = (n: number) => {
    const s = stats.hot[n];
    if (selected !== null && !neighbors.has(n)) return "rgba(40,40,40,0.55)";
    if (s.count === 0) return colorOf(n) === "green" ? "#047857" : colorOf(n) === "red" ? "#7f1d1d" : "#1c1c1c";
    const intensity = Math.min(1, s.hotness);
    if (s.dev > 0) {
      return `rgba(245, 158, 11, ${0.35 + intensity * 0.65})`;
    }
    return colorOf(n) === "green" ? "#059669" : colorOf(n) === "red" ? "#991b1b" : "#0a0a0a";
  };

  const selectedStats = selected !== null ? stats.hot[selected] : null;

  return (
    <Card padding="sm">
      <SectionHeader title="Roleta — hot/cold + vizinhos" eyebrow="Ferramenta" />
      <div className="flex flex-col sm:flex-row gap-3 items-center">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full max-w-[260px]" role="img">
          <defs>
            <radialGradient id="bg-hot" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#1f1f1f" />
              <stop offset="100%" stopColor="#000" />
            </radialGradient>
          </defs>
          <circle cx={CX} cy={CY} r={R_OUTER + 8} fill="url(#bg-hot)" />
          {WHEEL.map((n, i) => {
            const t = textPos(i);
            const isHead = spins[0]?.n === n;
            return (
              <g
                key={`${n}-${i}`}
                onClick={() => setSelected((s) => (s === n ? null : n))}
                className="cursor-pointer"
              >
                <path
                  d={arcPath(i)}
                  fill={fillFor(n)}
                  stroke={isHead ? "#fbbf24" : selected === n ? "#facc15" : "#000"}
                  strokeWidth={isHead || selected === n ? 1.6 : 0.6}
                />
                <text
                  x={t.x}
                  y={t.y}
                  fontSize="9"
                  fontWeight="700"
                  fill="white"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="pointer-events-none select-none"
                >
                  {n}
                </text>
              </g>
            );
          })}
          <circle cx={CX} cy={CY} r={R_INNER - 4} fill="#0a0a0a" stroke="#262626" />
          <text x={CX} y={CY - 6} fontSize="9" fill="#9ca3af" textAnchor="middle">
            últimos
          </text>
          <text x={CX} y={CY + 8} fontSize="14" fontWeight="800" fill="#fbbf24" textAnchor="middle">
            {stats.total}
          </text>
        </svg>

        <div className="flex-1 min-w-0 w-full">
          {selectedStats ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-black text-sm ${
                    colorOf(selected!) === "green"
                      ? "bg-emerald-600"
                      : colorOf(selected!) === "red"
                      ? "bg-red-600"
                      : "bg-neutral-800"
                  }`}
                >
                  {selected}
                </span>
                <div className="flex-1">
                  <div className="text-[10px] uppercase tracking-wider text-neutral-500">
                    Saiu / esperado
                  </div>
                  <div className="font-bold font-mono text-sm">
                    {selectedStats.count} / {stats.expected.toFixed(1)}{" "}
                    <span className={selectedStats.dev > 0 ? "text-amber-300" : "text-neutral-400"}>
                      ({selectedStats.dev > 0 ? "+" : ""}
                      {selectedStats.dev.toFixed(1)})
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider text-neutral-500 shrink-0">
                  Raio vizinhos
                </span>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={neighborRadius}
                  onChange={(e) => setNeighborRadius(Number(e.target.value))}
                  className="flex-1 accent-amber-500"
                />
                <span className="text-xs font-bold text-amber-300 font-mono w-6 text-right">
                  ±{neighborRadius}
                </span>
              </div>

              <div className="bg-neutral-900/60 rounded p-2 text-[11px]">
                <div className="text-[9px] text-neutral-500 uppercase tracking-wider mb-1">
                  Cobertura ({neighbors.size} nº)
                </div>
                <div className="flex flex-wrap gap-1">
                  {Array.from(neighbors).map((n) => (
                    <span
                      key={n}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        n === selected
                          ? "bg-amber-500 text-black"
                          : colorOf(n) === "green"
                          ? "bg-emerald-700 text-white"
                          : colorOf(n) === "red"
                          ? "bg-red-700 text-white"
                          : "bg-neutral-800 text-white"
                      }`}
                    >
                      {n}
                    </span>
                  ))}
                </div>
              </div>

              <div className="text-[10px] text-neutral-500">
                Aposta pleno em {neighbors.size} nº → cobre {((neighbors.size / 37) * 100).toFixed(1)}% ·
                payout ~{(35 / neighbors.size).toFixed(2)}:1
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-neutral-400 leading-snug">
              <p className="mb-1.5">Toque em um número para ver:</p>
              <ul className="space-y-0.5 text-neutral-500">
                <li>• vizinhos físicos na roleta</li>
                <li>• cobertura total e payout proporcional</li>
                <li>• desvio em relação ao esperado</li>
              </ul>
              <p className="mt-2 text-[10px] text-amber-400/80">
                ⚡ amarelo = saiu mais que o esperado
              </p>
              <p className="text-[10px] text-neutral-600">
                amostra: últimos {stats.total} giros
              </p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
});
HotColdWheel.displayName = "HotColdWheel";

export default HotColdWheel;
