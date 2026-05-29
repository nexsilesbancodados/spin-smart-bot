import { memo, useMemo, useState } from "react";
import { useHonestStore } from "../lib/store";
import {
  useCustomStrategies,
  makeStrategy,
  resolveNumbers,
  runCustomBacktest,
  SELECTION_LABELS,
  type CustomStrategy,
  type SelectionMode,
} from "../lib/customStrategies";
import { defaultRules, type PatternRule, features, possibleValues } from "../lib/customPatterns";
import { colorOf, SLOTS } from "../lib/wheel";
import { Card, PageContainer, PageHeader, SectionHeader, Stat, StatGrid, Button, EmptyState, Pill } from "../components/ui";

const fmtMoney = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const ballBg = (n: number) => {
  const c = colorOf(n);
  if (c === "green") return "bg-emerald-600";
  if (c === "red") return "bg-red-600";
  return "bg-neutral-800";
};

const Estrategia = memo(() => {
  const strategies = useCustomStrategies((s) => s.strategies);
  const add = useCustomStrategies((s) => s.add);

  return (
    <PageContainer>
      <PageHeader
        title="Editor de Estratégia"
        subtitle='Combine seleção de números + gatilhos de padrão. "Quando X acontece, aposta em Y". Cada estratégia pode ser backtestada no histórico atual.'
        actions={<Button variant="primary" onClick={() => add(makeStrategy())}>+ Nova estratégia</Button>}
      />

      {strategies.length === 0 ? (
        <EmptyState
          icon="🎲"
          title="Nenhuma estratégia criada"
          description="Cada estratégia tem uma forma de escolher números + condições de gatilho. Backteste no histórico para ver se vale a pena."
          action={<Button variant="primary" onClick={() => add(makeStrategy())}>Criar primeira</Button>}
        />
      ) : (
        <div className="space-y-4">
          {strategies.map((s) => (
            <StrategyEditor key={s.id} strategy={s} />
          ))}
        </div>
      )}
    </PageContainer>
  );
});
Estrategia.displayName = "Estrategia";

