import { SLOTS, VOISINS, TIERS, ORPHELINS, RED, BLACK, DOZEN_1, DOZEN_2, DOZEN_3 } from "./wheel";

export interface HorizonPrediction {
  horizon: number;
  members: Set<number>;
  label: string;
  coverage: number;
  hitProbabilityPerSpin: number;
  hitProbabilityCumulative: number;
  baselineCumulative: number;
  expectedSpinsToHit: number;
}

const hitProb = (members: Set<number>): number => members.size / SLOTS;

const cumulativeHit = (perSpinProb: number, horizon: number): number => {
  return 1 - Math.pow(1 - perSpinProb, horizon);
};

const expectedSpinsTillHit = (perSpinProb: number): number => {
  if (perSpinProb <= 0) return Infinity;
  return 1 / perSpinProb;
};

const modelHitProb = (members: Set<number>, modelProbs: Float32Array): number => {
  let p = 0;
  for (const n of members) p += modelProbs[n] ?? 0;
  return p;
};

export const buildHorizonPredictions = (
  topPicks: number[],
  modelProbs: Float32Array,
  horizons: number[] = [1, 3, 5, 10]
): HorizonPrediction[] => {
  const out: HorizonPrediction[] = [];

  const categories: Array<{ label: string; members: Set<number> }> = [
    { label: `Top-1 (${topPicks[0]})`, members: new Set([topPicks[0]]) },
    { label: "Top-3 plenos", members: new Set(topPicks.slice(0, 3)) },
    { label: "Top-5 plenos", members: new Set(topPicks.slice(0, 5)) },
    { label: "Top-8 plenos", members: new Set(topPicks.slice(0, 8)) },
    { label: "Top-12 plenos", members: new Set(topPicks.slice(0, 12)) },
    { label: "Voisins (17)", members: VOISINS },
    { label: "Tiers (12)", members: TIERS },
    { label: "Orphelins (8)", members: ORPHELINS },
    { label: "Vermelho", members: RED },
    { label: "Preto", members: BLACK },
    { label: "1ª Dúzia", members: DOZEN_1 },
    { label: "2ª Dúzia", members: DOZEN_2 },
    { label: "3ª Dúzia", members: DOZEN_3 },
  ];

  for (const h of horizons) {
    for (const cat of categories) {
      const baseline = hitProb(cat.members);
      const modelPerSpin = modelHitProb(cat.members, modelProbs);
      const effective = modelPerSpin > 0 ? modelPerSpin : baseline;
      out.push({
        horizon: h,
        members: cat.members,
        label: cat.label,
        coverage: cat.members.size,
        hitProbabilityPerSpin: effective,
        hitProbabilityCumulative: cumulativeHit(effective, h),
        baselineCumulative: cumulativeHit(baseline, h),
        expectedSpinsToHit: expectedSpinsTillHit(effective),
      });
    }
  }

  return out;
};

export const groupByCategory = (predictions: HorizonPrediction[]) => {
  const grouped = new Map<string, HorizonPrediction[]>();
  for (const p of predictions) {
    const arr = grouped.get(p.label) ?? [];
    arr.push(p);
    grouped.set(p.label, arr);
  }
  return grouped;
};
