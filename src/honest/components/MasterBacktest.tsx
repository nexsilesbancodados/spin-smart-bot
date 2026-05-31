import { memo, useState } from "react";
import { useHonestStore } from "../lib/store";
import { runMasterBacktest, BacktestResult, BacktestProgress } from "../lib/masterBacktest";
import { Card, SectionHeader, Pill, Button } from "./ui";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const MasterBacktest = memo(() => {
  const spins = useHonestStore((s) => s.spins);
  const [window, setWindow] = useState(100);
  const [stake, setStake] = useState(10);
  const [startingBank, setStartingBank] = useState(500);
  const [useStrict, setUseStrict] = useState(true);
  const [useFocused, setUseFocused] = useState(true);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<BacktestProgress | null>(null);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    if (spins.length < window + 30) {
      setError(`Precisa de ≥${window + 30} giros pra backtestar (atual: ${spins.length})`);
      return;
    }
    setError(null);
    setRunning(true);
    setResult(null);
    try {
      const fullHistory = spins.map((s) => s.n);
      const res = await runMasterBacktest(
        fullHistory,
        {
          window,
          stake,
          startingBank,
          useStrictMode: useStrict,
          useFocusedScope: useFocused,
        },
        (p) => setProgress(p)
      );
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
      setProgress(null);
    }
  };

  const renderChart = () => {
    if (!result || result.results.length < 2) return null;
    const W = 600;
    const H = 100;
    const cum = result.results.map((r) => r.cumulative);
    const min = Math.min(0, ...cum);
    const max = Math.max(0, ...cum);
    const range = Math.max(0.001, max - min);
    const x = (i: number) => (i / (cum.length - 1)) * W;
    const y = (v: number) => H - ((v - min) / range) * (H - 8) - 4;
    const path = cum.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ");
    const zeroY = y(0);
    const lastV = cum[cum.length - 1];
    const color = lastV >= 0 ? "#10b981" : "#f43f5e";
    return (
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-24 bg-neutral-950 rounded border border-neutral-800"
        preserveAspectRatio="none"
      >
        {min < 0 && max > 0 && (
          <line
            x1={0}
            y1={zeroY}
            x2={W}
            y2={zeroY}
            stroke="#525252"
            strokeDasharray="3 3"
            strokeWidth={0.5}
          />
        )}
        <path d={path} fill="none" stroke={color} strokeWidth={1.5} />
        <circle cx={x(cum.length - 1)} cy={y(lastV)} r={3} fill={color} />
      </svg>
    );
  };

  return (
    <Card padding="sm">
      <SectionHeader
        title="🧪 Backtester do Sinal Mestre"
        eyebrow="Replay sobre seu histórico real — PnL hipotético"
        subtitle={
          <span className="text-[10px] text-neutral-500">
            Roda o motor completo (~5000 padrões) sobre os últimos N giros, usando apenas
            histórico anterior a cada giro. Mostra empiricamente o que aconteceria.
          </span>
        }
        actions={
          <Button variant="primary" size="sm" onClick={handleRun} disabled={running}>
            {running ? "Rodando…" : "▶ Rodar backtest"}
          </Button>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-2 text-[10px]">
        <label className="block">
          <span className="text-neutral-500 uppercase tracking-wider font-bold">Janela</span>
          <select
            value={window}
            onChange={(e) => setWindow(Number(e.target.value))}
            className="w-full mt-0.5 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs"
          >
            {[50, 100, 200, 500].map((v) => (
              <option key={v} value={v}>
                últimos {v}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-neutral-500 uppercase tracking-wider font-bold">Stake R$</span>
          <input
            type="number"
            min={1}
            value={stake}
            onChange={(e) => setStake(Math.max(1, Number(e.target.value) || 1))}
            className="w-full mt-0.5 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs font-mono"
          />
        </label>
        <label className="block">
          <span className="text-neutral-500 uppercase tracking-wider font-bold">Banca R$</span>
          <input
            type="number"
            min={10}
            value={startingBank}
            onChange={(e) => setStartingBank(Math.max(10, Number(e.target.value) || 500))}
            className="w-full mt-0.5 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs font-mono"
          />
        </label>
        <label className="flex items-center gap-1 mt-3.5">
          <input
            type="checkbox"
            checked={useStrict}
            onChange={(e) => setUseStrict(e.target.checked)}
            className="accent-amber-500"
          />
          <span className="text-neutral-300">Estrito</span>
          <input
            type="checkbox"
            checked={useFocused}
            onChange={(e) => setUseFocused(e.target.checked)}
            className="accent-amber-500 ml-2"
          />
          <span className="text-neutral-300">Cor+Dúzia+Setor</span>
        </label>
      </div>

      {running && progress && (
        <div className="bg-neutral-900/50 rounded p-2 mb-2">
          <div className="flex items-center justify-between text-[10px] text-neutral-400 mb-1">
            <span>
              Processando {progress.done}/{progress.total} giros
            </span>
            <span className={`font-mono ${progress.pnlSoFar >= 0 ? "text-emerald-300" : "text-red-300"}`}>
              PnL parcial {progress.pnlSoFar >= 0 ? "+" : ""}
              {fmt(progress.pnlSoFar)}
            </span>
          </div>
          <div className="h-1.5 bg-neutral-800 rounded overflow-hidden">
            <div
              className="h-full bg-amber-500 transition-all"
              style={{ width: `${(progress.done / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-950/40 border border-red-700/50 rounded p-2 mb-2 text-[10px] text-red-200">
          ⚠ {error}
        </div>
      )}

      {result && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px]">
            <div className="bg-neutral-900/50 rounded p-1.5">
              <div className="text-[9px] text-neutral-500 uppercase tracking-wider font-bold">PnL</div>
              <div
                className={`text-base font-bold font-mono ${
                  result.pnl >= 0 ? "text-emerald-300" : "text-red-300"
                }`}
              >
                {result.pnl >= 0 ? "+" : ""}
                {fmt(result.pnl)}
              </div>
              <div className="text-[9px] text-neutral-500">
                banca final {fmt(result.finalBank)}
              </div>
            </div>
            <div className="bg-neutral-900/50 rounded p-1.5">
              <div className="text-[9px] text-neutral-500 uppercase tracking-wider font-bold">
                Hit rate
              </div>
              <div className="text-base font-bold font-mono text-cyan-300">
                {(result.hitRate * 100).toFixed(1)}%
              </div>
              <div className="text-[9px] text-neutral-500">
                {result.hits}/{result.betCount} apostas
              </div>
            </div>
            <div className="bg-neutral-900/50 rounded p-1.5">
              <div className="text-[9px] text-neutral-500 uppercase tracking-wider font-bold">ROI</div>
              <div
                className={`text-base font-bold font-mono ${
                  result.roi >= 0 ? "text-emerald-300" : "text-red-300"
                }`}
              >
                {(result.roi * 100).toFixed(1)}%
              </div>
              <div className="text-[9px] text-neutral-500">
                stakeado {fmt(result.staked)}
              </div>
            </div>
            <div className="bg-neutral-900/50 rounded p-1.5">
              <div className="text-[9px] text-neutral-500 uppercase tracking-wider font-bold">
                Max drawdown
              </div>
              <div className="text-base font-bold font-mono text-amber-300">
                {(result.maxDrawdown * 100).toFixed(1)}%
              </div>
              <div className="text-[9px] text-neutral-500">
                {result.skipCount} skips (AGUARDE)
              </div>
            </div>
          </div>

          <div>
            <div className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold mb-1">
              PnL acumulado (último→primeiro)
            </div>
            {renderChart()}
          </div>

          {result.byTargetType.length > 0 && (
            <details className="bg-neutral-900/40 rounded">
              <summary className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold cursor-pointer px-2 py-1">
                Por tipo de aposta ({result.byTargetType.length})
              </summary>
              <div className="space-y-0.5 p-2">
                {result.byTargetType.map((tb) => (
                  <div
                    key={tb.family}
                    className="flex items-center gap-2 text-[10px] bg-neutral-900/50 rounded px-1.5 py-0.5"
                  >
                    <span className="flex-1 text-neutral-300 truncate">{tb.family}</span>
                    <span className="font-mono text-neutral-400 shrink-0">
                      {tb.hits}/{tb.bets}
                    </span>
                    <span className="font-mono text-cyan-300 shrink-0 w-12 text-right">
                      {(tb.hitRate * 100).toFixed(0)}%
                    </span>
                    <span
                      className={`font-mono font-bold shrink-0 w-20 text-right ${
                        tb.pnl >= 0 ? "text-emerald-300" : "text-red-300"
                      }`}
                    >
                      {tb.pnl >= 0 ? "+" : ""}
                      {fmt(tb.pnl)}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          )}

          {result.byFamily.length > 0 && (
            <details className="bg-neutral-900/40 rounded">
              <summary className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold cursor-pointer px-2 py-1">
                Top famílias por PnL ({Math.min(15, result.byFamily.length)})
              </summary>
              <div className="space-y-0.5 p-2 max-h-72 overflow-y-auto">
                {result.byFamily.slice(0, 15).map((fb) => (
                  <div
                    key={fb.family}
                    className="flex items-center gap-2 text-[10px] bg-neutral-900/50 rounded px-1.5 py-0.5"
                  >
                    <span className="flex-1 text-neutral-300 truncate">{fb.family}</span>
                    <span className="font-mono text-neutral-400 shrink-0">
                      {fb.hits}/{fb.bets}
                    </span>
                    <span className="font-mono text-cyan-300 shrink-0 w-10 text-right">
                      {(fb.hitRate * 100).toFixed(0)}%
                    </span>
                    <span
                      className={`font-mono font-bold shrink-0 w-20 text-right ${
                        fb.pnl >= 0 ? "text-emerald-300" : "text-red-300"
                      }`}
                    >
                      {fb.pnl >= 0 ? "+" : ""}
                      {fmt(fb.pnl)}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          )}

          <Pill accent={result.pnl >= 0 ? "good" : "bad"}>
            {result.pnl >= 0
              ? `✓ Lucrativo no backtest (mas variância pode reverter)`
              : `✗ Perda no backtest — casa edge atuando`}
          </Pill>
        </div>
      )}

      <div className="text-[9px] text-neutral-600 italic mt-2 text-center leading-snug">
        ⚠ Backtest usa Wilson aprendido HOJE aplicado ao passado (hindsight bias).
        Resultado real provável: pior. Use pra entender comportamento, não como garantia.
      </div>
    </Card>
  );
});
MasterBacktest.displayName = "MasterBacktest";

export default MasterBacktest;
