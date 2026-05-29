import { memo, useMemo } from "react";
import { useABTest, computeVariantStats } from "../lib/abTest";
import { Card, SectionHeader, Stat, StatGrid, Button, Pill } from "./ui";

const ABTestPanel = memo(() => {
  const enabled = useABTest((s) => s.enabled);
  const setEnabled = useABTest((s) => s.setEnabled);
  const configA = useABTest((s) => s.configA);
  const configB = useABTest((s) => s.configB);
  const setConfigA = useABTest((s) => s.setConfigA);
  const setConfigB = useABTest((s) => s.setConfigB);
  const historyA = useABTest((s) => s.historyA);
  const historyB = useABTest((s) => s.historyB);
  const pendingA = useABTest((s) => s.pendingA);
  const pendingB = useABTest((s) => s.pendingB);
  const clear = useABTest((s) => s.clearHistory);

  const statsA = useMemo(() => computeVariantStats(historyA, configA.topNHit), [historyA, configA.topNHit]);
  const statsB = useMemo(() => computeVariantStats(historyB, configB.topNHit), [historyB, configB.topNHit]);

  const winner = useMemo(() => {
    if (statsA.resolved < 5 || statsB.resolved < 5) return null;
    if (statsA.liftTop > statsB.liftTop * 1.05) return "A";
    if (statsB.liftTop > statsA.liftTop * 1.05) return "B";
    return "empate";
  }, [statsA, statsB]);

  return (
    <Card accent={enabled ? "warn" : "neutral"}>
      <SectionHeader
        title="🧪 Modo A/B Test"
        subtitle="Roda 2 variantes em paralelo sobre o MESMO feed. Compara thresholds, top-N, e mede hit rate de cada."
        actions={
          <div className="flex items-center gap-2">
            {enabled && winner && (
              <Pill accent={winner === "empate" ? "neutral" : "good"}>
                {winner === "empate" ? "Empate" : `Vence: Variante ${winner}`}
              </Pill>
            )}
            <Button size="sm" variant={enabled ? "ghost" : "primary"} onClick={() => setEnabled(!enabled)}>
              {enabled ? "Pausar" : "Ativar"}
            </Button>
            {(historyA.length > 0 || historyB.length > 0) && (
              <Button size="sm" variant="danger" onClick={() => confirm("Limpar histórico A/B?") && clear()}>
                Limpar
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <VariantCard
          label="A"
          config={configA}
          stats={statsA}
          pending={pendingA.length}
          isWinner={winner === "A"}
          onChangeConfig={setConfigA}
        />
        <VariantCard
          label="B"
          config={configB}
          stats={statsB}
          pending={pendingB.length}
          isWinner={winner === "B"}
          onChangeConfig={setConfigB}
        />
      </div>

      {enabled && (statsA.resolved < 5 && statsB.resolved < 5) && (
        <p className="text-[11px] text-neutral-500 mt-3">
          Aguardando ao menos 5 sinais resolvidos em cada variante para determinar vencedor (mínimo amostral).
        </p>
      )}

      {!enabled && (
        <p className="text-[11px] text-neutral-500 mt-3">
          Ative para começar a comparar. Variantes rodam em shadow mode — não afetam o agente principal.
        </p>
      )}
    </Card>
  );
});
ABTestPanel.displayName = "ABTestPanel";

interface VariantCardProps {
  label: string;
  config: { name: string; threshold: number; topNHit: number };
  stats: ReturnType<typeof computeVariantStats>;
  pending: number;
  isWinner: boolean;
  onChangeConfig: (patch: Partial<{ name: string; threshold: number; topNHit: number }>) => void;
}

const VariantCard = memo(({ label, config, stats, pending, isWinner, onChangeConfig }: VariantCardProps) => (
  <div className={`rounded-xl border p-3 ${isWinner ? "border-emerald-500/50 bg-emerald-950/15" : "border-neutral-800 bg-neutral-900/40"}`}>
    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
      <div className="flex items-center gap-2">
        <span className={`text-base font-bold ${isWinner ? "text-emerald-300" : "text-neutral-200"}`}>
          {isWinner ? "👑 " : ""}Variante {label}
        </span>
        <input
          value={config.name}
          onChange={(e) => onChangeConfig({ name: e.target.value })}
          className="bg-neutral-950 border border-neutral-700 rounded px-2 py-0.5 text-xs"
        />
      </div>
      <span className="text-[10px] text-neutral-500 font-mono">{pending} pending</span>
    </div>

    <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
      <label className="flex flex-col gap-1">
        <span className="text-[10px] text-neutral-500">Threshold</span>
        <input
          type="number"
          step={0.005}
          min={0.027}
          max={0.2}
          value={config.threshold}
          onChange={(e) => onChangeConfig({ threshold: Number(e.target.value) })}
          className="bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[10px] text-neutral-500">Top-N hit</span>
        <input
          type="number"
          min={1}
          max={18}
          value={config.topNHit}
          onChange={(e) => onChangeConfig({ topNHit: Math.max(1, Math.min(18, Number(e.target.value))) })}
          className="bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono"
        />
      </label>
    </div>

    <StatGrid cols={2}>
      <Stat
        label="Emitidos"
        value={String(stats.emitted)}
        sub={`${stats.resolved} resolvidos`}
      />
      <Stat
        label="Hits top-N"
        value={`${stats.hitTop} (${(stats.hitRateTop * 100).toFixed(1)}%)`}
        sub={`baseline ${(stats.baselineTop * 100).toFixed(1)}% · lift ${stats.liftTop.toFixed(2)}×`}
        accent={stats.liftTop > 1.1 ? "good" : stats.liftTop < 0.9 ? "bad" : "neutral"}
      />
    </StatGrid>
  </div>
));
VariantCard.displayName = "ABVariantCard";

export default ABTestPanel;
