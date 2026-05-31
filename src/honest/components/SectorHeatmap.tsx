import { memo, useMemo } from "react";
import { useHonestStore } from "../lib/store";
import { sectorOf, colorOf, DOZEN_1, DOZEN_2, DOZEN_3, COLUMN_1, COLUMN_2, COLUMN_3, VOISINS, TIERS, ORPHELINS, JEU_ZERO } from "../lib/wheel";
import { Card, SectionHeader } from "./ui";

interface GroupStat {
  name: string;
  size: number;
  weighted: number;
  raw: number;
  expected: number;
  intensity: number;
  trend: "hot" | "cold" | "neutral";
}

const HALF_LIFE = 20;

const analyze = (spins: number[]): GroupStat[] => {
  const groups: Array<{ name: string; set: Set<number>; size: number }> = [
    { name: "Voisins (17)", set: VOISINS, size: 17 },
    { name: "Tiers (12)", set: TIERS, size: 12 },
    { name: "Orphelins (8)", set: ORPHELINS, size: 8 },
    { name: "Jeu Zéro (7)", set: JEU_ZERO, size: 7 },
    { name: "1ª dúzia", set: DOZEN_1, size: 12 },
    { name: "2ª dúzia", set: DOZEN_2, size: 12 },
    { name: "3ª dúzia", set: DOZEN_3, size: 12 },
    { name: "Coluna 1", set: COLUMN_1, size: 12 },
    { name: "Coluna 2", set: COLUMN_2, size: 12 },
    { name: "Coluna 3", set: COLUMN_3, size: 12 },
  ];

  let weightSum = 0;
  const weights = spins.map((_, i) => {
    const w = Math.pow(0.5, i / HALF_LIFE);
    weightSum += w;
    return w;
  });

  return groups.map((g) => {
    let weighted = 0;
    let raw = 0;
    for (let i = 0; i < spins.length; i++) {
      if (g.set.has(spins[i])) {
        weighted += weights[i];
        raw++;
      }
    }
    const expectedWeighted = (g.size / 37) * weightSum;
    const intensity = expectedWeighted > 0 ? weighted / expectedWeighted : 1;
    const trend: GroupStat["trend"] =
      intensity > 1.25 ? "hot" : intensity < 0.75 ? "cold" : "neutral";
    return {
      name: g.name,
      size: g.size,
      weighted,
      raw,
      expected: (g.size / 37) * spins.length,
      intensity,
      trend,
    };
  });
};

const SectorHeatmap = memo(() => {
  const spins = useHonestStore((s) => s.spins);
  const numbers = useMemo(() => spins.slice(0, 80).map((s) => s.n), [spins]);
  const stats = useMemo(() => analyze(numbers), [numbers]);

  if (numbers.length < 10) {
    return (
      <Card padding="sm">
        <SectionHeader title="Heatmap de setores" eyebrow="Ferramenta" />
        <div className="text-[11px] text-neutral-500 italic py-2 text-center">
          Aguardando ≥10 giros para gerar heatmap (atual: {numbers.length})
        </div>
      </Card>
    );
  }

  const barColor = (t: GroupStat["trend"]) =>
    t === "hot" ? "bg-amber-500" : t === "cold" ? "bg-sky-500" : "bg-neutral-600";

  const hot = stats.filter((s) => s.trend === "hot").sort((a, b) => b.intensity - a.intensity).slice(0, 2);
  const cold = stats.filter((s) => s.trend === "cold").sort((a, b) => a.intensity - b.intensity).slice(0, 2);

  return (
    <Card padding="sm">
      <SectionHeader
        title="Heatmap de setores"
        eyebrow="Ferramenta"
        subtitle={
          <span className="text-[10px] text-neutral-500">
            Decaimento exponencial — giros recentes pesam mais (meia-vida {HALF_LIFE} giros) · amostra {numbers.length}
          </span>
        }
      />

      <div className="space-y-1 mb-2">
        {stats.map((g) => {
          const fillPct = Math.min(150, g.intensity * 100);
          return (
            <div key={g.name} className="flex items-center gap-2 text-[11px]">
              <span className="w-20 text-neutral-300 font-bold truncate shrink-0">{g.name}</span>
              <div className="flex-1 h-3 bg-neutral-900 rounded relative overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 w-px bg-neutral-500"
                  style={{ left: `${100 / 1.5}%` }}
                  title="esperado (1.0)"
                />
                <div
                  className={`h-full ${barColor(g.trend)} transition-all`}
                  style={{ width: `${(fillPct / 150) * 100}%` }}
                />
              </div>
              <span className="w-12 text-right font-mono shrink-0 text-neutral-400">
                {g.intensity.toFixed(2)}×
              </span>
              <span className="w-12 text-right font-mono shrink-0 text-neutral-500">
                {g.raw}/{g.expected.toFixed(0)}
              </span>
            </div>
          );
        })}
      </div>

      {(hot.length > 0 || cold.length > 0) && (
        <div className="grid grid-cols-2 gap-1 mt-2">
          {hot.length > 0 && (
            <div className="bg-amber-950/40 rounded p-1.5 border border-amber-800/40">
              <div className="text-[9px] text-amber-400/80 uppercase tracking-wider font-bold">🔥 Quentes</div>
              {hot.map((h) => (
                <div key={h.name} className="text-[11px] text-amber-200 font-bold">
                  {h.name} <span className="font-mono opacity-70">({h.intensity.toFixed(2)}×)</span>
                </div>
              ))}
            </div>
          )}
          {cold.length > 0 && (
            <div className="bg-sky-950/40 rounded p-1.5 border border-sky-800/40">
              <div className="text-[9px] text-sky-400/80 uppercase tracking-wider font-bold">❄ Frios</div>
              {cold.map((h) => (
                <div key={h.name} className="text-[11px] text-sky-200 font-bold">
                  {h.name} <span className="font-mono opacity-70">({h.intensity.toFixed(2)}×)</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="text-[9px] text-neutral-600 italic mt-2 text-center">
        Quentes/frios são desvios de amostra — não previsão. Cada giro continua independente.
      </div>
    </Card>
  );
});
SectorHeatmap.displayName = "SectorHeatmap";

export default SectorHeatmap;
