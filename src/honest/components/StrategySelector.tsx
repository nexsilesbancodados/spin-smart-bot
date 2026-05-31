import { memo } from "react";
import { useUiPrefs, BetScope } from "../lib/uiPrefs";
import { Card, SectionHeader, Pill } from "./ui";

interface StrategyMeta {
  id: BetScope;
  icon: string;
  name: string;
  payout: string;
  coverage: string;
}

const STRATEGIES: StrategyMeta[] = [
  { id: "color", icon: "🔴⚫", name: "Cor", payout: "1:1", coverage: "18 nº" },
  { id: "dozen", icon: "1️⃣2️⃣3️⃣", name: "Dúzia", payout: "2:1", coverage: "12 nº" },
  { id: "parity", icon: "♟♙", name: "Par/Ímpar", payout: "1:1", coverage: "18 nº" },
  { id: "highlow", icon: "🔼🔽", name: "Alto/Baixo", payout: "1:1", coverage: "18 nº" },
  { id: "column", icon: "🟦🟪🟩", name: "Coluna", payout: "2:1", coverage: "12 nº" },
  { id: "sector", icon: "🌀", name: "Setor (Voisins/Tiers/Orphelins)", payout: "~2:1", coverage: "8-17 nº" },
  { id: "terminal", icon: "🔢", name: "Terminal (finais)", payout: "~9:1", coverage: "3-4 nº" },
  { id: "neighbors", icon: "🎰", name: "Vizinhos físicos", payout: "~6:1", coverage: "5-9 nº" },
  { id: "number", icon: "🎲", name: "Número (combinações)", payout: "varia", coverage: "2-6 nº" },
  { id: "pleno", icon: "🎯", name: "Pleno (1 nº)", payout: "35:1", coverage: "1 nº" },
];

const PRESETS: Array<{ id: string; label: string; scope: BetScope[] }> = [
  {
    id: "all",
    label: "Todas",
    scope: STRATEGIES.map((s) => s.id),
  },
  {
    id: "cobertura",
    label: "Só alta cobertura (1:1 + 2:1)",
    scope: ["color", "parity", "highlow", "dozen", "column", "sector"],
  },
  {
    id: "even-money",
    label: "Só 1:1 (cor / par / alto)",
    scope: ["color", "parity", "highlow"],
  },
  {
    id: "2-1",
    label: "Só 2:1 (dúzia / coluna)",
    scope: ["dozen", "column"],
  },
  {
    id: "color-only",
    label: "Só cor",
    scope: ["color"],
  },
  {
    id: "none",
    label: "Nenhuma",
    scope: [],
  },
];

const StrategySelector = memo(() => {
  const focusedScope = useUiPrefs((s) => s.focusedScope);
  const toggleScope = useUiPrefs((s) => s.toggleScope);
  const setFocusedScope = useUiPrefs((s) => s.setFocusedScope);

  const activeCount = focusedScope.length;
  const totalCount = STRATEGIES.length;

  return (
    <Card padding="sm">
      <SectionHeader
        title="🎯 Estratégias Ativas"
        eyebrow="Quais tipos de sinal você quer receber"
        subtitle={
          <span className="text-[10px] text-neutral-500">
            Filtra o que aparece no MasterSignal E o que vai pro Discord/Telegram.
            Mude a qualquer momento — sem reload.
          </span>
        }
        actions={
          <Pill accent={activeCount === 0 ? "bad" : activeCount === totalCount ? "good" : "warn"}>
            {activeCount}/{totalCount} ativas
          </Pill>
        }
      />

      <div className="mb-2">
        <div className="text-[9px] uppercase tracking-wider text-neutral-500 font-bold mb-1">
          Presets rápidos
        </div>
        <div className="flex flex-wrap gap-1">
          {PRESETS.map((preset) => {
            const isActive =
              preset.scope.length === focusedScope.length &&
              preset.scope.every((s) => focusedScope.includes(s));
            return (
              <button
                key={preset.id}
                onClick={() => setFocusedScope(preset.scope)}
                className={`px-2 py-1 rounded text-[10px] font-bold transition ${
                  isActive
                    ? "bg-amber-500 text-black"
                    : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1">
        {STRATEGIES.map((s) => {
          const active = focusedScope.includes(s.id);
          return (
            <button
              key={s.id}
              onClick={() => toggleScope(s.id)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded border text-left transition ${
                active
                  ? "bg-emerald-950/30 border-emerald-700/50 hover:bg-emerald-950/50"
                  : "bg-neutral-900/40 border-neutral-800 hover:bg-neutral-900/70"
              }`}
            >
              <span className={`text-[14px] w-6 text-center shrink-0 ${active ? "" : "grayscale opacity-60"}`}>
                {active ? "✓" : "○"}
              </span>
              <span className="text-base shrink-0">{s.icon}</span>
              <div className="flex-1 min-w-0">
                <div className={`text-[11px] font-bold truncate ${active ? "text-emerald-200" : "text-neutral-400"}`}>
                  {s.name}
                </div>
                <div className="text-[9px] text-neutral-500 font-mono">
                  paga {s.payout} · cobre {s.coverage}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="text-[9px] text-neutral-600 italic mt-2 text-center leading-snug">
        Apostas de baixa cobertura (terminal/vizinhos/pleno) acertam menos vezes mas pagam mais.
        Casa retém 2,7% sobre todas — escolher tipo muda a forma de perder, não o resultado.
      </div>
    </Card>
  );
});
StrategySelector.displayName = "StrategySelector";

export default StrategySelector;
