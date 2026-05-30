import { memo, useMemo, useState } from "react";
import { useHonestStore } from "../lib/store";
import { computeBotEnsemble } from "../lib/botEnsemble";
import { patternBankSize } from "../lib/patternBank";
import { useAutoDiscovery } from "../lib/autoDiscovery";
import { Card, SectionHeader, Pill } from "./ui";

const BotEnsembleStatus = memo(() => {
  const spins = useHonestStore((s) => s.spins);
  const autoDiscoveredCount = useAutoDiscovery((s) => s.totalDiscovered);
  const [expanded, setExpanded] = useState(false);

  const history = useMemo(() => spins.map((s) => s.n), [spins]);
  const ensemble = useMemo(() => computeBotEnsemble(history), [history]);
  const bankSize = patternBankSize();

  return (
    <Card padding="sm">
      <SectionHeader
        title={
          <span className="flex items-center gap-2">
            🤖 Exército de Bots Especialistas
            <Pill accent="good">{ensemble.totalActiveBots} ativos agora</Pill>
          </span>
        }
        eyebrow="Cada regra é um bot independente · grupo por tipo de aposta · consenso interno"
        subtitle={
          <span className="text-[10px] text-neutral-500">
            {bankSize} bots no banco · {autoDiscoveredCount} auto-aprendidos dinamicamente ·{" "}
            {ensemble.totalValidatedBots} validados (Wilson &gt; baseline ×1.15 + ≥8 amostras)
          </span>
        }
      />

      {ensemble.overallWinner && (
        <div className="rounded-xl border-2 border-amber-500/60 bg-gradient-to-br from-amber-950/40 to-neutral-950 p-2.5 mb-2">
          <div className="text-[9px] uppercase tracking-[0.18em] text-amber-400 font-bold text-center mb-1">
            Consenso geral: especialidade dominante
          </div>
          <div className="text-center">
            <span className="text-2xl font-black text-white">
              {ensemble.overallWinner.vote.targetLabel}
            </span>
            <div className="text-[10px] text-neutral-400 mt-1">
              {ensemble.overallWinner.vote.botCount} bots da família{" "}
              <b className="text-amber-300">{ensemble.overallWinner.specialty}</b> concordam ·
              precisão ponderada {(ensemble.overallWinner.vote.weightedAccuracy * 100).toFixed(1)}%
              vs baseline {(ensemble.overallWinner.vote.baseline * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      )}

      <div className="space-y-1">
        {ensemble.specialties
          .filter((s) => expanded || s.totalBots > 0)
          .map((s) => {
            const hasConsensus = !!s.consensus;
            const accent: "good" | "warn" | "neutral" | "bad" =
              !hasConsensus
                ? "neutral"
                : s.validatedBots >= 3 && s.consensus!.weightedAccuracy > s.consensus!.baseline * 1.15
                ? "good"
                : s.consensus!.weightedAccuracy > s.consensus!.baseline
                ? "warn"
                : "bad";
            return (
              <div
                key={s.specialty}
                className={`bg-neutral-900/50 rounded px-2 py-1.5 border ${
                  accent === "good"
                    ? "border-emerald-700/40"
                    : accent === "warn"
                    ? "border-amber-700/30"
                    : "border-neutral-800"
                }`}
              >
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-base shrink-0">{s.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-neutral-200 truncate">{s.name}</div>
                    {hasConsensus ? (
                      <div className="text-[9px] text-neutral-500 truncate">
                        <span className="text-emerald-300 font-bold">{s.consensus!.targetLabel}</span>{" "}
                        ← consenso de {s.consensus!.botCount} bots ·{" "}
                        {(s.consensus!.weightedAccuracy * 100).toFixed(1)}% vs base{" "}
                        {(s.consensus!.baseline * 100).toFixed(1)}%
                      </div>
                    ) : (
                      <div className="text-[9px] text-neutral-600 italic">sem ativação no momento</div>
                    )}
                  </div>
                  <div className="text-right shrink-0 font-mono">
                    <div className="text-[10px] text-neutral-400 font-bold">{s.totalBots}</div>
                    <div className="text-[9px] text-neutral-600">{s.validatedBots} val.</div>
                  </div>
                  {hasConsensus && (
                    <Pill accent={accent}>
                      {s.consensus!.weight.toFixed(2)}
                    </Pill>
                  )}
                </div>
              </div>
            );
          })}
      </div>

      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-[10px] text-neutral-500 hover:text-amber-300 text-center mt-2"
      >
        {expanded ? "▲ ocultar especialidades inativas" : "▼ mostrar todas as 10 especialidades"}
      </button>

      <div className="text-[9px] text-neutral-600 italic mt-2 text-center leading-snug">
        Cada "bot" é uma regra estatística com Wilson lower bound próprio. Consenso = soma de
        votos ponderados (peso = acurácia × tamanho da amostra). Casa retém 2,7%.
      </div>
    </Card>
  );
});
BotEnsembleStatus.displayName = "BotEnsembleStatus";

export default BotEnsembleStatus;
