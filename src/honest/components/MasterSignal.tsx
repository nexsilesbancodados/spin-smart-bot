import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useHonestStore } from "../lib/store";
import { useSignalAgent } from "../lib/signalAgent";
import { computeMasterSignal, MasterCandidate } from "../lib/masterSignal";
import { useMasterSignalState } from "../lib/masterSignalState";
import { usePatternLearning } from "../lib/patternLearning";
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

const labelTag = (c: MasterCandidate): string => {
  if (c.prob >= 0.45 && c.lift >= 1.1) return "ALTÍSSIMA CHANCE";
  if (c.prob >= 0.32 && c.lift >= 1.1) return "ALTA CHANCE";
  if (c.prob >= 0.18 && c.lift >= 1.2) return "BOA CHANCE";
  if (c.lift >= 1.4) return "EDGE FORTE";
  if (c.lift >= 1.1) return "OPORTUNIDADE";
  return "BAIXA CHANCE";
};

const tagAccent = (tag: string): "good" | "warn" | "neutral" | "bad" => {
  if (tag === "ALTÍSSIMA CHANCE" || tag === "ALTA CHANCE") return "good";
  if (tag === "BOA CHANCE" || tag === "EDGE FORTE") return "warn";
  if (tag === "OPORTUNIDADE") return "neutral";
  return "bad";
};

