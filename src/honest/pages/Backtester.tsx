import { memo, useMemo, useState } from "react";
import { useHonestStore } from "../lib/store";
import { listStrategies, runBacktest, runAllBacktests, type StrategyResult, type StrategyId } from "../lib/backtest";
import { HOUSE_EDGE } from "../lib/wheel";
import { Card, PageContainer, PageHeader, SectionHeader, Stat, StatGrid, Button, EmptyState } from "../components/ui";

const fmtMoney = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const Backtester = memo(() => {
  const spins = useHonestStore((s) => s.spins);
  const totalSpins = spins.length;
  const strategies = useMemo(() => listStrategies(), []);
  const [selectedId, setSelectedId] = useState<StrategyId>(strategies[0].id);
  const [running, setRunning] = useState<"single" | "all" | null>(null);
  const [singleResult, setSingleResult] = useState<StrategyResult | null>(null);
  const [allResults, setAllResults] = useState<StrategyResult[]>([]);
  const [stakeMultiplier, setStakeMultiplier] = useState(1);

  const runSingle = () => {
    setRunning("single");
    setTimeout(() => {
      try {
        const r = runBacktest(spins.map((s) => s.n), selectedId);
        setSingleResult(r);
      } finally {
        setRunning(null);
      }
    }, 20);
  };

  const runAll = () => {
    setRunning("all");
    setTimeout(() => {
      try {
        const rs = runAllBacktests(spins.map((s) => s.n));
        setAllResults(rs);
      } finally {
        setRunning(null);
      }
    }, 20);
  };

  return (
    <PageContainer>
      <PageHeader
        title="Backtester de Estratégias"
        subtitle="Roda cada estratégia sobre o histórico completo simulando treino contínuo do ensemble a cada rodada. Mostra PnL realizado por unidade de stake."
      />

      {totalSpins < 30 ? (
        <EmptyState
          icon="📊"
          title={`Histórico insuficiente (${totalSpins}/30)`}
          description="O backtest precisa de pelo menos 30 giros para reservar uma janela de warm-up do ensemble. Deixe o feed rodar mais um pouco."
        />
      ) : (
        <>
          <Card>
            <SectionHeader
              title="Escolha uma estratégia"
              subtitle={strategies.find((s) => s.id === selectedId)?.description}
              actions={
                <>
                  <select
                    value={selectedId}
                    onChange={(e) => setSelectedId(e.target.value as StrategyId)}
                    className="bg-neutral-950 border border-neutral-700 rounded-md px-2 py-1.5 text-sm min-w-48"
                  >
                    {strategies.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <Button variant="primary" onClick={runSingle} disabled={running !== null}>
                    {running === "single" ? "Rodando…" : "Rodar"}
                  </Button>
                  <Button variant="success" onClick={runAll} disabled={running !== null}>
                    {running === "all" ? "Rodando…" : "Rodar TODAS"}
                  </Button>
                  <label className="flex items-center gap-2 text-xs text-neutral-400">
                    Stake R$
                    <input
                      type="number"
                      value={stakeMultiplier}
                      onChange={(e) => setStakeMultiplier(Math.max(0.1, Number(e.target.value) || 1))}
                      min={0.1}
                      step={0.5}
                      className="bg-neutral-950 border border-neutral-700 rounded-md px-2 py-1 text-xs w-20 font-mono"
                    />
                  </label>
                </>
              }
            />
          </Card>

          {singleResult && (
            <Card>
              <SectionHeader title={singleResult.name} />
              <StatGrid cols={4}>
                <Stat label="Rodadas" value={String(singleResult.rounds)} />
                <Stat
                  label="Hits"
                  value={`${singleResult.hits} (${(singleResult.hitRate * 100).toFixed(1)}%)`}
                />
                <Stat
                  label="PnL"
                  value={fmtMoney(singleResult.totalPnL * stakeMultiplier)}
                  accent={singleResult.totalPnL >= 0 ? "good" : "bad"}
                  sub={`Apostado ${fmtMoney(singleResult.totalWagered * stakeMultiplier)}`}
                />
                <Stat
                  label="Borda realizada"
                  value={`${(singleResult.realizedEdge * 100).toFixed(2)}%`}
                  sub={`Esperada ${(singleResult.expectedEdge * 100).toFixed(2)}%`}
                  accent={singleResult.realizedEdge > singleResult.expectedEdge ? "good" : "bad"}
                />
              </StatGrid>
              <CurveChart curve={singleResult.curve} stake={stakeMultiplier} />
            </Card>
          )}

          {allResults.length > 0 && (
            <Card padding="sm">
              <SectionHeader
                title="Leaderboard — todas as estratégias"
                subtitle={`Ordenado por borda realizada. Esperado: todas convergem para −${(HOUSE_EDGE * 100).toFixed(2)}%.`}
              />
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-neutral-500">
                      <th className="p-2 font-medium">#</th>
                      <th className="p-2 font-medium">Estratégia</th>
                      <th className="p-2 font-medium">Rodadas</th>
                      <th className="p-2 font-medium">Hit %</th>
                      <th className="p-2 font-medium">Apostado</th>
                      <th className="p-2 font-medium">PnL</th>
                      <th className="p-2 font-medium">Borda</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...allResults]
                      .sort((a, b) => b.realizedEdge - a.realizedEdge)
                      .map((r, idx) => (
                        <tr key={r.id} className="border-t border-neutral-800 hover:bg-neutral-900/50">
                          <td className="p-2 font-mono text-neutral-500">{idx + 1}</td>
                          <td className="p-2 text-neutral-200">{r.name}</td>
                          <td className="p-2 font-mono text-neutral-400">{r.rounds}</td>
                          <td className="p-2 font-mono text-neutral-300">{(r.hitRate * 100).toFixed(1)}%</td>
                          <td className="p-2 font-mono text-neutral-400">{fmtMoney(r.totalWagered * stakeMultiplier)}</td>
                          <td className={`p-2 font-mono font-bold ${r.totalPnL >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                            {r.totalPnL >= 0 ? "+" : ""}
                            {fmtMoney(r.totalPnL * stakeMultiplier)}
                          </td>
                          <td
                            className={`p-2 font-mono ${
                              r.realizedEdge >= 0
                                ? "text-emerald-300"
                                : r.realizedEdge >= -HOUSE_EDGE
                                  ? "text-amber-300"
                                  : "text-red-300"
                            }`}
                          >
                            {(r.realizedEdge * 100).toFixed(2)}%
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </PageContainer>
  );
});
Backtester.displayName = "Backtester";

const CurveChart = memo(({ curve, stake }: { curve: number[]; stake: number }) => {
  if (curve.length < 2) return null;
  const W = 700;
  const H = 200;
  const scaled = curve.map((v) => v * stake);
  const lo = Math.min(0, ...scaled);
  const hi = Math.max(0, ...scaled);
  const range = Math.max(1, hi - lo);
  const x = (i: number) => (i / (scaled.length - 1)) * W;
  const y = (v: number) => H - ((v - lo) / range) * (H - 20) - 10;
  const path = scaled.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ");
  const zeroY = y(0);
  return (
    <div className="mt-4">
      <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Curva de PnL</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-neutral-950 rounded-lg border border-neutral-800">
        <line x1={0} x2={W} y1={zeroY} y2={zeroY} stroke="#525252" strokeDasharray="3 3" strokeWidth={1} />
        <text x={4} y={zeroY - 3} fill="#737373" fontSize="9">
          0
        </text>
        <path d={path} fill="none" stroke="#22d3ee" strokeWidth={1.5} />
      </svg>
    </div>
  );
});
CurveChart.displayName = "BacktestCurve";

export default Backtester;
