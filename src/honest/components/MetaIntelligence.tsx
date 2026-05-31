import { memo, useMemo } from "react";
import { useEngineWeights, summarizeEngines } from "../lib/engineWeights";
import { summarizeLearning } from "../lib/patternLearning";
import { Card, SectionHeader, Pill } from "./ui";

const ENGINE_LABELS: Record<string, { icon: string; label: string }> = {
  "pattern-bank": { icon: "🧠", label: "Padrões aprendidos" },
  "unified-recency": { icon: "📈", label: "Recência ponderada" },
  "unified-markov": { icon: "🔗", label: "Markov 1+2" },
  "unified-agent": { icon: "🤖", label: "Agente IA (ensemble+LSTM)" },
  "gap-overdue": { icon: "⏳", label: "Atrasados (gap)" },
  "cycle-detect": { icon: "🔁", label: "Ciclos detectados" },
  "cross-lens": { icon: "✚", label: "Padrões cruzados" },
  ngram: { icon: "🧬", label: "N-gramas (3/4/5)" },
};

const MetaIntelligence = memo(() => {
  useEngineWeights((s) => s.stats);
  const summary = useMemo(() => summarizeEngines(), []);
  const learning = useMemo(() => summarizeLearning(), []);

  const groupRollup = useMemo(() => {
    const arr = Object.entries(learning.byGroup ?? {}).map(([group, s]) => ({
      group,
      hits: s.hits,
      attempts: s.attempts,
      rules: s.rules,
      rate: s.attempts > 0 ? s.hits / s.attempts : 0,
    }));
    arr.sort((a, b) => b.attempts - a.attempts);
    return arr.slice(0, 15);
  }, [learning]);

  return (
    <Card padding="sm">
      <SectionHeader
        title="🧠 Meta-Inteligência"
        eyebrow="Como os motores estão performando"
        subtitle={
          <span className="text-[10px] text-neutral-500">
            Pesos auto-ajustados pelo desempenho recente · {summary.length} motores rastreados
          </span>
        }
      />

      <div className="space-y-1 mb-3">
        {summary.map((s) => {
          const meta = ENGINE_LABELS[s.engine] ?? { icon: "•", label: s.engine };
          const accent =
            s.weight >= 1.15 ? "good" : s.weight >= 0.95 ? "warn" : "bad";
          return (
            <div
              key={s.engine}
              className="flex items-center gap-2 bg-neutral-900/50 rounded px-2 py-1.5 text-[11px]"
            >
              <span className="text-base shrink-0">{meta.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-neutral-200 truncate">{meta.label}</div>
                <div className="text-[9px] text-neutral-500 font-mono">
                  {s.hits}/{s.attempts} ({(s.rate * 100).toFixed(1)}%) · recente{" "}
                  {(s.recentRate * 100).toFixed(1)}%
                </div>
              </div>
              <Pill accent={accent}>peso {s.weight.toFixed(2)}×</Pill>
            </div>
          );
        })}
      </div>

      {groupRollup.length > 0 && (
        <>
          <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold mb-1">
            Famílias de padrões com mais amostras
          </div>
          <div className="space-y-0.5 max-h-64 overflow-y-auto">
            {groupRollup.map((g) => (
              <div
                key={g.group}
                className="flex items-center gap-2 text-[10px] bg-neutral-900/40 rounded px-2 py-1"
              >
                <span className="flex-1 truncate text-neutral-300">{g.group}</span>
                <span className="font-mono text-neutral-400 shrink-0">{g.rules} regras</span>
                <span className="font-mono text-neutral-400 shrink-0">
                  {g.hits}/{g.attempts}
                </span>
                <span
                  className={`font-mono shrink-0 font-bold ${
                    g.rate > 0.15 ? "text-amber-300" : "text-neutral-500"
                  }`}
                >
                  {(g.rate * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="text-[9px] text-neutral-600 italic mt-2 text-center">
        Motor com taxa de acerto recente alta ganha peso (até 1.6×). Motor falhando perde peso (até 0.5×).
        Não muda a vantagem da casa (2,7%).
      </div>
    </Card>
  );
});
MetaIntelligence.displayName = "MetaIntelligence";

export default MetaIntelligence;