const MasterSignal = memo(() => {
  const spins = useHonestStore((s) => s.spins);
  const latest = useSignalAgent((s) => s.latest);
  usePatternLearning((s) => s.totalLearned);
  const recordShown = useMasterSignalState((s) => s.recordShown);
  const resolveLast = useMasterSignalState((s) => s.resolveLast);
  const recentWinners = useMasterSignalState((s) => s.recent);
  const [stake, setStake] = useState(50);
  const [showAlts, setShowAlts] = useState(false);
  const prevSpinCountRef = useRef(spins.length);

  const history = useMemo(() => spins.map((s) => s.n), [spins]);
  const { ranked, summary } = useMemo(
    () => computeMasterSignal(history, latest),
    [history, latest]
  );

  useEffect(() => {
    if (spins.length > prevSpinCountRef.current && spins.length > 0) {
      const newest = spins[0].n;
      const candidateNumbers = recentWinners.map((w) => {
        const numbers = ranked.find((r) => r.numbersKey === w.numbersKey)?.numbers;
        return numbers ?? [];
      });
      resolveLast(newest, candidateNumbers);
    }
    prevSpinCountRef.current = spins.length;
  }, [spins, ranked, resolveLast, recentWinners]);

  useEffect(() => {
    if (ranked.length > 0) {
      recordShown(ranked[0].id, ranked[0].numbersKey, spins.length);
    }
  }, [ranked, recordShown, spins.length]);

  if (history.length < 6) {
    return (
      <Card padding="md">
        <SectionHeader title="🎯 Sinal Mestre" eyebrow="Combinação de todas as análises" />
        <div className="text-[11px] text-neutral-500 italic py-2 text-center">
          Aguardando histórico mínimo (atual: {history.length} giros)
        </div>
      </Card>
    );
  }

  if (ranked.length === 0) {
    return (
      <Card padding="md">
        <SectionHeader title="🎯 Sinal Mestre" eyebrow="Combinação de todas as análises" />
        <div className="text-[11px] text-neutral-500 italic py-2 text-center">
          Nenhum padrão suficientemente confiável ativado. Aguarde próximo giro.
        </div>
      </Card>
    );
  }

  const winner = ranked[0];
  const alternatives = ranked.slice(1, 5);

  const lastResolved = recentWinners.find((w) => w.resolved);
  const recentHits = recentWinners.filter((w) => w.resolved && w.hit).length;
  const recentMisses = recentWinners.filter((w) => w.resolved && w.hit === false).length;
  const tag = labelTag(winner);
  const accent = tagAccent(tag);

  const ev = winner.prob * winner.payout - (1 - winner.prob);
  const potentialReturn = stake * winner.payout;
  const evReais = ev * stake;
  const kelly = Math.max(
    0,
    Math.min(0.5, (winner.prob * (winner.payout + 1) - 1) / winner.payout)
  );

  const numbersPreview = winner.numbers.slice(0, 12);

  const enginesUsed: string[] = [];
  if (winner.patternRule) enginesUsed.push("padrões aprendidos");
  if (winner.unifiedCandidate) enginesUsed.push("análise unificada (Markov + recência + IA)");

  return (
    <Card
      padding="md"
      accent={accent === "good" ? "good" : accent === "bad" ? "bad" : "warn"}
    >
      <SectionHeader
        title={
          <span className="flex items-center gap-2">
            🎯 Sinal Mestre
            <Pill accent={accent}>{tag}</Pill>
            {recentWinners.length >= 3 && (
              <span className="text-[9px] font-mono text-neutral-500">
                últimos: <span className="text-emerald-300">{recentHits}✓</span>/
                <span className="text-red-300">{recentMisses}✗</span>
              </span>
            )}
          </span>
        }
        eyebrow="Todas as análises combinadas → 1 única jogada mais provável"
        subtitle={
          <span className="text-[10px] text-neutral-500">
            {summary.bankSize} padrões + análise unificada · {summary.trackedRules} regras treinadas ·{" "}
            {summary.learnedTotal} aprendizagens · acerto global{" "}
            {(summary.learnedAccuracy * 100).toFixed(1)}%
            {lastResolved && (
              <span className="ml-1">
                · último {lastResolved.hit ? <span className="text-emerald-300">acertou</span> : <span className="text-red-300">errou</span>}
              </span>
            )}
          </span>
        }
      />

      <div
        className={`rounded-2xl border-2 p-4 mb-3 ${
          accent === "good"
            ? "border-emerald-500 bg-gradient-to-br from-emerald-950/70 to-neutral-950 shadow-lg shadow-emerald-500/30"
            : accent === "warn"
            ? "border-amber-500 bg-gradient-to-br from-amber-950/70 to-neutral-950 shadow-lg shadow-amber-500/20"
            : accent === "bad"
            ? "border-red-500/60 bg-gradient-to-br from-red-950/40 to-neutral-950"
            : "border-neutral-700 bg-neutral-900/60"
        }`}
      >
        <div className="text-center mb-2">
          <div className="text-[10px] uppercase tracking-[0.22em] text-neutral-400 font-bold mb-1">
            {winner.targetType}
          </div>
          <div className="text-4xl sm:text-5xl font-black text-white leading-tight">
            {winner.targetLabel}
          </div>
          <div className="text-amber-300 font-mono text-sm font-bold mt-1">
            paga {winner.payout.toFixed(1)}:1 · cobre {winner.coverage} nº
          </div>
        </div>

        <div
          className={`mx-auto max-w-md rounded-xl border p-2.5 my-2 text-center ${
            accent === "good"
              ? "border-emerald-600/60 bg-emerald-950/50"
              : accent === "warn"
              ? "border-amber-600/60 bg-amber-950/50"
              : "border-neutral-700 bg-neutral-900/60"
          }`}
        >
          <div className="text-[9px] uppercase tracking-[0.18em] text-neutral-400 font-bold">
            Chance combinada de acertar
          </div>
          <div
            className={`text-5xl sm:text-6xl font-black font-mono leading-none my-1 ${
              winner.prob >= 0.45
                ? "text-emerald-300"
                : winner.prob >= 0.25
                ? "text-amber-300"
                : "text-neutral-200"
            }`}
          >
            {(winner.prob * 100).toFixed(1)}%
          </div>
          <div className="text-[10px] text-neutral-400 font-mono">
            {winner.lift.toFixed(2)}× o acaso ({(winner.baseline * 100).toFixed(1)}%) · confiança{" "}
            {(winner.confidence * 100).toFixed(0)}% · score {winner.accuracyScore.toFixed(3)}
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
          <span
            className={`font-mono ${evReais >= 0 ? "text-emerald-300" : "text-red-300"}`}
          >
            EV {evReais >= 0 ? "+" : ""}
            {fmt(evReais)}
          </span>
        </div>

        {kelly > 0 && (
          <div className="text-[10px] text-amber-300/80 mt-1 font-mono text-center">
            💰 Kelly: aposte até {(kelly * 100).toFixed(1)}% da banca
          </div>
        )}

        <div className="text-[10px] text-neutral-300 mt-2 leading-snug text-center">
          <span className="text-neutral-500 uppercase tracking-wider font-bold">razão:</span>{" "}
          {winner.reasoning}
        </div>

        <div className="text-[9px] text-neutral-500 mt-1 text-center">
          motores: {enginesUsed.join(" + ")}
        </div>

        {numbersPreview.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2 justify-center">
            {numbersPreview.map((n) => (
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
        onClick={() => setShowAlts((v) => !v)}
        className="w-full text-[10px] text-neutral-400 hover:text-amber-300 text-center py-1"
      >
        {showAlts
          ? "▲ ocultar alternativas"
          : `▼ ver ${alternatives.length} próximas jogadas ranqueadas`}
      </button>

      {showAlts && (
        <div className="space-y-1 mt-1">
          {alternatives.map((c, i) => {
            const t = labelTag(c);
            const ta = tagAccent(t);
            return (
              <div
                key={c.id}
                className="flex items-center gap-2 bg-neutral-900/50 rounded px-2 py-1.5 text-[11px]"
              >
                <div className="w-5 text-neutral-500 font-bold text-center shrink-0">
                  {i + 2}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-neutral-200 truncate">
                    <span className="text-[9px] uppercase tracking-wider text-neutral-500 mr-1">
                      {c.targetType}
                    </span>
                    {c.targetLabel}
                  </div>
                  <div className="text-[9px] text-neutral-500 truncate">{c.reasoning}</div>
                </div>
                <div className="text-right shrink-0 font-mono">
                  <div className="font-bold text-emerald-300">
                    {(c.prob * 100).toFixed(1)}%
                  </div>
                  <div className="text-[9px] text-neutral-500">
                    {c.lift.toFixed(2)}× · {c.payout.toFixed(1)}:1
                  </div>
                </div>
                <Pill accent={ta}>{t}</Pill>
              </div>
            );
          })}
        </div>
      )}

      <div className="text-[9px] text-neutral-600 italic mt-2 text-center">
        Score = prob × edge × confiança. Sinais combinam padrões aprendidos + Markov + recência +
        agente IA. Casa retém 2,7%.
      </div>
    </Card>
  );
});
MasterSignal.displayName = "MasterSignal";

export default MasterSignal;
