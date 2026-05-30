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
  physicalNeighbors,
  numbersWithTerminal,
} from "./wheel";

export type PredictionTargetKind =
  | "number"
  | "dozen"
  | "column"
  | "color"
  | "parity"
  | "highlow"
  | "sector"
  | "terminal"
  | "neighbors";

export interface PatternActivation {
  numbers: Set<number>;
  payout: number;
  baseline: number;
  targetLabel: string;
  targetType: PredictionTargetKind;
  strength: number;
}

export interface PatternRule {
  id: string;
  group: string;
  description: string;
  activate: (history: number[]) => PatternActivation | null;
}

const SLOTS = 37;
const dozenIndex = (n: number) => (n === 0 ? -1 : Math.floor((n - 1) / 12));
const colIndex = (n: number) => (n === 0 ? -1 : (n - 1) % 3);
const terminalOf = (n: number) => n % 10;

const setOf = (nums: number[]): Set<number> => new Set(nums);

const dozenMembers = [DOZEN_1, DOZEN_2, DOZEN_3];
const dozenLabels = ["1ª Dúzia", "2ª Dúzia", "3ª Dúzia"];
const colMembers = [COLUMN_1, COLUMN_2, COLUMN_3];
const colLabels = ["1ª Coluna", "2ª Coluna", "3ª Coluna"];
const sectorMembers = [VOISINS, TIERS, ORPHELINS];
const sectorLabels = ["Voisins", "Tiers", "Orphelins"];

const generateTerminalReturn = (): PatternRule[] => {
  const out: PatternRule[] = [];
  for (let t = 0; t <= 9; t++) {
    for (const lookback of [2, 4, 7, 12]) {
      out.push({
        id: `term-return-${t}-l${lookback}`,
        group: "terminal-return",
        description: `Terminal ${t} visto nos últimos ${lookback} giros → próximo termina em ${t}`,
        activate(history) {
          if (history.length < lookback) return null;
          const slice = history.slice(0, lookback);
          let count = 0;
          for (const n of slice) if (terminalOf(n) === t) count++;
          if (count === 0) return null;
          const numbers = setOf(numbersWithTerminal(t));
          const strength = Math.min(1, count / (lookback / 4));
          return {
            numbers,
            payout: 35 / numbers.size,
            baseline: numbers.size / SLOTS,
            targetLabel: `Terminal ${t}`,
            targetType: "terminal",
            strength,
          };
        },
      });
    }
  }
  return out;
};

const generateTerminalAbsent = (): PatternRule[] => {
  const out: PatternRule[] = [];
  for (let t = 0; t <= 9; t++) {
    for (const lookback of [8, 15, 25]) {
      out.push({
        id: `term-absent-${t}-l${lookback}`,
        group: "terminal-overdue",
        description: `Terminal ${t} ausente em ${lookback} giros → atrasado`,
        activate(history) {
          if (history.length < lookback) return null;
          const slice = history.slice(0, lookback);
          const present = slice.some((n) => terminalOf(n) === t);
          if (present) return null;
          const numbers = setOf(numbersWithTerminal(t));
          return {
            numbers,
            payout: 35 / numbers.size,
            baseline: numbers.size / SLOTS,
            targetLabel: `Terminal ${t} atrasado`,
            targetType: "terminal",
            strength: Math.min(1, lookback / 25),
          };
        },
      });
    }
  }
  return out;
};

