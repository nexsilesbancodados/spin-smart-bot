import { memo, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { generateSuggestions } from "../lib/suggestions";
import { useSignalAgent } from "../lib/signalAgent";
import { useHonestStore } from "../lib/store";
import { useEntryFilter } from "../lib/entryFilter";
import { Card, SectionHeader, Pill } from "./ui";

const priorityStyle = {
  high: "border-red-700/40 bg-red-950/20 text-red-100",
  medium: "border-amber-700/40 bg-amber-950/20 text-amber-100",
  low: "border-sky-700/40 bg-sky-950/20 text-sky-100",
};

const SmartSuggestions = memo(() => {
  const navigate = useNavigate();
  const agent = useSignalAgent((s) => s.history.length);
  const spins = useHonestStore((s) => s.spins.length);
  const filterEnabled = useEntryFilter((s) => s.enabled);

  const suggestions = useMemo(() => generateSuggestions(), [agent, spins, filterEnabled]);

  if (suggestions.length === 0) return null;

  return (
    <Card padding="sm">
      <SectionHeader title="💡 Sugestões inteligentes" subtitle="Recomendações baseadas no que o agente vê no momento" />
      <div className="space-y-2">
        {suggestions.map((s) => (
          <div key={s.id} className={`rounded-xl border p-3 ${priorityStyle[s.priority]}`}>
            <div className="flex items-start gap-2">
              <span className="text-lg shrink-0">{s.emoji}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-sm">{s.title}</span>
                  <Pill accent={s.priority === "high" ? "bad" : s.priority === "medium" ? "warn" : "info"}>
                    {s.priority}
                  </Pill>
                </div>
                <p className="text-xs opacity-90 leading-relaxed">{s.detail}</p>
                {s.action && (
                  <button
                    onClick={() => {
                      if (s.action!.route) navigate(s.action!.route);
                      if (s.action!.apply) s.action!.apply();
                    }}
                    className="mt-2 text-xs px-3 py-1 rounded-md bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-700"
                  >
                    {s.action.label} →
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
});
SmartSuggestions.displayName = "SmartSuggestions";
export default SmartSuggestions;
