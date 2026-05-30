import {
  RED,
  BLACK,
  DOZEN_1,
  DOZEN_2,
  DOZEN_3,
  numbersWithTerminal,
  colorOf,
} from "./wheel";
import type { PatternRule, PatternActivation } from "./patternBank";

const SLOTS = 37;
const terminalOf = (n: number) => n % 10;

const dozenSets = [DOZEN_1, DOZEN_2, DOZEN_3];
const dozenLabels = ["1ª Dúzia", "2ª Dúzia", "3ª Dúzia"];

const setOf = (nums: number[]): Set<number> => new Set(nums);

const terminalPair = (): PatternRule[] => {
  const out: PatternRule[] = [];
  for (let a = 0; a <= 9; a++) {
    for (let b = 0; b <= 9; b++) {
      const targetSet = setOf(numbersWithTerminal(b));
      out.push({
        id: `tpair-${a}-${b}`,
        group: "terminal-pair-sequence",
        description: `Terminal ${a} → terminal ${b} (sequência 2)`,
        activate(history) {
          if (history.length < 1) return null;
          if (terminalOf(history[0]) !== a) return null;
          const activation: PatternActivation = {
            numbers: targetSet,
            payout: 35 / targetSet.size,
            baseline: targetSet.size / SLOTS,
            targetLabel: `Terminal ${b}`,
            targetType: "terminal",
            strength: 0.45,
          };
          void activation;
          return activation;
        },
      });
    }
  }
  return out;
};

const terminalTriplet = (): PatternRule[] => {
  const out: PatternRule[] = [];
  for (let a = 0; a <= 9; a++) {
    for (let b = 0; b <= 9; b++) {
      for (let c = 0; c <= 9; c++) {
        const targetSet = setOf(numbersWithTerminal(c));
        out.push({
          id: `ttrip-${a}-${b}-${c}`,
          group: "terminal-triplet",
          description: `Terminais ${a}→${b}→? (predizido ${c})`,
          activate(history) {
            if (history.length < 2) return null;
            if (terminalOf(history[1]) !== a) return null;
            if (terminalOf(history[0]) !== b) return null;
            return {
              numbers: targetSet,
              payout: 35 / targetSet.size,
              baseline: targetSet.size / SLOTS,
              targetLabel: `Terminal ${c}`,
              targetType: "terminal",
              strength: 0.6,
            };
          },
        });
      }
    }
  }
  return out;
};

const terminalRepeatWithGap = (): PatternRule[] => {
  const out: PatternRule[] = [];
  for (let t = 0; t <= 9; t++) {
    for (const gap of [2, 3, 4, 6, 8]) {
      out.push({
        id: `tgap-${t}-g${gap}`,
        group: "terminal-repeat-gap",
        description: `Terminal ${t} há ${gap} giros → repete`,
        activate(history) {
          if (history.length <= gap) return null;
          if (terminalOf(history[gap]) !== t) return null;
          const set = setOf(numbersWithTerminal(t));
          return {
            numbers: set,
            payout: 35 / set.size,
            baseline: set.size / SLOTS,
            targetLabel: `Terminal ${t}`,
            targetType: "terminal",
            strength: Math.max(0.3, 0.6 - gap * 0.05),
          };
        },
      });
    }
  }
  return out;
};

const terminalColorCombo = (): PatternRule[] => {
  const out: PatternRule[] = [];
  for (let t = 0; t <= 9; t++) {
    const termSet = numbersWithTerminal(t);
    for (const color of ["R", "B"] as const) {
      const colorSet = color === "R" ? RED : BLACK;
      const intersection = new Set<number>();
      for (const n of termSet) if (colorSet.has(n)) intersection.add(n);
      if (intersection.size === 0) continue;
      out.push({
        id: `tcolor-${t}-${color}`,
        group: "terminal-color-combo",
        description: `Após terminal ${t} ${color === "R" ? "vermelho" : "preto"} → mesma combinação`,
        activate(history) {
          if (history.length < 1) return null;
          const head = history[0];
          if (terminalOf(head) !== t) return null;
          if (color === "R" ? !RED.has(head) : !BLACK.has(head)) return null;
          return {
            numbers: intersection,
            payout: 35 / intersection.size,
            baseline: intersection.size / SLOTS,
            targetLabel: `Terminal ${t} ${color === "R" ? "Vermelho" : "Preto"}`,
            targetType: "neighbors",
            strength: 0.55,
          };
        },
      });
    }
  }
  return out;
};

const terminalDozenCombo = (): PatternRule[] => {
  const out: PatternRule[] = [];
  for (let t = 0; t <= 9; t++) {
    const termSet = numbersWithTerminal(t);
    for (let d = 0; d < 3; d++) {
      const intersection = new Set<number>();
      for (const n of termSet) if (dozenSets[d].has(n)) intersection.add(n);
      if (intersection.size === 0) continue;
      out.push({
        id: `tdozen-${t}-d${d}`,
        group: "terminal-dozen-combo",
        description: `Após terminal ${t} em D${d + 1} → repete combinação`,
        activate(history) {
          if (history.length < 1) return null;
          const head = history[0];
          if (terminalOf(head) !== t) return null;
          if (!dozenSets[d].has(head)) return null;
          return {
            numbers: intersection,
            payout: 35 / intersection.size,
            baseline: intersection.size / SLOTS,
            targetLabel: `Terminal ${t} ∩ ${dozenLabels[d]}`,
            targetType: "neighbors",
            strength: 0.55,
          };
        },
      });
    }
  }
  return out;
};