const generateDozenChain = (): PatternRule[] => {
  const out: PatternRule[] = [];
  for (let d = 0; d < 3; d++) {
    for (const repeat of [2, 3, 4]) {
      out.push({
        id: `dozen-rep-${d}-r${repeat}`,
        group: "dozen-repeat",
        description: `Dúzia ${d + 1} saiu ${repeat}× seguidas → continua`,
        activate(history) {
          if (history.length < repeat) return null;
          for (let i = 0; i < repeat; i++) {
            if (dozenIndex(history[i]) !== d) return null;
          }
          return {
            numbers: dozenMembers[d],
            payout: 2,
            baseline: 12 / SLOTS,
            targetLabel: dozenLabels[d],
            targetType: "dozen",
            strength: Math.min(1, repeat / 4),
          };
        },
      });
    }
  }
  for (let a = 0; a < 3; a++) {
    for (let b = 0; b < 3; b++) {
      if (a === b) continue;
      for (const targetD of [0, 1, 2]) {
        out.push({
          id: `dozen-cycle-${a}-${b}-pred${targetD}`,
          group: "dozen-cycle",
          description: `D${a + 1}→D${b + 1} (prev) → próxima D${targetD + 1}`,
          activate(history) {
            if (history.length < 2) return null;
            if (dozenIndex(history[1]) !== a || dozenIndex(history[0]) !== b) return null;
            return {
              numbers: dozenMembers[targetD],
              payout: 2,
              baseline: 12 / SLOTS,
              targetLabel: dozenLabels[targetD],
              targetType: "dozen",
              strength: 0.6,
            };
          },
        });
      }
    }
  }
  for (let d = 0; d < 3; d++) {
    for (const gap of [10, 18, 30]) {
      out.push({
        id: `dozen-overdue-${d}-g${gap}`,
        group: "dozen-overdue",
        description: `Dúzia ${d + 1} ausente em ${gap} giros → volta`,
        activate(history) {
          if (history.length < gap) return null;
          const slice = history.slice(0, gap);
          const present = slice.some((n) => dozenIndex(n) === d);
          if (present) return null;
          return {
            numbers: dozenMembers[d],
            payout: 2,
            baseline: 12 / SLOTS,
            targetLabel: `${dozenLabels[d]} (atrasada)`,
            targetType: "dozen",
            strength: Math.min(1, gap / 30),
          };
        },
      });
    }
  }
  return out;
};

const generateColumnChain = (): PatternRule[] => {
  const out: PatternRule[] = [];
  for (let c = 0; c < 3; c++) {
    for (const repeat of [2, 3, 4]) {
      out.push({
        id: `col-rep-${c}-r${repeat}`,
        group: "column-repeat",
        description: `Coluna ${c + 1} saiu ${repeat}× seguidas`,
        activate(history) {
          if (history.length < repeat) return null;
          for (let i = 0; i < repeat; i++) {
            if (colIndex(history[i]) !== c) return null;
          }
          return {
            numbers: colMembers[c],
            payout: 2,
            baseline: 12 / SLOTS,
            targetLabel: colLabels[c],
            targetType: "column",
            strength: Math.min(1, repeat / 4),
          };
        },
      });
    }
  }
  for (let a = 0; a < 3; a++) {
    for (let b = 0; b < 3; b++) {
      if (a === b) continue;
      for (const targetC of [0, 1, 2]) {
        out.push({
          id: `col-cycle-${a}-${b}-pred${targetC}`,
          group: "column-cycle",
          description: `C${a + 1}→C${b + 1} → próxima C${targetC + 1}`,
          activate(history) {
            if (history.length < 2) return null;
            if (colIndex(history[1]) !== a || colIndex(history[0]) !== b) return null;
            return {
              numbers: colMembers[targetC],
              payout: 2,
              baseline: 12 / SLOTS,
              targetLabel: colLabels[targetC],
              targetType: "column",
              strength: 0.6,
            };
          },
        });
      }
    }
  }
  for (let c = 0; c < 3; c++) {
    for (const gap of [10, 18, 30]) {
      out.push({
        id: `col-overdue-${c}-g${gap}`,
        group: "column-overdue",
        description: `Coluna ${c + 1} ausente em ${gap} giros`,
        activate(history) {
          if (history.length < gap) return null;
          const slice = history.slice(0, gap);
          const present = slice.some((n) => colIndex(n) === c);
          if (present) return null;
          return {
            numbers: colMembers[c],
            payout: 2,
            baseline: 12 / SLOTS,
            targetLabel: `${colLabels[c]} (atrasada)`,
            targetType: "column",
            strength: Math.min(1, gap / 30),
          };
        },
      });
    }
  }
  return out;
};

