import { describe, it, expect } from "vitest";
import { createEnsemble } from "../ensemble";
import { createMarkov, trainMarkov, predictMarkov, topK } from "../learning";
import { createLSTM, trainOnSequence, predict as lstmPredict } from "../lstm";
import { runBacktest } from "../backtest";
import { detectDealerChange } from "../dealerChange";
import { chiSquareUniform, analyzeGroup, concentrationIndex } from "../stats";
import { VOISINS, SLOTS } from "../wheel";
import { evaluateRule, defaultRules } from "../customPatterns";
import { simulateBankroll } from "../bankroll";

const synthSpins = (n: number, seed = 42): number[] => {
  let s = seed | 0;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    s = (s * 1664525 + 1013904223) | 0;
    out.push(((s >>> 0) % SLOTS));
  }
  return out;
};

describe("Markov", () => {
  it("predicts uniform-ish distribution that sums to 1", () => {
    const spins = synthSpins(200);
    const m = createMarkov(2);
    trainMarkov(m, spins);
    const probs = predictMarkov(m, spins.slice(0, 2));
    const sum = Array.from(probs).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 3);
    expect(probs.length).toBe(SLOTS);
  });

  it("topK returns sorted descending picks", () => {
    const probs = new Float32Array(SLOTS);
    probs[5] = 0.5;
    probs[10] = 0.3;
    probs[1] = 0.2;
    const top = topK(probs, 3);
    expect(top[0].n).toBe(5);
    expect(top[1].n).toBe(10);
    expect(top[2].n).toBe(1);
  });
});

describe("Ensemble", () => {
  it("predict returns valid distribution", () => {
    const spins = synthSpins(300);
    const ens = createEnsemble();
    ens.train(spins);
    const r = ens.predict();
    const sum = Array.from(r.combined).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 2);
    expect(r.perModel.length).toBeGreaterThanOrEqual(6);
  });

  it("observe updates model weights", () => {
    const spins = synthSpins(100);
    const ens = createEnsemble();
    ens.train(spins);
    ens.predict();
    const weightsBefore = ens.models.map((m) => m.weight);
    for (let i = 0; i < 10; i++) {
      ens.observe(Math.floor(Math.random() * SLOTS));
    }
    const weightsAfter = ens.models.map((m) => m.weight);
    expect(weightsAfter).not.toEqual(weightsBefore);
  });
});

describe("LSTM", () => {
  it("predict returns valid distribution after training", () => {
    const spins = synthSpins(80);
    const model = createLSTM(8);
    trainOnSequence(model, spins, 20);
    const probs = lstmPredict(model, spins.slice(0, 10));
    const sum = Array.from(probs).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 2);
    expect(probs.length).toBe(SLOTS);
  });
});

describe("Backtester", () => {
  it("runs a strategy and returns plausible result shape", () => {
    const spins = synthSpins(150);
    const result = runBacktest(spins, "always-red");
    expect(result.rounds).toBeGreaterThan(0);
    expect(result.totalWagered).toBeGreaterThan(0);
    expect(result.curve.length).toBe(result.rounds + 1);
  });

  it("ensemble-top5 converges close to negative house edge over enough rounds", () => {
    const spins = synthSpins(400, 99);
    const result = runBacktest(spins, "ensemble-top5");
    expect(result.realizedEdge).toBeLessThan(0.1);
    expect(result.realizedEdge).toBeGreaterThan(-0.5);
  });
});

describe("Stats", () => {
  it("chi-square on uniform spins reports compatible", () => {
    const spins = synthSpins(2000, 1);
    const r = chiSquareUniform(spins);
    expect(r.pApprox).toBeGreaterThan(0.001);
    expect(r.df).toBe(SLOTS - 1);
  });

  it("analyzeGroup returns proper structure", () => {
    const spins = synthSpins(500);
    const r = analyzeGroup("Voisins", VOISINS, spins);
    expect(r.observed).toBeGreaterThanOrEqual(0);
    expect(r.expected).toBeCloseTo(500 * (17 / SLOTS), 0);
  });

  it("concentrationIndex between 0 and 100", () => {
    const spins = synthSpins(300);
    const ci = concentrationIndex(spins);
    expect(ci).toBeGreaterThanOrEqual(0);
    expect(ci).toBeLessThanOrEqual(100);
  });
});

describe("Dealer change", () => {
  it("returns ok for uniform spins", () => {
    const spins = synthSpins(200);
    const r = detectDealerChange(spins, 30);
    expect(["ok", "watch"].includes(r.alertLevel)).toBe(true);
  });

  it("returns insufficient sample with too few spins", () => {
    const r = detectDealerChange([1, 2, 3], 30);
    expect(r.message).toContain("Aguardando");
  });
});

describe("Custom patterns", () => {
  it("default rules evaluate without crashing", () => {
    const spins = synthSpins(200);
    for (const rule of defaultRules) {
      const r = evaluateRule(rule, spins);
      expect(r.rule).toBeDefined();
      expect(r.triggerFires).toBeGreaterThanOrEqual(0);
      expect(r.hits).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("Bankroll Monte Carlo", () => {
  it("simulates and returns plausible curve", () => {
    const sim = simulateBankroll(
      {
        initial: 200,
        stake: 5,
        betType: "even",
        maxRounds: 40,
        stopLossPct: 30,
        targetPct: 30,
      },
      50
    );
    expect(sim.curveMean.length).toBe(41);
    expect(sim.expectedLoss).toBeGreaterThan(0);
  });
});
