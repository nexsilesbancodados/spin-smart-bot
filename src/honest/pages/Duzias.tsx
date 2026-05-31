import { memo, useMemo, useState } from "react";
import { useHonestStore } from "../lib/store";
import { useSignalAgent } from "../lib/signalAgent";
import { DOZEN_1, DOZEN_2, DOZEN_3 } from "../lib/wheel";
import {
  dozenOf,
  buildMarkov1,
  buildMarkov2,
  markov2Predict,
  runLengthStats,
  gapStats,
  detectCycles,
  alternationStats,
  NON_ZERO_DOZENS,
  GroupCode,
} from "../lib/groupAnalysis";
import { getRankedLearnedPatterns } from "../lib/patternLearning";
import { Card, PageContainer, SectionHeader, Pill } from "../components/ui";

const DOZEN_SETS = [DOZEN_1, DOZEN_2, DOZEN_3];
const DOZEN_LABELS = ["1ª Dúzia (1-12)", "2ª Dúzia (13-24)", "3ª Dúzia (25-36)"];
const BASELINE = 12 / 37;

const erfc = (x: number): number => {
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x);
  return 1 - y;
};
const pTwoSided = (z: number): number => Math.min(1, erfc(Math.abs(z) / Math.SQRT2));

const Duzias = memo(() => {
  const spins = useHonestStore((s) => s.spins);
  const latest = useSignalAgent((s) => s.latest);
  const [lookback, setLookback] = useState(80);

  const series = useMemo(
    () =>
      spins
        .map((s) => dozenOf(s.n))
        .filter((c) => c !== "Z") as GroupCode[],
    [spins]
  );

  const window = useMemo(() => spins.slice(0, lookback).map((s) => s.n), [spins, lookback]);

  const dozenStats = useMemo(() => {
    return DOZEN_SETS.map((set, i) => {
      const observed = window.filter((n) => set.has(n)).length;
      const expected = window.length * BASELINE;
      const sigma = Math.sqrt(Math.max(0.001, window.length * BASELINE * (1 - BASELINE)));
      const z = sigma > 0 ? (observed - expected) / sigma : 0;
      const p = pTwoSided(z);
      let weightedHits = 0;
      let weightTotal = 0;
      window.forEach((n, idx) => {
        const w = Math.pow(0.5, idx / 25);
        weightTotal += w;
        if (set.has(n)) weightedHits += w;
      });
      const recent = weightTotal > 0 ? weightedHits / weightTotal : BASELINE;
      return {
        label: DOZEN_LABELS[i],
        index: i,
        observed,
        expected,
        recent,
        lift: recent / BASELINE,
        z,
        p,
        members: set,
      };
    });
  }, [window]);

  const markov = useMemo(() => {
    if (series.length < 4) return null;
    const m1 = buildMarkov1<string>(series, NON_ZERO_DOZENS as string[]);
    const m2 = buildMarkov2<string>(series);
    const head = series[0];
    const prev = series[1] ?? head;
    const baseline = { D1: 1 / 3, D2: 1 / 3, D3: 1 / 3 };
    const m2Pred = markov2Predict<string>(m2, [prev, head], NON_ZERO_DOZENS as string[], baseline);
    return { m1, m2, m2Pred, head, prev };
  }, [series]);

  const runs = useMemo(() => (series.length >= 5 ? runLengthStats<string>(series, NON_ZERO_DOZENS as string[]) : null), [series]);
  const gaps = useMemo(() => (series.length >= 5 ? gapStats<string>(series, NON_ZERO_DOZENS as string[]) : null), [series]);
  const cycles = useMemo(() => (series.length >= 6 ? detectCycles<string>(series) : null), [series]);
  const alt = useMemo(() => alternationStats<string>(series, NON_ZERO_DOZENS as string[]), [series]);

  const agentSupport = useMemo(() => {
    if (!latest) return [0, 0, 0];
    const support = [0, 0, 0];
    latest.topPicks.forEach((pick, i) => {
      for (let d = 0; d < 3; d++) {
        if (DOZEN_SETS[d].has(pick)) {
          support[d] += latest.topProbs[i] ?? 0;
        }
      }
    });
    return support;
  }, [latest]);

  const combinedRanking = useMemo(() => {
    return DOZEN_LABELS.map((label, i) => {
      const stat = dozenStats[i];
      const m1Prob = markov ? markov.m1.probs[markov.head]?.[`D${i + 1}`] ?? 1 / 3 : 1 / 3;
      const m2Prob = markov ? markov.m2Pred.probs[`D${i + 1}`] ?? 1 / 3 : 1 / 3;
      const recent = stat.recent;
      const agent = agentSupport[i];
      const blended = recent * 0.3 + m1Prob * 0.2 + m2Prob * 0.25 + Math.min(1, agent / BASELINE / 2.5) * BASELINE * 2.5 * 0.25;
      const learnedRules = getRankedLearnedPatterns(5).filter(
        (r) => (r.group === "dozen-repeat" || r.group === "dozen-cycle" || r.group === "dozen-overdue" || r.group === "dozen-zigzag" || r.group === "dozen-alternation" || r.group === "dozen-alternation-long") && r.ruleId.includes(`-${i}-`)
      );
      const bestLearned = learnedRules[0];
      const learnedBoost = bestLearned ? bestLearned.wilsonLower * 0.2 : 0;
      return {
        index: i,
        label,
        recent,
        m1Prob,
        m2Prob,
        agent,
        blended: blended + learnedBoost,
        learned: bestLearned,
      };
    }).sort((a, b) => b.blended - a.blended);
  }, [dozenStats, markov, agentSupport]);

  const winner = combinedRanking[0];

  const learnedDozenRules = useMemo(
    () =>
      getRankedLearnedPatterns(5)
        .filter((r) =>
          ["dozen-repeat", "dozen-cycle", "dozen-overdue", "dozen-zigzag", "dozen-alternation", "dozen-alternation-long"].includes(r.group)
        )
        .slice(0, 30),
    [spins]
  );

  const hourlyByDozen = useMemo(() => {
    const buckets = Array.from({ length: 24 }, () => [0, 0, 0]);
    const totals = Array(24).fill(0);
    for (const s of spins.slice(0, 500)) {
      if (s.n === 0) continue;
      const h = new Date(s.t).getHours();
      const d = Math.floor((s.n - 1) / 12);
      buckets[h][d]++;
      totals[h]++;
    }
    return { buckets, totals };
  }, [spins]);

  if (spins.length < 10) {
    return (
      <PageContainer>
        <Card padding="md">
          <SectionHeader title="🎯 Análise de Dúzias" eyebrow="Máximo potencial descritivo" />
          <div className="text-[11px] text-neutral-500 italic py-3 text-center">
            Aguardando ≥10 giros (atual: {spins.length})
          </div>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Card padding="md" accent={winner.blended > BASELINE * 1.1 ? "good" : "neutral"}>
        <SectionHeader
          title="🎯 Análise de Dúzias"
          eyebrow="Sinal + 7 análises combinadas"
          subtitle={
            <span className="text-[10px] text-neutral-500">
              Recência + Markov 1-2 + agente IA + padrões aprendidos · {series.length} giros válidos
            </span>
          }
        />

        <div className="rounded-xl border-2 border-amber-500/60 bg-gradient-to-br from-amber-950/50 to-neutral-950 p-3 mb-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-amber-300 font-bold text-center">
            Dúzia mais provável agora
          </div>
          <div className="text-4xl font-black text-white text-center mt-1">{winner.label}</div>
          <div className="text-center mt-2">
            <div className="text-[9px] uppercase tracking-wider text-neutral-400 font-bold">
              Probabilidade combinada
            </div>
            <div className="text-4xl font-black font-mono text-amber-300 leading-none">
              {(winner.blended * 100).toFixed(1)}%
            </div>
            <div className="text-[10px] text-neutral-400 mt-1">
              recente {(winner.recent * 100).toFixed(0)}% · M1 {(winner.m1Prob * 100).toFixed(0)}% · M2{" "}
              {(winner.m2Prob * 100).toFixed(0)}% · IA{" "}
              {(winner.agent * 100).toFixed(0)}%
            </div>
            {winner.learned && (
              <div className="text-[10px] text-emerald-300 mt-1">
                🧠 padrão aprendido: {winner.learned.description.substring(0, 60)}
                {winner.learned.description.length > 60 ? "…" : ""}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {combinedRanking.map((r, i) => (
            <div
              key={r.index}
              className={`rounded-lg border p-2 ${
                i === 0
                  ? "border-amber-500 bg-amber-950/30"
                  : "border-neutral-800 bg-neutral-900/40"
              }`}
            >
              <div className={`text-sm font-black ${i === 0 ? "text-amber-300" : "text-neutral-300"}`}>
                D{r.index + 1}
              </div>
              <div className="text-[10px] text-neutral-400 font-mono">
                {(r.blended * 100).toFixed(1)}%
              </div>
              <div className="text-[9px] text-neutral-500 font-mono">
                rec {(r.recent * 100).toFixed(0)} · M2 {(r.m2Prob * 100).toFixed(0)}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card padding="sm">
        <SectionHeader
          title="Distribuição observada"
          eyebrow="Estatística"
          actions={
            <div className="flex gap-1 text-[10px]">
              {[50, 80, 150, 300].map((v) => (
                <button
                  key={v}
                  onClick={() => setLookback(v)}
                  className={`px-2 py-0.5 rounded font-bold ${
                    lookback === v ? "bg-amber-500 text-black" : "bg-neutral-800 text-neutral-300"
                  }`}
                >
                  {v}g
                </button>
              ))}
            </div>
          }
        />
        <div className="space-y-1">
          {dozenStats.map((d, i) => {
            const fillPct = Math.min(150, d.lift * 100);
            return (
              <div key={i} className="flex items-center gap-2 text-[11px]">
                <span className="w-20 text-neutral-300 font-bold shrink-0">D{i + 1}</span>
                <div className="flex-1 h-3 bg-neutral-900 rounded relative overflow-hidden">
                  <div
                    className="absolute inset-y-0 w-px bg-neutral-500"
                    style={{ left: `${100 / 1.5}%` }}
                  />
                  <div
                    className={`h-full ${
                      d.lift > 1.2 ? "bg-amber-500" : d.lift < 0.8 ? "bg-sky-500" : "bg-neutral-600"
                    }`}
                    style={{ width: `${(fillPct / 150) * 100}%` }}
                  />
                </div>
                <span className="font-mono shrink-0 text-neutral-400 w-12 text-right">
                  {d.lift.toFixed(2)}×
                </span>
                <span className="font-mono shrink-0 text-neutral-500 w-14 text-right">
                  {d.observed}/{d.expected.toFixed(0)}
                </span>
                <span
                  className={`font-mono shrink-0 w-14 text-right ${
                    d.p < 0.05 ? "text-amber-300 font-bold" : "text-neutral-500"
                  }`}
                  title="p-valor"
                >
                  p={d.p.toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      {markov && (
        <Card padding="sm">
          <SectionHeader
            title="Matrizes de Markov"
            eyebrow="Transições"
            subtitle={
              <span className="text-[10px] text-neutral-500">
                Atual: {markov.head} · anterior: {markov.prev}
              </span>
            }
          />
          <div className="text-[10px] text-neutral-400 mb-1 uppercase tracking-wider font-bold">
            Markov-1: P(próxima | atual={markov.head})
          </div>
          <div className="grid grid-cols-3 gap-1 mb-3">
            {NON_ZERO_DOZENS.map((d) => {
              const p = markov.m1.probs[markov.head]?.[d] ?? 0;
              const lift = p / (1 / 3);
              return (
                <div
                  key={d}
                  className={`rounded p-2 text-center ${
                    lift > 1.2
                      ? "bg-amber-600 text-black"
                      : lift < 0.8 && p > 0
                      ? "bg-sky-800/70 text-sky-100"
                      : "bg-neutral-800 text-neutral-200"
                  }`}
                >
                  <div className="font-bold">{d}</div>
                  <div className="text-sm font-mono font-bold">{(p * 100).toFixed(0)}%</div>
                </div>
              );
            })}
          </div>
          <div className="text-[10px] text-neutral-400 mb-1 uppercase tracking-wider font-bold">
            Markov-2: P(próxima | {markov.prev}→{markov.head}) — n={markov.m2Pred.samples}
          </div>
          <div className="grid grid-cols-3 gap-1">
            {NON_ZERO_DOZENS.map((d) => {
              const p = markov.m2Pred.probs[d] ?? 0;
              const lift = p / (1 / 3);
              return (
                <div
                  key={d}
                  className={`rounded p-2 text-center ${
                    lift > 1.2
                      ? "bg-amber-600 text-black"
                      : lift < 0.8 && p > 0
                      ? "bg-sky-800/70 text-sky-100"
                      : "bg-neutral-800 text-neutral-200"
                  }`}
                >
                  <div className="font-bold">{d}</div>
                  <div className="text-sm font-mono font-bold">{(p * 100).toFixed(0)}%</div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {runs && gaps && (
        <Card padding="sm">
          <SectionHeader title="Runs, gaps & alternância" eyebrow="Análise temporal" />
          <div className="grid grid-cols-2 gap-2 mb-2 text-[10px]">
            <div className="bg-neutral-900/50 rounded p-1.5">
              <div className="text-[9px] text-neutral-500 uppercase tracking-wider">Run atual</div>
              <div className="font-bold text-amber-300 font-mono">
                {runs.currentRun.value} × {runs.currentRun.length}
              </div>
              <div className="text-[9px] text-neutral-500">
                esp. {runs.expectedRunMean.toFixed(2)}
              </div>
            </div>
            <div className="bg-neutral-900/50 rounded p-1.5">
              <div className="text-[9px] text-neutral-500 uppercase tracking-wider">Alternância</div>
              <div className="font-bold text-neutral-200 font-mono">
                {(alt.alternationRate * 100).toFixed(0)}% (esp. {(alt.expectedAlternationRate * 100).toFixed(0)}%)
              </div>
              <div className={`text-[9px] ${alt.verdict === "expected" ? "text-neutral-500" : "text-amber-300"}`}>
                {alt.verdict === "expected" ? "padrão esperado" : alt.verdict} · p={alt.p.toFixed(2)}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {NON_ZERO_DOZENS.map((d) => {
              const meanGap = gaps.meanGap[d];
              const currentGap = gaps.currentGap[d];
              const overdue = currentGap > meanGap * 1.5 && meanGap > 0;
              return (
                <div
                  key={d}
                  className={`rounded p-1.5 border ${
                    overdue ? "border-amber-500/60 bg-amber-950/30" : "border-neutral-800 bg-neutral-900/40"
                  }`}
                >
                  <div className="text-[10px] font-bold text-neutral-300">{d}</div>
                  <div className="text-[9px] text-neutral-500 font-mono">
                    último há {currentGap}g
                  </div>
                  <div className="text-[9px] text-neutral-500 font-mono">
                    gap médio {meanGap.toFixed(1)} · max {gaps.maxGap[d]}
                  </div>
                  <div className="text-[9px] text-neutral-500 font-mono">
                    run máx {runs.longestByGroup[d]}×
                  </div>
                  {overdue && (
                    <div className="text-[9px] text-amber-300 font-bold">⏳ atrasada</div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {cycles && cycles.found && (
        <Card padding="sm" accent="good">
          <div className="text-[11px] text-emerald-300 font-bold">
            🔁 Ciclo detectado: {cycles.pattern.join(" → ")} ({cycles.cycleLength} passos ×{" "}
            {cycles.occurrences} repetições)
          </div>
          <div className="text-[10px] text-neutral-500 mt-1">
            Pode quebrar a qualquer giro — sem garantia de continuação.
          </div>
        </Card>
      )}

      <Card padding="sm">
        <SectionHeader title="Distribuição por hora do dia" eyebrow="Sazonalidade" />
        <div className="grid grid-cols-12 gap-0.5">
          {hourlyByDozen.buckets.map((dozenCounts, h) => {
            const total = hourlyByDozen.totals[h];
            if (total === 0) {
              return (
                <div
                  key={h}
                  className="bg-neutral-900/40 rounded p-0.5 text-center text-[7px] text-neutral-700"
                  title={`${h}h: sem dados`}
                >
                  <div>{h}</div>
                  <div className="text-neutral-700">—</div>
                </div>
              );
            }
            const max = Math.max(...dozenCounts);
            const dominantIdx = dozenCounts.indexOf(max);
            const dominantPct = max / total;
            const color =
              dominantPct > 0.45
                ? "bg-amber-700 text-white"
                : dominantPct > 0.38
                ? "bg-amber-900 text-amber-100"
                : "bg-neutral-800 text-neutral-300";
            return (
              <div
                key={h}
                className={`rounded p-0.5 text-center ${color}`}
                title={`${h}h: D1=${dozenCounts[0]} D2=${dozenCounts[1]} D3=${dozenCounts[2]} (total ${total})`}
              >
                <div className="text-[8px] font-bold">{h}</div>
                <div className="text-[9px] font-mono font-bold">D{dominantIdx + 1}</div>
              </div>
            );
          })}
        </div>
        <div className="text-[9px] text-neutral-600 italic mt-2 text-center">
          Cor mais intensa = dúzia dominou ≥45% naquela hora. Amostra pequena = ruído.
        </div>
      </Card>

      <Card padding="sm">
        <SectionHeader
          title="Padrões de dúzia aprendidos"
          eyebrow={`${learnedDozenRules.length} regras com ≥5 amostras`}
          subtitle={
            <span className="text-[10px] text-neutral-500">
              Ranqueado por Wilson 95% lower bound — evita "sorte" de poucas amostras
            </span>
          }
        />
        {learnedDozenRules.length === 0 ? (
          <div className="text-[11px] text-neutral-500 italic py-2 text-center">
            Nenhuma regra ainda com amostra suficiente. Continue rodando.
          </div>
        ) : (
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {learnedDozenRules.map((r) => {
              const aboveBaseline = r.wilsonLower > 12 / 37;
              return (
                <div
                  key={r.ruleId}
                  className="flex items-center gap-2 bg-neutral-900/50 rounded px-2 py-1 text-[10px]"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-neutral-300 truncate">{r.description}</div>
                    <div className="text-[9px] text-neutral-500 font-mono">
                      {r.group} · {r.hits}/{r.attempts}
                    </div>
                  </div>
                  <div className="text-right shrink-0 font-mono">
                    <div className={`font-bold ${aboveBaseline ? "text-emerald-300" : "text-neutral-400"}`}>
                      {(r.accuracy * 100).toFixed(1)}%
                    </div>
                    <div className="text-[9px] text-neutral-500">
                      W95 [{(r.wilsonLower * 100).toFixed(0)}–{(r.wilsonUpper * 100).toFixed(0)}]
                    </div>
                  </div>
                  {aboveBaseline && <Pill accent="good">acima do acaso</Pill>}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card padding="sm" accent="warn">
        <div className="text-[10px] text-amber-200 leading-snug">
          ⚠ Esta análise descreve o que aconteceu. Dúzias em roleta justa têm probabilidade
          fixa de 12/37 ≈ 32,4% cada — qualquer "tendência" observada é variância natural
          e regride para a média. Use como leitura da mesa, não como receita de aposta.
        </div>
      </Card>
    </PageContainer>
  );
});
Duzias.displayName = "DuziasPage";

export default Duzias;
