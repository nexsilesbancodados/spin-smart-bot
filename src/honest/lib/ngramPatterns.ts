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
} from "./wheel";
import type { PatternRule, PatternActivation } from "./patternBank";

const SLOTS = 37;
const dozenIndex = (n: number) => (n === 0 ? -1 : Math.floor((n - 1) / 12));
const colIndex = (n: number) => (n === 0 ? -1 : (n - 1) % 3);

const colorCode = (n: number): "R" | "B" | "G" =>
  n === 0 ? "G" : colorOf(n) === "red" ? "R" : "B";

const sectorCode = (n: number): "V" | "T" | "O" => {
  const s = sectorOf(n);
  return s === "Voisins" ? "V" : s === "Tiers" ? "T" : "O";
};

const dozenSets = [DOZEN_1, DOZEN_2, DOZEN_3];
const colSets = [COLUMN_1, COLUMN_2, COLUMN_3];
const dozenLabels = ["1ª Dúzia", "2ª Dúzia", "3ª Dúzia"];
const colLabels = ["1ª Coluna", "2ª Coluna", "3ª Coluna"];
const sectorSets: Record<string, Set<number>> = {
  V: VOISINS,
  T: TIERS,
  O: ORPHELINS,
};
const sectorLabels: Record<string, string> = {
  V: "Voisins",
  T: "Tiers",
  O: "Orphelins",
};

const baseStrength = (n: number): number => Math.min(1, 0.4 + n * 0.12);

const dozenNgram = (n: 3 | 4 | 5): PatternRule[] => {
  const out: PatternRule[] = [];
  const total = Math.pow(3, n);
  for (let combo = 0; combo < total; combo++) {
    const seq: number[] = [];
    let c = combo;
    for (let i = 0; i < n; i++) {
      seq.push(c % 3);
      c = Math.floor(c / 3);
    }
    for (let nextD = 0; nextD < 3; nextD++) {
      const seqLabel = seq.map((d) => `D${d + 1}`).join("→");
      out.push({
        id: `dgram-${n}-${combo}-pred${nextD}`,
        group: `dozen-${n}gram`,
        description: `${n}-gram dúzias [${seqLabel}] → D${nextD + 1}`,
        activate(history) {
          if (history.length < n) return null;
          for (let i = 0; i < n; i++) {
            if (dozenIndex(history[i]) !== seq[n - 1 - i]) return null;
          }
          const activation: PatternActivation = {
            numbers: dozenSets[nextD],
            payout: 2,
            baseline: 12 / SLOTS,
            targetLabel: dozenLabels[nextD],
            targetType: "dozen",
            strength: baseStrength(n),
          };
          return activation;
        },
      });
    }
  }
  return out;
};

const columnNgram = (n: 3 | 4 | 5): PatternRule[] => {
  const out: PatternRule[] = [];
  const total = Math.pow(3, n);
  for (let combo = 0; combo < total; combo++) {
    const seq: number[] = [];
    let c = combo;
    for (let i = 0; i < n; i++) {
      seq.push(c % 3);
      c = Math.floor(c / 3);
    }
    for (let nextC = 0; nextC < 3; nextC++) {
      const seqLabel = seq.map((d) => `C${d + 1}`).join("→");
      out.push({
        id: `cgram-${n}-${combo}-pred${nextC}`,
        group: `column-${n}gram`,
        description: `${n}-gram colunas [${seqLabel}] → C${nextC + 1}`,
        activate(history) {
          if (history.length < n) return null;
          for (let i = 0; i < n; i++) {
            if (colIndex(history[i]) !== seq[n - 1 - i]) return null;
          }
          return {
            numbers: colSets[nextC],
            payout: 2,
            baseline: 12 / SLOTS,
            targetLabel: colLabels[nextC],
            targetType: "column",
            strength: baseStrength(n),
          };
        },
      });
    }
  }
  return out;
};

