import { memo, useMemo } from "react";
import { useHonestStore } from "../lib/store";
import { useSignalAgent } from "../lib/signalAgent";
import { DOZEN_1, DOZEN_2, DOZEN_3, COLUMN_1, COLUMN_2, COLUMN_3 } from "../lib/wheel";
import {
  buildMarkov2,
  markov2Predict,
  dozenOf,
  columnOf,
  NON_ZERO_DOZENS,
  NON_ZERO_COLUMNS,
  GroupCode,
  ColumnCode,
} from "../lib/groupAnalysis";
import { Card, SectionHeader, Pill } from "./ui";

interface Group {
  id: string;
  label: string;
  shortLabel: string;
  members: Set<number>;
  range: string;
}

const DOZENS: Group[] = [
  { id: "d1", label: "1ª Dúzia", shortLabel: "D1", members: DOZEN_1, range: "1–12" },
  { id: "d2", label: "2ª Dúzia", shortLabel: "D2", members: DOZEN_2, range: "13–24" },
  { id: "d3", label: "3ª Dúzia", shortLabel: "D3", members: DOZEN_3, range: "25–36" },
];

const COLUMNS: Group[] = [
  { id: "c1", label: "Coluna 1", shortLabel: "C1", members: COLUMN_1, range: "1,4,7…34" },
  { id: "c2", label: "Coluna 2", shortLabel: "C2", members: COLUMN_2, range: "2,5,8…35" },
  { id: "c3", label: "Coluna 3", shortLabel: "C3", members: COLUMN_3, range: "3,6,9…36" },
];

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

interface GroupAnalysis extends Group {
  observed: number;
  expected: number;
  lift: number;
  z: number;
  p: number;
  weightedRecent: number;
  transitionProb: number;
  agentSupport: number;
  agentTopPicksInside: number[];
  score: number;
  reasons: string[];
}

const analyze = (
  groups: Group[],
  spins: number[],
  agentTopPicks: number[],
  agentTopProbs: number[],
  markov2Probs: Record<string, number>
): GroupAnalysis[] => {
  const total = spins.length;
  const half = 25;

  return groups.map((g) => {
    const observed = spins.reduce((acc, n) => acc + (g.members.has(n) ? 1 : 0), 0);
    const expected = total * BASELINE;
    const sigma = Math.sqrt(Math.max(0.0001, total * BASELINE * (1 - BASELINE)));
    const z = sigma > 0 ? (observed - expected) / sigma : 0;
    const p = pTwoSided(z);

    let weightedSum = 0;
    let weightTotal = 0;
    spins.forEach((n, i) => {
      const w = Math.pow(0.5, i / half);
      weightTotal += w;
      if (g.members.has(n)) weightedSum += w;
    });
    const weightedRecent = weightTotal > 0 ? weightedSum / weightTotal : BASELINE;

    let transitionMatches = 0;
    let transitionDenominator = 0;
    if (spins.length >= 5) {
      const recent = spins.slice(0, 30);
      const head = recent[0];
      const headInGroup = g.members.has(head);
      for (let i = 1; i < recent.length - 1; i++) {
        if (g.members.has(recent[i]) === headInGroup) {
          transitionDenominator++;
          if (g.members.has(recent[i - 1])) transitionMatches++;
        }
      }
    }
    const transitionProb =
      transitionDenominator >= 3 ? transitionMatches / transitionDenominator : BASELINE;

    let agentSupport = 0;
    const agentTopPicksInside: number[] = [];
    agentTopPicks.forEach((pick, i) => {
      if (g.members.has(pick)) {
        agentTopPicksInside.push(pick);
        agentSupport += agentTopProbs[i] ?? 0;
      }
    });
    const agentNorm = Math.min(1, agentSupport / (BASELINE * Math.min(5, agentTopPicks.length || 1)));

    const liftRecent = weightedRecent / BASELINE;
    const liftLong = total > 0 ? observed / expected : 1;
    const liftCombined = liftRecent * 0.6 + liftLong * 0.4;
    const transitionLift = transitionProb / BASELINE;
    const markov2Lift = (markov2Probs[g.id] ?? 1 / 3) / (1 / 3);

    const score =
      0.25 * Math.min(2, liftCombined) +
      0.2 * Math.min(2, transitionLift) +
      0.25 * Math.min(2, markov2Lift) +
      0.3 * agentNorm;

    const reasons: string[] = [];
    if (liftRecent > 1.2) reasons.push(`recente ${(liftRecent * 100).toFixed(0)}%`);
    else if (liftRecent < 0.8) reasons.push(`fria ${(liftRecent * 100).toFixed(0)}%`);
    if (markov2Lift > 1.25)
      reasons.push(`M2: ${((markov2Probs[g.id] ?? 1 / 3) * 100).toFixed(0)}%`);
    if (transitionLift > 1.25) reasons.push(`M1: ${(transitionProb * 100).toFixed(0)}%`);
    if (agentTopPicksInside.length > 0)
      reasons.push(`agente: ${agentTopPicksInside.join(", ")}`);
    if (p < 0.05) reasons.push(`desvio (p=${p.toFixed(2)})`);

    return {
      ...g,
      observed,
      expected,
      lift: liftCombined,
      z,
      p,
      weightedRecent,
      transitionProb,
      agentSupport,
      agentTopPicksInside,
      score,
      reasons,
    };
  });
};