const generateColorPatterns = (): PatternRule[] => {
  const out: PatternRule[] = [];
  const colors: Array<{ key: "red" | "black"; set: Set<number>; label: string }> = [
    { key: "red", set: RED, label: "Vermelho" },
    { key: "black", set: BLACK, label: "Preto" },
  ];
  for (const c of colors) {
    for (const repeat of [3, 4, 5, 6, 7, 8]) {
      out.push({
        id: `color-streak-${c.key}-r${repeat}`,
        group: "color-streak",
        description: `${c.label} ${repeat}× seguido → continua`,
        activate(history) {
          if (history.length < repeat) return null;
          for (let i = 0; i < repeat; i++) {
            if (colorOf(history[i]) !== c.key) return null;
          }
          return {
            numbers: c.set,
            payout: 1,
            baseline: 18 / SLOTS,
            targetLabel: c.label,
            targetType: "color",
            strength: Math.min(1, (repeat - 2) / 5),
          };
        },
      });
      const opposite = c.key === "red" ? "black" : "red";
      const oppositeSet = c.key === "red" ? BLACK : RED;
      const oppositeLabel = c.key === "red" ? "Preto" : "Vermelho";
      out.push({
        id: `color-break-${c.key}-r${repeat}`,
        group: "color-break",
        description: `${c.label} ${repeat}× → reverte para ${oppositeLabel}`,
        activate(history) {
          if (history.length < repeat) return null;
          for (let i = 0; i < repeat; i++) {
            if (colorOf(history[i]) !== c.key) return null;
          }
          void opposite;
          return {
            numbers: oppositeSet,
            payout: 1,
            baseline: 18 / SLOTS,
            targetLabel: oppositeLabel,
            targetType: "color",
            strength: Math.min(1, (repeat - 2) / 5),
          };
        },
      });
    }
  }
  return out;
};

const generateParityPatterns = (): PatternRule[] => {
  const out: PatternRule[] = [];
  const evens = new Set<number>();
  const odds = new Set<number>();
  for (let n = 1; n <= 36; n++) (n % 2 === 0 ? evens : odds).add(n);
  const groups = [
    { key: "even", set: evens, label: "Par" },
    { key: "odd", set: odds, label: "Ímpar" },
  ];
  for (const g of groups) {
    for (const repeat of [3, 4, 5, 6, 7]) {
      out.push({
        id: `parity-streak-${g.key}-r${repeat}`,
        group: "parity-streak",
        description: `${g.label} ${repeat}× → continua`,
        activate(history) {
          if (history.length < repeat) return null;
          for (let i = 0; i < repeat; i++) {
            const n = history[i];
            if (n === 0 || !g.set.has(n)) return null;
          }
          return {
            numbers: g.set,
            payout: 1,
            baseline: 18 / SLOTS,
            targetLabel: g.label,
            targetType: "parity",
            strength: Math.min(1, (repeat - 2) / 5),
          };
        },
      });
    }
  }
  return out;
};

const generateHighLowPatterns = (): PatternRule[] => {
  const out: PatternRule[] = [];
  const high = new Set<number>();
  const low = new Set<number>();
  for (let n = 1; n <= 36; n++) (n > 18 ? high : low).add(n);
  const groups = [
    { key: "high", set: high, label: "19–36" },
    { key: "low", set: low, label: "1–18" },
  ];
  for (const g of groups) {
    for (const repeat of [3, 4, 5, 6, 7]) {
      out.push({
        id: `highlow-streak-${g.key}-r${repeat}`,
        group: "highlow-streak",
        description: `${g.label} ${repeat}× → continua`,
        activate(history) {
          if (history.length < repeat) return null;
          for (let i = 0; i < repeat; i++) {
            const n = history[i];
            if (n === 0 || !g.set.has(n)) return null;
          }
          return {
            numbers: g.set,
            payout: 1,
            baseline: 18 / SLOTS,
            targetLabel: g.label,
            targetType: "highlow",
            strength: Math.min(1, (repeat - 2) / 5),
          };
        },
      });
    }
  }
  return out;
};

const generateSectorPatterns = (): PatternRule[] => {
  const out: PatternRule[] = [];
  for (let s = 0; s < 3; s++) {
    for (const repeat of [2, 3, 4]) {
      out.push({
        id: `sector-rep-${s}-r${repeat}`,
        group: "sector-repeat",
        description: `${sectorLabels[s]} ${repeat}× → continua`,
        activate(history) {
          if (history.length < repeat) return null;
          for (let i = 0; i < repeat; i++) {
            if (sectorOf(history[i]) !== sectorLabels[s]) return null;
          }
          return {
            numbers: sectorMembers[s],
            payout: 35 / sectorMembers[s].size,
            baseline: sectorMembers[s].size / SLOTS,
            targetLabel: sectorLabels[s],
            targetType: "sector",
            strength: Math.min(1, repeat / 4),
          };
        },
      });
    }
    for (const gap of [12, 20, 30]) {
      out.push({
        id: `sector-overdue-${s}-g${gap}`,
        group: "sector-overdue",
        description: `${sectorLabels[s]} ausente ${gap} giros`,
        activate(history) {
          if (history.length < gap) return null;
          const slice = history.slice(0, gap);
          const present = slice.some((n) => sectorOf(n) === sectorLabels[s]);
          if (present) return null;
          return {
            numbers: sectorMembers[s],
            payout: 35 / sectorMembers[s].size,
            baseline: sectorMembers[s].size / SLOTS,
            targetLabel: `${sectorLabels[s]} (atrasado)`,
            targetType: "sector",
            strength: Math.min(1, gap / 30),
          };
        },
      });
    }
  }
  return out;
};

