import { memo } from "react";
import { useSignalAgent } from "../lib/signalAgent";
import { useEntryFilter } from "../lib/entryFilter";
import { Card, SectionHeader } from "./ui";

type PresetId = "conservador" | "balanceado" | "agressivo";

interface Preset {
  id: PresetId;
  label: string;
  emoji: string;
  description: string;
  threshold: number;
  dynamicThreshold: boolean;
  signalsExpected: string;
  filterPreset: Record<string, { enabled: boolean; param: number }>;
}

const PRESETS: Preset[] = [
  {
    id: "conservador",
    label: "Conservador",
    emoji: "🛡",
    description: "Poucos sinais, alta confiança. Filtros rígidos.",
    threshold: 0.065,
    dynamicThreshold: true,
    signalsExpected: "~1-3 por hora",
    filterPreset: {
      "min-history": { enabled: true, param: 30 },
      "agent-confidence-min": { enabled: true, param: 0.5 },
      "agent-mainprob-min": { enabled: true, param: 0.065 },
      "model-min-contributors": { enabled: true, param: 3 },
    },
  },
  {
    id: "balanceado",
    label: "Balanceado",
    emoji: "⚖",
    description: "Padrão recomendado. Equilíbrio entre frequência e confiança.",
    threshold: 0.045,
    dynamicThreshold: true,
    signalsExpected: "~5-10 por hora",
    filterPreset: {
      "min-history": { enabled: true, param: 20 },
      "agent-confidence-min": { enabled: false, param: 0.35 },
      "agent-mainprob-min": { enabled: false, param: 0.045 },
      "model-min-contributors": { enabled: false, param: 2 },
    },
  },
  {
    id: "agressivo",
    label: "Agressivo",
    emoji: "🔥",
    description: "Muitos sinais. Mais ruído, mais oportunidade.",
    threshold: 0.032,
    dynamicThreshold: false,
    signalsExpected: "~15-30 por hora",
    filterPreset: {
      "min-history": { enabled: true, param: 10 },
      "agent-confidence-min": { enabled: false, param: 0.25 },
      "agent-mainprob-min": { enabled: false, param: 0.032 },
      "model-min-contributors": { enabled: false, param: 2 },
    },
  },
];

const StrategyPresets = memo(() => {
  const config = useSignalAgent((s) => s.config);
  const setConfig = useSignalAgent((s) => s.setConfig);

  const currentPreset: PresetId | null = (() => {
    for (const p of PRESETS) {
      if (Math.abs(p.threshold - config.threshold) < 0.002) return p.id;
    }
    return null;
  })();

  const apply = (preset: Preset) => {
    setConfig({
      threshold: preset.threshold,
      dynamicThreshold: preset.dynamicThreshold,
    });
    const filterState = useEntryFilter.getState();
    useEntryFilter.setState({
      enabled: true,
      conditions: filterState.conditions.map((c) => {
        const d = preset.filterPreset[c.id];
        return d ? { ...c, enabled: d.enabled, param: d.param } : c;
      }),
    });
  };

  return (
    <Card padding="sm">
      <SectionHeader
        title="Perfil do agente"
        eyebrow="Estratégia"
        subtitle={
          <span className="text-[10px] text-neutral-500">
            Threshold atual: {(config.threshold * 100).toFixed(2)}% ·{" "}
            {config.dynamicThreshold ? "dinâmico" : "fixo"}
          </span>
        }
      />

      <div className="grid grid-cols-3 gap-1.5">
        {PRESETS.map((p) => {
          const isActive = currentPreset === p.id;
          return (
            <button
              key={p.id}
              onClick={() => apply(p)}
              className={`rounded-lg p-2 text-left transition border ${
                isActive
                  ? "bg-amber-500 text-black border-amber-400 shadow-md shadow-amber-500/30"
                  : "bg-neutral-900 text-neutral-300 border-neutral-700 hover:border-neutral-500"
              }`}
            >
              <div className="text-base font-black leading-none">
                {p.emoji} <span className="text-xs uppercase tracking-wider">{p.label}</span>
              </div>
              <div className={`text-[10px] mt-1 leading-snug ${isActive ? "text-black/80" : "text-neutral-400"}`}>
                {p.description}
              </div>
              <div className={`text-[9px] mt-1 font-mono ${isActive ? "text-black/70" : "text-neutral-500"}`}>
                threshold {(p.threshold * 100).toFixed(2)}% · {p.signalsExpected}
              </div>
            </button>
          );
        })}
      </div>

      <div className="text-[9px] text-neutral-600 italic mt-2 text-center">
        Auto-throttle por calibração continua ativo sobre qualquer preset.
      </div>
    </Card>
  );
});
StrategyPresets.displayName = "StrategyPresets";

export default StrategyPresets;
