import { memo, useMemo, useState } from "react";
import { useAutoBet, autoBetStats } from "../lib/autoBet";
import { Card, SectionHeader, Pill, Button } from "./ui";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const AutoBetPanel = memo(() => {
  const config = useAutoBet((s) => s.config);
  const history = useAutoBet((s) => s.history);
  const pending = useAutoBet((s) => s.pending);
  const totalBets = useAutoBet((s) => s.totalBets);
  const totalHits = useAutoBet((s) => s.totalHits);
  const totalPnL = useAutoBet((s) => s.totalPnL);
  const pausedReason = useAutoBet((s) => s.pausedReason);
  const setConfig = useAutoBet((s) => s.setConfig);
  const toggleEnabled = useAutoBet((s) => s.toggleEnabled);
  const resetBank = useAutoBet((s) => s.resetBank);
  const clearHistory = useAutoBet((s) => s.clearHistory);
  const [confirmClear, setConfirmClear] = useState(false);

  const stats = useMemo(() => autoBetStats(), [totalBets, totalHits, totalPnL]);
  const bankPct = config.startingBank > 0 ? config.currentBank / config.startingBank : 1;
  const drawdownPct = 1 - bankPct;

  const tone =
    config.currentBank < config.startingBank * 0.85
      ? "bad"
      : config.currentBank > config.startingBank * 1.1
      ? "good"
      : "neutral";

  return (
    <Card padding="sm" accent={config.enabled ? (pausedReason ? "bad" : "good") : "neutral"}>
      <SectionHeader
        title={
          <span className="flex items-center gap-2">
            🤖 Auto-Aposta
            <Pill accent={config.enabled ? (pausedReason ? "bad" : "good") : "neutral"}>
              {config.enabled ? (pausedReason ? "PAUSADO" : "ATIVO") : "DESLIGADO"}
            </Pill>
          </span>
        }
        eyebrow="Simulação em papel — você ainda aposta manualmente no cassino"
        subtitle={
          <span className="text-[10px] text-neutral-500">
            Registra automaticamente quando o Sinal Mestre passar a validação estrita ·
            calcula PnL acumulado · auto-pausa por segurança
          </span>
        }
        actions={
          <Button
            variant={config.enabled ? "danger" : "success"}
            size="sm"
            onClick={toggleEnabled}
          >
            {config.enabled ? "Desligar" : "Ligar"}
          </Button>
        }
      />

      {pausedReason && (
        <div className="bg-red-950/40 border border-red-700/50 rounded-lg px-2 py-1.5 mb-2 text-[11px]">
          <span className="text-red-300 font-bold">⏸ {pausedReason}</span>
          <button
            onClick={resetBank}
            className="ml-2 text-amber-300 hover:text-amber-200 font-bold text-[10px]"
          >
            Resetar banca
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-2">
        <div className="bg-neutral-900/50 rounded p-1.5">
          <div className="text-[9px] text-neutral-500 uppercase tracking-wider font-bold">Banca</div>
          <div
            className={`text-base font-bold font-mono ${
              tone === "good"
                ? "text-emerald-300"
                : tone === "bad"
                ? "text-red-300"
                : "text-neutral-200"
            }`}
          >
            {fmt(config.currentBank)}
          </div>
          <div className="text-[9px] text-neutral-500 font-mono">
            inicial {fmt(config.startingBank)} · {drawdownPct >= 0 ? "-" : "+"}
            {Math.abs(drawdownPct * 100).toFixed(1)}%
          </div>
        </div>
        <div className="bg-neutral-900/50 rounded p-1.5">
          <div className="text-[9px] text-neutral-500 uppercase tracking-wider font-bold">PnL acum.</div>
          <div
            className={`text-base font-bold font-mono ${
              totalPnL >= 0 ? "text-emerald-300" : "text-red-300"
            }`}
          >
            {totalPnL >= 0 ? "+" : ""}
            {fmt(totalPnL)}
          </div>
          <div className="text-[9px] text-neutral-500 font-mono">
            ROI {(stats.roi * 100).toFixed(1)}%
          </div>
        </div>
        <div className="bg-neutral-900/50 rounded p-1.5">
          <div className="text-[9px] text-neutral-500 uppercase tracking-wider font-bold">
            Win rate
          </div>
          <div className="text-base font-bold font-mono text-cyan-300">
            {(stats.winRate * 100).toFixed(1)}%
          </div>
          <div className="text-[9px] text-neutral-500 font-mono">
            {totalHits}/{totalBets}
          </div>
        </div>
        <div className="bg-neutral-900/50 rounded p-1.5">
          <div className="text-[9px] text-neutral-500 uppercase tracking-wider font-bold">
            Pendentes
          </div>
          <div className="text-base font-bold font-mono text-amber-300">
            {pending.length}
          </div>
          <div className="text-[9px] text-neutral-500 font-mono">
            aguardando resolução
          </div>
        </div>
      </div>

      <details className="bg-neutral-900/40 rounded mb-2">
        <summary className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold cursor-pointer px-2 py-1">
          ⚙ Configurações
        </summary>
        <div className="grid grid-cols-2 gap-1.5 p-2 text-[10px]">
          <label className="block">
            <span className="text-neutral-500 uppercase tracking-wider font-bold">Stake R$</span>
            <input
              type="number"
              min={1}
              value={config.stake}
              onChange={(e) => setConfig({ stake: Math.max(1, Number(e.target.value) || 1) })}
              className="w-full mt-0.5 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs font-mono"
            />
          </label>
          <label className="block">
            <span className="text-neutral-500 uppercase tracking-wider font-bold">Banca inicial R$</span>
            <input
              type="number"
              min={10}
              value={config.startingBank}
              onChange={(e) =>
                setConfig({ startingBank: Math.max(10, Number(e.target.value) || 200) })
              }
              className="w-full mt-0.5 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs font-mono"
            />
          </label>
          <label className="block">
            <span className="text-neutral-500 uppercase tracking-wider font-bold">Max perdas seguidas</span>
            <input
              type="number"
              min={2}
              value={config.maxConsecutiveLosses}
              onChange={(e) =>
                setConfig({ maxConsecutiveLosses: Math.max(2, Number(e.target.value) || 6) })
              }
              className="w-full mt-0.5 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs font-mono"
            />
          </label>
          <label className="block">
            <span className="text-neutral-500 uppercase tracking-wider font-bold">Stop drawdown %</span>
            <input
              type="number"
              min={5}
              max={90}
              value={config.stopOnDrawdownPct}
              onChange={(e) =>
                setConfig({ stopOnDrawdownPct: Math.max(5, Math.min(90, Number(e.target.value) || 20)) })
              }
              className="w-full mt-0.5 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs font-mono"
            />
          </label>
          <label className="block col-span-2 flex items-center gap-2 mt-1">
            <input
              type="checkbox"
              checked={config.onlyStrict}
              onChange={(e) => setConfig({ onlyStrict: e.target.checked })}
              className="accent-amber-500"
            />
            <span className="text-neutral-300">
              Só apostar quando passar validação estrita (recomendado)
            </span>
          </label>
        </div>
      </details>

      {history.length > 0 && (
        <details className="bg-neutral-900/40 rounded">
          <summary className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold cursor-pointer px-2 py-1 flex items-center justify-between">
            <span>📋 Últimas {Math.min(20, history.length)} apostas</span>
            <button
              onClick={(e) => {
                e.preventDefault();
                if (confirmClear) {
                  clearHistory();
                  setConfirmClear(false);
                } else {
                  setConfirmClear(true);
                  setTimeout(() => setConfirmClear(false), 3000);
                }
              }}
              className="text-red-400 hover:text-red-300"
            >
              {confirmClear ? "confirmar?" : "limpar"}
            </button>
          </summary>
          <div className="max-h-48 overflow-y-auto p-1 space-y-0.5">
            {history.slice(0, 20).map((r) => (
              <div
                key={r.id}
                className={`flex items-center gap-2 text-[10px] px-1.5 py-1 rounded ${
                  r.hit ? "bg-emerald-950/40" : "bg-red-950/40"
                }`}
              >
                <span className="text-neutral-400 font-mono shrink-0">
                  {new Date(r.t).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
                <span className="text-neutral-300 truncate flex-1">{r.targetLabel}</span>
                <span className="text-neutral-500 font-mono shrink-0">
                  {r.payout.toFixed(1)}:1
                </span>
                <span className="text-neutral-500 font-mono shrink-0">{r.spinN ?? "—"}</span>
                <span
                  className={`font-mono font-bold shrink-0 ${
                    r.delta >= 0 ? "text-emerald-300" : "text-red-300"
                  }`}
                >
                  {r.delta >= 0 ? "+" : ""}
                  {fmt(r.delta)}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}

      <div className="text-[9px] text-neutral-600 italic mt-2 text-center leading-snug">
        ⚠ Simulação em papel · não aposta no cassino real (sem API). Use o resultado pra ver
        empiricamente se vale apostar manualmente. Casa retém 2,7% — sessão suficientemente
        longa tende a banca negativa.
      </div>
    </Card>
  );
});
AutoBetPanel.displayName = "AutoBetPanel";

export default AutoBetPanel;