const DozenColumnSignal = memo(() => {
  const spins = useHonestStore((s) => s.spins);
  const latest = useSignalAgent((s) => s.latest);
  const numbers = useMemo(() => spins.slice(0, 80).map((s) => s.n), [spins]);

  const topPicks = latest?.topPicks ?? [];
  const topProbs = latest?.topProbs ?? [];

  const dozenM2 = useMemo<Record<string, number>>(() => {
    const series = spins.map((s) => dozenOf(s.n)).filter((c) => c !== "Z") as GroupCode[];
    if (series.length < 10) return { d1: 1 / 3, d2: 1 / 3, d3: 1 / 3 };
    const m2 = buildMarkov2<string>(series);
    const head = series[0];
    const prev = series[1] ?? head;
    const baseline: Record<string, number> = { D1: 1 / 3, D2: 1 / 3, D3: 1 / 3 };
    const pred = markov2Predict<string>(m2, [prev, head], NON_ZERO_DOZENS as string[], baseline);
    return { d1: pred.probs["D1"] ?? 1 / 3, d2: pred.probs["D2"] ?? 1 / 3, d3: pred.probs["D3"] ?? 1 / 3 };
  }, [spins]);

  const columnM2 = useMemo<Record<string, number>>(() => {
    const series = spins.map((s) => columnOf(s.n)).filter((c) => c !== "Z") as ColumnCode[];
    if (series.length < 10) return { c1: 1 / 3, c2: 1 / 3, c3: 1 / 3 };
    const m2 = buildMarkov2<string>(series);
    const head = series[0];
    const prev = series[1] ?? head;
    const baseline: Record<string, number> = { C1: 1 / 3, C2: 1 / 3, C3: 1 / 3 };
    const pred = markov2Predict<string>(m2, [prev, head], NON_ZERO_COLUMNS as string[], baseline);
    return { c1: pred.probs["C1"] ?? 1 / 3, c2: pred.probs["C2"] ?? 1 / 3, c3: pred.probs["C3"] ?? 1 / 3 };
  }, [spins]);

  const dozenAnalysis = useMemo(
    () => analyze(DOZENS, numbers, topPicks, topProbs, dozenM2),
    [numbers, topPicks, topProbs, dozenM2]
  );
  const columnAnalysis = useMemo(
    () => analyze(COLUMNS, numbers, topPicks, topProbs, columnM2),
    [numbers, topPicks, topProbs, columnM2]
  );

  if (numbers.length < 12) {
    return (
      <Card padding="sm">
        <SectionHeader title="Sinal de Dúzia & Coluna" eyebrow="Sinal 2:1" />
        <div className="text-[11px] text-neutral-500 italic py-2 text-center">
          Aguardando ≥12 giros (atual: {numbers.length})
        </div>
      </Card>
    );
  }

  const bestDozen = [...dozenAnalysis].sort((a, b) => b.score - a.score)[0];
  const bestColumn = [...columnAnalysis].sort((a, b) => b.score - a.score)[0];

  const confidenceTag = (score: number) => {
    if (score >= 1.35) return { label: "ALTA", accent: "good" as const };
    if (score >= 1.15) return { label: "MÉDIA", accent: "warn" as const };
    return { label: "BAIXA", accent: "neutral" as const };
  };

  return (
    <Card padding="sm" accent="good">
      <SectionHeader
        title="Sinal de Dúzia & Coluna"
        eyebrow="Sinal 2:1"
        subtitle={
          <span className="text-[10px] text-neutral-500">
            Combina recência ponderada · transição · suporte do agente · estatística
          </span>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
        <BigPick group={bestDozen} kind="DÚZIA" tag={confidenceTag(bestDozen.score)} />
        <BigPick group={bestColumn} kind="COLUNA" tag={confidenceTag(bestColumn.score)} />
      </div>

      <div className="space-y-1">
        <DetailRow title="Dúzias" items={dozenAnalysis} bestId={bestDozen.id} />
        <DetailRow title="Colunas" items={columnAnalysis} bestId={bestColumn.id} />
      </div>

      <div className="text-[10px] text-neutral-500 italic mt-2 text-center">
        Paga 2:1 · break-even em ~33,3%. Cada giro segue independente.
      </div>
    </Card>
  );
});
DozenColumnSignal.displayName = "DozenColumnSignal";

const BigPick = memo(
  ({
    group,
    kind,
    tag,
  }: {
    group: GroupAnalysis;
    kind: string;
    tag: { label: string; accent: "good" | "warn" | "neutral" };
  }) => {
    const colorMap = {
      good: "bg-emerald-950/50 border-emerald-700/60",
      warn: "bg-amber-950/50 border-amber-700/60",
      neutral: "bg-neutral-900 border-neutral-700",
    };
    return (
      <div className={`rounded-xl border p-2.5 ${colorMap[tag.accent]}`}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] uppercase tracking-[0.18em] text-neutral-400 font-bold">
            {kind} recomendada
          </span>
          <Pill accent={tag.accent}>{tag.label}</Pill>
        </div>
        <div className="text-2xl font-black text-white leading-none">
          {group.label}
        </div>
        <div className="text-[10px] text-neutral-400 mt-1">{group.range}</div>
        <div className="grid grid-cols-3 gap-1 mt-1.5 text-[10px]">
          <Stat label="recente" value={`${(group.weightedRecent * 100).toFixed(0)}%`} highlight={group.weightedRecent > BASELINE * 1.2} />
          <Stat label="transição" value={`${(group.transitionProb * 100).toFixed(0)}%`} highlight={group.transitionProb > BASELINE * 1.25} />
          <Stat
            label="suporte IA"
            value={group.agentTopPicksInside.length > 0 ? `${group.agentTopPicksInside.length}/5` : "—"}
            highlight={group.agentTopPicksInside.length >= 2}
          />
        </div>
        {group.reasons.length > 0 && (
          <div className="text-[9px] text-neutral-400 mt-1.5 leading-snug">
            {group.reasons.join(" · ")}
          </div>
        )}
      </div>
    );
  }
);
BigPick.displayName = "DozenColumnBigPick";

