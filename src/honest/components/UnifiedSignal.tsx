import { memo, useMemo, useState } from "react";
import { useHonestStore } from "../lib/store";
import { useSignalAgent } from "../lib/signalAgent";
import { computeUnifiedSignal, UnifiedCandidate } from "../lib/unifiedAnalysis";
import { colorOf } from "../lib/wheel";
import { Card, SectionHeader, Pill } from "./ui";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const ballBg = (n: number) => {
  const c = colorOf(n);
  if (c === "green") return "bg-emerald-600";
  if (c === "red") return "bg-gradient-to-br from-red-500 to-red-700";
  return "bg-gradient-to-br from-neutral-700 to-neutral-900";
};

const labelTag = (c: UnifiedCandidate): string => {
  if (c.lift >= 1.4 && c.ev > -0.05) return "FORTE";
  if (c.lift >= 1.2 && c.ev > -0.1) return "MODERADO";
  if (c.lift > 1 && c.ev > -0.15) return "FRACO";
  return "EVITAR";
};

const tagAccent = (tag: string): "good" | "warn" | "neutral" | "bad" => {
  if (tag === "FORTE") return "good";
  if (tag === "MODERADO") return "warn";
  if (tag === "FRACO") return "neutral";
  return "bad";
};

const UnifiedSignal = memo(() => {
  const spins = useHonestStore((s) => s.spins);
  const latest = useSignalAgent((s) => s.latest);
  const [stake, setStake] = useState(50);
  const [expanded, setExpanded] = useState(false);

  const candidates = useMemo(() => {
    const nums = spins.map((s) => s.n);
    return computeUnifiedSignal(nums, latest);
  }, [spins, latest]);

  if (candidates.length === 0) {
    return (
      <Card padding="md">
        <SectionHeader title="🎯 Melhor Jogada Agora" eyebrow="Sinal unificado" />
        <div className="text-[11px] text-neutral-500 italic py-2 text-center">
          Aguardando ≥10 giros para gerar sinal unificado
        </div>
      </Card>
    );
  }

  const winner = candidates[0];
  const top5 = candidates.slice(1, 6);
  const tag = labelTag(winner);
  const accent = tagAccent(tag);

  const potentialReturn = stake * winner.payout;
  const evReais = winner.ev * stake;
  const recommendedStake = winner.kelly * 1000;

  const isWinner = (n: number) => winner.numbers.includes(n);

  return (
    <Card padding="md" accent={accent === "good" ? "good" : accent === "bad" ? "bad" : "warn"}>
      <SectionHeader
        title={
          <span className="flex items-center gap-2">
            🎯 Melhor Jogada Agora
            <Pill accent={accent}>{tag}</Pill>
          </span>
        }
        eyebrow="Sinal unificado de TODAS as análises"
        subtitle={
          <span className="text-[10px] text-neutral-500">
            Ensemble + LSTM + Markov 1-2 + recência + sectores + cor/par/alto · ranqueado por EV × confiança
          </span>
        }
      />

      <div className={`rounded-2xl border-2 p-3 mb-3 ${
        accent === "good"
          ? "border-emerald-500 bg-gradient-to-br from-emerald-950/60 to-neutral-950"
          : accent === "warn"
          ? "border-amber-500 bg-gradient-to-br from-amber-950/60 to-neutral-950"
          : accent === "bad"
          ? "border-red-500/60 bg-gradient-to-br from-red-950/40 to-neutral-950"
          : "border-neutral-700 bg-neutral-900/60"
      }`}>
        <div className="flex items-start justify-between gap-2 mb-1">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-400 font-bold">
              {winner.label}
            </div>
            <div className="text-3xl font-black text-white leading-none mt-0.5">{winner.target}</div>
          </div>
          <div className="text-right">
            <div className="text-[9px] uppercase tracking-wider text-neutral-500 font-bold">paga</div>
            <div className="text-2xl font-black text-amber-300 font-mono leading-none">
              {winner.payout}:1
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1 mt-2">
          <div className="bg-neutral-950/50 rounded p-1.5">
            <div className="text-[8px] text-neutral-500 uppercase tracking-wider">Prob estimada</div>
            <div className="font-mono font-bold text-emerald-300 text-sm">
              {(winner.prob * 100).toFixed(1)}%
            </div>
            <div className="text-[8px] text-neutral-500">
              vs {(winner.baseline * 100).toFixed(1)}% acaso
            </div>
          </div>
          <div className="bg-neutral-950/50 rounded p-1.5">
            <div className="text-[8px] text-neutral-500 uppercase tracking-wider">Lift</div>
            <div className={`font-mono font-bold text-sm ${winner.lift > 1 ? "text-amber-300" : "text-neutral-400"}`}>
              {winner.lift.toFixed(2)}×
            </div>
            <div className="text-[8px] text-neutral-500">
              vs aleatório
            </div>
          </div>
          <div className="bg-neutral-950/50 rounded p-1.5">
            <div className="text-[8px] text-neutral-500 uppercase tracking-wider">EV / R$1</div>
            <div className={`font-mono font-bold text-sm ${winner.ev >= 0 ? "text-emerald-300" : "text-red-300"}`}>
              {winner.ev >= 0 ? "+" : ""}{winner.ev.toFixed(3)}
            </div>
            <div className="text-[8px] text-neutral-500">
              {winner.ev >= 0 ? "positivo" : "negativo"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-2 text-[10px]">
          <span className="text-neutral-500 uppercase tracking-wider font-bold shrink-0">
            Stake R$
          </span>
          <input
            type="number"
            min={1}
            value={stake}
            onChange={(e) => setStake(Math.max(0, Number(e.target.value) || 0))}
            className="w-20 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm font-mono"
          />
          <span className="text-neutral-500">·</span>
          <span className="font-mono text-neutral-300">
            ganha <b className="text-emerald-300">+{fmt(potentialReturn)}</b>
          </span>
          <span className="text-neutral-500">·</span>
          <span className={`font-mono ${evReais >= 0 ? "text-emerald-300" : "text-red-300"}`}>
            EV {evReais >= 0 ? "+" : ""}{fmt(evReais)}
          </span>
        </div>

        {winner.kelly > 0 && (
          <div className="text-[10px] text-amber-300/80 mt-1 font-mono">
            💰 Kelly recomenda {(winner.kelly * 100).toFixed(1)}% da banca (em {fmt(recommendedStake)} = {fmt(recommendedStake * winner.kelly)})
          </div>
        )}

        <div className="text-[10px] text-neutral-400 mt-2 leading-snug">
          <span className="text-neutral-500 uppercase tracking-wider font-bold">razão:</span>{" "}
          {winner.reasoning}
        </div>
        <div className="text-[9px] text-neutral-500 mt-1">
          fontes: {winner.sources.join(" + ")}
        </div>

        {winner.coverage <= 6 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {winner.numbers.map((n) => (
              <div
                key={n}
                className={`${ballBg(n)} text-white text-xs font-black w-7 h-7 rounded-full flex items-center justify-center ring-1 ring-white/20`}
              >
                {n}
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-[10px] text-neutral-400 hover:text-amber-300 text-center py-1"
      >
        {expanded ? "▲ ocultar alternativas" : `▼ ver outras ${top5.length} jogadas ranqueadas`}
      </button>

      {expanded && (
        <div className="space-y-1 mt-1">
          {top5.map((c, i) => {
            const t = labelTag(c);
            const ta = tagAccent(t);
            const isWin = isWinner(c.numbers[0]);
            void isWin;
            return (
              <div
                key={c.id}
                className="flex items-center gap-2 bg-neutral-900/50 rounded px-2 py-1.5 text-[11px]"
              >
                <div className="w-5 text-neutral-500 font-bold text-center shrink-0">{i + 2}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-neutral-200 truncate">
                    <span className="text-[9px] uppercase tracking-wider text-neutral-500 mr-1">
                      {c.label}
                    </span>
                    {c.target}
                  </div>
                  <div className="text-[9px] text-neutral-500 truncate">{c.reasoning}</div>
                </div>
                <div className="text-right shrink-0 font-mono">
                  <div className={`font-bold ${c.ev >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                    EV {c.ev >= 0 ? "+" : ""}{c.ev.toFixed(3)}
                  </div>
                  <div className="text-[9px] text-neutral-500">
                    p={(c.prob * 100).toFixed(1)}% · {c.payout}:1
                  </div>
                </div>
                <Pill accent={ta}>{t}</Pill>
              </div>
            );
          })}
        </div>
      )}

      <div className="text-[9px] text-neutral-600 italic mt-2 text-center">
        Score = EV × (0.5 + 0.5×confiança). Mesmo "FORTE" não garante ganho — casa retém 2,7%.
      </div>
    </Card>
  );
});
UnifiedSignal.displayName = "UnifiedSignal";

export default UnifiedSignal;
