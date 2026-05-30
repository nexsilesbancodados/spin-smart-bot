import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  RED,
  BLACK,
  DOZEN_1,
  DOZEN_2,
  DOZEN_3,
  COLUMN_1,
  COLUMN_2,
  COLUMN_3,
  VOISINS,
  TIERS,
  ORPHELINS,
  colorOf,
  sectorOf,
  numbersWithTerminal,
} from "./wheel";
import type { PatternActivation } from "./patternBank";

const SLOTS = 37;
const dozenIndex = (n: number) => (n === 0 ? -1 : Math.floor((n - 1) / 12));
const colIndex = (n: number) => (n === 0 ? -1 : (n - 1) % 3);
const terminalOf = (n: number) => n % 10;
const colorCode = (n: number): "R" | "B" | "Z" => (n === 0 ? "Z" : colorOf(n) === "red" ? "R" : "B");
const sectorCode = (n: number): "V" | "T" | "O" => {
  const s = sectorOf(n);
  return s === "Voisins" ? "V" : s === "Tiers" ? "T" : "O";
};

export interface DiscoveredRule {
  id: string;
  lens: "color" | "dozen" | "column" | "sector" | "terminal";
  context: string;
  predicted: string;
  occurrences: number;
  hits: number;
  attempts: number;
  weight: number;
  lastSeenAt: number;
}

interface AutoDiscoveryStore {
  rules: Record<string, DiscoveredRule>;
  totalDiscovered: number;
  lastScanAtSpinCount: number;

  registerDiscoveries: (newRules: Array<Omit<DiscoveredRule, "hits" | "attempts" | "weight">>) => void;
  recordPending: (ruleIds: string[]) => void;
  resolve: (actual: number, contextToTarget: (rule: DiscoveredRule, n: number) => boolean) => void;
  pending: string[];
  reset: () => void;
}

const wilsonLowerBound = (hits: number, attempts: number, z = 1.96): number => {
  if (attempts === 0) return 0;
  const p = hits / attempts;
  const denom = 1 + (z * z) / attempts;
  const center = (p + (z * z) / (2 * attempts)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p)) / attempts + (z * z) / (4 * attempts * attempts))) / denom;
  return Math.max(0, center - margin);
};

const computeWeight = (r: DiscoveredRule): number => {
  if (r.attempts < 3) return r.occurrences / 10;
  return wilsonLowerBound(r.hits, r.attempts);
};

export const useAutoDiscovery = create<AutoDiscoveryStore>()(
  persist(
    (set, get) => ({
      rules: {},
      totalDiscovered: 0,
      lastScanAtSpinCount: 0,
      pending: [],

      registerDiscoveries: (newRules) => {
        const s = get();
        const next = { ...s.rules };
        let discovered = 0;
        for (const r of newRules) {
          const existing = next[r.id];
          if (existing) {
            next[r.id] = {
              ...existing,
              occurrences: r.occurrences,
              lastSeenAt: r.lastSeenAt,
            };
          } else {
            next[r.id] = {
              ...r,
              hits: 0,
              attempts: 0,
              weight: 0,
            };
            discovered++;
          }
        }
        set({ rules: next, totalDiscovered: s.totalDiscovered + discovered });
      },

      recordPending: (ruleIds) => set({ pending: ruleIds }),

      resolve: (actual, contextToTarget) => {
        const s = get();
        if (s.pending.length === 0) return;
        const next = { ...s.rules };
        for (const id of s.pending) {
          const r = next[id];
          if (!r) continue;
          const hit = contextToTarget(r, actual);
          const updated: DiscoveredRule = {
            ...r,
            attempts: r.attempts + 1,
            hits: r.hits + (hit ? 1 : 0),
          };
          updated.weight = computeWeight(updated);
          next[id] = updated;
        }
        set({ rules: next, pending: [] });
      },

      reset: () => set({ rules: {}, totalDiscovered: 0, pending: [] }),
    }),
    {
      name: "rv-autodiscovery-v1",
      partialize: (s) => ({ rules: s.rules, totalDiscovered: s.totalDiscovered }),
    }
  )
);

interface NgramMine {
  lens: "color" | "dozen" | "column" | "sector" | "terminal";
  encode: (n: number) => string;
}

const MINERS: NgramMine[] = [
  { lens: "color", encode: (n) => colorCode(n) },
  { lens: "dozen", encode: (n) => (n === 0 ? "Z" : `D${dozenIndex(n) + 1}`) },
  { lens: "column", encode: (n) => (n === 0 ? "Z" : `C${colIndex(n) + 1}`) },
  { lens: "sector", encode: (n) => sectorCode(n) },
  { lens: "terminal", encode: (n) => `t${terminalOf(n)}` },
];

const NGRAM_LENGTHS = [2, 3, 4];

export interface MinedDiscovery extends Omit<DiscoveredRule, "hits" | "attempts" | "weight"> {}

