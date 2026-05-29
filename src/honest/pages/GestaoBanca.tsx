import { memo, useMemo, useState } from "react";
import { useHonestStore } from "../lib/store";
import { simulateBankroll, sessionPnL } from "../lib/bankroll";
import { HOUSE_EDGE } from "../lib/wheel";
import { Card, PageContainer, PageHeader, SectionHeader, Stat, StatGrid, Button } from "../components/ui";

const fmtMoney = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const GestaoBanca = memo(() => {
  const session = useHonestStore((s) => s.session);
  const updateCfg = useHonestStore((s) => s.updateSessionConfig);
  const startSession = useHonestStore((s) => s.startSession);
  const endSession = useHonestStore((s) => s.endSession);
  const recordResult = useHonestStore((s) => s.recordResult);

  const [initialInput, setInitialInput] = useState(session.initial || 200);
  const sessionActive = !!session.startedAt;

  const sim = useMemo(
    () =>
      simulateBankroll(
        {
          initial: sessionActive ? session.initial : initialInput,
          stake: session.stake,
          betType: session.betType,
          maxRounds: session.maxRounds,
          stopLossPct: session.stopLossPct,
          targetPct: session.targetPct,
        },
        400
      ),
    [
      sessionActive,
      session.initial,
      initialInput,
      session.stake,
      session.betType,
      session.maxRounds,
      session.stopLossPct,
      session.targetPct,
    ]
  );

  const pnl = sessionPnL(session.initial, session.current);
  const totalWagered = session.spinsThisSession * session.stake;
  const expectedLossNow = totalWagered * HOUSE_EDGE;

  return (
    <PageContainer>
      <PageHeader
        title="Gestão de banca"
        subtitle="Stake plano, stop loss, meta de saída, simulação Monte Carlo da banca contra a vantagem da casa."
      />

      <Card>
        <SectionHeader title="Configuração da sessão" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Field
            label="Banca inicial"
            disabled={sessionActive}
            value={sessionActive ? session.initial : initialInput}
            onChange={(v) => setInitialInput(v)}
            min={10}
            step={10}
          />
          <Field label="Stake por aposta" value={session.stake} onChange={(v) => updateCfg({ stake: v })} min={1} />
          <Select
            label="Tipo de aposta"
            value={session.betType}
            onChange={(v) => updateCfg({ betType: v as "straight" | "even" })}
            options={[
              { value: "straight", label: "Pleno (35:1)" },
              { value: "even", label: "Dinheiro igualado (1:1)" },
            ]}
          />
          <Field label="Stop loss (%)" value={session.stopLossPct} onChange={(v) => updateCfg({ stopLossPct: v })} min={1} max={100} />
          <Field label="Meta (%)" value={session.targetPct} onChange={(v) => updateCfg({ targetPct: v })} min={1} max={500} />
          <Field label="Máx. rodadas" value={session.maxRounds} onChange={(v) => updateCfg({ maxRounds: v })} min={1} max={1000} />
        </div>
        <div className="flex gap-2 pt-3 flex-wrap">
          {!sessionActive ? (
            <Button variant="primary" onClick={() => startSession(initialInput)}>
              Iniciar sessão
            </Button>
          ) : (
            <Button variant="danger" onClick={endSession}>
              Encerrar sessão
            </Button>
          )}
          {sessionActive && (
            <>
              <Button size="sm" variant="success" onClick={() => recordResult(session.stake * 35)}>
                Pleno (+{fmtMoney(session.stake * 35)})
              </Button>
              <Button size="sm" variant="success" onClick={() => recordResult(session.stake)}>
                +{fmtMoney(session.stake)}
              </Button>
              <Button size="sm" variant="danger" onClick={() => recordResult(-session.stake)}>
                −{fmtMoney(session.stake)}
              </Button>
            </>
          )}
        </div>
      </Card>

      {sessionActive && (
        <StatGrid cols={3}>
          <Stat label="Saldo atual" value={fmtMoney(session.current)} sub={`${pnl.abs >= 0 ? "+" : ""}${pnl.pct.toFixed(1)}%`} accent={pnl.abs >= 0 ? "good" : "bad"} />
          <Stat label="Rodadas" value={`${session.spinsThisSession} / ${session.maxRounds}`} sub={`Total apostado ${fmtMoney(totalWagered)}`} />
          <Stat label="Perda esperada acumulada" value={`−${fmtMoney(expectedLossNow)}`} sub="Stake × rodadas × 2,7%" accent="warn" />
        </StatGrid>
      )}

      <Card>
        <SectionHeader
          title="Projeção Monte Carlo (400 trials)"
          subtitle={
            session.betType === "straight"
              ? "Pleno paga 35:1 quando acerta (1/37 de chance)."
              : "Dinheiro igualado paga 1:1 em vermelho/preto."
          }
        />
        <StatGrid cols={4}>
          <Stat label="Final médio" value={fmtMoney(sim.meanFinal)} sub={`Mediana ${fmtMoney(sim.medianFinal)}`} />
          <Stat label="% bate stop loss" value={`${sim.hitStopLossPct.toFixed(0)}%`} accent={sim.hitStopLossPct > 50 ? "bad" : "warn"} />
          <Stat label="% bate meta" value={`${sim.hitTargetPct.toFixed(0)}%`} accent="good" />
          <Stat label="Perda esperada total" value={`−${fmtMoney(sim.expectedLoss)}`} accent="warn" />
        </StatGrid>
        <CurveChart mean={sim.curveMean} p10={sim.curveP10} p90={sim.curveP90} initial={sessionActive ? session.initial : initialInput} />
      </Card>
    </PageContainer>
  );
});
GestaoBanca.displayName = "GestaoBanca";

