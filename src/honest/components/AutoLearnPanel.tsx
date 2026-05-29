import { memo } from "react";
import { useAutoTuner } from "../lib/autoTuner";
import { useSignalAgent } from "../lib/signalAgent";
import { Card, SectionHeader, Stat, StatGrid, Button, Pill } from "./ui";

const fmtAgo = (ms: number): string => {
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s atrás`;
  if (ms < 3600_000) return `${Math.floor(ms / 60_000)}min atrás`;
  return `${Math.floor(ms / 3600_000)}h atrás`;
};

const paramLabel = (p: string) => {
  switch (p) {
    case "threshold":
      return "Limiar";
    case "lstmWeight":
      return "Peso LSTM";
    case "ensembleWeight":
      return "Peso Ensemble";
    case "trainingWindow":
      return "Janela de treino";
    default:
      return p;
  }
};

const formatValue = (param: string, v: number): string => {
  if (param === "threshold") return `${(v * 100).toFixed(2)}%`;
  if (param.includes("Weight")) return v.toFixed(2);
  if (param === "trainingWindow") return `${v} giros`;
  return v.toFixed(2);
};

const AutoLearnPanel = memo(() => {
  const enabled = useAutoTuner((s) => s.enabled);
  const setEnabled = useAutoTuner((s) => s.setEnabled);
  const interval = useAutoTuner((s) => s.tuningInterval);
  const setInterval = useAutoTuner((s) => s.setInterval);
  const signalsRequired = useAutoTuner((s) => s.signalsRequired);
  const setSignalsRequired = useAutoTuner((s) => s.setSignalsRequired);
  const history = useAutoTuner((s) => s.history);
  const clear = useAutoTuner((s) => s.clearHistory);
  const agentConfig = useSignalAgent((s) => s.config);

  return (
    <Card accent={enabled ? "warn" : "neutral"}>
      <SectionHeader
        title="🧠 Auto-aprendizado"
        subtitle="Agente ajusta sozinho threshold, pesos e janela com base na performance recente."
        actions={
          <>
            <Pill accent={enabled ? "good" : "neutral"}>{enabled ? "ATIVO" : "PAUSADO"}</Pill>
            <Button size="sm" variant={enabled ? "ghost" : "primary"} onClick={() => setEnabled(!enabled)}>
              {enabled ? "Pausar" : "Ativar"}
            </Button>
          </>
        }
      />

      <StatGrid cols={4}>
        <Stat
          label="Limiar atual"
          value={`${(agentConfig.threshold * 100).toFixed(2)}%`}
          sub="auto-ajustado"
        />
        <Stat label="Peso ensemble" value={agentConfig.ensembleWeight.toFixed(2)} />
        <Stat label="Peso LSTM" value={agentConfig.lstmWeight.toFixed(2)} />
        <Stat label="Janela treino" value={`${agentConfig.trainingWindow}`} sub="giros" />
      </StatGrid>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <label className="flex items-center gap-2">
          <span className="text-neutral-400 shrink-0">Reavaliar a cada</span>
          <select
            value={interval}
            onChange={(e) => setInterval(Number(e.target.value))}
            className="bg-neutral-950 border border-neutral-700 rounded px-2 py-1"
            disabled={!enabled}
          >
            <option value={10}>10 sinais resolvidos</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-neutral-400 shrink-0">Mínimo de sinais</span>
          <select
            value={signalsRequired}
            onChange={(e) => setSignalsRequired(Number(e.target.value))}
            className="bg-neutral-950 border border-neutral-700 rounded px-2 py-1"
            disabled={!enabled}
          >
            <option value={20}>20</option>
            <option value={30}>30</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </label>
      </div>

      {history.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold">
              Últimos ajustes ({history.length})
            </span>
            <Button size="sm" variant="ghost" onClick={() => confirm("Limpar histórico de ajustes?") && clear()}>
              limpar
            </Button>
          </div>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {history.slice(0, 30).map((e, i) => (
              <div key={i} className="rounded-lg border border-neutral-800 bg-neutral-950/50 p-2">
                <div className="flex items-center justify-between text-xs mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-amber-300">{paramLabel(e.param)}</span>
                    <span className="font-mono text-neutral-400">
                      {formatValue(e.param, e.oldValue)} → {formatValue(e.param, e.newValue)}
                    </span>
                  </div>
                  <span className="text-[10px] text-neutral-500">{fmtAgo(Date.now() - e.t)}</span>
                </div>
                <p className="text-[11px] text-neutral-400 leading-snug">{e.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {history.length === 0 && enabled && (
        <p className="text-xs text-neutral-500 mt-3">
          Aguardando sinais resolvidos para começar a ajustar. Primeira avaliação após {signalsRequired} sinais.
        </p>
      )}
    </Card>
  );
});
AutoLearnPanel.displayName = "AutoLearnPanel";
export default AutoLearnPanel;