const StrategyEditor = memo(({ strategy }: { strategy: CustomStrategy }) => {
  const spins = useHonestStore((s) => s.spins.map((x) => x.n));
  const update = useCustomStrategies((s) => s.update);
  const remove = useCustomStrategies((s) => s.remove);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ReturnType<typeof runCustomBacktest> | null>(null);

  const resolvedNumbers = useMemo(() => resolveNumbers(strategy, spins), [strategy, spins]);

  const runBacktest = () => {
    setRunning(true);
    setTimeout(() => {
      try {
        setResult(runCustomBacktest(strategy, spins));
      } finally {
        setRunning(false);
      }
    }, 20);
  };

  return (
    <Card accent={strategy.enabled ? "neutral" : "info"}>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <input
          value={strategy.name}
          onChange={(e) => update(strategy.id, { name: e.target.value })}
          className="text-base font-bold bg-neutral-950 border border-neutral-700 rounded-md px-2 py-1 min-w-48"
        />
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={strategy.enabled}
              onChange={(e) => update(strategy.id, { enabled: e.target.checked })}
              className="accent-amber-500"
            />
            ativa
          </label>
          <Button size="sm" variant="primary" onClick={runBacktest} disabled={running || spins.length < 30}>
            {running ? "Rodando…" : "Backtest"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => confirm("Remover estratégia?") && remove(strategy.id)}>
            ✕
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card padding="sm">
          <SectionHeader title="Seleção de números" />
          <label className="text-xs">
            <span className="text-neutral-400 block mb-1">Modo</span>
            <select
              value={strategy.selectionMode}
              onChange={(e) => update(strategy.id, { selectionMode: e.target.value as SelectionMode })}
              className="w-full bg-neutral-950 border border-neutral-700 rounded-md px-2 py-1.5"
            >
              {Object.entries(SELECTION_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          {strategy.selectionMode === "manual" && (
            <ManualNumberPicker
              value={strategy.manualNumbers}
              onChange={(arr) => update(strategy.id, { manualNumbers: arr })}
            />
          )}
          {(strategy.selectionMode === "ensemble-top-n" ||
            strategy.selectionMode === "hottest-n" ||
            strategy.selectionMode === "coldest-n") && (
            <label className="text-xs mt-2 block">
              <span className="text-neutral-400 block mb-1">N</span>
              <input
                type="number"
                value={strategy.topN}
                onChange={(e) => update(strategy.id, { topN: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })}
                min={1}
                max={20}
                className="w-full bg-neutral-950 border border-neutral-700 rounded-md px-2 py-1.5 font-mono"
              />
            </label>
          )}
          {strategy.selectionMode === "neighbors-of" && (
            <div className="grid grid-cols-2 gap-2 mt-2">
              <label className="text-xs">
                <span className="text-neutral-400 block mb-1">Centro</span>
                <select
                  value={strategy.neighborCenter}
                  onChange={(e) => update(strategy.id, { neighborCenter: Number(e.target.value) })}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-md px-2 py-1.5"
                >
                  {Array.from({ length: SLOTS }, (_, n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs">
                <span className="text-neutral-400 block mb-1">Raio ±</span>
                <select
                  value={strategy.neighborRadius}
                  onChange={(e) => update(strategy.id, { neighborRadius: Number(e.target.value) })}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-md px-2 py-1.5"
                >
                  {[1, 2, 3, 4, 5].map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          <div className="mt-3 pt-3 border-t border-neutral-800/60">
            <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Números atualmente</div>
            <div className="flex flex-wrap gap-1">
              {resolvedNumbers.slice(0, 24).map((n) => (
                <span
                  key={n}
                  className={`${ballBg(n)} text-white text-[10px] font-bold w-5 h-5 rounded-sm flex items-center justify-center`}
                >
                  {n}
                </span>
              ))}
              {resolvedNumbers.length > 24 && (
                <span className="text-[10px] text-neutral-500 self-center">+{resolvedNumbers.length - 24}</span>
              )}
              {resolvedNumbers.length === 0 && (
                <span className="text-[10px] text-neutral-500">vazio (configure acima)</span>
              )}
            </div>
            <div className="text-[10px] text-neutral-500 mt-1">{resolvedNumbers.length} número(s)</div>
          </div>
        </Card>

        <Card padding="sm">
          <SectionHeader
            title="Gatilhos"
            subtitle="Estratégia só aposta quando algum gatilho dispara (logic AND/OR/ANY)"
            actions={
              <select
                value={strategy.triggerLogic}
                onChange={(e) => update(strategy.id, { triggerLogic: e.target.value as "AND" | "OR" | "ANY" })}
                className="bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-xs"
              >
                <option value="ANY">SEM filtro</option>
                <option value="AND">AND (todas)</option>
                <option value="OR">OR (qualquer)</option>
              </select>
            }
          />
          {strategy.triggers.length === 0 ? (
            <div className="text-xs text-neutral-500 mb-2">Nenhum gatilho. Estratégia aposta toda rodada.</div>
          ) : (
            <div className="space-y-2 mb-2">
              {strategy.triggers.map((t, ti) => (
                <TriggerRow
                  key={ti}
                  rule={t}
                  onChange={(patch) => {
                    const newT = strategy.triggers.map((tr, i) => (i === ti ? { ...tr, ...patch } : tr));
                    update(strategy.id, { triggers: newT });
                  }}
                  onRemove={() => {
                    update(strategy.id, { triggers: strategy.triggers.filter((_, i) => i !== ti) });
                  }}
                />
              ))}
            </div>
          )}
          <Button
            size="sm"
            onClick={() => {
              const seed = defaultRules[0];
              update(strategy.id, {
                triggers: [
                  ...strategy.triggers,
                  { ...seed, id: `trig_${Date.now()}_${strategy.triggers.length}` },
                ],
              });
            }}
          >
            + Adicionar gatilho
          </Button>
        </Card>
      </div>

      {result && (
        <div className="mt-4">
          <StatGrid cols={4}>
            <Stat label="Rodadas com aposta" value={`${result.rounds} / ${result.triggered}`} sub="entradas / gatilhos" />
            <Stat
              label="Hits"
              value={`${result.hits} (${(result.hitRate * 100).toFixed(1)}%)`}
            />
            <Stat
              label="PnL"
              value={fmtMoney(result.totalPnL)}
              sub={`Apostado ${fmtMoney(result.totalWagered)}`}
              accent={result.totalPnL >= 0 ? "good" : "bad"}
            />
            <Stat
              label="Borda realizada"
              value={`${(result.realizedEdge * 100).toFixed(2)}%`}
              sub={`Esperada −2,70%`}
              accent={result.realizedEdge > result.expectedEdge ? "good" : "bad"}
            />
          </StatGrid>
          <BacktestCurve curve={result.curve} />
        </div>
      )}
    </Card>
  );
});
StrategyEditor.displayName = "StrategyEditor";

const ManualNumberPicker = memo(({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) => {
  const set = new Set(value);
  const toggle = (n: number) => {
    if (set.has(n)) set.delete(n);
    else set.add(n);
    onChange(Array.from(set).sort((a, b) => a - b));
  };
  return (
    <div className="mt-2">
      <div className="grid grid-cols-10 gap-0.5">
        {Array.from({ length: 37 }, (_, n) => (
          <button
            key={n}
            onClick={() => toggle(n)}
            className={`${ballBg(n)} text-white text-[10px] font-bold h-7 rounded-sm flex items-center justify-center ${
              set.has(n) ? "ring-2 ring-amber-400" : "opacity-40"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
});
ManualNumberPicker.displayName = "ManualNumberPicker";

const TriggerRow = memo(({ rule, onChange, onRemove }: { rule: PatternRule; onChange: (p: Partial<PatternRule>) => void; onRemove: () => void }) => (
  <div className="rounded-md border border-neutral-700 bg-neutral-950/60 p-2">
    <div className="flex items-center justify-between mb-1">
      <span className="text-[11px] font-semibold text-neutral-300">{rule.name}</span>
      <button onClick={onRemove} className="text-[10px] text-red-300 hover:text-red-200">
        ✕
      </button>
    </div>
    <div className="flex flex-wrap items-center gap-1 text-[11px]">
      <select
        value={rule.triggerFeature}
        onChange={(e) =>
          onChange({
            triggerFeature: e.target.value as PatternRule["triggerFeature"],
            triggerValue: possibleValues(e.target.value as PatternRule["triggerFeature"])[0],
          })
        }
        className="bg-neutral-900 border border-neutral-700 rounded px-1 py-0.5"
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
        className="bg-neutral-900 border border-neutral-700 rounded px-1 py-0.5"
      >
        {possibleValues(rule.triggerFeature).map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
      <span>×</span>
      <input
        type="number"
        value={rule.triggerStreak}
        onChange={(e) => onChange({ triggerStreak: Math.max(1, Number(e.target.value)) })}
        min={1}
        max={20}
        className="bg-neutral-900 border border-neutral-700 rounded px-1 py-0.5 w-12 font-mono"
      />
      <Pill accent={rule.enabled ? "good" : "neutral"}>
        <input
          type="checkbox"
          checked={rule.enabled}
          onChange={(e) => onChange({ enabled: e.target.checked })}
          className="accent-amber-500 mr-1"
        />
        {rule.enabled ? "on" : "off"}
      </Pill>
    </div>
  </div>
));
TriggerRow.displayName = "TriggerRow";

const BacktestCurve = memo(({ curve }: { curve: number[] }) => {
  if (curve.length < 2) return null;
  const W = 700;
  const H = 140;
  const lo = Math.min(0, ...curve);
  const hi = Math.max(0, ...curve);
  const range = Math.max(1, hi - lo);
  const x = (i: number) => (i / (curve.length - 1)) * W;
  const y = (v: number) => H - ((v - lo) / range) * (H - 20) - 10;
  const path = curve.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ");
  const zeroY = y(0);
  return (
    <div className="mt-4">
      <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Curva PnL</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-neutral-950 rounded-lg border border-neutral-800">
        <line x1={0} x2={W} y1={zeroY} y2={zeroY} stroke="#525252" strokeDasharray="3 3" strokeWidth={1} />
        <path d={path} fill="none" stroke="#22d3ee" strokeWidth={1.5} />
      </svg>
    </div>
  );
});
BacktestCurve.displayName = "EstrategiaBacktestCurve";

export default Estrategia;
