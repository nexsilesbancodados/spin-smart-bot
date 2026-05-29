import { memo, useMemo } from "react";
import { useHonestStore } from "../lib/store";
import { SLOTS, colorOf, sectorOf } from "../lib/wheel";
import { Card, SectionHeader, Pill } from "./ui";

const shannonEntropy = (counts: number[]): number => {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  let h = 0;
  for (const c of counts) {
    if (c > 0) {
      const p = c / total;
      h -= p * Math.log2(p);
    }
  }
  return h;
};

const rollingEntropy = (
  series: number[],
  windowSize: number,
  bucketCount: number,
  bucketOf: (n: number) => number
): { idx: number; h: number }[] => {
  if (series.length < windowSize + 1) return [];
  const out: { idx: number; h: number }[] = [];
  for (let i = windowSize; i <= series.length; i++) {
    const slice = series.slice(i - windowSize, i);
    const counts = new Array(bucketCount).fill(0);
    for (const n of slice) counts[bucketOf(n)]++;
    out.push({ idx: i, h: shannonEntropy(counts) });
  }
  return out;
};

const EntropyTracker = memo(() => {
  const spins = useHonestStore((s) => s.spins);

  const data = useMemo(() => {
    if (spins.length < 40) return null;
    const series = spins.map((s) => s.n).reverse();
    const window = Math.min(30, Math.floor(series.length / 2));

    const numHEntries = rollingEntropy(series, window, SLOTS, (n) => n);
    const colorHEntries = rollingEntropy(series, window, 3, (n) =>
      n === 0 ? 2 : colorOf(n) === "red" ? 0 : 1
    );
    const sectorHEntries = rollingEntropy(series, window, 3, (n) => {
      const s = sectorOf(n);
      return s === "Voisins" ? 0 : s === "Tiers" ? 1 : 2;
    });

    const numMax = Math.log2(SLOTS);
    const colorMax = Math.log2(3);

    const lastNum = numHEntries[numHEntries.length - 1]?.h ?? 0;
    const lastColor = colorHEntries[colorHEntries.length - 1]?.h ?? 0;
    const lastSector = sectorHEntries[sectorHEntries.length - 1]?.h ?? 0;

    const firstNum = numHEntries[0]?.h ?? 0;
    const trend = lastNum - firstNum;

    return {
      numH: numHEntries.map((e) => e.h),
      colorH: colorHEntries.map((e) => e.h),
      sectorH: sectorHEntries.map((e) => e.h),
      lastNum,
      lastColor,
      lastSector,
      numMax,
      colorMax,
      trend,
      window,
      n: series.length,
    };
  }, [spins]);

  if (!data) {
    return (
      <Card padding="sm">
        <SectionHeader title="Entropia (Shannon)" eyebrow="Análise" />
        <div className="text-[11px] text-neutral-500 italic py-2 text-center">
          Aguardando ≥40 giros (atual: {spins.length})
        </div>
      </Card>
    );
  }

  const numNorm = data.lastNum / data.numMax;
  const colorNorm = data.lastColor / data.colorMax;
  const sectorNorm = data.lastSector / data.colorMax;

  const renderSpark = (values: number[], max: number, color: string) => {
    if (values.length < 2) return null;
    const W = 280;
    const H = 28;
    const x = (i: number) => (i / (values.length - 1)) * W;
    const y = (v: number) => H - (v / max) * (H - 2) - 1;
    const path = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ");
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-7" preserveAspectRatio="none">
        <line x1={0} y1={1} x2={W} y2={1} stroke="#525252" strokeDasharray="2 2" strokeWidth={0.4} />
        <path d={path} fill="none" stroke={color} strokeWidth={1.5} />
        <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r={2} fill={color} />
      </svg>
    );
  };

  const Row = ({
    label,
    last,
    max,
    norm,
    values,
    color,
  }: {
    label: string;
    last: number;
    max: number;
    norm: number;
    values: number[];
    color: string;
  }) => (
    <div className="bg-neutral-900/40 rounded p-1.5">
      <div className="flex items-center justify-between text-[10px] mb-1">
        <span className="text-neutral-300 font-bold">{label}</span>
        <span className="font-mono text-neutral-400">
          {last.toFixed(2)} / {max.toFixed(2)} ({(norm * 100).toFixed(0)}%)
        </span>
      </div>
      {renderSpark(values, max, color)}
    </div>
  );

  return (
    <Card padding="sm">
      <SectionHeader
        title="Entropia (Shannon) rolante"
        eyebrow="Análise"
        subtitle={
          <span className="text-[10px] text-neutral-500">
            Janela {data.window} giros · 100% = aleatoriedade máxima
          </span>
        }
      />

      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <Pill accent={numNorm > 0.95 ? "good" : numNorm > 0.85 ? "neutral" : "warn"}>
          Números: {(numNorm * 100).toFixed(1)}%
        </Pill>
        <Pill accent={Math.abs(data.trend) < 0.1 ? "neutral" : data.trend > 0 ? "good" : "warn"}>
          Tendência: {data.trend >= 0 ? "+" : ""}
          {data.trend.toFixed(3)}
        </Pill>
        <span className="text-[10px] text-neutral-500 italic">
          {data.trend < -0.15
            ? "concentrando — algumas faces dominam"
            : data.trend > 0.15
            ? "espalhando — mais uniforme"
            : "estável"}
        </span>
      </div>

      <div className="space-y-1.5">
        <Row label="Números (37)" last={data.lastNum} max={data.numMax} norm={numNorm} values={data.numH} color="#f59e0b" />
        <Row label="Cor (R/B/Z)" last={data.lastColor} max={data.colorMax} norm={colorNorm} values={data.colorH} color="#10b981" />
        <Row label="Setor (V/T/O)" last={data.lastSector} max={data.colorMax} norm={sectorNorm} values={data.sectorH} color="#0ea5e9" />
      </div>

      <div className="text-[9px] text-neutral-600 italic mt-2 text-center">
        Queda de entropia = mesa virando previsível. Subida = se aproximando do acaso.
      </div>
    </Card>
  );
});
EntropyTracker.displayName = "EntropyTracker";

export default EntropyTracker;
