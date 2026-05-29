import { memo, useMemo } from "react";
import { useEntryFilter, conditions } from "../lib/entryFilter";
import type { ConditionDefinition } from "../lib/entryFilter";
import { Card, PageContainer, PageHeader, SectionHeader, Stat, StatGrid, Button, Pill } from "../components/ui";

const categories = [
  { id: "agente" as const, label: "Filtros do Agente", subtitle: "Confiança e probabilidades do ensemble" },
  { id: "estatistica" as const, label: "Estatísticos", subtitle: "z-score, streak, gap, frequência" },
  { id: "mesa" as const, label: "Estado da Mesa", subtitle: "Drift de dealer, concentração de setor" },
  { id: "sessao" as const, label: "Sessão / Banca", subtitle: "Limites da sua sessão atual" },
];

const fmtParam = (def: ConditionDefinition, value: number): string => {
  if (def.paramSuffix === "%") return `${(value * 100).toFixed(1)}%`;
  return `${value}${def.paramSuffix ?? ""}`;
};

const Filtros = memo(() => {
  const filter = useEntryFilter();
  const stats = filter.stats;

  const grouped = useMemo(() => {
    return categories.map((cat) => ({
      ...cat,
      items: conditions.filter((c) => c.category === cat.id),
    }));
  }, []);

  const activeCount = filter.conditions.filter((c) => c.enabled).length;

  return (
    <PageContainer>
      <PageHeader
        title="Filtro Probabilístico"
        subtitle="A peça que decide quando NÃO emitir sinal. Bots sérios não acertam mais — eles entram menos. Ative só condições onde a entrada faz sentido; o agente fica em silêncio até todas baterem."
        actions={
          <>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={filter.enabled}
                onChange={(e) => filter.setEnabled(e.target.checked)}
                className="accent-amber-500"
              />
              Filtro ativo
            </label>
            <div className="inline-flex rounded-lg border border-neutral-700 overflow-hidden">
              <button
                onClick={() => filter.setCombinator("AND")}
                className={`px-3 py-1.5 text-xs font-semibold ${
                  filter.combinator === "AND" ? "bg-amber-500 text-black" : "bg-neutral-900 text-neutral-300"
                }`}
              >
                AND
              </button>
              <button
                onClick={() => filter.setCombinator("OR")}
                className={`px-3 py-1.5 text-xs font-semibold ${
                  filter.combinator === "OR" ? "bg-amber-500 text-black" : "bg-neutral-900 text-neutral-300"
                }`}
              >
                OR
              </button>
            </div>
          </>
        }
      />

      <StatGrid cols={4}>
        <Stat label="Candidatos" value={String(stats.candidates)} sub="emitidos pelo agente" />
        <Stat
          label="Passaram filtro"
          value={`${stats.passes} (${(stats.passRate * 100).toFixed(0)}%)`}
          sub={`${activeCount} condições ativas`}
        />
        <Stat
          label="Hits"
          value={String(stats.hits)}
          sub={`${(stats.hitRate * 100).toFixed(1)}% dos que passaram`}
          accent={stats.hitRate > 0.135 ? "good" : "neutral"}
        />
        <Stat
          label="Baseline top-5"
          value="13,5%"
          sub="acaso. Compare com hit rate."
        />
      </StatGrid>

      {grouped.map((cat) => (
        <div key={cat.id} className="space-y-3">
          <div className="flex items-baseline gap-3">
            <h2 className="text-base font-semibold tracking-tight text-neutral-100">{cat.label}</h2>
            <span className="text-xs text-neutral-400">{cat.subtitle}</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {cat.items.map((def) => {
              const cond = filter.conditions.find((c) => c.id === def.id);
              if (!cond) return null;
              return (
                <ConditionCard
                  key={def.id}
                  def={def}
                  enabled={cond.enabled}
                  param={cond.param}
                  onToggle={() => filter.toggle(def.id)}
                  onParamChange={(p) => filter.setParam(def.id, p)}
                />
              );
            })}
          </div>
        </div>
      ))}

      <div className="flex items-center gap-3 flex-wrap">
        <Button size="sm" variant="ghost" onClick={() => confirm("Zerar estatísticas do filtro?") && filter.resetStats()}>
          Zerar stats
        </Button>
        <span className="text-[11px] text-neutral-500 max-w-xl">
          Sugestão: confiança ≥ 45%, histórico mínimo 60, sem drift de dealer. Cada condição reduz frequência mas
          deve aumentar hit rate.
        </span>
      </div>
    </PageContainer>
  );
});
Filtros.displayName = "Filtros";

interface ConditionCardProps {
  def: ConditionDefinition;
  enabled: boolean;
  param: number;
  onToggle: () => void;
  onParamChange: (p: number) => void;
}

const ConditionCard = memo(({ def, enabled, param, onToggle, onParamChange }: ConditionCardProps) => (
  <Card accent={enabled ? "warn" : "neutral"} padding="sm">
    <div className="flex items-start justify-between gap-3">
      <label className="flex items-start gap-2 cursor-pointer flex-1">
        <input
          type="checkbox"
          checked={enabled}
          onChange={onToggle}
          className="accent-amber-500 mt-0.5"
        />
        <div>
          <div className="text-sm font-semibold">{def.label}</div>
          <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">{def.description}</p>
        </div>
      </label>
      {enabled && <Pill accent="warn">{fmtParam(def, param)}</Pill>}
    </div>
    {enabled && (
      <div className="mt-3 pt-3 border-t border-neutral-800/60 flex items-center gap-3">
        <span className="text-[11px] text-neutral-400 shrink-0">{def.paramLabel}</span>
        <input
          type="range"
          min={def.paramMin}
          max={def.paramMax}
          step={def.paramStep}
          value={param}
          onChange={(e) => onParamChange(Number(e.target.value))}
          className="flex-1 accent-amber-500"
        />
        <span className="text-xs font-mono text-amber-300 w-16 text-right">{fmtParam(def, param)}</span>
      </div>
    )}
  </Card>
));
ConditionCard.displayName = "ConditionCard";

void SectionHeader;
export default Filtros;
