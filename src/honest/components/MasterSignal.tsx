import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useHonestStore } from "../lib/store";
import { useSignalAgent } from "../lib/signalAgent";
import { computeMasterSignal, MasterCandidate } from "../lib/masterSignal";
import { useMasterSignalState } from "../lib/masterSignalState";
import { useEngineWeights, summarizeEngines } from "../lib/engineWeights";
import { useUiPrefs } from "../lib/uiPrefs";
import { useAutoBet } from "../lib/autoBet";
import { usePatternLearning } from "../lib/patternLearning";
import {
  playSignalChord,
  showBrowserNotification,
  useNotifications,
} from "../lib/notifications";
import { fireMasterWebhook } from "../lib/webhook";
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
  if (c.prob >= 0.55) return "QUASE CERTO";
  if (c.prob >= 0.45) return "ALTÍSSIMA CHANCE";
  if (c.prob >= 0.32) return "ALTA CHANCE";
  if (c.prob >= 0.18) return "BOA CHANCE";
  if (c.lift >= 1.3) return "EDGE FORTE";
  if (c.lift >= 1.1) return "OPORTUNIDADE";
  return "BAIXA CHANCE";
};

const tagAccent = (tag: string): "good" | "warn" | "neutral" | "bad" => {
  if (tag === "QUASE CERTO" || tag === "ALTÍSSIMA CHANCE" || tag === "ALTA CHANCE") return "good";
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
  const recordEngineContribution = useEngineWeights((s) => s.recordContribution);
  const resolveEngineContribution = useEngineWeights((s) => s.resolveContribution);
  const soundEnabled = useNotifications((s) => s.soundEnabled);
  const lastNotifiedKeyRef = useRef<string | null>(null);
  const strictValidation = useUiPrefs((s) => s.strictValidation);
  const focusedScope = useUiPrefs((s) => s.focusedScope);
  void useUiPrefs((s) => s.toggleStrictValidation);
  void useUiPrefs((s) => s.setFocusedScope);
  const autoBetEnabled = useAutoBet((s) => s.config.enabled);
  const autoBetOnlyStrict = useAutoBet((s) => s.config.onlyStrict);
  const autoBetPaused = useAutoBet((s) => s.pausedReason);
  const registerAutoBet = useAutoBet((s) => s.registerBet);
  const resolveAutoBets = useAutoBet((s) => s.resolveBets);
  const [stake, setStake] = useState(50);
  const [showAlts, setShowAlts] = useState(false);
  const [pulseKey, setPulseKey] = useState(0);
  const [previousOutcome, setPreviousOutcome] = useState<{ hit: boolean; predicted: string; actual: number } | null>(null);
  const prevSpinCountRef = useRef(spins.length);

  const history = useMemo(() => spins.map((s) => s.n), [spins]);
  const { ranked, summary } = useMemo(
    () => computeMasterSignal(history, latest),
    [history, latest]
  );

  useEffect(() => {
    if (spins.length > prevSpinCountRef.current && spins.length > 0) {
      const newest = spins[0].n;
      const newestT = spins[0].t;
      const candidateNumbers = recentWinners.map((w) => {
        const numbers = ranked.find((r) => r.numbersKey === w.numbersKey)?.numbers;
        return numbers ?? [];
      });
      resolveLast(newest, candidateNumbers);
      resolveAutoBets(newest, newestT, newest);
      const previousWinner = recentWinners[0];
      if (previousWinner) {
        const previousNumbers = candidateNumbers[0] ?? [];
        const hit = previousNumbers.includes(newest);
        resolveEngineContribution(previousWinner.shownAtSpinCount, hit);
        const previousLabel = ranked.find((r) => r.numbersKey === previousWinner.numbersKey)?.targetLabel ?? "anterior";
        setPreviousOutcome({ hit, predicted: previousLabel, actual: newest });
      }
      setPulseKey((k) => k + 1);
    }
    prevSpinCountRef.current = spins.length;
  }, [spins, ranked, resolveLast, resolveAutoBets, resolveEngineContribution, recentWinners]);

  useEffect(() => {
    if (ranked.length > 0) {
      recordShown(ranked[0].id, ranked[0].numbersKey, spins.length);
      if (ranked[0].engines && ranked[0].engines.length > 0) {
        recordEngineContribution(ranked[0].engines, spins.length);
      }
    }
  }, [ranked, recordShown, recordEngineContribution, spins.length]);

  useEffect(() => {
    if (ranked.length === 0) return;
    const top = ranked[0];
    if (!top.strictValid) return;
    if (lastNotifiedKeyRef.current === top.numbersKey) return;
    lastNotifiedKeyRef.current = top.numbersKey;
    if (soundEnabled) {
      try {
        playSignalChord();
      } catch {
        /* noop */
      }
    }
    showBrowserNotification(
      `🎯 ${top.targetLabel}`,
      `Chance ${(top.prob * 100).toFixed(1)}% · paga ${top.payout.toFixed(1)}:1 · cobre ${top.coverage} nº`,
      "/icon-192.png"
    );
    fireMasterWebhook(top, {
      spinsSeen: history.length,
      validatedCount: summary.validatedCount,
    }).catch(() => undefined);
  }, [ranked, soundEnabled, history.length, summary.validatedCount]);

  useEffect(() => {
    if (!autoBetEnabled || autoBetPaused) return;
    if (ranked.length === 0) return;
    const top = ranked[0];
    if (autoBetOnlyStrict && !top.strictValid) return;
    const newestT = spins[0]?.t ?? Date.now();
    registerAutoBet({
      numbersKey: top.numbersKey,
      numbers: top.numbers,
      targetLabel: top.targetLabel,
      targetType: top.targetType,
      payout: top.payout,
      prob: top.prob,
      spinT: newestT,
    });
  }, [ranked, autoBetEnabled, autoBetOnlyStrict, autoBetPaused, spins, registerAutoBet]);

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

  const scopedRanked = ranked.filter((c) =>
    focusedScope.length === 0 || focusedScope.includes(c.targetType as never)
  );
  const effectiveRanked = scopedRanked.length > 0 ? scopedRanked : ranked;
  const strictPool = effectiveRanked.filter((c) => c.strictValid);
  const winnerRaw = effectiveRanked[0];
  const winner = strictValidation && strictPool.length > 0 ? strictPool[0] : winnerRaw;
  const noStrictMatch = strictValidation && strictPool.length === 0;
  const alternatives = strictValidation
    ? strictPool.slice(1, 5)
    : effectiveRanked.slice(1, 5);

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

  const newestSpin = spins[0];

  if (noStrictMatch) {
    return (
      <Card padding="md" accent="warn">
        {previousOutcome && (
          <div
            key={pulseKey}
            className={`mb-2 rounded-xl border px-3 py-2 flex items-center gap-2 [animation:pop_0.5s_ease-out] ${
              previousOutcome.hit ? "border-emerald-500 bg-emerald-950/40" : "border-red-500/50 bg-red-950/30"
            }`}
          >
            <span
              className={`${ballBg(previousOutcome.actual)} text-white text-base font-black w-9 h-9 rounded-full flex items-center justify-center ring-2 ring-white/40`}
            >
              {previousOutcome.actual}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold">
                Saiu o {previousOutcome.actual} ·{" "}
                {previousOutcome.hit ? (
                  <span className="text-emerald-300">✓ acertou {previousOutcome.predicted}</span>
                ) : (
                  <span className="text-red-300">✗ errou (anterior: {previousOutcome.predicted})</span>
                )}
              </div>
              <div className="text-[11px] font-bold text-white">⚡ Nenhum padrão validado — aguardando</div>
            </div>
          </div>
        )}
        <SectionHeader
          title={
            <span className="flex items-center gap-2">
              ⏳ AGUARDE
              <Pill accent="warn">SEM SINAL VALIDADO</Pill>
              {recentWinners.length >= 3 && (
                <span className="text-[9px] font-mono text-neutral-500">
                  últimos: <span className="text-emerald-300">{recentHits}✓</span>/
                  <span className="text-red-300">{recentMisses}✗</span>
                </span>
              )}
            </span>
          }
          eyebrow="Modo estrito: só emite quando passa Wilson > baseline×1.25 + ≥10 amostras + agente concorda"
          subtitle={
            <span className="text-[10px] text-neutral-500">
              {ranked.length} candidatos ativos mas nenhum atende critério estrito.{" "}
              {summary.validatedCount} validados parcialmente · {summary.autoDiscoveredTotal} auto-aprendidos
              {lastResolved && (
                <span className="ml-1">
                  · último{" "}
                  {lastResolved.hit ? (
                    <span className="text-emerald-300">acertou</span>
                  ) : (
                    <span className="text-red-300">errou</span>
                  )}
                </span>
              )}
            </span>
          }
        />
        <div className="rounded-2xl border-2 border-amber-500/40 bg-gradient-to-br from-amber-950/30 to-neutral-950 p-4 mb-2 text-center">
          <div className="text-5xl mb-2">⏳</div>
          <div className="text-2xl font-black text-amber-300 mb-1">Não apostar agora</div>
          <div className="text-[11px] text-neutral-400 max-w-md mx-auto leading-snug">
            O sistema está rastreando {ranked.length} candidatos ativos, mas nenhum
            atingiu validação suficiente (≥10 amostras + Wilson 25% acima do acaso +
            confirmação do agente IA). Esperar é melhor que apostar em ruído.
          </div>
          <div className="text-[10px] text-emerald-300 mt-2 font-bold">
            Melhor candidato atual: {winnerRaw.targetLabel} ({(winnerRaw.prob * 100).toFixed(1)}%) — aguardando validação
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card
      padding="md"
      accent={accent === "good" ? "good" : accent === "bad" ? "bad" : "warn"}
    >
      {previousOutcome && (
        <div
          key={pulseKey}
          className={`mb-2 rounded-xl border px-3 py-2 flex items-center gap-2 [animation:pop_0.5s_ease-out] ${
            previousOutcome.hit
              ? "border-emerald-500 bg-emerald-950/40"
              : "border-red-500/50 bg-red-950/30"
          }`}
        >
          <span
            className={`${ballBg(previousOutcome.actual)} text-white text-base font-black w-9 h-9 rounded-full flex items-center justify-center ring-2 ring-white/40`}
          >
            {previousOutcome.actual}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold">
              Saiu o {previousOutcome.actual} ·{" "}
              {previousOutcome.hit ? (
                <span className="text-emerald-300">✓ acertou {previousOutcome.predicted}</span>
              ) : (
                <span className="text-red-300">✗ errou (anterior: {previousOutcome.predicted})</span>
              )}
            </div>
            <div className="text-[11px] font-bold text-white">
              ⚡ Nova jogada calculada — TUDO integrado em 1 sinal
            </div>
          </div>
        </div>
      )}

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
        eyebrow={
          winner.strictValid
            ? "✓ Sinal validado — pronto pra apostar"
            : summary.validationLevel === "strong"
            ? "✓ Sinal forte"
            : summary.validationLevel === "weak"
            ? "~ Sinal disponível"
            : "⏳ Melhor candidato no momento"
        }
        subtitle={
          <span className="text-[10px] text-neutral-500">
            {summary.bankSize} padrões · {summary.autoDiscoveredTotal} auto-aprendidos ·{" "}
            {summary.validatedCount} validados · acerto global{" "}
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
            {(winner.confidence * 100).toFixed(0)}%
          </div>
          <div className="text-[10px] text-emerald-300/80 font-bold mt-1">
            ≈ {Math.round(winner.prob * 10)} acertos a cada 10 rodadas
          </div>
        </div>

        {newestSpin && (
          <div className="text-[9px] text-neutral-600 mt-2 text-center">
            sobre {history.length} giros · {summary.validatedCount} sinais validados
          </div>
        )}

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

      {alternatives.length > 0 && (
        <details className="mt-1">
          <summary className="text-[10px] text-neutral-600 hover:text-amber-300 text-center py-1 cursor-pointer list-none">
            ⋯
          </summary>
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
                    <div className="font-bold text-neutral-200 truncate">{c.targetLabel}</div>
                  </div>
                  <div className="font-mono text-emerald-300 shrink-0">
                    {(c.prob * 100).toFixed(1)}%
                  </div>
                  <Pill accent={ta}>{t}</Pill>
                </div>
              );
            })}
          </div>
        </details>
      )}
    </Card>
  );
});
MasterSignal.displayName = "MasterSignal";

export default MasterSignal;
