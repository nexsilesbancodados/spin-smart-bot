import { computeMasterSignal } from "./masterSignal";

export interface BacktestSpinResult {
  index: number;
  actualNumber: number;
  hit: boolean | null;
  skipped: boolean;
  target: string | null;
  targetType: string | null;
  payout: number;
  stake: number;
  delta: number;
  cumulative: number;
  family: string | null;
  strictValid: boolean;
  numbers: number[];
}

export interface FamilyBreakdown {
  family: string;
  bets: number;
  hits: number;
  hitRate: number;
  pnl: number;
}

export interface BacktestResult {
  totalSpins: number;
  betCount: number;
  skipCount: number;
  hits: number;
  misses: number;
  hitRate: number;
  pnl: number;
  staked: number;
  roi: number;
  finalBank: number;
  startingBank: number;
  maxBank: number;
  minBank: number;
  maxDrawdown: number;
  results: BacktestSpinResult[];
  byFamily: FamilyBreakdown[];
  byTargetType: FamilyBreakdown[];
  options: BacktestOptions;
}

export interface BacktestOptions {
  window: number;
  stake: number;
  startingBank: number;
  useStrictMode: boolean;
  useFocusedScope: boolean;
  focusedTypes: string[];
}

const DEFAULT_FOCUSED: string[] = [
  "color",
  "parity",
  "highlow",
  "dozen",
  "column",
  "sector",
];

export interface BacktestProgress {
  done: number;
  total: number;
  pnlSoFar: number;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const runMasterBacktest = async (
  fullHistory: number[],
  options: Partial<BacktestOptions> = {},
  onProgress?: (p: BacktestProgress) => void
): Promise<BacktestResult> => {
  const opts: BacktestOptions = {
    window: options.window ?? 200,
    stake: options.stake ?? 10,
    startingBank: options.startingBank ?? 500,
    useStrictMode: options.useStrictMode ?? true,
    useFocusedScope: options.useFocusedScope ?? true,
    focusedTypes: options.focusedTypes ?? DEFAULT_FOCUSED,
  };

  const minContext = 30;
  const N = Math.min(opts.window, Math.max(0, fullHistory.length - minContext));
  const results: BacktestSpinResult[] = [];

  let cumulative = 0;
  let bank = opts.startingBank;
  let maxBank = bank;
  let minBank = bank;
  let peakBank = bank;
  let maxDD = 0;

  for (let step = 0; step < N; step++) {
    const i = N - 1 - step;
    const actualNumber = fullHistory[i];
    const pastHistory = fullHistory.slice(i + 1);

    const { ranked } = computeMasterSignal(pastHistory, null);
    if (ranked.length === 0) {
      results.push({
        index: i,
        actualNumber,
        hit: null,
        skipped: true,
        target: null,
        targetType: null,
        payout: 0,
        stake: 0,
        delta: 0,
        cumulative,
        family: null,
        strictValid: false,
        numbers: [],
      });
      continue;
    }

    let candidate = ranked[0];
    if (opts.useFocusedScope && opts.focusedTypes.length > 0) {
      const scoped = ranked.filter((c) => opts.focusedTypes.includes(c.targetType));
      if (scoped.length > 0) candidate = scoped[0];
    }

    if (opts.useStrictMode && !candidate.strictValid) {
      results.push({
        index: i,
        actualNumber,
        hit: null,
        skipped: true,
        target: candidate.targetLabel,
        targetType: candidate.targetType,
        payout: candidate.payout,
        stake: 0,
        delta: 0,
        cumulative,
        family: candidate.patternRule?.group ?? "unified",
        strictValid: false,
        numbers: candidate.numbers,
      });
      continue;
    }

    const hit = candidate.numbers.includes(actualNumber);
    const stake = Math.min(opts.stake, Math.max(0, bank));
    const delta = stake <= 0 ? 0 : hit ? stake * candidate.payout : -stake;
    cumulative += delta;
    bank += delta;
    if (bank > maxBank) maxBank = bank;
    if (bank < minBank) minBank = bank;
    if (bank > peakBank) peakBank = bank;
    const dd = (peakBank - bank) / Math.max(1, peakBank);
    if (dd > maxDD) maxDD = dd;

    results.push({
      index: i,
      actualNumber,
      hit,
      skipped: false,
      target: candidate.targetLabel,
      targetType: candidate.targetType,
      payout: candidate.payout,
      stake,
      delta,
      cumulative,
      family: candidate.patternRule?.group ?? "unified",
      strictValid: candidate.strictValid,
      numbers: candidate.numbers,
    });

    if (onProgress && step % 5 === 0) {
      onProgress({ done: step + 1, total: N, pnlSoFar: cumulative });
      await sleep(0);
    }
  }

  if (onProgress) onProgress({ done: N, total: N, pnlSoFar: cumulative });

  const placedBets = results.filter((r) => !r.skipped);
  const hits = placedBets.filter((r) => r.hit === true).length;
  const misses = placedBets.filter((r) => r.hit === false).length;
  const staked = placedBets.reduce((acc, r) => acc + r.stake, 0);
  const pnl = placedBets.reduce((acc, r) => acc + r.delta, 0);
  const hitRate = placedBets.length > 0 ? hits / placedBets.length : 0;
  const roi = staked > 0 ? pnl / staked : 0;

  const familyMap = new Map<string, FamilyBreakdown>();
  for (const r of placedBets) {
    const f = r.family || "unknown";
    if (!familyMap.has(f)) {
      familyMap.set(f, { family: f, bets: 0, hits: 0, hitRate: 0, pnl: 0 });
    }
    const fb = familyMap.get(f)!;
    fb.bets++;
    if (r.hit) fb.hits++;
    fb.pnl += r.delta;
  }
  for (const fb of familyMap.values()) {
    fb.hitRate = fb.bets > 0 ? fb.hits / fb.bets : 0;
  }
  const byFamily = Array.from(familyMap.values()).sort((a, b) => b.pnl - a.pnl);

  const typeMap = new Map<string, FamilyBreakdown>();
  for (const r of placedBets) {
    const t = r.targetType || "unknown";
    if (!typeMap.has(t)) {
      typeMap.set(t, { family: t, bets: 0, hits: 0, hitRate: 0, pnl: 0 });
    }
    const tb = typeMap.get(t)!;
    tb.bets++;
    if (r.hit) tb.hits++;
    tb.pnl += r.delta;
  }
  for (const tb of typeMap.values()) {
    tb.hitRate = tb.bets > 0 ? tb.hits / tb.bets : 0;
  }
  const byTargetType = Array.from(typeMap.values()).sort((a, b) => b.pnl - a.pnl);

  return {
    totalSpins: N,
    betCount: placedBets.length,
    skipCount: results.filter((r) => r.skipped).length,
    hits,
    misses,
    hitRate,
    pnl,
    staked,
    roi,
    finalBank: bank,
    startingBank: opts.startingBank,
    maxBank,
    minBank,
    maxDrawdown: maxDD,
    results,
    byFamily,
    byTargetType,
    options: opts,
  };
};