const generateNumberReturn = (): PatternRule[] => {
  const out: PatternRule[] = [];
  for (let n = 0; n <= 36; n++) {
    for (const window of [3, 6, 12]) {
      out.push({
        id: `num-return-${n}-w${window}`,
        group: "number-return",
        description: `Número ${n} saiu nos últimos ${window} giros → repete`,
        activate(history) {
          if (history.length < window) return null;
          const slice = history.slice(0, window);
          if (!slice.includes(n)) return null;
          return {
            numbers: new Set([n]),
            payout: 35,
            baseline: 1 / SLOTS,
            targetLabel: `Nº ${n}`,
            targetType: "number",
            strength: 0.4,
          };
        },
      });
    }
  }
  return out;
};

const generateNeighborsCluster = (): PatternRule[] => {
  const out: PatternRule[] = [];
  for (let n = 0; n <= 36; n++) {
    for (const radius of [2, 4]) {
      out.push({
        id: `neighbors-${n}-r${radius}`,
        group: "physical-neighbors",
        description: `Último foi ${n} → vizinhos ±${radius} na roleta`,
        activate(history) {
          if (history.length < 1 || history[0] !== n) return null;
          const neighbors = physicalNeighbors(n, radius);
          const set = new Set([n, ...neighbors]);
          return {
            numbers: set,
            payout: 35 / set.size,
            baseline: set.size / SLOTS,
            targetLabel: `Vizinhos ±${radius} do ${n}`,
            targetType: "neighbors",
            strength: 0.5,
          };
        },
      });
    }
  }
  return out;
};

const generateAlternation = (): PatternRule[] => {
  const out: PatternRule[] = [];
  for (let a = 0; a < 3; a++) {
    for (let b = 0; b < 3; b++) {
      if (a === b) continue;
      out.push({
        id: `dozen-alt-${a}-${b}`,
        group: "dozen-alternation",
        description: `Padrão alternado D${a + 1}↔D${b + 1} (3 últimos) → continua`,
        activate(history) {
          if (history.length < 3) return null;
          const idx = [dozenIndex(history[0]), dozenIndex(history[1]), dozenIndex(history[2])];
          if (idx[0] === a && idx[1] === b && idx[2] === a) {
            return {
              numbers: dozenMembers[b],
              payout: 2,
              baseline: 12 / SLOTS,
              targetLabel: dozenLabels[b],
              targetType: "dozen",
              strength: 0.7,
            };
          }
          return null;
        },
      });
    }
  }
  for (let a = 0; a < 3; a++) {
    for (let b = 0; b < 3; b++) {
      if (a === b) continue;
      out.push({
        id: `col-alt-${a}-${b}`,
        group: "column-alternation",
        description: `Padrão alternado C${a + 1}↔C${b + 1} (3 últimos) → continua`,
        activate(history) {
          if (history.length < 3) return null;
          const idx = [colIndex(history[0]), colIndex(history[1]), colIndex(history[2])];
          if (idx[0] === a && idx[1] === b && idx[2] === a) {
            return {
              numbers: colMembers[b],
              payout: 2,
              baseline: 12 / SLOTS,
              targetLabel: colLabels[b],
              targetType: "column",
              strength: 0.7,
            };
          }
          return null;
        },
      });
    }
  }
  return out;
};

const generateRowPatterns = (): PatternRule[] => {
  const out: PatternRule[] = [];
  const rows: Array<{ key: string; set: Set<number>; label: string }> = [];
  for (let r = 0; r < 12; r++) {
    const s = new Set<number>();
    s.add(r * 3 + 1);
    s.add(r * 3 + 2);
    s.add(r * 3 + 3);
    rows.push({ key: `row-${r}`, set: s, label: `Linha ${r + 1} (${r * 3 + 1}-${r * 3 + 3})` });
  }
  for (const row of rows) {
    for (const lookback of [5, 12]) {
      out.push({
        id: `row-cluster-${row.key}-l${lookback}`,
        group: "row-cluster",
        description: `2+ números da ${row.label} nos últimos ${lookback}`,
        activate(history) {
          if (history.length < lookback) return null;
          const slice = history.slice(0, lookback);
          let count = 0;
          for (const n of slice) if (row.set.has(n)) count++;
          if (count < 2) return null;
          return {
            numbers: row.set,
            payout: 11,
            baseline: 3 / SLOTS,
            targetLabel: row.label,
            targetType: "neighbors",
            strength: Math.min(1, count / 4),
          };
        },
      });
    }
  }
  return out;
};

