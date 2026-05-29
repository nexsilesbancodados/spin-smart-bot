import { memo, useMemo, useState } from "react";
import { useHonestStore } from "../lib/store";
import { buildPairMatrix, buildHourHeatmap } from "../lib/correlations";
import { SLOTS, colorOf } from "../lib/wheel";
import { Card, PageContainer, PageHeader, SectionHeader, Stat, StatGrid, EmptyState } from "../components/ui";

const ballBg = (n: number) => {
  const c = colorOf(n);
  if (c === "green") return "bg-emerald-600";
  if (c === "red") return "bg-red-600";
  return "bg-neutral-800";
};

const Correlations = memo(() => {
  const spins = useHonestStore((s) => s.spins);
  const total = spins.length;
  const [selected, setSelected] = useState<number | null>(null);

  const pair = useMemo(() => buildPairMatrix(spins.map((s) => s.n)), [spins]);
  const hours = useMemo(() => buildHourHeatmap(spins), [spins]);

  const transitionsFromSelected = useMemo(() => {
    if (selected === null) return [];
    return pair.matrix[selected]
      .map((c, n) => ({ n, c, pct: pair.rowTotals[selected] > 0 ? c / pair.rowTotals[selected] : 0 }))
      .filter((x) => x.c > 0)
      .sort((a, b) => b.c - a.c)
      .slice(0, 10);
  }, [pair, selected]);

  if (total < 50) {
    return (
      <PageContainer>
        <PageHeader title="Correlações & Tempo" subtitle="Matriz de transições + heatmap por hora do dia." />
        <EmptyState
          icon="🕒"
          title={`Histórico insuficiente (${total}/50)`}
          description="Precisa de pelo menos 50 giros pra começar a popular as visualizações."
        />
      </PageContainer>
    );
  }

  const maxHourTotal = Math.max(1, ...hours.map((h) => h.total));

  return (
    <PageContainer>
      <PageHeader
        title="Correlações & Tempo"
        subtitle="Matriz de transições A→B e distribuição por hora do dia."
      />

      <Card>
        <SectionHeader
          title="Matriz de transições"
          subtitle={`${spins.length} giros · clique num número da grade para isolar suas saídas seguintes`}
        />
        <div className="overflow-auto max-h-[600px]">
          <div className="inline-grid gap-px" style={{ gridTemplateColumns: `auto repeat(${SLOTS}, minmax(0, 1.4rem))` }}>
            <div />
            {Array.from({ length: SLOTS }, (_, j) => (
              <div key={`h${j}`} className="text-[8px] font-mono text-neutral-500 text-center px-0.5">
                {j}
              </div>
            ))}
            {Array.from({ length: SLOTS }, (_, i) => (
              <div key={`r${i}`} className="contents">
                <button
                  onClick={() => setSelected(selected === i ? null : i)}
                  className={`text-[10px] font-mono px-1 sticky left-0 text-right ${
                    selected === i ? "bg-amber-500 text-black font-bold" : "text-neutral-400 hover:text-neutral-100"
                  } ${ballBg(i)} text-white pl-1 pr-1`}
                >
                  {i}
                </button>
                {Array.from({ length: SLOTS }, (_, j) => {
                  const c = pair.matrix[i][j];
                  const intensity = pair.maxCount > 0 ? c / pair.maxCount : 0;
                  return (
                    <div
                      key={`c${i}-${j}`}
                      className="h-5 w-5 flex items-center justify-center text-[8px] font-mono"
                      title={`${i} → ${j} : ${c} vez(es)`}
                      style={{
                        background: c === 0 ? "transparent" : `rgba(245, 158, 11, ${0.15 + intensity * 0.85})`,
                        color: intensity > 0.5 ? "#0a0a0a" : "#a3a3a3",
                      }}
                    >
                      {c > 0 ? c : ""}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </Card>

      {selected !== null && (
        <Card>
          <SectionHeader title={`Sai depois do ${selected}`} subtitle={`Top 10 mais frequentes · total ${pair.rowTotals[selected]} transições saindo de ${selected}`} />
          <div className="space-y-1.5">
            {transitionsFromSelected.map((it) => (
              <div key={it.n} className="flex items-center gap-2">
                <div className={`${ballBg(it.n)} text-white text-[11px] font-bold w-7 h-7 rounded-md flex items-center justify-center`}>
                  {it.n}
                </div>
                <div className="flex-1">
                  <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                    <div className="h-2 bg-amber-500" style={{ width: `${it.pct * 100}%` }} />
                  </div>
                </div>
                <span className="text-xs font-mono text-neutral-300 w-20 text-right">
                  {it.c}× · {(it.pct * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <SectionHeader title="Distribuição por hora do dia" subtitle="Quando os giros entram no app — útil pra identificar janelas de mesa cheia/vazia" />
        <div className="grid grid-cols-12 sm:grid-cols-24 gap-1" style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}>
          {hours.map((h) => {
            const ratio = h.total / maxHourTotal;
            return (
              <div key={h.hour} className="flex flex-col items-center gap-0.5">
                <div className="text-[8px] text-neutral-500 font-mono">{h.hour}h</div>
                <div className="w-full h-20 bg-neutral-900 rounded relative overflow-hidden border border-neutral-800">
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-amber-500"
                    style={{ height: `${ratio * 100}%` }}
                  />
                </div>
                <div className="text-[8px] font-mono text-neutral-400">{h.total}</div>
              </div>
            );
          })}
        </div>
        <StatGrid cols={3}>
          <Stat
            label="Hora mais movimentada"
            value={`${hours.sort((a, b) => b.total - a.total)[0].hour}h`}
            sub={`${hours[0].total} giros nessa hora`}
          />
          <Stat label="Hora mais quieta" value={`${[...hours].sort((a, b) => a.total - b.total)[0].hour}h`} />
          <Stat label="Diferença" value={`${maxHourTotal - Math.min(...hours.map((h) => h.total))}`} sub="giros entre pico e vale" />
        </StatGrid>
      </Card>
    </PageContainer>
  );
});
Correlations.displayName = "Correlations";

export default Correlations;
