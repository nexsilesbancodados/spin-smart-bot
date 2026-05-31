import { memo, useMemo, useState } from "react";
import { useHonestStore } from "../lib/store";
import { Card, SectionHeader, Button } from "./ui";

const PRESETS = [
  { id: "even", label: "1:1 (cor)", payout: 1, prob: 18 / 37 },
  { id: "dozen", label: "2:1 (dúzia)", payout: 2, prob: 12 / 37 },
  { id: "line", label: "5:1 (6 nº)", payout: 5, prob: 6 / 37 },
  { id: "straight", label: "35:1 (pleno)", payout: 35, prob: 1 / 37 },
];

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });

const fmtPct = (v: number) => (v * 100).toFixed(1) + "%";

const simulate = (params: {
  initial: number;
  stakePct: number;
  payout: number;
  prob: number;
  rounds: number;
  trials: number;
  stopLossPct: number;
  targetPct: number;
}) => {
  const { initial, stakePct, payout, prob, rounds, trials, stopLossPct, targetPct } = params;
  const stopAt = initial * (1 - stopLossPct / 100);
  const targetAt = initial * (1 + targetPct / 100);
  const outcomes: number[] = [];
  let reachedTarget = 0, reachedStop = 0, busted = 0;
  let maxDrawdownSum = 0;
  for (let t = 0; t < trials; t++) {
    let bk = initial;
    let peak = initial;
    let trough = initial;
    let stopped = false;
    for (let r = 0; r < rounds; r++) {
      const stake = Math.min(bk, bk * stakePct);
      if (stake <= 0) {
        busted++;
        stopped = true;
        break;
      }
      if (Math.random() < prob) {
        bk += stake * payout;
      } else {
        bk -= stake;
      }
      if (bk > peak) peak = bk;
      if (bk < trough) trough = bk;
      if (bk <= stopAt) {
        reachedStop++;
        stopped = true;
        break;
      }
      if (bk >= targetAt) {
        reachedTarget++;
        stopped = true;
        break;
      }
    }
    if (!stopped && bk <= 0) busted++;
    outcomes.push(bk);
    maxDrawdownSum += (peak - trough) / peak;
  }
  outcomes.sort((a, b) => a - b);
  const median = outcomes[Math.floor(outcomes.length / 2)];
  const p10 = outcomes[Math.floor(outcomes.length * 0.1)];
  const p90 = outcomes[Math.floor(outcomes.length * 0.9)];
  const mean = outcomes.reduce((a, b) => a + b, 0) / outcomes.length;
  const profitable = outcomes.filter((o) => o > initial).length;
  return {
    median,
    p10,
    p90,
    mean,
    profitable,
    reachedTarget,
    reachedStop,
    busted,
    trials,
    avgDrawdown: maxDrawdownSum / trials,
    histogram: outcomes,
  };
};