const generateMirrorPairs = (): PatternRule[] => {
  const out: PatternRule[] = [];
  for (let n = 1; n <= 18; n++) {
    const mirror = 37 - n;
    const set = new Set([n, mirror]);
    out.push({
      id: `mirror-${n}`,
      group: "mirror-pair",
      description: `Após ${n} ou ${mirror} → repete um dos espelhos`,
      activate(history) {
        if (history.length < 1) return null;
        if (history[0] !== n && history[0] !== mirror) return null;
        return {
          numbers: set,
          payout: 35 / 2,
          baseline: 2 / SLOTS,
          targetLabel: `${n} / ${mirror}`,
          targetType: "number",
          strength: 0.4,
        };
      },
    });
  }
  return out;
};

const WHEEL_QUADRANTS: Array<{ key: string; label: string; set: Set<number> }> = [
  { key: "q1", label: "Quadrante NE roleta", set: new Set([0, 32, 15, 19, 4, 21, 2, 25, 17]) },
  { key: "q2", label: "Quadrante SE roleta", set: new Set([34, 6, 27, 13, 36, 11, 30, 8, 23]) },
  { key: "q3", label: "Quadrante SO roleta", set: new Set([10, 5, 24, 16, 33, 1, 20, 14, 31]) },
  { key: "q4", label: "Quadrante NO roleta", set: new Set([9, 22, 18, 29, 7, 28, 12, 35, 3, 26]) },
];

const TABLE_REGIONS: Array<{ key: string; label: string; set: Set<number> }> = [
  { key: "table-left", label: "Mesa esquerda (1-6,…,31-36)", set: new Set([1, 2, 3, 4, 5, 6, 13, 14, 15, 16, 17, 18, 25, 26, 27, 28, 29, 30]) },
  { key: "table-right", label: "Mesa direita (7-12,…,31-36)", set: new Set([7, 8, 9, 10, 11, 12, 19, 20, 21, 22, 23, 24, 31, 32, 33, 34, 35, 36]) },
  { key: "table-center", label: "Mesa central (linhas 5-8)", set: new Set([13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24]) },
];

const generateWheelQuadrants = (): PatternRule[] => {
  const out: PatternRule[] = [];
  for (const q of WHEEL_QUADRANTS) {
    for (const repeat of [2, 3, 4]) {
      out.push({
        id: `wheel-quad-rep-${q.key}-r${repeat}`,
        group: "wheel-region-repeat",
        description: `${q.label} ${repeat}× → continua na região`,
        activate(history) {
          if (history.length < repeat) return null;
          for (let i = 0; i < repeat; i++) if (!q.set.has(history[i])) return null;
          return {
            numbers: q.set,
            payout: 35 / q.set.size,
            baseline: q.set.size / SLOTS,
            targetLabel: q.label,
            targetType: "neighbors",
            strength: Math.min(1, repeat / 4),
          };
        },
      });
    }
    for (const gap of [10, 20, 30]) {
      out.push({
        id: `wheel-quad-overdue-${q.key}-g${gap}`,
        group: "wheel-region-overdue",
        description: `${q.label} ausente ${gap} giros → volta`,
        activate(history) {
          if (history.length < gap) return null;
          const slice = history.slice(0, gap);
          if (slice.some((n) => q.set.has(n))) return null;
          return {
            numbers: q.set,
            payout: 35 / q.set.size,
            baseline: q.set.size / SLOTS,
            targetLabel: `${q.label} (atrasada)`,
            targetType: "neighbors",
            strength: Math.min(1, gap / 30),
          };
        },
      });
    }
  }
  return out;
};

