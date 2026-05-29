import { memo, useMemo, useState } from "react";
import { useHonestStore } from "../lib/store";
import { colorOf, sectorOf, VOISINS } from "../lib/wheel";
import { Card, SectionHeader } from "./ui";

type Series = "color" | "sector" | "parity" | "number";

const toNumeric = (n: number, series: Series): number => {
  if (series === "number") return n;
  if (series === "color") return n === 0 ? 0 : colorOf(n) === "red" ? 1 : -1;
  if (series === "sector") {
    const s = sectorOf(n);
    return s === "Voisins" ? 1 : s === "Tiers" ? 0 : -1;
  }
  return n === 0 ? 0 : n % 2 === 0 ? 1 : -1;
};

const autocorr = (x: number[], lag: number): number => {
  const n = x.length - lag;
  if (n <= 1) return 0;
  let sum = 0, sum2 = 0;
  for (let i = 0; i < x.length; i++) {
    sum += x[i];
    sum2 += x[i] * x[i];
  }
  const mean = sum / x.length;
  const variance = sum2 / x.length - mean * mean;
  if (variance <= 1e-9) return 0;
  let cov = 0;
  for (let i = 0; i < n; i++) cov += (x[i] - mean) * (x[i + lag] - mean);
  cov /= n;
  return cov / variance;
};

const Autocorrelation = memo(() => {
  const spins = useHonestStore((s) => s.spins);
  const [series, setSeries] = useState<Series>("color");
  const MAX_LAG = 10;

  const data = useMemo(() => {
    const numbers = spins.map((s) => s.n);
    if (numbers.length < 30) return null;
    const x = numbers.map((n) => toNumeric(n, series));
    const lags: { lag: number; r: number; significant: boolean }[] = [];
    const ci = 1.96 / Math.sqrt(x.length);
    for (let k = 1; k <= MAX_LAG; k++) {
      const r = autocorr(x, k);
      lags.push({ lag: k, r, significant: Math.abs(r) > ci });
    }
    return { lags, ci, n: x.length };
  }, [spins, series]);

  const seriesOpts: Array<{ id: Series; label: string }> = [
    { id: "color", label: "Cor" },
    { id: "sector", label: "Setor" },
    { id: "parity", label: "Paridade" },
    { id: "number", label: "Número" },
  ];

  if (!data) {
    return (
      <Card padding="sm">
        <SectionHeader title="Autocorrelação (ACF)" eyebrow="Análise" />
        <div className="text-[11px] text-neutral-500 italic py-2 text-center">
          Aguardando ≥30 giros (atual: {spins.length})
        </div>
      </Card>
    );
  }

  const sigLags = data.lags.filter((l) => l.significant);
  const maxAbs = Math.max(0.3, ...data.lags.map((l) => Math.abs(l.r)));

  return (
    <Card padding="sm">
      <SectionHeader
        title="Autocorrelação (ACF)"
        eyebrow="Análise"
        subtitle={
          <span className="text-[10px] text-neutral-500">
            Correlação entre giro t e t+k · CI95 = ±{data.ci.toFixed(3)} · n={data.n}
          </span>
        }
        actions={
          <div className="flex gap-1">
            {seriesOpts.map((s) => (
              <button
                key={s.id}
                onClick={() => setSeries(s.id)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  s.id === series ? "bg-amber-500 text-black" : "bg-neutral-800 text-neutral-300"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="bg-neutral-950 rounded border border-neutral-800 p-2 mb-2">
        <svg viewBox="0 0 320 100" className="w-full h-24" preserveAspectRatio="none">
          <line x1={0} y1={50} x2={320} y2={50} stroke="#525252" strokeWidth={0.5} />
          <line
            x1={0}
            y1={50 - (data.ci / maxAbs) * 45}
            x2={320}
            y2={50 - (data.ci / maxAbs) * 45}
            stroke="#0891b2"
            strokeDasharray="3 3"
            strokeWidth={0.4}
          />
          <line
            x1={0}
            y1={50 + (data.ci / maxAbs) * 45}
            x2={320}
            y2={50 + (data.ci / maxAbs) * 45}
            stroke="#0891b2"
            strokeDasharray="3 3"
            strokeWidth={0.4}
          />
          {data.lags.map((l, i) => {
            const x = 18 + i * 30;
            const h = (Math.abs(l.r) / maxAbs) * 45;
            const y = l.r >= 0 ? 50 - h : 50;
            return (
              <g key={l.lag}>
                <rect
                  x={x - 6}
                  y={y}
                  width={12}
                  height={h}
                  fill={l.significant ? "#f59e0b" : "#737373"}
                />
                <text
                  x={x}
                  y={96}
                  fontSize="8"
                  fill="#9ca3af"
                  textAnchor="middle"
                >
                  {l.lag}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="grid grid-cols-5 gap-0.5 text-[10px]">
        {data.lags.slice(0, 10).map((l) => (
          <div
            key={l.lag}
            className={`rounded p-1 text-center ${
              l.significant ? "bg-amber-950/50 border border-amber-700" : "bg-neutral-900/50"
            }`}
            title={`lag ${l.lag}: r=${l.r.toFixed(3)}${l.significant ? " (significativo)" : ""}`}
          >
            <div className="text-[8px] text-neutral-500 font-bold">k={l.lag}</div>
            <div
              className={`font-mono font-bold ${
                l.significant ? "text-amber-300" : "text-neutral-400"
              }`}
            >
              {l.r >= 0 ? "+" : ""}
              {l.r.toFixed(2)}
            </div>
          </div>
        ))}
      </div>

      <div className="text-[10px] text-neutral-500 mt-2 text-center">
        {sigLags.length === 0 ? (
          <span>Nenhum lag significativo — comportamento independente</span>
        ) : (
          <span className="text-amber-400">
            ⚠ {sigLags.length} lag(s) acima do CI95: k={sigLags.map((l) => l.lag).join(", ")}
          </span>
        )}
      </div>
    </Card>
  );
});
Autocorrelation.displayName = "Autocorrelation";

export default Autocorrelation;
