import { HOUSE_EDGE, SLOTS } from "./wheel";

export interface BankrollConfig {
  initial: number;
  stake: number;
  betType: "straight" | "even";
  maxRounds: number;
  stopLossPct: number;
  targetPct: number;
}

export interface SimSummary {
  meanFinal: number;
  medianFinal: number;
  worstFinal: number;
  bestFinal: number;
  hitStopLossPct: number;
  hitTargetPct: number;
  expectedLoss: number;
  curveMean: number[];
  curveP10: number[];
  curveP90: number[];
}

const simulateOne = (cfg: BankrollConfig): number[] => {
  let bal = cfg.initial;
  const curve = [bal];
  const stopAt = cfg.initial * (1 - cfg.stopLossPct / 100);
  const targetAt = cfg.initial * (1 + cfg.targetPct / 100);
  for (let r = 0; r < cfg.maxRounds; r++) {
    if (bal <= stopAt || bal >= targetAt || bal < cfg.stake) {
      for (let pad = curve.length; pad <= cfg.maxRounds; pad++) curve.push(bal);
      break;
    }
    if (cfg.betType === "straight") {
      const win = Math.floor(Math.random() * SLOTS) === 0;
      bal += win ? cfg.stake * 35 : -cfg.stake;
    } else {
      const wheelN = Math.floor(Math.random() * SLOTS);
      const won = wheelN !== 0 && Math.random() < 18 / 36;
      bal += won ? cfg.stake : -cfg.stake;
    }
    curve.push(bal);
  }
  while (curve.length <= cfg.maxRounds) curve.push(bal);
  return curve;
};

export const simulateBankroll = (cfg: BankrollConfig, trials = 600): SimSummary => {
  const finals: number[] = [];
  const curves: number[][] = [];
  let hitStop = 0;
  let hitTarget = 0;
  const stopAt = cfg.initial * (1 - cfg.stopLossPct / 100);
  const targetAt = cfg.initial * (1 + cfg.targetPct / 100);

  for (let t = 0; t < trials; t++) {
    const curve = simulateOne(cfg);
    curves.push(curve);
    const fin = curve[curve.length - 1];
    finals.push(fin);
    if (fin <= stopAt) hitStop++;
    if (fin >= targetAt) hitTarget++;
  }
  finals.sort((a, b) => a - b);
  const percentile = (sorted: number[], p: number): number => {
    if (sorted.length === 0) return 0;
    if (sorted.length === 1) return sorted[0];
    const idx = p * (sorted.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    const w = idx - lo;
    return sorted[lo] * (1 - w) + sorted[hi] * w;
  };
  const median = percentile(finals, 0.5);

  const curveMean: number[] = [];
  const curveP10: number[] = [];
  const curveP90: number[] = [];
  const len = cfg.maxRounds + 1;
  for (let i = 0; i < len; i++) {
    const slice = curves.map((c) => c[i]).sort((a, b) => a - b);
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
    curveMean.push(mean);
    curveP10.push(percentile(slice, 0.1));
    curveP90.push(percentile(slice, 0.9));
  }

  const expectedLoss = cfg.stake * cfg.maxRounds * HOUSE_EDGE;
  return {
    meanFinal: finals.reduce((a, b) => a + b, 0) / finals.length,
    medianFinal: median,
    worstFinal: finals[0],
    bestFinal: finals[finals.length - 1],
    hitStopLossPct: (hitStop / trials) * 100,
    hitTargetPct: (hitTarget / trials) * 100,
    expectedLoss,
    curveMean,
    curveP10,
    curveP90,
  };
};

export const sessionPnL = (initial: number, current: number) => ({
  abs: current - initial,
  pct: initial > 0 ? ((current - initial) / initial) * 100 : 0,
});