const generateTableRegions = (): PatternRule[] => {
  const out: PatternRule[] = [];
  for (const r of TABLE_REGIONS) {
    for (const lookback of [4, 8, 14]) {
      out.push({
        id: `table-region-cluster-${r.key}-l${lookback}`,
        group: "table-region-cluster",
        description: `≥3 números da ${r.label} nos últimos ${lookback}`,
        activate(history) {
          if (history.length < lookback) return null;
          const slice = history.slice(0, lookback);
          let count = 0;
          for (const n of slice) if (r.set.has(n)) count++;
          if (count < 3) return null;
          return {
            numbers: r.set,
            payout: 35 / r.set.size,
            baseline: r.set.size / SLOTS,
            targetLabel: r.label,
            targetType: "neighbors",
            strength: Math.min(1, count / 6),
          };
        },
      });
    }
  }
  return out;
};

const generateTerminalAttraction = (): PatternRule[] => {
  const out: PatternRule[] = [];
  for (let a = 0; a <= 9; a++) {
    for (let b = 0; b <= 9; b++) {
      if (a === b) continue;
      out.push({
        id: `term-attract-${a}-then-${b}`,
        group: "terminal-attraction",
        description: `Após terminal ${a} → terminal ${b}`,
        activate(history) {
          if (history.length < 1) return null;
          if (terminalOf(history[0]) !== a) return null;
          const numbers = setOf(numbersWithTerminal(b));
          return {
            numbers,
            payout: 35 / numbers.size,
            baseline: numbers.size / SLOTS,
            targetLabel: `Terminal ${b} (após ${a})`,
            targetType: "terminal",
            strength: 0.5,
          };
        },
      });
    }
  }
  return out;
};

const generateNumberPull = (): PatternRule[] => {
  const out: PatternRule[] = [];
  for (let a = 1; a <= 36; a++) {
    for (const window of [5, 10]) {
      const targets = [a - 1, a + 1, a + 17, a + 18].filter((n) => n >= 0 && n <= 36 && n !== a);
      const set = new Set(targets);
      if (set.size === 0) continue;
      out.push({
        id: `num-pull-${a}-w${window}`,
        group: "number-pull",
        description: `Após ${a} → puxa adjacentes/espelhos em ${window} giros`,
        activate(history) {
          if (history.length < 1) return null;
          if (history[0] !== a) return null;
          return {
            numbers: set,
            payout: 35 / set.size,
            baseline: set.size / SLOTS,
            targetLabel: `Próximos de ${a}`,
            targetType: "neighbors",
            strength: 0.45,
          };
        },
      });
    }
  }
  return out;
};

const generateAlternationLong = (): PatternRule[] => {
  const out: PatternRule[] = [];
  for (const lens of ["dozen", "column"] as const) {
    const members = lens === "dozen" ? dozenMembers : colMembers;
    const labels = lens === "dozen" ? dozenLabels : colLabels;
    const idxFn = lens === "dozen" ? dozenIndex : colIndex;
    for (let a = 0; a < 3; a++) {
      for (let b = 0; b < 3; b++) {
        if (a === b) continue;
        out.push({
          id: `${lens}-alt5-${a}-${b}`,
          group: `${lens}-alternation-long`,
          description: `Alternância ${lens === "dozen" ? "D" : "C"}${a + 1}↔${lens === "dozen" ? "D" : "C"}${b + 1} (5 últimos) → continua`,
          activate(history) {
            if (history.length < 5) return null;
            const seq = [idxFn(history[0]), idxFn(history[1]), idxFn(history[2]), idxFn(history[3]), idxFn(history[4])];
            if (seq[0] === a && seq[1] === b && seq[2] === a && seq[3] === b && seq[4] === a) {
              return {
                numbers: members[b],
                payout: 2,
                baseline: 12 / SLOTS,
                targetLabel: labels[b],
                targetType: lens,
                strength: 0.85,
              };
            }
            return null;
          },
        });
      }
    }
  }
  for (const color of ["red", "black"] as const) {
    const opposite = color === "red" ? "black" : "red";
    const oppositeSet = color === "red" ? BLACK : RED;
    const oppositeLabel = color === "red" ? "Preto" : "Vermelho";
    out.push({
      id: `color-alt4-${color}`,
      group: "color-alternation-long",
      description: `Alternância R↔B (4 últimos começando em ${color}) → ${oppositeLabel}`,
      activate(history) {
        if (history.length < 4) return null;
        const seq = [colorOf(history[0]), colorOf(history[1]), colorOf(history[2]), colorOf(history[3])];
        const expected = color === "red" ? ["red", "black", "red", "black"] : ["black", "red", "black", "red"];
        for (let i = 0; i < 4; i++) if (seq[i] !== expected[i]) return null;
        return {
          numbers: oppositeSet,
          payout: 1,
          baseline: 18 / SLOTS,
          targetLabel: oppositeLabel,
          targetType: "color",
          strength: 0.8,
        };
      },
    });
  }
  return out;
};

