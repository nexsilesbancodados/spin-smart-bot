import { memo, useMemo, useState } from "react";
import { useSignalAgent } from "../lib/signalAgent";
import { useHonestStore } from "../lib/store";
import { generateAllBets, rankBets, type BetSignal } from "../lib/betTypes";
import { useRiskProfile } from "../lib/riskProfile";
import { SLOTS, colorOf } from "../lib/wheel";
import { Card, SectionHeader, Pill } from "./ui";

const ballBg = (n: number) => {
  const c = colorOf(n);
  if (c === "green") return "bg-emerald-600";
  if (c === "red") return "bg-red-600";
  return "bg-neutral-800";
};

const categories: Array<BetSignal["category"] | "all"> = ["all", "Pleno", "Combinada", "Vizinhança", "Setor", "Externa", "Cobertura"];

const BetTypePanel = memo(() => {
  const latest = useSignalAgent((s) => s.latest);
  const spins = useHonestStore((s) => s.spins);
  const profile = useRiskProfile((s) => s.profile);
  const [category, setCategory] = useState<BetSignal["category"] | "all">("all");

  const ranked = useMemo(() => {
    if (!latest) return [];
    const probs = new Float32Array(SLOTS);
    let totalLogged = 0;
    for (let i = 0; i < latest.topPicks.length; i++) {
      probs[latest.topPicks[i]] = latest.topProbs[i];
      totalLogged += latest.topProbs[i];
    }
    const remainingCount = SLOTS - latest.topPicks.length;
    if (remainingCount > 0) {
      const each = Math.max(0, (1 - totalLogged) / remainingCount);
      for (let n = 0; n < SLOTS; n++) {
        if (!latest.topPicks.includes(n)) probs[n] = each;
      }
    }
    const bets = generateAllBets({
      topPicks: latest.topPicks,
      topProbs: latest.topProbs,
      mainPick: latest.mainPick,
      recentSpins: spins.map((s) => s.n),
      modelProbs: probs,
    });
    return rankBets(bets, profile);
  }, [latest, spins, profile]);

  const filtered = useMemo(
    () => (category === "all" ? ranked : ranked.filter((b) => b.category === category)),
    [ranked, category]
  );

  if (!latest) {
    return (
      <Card>
        <SectionHeader title="🎲 Todos os Tipos de Aposta" subtitle="Aguardando primeiro sinal do agente." />
      </Card>
    );
  }

  return (
    <Card>
      <SectionHeader
        title="🎲 Todos os Tipos de Aposta"
        subtitle="Ranqueados pelo perfil de risco. EV calculado com probabilidades do modelo."
        actions={
          <div className="flex gap-1 overflow-x-auto">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap ${
                  category === c ? "bg-amber-500 text-black" : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                }`}
              >
                {c === "all" ? "Todos" : c}
              </button>
            ))}
          </div>
        }
      />
      <div className="space-y-2">
        {filtered.map((b) => {
          const rank = ranked.indexOf(b) + 1;
          return <BetRow key={b.id} bet={b} rank={rank} isTop={rank === 1 && category === "all"} />;
        })}
      </div>
    </Card>
  );
});
BetTypePanel.displayName = "BetTypePanel";

const BetRow = memo(({ bet, rank, isTop }: { bet: BetSignal; rank: number; isTop: boolean }) => {
  const isPositive = bet.expectedReturnModel > 0;
  return (
    <div
      className={`rounded-xl border p-3 ${
        isTop
          ? "border-amber-500/60 bg-amber-950/15"
          : isPositive
            ? "border-emerald-700/40 bg-emerald-950/10"
            : "border-neutral-800 bg-neutral-900/40"
      }`}
    >
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-base font-bold w-8 text-center">
          {rank === 1 ? "👑" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold truncate">{bet.label}</div>
          <div className="text-[10px] text-neutral-500 truncate">{bet.category} · {bet.description}</div>
        </div>
        <div className="flex flex-wrap gap-0.5 max-w-[120px]">
          {Array.from(bet.numbers).slice(0, 6).map((n) => (
            <span key={n} className={`${ballBg(n)} text-white text-[9px] font-bold w-4 h-4 rounded-sm flex items-center justify-center`}>
              {n}
            </span>
          ))}
          {bet.numbers.size > 6 && <span className="text-[9px] text-neutral-500 self-center ml-0.5">+{bet.numbers.size - 6}</span>}
        </div>
        <div className="text-right shrink-0">
          <Pill accent={isPositive ? "good" : "bad"}>
            EV {(bet.evRatioPerUnit * 100).toFixed(1)}%
          </Pill>
          <div className="text-[10px] text-neutral-500 font-mono mt-1">
            hit {(bet.hitProbabilityModel * 100).toFixed(0)}% · lift {bet.modelLift.toFixed(1)}×
          </div>
        </div>
      </div>
    </div>
  );
});
BetRow.displayName = "BetTypeRow";

export default BetTypePanel;