const colorNgram = (n: 3 | 4 | 5 | 6): PatternRule[] => {
  const out: PatternRule[] = [];
  const total = Math.pow(2, n);
  for (let combo = 0; combo < total; combo++) {
    const seq: ("R" | "B")[] = [];
    let c = combo;
    for (let i = 0; i < n; i++) {
      seq.push(c % 2 === 0 ? "R" : "B");
      c = Math.floor(c / 2);
    }
    for (const next of ["R", "B"] as const) {
      const seqLabel = seq.join("→");
      const nextSet = next === "R" ? RED : BLACK;
      const nextLabel = next === "R" ? "Vermelho" : "Preto";
      out.push({
        id: `colorgram-${n}-${combo}-pred${next}`,
        group: `color-${n}gram`,
        description: `${n}-gram cor [${seqLabel}] → ${nextLabel}`,
        activate(history) {
          if (history.length < n) return null;
          for (let i = 0; i < n; i++) {
            if (colorCode(history[i]) !== seq[n - 1 - i]) return null;
          }
          return {
            numbers: nextSet,
            payout: 1,
            baseline: 18 / SLOTS,
            targetLabel: nextLabel,
            targetType: "color",
            strength: baseStrength(n - 1),
          };
        },
      });
    }
  }
  return out;
};

const sectorNgram = (n: 3 | 4): PatternRule[] => {
  const out: PatternRule[] = [];
  const codes: Array<"V" | "T" | "O"> = ["V", "T", "O"];
  const total = Math.pow(3, n);
  for (let combo = 0; combo < total; combo++) {
    const seq: Array<"V" | "T" | "O"> = [];
    let c = combo;
    for (let i = 0; i < n; i++) {
      seq.push(codes[c % 3]);
      c = Math.floor(c / 3);
    }
    for (const nextCode of codes) {
      const seqLabel = seq.join("→");
      out.push({
        id: `sectorgram-${n}-${combo}-pred${nextCode}`,
        group: `sector-${n}gram`,
        description: `${n}-gram setor [${seqLabel}] → ${sectorLabels[nextCode]}`,
        activate(history) {
          if (history.length < n) return null;
          for (let i = 0; i < n; i++) {
            if (sectorCode(history[i]) !== seq[n - 1 - i]) return null;
          }
          const set = sectorSets[nextCode];
          return {
            numbers: set,
            payout: 35 / set.size,
            baseline: set.size / SLOTS,
            targetLabel: sectorLabels[nextCode],
            targetType: "sector",
            strength: baseStrength(n),
          };
        },
      });
    }
  }
  return out;
};

const crossLensColorDozen = (): PatternRule[] => {
  const out: PatternRule[] = [];
  for (const color of ["R", "B"] as const) {
    const colorSet = color === "R" ? RED : BLACK;
    for (let d = 0; d < 3; d++) {
      for (let depth = 2; depth <= 4; depth++) {
        out.push({
          id: `cross-cd-${color}-${d}-d${depth}`,
          group: "cross-color-dozen",
          description: `${depth}× ${color === "R" ? "Vermelho" : "Preto"} na D${d + 1} → continua`,
          activate(history) {
            if (history.length < depth) return null;
            for (let i = 0; i < depth; i++) {
              const n = history[i];
              if (!colorSet.has(n) || !dozenSets[d].has(n)) return null;
            }
            const intersection = new Set<number>();
            for (const n of dozenSets[d]) if (colorSet.has(n)) intersection.add(n);
            return {
              numbers: intersection,
              payout: 35 / intersection.size,
              baseline: intersection.size / SLOTS,
              targetLabel: `${color === "R" ? "Vermelho" : "Preto"} ∩ D${d + 1}`,
              targetType: "neighbors",
              strength: Math.min(1, depth / 4),
            };
          },
        });
      }
    }
  }
  return out;
};

