import { memo, useMemo, useState } from "react";
import { useSignalAgent } from "../lib/signalAgent";
import { useBetTracker, computeTrackerStats } from "../lib/betTracker";
import { usePatternLearning, summarizeLearning } from "../lib/patternLearning";
import { useUiPrefs } from "../lib/uiPrefs";
import { SLOTS } from "../lib/wheel";
import { Card } from "./ui";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const RealityCheckBanner = memo(() => {
  const history = useSignalAgent((s) => s.history);
  const entries = useBetTracker((s) => s.entries);
  usePatternLearning((s) => s.totalLearned);
  const honestMode = useUiPrefs((s) => s.honestMode);
  const toggleHonestMode = useUiPrefs((s) => s.toggleHonestMode);
  const [expanded, setExpanded] = useState(false);

  const agentStats = useMemo(() => {
    const resolved = history.filter((s) => s.actualNumber !== null);
    if (resolved.length === 0)
      return { resolved: 0, hitTop5: 0, rateTop5: 0, hitMain: 0, rateMain: 0 };
    const hitTop5 = resolved.filter((s) => s.hitTop5).length;
    const hitMain = resolved.filter((s) => s.hitMain).length;
    return {
      resolved: resolved.length,
      hitTop5,
      hitMain,
      rateTop5: hitTop5 / resolved.length,
      rateMain: hitMain / resolved.length,
    };
  }, [history]);

  const trackerStats = useMemo(() => computeTrackerStats(entries), [entries]);
  const learning = useMemo(() => summarizeLearning(), [history.length, entries.length]);

  const baselineTop5 = 5 / SLOTS;
  const baselineMain = 1 / SLOTS;
  const liftTop5 = agentStats.rateTop5 / baselineTop5;
  const liftMain = agentStats.rateMain / baselineMain;
  const agentBeats = agentStats.resolved >= 30 && liftTop5 > 1.05;

  const trackerLoss = trackerStats.pnl < 0;
  const trackerNeutral = trackerStats.resolved < 5;

  return (
    <Card padding="sm" accent={agentBeats && !trackerLoss ? "neutral" : "warn"}>
      <div className="flex items-start gap-2 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">⚠</span>
            <span className="text-[11px] uppercase tracking-[0.18em] font-black text-amber-300">
              Reality Check
            </span>
            <button
              onClick={toggleHonestMode}
              className={`ml-auto text-[9px] px-2 py-0.5 rounded font-bold ${
                honestMode
                  ? "bg-emerald-700 text-white"
                  : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
              }`}
              title={honestMode ? "Modo honesto ON: previsões ocultas" : "Modo honesto OFF: previsões visíveis"}
            >
              {honestMode ? "🛡 honesto ON" : "honesto OFF"}
            </button>
          </div>

          <div className="text-[11px] text-neutral-300 leading-snug">
            Casa retém <b className="text-red-300">2,7% por giro</b>.
            Roleta é processo aleatório — nenhum padrão derrota a longo prazo.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-2 text-[10px]">
        <div className="bg-neutral-900/60 rounded p-1.5">
          <div className="text-[8px] text-neutral-500 uppercase tracking-wider font-bold">
            Agente top-5
          </div>
          <div className={`font-mono font-bold ${liftTop5 > 1.05 ? "text-emerald-300" : "text-red-300"}`}>
            {agentStats.resolved === 0
              ? "—"
              : `${agentStats.hitTop5}/${agentStats.resolved} = ${(agentStats.rateTop5 * 100).toFixed(1)}%`}
          </div>
          <div className="text-[8px] text-neutral-500">
            baseline {(baselineTop5 * 100).toFixed(1)}% · {liftTop5.toFixed(2)}×
          </div>
        </div>

        <div className="bg-neutral-900/60 rounded p-1.5">
          <div className="text-[8px] text-neutral-500 uppercase tracking-wider font-bold">
            Agente pleno
          </div>
          <div className={`font-mono font-bold ${liftMain > 1.05 ? "text-emerald-300" : "text-red-300"}`}>
            {agentStats.resolved === 0
              ? "—"
              : `${agentStats.hitMain}/${agentStats.resolved} = ${(agentStats.rateMain * 100).toFixed(1)}%`}
          </div>
          <div className="text-[8px] text-neutral-500">
            baseline {(baselineMain * 100).toFixed(1)}% · {liftMain.toFixed(2)}×
          </div>
        </div>

        <div className="bg-neutral-900/60 rounded p-1.5">
          <div className="text-[8px] text-neutral-500 uppercase tracking-wider font-bold">
            PnL real (tracker)
          </div>
          <div
            className={`font-mono font-bold ${
              trackerNeutral
                ? "text-neutral-400"
                : trackerStats.pnl >= 0
                ? "text-emerald-300"
                : "text-red-300"
            }`}
          >
            {trackerNeutral
              ? "—"
              : `${trackerStats.pnl >= 0 ? "+" : ""}${fmt(trackerStats.pnl)}`}
          </div>
          <div className="text-[8px] text-neutral-500">
            {trackerStats.resolved}n · ROI {(trackerStats.roi * 100).toFixed(1)}%
          </div>
        </div>

        <div className="bg-neutral-900/60 rounded p-1.5">
          <div className="text-[8px] text-neutral-500 uppercase tracking-wider font-bold">
            Padrões aprendidos
          </div>
          <div className="font-mono font-bold text-neutral-300">
            {learning.tracked}/{learning.bank}
          </div>
          <div className="text-[8px] text-neutral-500">
            acerto global {(learning.overallAccuracy * 100).toFixed(1)}%
          </div>
        </div>
      </div>

      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-[10px] text-neutral-500 hover:text-amber-300 text-center mt-2"
      >
        {expanded ? "▲ ocultar verdades" : "▼ ler verdades sobre roleta"}
      </button>

      {expanded && (
        <div className="mt-2 space-y-1.5 text-[11px] text-neutral-300 bg-neutral-950 rounded p-2 border border-neutral-800">
          <div>
            <b className="text-amber-300">1.</b> A roleta é justa o suficiente para que nenhuma sequência
            histórica tenha valor preditivo. O próximo giro é{" "}
            <b>independente</b> de todos os anteriores.
          </div>
          <div>
            <b className="text-amber-300">2.</b> Padrões que aparecem (vermelho 8× seguido, dúzia
            atrasada, terminal "puxando") são <b>variância natural</b>, não viés. Eles regridem para a
            média em amostra maior.
          </div>
          <div>
            <b className="text-amber-300">3.</b> A vantagem da casa (2,7%) garante que, no longo prazo,
            todas as estratégias têm EV negativo. <b>Toda</b>.
          </div>
          <div>
            <b className="text-amber-300">4.</b> "Acertei top-5" parece bom, mas baseline é 13,5%.
            Acertar 14% em 100 giros é estatisticamente equivalente a zero.
          </div>
          <div>
            <b className="text-amber-300">5.</b> Os sinais que este app gera servem para{" "}
            <b>descrever o que aconteceu</b>, não prever. Quando você aposta neles, está pagando 2,7%
            de imposto pra casa.
          </div>
          <div className="text-emerald-300 mt-2">
            <b>O que ajuda de verdade:</b> stop-loss firme, sessões curtas (≤30min), apostar
            só dinheiro que aceita perder, parar quando estiver acima.
          </div>
        </div>
      )}
    </Card>
  );
});
RealityCheckBanner.displayName = "RealityCheckBanner";

export default RealityCheckBanner;
