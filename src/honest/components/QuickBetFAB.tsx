import { memo, useState } from "react";
import { useBetTracker } from "../lib/betTracker";

const PRESETS = [
  { label: "1:1", payout: 1 },
  { label: "2:1", payout: 2 },
  { label: "5:1", payout: 5 },
  { label: "35:1", payout: 35 },
];

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });

const QuickBetFAB = memo(() => {
  const addEntry = useBetTracker((s) => s.addEntry);
  const lastEntry = useBetTracker((s) => s.entries[0]);
  const [open, setOpen] = useState(false);
  const [stake, setStake] = useState<number>(() => lastEntry?.stake || 10);
  const [payout, setPayout] = useState<number>(() => lastEntry?.payout || 1);

  const submit = (outcome: "win" | "loss") => {
    const preset = PRESETS.find((p) => p.payout === payout);
    addEntry({
      betType: preset?.label || `${payout}:1`,
      payout,
      stake,
      outcome,
    });
    setOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full shadow-lg shadow-amber-500/40 flex items-center justify-center text-2xl font-bold transition-transform active:scale-95 ${
          open ? "bg-red-500 text-white rotate-45" : "bg-amber-500 text-black"
        }`}
        title={open ? "Fechar" : "Registrar aposta rápida"}
      >
        {open ? "×" : "+"}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-40 w-72 bg-neutral-950 border border-amber-500/40 rounded-xl shadow-2xl shadow-amber-500/20 p-3 space-y-2 [animation:pop_0.2s_ease-out]">
          <div className="text-[10px] uppercase tracking-wider text-amber-400 font-black">
            Aposta rápida
          </div>

          <div className="flex gap-1">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => setPayout(p.payout)}
                className={`flex-1 px-2 py-1.5 rounded text-xs font-bold ${
                  payout === p.payout ? "bg-amber-500 text-black" : "bg-neutral-800 text-neutral-300"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold">
              R$
            </span>
            <input
              type="number"
              value={stake}
              onChange={(e) => setStake(Math.max(0, Number(e.target.value) || 0))}
              className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm font-mono"
            />
          </div>

          <div className="flex gap-1">
            {[10, 25, 50, 100].map((v) => (
              <button
                key={v}
                onClick={() => setStake(v)}
                className="flex-1 px-1 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-[10px] font-bold text-neutral-300"
              >
                {fmt(v)}
              </button>
            ))}
          </div>

          <div className="flex gap-1.5 pt-1">
            <button
              onClick={() => submit("win")}
              disabled={stake <= 0}
              className="flex-1 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-black disabled:opacity-40"
            >
              ✓ Ganhei
            </button>
            <button
              onClick={() => submit("loss")}
              disabled={stake <= 0}
              className="flex-1 px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-black disabled:opacity-40"
            >
              ✗ Perdi
            </button>
          </div>
        </div>
      )}
    </>
  );
});
QuickBetFAB.displayName = "QuickBetFAB";

export default QuickBetFAB;