const Field = memo(
  ({
    label,
    value,
    onChange,
    disabled,
    min,
    max,
    step = 1,
  }: {
    label: string;
    value: number;
    onChange: (v: number) => void;
    disabled?: boolean;
    min?: number;
    max?: number;
    step?: number;
  }) => (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</span>
      <input
        type="number"
        value={value}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="bg-neutral-950 border border-neutral-700 rounded-lg px-2 py-1.5 text-sm font-mono disabled:opacity-60"
      />
    </label>
  )
);
Field.displayName = "BancaField";

interface SelectProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}
const Select = memo(({ label, value, onChange, options }: SelectProps) => (
  <label className="flex flex-col gap-1 col-span-2 sm:col-span-1">
    <span className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</span>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-neutral-950 border border-neutral-700 rounded-lg px-2 py-1.5 text-sm"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  </label>
));
Select.displayName = "BancaSelect";

const CurveChart = memo(
  ({ mean, p10, p90, initial }: { mean: number[]; p10: number[]; p90: number[]; initial: number }) => {
    const W = 600;
    const H = 160;
    const all = [...mean, ...p10, ...p90, initial];
    const lo = Math.min(...all);
    const hi = Math.max(...all);
    const range = Math.max(1, hi - lo);
    const x = (i: number) => (i / (mean.length - 1)) * W;
    const y = (v: number) => H - ((v - lo) / range) * (H - 10) - 5;
    const path = (arr: number[]) => arr.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ");
    const area = `${path(p90)} L${x(mean.length - 1)},${y(p10[mean.length - 1])} ${p10
      .slice()
      .reverse()
      .map((v, i) => `L${x(mean.length - 1 - i)},${y(v)}`)
      .join(" ")} Z`;
    return (
      <div className="mt-4 rounded-lg border border-neutral-700 bg-neutral-950/60 p-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
          <line x1={0} x2={W} y1={y(initial)} y2={y(initial)} stroke="#525252" strokeDasharray="3 3" strokeWidth={1} />
          <path d={area} fill="#f59e0b22" stroke="none" />
          <path d={path(mean)} fill="none" stroke="#f59e0b" strokeWidth={1.5} />
        </svg>
        <div className="flex items-center justify-between text-[10px] text-neutral-500 px-1 pt-1">
          <span>Faixa P10–P90 e curva média ao longo de {mean.length - 1} rodadas</span>
          <span>Linha tracejada = banca inicial</span>
        </div>
      </div>
    );
  }
);
CurveChart.displayName = "CurveChart";

export default GestaoBanca;
