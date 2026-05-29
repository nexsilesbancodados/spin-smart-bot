import { memo, useMemo } from "react";
import { useHonestStore, selectWindowSpins } from "../lib/store";
import {
  VOISINS,
  TIERS,
  ORPHELINS,
  COLUMN_1,
  COLUMN_2,
  COLUMN_3,
  DOZEN_1,
  DOZEN_2,
  DOZEN_3,
  RED,
  BLACK,
  numbersWithTerminal,
} from "../lib/wheel";
import { analyzeGroup, chiSquareUniform, concentrationIndex, gapByNumber } from "../lib/stats";
import { buildTrends, mineSequences } from "../lib/advancedAnalysis";
import VerdictBadge from "../components/VerdictBadge";
import WindowPicker from "../components/WindowPicker";
import { Card, PageContainer, PageHeader, SectionHeader, Stat, StatGrid, EmptyState, Pill } from "../components/ui";

const Analise = memo(() => {
  const spins = useHonestStore(selectWindowSpins);
  const allSpins = useHonestStore((s) => s.spins.map((x) => x.n));

  const sectors = useMemo(
    () => [
      analyzeGroup("Voisins du Zéro (17)", VOISINS, spins),
      analyzeGroup("Tiers du Cylindre (12)", TIERS, spins),
      analyzeGroup("Orphelins (8)", ORPHELINS, spins),
    ],
    [spins]
  );
  const dozens = useMemo(
    () => [
      analyzeGroup("1ª Dúzia (1–12)", DOZEN_1, spins),
      analyzeGroup("2ª Dúzia (13–24)", DOZEN_2, spins),
      analyzeGroup("3ª Dúzia (25–36)", DOZEN_3, spins),
    ],
    [spins]
  );
  const columns = useMemo(
    () => [
      analyzeGroup("Coluna 1", COLUMN_1, spins),
      analyzeGroup("Coluna 2", COLUMN_2, spins),
      analyzeGroup("Coluna 3", COLUMN_3, spins),
    ],
    [spins]
  );
  const colors = useMemo(
    () => [analyzeGroup("Vermelho", RED, spins), analyzeGroup("Preto", BLACK, spins), analyzeGroup("Zero", new Set([0]), spins)],
    [spins]
  );
  const terminals = useMemo(
    () =>
      Array.from({ length: 10 }, (_, t) =>
        analyzeGroup(`Terminal ${t}`, new Set(numbersWithTerminal(t)), spins)
      ),
    [spins]
  );
  const chi = useMemo(() => chiSquareUniform(spins), [spins]);
  const ci = useMemo(() => concentrationIndex(spins), [spins]);
  const gaps = useMemo(() => gapByNumber(spins), [spins]);
  const trends = useMemo(() => buildTrends(allSpins, 30), [allSpins]);
  const sequences3 = useMemo(() => mineSequences(allSpins, 3, 2, 8), [allSpins]);
  const sequences4 = useMemo(() => mineSequences(allSpins, 4, 2, 5), [allSpins]);
  const topGaps = useMemo(
    () =>
      Object.entries(gaps)
        .map(([n, g]) => ({ n: Number(n), g }))
        .sort((a, b) => b.g - a.g)
        .slice(0, 6),
    [gaps]
  );

  if (spins.length < 5) {
    return (
      <PageContainer>
        <PageHeader title="Análise" subtitle="Observado vs. esperado, z-score e veredito por categoria." />
        <EmptyState
          icon="📉"
          title={`Histórico insuficiente (${spins.length}/5)`}
          description="A análise estatística faz mais sentido com 50+ giros. Aguarde o feed popular."
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Análise"
        subtitle="Observado vs. esperado, z-score e veredito por categoria."
        actions={<WindowPicker />}
      />

      <Card>
        <SectionHeader
          title="Teste qui-quadrado (uniformidade)"
          actions={<Pill accent={chi.uniformCompatible ? "good" : "warn"}>{chi.uniformCompatible ? "Compatível com o acaso" : "Desvio observado"}</Pill>}
        />
        <StatGrid cols={3}>
          <Stat label="χ²" value={chi.chi2.toFixed(2)} />
          <Stat label="Graus de liberdade" value={String(chi.df)} />
          <Stat label="p (aprox.)" value={chi.pApprox.toFixed(3)} />
        </StatGrid>
        <p className="text-xs text-neutral-400 mt-3">{chi.summary}</p>
      </Card>

      <Card>
        <SectionHeader title="Índice de concentração" />
        <div className="flex items-center gap-4">
          <span className="text-3xl font-bold font-mono text-amber-300">{ci}</span>
          <div className="flex-1">
            <div className="w-full bg-neutral-800 rounded-full h-2 overflow-hidden">
              <div className="bg-amber-500 h-2" style={{ width: `${ci}%` }} />
            </div>
          </div>
        </div>
      </Card>

      <GroupGrid title="Setores físicos" items={sectors} />
      <GroupGrid title="Dúzias" items={dozens} />
      <GroupGrid title="Colunas" items={columns} />
      <GroupGrid title="Cor" items={colors} />
      <GroupGrid title="Terminais (último dígito)" items={terminals} cols={5} />

      <Card>
        <SectionHeader title="Maiores ausências (gap descritivo)" />
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {topGaps.map((g) => (
            <div key={g.n} className="rounded-lg border border-neutral-700 bg-neutral-950/60 p-2 text-center">
              <div className="text-lg font-bold font-mono">{g.n}</div>
              <div className="text-[10px] text-neutral-500">{g.g}g sem sair</div>
            </div>
          ))}
        </div>
      </Card>

      {trends.length >= 2 && (
        <Card>
          <SectionHeader
            title="Tendências em janelas deslizantes"
            subtitle="Evolução de cada categoria ao longo do histórico (janelas de 30 giros)"
          />
          <TrendChart trends={trends} />
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {sequences3.length > 0 && (
          <Card padding="sm">
            <SectionHeader title="Tripletas mais frequentes" subtitle="Sequências de 3 giros que se repetiram" />
            <SequenceList items={sequences3} />
          </Card>
        )}
        {sequences4.length > 0 && (
          <Card padding="sm">
            <SectionHeader title="Quartetos mais frequentes" subtitle="Sequências de 4 giros que se repetiram" />
            <SequenceList items={sequences4} />
          </Card>
        )}
      </div>
    </PageContainer>
  );
});

const TrendChart = memo(({ trends }: { trends: Array<{ window: number; voisins: number; tiers: number; orphelins: number; red: number; black: number }> }) => {
  if (trends.length < 2) return null;
  const W = 700;
  const H = 200;
  const x = (i: number) => (i / (trends.length - 1)) * W;
  const y = (v: number) => H - v * H;

  const series = [
    { key: "voisins" as const, color: "#22d3ee", label: "Voisins (esp 46%)" },
    { key: "tiers" as const, color: "#10b981", label: "Tiers (esp 32%)" },
    { key: "orphelins" as const, color: "#a855f7", label: "Orphelins (esp 22%)" },
    { key: "red" as const, color: "#dc2626", label: "Vermelho (esp 49%)" },
  ];

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-neutral-950 rounded-lg border border-neutral-800">
        {[0.25, 0.5, 0.75].map((v) => (
          <line key={v} x1={0} y1={y(v)} x2={W} y2={y(v)} stroke="#262626" strokeDasharray="3 3" strokeWidth={0.5} />
        ))}
        {series.map((s) => {
          const path = trends.map((t, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(t[s.key])}`).join(" ");
          return <path key={s.key} d={path} fill="none" stroke={s.color} strokeWidth={1.5} />;
        })}
      </svg>
      <div className="flex flex-wrap gap-3 mt-2 text-[10px]">
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 rounded-full" style={{ background: s.color }} />
            <span className="text-neutral-400">{s.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
});
TrendChart.displayName = "AnaliseTrendChart";

const SequenceList = memo(({ items }: { items: Array<{ pattern: number[]; count: number; lift: number }> }) => (
  <div className="space-y-1.5">
    {items.map((it, i) => (
      <div key={i} className="flex items-center gap-2 text-xs">
        <div className="flex gap-0.5">
          {it.pattern.map((n, j) => {
            const bg = n === 0 ? "bg-emerald-600" : [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(n) ? "bg-red-600" : "bg-neutral-800";
            return (
              <span key={j} className={`${bg} text-white text-[10px] font-bold w-5 h-5 rounded-sm flex items-center justify-center`}>
                {n}
              </span>
            );
          })}
        </div>
        <span className="font-mono text-neutral-300">{it.count}×</span>
        <span className="text-[10px] text-neutral-500">lift {it.lift.toFixed(1)}×</span>
        <VerdictBadge verdict={it.lift > 5 ? "leve" : "aleatorio"} />
      </div>
    ))}
  </div>
));
SequenceList.displayName = "AnaliseSequenceList";
Analise.displayName = "Analise";

interface GroupGridProps {
  title: string;
  items: ReturnType<typeof analyzeGroup>[];
  cols?: number;
}

const GroupGrid = memo(({ title, items, cols = 3 }: GroupGridProps) => (
  <Card>
    <SectionHeader title={title} />
    <div
      className={`grid grid-cols-1 sm:grid-cols-2 ${
        cols === 5 ? "lg:grid-cols-5" : cols === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"
      } gap-2`}
    >
      {items.map((it) => (
        <div key={it.name} className="rounded-lg border border-neutral-700 bg-neutral-950/60 p-2.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold text-neutral-300 truncate">{it.name}</span>
            <VerdictBadge verdict={it.verdict} />
          </div>
          <div className="text-[10px] text-neutral-400 font-mono">
            obs <span className="text-neutral-100">{it.observed}</span> · esp{" "}
            <span className="text-neutral-100">{it.expected.toFixed(1)}</span> · z{" "}
            <span className={Math.abs(it.z) >= 2 ? "text-amber-300" : "text-neutral-300"}>{it.z.toFixed(2)}</span>
          </div>
        </div>
      ))}
    </div>
  </Card>
));
GroupGrid.displayName = "GroupGrid";

export default Analise;
