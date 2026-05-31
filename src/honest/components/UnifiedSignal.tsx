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
  if (c.prob >= 0.5 && c.lift >= 1.05) return "ALTA CHANCE";
  if (c.prob >= 0.35 && c.lift >= 1.1) return "BOA CHANCE";
  if (c.prob >= 0.15 && c.lift >= 1.2) return "OPORTUNIDADE";
  if (c.lift >= 1.3) return "EDGE FORTE";
  return "BAIXA CHANCE";
};

const tagAccent = (tag: string): "good" | "warn" | "neutral" | "bad" => {
  if (tag === "ALTA CHANCE" || tag === "BOA CHANCE") return "good";
  if (tag === "OPORTUNIDADE" || tag === "EDGE FORTE") return "warn";
  if (tag === "BAIXA CHANCE") return "bad";
  return "neutral";
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

  return (
    <Card padding="md" accent={accent === "good" ? "good" : accent === "bad" ? "bad" : "warn"}>
      <SectionHeader
        title={
          <span className="flex items-center gap-2">
            🎯 Jogue agora em
            <Pill accent={accent}>{tag}</Pill>
          </span>
        }
        eyebrow="Sinal único · maior chance de acertar"
        subtitle={
          <span className="text-[10px] text-neutral-500">
            17 candidatos comparados · ensemble + LSTM + Markov 1-2 + recência ponderada + suporte IA
          </span>
        }
      />

      <div className={`rounded-2xl border-2 p-4 mb-3 ${
        accent === "good"
          ? "border-emerald-500 bg-gradient-to-br from-emerald-950/70 to-neutral-950 shadow-lg shadow-emerald-500/20"
          : accent === "warn"
          ? "border-amber-500 bg-gradient-to-br from-amber-950/70 to-neutral-950 shadow-lg shadow-amber-500/20"
          : accent === "bad"
          ? "border-red-500/60 bg-gradient-to-br from-red-950/40 to-neutral-950"
          : "border-neutral-700 bg-neutral-900/60"
      }`}>
        <div className="text-center mb-2">
          <div className="text-[10px] uppercase tracking-[0.22em] text-neutral-400 font-bold mb-1">
            {winner.label}
          </div>
          <div className="text-4xl sm:text-5xl font-black text-white leading-tight">
            {winner.target}
          </div>
          <div className="text-amber-300 font-mono text-sm font-bold mt-1">
            paga {winner.payout}:1 · cobre {winner.coverage} {winner.coverage === 1 ? "nº" : "nº"}
          </div>
        </div>

        <div className={`mx-auto max-w-md rounded-xl border p-2.5 my-2 text-center ${
          accent === "good" ? "border-emerald-600/50 bg-emerald-950/40" :
          accent === "warn" ? "border-amber-600/50 bg-amber-950/40" :
          "border-neutral-700 bg-neutral-900/60"
        }`}>
          <div className="text-[9px] uppercase tracking-[0.18em] text-neutral-400 font-bold">
            Chance estimada de acertar
          </div>
          <div className={`text-5xl font-black font-mono leading-none my-1 ${
            winner.prob >= 0.45 ? "text-emerald-300" : winner.prob >= 0.25 ? "text-amber-300" : "text-neutral-200"
          }`}>
            {(winner.prob * 100).toFixed(1)}%
          </div>
          <div className="text-[10px] text-neutral-400 font-mono">
            {winner.lift.toFixed(2)}× o acaso ({(winner.baseline * 100).toFixed(1)}%) ·
            confiança {(winner.confidence * 100).toFixed(0)}%
          </div>
        </div>

        <div className="flex items-center gap-2 mt-2 text-[10px] flex-wrap justify-center">
          <span className="text-neutral-500 uppercase tracking-wider font-bold shrink-0">
            Aposta R$
          </span>
          <input
            type="number"
            min={1}
            value={stake}
            onChange={(e) => setStake(Math.max(0, Number(e.target.value) || 0))}
            className="w-20 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm font-mono"
          />
          <span className="text-neutral-500">→</span>
          <span className="font-mono text-emerald-300 font-bold">
            +{fmt(potentialReturn)} se acertar
          </span>
          <span className="text-neutral-500">·</span>
          <span className={`font-mono ${evReais >= 0 ? "text-emerald-300" : "text-red-300"}`}>
            EV {evReais >= 0 ? "+" : ""}{fmt(evReais)}
          </span>
        </div>

        {winner.kelly > 0 && (
          <div className="text-[10px] text-amber-300/80 mt-1 font-mono text-center">
            💰 Kelly: {(winner.kelly * 100).toFixed(1)}% da banca (R${recommendedStake.toFixed(0)} → R${(recommendedStake * winner.kelly).toFixed(0)})
          </div>
        )}

        <div className="text-[10px] text-neutral-300 mt-2 leading-snug text-center">
          <span className="text-neutral-500 uppercase tracking-wider font-bold">por quê:</span>{" "}
          {winner.reasoning}
        </div>
        <div className="text-[9px] text-neutral-500 mt-1 text-center">
          fontes: {winner.sources.join(" + ")}
        </div>

        {winner.coverage <= 12 && (
          <div className="flex flex-wrap gap-1 mt-2 justify-center">
            {winner.numbers.slice(0, 12).map((n) => (
              <div
                key={n}
                className={`${ballBg(n)} text-white text-xs font-black w-8 h-8 rounded-full flex items-center justify-center ring-1 ring-white/30`}
              >
                {n}
              </div>
            ))}
            {winner.numbers.length > 12 && (
              <div className="text-neutral-500 text-[10px] self-center ml-1">
                +{winner.numbers.length - 12} nº
              </div>
            )}
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
        Ranqueado por chance de acertar × edge × confiança. Nenhuma jogada garante ganho — casa retém 2,7%.
      </div>
    </Card>
  );
});
UnifiedSignal.displayName = "UnifiedSignal";

export default UnifiedSignal;