const MonteCarloSim = memo(() => {
  const session = useHonestStore((s) => s.session);
  const [bankroll, setBankroll] = useState(() => Math.max(100, session.initial || 200));
  const [stakePct, setStakePct] = useState(2);
  const [betId, setBetId] = useState("even");
  const [rounds, setRounds] = useState(50);
  const [stopLossPct, setStopLossPct] = useState(30);
  const [targetPct, setTargetPct] = useState(20);
  const [result, setResult] = useState<ReturnType<typeof simulate> | null>(null);
  const [running, setRunning] = useState(false);

  const bet = PRESETS.find((b) => b.id === betId) || PRESETS[0];

  const handleRun = () => {
    setRunning(true);
    setTimeout(() => {
      const r = simulate({
        initial: bankroll,
        stakePct: stakePct / 100,
        payout: bet.payout,
        prob: bet.prob,
        rounds,
        trials: 2000,
        stopLossPct,
        targetPct,
      });
      setResult(r);
      setRunning(false);
    }, 30);
  };

  const histo = useMemo(() => {
    if (!result) return null;
    const buckets = 12;
    const min = Math.min(...result.histogram);
    const max = Math.max(...result.histogram);
    const range = max - min || 1;
    const counts = new Array(buckets).fill(0);
    for (const v of result.histogram) {
      const i = Math.min(buckets - 1, Math.floor(((v - min) / range) * buckets));
      counts[i]++;
    }
    const maxCount = Math.max(...counts);
    return { counts, min, max, maxCount };
  }, [result]);

  return (
    <Card padding="sm">
      <SectionHeader title="Simulador Monte Carlo" eyebrow="Ferramenta" />

      <div className="grid grid-cols-2 gap-1.5 mb-2 text-[10px]">
        <label className="block">
          <span className="text-neutral-500 uppercase tracking-wider font-bold">Banca</span>
          <input
            type="number"
            value={bankroll}
            onChange={(e) => setBankroll(Math.max(1, Number(e.target.value) || 0))}
            className="w-full mt-0.5 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs font-mono"
          />
        </label>
        <label className="block">
          <span className="text-neutral-500 uppercase tracking-wider font-bold">Stake %</span>
          <input
            type="number"
            step={0.5}
            value={stakePct}
            onChange={(e) => setStakePct(Math.max(0.1, Number(e.target.value) || 0.1))}
            className="w-full mt-0.5 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs font-mono"
          />
        </label>
        <label className="block">
          <span className="text-neutral-500 uppercase tracking-wider font-bold">Tipo</span>
          <select
            value={betId}
            onChange={(e) => setBetId(e.target.value)}
            className="w-full mt-0.5 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs"
          >
            {PRESETS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-neutral-500 uppercase tracking-wider font-bold">Rodadas</span>
          <input
            type="number"
            value={rounds}
            onChange={(e) => setRounds(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
            className="w-full mt-0.5 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs font-mono"
          />
        </label>
        <label className="block">
          <span className="text-neutral-500 uppercase tracking-wider font-bold">Stop -%</span>
          <input
            type="number"
            value={stopLossPct}
            onChange={(e) => setStopLossPct(Math.max(1, Number(e.target.value) || 1))}
            className="w-full mt-0.5 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs font-mono"
          />
        </label>
        <label className="block">
          <span className="text-neutral-500 uppercase tracking-wider font-bold">Meta +%</span>
          <input
            type="number"
            value={targetPct}
            onChange={(e) => setTargetPct(Math.max(1, Number(e.target.value) || 1))}
            className="w-full mt-0.5 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs font-mono"
          />
        </label>
      </div>

      <Button variant="primary" size="sm" onClick={handleRun} disabled={running}>
        {running ? "Simulando…" : "🎲 Rodar 2.000 simulações"}
      </Button>

      {result && histo && (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-3 gap-1 text-center">
            <div className="bg-neutral-900/60 rounded p-1.5">
              <div className="text-[8px] text-neutral-500 uppercase tracking-wider">Mediana</div>
              <div className={`text-sm font-bold font-mono ${result.median >= bankroll ? "text-emerald-300" : "text-red-300"}`}>
                {fmt(result.median)}
              </div>
            </div>
            <div className="bg-neutral-900/60 rounded p-1.5">
              <div className="text-[8px] text-neutral-500 uppercase tracking-wider">% lucrativos</div>
              <div className="text-sm font-bold font-mono text-cyan-300">
                {fmtPct(result.profitable / result.trials)}
              </div>
            </div>
            <div className="bg-neutral-900/60 rounded p-1.5">
              <div className="text-[8px] text-neutral-500 uppercase tracking-wider">Drawdown médio</div>
              <div className="text-sm font-bold font-mono text-amber-300">
                {fmtPct(result.avgDrawdown)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1 text-center text-[10px]">
            <div className="bg-emerald-950/40 rounded p-1">
              <div className="text-emerald-400/70 uppercase tracking-wider text-[8px]">Meta</div>
              <div className="font-bold text-emerald-200">{fmtPct(result.reachedTarget / result.trials)}</div>
            </div>
            <div className="bg-red-950/40 rounded p-1">
              <div className="text-red-400/70 uppercase tracking-wider text-[8px]">Stop</div>
              <div className="font-bold text-red-200">{fmtPct(result.reachedStop / result.trials)}</div>
            </div>
            <div className="bg-neutral-900/60 rounded p-1">
              <div className="text-neutral-400 uppercase tracking-wider text-[8px]">P10-P90</div>
              <div className="font-bold text-neutral-200 font-mono">
                {fmt(result.p10)}/{fmt(result.p90)}
              </div>
            </div>
          </div>

          <div>
            <div className="text-[9px] text-neutral-500 uppercase tracking-wider mb-1">
              Distribuição de saldo final
            </div>
            <div className="flex items-end gap-0.5 h-16 bg-neutral-950 rounded p-1 border border-neutral-800">
              {histo.counts.map((c, i) => {
                const pct = histo.maxCount > 0 ? c / histo.maxCount : 0;
                const bucketVal = histo.min + ((histo.max - histo.min) / histo.counts.length) * i;
                const above = bucketVal >= bankroll;
                return (
                  <div
                    key={i}
                    className={`flex-1 rounded-t ${above ? "bg-emerald-500" : "bg-red-500"}`}
                    style={{ height: `${Math.max(2, pct * 100)}%` }}
                    title={`${fmt(bucketVal)}: ${c}`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between text-[9px] text-neutral-500 font-mono mt-0.5">
              <span>{fmt(histo.min)}</span>
              <span className="text-amber-400">{fmt(bankroll)} (start)</span>
              <span>{fmt(histo.max)}</span>
            </div>
          </div>

          <div className="text-[10px] text-neutral-500 italic">
            Assume distribuição uniforme da roleta (sem viés). Vantagem da casa real: ~2,7%.
          </div>
        </div>
      )}
    </Card>
  );
});
MonteCarloSim.displayName = "MonteCarloSim";

export default MonteCarloSim;
