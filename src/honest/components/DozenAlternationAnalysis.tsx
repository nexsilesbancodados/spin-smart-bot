import { memo, useMemo, useState } from "react";
import { useHonestStore } from "../lib/store";
import {
  GroupCode,
  ColumnCode,
  dozenOf,
  columnOf,
  NON_ZERO_DOZENS,
  NON_ZERO_COLUMNS,
  buildMarkov1,
  buildMarkov2,
  markov2Predict,
  runLengthStats,
  gapStats,
  detectCycles,
  alternationStats,
} from "../lib/groupAnalysis";
import { Card, SectionHeader, Pill } from "./ui";

type Mode = "dozen" | "column";

const BASELINE = 12 / 37;

const DozenAlternationAnalysis = memo(() => {
  const spins = useHonestStore((s) => s.spins);
  const [mode, setMode] = useState<Mode>("dozen");

  const series = useMemo(() => {
    return mode === "dozen"
      ? spins.map((s) => dozenOf(s.n)).filter((c) => c !== "Z") as GroupCode[]
      : spins.map((s) => columnOf(s.n)).filter((c) => c !== "Z") as ColumnCode[];
  }, [spins, mode]);

  const keys = mode === "dozen" ? (NON_ZERO_DOZENS as string[]) : (NON_ZERO_COLUMNS as string[]);

  const analysis = useMemo(() => {
    if (series.length < 15) return null;
    const m1 = buildMarkov1<string>(series, keys);
    const m2 = buildMarkov2<string>(series);
    const runs = runLengthStats<string>(series, keys);
    const gaps = gapStats<string>(series, keys);
    const cycles = detectCycles<string>(series);
    const alt = alternationStats<string>(series, keys);

    const head = series[0];
    const prev = series[1] ?? head;
    const baseline: Record<string, number> = {};
    keys.forEach((k) => (baseline[k] = 1 / keys.length));
    const m2Pred = markov2Predict<string>(m2, [prev, head], keys, baseline);

    const m1Probs = m1.probs[head] || {};
    const ranking = keys.map((k) => {
      const m1p = m1Probs[k] ?? 1 / keys.length;
      const m2p = m2Pred.probs[k];
      const gapBoost = gaps.currentGap[k] > gaps.expectedGap * 1.5 ? 1.15 : 1;
      const blended = (m1p * 0.4 + m2p * 0.6) * gapBoost;
      return { code: k, m1p, m2p, blended };
    });
    const sumBlended = ranking.reduce((a, r) => a + r.blended, 0) || 1;
    ranking.forEach((r) => (r.blended /= sumBlended));
    ranking.sort((a, b) => b.blended - a.blended);

    return { m1, m2, m1Probs, m2Pred, runs, gaps, cycles, alt, ranking, head, prev };
  }, [series, keys]);

  if (!analysis) {
    return (
      <Card padding="sm">
        <SectionHeader
          title={mode === "dozen" ? "Análise de alternância — Dúzias" : "Análise de alternância — Colunas"}
          eyebrow="Padrões"
        />
        <div className="text-[11px] text-neutral-500 italic py-2 text-center">
          Aguardando ≥15 giros não-zero (atual: {series.length})
        </div>
      </Card>
    );
  }

  const { m1Probs, m2Pred, runs, gaps, cycles, alt, ranking, head, prev } = analysis;
  const winner = ranking[0];
  const winnerConfidence = winner.blended;
  const confidenceTag =
    winnerConfidence > 0.42
      ? { label: "ALTA", accent: "good" as const }
      : winnerConfidence > 0.37
      ? { label: "MÉDIA", accent: "warn" as const }
      : { label: "BAIXA", accent: "neutral" as const };

  const sigSamples = m2Pred.samples;
  const altLabel =
    alt.verdict === "alternation"
      ? "alternância exagerada"
      : alt.verdict === "clustering"
      ? "agrupamento (runs longos)"
      : "padrão esperado";

  return (
    <Card padding="sm" accent="good">
      <SectionHeader
        title={mode === "dozen" ? "Alternância de Dúzias" : "Alternância de Colunas"}
        eyebrow="Análise profunda"
        subtitle={
          <span className="text-[10px] text-neutral-500">
            Markov 1ª + 2ª ordem · runs · gaps · ciclos · {series.length} giros válidos
          </span>
        }
        actions={
          <div className="flex gap-1">
            <button
              onClick={() => setMode("dozen")}
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                mode === "dozen" ? "bg-amber-500 text-black" : "bg-neutral-800 text-neutral-300"
              }`}
            >
              Dúzias
            </button>
            <button
              onClick={() => setMode("column")}
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                mode === "column" ? "bg-amber-500 text-black" : "bg-neutral-800 text-neutral-300"
              }`}
            >
              Colunas
            </button>
          </div>
        }
      />

      <div className="bg-gradient-to-br from-amber-950/40 to-neutral-950 border border-amber-700/60 rounded-xl p-3 mb-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] uppercase tracking-[0.18em] text-amber-400 font-bold">
            Próxima provável após {prev} → {head}
          </span>
          <Pill accent={confidenceTag.accent}>{confidenceTag.label}</Pill>
        </div>
        <div className="text-3xl font-black text-white leading-none">{winner.code}</div>
        <div className="text-[11px] text-neutral-300 mt-1 font-mono">
          P = {(winnerConfidence * 100).toFixed(1)}% (Markov-1: {(winner.m1p * 100).toFixed(0)}% · Markov-2: {(winner.m2p * 100).toFixed(0)}%)
        </div>
        {sigSamples < 5 && (
          <div className="text-[9px] text-amber-300/80 mt-1">
            ⚠ pouca amostra do contexto exato ({sigSamples}n) — Markov-2 suavizado com prior Laplace
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-1.5 mb-2">
        {ranking.map((r, i) => (
          <div
            key={r.code}
            className={`rounded-lg border p-1.5 ${
              i === 0
                ? "border-amber-500 bg-amber-950/30"
                : "border-neutral-800 bg-neutral-900/40"
            }`}
          >
            <div className={`text-sm font-black ${i === 0 ? "text-amber-300" : "text-neutral-300"}`}>
              {r.code}
            </div>
            <div className="text-[10px] text-neutral-400 font-mono">
              blended {(r.blended * 100).toFixed(1)}%
            </div>
            <div className="text-[9px] text-neutral-500 font-mono">
              m1 {(r.m1p * 100).toFixed(0)}% · m2 {(r.m2p * 100).toFixed(0)}%
            </div>
          </div>
        ))}
      </div>

      <details className="bg-neutral-900/40 rounded mb-2">
        <summary className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold cursor-pointer px-2 py-1">
          Matriz Markov-1 (atual → próxima)
        </summary>
        <table className="w-full text-[10px] mt-1">
          <thead>
            <tr>
              <th className="p-1 text-left text-neutral-500">atual ↓ / próx →</th>
              {keys.map((k) => (
                <th key={k} className="p-1 text-center text-neutral-300">{k}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {keys.map((curr) => (
              <tr key={curr}>
                <td className="p-1 text-neutral-300 font-bold">{curr}</td>
                {keys.map((next) => {
                  const p = analysis.m1.probs[curr]?.[next] ?? 0;
                  const lift = p / (1 / keys.length);
                  return (
                    <td key={next} className="p-1 text-center">
                      <div
                        className={`rounded px-1 py-0.5 font-mono ${
                          lift > 1.2
                            ? "bg-amber-600 text-black font-bold"
                            : lift < 0.8 && p > 0
                            ? "bg-sky-900/70 text-sky-200"
                            : "bg-neutral-800 text-neutral-300"
                        }`}
                      >
                        {(p * 100).toFixed(0)}%
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </details>

      <div className="grid grid-cols-2 gap-1 mb-2 text-[10px]">
        <div className="bg-neutral-900/50 rounded p-1.5">
          <div className="text-[9px] text-neutral-500 uppercase tracking-wider">Sequência atual</div>
          <div className="font-bold text-amber-300 font-mono">
            {runs.currentRun.value} ×{runs.currentRun.length}
          </div>
          <div className="text-[9px] text-neutral-500">
            esperado {runs.expectedRunMean.toFixed(2)}
          </div>
        </div>
        <div className="bg-neutral-900/50 rounded p-1.5">
          <div className="text-[9px] text-neutral-500 uppercase tracking-wider">Alternância</div>
          <div className="font-bold text-neutral-200 font-mono">
            {(alt.alternationRate * 100).toFixed(0)}% (esp. {(alt.expectedAlternationRate * 100).toFixed(0)}%)
          </div>
          <div
            className={`text-[9px] ${
              alt.verdict === "expected" ? "text-neutral-500" : "text-amber-300"
            }`}
          >
            {altLabel} · p={alt.p.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1 mb-2">
        {keys.map((k) => {
          const meanGap = analysis.gaps.meanGap[k];
          const currentGap = analysis.gaps.currentGap[k];
          const overdue = currentGap > meanGap * 1.5 && meanGap > 0;
          return (
            <div
              key={k}
              className={`rounded p-1.5 border ${
                overdue ? "border-amber-500/60 bg-amber-950/30" : "border-neutral-800 bg-neutral-900/40"
              }`}
            >
              <div className="text-[10px] font-bold text-neutral-300">{k}</div>
              <div className="text-[9px] text-neutral-500 font-mono">
                último há {currentGap}g
              </div>
              <div className="text-[9px] text-neutral-500 font-mono">
                gap médio {meanGap.toFixed(1)} · max {analysis.gaps.maxGap[k]}
              </div>
              <div className="text-[9px] text-neutral-500 font-mono">
                run máx {analysis.runs.longestByGroup[k]}×
              </div>
              {overdue && (
                <div className="text-[9px] text-amber-300 font-bold mt-0.5">⏳ atrasado</div>
              )}
            </div>
          );
        })}
      </div>

      {cycles.found && (
        <div className="bg-emerald-950/30 border border-emerald-700/50 rounded p-1.5 mb-2 text-[10px]">
          <div className="text-emerald-300 font-bold">
            🔁 Ciclo {cycles.cycleLength}-passos detectado: {cycles.pattern.join(" → ")}
          </div>
          <div className="text-[9px] text-emerald-400/70">
            {cycles.occurrences} repetições consecutivas — pode quebrar a qualquer momento
          </div>
        </div>
      )}

      <div className="text-[9px] text-neutral-600 italic text-center">
        Sinais derivados de padrões observados ≠ previsão garantida. Casa retém 2,7%.
      </div>
    </Card>
  );
});
DozenAlternationAnalysis.displayName = "DozenAlternationAnalysis";

export default DozenAlternationAnalysis;