const generateDozenZigzag = (): PatternRule[] => {
  const out: PatternRule[] = [];
  for (const pattern of [
    [0, 1, 2],
    [0, 2, 1],
    [1, 0, 2],
    [1, 2, 0],
    [2, 0, 1],
    [2, 1, 0],
  ]) {
    for (let next = 0; next < 3; next++) {
      out.push({
        id: `dozen-zigzag-${pattern.join("")}-pred${next}`,
        group: "dozen-zigzag",
        description: `Zigzag D${pattern[0] + 1}→D${pattern[1] + 1}→D${pattern[2] + 1} → D${next + 1}`,
        activate(history) {
          if (history.length < 3) return null;
          if (dozenIndex(history[2]) !== pattern[0]) return null;
          if (dozenIndex(history[1]) !== pattern[1]) return null;
          if (dozenIndex(history[0]) !== pattern[2]) return null;
          return {
            numbers: dozenMembers[next],
            payout: 2,
            baseline: 12 / SLOTS,
            targetLabel: dozenLabels[next],
            targetType: "dozen",
            strength: 0.55,
          };
        },
      });
    }
  }
  return out;
};

const generateSplits = (): PatternRule[] => {
  const out: PatternRule[] = [];
  const splits: Array<{ a: number; b: number }> = [];
  for (let row = 0; row < 12; row++) {
    const base = row * 3 + 1;
    splits.push({ a: base, b: base + 1 });
    splits.push({ a: base + 1, b: base + 2 });
  }
  for (let n = 1; n <= 33; n++) splits.push({ a: n, b: n + 3 });
  splits.push({ a: 0, b: 1 });
  splits.push({ a: 0, b: 2 });
  splits.push({ a: 0, b: 3 });
  for (const s of splits) {
    out.push({
      id: `split-${s.a}-${s.b}`,
      group: "split-after-anchor",
      description: `Após ${s.a} ou ${s.b} → split ${s.a}/${s.b}`,
      activate(history) {
        if (history.length < 1) return null;
        const head = history[0];
        if (head !== s.a && head !== s.b) return null;
        const set = new Set([s.a, s.b]);
        return {
          numbers: set,
          payout: 17,
          baseline: 2 / SLOTS,
          targetLabel: `Cavalo ${s.a}/${s.b}`,
          targetType: "number",
          strength: 0.4,
        };
      },
    });
  }
  return out;
};

const generateCorners = (): PatternRule[] => {
  const out: PatternRule[] = [];
  for (let row = 0; row < 11; row++) {
    for (let col = 0; col < 2; col++) {
      const tl = row * 3 + col + 1;
      const tr = tl + 1;
      const bl = tl + 3;
      const br = tr + 3;
      const set = new Set([tl, tr, bl, br]);
      out.push({
        id: `corner-${tl}`,
        group: "corner-after-anchor",
        description: `Após ${tl} ou vizinho na quina → quina ${tl}/${tr}/${bl}/${br}`,
        activate(history) {
          if (history.length < 1) return null;
          if (!set.has(history[0])) return null;
          return {
            numbers: set,
            payout: 8,
            baseline: 4 / SLOTS,
            targetLabel: `Quina ${tl}-${br}`,
            targetType: "number",
            strength: 0.45,
          };
        },
      });
    }
  }
  return out;
};

const generateStreets = (): PatternRule[] => {
  const out: PatternRule[] = [];
  for (let row = 0; row < 12; row++) {
    const set = new Set([row * 3 + 1, row * 3 + 2, row * 3 + 3]);
    for (const lookback of [4, 10]) {
      out.push({
        id: `street-${row}-l${lookback}`,
        group: "street-cluster",
        description: `≥2 da rua ${row * 3 + 1}-${row * 3 + 3} em ${lookback} giros`,
        activate(history) {
          if (history.length < lookback) return null;
          const slice = history.slice(0, lookback);
          let count = 0;
          for (const n of slice) if (set.has(n)) count++;
          if (count < 2) return null;
          return {
            numbers: set,
            payout: 11,
            baseline: 3 / SLOTS,
            targetLabel: `Rua ${row * 3 + 1}-${row * 3 + 3}`,
            targetType: "number",
            strength: Math.min(1, count / 4),
          };
        },
      });
    }
  }
  return out;
};

