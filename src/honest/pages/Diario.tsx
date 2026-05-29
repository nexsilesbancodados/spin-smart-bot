import { memo, useMemo } from "react";
import { useHonestStore } from "../lib/store";
import { aggregateHistory } from "../lib/tilt";
import { buildEdgeSeries, computeOverallEdge } from "../lib/edgeMeter";
import { exportHistoryCsv, exportSpinsCsv } from "../lib/exportCsv";
import { HOUSE_EDGE } from "../lib/wheel";
import { Card, PageContainer, PageHeader, SectionHeader, Stat, StatGrid, Button, EmptyState } from "../components/ui";

const fmtMoney = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const fmtDate = (t: number) =>
  new Date(t).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

const fmtMinutes = (ms: number) => {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min}min`;
  return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`;
};

const Diario = memo(() => {
  const history = useHonestStore((s) => s.history);
  const spins = useHonestStore((s) => s.spins);
  const clearHistory = useHonestStore((s) => s.clearHistory);

  const agg = useMemo(() => aggregateHistory(history), [history]);
  const edge = useMemo(() => computeOverallEdge(history), [history]);
  const series = useMemo(() => buildEdgeSeries(history), [history]);

  return (
    <PageContainer>
      <PageHeader
        title="Diário de sessão"
        subtitle="Histórico permanente das sessões encerradas. Mede o que importa: respeito aos limites, não vitórias ocasionais."
        actions={
          <>
            <Button onClick={() => exportSpinsCsv(spins)} disabled={spins.length === 0}>
              Exportar giros
            </Button>
            <Button onClick={() => exportHistoryCsv(history)} disabled={history.length === 0}>
              Exportar diário
            </Button>
          </>
        }
      />

      {history.length === 0 ? (
        <EmptyState
          icon="📔"
          title="Nenhuma sessão encerrada ainda"
          description="Inicie e encerre uma sessão na página Banca para começar a registrar o diário."
          action={
            <a href="/banca" className="rv-btn rv-btn-primary">
              Ir para Banca
            </a>
          }
        />
      ) : (
        <>
          <StatGrid cols={4}>
            <Stat
              label="Sessões"
              value={String(agg.sessions)}
              sub={`${(agg.respectedRatio * 100).toFixed(0)}% respeitaram limites`}
            />
            <Stat
              label="PnL acumulado"
              value={fmtMoney(agg.totalPnL)}
              sub={`Total apostado ${fmtMoney(agg.totalWagered)}`}
              accent={agg.totalPnL >= 0 ? "good" : "bad"}
            />
            <Stat
              label="Pior / Melhor"
              value={fmtMoney(agg.worstLoss)}
              sub={`melhor: ${fmtMoney(agg.bestGain)}`}
              accent="bad"
            />
            <Stat
              label="Borda realizada"
              value={`${(edge.realizedEdge * 100).toFixed(2)}%`}
              sub={`Esperada: ${(edge.expectedEdge * 100).toFixed(2)}%`}
              accent={Math.abs(edge.realizedEdge - edge.expectedEdge) < 0.02 ? "warn" : "neutral"}
            />
          </StatGrid>

          <EdgeChart series={series} />

          <Card padding="sm">
            <SectionHeader
              title="Sessões encerradas"
              actions={
                <Button size="sm" variant="danger" onClick={() => confirm("Apagar TODO o diário?") && clearHistory()}>
                  Limpar diário
                </Button>
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-neutral-500 bg-neutral-900/80">
                    <th className="p-2 font-medium">Iniciada</th>
                    <th className="p-2 font-medium">Duração</th>
                    <th className="p-2 font-medium">Rodadas</th>
                    <th className="p-2 font-medium">Stake médio</th>
                    <th className="p-2 font-medium">PnL</th>
                    <th className="p-2 font-medium">Pior streak</th>
                    <th className="p-2 font-medium">Status</th>
                    <th className="p-2 font-medium">Limites</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => {
                    const dur = h.endedAt - h.startedAt;
                    const status = h.reachedTarget
                      ? { label: "Meta", color: "text-emerald-300" }
                      : h.reachedStop
                        ? { label: "Stop loss", color: "text-red-300" }
                        : h.reachedMaxRounds
                          ? { label: "Limite rodadas", color: "text-amber-300" }
                          : { label: "Encerrada", color: "text-neutral-300" };
                    return (
                      <tr key={h.id} className="border-t border-neutral-800 hover:bg-neutral-900/50">
                        <td className="p-2 font-mono text-neutral-300">{fmtDate(h.startedAt)}</td>
                        <td className="p-2 font-mono text-neutral-400">{fmtMinutes(dur)}</td>
                        <td className="p-2 font-mono text-neutral-300">{h.rounds}</td>
                        <td className="p-2 font-mono text-neutral-400">{fmtMoney(h.stakeAvg)}</td>
                        <td className={`p-2 font-mono font-bold ${h.pnl >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                          {h.pnl >= 0 ? "+" : ""}
                          {fmtMoney(h.pnl)}
                          <div className="text-[10px] font-normal opacity-70">
                            {h.pnlPct >= 0 ? "+" : ""}
                            {h.pnlPct.toFixed(1)}%
                          </div>
                        </td>
                        <td className="p-2 font-mono text-neutral-400">{h.worstStreak}</td>
                        <td className={`p-2 font-semibold ${status.color}`}>{status.label}</td>
                        <td className="p-2">
                          {h.respectedLimits ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-950/40 text-emerald-300 border border-emerald-700/40 text-[10px]">
                              respeitou
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-red-950/40 text-red-300 border border-red-700/40 text-[10px]">
                              ultrapassou
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </PageContainer>
  );
});
Diario.displayName = "Diario";

const EdgeChart = memo(({ series }: { series: ReturnType<typeof buildEdgeSeries> }) => {
  if (series.length < 2) return null;
  const W = 600;
  const H = 180;
  const minE = Math.min(-0.1, ...series.map((p) => p.realizedEdge));
  const maxE = Math.max(0.1, ...series.map((p) => p.realizedEdge));
  const range = maxE - minE;
  const x = (i: number) => (i / (series.length - 1)) * W;
  const y = (v: number) => H - ((v - minE) / range) * (H - 20) - 10;
  const path = series.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.realizedEdge)}`).join(" ");
  const expectedY = y(-HOUSE_EDGE);
  const zeroY = y(0);
  return (
    <Card>
      <SectionHeader
        title="Medidor de borda (EV realizado)"
        subtitle="Convergência para a vantagem da casa de −2,70% ao longo das sessões"
      />
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-neutral-950 rounded-lg border border-neutral-800">
        <line x1={0} x2={W} y1={zeroY} y2={zeroY} stroke="#525252" strokeDasharray="3 3" strokeWidth={1} />
        <line x1={0} x2={W} y1={expectedY} y2={expectedY} stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 2" />
        <text x={W - 4} y={expectedY - 4} textAnchor="end" fill="#f59e0b" fontSize="9">
          esperado −2,70%
        </text>
        <text x={W - 4} y={zeroY - 4} textAnchor="end" fill="#737373" fontSize="9">
          break-even 0%
        </text>
        <path d={path} fill="none" stroke="#22d3ee" strokeWidth={2} />
      </svg>
    </Card>
  );
});
EdgeChart.displayName = "EdgeChart";

export default Diario;