const Stat = memo(
  ({ label, value, highlight }: { label: string; value: string; highlight: boolean }) => (
    <div className={`rounded p-1 ${highlight ? "bg-amber-500/15" : "bg-neutral-900/60"}`}>
      <div className="text-[8px] text-neutral-500 uppercase tracking-wider">{label}</div>
      <div className={`font-mono font-bold ${highlight ? "text-amber-300" : "text-neutral-200"}`}>
        {value}
      </div>
    </div>
  )
);
Stat.displayName = "DozenColumnStat";

const DetailRow = memo(
  ({ title, items, bestId }: { title: string; items: GroupAnalysis[]; bestId: string }) => (
    <div>
      <div className="text-[9px] text-neutral-500 uppercase tracking-[0.18em] font-bold mb-0.5">
        {title}
      </div>
      <div className="grid grid-cols-3 gap-1">
        {items.map((g) => {
          const isBest = g.id === bestId;
          const lift = g.weightedRecent / BASELINE;
          return (
            <div
              key={g.id}
              className={`rounded border px-1.5 py-1 text-[10px] ${
                isBest ? "border-amber-500 bg-amber-950/30" : "border-neutral-800 bg-neutral-900/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`font-bold ${isBest ? "text-amber-300" : "text-neutral-300"}`}>
                  {g.shortLabel}
                </span>
                <span className="font-mono text-neutral-400">{(lift * 100).toFixed(0)}%</span>
              </div>
              <div className="flex items-center justify-between font-mono text-[9px] text-neutral-500">
                <span>{g.observed}×</span>
                <span>z={g.z >= 0 ? "+" : ""}{g.z.toFixed(1)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  )
);
DetailRow.displayName = "DozenColumnDetailRow";

export default DozenColumnSignal;