const generateSixains = (): PatternRule[] => {
  const out: PatternRule[] = [];
  for (let row = 0; row < 11; row++) {
    const start = row * 3 + 1;
    const set = new Set([start, start + 1, start + 2, start + 3, start + 4, start + 5]);
    for (const lookback of [6, 14]) {
      out.push({
        id: `sixain-${row}-l${lookback}`,
        group: "sixain-cluster",
        description: `≥3 do sixain ${start}-${start + 5} em ${lookback} giros`,
        activate(history) {
          if (history.length < lookback) return null;
          const slice = history.slice(0, lookback);
          let count = 0;
          for (const n of slice) if (set.has(n)) count++;
          if (count < 3) return null;
          return {
            numbers: set,
            payout: 5,
            baseline: 6 / SLOTS,
            targetLabel: `Sixain ${start}-${start + 5}`,
            targetType: "number",
            strength: Math.min(1, count / 6),
          };
        },
      });
    }
  }
  return out;
};

const generateTrios = (): PatternRule[] => {
  const out: PatternRule[] = [];
  const trios: Array<{ key: string; set: Set<number>; label: string }> = [
    { key: "0-1-2", set: new Set([0, 1, 2]), label: "Trio 0/1/2" },
    { key: "0-2-3", set: new Set([0, 2, 3]), label: "Trio 0/2/3" },
    { key: "0-1-2-3", set: new Set([0, 1, 2, 3]), label: "Primeiros 4" },
  ];
  for (const t of trios) {
    out.push({
      id: `trio-${t.key}`,
      group: "trio-low-after-anchor",
      description: `Após número ≤3 → ${t.label}`,
      activate(history) {
        if (history.length < 1) return null;
        if (history[0] > 3) return null;
        return {
          numbers: t.set,
          payout: t.set.size === 4 ? 8 : 11,
          baseline: t.set.size / SLOTS,
          targetLabel: t.label,
          targetType: "number",
          strength: 0.5,
        };
      },
    });
  }
  return out;
};

const generateColorRegionCombo = (): PatternRule[] => {
  const out: PatternRule[] = [];
  const colorSets = [
    { key: "red", set: RED, label: "Vermelho" },
    { key: "black", set: BLACK, label: "Preto" },
  ];
  for (const c of colorSets) {
    for (const d of [0, 1, 2]) {
      const combo = new Set<number>();
      for (const n of dozenMembers[d]) if (c.set.has(n)) combo.add(n);
      if (combo.size === 0) continue;
      for (const repeat of [2, 3]) {
        out.push({
          id: `color-dozen-${c.key}-d${d}-r${repeat}`,
          group: "color-dozen-combo",
          description: `${c.label}+D${d + 1} ${repeat}× → continua`,
          activate(history) {
            if (history.length < repeat) return null;
            for (let i = 0; i < repeat; i++) if (!combo.has(history[i])) return null;
            return {
              numbers: combo,
              payout: 35 / combo.size,
              baseline: combo.size / SLOTS,
              targetLabel: `${c.label} + D${d + 1}`,
              targetType: "neighbors",
              strength: Math.min(1, repeat / 3),
            };
          },
        });
      }
    }
  }
  return out;
};

let CACHED_BANK: PatternRule[] | null = null;

export const getPatternBank = (): PatternRule[] => {
  if (CACHED_BANK) return CACHED_BANK;
  CACHED_BANK = [
    ...generateTerminalReturn(),
    ...generateTerminalAbsent(),
    ...generateTerminalAttraction(),
    ...generateDozenChain(),
    ...generateDozenZigzag(),
    ...generateColumnChain(),
    ...generateColorPatterns(),
    ...generateParityPatterns(),
    ...generateHighLowPatterns(),
    ...generateSectorPatterns(),
    ...generateNumberReturn(),
    ...generateNumberPull(),
    ...generateNeighborsCluster(),
    ...generateAlternation(),
    ...generateAlternationLong(),
    ...generateRowPatterns(),
    ...generateMirrorPairs(),
    ...generateWheelQuadrants(),
    ...generateTableRegions(),
    ...generateColorRegionCombo(),
    ...generateSplits(),
    ...generateCorners(),
    ...generateStreets(),
    ...generateSixains(),
    ...generateTrios(),
  ];
  return CACHED_BANK;
};

export const patternBankSize = (): number => getPatternBank().length;