const terminalClusterPattern = (): PatternRule[] => {
  const out: PatternRule[] = [];
  for (let t = 0; t <= 9; t++) {
    for (const lookback of [5, 10, 20]) {
      const min = lookback >= 10 ? 3 : 2;
      out.push({
        id: `tcluster-${t}-l${lookback}-m${min}`,
        group: "terminal-cluster",
        description: `≥${min} terminais ${t} em ${lookback} giros → repete família`,
        activate(history) {
          if (history.length < lookback) return null;
          const slice = history.slice(0, lookback);
          let count = 0;
          for (const n of slice) if (terminalOf(n) === t) count++;
          if (count < min) return null;
          const set = setOf(numbersWithTerminal(t));
          return {
            numbers: set,
            payout: 35 / set.size,
            baseline: set.size / SLOTS,
            targetLabel: `Terminal ${t} (cluster)`,
            targetType: "terminal",
            strength: Math.min(1, count / 5 + 0.3),
          };
        },
      });
    }
  }
  return out;
};

const terminalAlternation = (): PatternRule[] => {
  const out: PatternRule[] = [];
  for (let a = 0; a <= 9; a++) {
    for (let b = 0; b <= 9; b++) {
      if (a === b) continue;
      out.push({
        id: `talt-${a}-${b}`,
        group: "terminal-alternation",
        description: `Padrão alternado terminal ${a}↔${b} (3 últimos) → próximo termina em ${b}`,
        activate(history) {
          if (history.length < 3) return null;
          if (terminalOf(history[2]) !== a) return null;
          if (terminalOf(history[1]) !== b) return null;
          if (terminalOf(history[0]) !== a) return null;
          const set = setOf(numbersWithTerminal(b));
          return {
            numbers: set,
            payout: 35 / set.size,
            baseline: set.size / SLOTS,
            targetLabel: `Terminal ${b}`,
            targetType: "terminal",
            strength: 0.7,
          };
        },
      });
    }
  }
  return out;
};

const camouflagePatterns = (): PatternRule[] => {
  const out: PatternRule[] = [];
  for (let n = 1; n <= 36; n++) {
    const mirror = 37 - n;
    const term = terminalOf(n);
    const termFamily = numbersWithTerminal(term);
    const set = new Set<number>([n, mirror, ...termFamily]);
    out.push({
      id: `camouflage-${n}`,
      group: "number-camouflage",
      description: `Após ${n} → disfarces: ${mirror} (espelho) + terminal ${term}`,
      activate(history) {
        if (history.length < 1) return null;
        if (history[0] !== n) return null;
        return {
          numbers: set,
          payout: 35 / set.size,
          baseline: set.size / SLOTS,
          targetLabel: `Família de ${n} (espelho/terminal)`,
          targetType: "neighbors",
          strength: 0.5,
        };
      },
    });
  }
  return out;
};

const dualTerminalCluster = (): PatternRule[] => {
  const out: PatternRule[] = [];
  for (let a = 0; a <= 9; a++) {
    for (let b = a + 1; b <= 9; b++) {
      const family = new Set([...numbersWithTerminal(a), ...numbersWithTerminal(b)]);
      for (const lookback of [6, 12]) {
        out.push({
          id: `dual-term-${a}-${b}-l${lookback}`,
          group: "dual-terminal-cluster",
          description: `≥4 terminais ${a} ou ${b} em ${lookback} → continua família`,
          activate(history) {
            if (history.length < lookback) return null;
            const slice = history.slice(0, lookback);
            let count = 0;
            for (const n of slice) if (terminalOf(n) === a || terminalOf(n) === b) count++;
            if (count < 4) return null;
            return {
              numbers: family,
              payout: 35 / family.size,
              baseline: family.size / SLOTS,
              targetLabel: `Terminais ${a}/${b}`,
              targetType: "terminal",
              strength: Math.min(1, count / 6 + 0.3),
            };
          },
        });
      }
    }
  }
  return out;
};

const sumTerminalPatterns = (): PatternRule[] => {
  const out: PatternRule[] = [];
  for (let s = 0; s <= 18; s++) {
    const matches = new Set<number>();
    for (let n = 0; n <= 36; n++) {
      const t1 = Math.floor(n / 10);
      const t2 = n % 10;
      if (t1 + t2 === s) matches.add(n);
    }
    if (matches.size < 2 || matches.size > 7) continue;
    out.push({
      id: `sumterm-${s}`,
      group: "digit-sum-cluster",
      description: `Soma de dígitos = ${s} (família ${matches.size} números)`,
      activate(history) {
        if (history.length < 1) return null;
        if (!matches.has(history[0])) return null;
        return {
          numbers: matches,
          payout: 35 / matches.size,
          baseline: matches.size / SLOTS,
          targetLabel: `Soma dígitos = ${s}`,
          targetType: "neighbors",
          strength: 0.4,
        };
      },
    });
  }
  return out;
};

export const buildTerminalDeepPatterns = (): PatternRule[] => {
  return [
    ...terminalPair(),
    ...terminalTriplet(),
    ...terminalRepeatWithGap(),
    ...terminalColorCombo(),
    ...terminalDozenCombo(),
    ...terminalClusterPattern(),
    ...terminalAlternation(),
    ...camouflagePatterns(),
    ...dualTerminalCluster(),
    ...sumTerminalPatterns(),
  ];
};

void colorOf;