const crossLensColorSector = (): PatternRule[] => {
  const out: PatternRule[] = [];
  for (const color of ["R", "B"] as const) {
    const colorSet = color === "R" ? RED : BLACK;
    const colorLabel = color === "R" ? "Vermelho" : "Preto";
    for (const sc of ["V", "T", "O"] as const) {
      const set = sectorSets[sc];
      const intersection = new Set<number>();
      for (const n of set) if (colorSet.has(n)) intersection.add(n);
      if (intersection.size === 0) continue;
      for (let depth = 2; depth <= 3; depth++) {
        out.push({
          id: `cross-cs-${color}-${sc}-d${depth}`,
          group: "cross-color-sector",
          description: `${depth}× ${colorLabel} no ${sectorLabels[sc]} → continua`,
          activate(history) {
            if (history.length < depth) return null;
            for (let i = 0; i < depth; i++) {
              if (!intersection.has(history[i])) return null;
            }
            return {
              numbers: intersection,
              payout: 35 / intersection.size,
              baseline: intersection.size / SLOTS,
              targetLabel: `${colorLabel} ∩ ${sectorLabels[sc]}`,
              targetType: "neighbors",
              strength: Math.min(1, depth / 3),
            };
          },
        });
      }
    }
  }
  return out;
};

const crossLensParityDozen = (): PatternRule[] => {
  const out: PatternRule[] = [];
  const evens = new Set<number>();
  const odds = new Set<number>();
  for (let n = 1; n <= 36; n++) (n % 2 === 0 ? evens : odds).add(n);
  for (const par of [
    { key: "even", set: evens, label: "Par" },
    { key: "odd", set: odds, label: "Ímpar" },
  ]) {
    for (let d = 0; d < 3; d++) {
      const intersection = new Set<number>();
      for (const n of dozenSets[d]) if (par.set.has(n)) intersection.add(n);
      for (let depth = 2; depth <= 3; depth++) {
        out.push({
          id: `cross-pd-${par.key}-${d}-d${depth}`,
          group: "cross-parity-dozen",
          description: `${depth}× ${par.label} na D${d + 1} → continua`,
          activate(history) {
            if (history.length < depth) return null;
            for (let i = 0; i < depth; i++) {
              if (!intersection.has(history[i])) return null;
            }
            return {
              numbers: intersection,
              payout: 35 / intersection.size,
              baseline: intersection.size / SLOTS,
              targetLabel: `${par.label} ∩ D${d + 1}`,
              targetType: "neighbors",
              strength: Math.min(1, depth / 3),
            };
          },
        });
      }
    }
  }
  return out;
};

const transitionLensCorrelations = (): PatternRule[] => {
  const out: PatternRule[] = [];
  for (let d = 0; d < 3; d++) {
    for (let c = 0; c < 3; c++) {
      const intersection = new Set<number>();
      for (const n of dozenSets[d]) if (colSets[c].has(n)) intersection.add(n);
      if (intersection.size === 0) continue;
      out.push({
        id: `cross-dc-${d}-${c}`,
        group: "cross-dozen-column",
        description: `Após D${d + 1} ∩ C${c + 1} → continua na interseção`,
        activate(history) {
          if (history.length < 1) return null;
          if (!intersection.has(history[0])) return null;
          return {
            numbers: intersection,
            payout: 35 / intersection.size,
            baseline: intersection.size / SLOTS,
            targetLabel: `D${d + 1} ∩ C${c + 1}`,
            targetType: "neighbors",
            strength: 0.55,
          };
        },
      });
    }
  }
  return out;
};

export const buildNgramPatterns = (): PatternRule[] => {
  return [
    ...dozenNgram(3),
    ...dozenNgram(4),
    ...columnNgram(3),
    ...columnNgram(4),
    ...colorNgram(3),
    ...colorNgram(4),
    ...colorNgram(5),
    ...sectorNgram(3),
    ...crossLensColorDozen(),
    ...crossLensColorSector(),
    ...crossLensParityDozen(),
    ...transitionLensCorrelations(),
  ];
};
