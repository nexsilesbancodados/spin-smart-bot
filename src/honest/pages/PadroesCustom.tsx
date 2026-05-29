import { memo, useMemo, useState, useEffect } from "react";
import { useHonestStore } from "../lib/store";
import {
  type PatternRule,
  type Feature,
  features,
  possibleValues,
  evaluateRule,
  defaultRules,
} from "../lib/customPatterns";
import { Card, PageContainer, PageHeader, Stat, StatGrid, Button, EmptyState, Pill } from "../components/ui";

const STORAGE_KEY = "rv-custom-patterns-v1";

const loadRules = (): PatternRule[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as PatternRule[];
  } catch {
    /* noop */
  }
  return defaultRules;
};

const newRule = (): PatternRule => ({
  id: `r_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
  name: "Regra nova",
  triggerFeature: "color",
  triggerValue: "red",
  triggerStreak: 2,
  expectFeature: "color",
  expectValue: "black",
  enabled: true,
});

const PadroesCustom = memo(() => {
  const spins = useHonestStore((s) => s.spins.map((x) => x.n));
  const [rules, setRules] = useState<PatternRule[]>(loadRules);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
  }, [rules]);

  const evaluations = useMemo(() => rules.map((r) => evaluateRule(r, spins)), [rules, spins]);

  const update = (idx: number, patch: Partial<PatternRule>) =>
    setRules((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  const remove = (idx: number) => setRules((prev) => prev.filter((_, i) => i !== idx));

  const add = () => setRules((prev) => [...prev, newRule()]);

  return (
    <PageContainer>
      <PageHeader
        title="Padrões customizáveis"
        subtitle='Defina gatilhos do tipo "X repetiu N vezes → próximo deve ser Y". O app mede no histórico atual a taxa de acerto e compara com a chance teórica (z-score).'
        actions={
          <Button variant="primary" onClick={add}>
            + Nova regra
          </Button>
        }
      />

      {rules.length === 0 ? (
        <EmptyState
          icon="📐"
          title="Nenhuma regra criada"
          description="Crie regras para testar hipóteses do tipo 'após X acontecer, espero Y'. Cada regra mede a si mesma no histórico real."
          action={<Button variant="primary" onClick={add}>Criar primeira regra</Button>}
        />
      ) : (
        <div className="space-y-3">
          {evaluations.map((ev, i) => (
            <RuleCard
              key={ev.rule.id}
              rule={ev.rule}
              eval={ev}
              onChange={(patch) => update(i, patch)}
              onRemove={() => remove(i)}
            />
          ))}
        </div>
      )}
    </PageContainer>
  );
});
PadroesCustom.displayName = "PadroesCustom";

interface RuleCardProps {
  rule: PatternRule;
  eval: ReturnType<typeof evaluateRule>;
  onChange: (patch: Partial<PatternRule>) => void;
  onRemove: () => void;
}

const RuleCard = memo(({ rule, eval: ev, onChange, onRemove }: RuleCardProps) => {
  const trigVals = possibleValues(rule.triggerFeature);
  const expVals = possibleValues(rule.expectFeature);

  return (
    <Card accent={ev.signal ? "warn" : "neutral"}>
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <input
          value={rule.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className="flex-1 min-w-32 bg-neutral-950 border border-neutral-700 rounded-md px-2 py-1 text-sm font-bold"
        />
        <label className="flex items-center gap-1.5 cursor-pointer text-xs">
          <input
            type="checkbox"
            checked={rule.enabled}
            onChange={(e) => onChange({ enabled: e.target.checked })}
            className="accent-amber-500"
          />
          ativa
        </label>
        <Button size="sm" variant="ghost" onClick={onRemove}>
          ✕ remover
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <Card padding="sm">
          <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1.5">Gatilho</div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <select
              value={rule.triggerFeature}
              onChange={(e) =>
                onChange({
                  triggerFeature: e.target.value as Feature,
                  triggerValue: possibleValues(e.target.value as Feature)[0],
                })
              }
              className="bg-neutral-900 border border-neutral-700 rounded px-1.5 py-1"
            >
              {features.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
            <span>=</span>
            <select
              value={rule.triggerValue}
              onChange={(e) => onChange({ triggerValue: e.target.value })}
              className="bg-neutral-900 border border-neutral-700 rounded px-1.5 py-1"
            >
              {trigVals.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <span>×</span>
            <input
              type="number"
              value={rule.triggerStreak}
              onChange={(e) => onChange({ triggerStreak: Math.max(1, Number(e.target.value) || 1) })}
              min={1}
              max={20}
              className="bg-neutral-900 border border-neutral-700 rounded px-1.5 py-1 w-14 font-mono"
            />
            <span className="text-neutral-500">consecutivos</span>
          </div>
        </Card>
        <Card padding="sm">
          <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1.5">Esperado a seguir</div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <select
              value={rule.expectFeature}
              onChange={(e) =>
                onChange({
                  expectFeature: e.target.value as Feature,
                  expectValue: possibleValues(e.target.value as Feature)[0],
                })
              }
              className="bg-neutral-900 border border-neutral-700 rounded px-1.5 py-1"
            >
              {features.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
            <span>=</span>
            <select
              value={rule.expectValue}
              onChange={(e) => onChange({ expectValue: e.target.value })}
              className="bg-neutral-900 border border-neutral-700 rounded px-1.5 py-1"
            >
              {expVals.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </Card>
      </div>

      {ev.signal && (
        <div className="rounded-xl border border-amber-500/60 bg-amber-500/15 p-3 mb-3 text-xs text-amber-100 font-semibold flex items-center gap-2">
          <Pill accent="warn">🚨 ATIVO</Pill>
          Streak atual de {ev.currentStreak} {rule.triggerFeature}={rule.triggerValue}
        </div>
      )}

      <StatGrid cols={4}>
        <Stat label="Gatilhos" value={String(ev.triggerFires)} sub="no histórico" />
        <Stat label="Hits" value={`${ev.hits}`} sub={`${(ev.hitRate * 100).toFixed(1)}%`} />
        <Stat label="z-score" value={ev.z.toFixed(2)} accent={Math.abs(ev.z) >= 2 ? "warn" : "neutral"} />
        <Stat
          label="Vantagem"
          value={`${((ev.hitRate - ev.baselineRate) * 100).toFixed(1)}pp`}
          accent={ev.hitRate > ev.baselineRate ? "good" : "bad"}
          sub={`baseline ${(ev.baselineRate * 100).toFixed(1)}%`}
        />
      </StatGrid>
    </Card>
  );
});
RuleCard.displayName = "RuleCard";

export default PadroesCustom;