export const mineRecentPatterns = (history: number[], spinCount: number): MinedDiscovery[] => {
  if (history.length < 8) return [];
  const out: MinedDiscovery[] = [];
  const sample = history.slice(0, Math.min(200, history.length));
  for (const m of MINERS) {
    for (const k of NGRAM_LENGTHS) {
      const counts = new Map<string, { occ: number; nexts: Map<string, number> }>();
      for (let i = 0; i + k < sample.length; i++) {
        const ctx = sample.slice(i + 1, i + 1 + k).map(m.encode).reverse().join(">");
        const next = m.encode(sample[i]);
        const bucket = counts.get(ctx);
        if (bucket) {
          bucket.occ++;
          bucket.nexts.set(next, (bucket.nexts.get(next) || 0) + 1);
        } else {
          counts.set(ctx, { occ: 1, nexts: new Map([[next, 1]]) });
        }
      }
      for (const [ctx, b] of counts.entries()) {
        if (b.occ < 3) continue;
        let bestNext = "";
        let bestCount = 0;
        for (const [next, c] of b.nexts.entries()) {
          if (c > bestCount) {
            bestCount = c;
            bestNext = next;
          }
        }
        if (bestCount < 2) continue;
        out.push({
          id: `auto-${m.lens}-${k}-${ctx}->${bestNext}`,
          lens: m.lens,
          context: ctx,
          predicted: bestNext,
          occurrences: b.occ,
          lastSeenAt: spinCount,
        });
      }
    }
  }
  return out;
};

const lensSetFor = (lens: DiscoveredRule["lens"], code: string): Set<number> => {
  if (lens === "color") {
    if (code === "R") return RED;
    if (code === "B") return BLACK;
    return new Set([0]);
  }
  if (lens === "dozen") {
    if (code === "D1") return DOZEN_1;
    if (code === "D2") return DOZEN_2;
    if (code === "D3") return DOZEN_3;
    return new Set([0]);
  }
  if (lens === "column") {
    if (code === "C1") return COLUMN_1;
    if (code === "C2") return COLUMN_2;
    if (code === "C3") return COLUMN_3;
    return new Set([0]);
  }
  if (lens === "sector") {
    if (code === "V") return VOISINS;
    if (code === "T") return TIERS;
    return ORPHELINS;
  }
  const t = parseInt(code.replace("t", ""), 10);
  return new Set(numbersWithTerminal(t));
};

const lensPayoutAndBaseline = (lens: DiscoveredRule["lens"], code: string): { payout: number; baseline: number; targetLabel: string; targetType: PatternActivation["targetType"] } => {
  const set = lensSetFor(lens, code);
  const size = set.size;
  const baseline = size / SLOTS;
  let payout = (SLOTS / size) - 1;
  if (lens === "color") payout = 1;
  if (lens === "dozen" || lens === "column") payout = 2;
  let targetType: PatternActivation["targetType"] = "neighbors";
  let label = code;
  if (lens === "color") {
    targetType = "color";
    label = code === "R" ? "Vermelho" : "Preto";
  } else if (lens === "dozen") {
    targetType = "dozen";
    label = code === "D1" ? "1ª Dúzia" : code === "D2" ? "2ª Dúzia" : "3ª Dúzia";
  } else if (lens === "column") {
    targetType = "column";
    label = code === "C1" ? "1ª Coluna" : code === "C2" ? "2ª Coluna" : "3ª Coluna";
  } else if (lens === "sector") {
    targetType = "sector";
    label = code === "V" ? "Voisins" : code === "T" ? "Tiers" : "Orphelins";
  } else if (lens === "terminal") {
    targetType = "terminal";
    label = `Terminal ${code.replace("t", "")}`;
  }
  return { payout, baseline, targetLabel: label, targetType };
};

export const lensTargetMatches = (rule: DiscoveredRule, actual: number): boolean => {
  const set = lensSetFor(rule.lens, rule.predicted);
  return set.has(actual);
};

export interface AutoDiscoveryActivation extends PatternActivation {
  ruleId: string;
  group: string;
  description: string;
  learnedAccuracy: number;
  attempts: number;
  hits: number;
}

const ngramContextMatches = (
  rule: DiscoveredRule,
  history: number[]
): boolean => {
  const ctxParts = rule.context.split(">");
  const k = ctxParts.length;
  if (history.length < k) return false;
  const encode = (n: number): string => {
    if (rule.lens === "color") return colorCode(n);
    if (rule.lens === "dozen") return n === 0 ? "Z" : `D${dozenIndex(n) + 1}`;
    if (rule.lens === "column") return n === 0 ? "Z" : `C${colIndex(n) + 1}`;
    if (rule.lens === "sector") return sectorCode(n);
    return `t${terminalOf(n)}`;
  };
  for (let i = 0; i < k; i++) {
    if (encode(history[i]) !== ctxParts[i]) return false;
  }
  return true;
};

export const activateDiscovered = (history: number[]): AutoDiscoveryActivation[] => {
  const rules = useAutoDiscovery.getState().rules;
  const out: AutoDiscoveryActivation[] = [];
  for (const rule of Object.values(rules)) {
    if (!ngramContextMatches(rule, history)) continue;
    const meta = lensPayoutAndBaseline(rule.lens, rule.predicted);
    const set = lensSetFor(rule.lens, rule.predicted);
    out.push({
      ruleId: rule.id,
      group: `auto-discovered-${rule.lens}`,
      description: `Auto: ${rule.context} → ${meta.targetLabel} (${rule.occurrences}× histórico, W95L=${(rule.weight * 100).toFixed(0)}%)`,
      numbers: set,
      payout: meta.payout,
      baseline: meta.baseline,
      targetLabel: meta.targetLabel,
      targetType: meta.targetType,
      strength: Math.min(1, rule.occurrences / 10 + 0.3),
      learnedAccuracy: rule.weight,
      attempts: rule.attempts,
      hits: rule.hits,
    });
  }
  return out;
};
