import { memo, useMemo } from "react";
import { useSignalAgent } from "../lib/signalAgent";
import { useHonestStore } from "../lib/store";
import { generateAllBets, rankBets } from "../lib/betTypes";
import { useRiskProfile, RISK_LABELS } from "../lib/riskProfile";
import { SLOTS, colorOf } from "../lib/wheel";
import { Card, SectionHeader, Pill, Stat, StatGrid } from "./ui";

const ballBg = (n: number) => {
  const c = colorOf(n);
  if (c === "green") return "bg-emerald-600";
  if (c === "red") return "bg-red-600";
  return "bg-neutral-800";
};

const BestBetRecommendation = memo(() => {
  const latest = useSignalAgent((s) => s.latest);
  const spins = useHonestStore((s) => s.spins);
  const profile = useRiskProfile((s) => s.profile);
  const setProfile = useRiskProfile((s) => s.setProfile);

  const recentSpinsKey = useMemo(() => spins.slice(0, 50).map((s) => s.n).join(","), [spins]);
  const ranked = useMemo(() => {
    if (!latest) return [];
    const probs = new Float32Array(SLOTS);
    let totalLogged = 0;
    for (let i = 0; i < latest.topPicks.length; i++) {
      probs[latest.topPicks[i]] = latest.topProbs[i];
      totalLogged += latest.topProbs[i];
    }
    const remaining = 1 - totalLogged;
    const remainingCount = SLOTS - latest.topPicks.length;
    if (remainingCount > 0) {
      const eachRemaining = Math.max(0, remaining / remainingCount);
      for (let n = 0; n < SLOTS; n++) {
        if (!latest.topPicks.includes(n)) probs[n] = eachRemaining;
      }
    }
    const recentSpins = recentSpinsKey.length > 0 ? recentSpinsKey.split(",").map(Number) : [];
    const bets = generateAllBets({
      topPicks: latest.topPicks,
      topProbs: latest.topProbs,
      mainPick: latest.mainPick,
      recentSpins,
      modelProbs: probs,
    });
    return rankBets(bets, profile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latest, recentSpinsKey, profile]);

  if (!latest || ranked.length === 0) return null;

  const winner = ranked[0];
  const runners = ranked.slice(1, 4);

  return (
    <Card accent="warn">
      <SectionHeader
        title="🏆 Melhor Jogada Recomendada"
        subtitle={`Perfil ${RISK_LABELS[profile].emoji} ${RISK_LABELS[profile].label}: ${RISK_LABELS[profile].description}`}
        actions={
          <div className="flex gap-1 rounded-lg border border-neutral-700 overflow-hidden">
            {(["conservative", "balanced", "aggressive"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setProfile(p)}
                className={`px-2.5 py-1 text-xs font-semibold ${
                  profile === p ? "bg-amber-500 text-black" : "bg-neutral-900 text-neutral-300 hover:bg-neutral-800"
                }`}
                title={RISK_LABELS[p].description}
              >
                {RISK_LABELS[p].emoji}
              </button>
            ))}
          </div>
        }
      />

      <div className="rounded-2xl border-2 border-amber-500/50 bg-gradient-to-br from-amber-950/30 to-neutral-950 p-4">
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <Pill accent="warn">👑 TOP RANK</Pill>
          <span className="text-lg font-bold">{winner.label}</span>
          <span className="text-[10px] uppercase tracking-wider text-neutral-500">{winner.category}</span>
        </div>

        <p className="text-xs text-neutral-300 mb-3">{winner.description}</p>

        <StatGrid cols={4}>
          <Stat
            label="Hit prob modelo"
            value={`${(winner.hitProbabilityModel * 100).toFixed(1)}%`}
            sub={`baseline ${(winner.hitProbabilityBaseline * 100).toFixed(1)}% · lift ${winner.modelLift.toFixed(2)}×`}
            accent={winner.modelLift > 1 ? "good" : "neutral"}
          />
          <Stat
            label="Stake"
            value={`${winner.unitsRisked} un`}
            sub={`Paga ${winner.payoutOnHit} se acerta`}
          />
          <Stat
            label="EV por rodada (modelo)"
            value={`${winner.expectedReturnModel >= 0 ? "+" : ""}${winner.expectedReturnModel.toFixed(2)} un`}
            sub={`${(winner.evRatioPerUnit * 100).toFixed(1)}% sobre stake`}
            accent={winner.expectedReturnModel > 0 ? "good" : "bad"}
          />
          <Stat
            label="Sharpe (modelo)"
            value={winner.sharpe.toFixed(2)}
            sub={`Confiança ${(winner.confidence * 100).toFixed(0)}/100`}
            accent={winner.sharpe > 0 ? "good" : "bad"}
          />
        </StatGrid>

        <div className="mt-3">
          <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1.5">Números cobertos ({winner.coverage})</div>
          <div className="flex flex-wrap gap-1">
            {Array.from(winner.numbers).slice(0, 30).map((n) => (
              <span
                key={n}
                role="img"
                aria-label={`Número ${n}`}
                className={`${ballBg(n)} text-white text-[11px] font-bold w-8 h-8 rounded-md flex items-center justify-center`}
              >
                {n}
              </span>
            ))}
            {winner.numbers.size > 30 && (
              <span className="text-[10px] text-neutral-500 self-center ml-1">+{winner.numbers.size - 30}</span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3">
        <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold mb-2">Pódio</div>
        <div className="space-y-1.5">
          {runners.map((r, i) => (
            <div key={r.id} className="flex items-center gap-3 text-xs rounded-lg border border-neutral-800 bg-neutral-950/40 p-2">
              <span className="text-base font-bold w-6 text-center">
                {i === 0 ? "🥈" : i === 1 ? "🥉" : `#${i + 2}`}
              </span>
              <div className="flex-1">
                <div className="font-semibold">{r.label}</div>
                <div className="text-[10px] text-neutral-500">{r.category} · {r.coverage} nº</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-neutral-400">EV {(r.evRatioPerUnit * 100).toFixed(1)}%</div>
                <div className="text-[10px] text-neutral-500">hit {(r.hitProbabilityModel * 100).toFixed(0)}% · lift {r.modelLift.toFixed(1)}×</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 text-[10px] text-neutral-500 leading-relaxed border-t border-neutral-800 pt-3">
        <strong>Como o ranking funciona:</strong> combina EV teórico (modelo), Sharpe ratio (EV/desvio), hit rate
        teórico e confiança da concentração. Pesos mudam com perfil de risco. <strong>Importante:</strong> EV positivo
        só se concretiza se o modelo realmente acertou as probabilidades. Em mesa justa, convergência de longo prazo
        é −2,7%. Use isso como guia, não como garantia.
      </div>
    </Card>
  );
});
BestBetRecommendation.displayName = "BestBetRecommendation";

export default BestBetRecommendation;
