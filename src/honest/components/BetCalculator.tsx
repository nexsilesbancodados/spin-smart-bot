import { memo, useMemo, useState } from "react";
import { useHonestStore } from "../lib/store";
import { Card, SectionHeader } from "./ui";

type BetType = {
  id: string;
  label: string;
  payout: number;
  prob: number;
};

const BET_TYPES: BetType[] = [
  { id: "even", label: "Vermelho / Preto / Par / Ímpar / 1-18 / 19-36", payout: 1, prob: 18 / 37 },
  { id: "dozen", label: "Dúzia ou Coluna", payout: 2, prob: 12 / 37 },
  { id: "line", label: "Sixaine (6 nº)", payout: 5, prob: 6 / 37 },
  { id: "corner", label: "Quina (4 nº)", payout: 8, prob: 4 / 37 },
  { id: "street", label: "Rua (3 nº)", payout: 11, prob: 3 / 37 },
  { id: "split", label: "Cavalo (2 nº)", payout: 17, prob: 2 / 37 },
  { id: "straight", label: "Pleno (1 nº)", payout: 35, prob: 1 / 37 },
  { id: "neighbors5", label: "Vizinhos do número (5)", payout: 6.4, prob: 5 / 37 },
  { id: "neighbors9", label: "Vizinhos do número (9)", payout: 3.11, prob: 9 / 37 },
];

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const BetCalculator = memo(() => {
  const bankroll = useHonestStore((s) => s.session.current || s.session.initial || 100);
  const [stake, setStake] = useState<number>(() => Math.max(1, Math.floor(bankroll * 0.02)));
  const [selected, setSelected] = useState<string>("even");

  const bet = BET_TYPES.find((b) => b.id === selected) || BET_TYPES[0];

  const calc = useMemo(() => {
    const winAmount = stake * bet.payout;
    const totalReturn = stake + winAmount;
    const ev = bet.prob * winAmount - (1 - bet.prob) * stake;
    const evPct = stake > 0 ? (ev / stake) * 100 : 0;
    const breakEvenPct = 1 / (bet.payout + 1);
    return { winAmount, totalReturn, ev, evPct, breakEvenPct };
  }, [stake, bet]);

  const presets = [
    { label: "1%", value: Math.max(1, Math.floor(bankroll * 0.01)) },
    { label: "2%", value: Math.max(1, Math.floor(bankroll * 0.02)) },
    { label: "5%", value: Math.max(1, Math.floor(bankroll * 0.05)) },
    { label: "R$10", value: 10 },
    { label: "R$25", value: 25 },
    { label: "R$50", value: 50 },
  ];

  return (
    <Card padding="sm">
      <SectionHeader title="Calculadora de aposta" eyebrow="Ferramenta" />
      <div className="flex flex-wrap gap-1 mb-2">
        {BET_TYPES.map((b) => (
          <button
            key={b.id}
            onClick={() => setSelected(b.id)}
            className={`px-2 py-1 rounded-md text-[10px] font-bold transition ${
              b.id === selected
                ? "bg-amber-500 text-black"
                : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
            }`}
            title={`Paga ${b.payout}:1 · ${(b.prob * 100).toFixed(1)}%`}
          >
            {b.payout}:1
          </button>
        ))}
      </div>
      <div className="text-[11px] text-neutral-400 mb-2">{bet.label}</div>

      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">Aposta</span>
        <input
          type="number"
          min={1}
          step={1}
          value={stake}
          onChange={(e) => setStake(Math.max(0, Number(e.target.value) || 0))}
          className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm font-mono text-white focus:border-amber-400 outline-none"
        />
        <span className="text-[10px] text-neutral-500 font-mono">
          {bankroll > 0 ? `${((stake / bankroll) * 100).toFixed(1)}% banca` : ""}
        </span>
      </div>

      <div className="flex flex-wrap gap-1 mb-2">
        {presets.map((p) => (
          <button
            key={p.label}
            onClick={() => setStake(p.value)}
            className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-amber-500/30 text-[10px] text-neutral-300 hover:text-amber-300 font-bold transition"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-1.5 text-[11px]">
        <div className="bg-neutral-900/50 rounded p-1.5">
          <div className="text-[9px] text-neutral-500 uppercase tracking-wider">Se ganhar</div>
          <div className="font-bold text-emerald-300 font-mono">+{fmt(calc.winAmount)}</div>
        </div>
        <div className="bg-neutral-900/50 rounded p-1.5">
          <div className="text-[9px] text-neutral-500 uppercase tracking-wider">Retorno total</div>
          <div className="font-bold text-amber-300 font-mono">{fmt(calc.totalReturn)}</div>
        </div>
        <div className="bg-neutral-900/50 rounded p-1.5">
          <div className="text-[9px] text-neutral-500 uppercase tracking-wider">Probabilidade</div>
          <div className="font-bold text-cyan-300 font-mono">{(bet.prob * 100).toFixed(2)}%</div>
        </div>
        <div className="bg-neutral-900/50 rounded p-1.5">
          <div className="text-[9px] text-neutral-500 uppercase tracking-wider">EV esperado</div>
          <div className={`font-bold font-mono ${calc.ev >= 0 ? "text-emerald-300" : "text-red-300"}`}>
            {calc.ev >= 0 ? "+" : ""}
            {fmt(calc.ev)} ({calc.evPct.toFixed(1)}%)
          </div>
        </div>
      </div>

      <div className="mt-2 text-[10px] text-neutral-500 leading-snug">
        Break-even a {(calc.breakEvenPct * 100).toFixed(1)}% — qualquer prob. acima disso vira lucro
        esperado. Casa retém ~2,7% sob distribuição justa.
      </div>
    </Card>
  );
});
BetCalculator.displayName = "BetCalculator";

export default BetCalculator;
