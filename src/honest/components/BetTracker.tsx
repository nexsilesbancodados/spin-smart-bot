import { memo, useMemo, useState } from "react";
import { useBetTracker, computeTrackerStats } from "../lib/betTracker";
import { Card, SectionHeader, Button } from "./ui";

const BET_OPTIONS = [
  { label: "1:1 (cor/par/alto)", payout: 1 },
  { label: "2:1 (dúzia/coluna)", payout: 2 },
  { label: "5:1 (sixain)", payout: 5 },
  { label: "8:1 (quina)", payout: 8 },
  { label: "11:1 (rua)", payout: 11 },
  { label: "17:1 (cavalo)", payout: 17 },
  { label: "35:1 (pleno)", payout: 35 },
];

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const BetTracker = memo(() => {
  const entries = useBetTracker((s) => s.entries);
  const addEntry = useBetTracker((s) => s.addEntry);
  const resolveEntry = useBetTracker((s) => s.resolveEntry);
  const removeEntry = useBetTracker((s) => s.removeEntry);
  const clearAll = useBetTracker((s) => s.clearAll);

  const [betType, setBetType] = useState(BET_OPTIONS[0].label);
  const [payout, setPayout] = useState(1);
  const [stake, setStake] = useState(10);
  const [note, setNote] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);

  const stats = useMemo(() => computeTrackerStats(entries), [entries]);

  const handleAdd = (outcome: "win" | "loss" | null) => {
    addEntry({ betType, payout, stake, outcome, note: note || undefined });
    setNote("");
  };

  return (
    <Card padding="sm">
      <SectionHeader
        title="Tracker pessoal de jogadas"
        eyebrow="Ferramenta"
        actions={
          entries.length > 0 ? (
            <button
              onClick={() => {
                if (confirmClear) {
                  clearAll();
                  setConfirmClear(false);
                } else {
                  setConfirmClear(true);
                  setTimeout(() => setConfirmClear(false), 3000);
                }
              }}
              className="text-[10px] text-red-400 hover:text-red-300 font-bold"
            >
              {confirmClear ? "Confirmar?" : "Limpar"}
            </button>
          ) : null
        }
      />

      {entries.length > 0 && (
        <div className="grid grid-cols-4 gap-1 mb-2 text-center">
          <div className="bg-neutral-900/60 rounded p-1.5">
            <div className="text-[8px] text-neutral-500 uppercase tracking-wider">PnL</div>
            <div className={`text-sm font-bold font-mono ${stats.pnl >= 0 ? "text-emerald-300" : "text-red-300"}`}>
              {stats.pnl >= 0 ? "+" : ""}{fmt(stats.pnl)}
            </div>
          </div>
          <div className="bg-neutral-900/60 rounded p-1.5">
            <div className="text-[8px] text-neutral-500 uppercase tracking-wider">ROI</div>
            <div className={`text-sm font-bold font-mono ${stats.roi >= 0 ? "text-emerald-300" : "text-red-300"}`}>
              {(stats.roi * 100).toFixed(1)}%
            </div>
          </div>
          <div className="bg-neutral-900/60 rounded p-1.5">
            <div className="text-[8px] text-neutral-500 uppercase tracking-wider">Win rate</div>
            <div className="text-sm font-bold font-mono text-cyan-300">
              {(stats.winRate * 100).toFixed(0)}%
            </div>
          </div>
          <div className="bg-neutral-900/60 rounded p-1.5">
            <div className="text-[8px] text-neutral-500 uppercase tracking-wider">
              {stats.currentStreakKind === "win" ? "Acertos" : stats.currentStreakKind === "loss" ? "Erros" : "Sequência"}
            </div>
            <div className={`text-sm font-bold font-mono ${stats.currentStreakKind === "win" ? "text-emerald-300" : stats.currentStreakKind === "loss" ? "text-red-300" : "text-neutral-400"}`}>
              {stats.currentStreak || "—"}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-1.5 mb-2">
        <select
          value={betType}
          onChange={(e) => {
            const opt = BET_OPTIONS.find((b) => b.label === e.target.value);
            if (opt) {
              setBetType(opt.label);
              setPayout(opt.payout);
            }
          }}
          className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs"
        >
          {BET_OPTIONS.map((b) => (
            <option key={b.label} value={b.label}>{b.label}</option>
          ))}
        </select>
        <div className="flex gap-1.5">
          <input
            type="number"
            min={1}
            value={stake}
            onChange={(e) => setStake(Math.max(0, Number(e.target.value) || 0))}
            placeholder="Aposta R$"
            className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs font-mono"
          />
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Nota (opcional)"
            className="flex-[2] bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs"
            maxLength={40}
          />
        </div>
        <div className="flex gap-1.5">
          <Button variant="success" size="sm" onClick={() => handleAdd("win")} disabled={stake <= 0}>
            ✓ Ganhei
          </Button>
          <Button variant="danger" size="sm" onClick={() => handleAdd("loss")} disabled={stake <= 0}>
            ✗ Perdi
          </Button>
          <Button variant="secondary" size="sm" onClick={() => handleAdd(null)} disabled={stake <= 0}>
            Pendente
          </Button>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="text-[11px] text-neutral-500 italic text-center py-2">
          Anote suas jogadas para ver PnL real e ROI ao vivo
        </div>
      ) : (
        <div className="max-h-[200px] overflow-y-auto space-y-1">
          {entries.slice(0, 15).map((e) => (
            <div
              key={e.id}
              className={`flex items-center gap-1.5 text-[10px] px-1.5 py-1 rounded ${
                e.outcome === "win" ? "bg-emerald-950/40" : e.outcome === "loss" ? "bg-red-950/40" : "bg-neutral-900/40"
              }`}
            >
              <span className="text-neutral-400 font-mono shrink-0">
                {new Date(e.t).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </span>
              <span className="text-neutral-300 truncate flex-1">
                {e.betType.split(" ")[0]} · {fmt(e.stake)}
                {e.note && <span className="text-neutral-500"> · {e.note}</span>}
              </span>
              {e.outcome === null ? (
                <>
                  <button
                    onClick={() => resolveEntry(e.id, "win")}
                    className="text-emerald-400 hover:text-emerald-300 font-bold px-1"
                  >✓</button>
                  <button
                    onClick={() => resolveEntry(e.id, "loss")}
                    className="text-red-400 hover:text-red-300 font-bold px-1"
                  >✗</button>
                </>
              ) : (
                <span className={`font-bold font-mono shrink-0 ${e.delta >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                  {e.delta >= 0 ? "+" : ""}{fmt(e.delta)}
                </span>
              )}
              <button
                onClick={() => removeEntry(e.id)}
                className="text-neutral-600 hover:text-red-400 px-1"
                title="Remover"
              >×</button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
});
BetTracker.displayName = "BetTracker";

export default BetTracker;
