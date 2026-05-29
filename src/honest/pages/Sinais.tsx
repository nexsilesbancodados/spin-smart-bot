import { memo, useMemo } from "react";
import { useSignalAgent, computeAgentStats } from "../lib/signalAgent";
import { colorOf } from "../lib/wheel";
import SignalPanel from "../components/SignalPanel";
import AutoLearnPanel from "../components/AutoLearnPanel";
import BetTypePanel from "../components/BetTypePanel";
import { Card, PageContainer, PageHeader, SectionHeader, Stat, StatGrid, Button, EmptyState } from "../components/ui";
import { exportSignalsCsv } from "../lib/exportSignals";

const ballBg = (n: number) => {
  const c = colorOf(n);
  if (c === "green") return "bg-emerald-600";
  if (c === "red") return "bg-red-600";
  return "bg-neutral-800";
};

const Sinais = memo(() => {
  const history = useSignalAgent((s) => s.history);
  const clearHistory = useSignalAgent((s) => s.clearHistory);
  const config = useSignalAgent((s) => s.config);
  const setConfig = useSignalAgent((s) => s.setConfig);
  const stats = useMemo(() => computeAgentStats(history), [history]);

  return (
    <PageContainer>
      <PageHeader
        title="Sinais do Agente"
        subtitle="Histórico de todos os sinais emitidos pelo agente (ensemble + LSTM), com resolução automática quando o próximo giro chega."
      />

      <SignalPanel />

      <BetTypePanel />

      <AutoLearnPanel />

      <Card>
        <SectionHeader title="Configuração avançada" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <NumField
            label="Limiar de confiança"
            value={config.threshold}
            min={0.028}
            max={0.2}
            step={0.005}
            onChange={(v) => setConfig({ threshold: v })}
            format={(v) => `${(v * 100).toFixed(1)}%`}
          />
          <NumField
            label="Janela de treino"
            value={config.trainingWindow}
            min={30}
            max={1000}
            step={20}
            onChange={(v) => setConfig({ trainingWindow: v })}
            format={(v) => `${v} giros`}
          />
          <NumField
            label="Peso ensemble"
            value={config.ensembleWeight}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => setConfig({ ensembleWeight: v })}
            format={(v) => v.toFixed(2)}
          />
          <NumField
            label="Peso LSTM"
            value={config.lstmWeight}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => setConfig({ lstmWeight: v })}
            format={(v) => v.toFixed(2)}
          />
        </div>
      </Card>

      <StatGrid cols={4}>
        <Stat label="Total emitidos" value={String(stats.totalSignals)} sub={`${stats.resolved} resolvidos`} />
        <Stat
          label="Hit top-1 (exato)"
          value={`${(stats.mainHitRate * 100).toFixed(2)}%`}
          sub={`Esperado: ${(stats.baselineMain * 100).toFixed(2)}%`}
          accent={stats.mainHitRate > stats.baselineMain * 1.2 ? "good" : "neutral"}
        />
        <Stat
          label="Hit top-5"
          value={`${(stats.top5HitRate * 100).toFixed(2)}%`}
          sub={`Esperado: ${(stats.baselineTop5 * 100).toFixed(2)}%`}
          accent={stats.top5HitRate > stats.baselineTop5 * 1.2 ? "good" : "neutral"}
        />
        <Stat
          label="Vantagem realizada"
          value={`${((stats.mainHitRate - stats.baselineMain) * 100).toFixed(2)}pp`}
          sub="acima/abaixo do acaso"
          accent={stats.mainHitRate > stats.baselineMain ? "good" : "bad"}
        />
      </StatGrid>

      <Card>
        <SectionHeader
          title="Calibração por faixa de confiança"
          subtitle="Se o agente está bem calibrado, sinais de confiança X devem acertar próximo de X×baseline."
        />
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-neutral-500">
              <th className="p-1.5 font-medium">Faixa</th>
              <th className="p-1.5 font-medium">Sinais</th>
              <th className="p-1.5 font-medium">Hits top-1</th>
              <th className="p-1.5 font-medium">Taxa top-1</th>
              <th className="p-1.5 font-medium">Hits top-5</th>
              <th className="p-1.5 font-medium">Taxa top-5</th>
            </tr>
          </thead>
          <tbody>
            {stats.byConfidenceBucket.map((b) => (
              <tr key={b.low} className="border-t border-neutral-800">
                <td className="p-1.5 font-mono text-neutral-300">
                  {(b.low * 100).toFixed(0)}–{(Math.min(b.high, 1) * 100).toFixed(0)}%
                </td>
                <td className="p-1.5 font-mono text-neutral-200">{b.count}</td>
                <td className="p-1.5 font-mono text-emerald-300">{b.mainHits}</td>
                <td className="p-1.5 font-mono">{b.count > 0 ? `${((b.mainHits / b.count) * 100).toFixed(1)}%` : "—"}</td>
                <td className="p-1.5 font-mono text-sky-300">{b.top5Hits}</td>
                <td className="p-1.5 font-mono">{b.count > 0 ? `${((b.top5Hits / b.count) * 100).toFixed(1)}%` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card padding="sm">
        <SectionHeader
          title={`Histórico (${history.length})`}
          actions={
            history.length > 0 && (
              <>
                <Button size="sm" onClick={() => exportSignalsCsv(history)}>
                  Exportar CSV
                </Button>
                <Button size="sm" variant="danger" onClick={() => confirm("Limpar TODO o histórico?") && clearHistory()}>
                  Limpar
                </Button>
              </>
            )
          }
        />
        {history.length === 0 ? (
          <EmptyState
            icon="🎯"
            title="Nenhum sinal emitido ainda"
            description="Mantenha o agente ativo e o histórico popula automaticamente conforme o feed envia giros e o filtro libera."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-left text-neutral-500 bg-neutral-900/80">
                  <th className="p-2 font-medium">Hora</th>
                  <th className="p-2 font-medium">Pick</th>
                  <th className="p-2 font-medium">Prob</th>
                  <th className="p-2 font-medium">Top 5</th>
                  <th className="p-2 font-medium">Conf.</th>
                  <th className="p-2 font-medium">Saiu</th>
                  <th className="p-2 font-medium">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 200).map((s) => (
                  <tr key={s.id} className="border-t border-neutral-800 hover:bg-neutral-900/50">
                    <td className="p-2 font-mono text-neutral-400">{new Date(s.t).toLocaleTimeString("pt-BR")}</td>
                    <td className="p-2">
                      <div
                        className={`${ballBg(s.mainPick)} text-white text-[10px] font-bold w-6 h-6 rounded flex items-center justify-center`}
                      >
                        {s.mainPick}
                      </div>
                    </td>
                    <td className="p-2 font-mono text-amber-300">{(s.mainProb * 100).toFixed(1)}%</td>
                    <td className="p-2">
                      <div className="flex gap-0.5">
                        {s.topPicks.map((n) => (
                          <div
                            key={`${s.id}-${n}`}
                            className={`${ballBg(n)} text-white text-[8px] font-bold w-4 h-4 rounded-sm flex items-center justify-center`}
                          >
                            {n}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="p-2 font-mono text-neutral-400">{(s.confidenceScore * 100).toFixed(0)}</td>
                    <td className="p-2">
                      {s.actualNumber !== null ? (
                        <div
                          className={`${ballBg(s.actualNumber)} text-white text-[10px] font-bold w-6 h-6 rounded flex items-center justify-center`}
                        >
                          {s.actualNumber}
                        </div>
                      ) : (
                        <span className="text-neutral-500">⏳</span>
                      )}
                    </td>
                    <td className="p-2">
                      {s.hitMain ? (
                        <span className="text-emerald-300 font-bold">EXATO</span>
                      ) : s.hitTop5 ? (
                        <span className="text-sky-300">Top 5</span>
                      ) : s.actualNumber !== null ? (
                        <span className="text-red-300/70">Erro</span>
                      ) : (
                        <span className="text-neutral-500">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </PageContainer>
  );
});
Sinais.displayName = "Sinais";

const NumField = memo(
  ({
    label,
    value,
    onChange,
    min,
    max,
    step,
    format,
  }: {
    label: string;
    value: number;
    onChange: (v: number) => void;
    min: number;
    max: number;
    step: number;
    format?: (v: number) => string;
  }) => (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="range"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 accent-amber-500"
        />
        <span className="text-xs font-mono text-amber-300 w-16 text-right">{format ? format(value) : value.toFixed(2)}</span>
      </div>
    </label>
  )
);
NumField.displayName = "SinaisNumField";

export default Sinais;
