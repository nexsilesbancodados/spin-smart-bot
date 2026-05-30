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
  wheelIndex,
  WHEEL,
} from "./wheel";
import type { PatternRule, PatternActivation } from "./patternBank";

const SLOTS = 37;
const dozenIndex = (n: number) => (n === 0 ? -1 : Math.floor((n - 1) / 12));
const colIndex = (n: number) => (n === 0 ? -1 : (n - 1) % 3);

const colorCode = (n: number): "R" | "B" | "G" =>
  n === 0 ? "G" : colorOf(n) === "red" ? "R" : "B";
const parityCode = (n: number): "P" | "I" | "Z" =>
  n === 0 ? "Z" : n % 2 === 0 ? "P" : "I";
const highlowCode = (n: number): "H" | "L" | "Z" =>
  n === 0 ? "Z" : n > 18 ? "H" : "L";
const sectorCode = (n: number): "V" | "T" | "O" => {
  const s = sectorOf(n);
  return s === "Voisins" ? "V" : s === "Tiers" ? "T" : "O";
};

const dozenSets = [DOZEN_1, DOZEN_2, DOZEN_3];
const dozenLabels = ["1ª Dúzia", "2ª Dúzia", "3ª Dúzia"];
const colSets = [COLUMN_1, COLUMN_2, COLUMN_3];
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

const longColorNgram = (n: 5 | 6 | 7): PatternRule[] => {
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
      const nextSet = next === "R" ? RED : BLACK;
      const nextLabel = next === "R" ? "Vermelho" : "Preto";
      out.push({
        id: `longcolor-${n}-${combo}-${next}`,
        group: `color-${n}gram-long`,
        description: `${n}-gram longo de cor [${seq.join("→")}] → ${nextLabel}`,
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
            strength: Math.min(1, 0.6 + (n - 4) * 0.12),
          };
        },
      });
    }
  }
  return out;
};

const longParityNgram = (n: 4 | 5 | 6): PatternRule[] => {
  const out: PatternRule[] = [];
  const evens = new Set<number>();
  const odds = new Set<number>();
  for (let i = 1; i <= 36; i++) (i % 2 === 0 ? evens : odds).add(i);
  const total = Math.pow(2, n);
  for (let combo = 0; combo < total; combo++) {
    const seq: ("P" | "I")[] = [];
    let c = combo;
    for (let i = 0; i < n; i++) {
      seq.push(c % 2 === 0 ? "P" : "I");
      c = Math.floor(c / 2);
    }
    for (const next of ["P", "I"] as const) {
      const nextSet = next === "P" ? evens : odds;
      const nextLabel = next === "P" ? "Par" : "Ímpar";
      out.push({
        id: `longparity-${n}-${combo}-${next}`,
        group: `parity-${n}gram-long`,
        description: `${n}-gram paridade [${seq.join("→")}] → ${nextLabel}`,
        activate(history) {
          if (history.length < n) return null;
          for (let i = 0; i < n; i++) {
            if (parityCode(history[i]) !== seq[n - 1 - i]) return null;
          }
          return {
            numbers: nextSet,
            payout: 1,
            baseline: 18 / SLOTS,
            targetLabel: nextLabel,
            targetType: "parity",
            strength: Math.min(1, 0.55 + (n - 3) * 0.12),
          };
        },
      });
    }
  }
  return out;
};

const longHighLowNgram = (n: 4 | 5): PatternRule[] => {
  const out: PatternRule[] = [];
  const high = new Set<number>();
  const low = new Set<number>();
  for (let i = 1; i <= 36; i++) (i > 18 ? high : low).add(i);
  const total = Math.pow(2, n);
  for (let combo = 0; combo < total; combo++) {
    const seq: ("H" | "L")[] = [];
    let c = combo;
    for (let i = 0; i < n; i++) {
      seq.push(c % 2 === 0 ? "H" : "L");
      c = Math.floor(c / 2);
    }
    for (const next of ["H", "L"] as const) {
      const nextSet = next === "H" ? high : low;
      const nextLabel = next === "H" ? "19-36" : "1-18";
      out.push({
        id: `longhl-${n}-${combo}-${next}`,
        group: `highlow-${n}gram-long`,
        description: `${n}-gram alto/baixo [${seq.join("→")}] → ${nextLabel}`,
        activate(history) {
          if (history.length < n) return null;
          for (let i = 0; i < n; i++) {
            if (highlowCode(history[i]) !== seq[n - 1 - i]) return null;
          }
          return {
            numbers: nextSet,
            payout: 1,
            baseline: 18 / SLOTS,
            targetLabel: nextLabel,
            targetType: "highlow",
            strength: Math.min(1, 0.55 + (n - 3) * 0.12),
          };
        },
      });
    }
  }
  return out;
};

const skipgramColorPatterns = (): PatternRule[] => {
  const out: PatternRule[] = [];
  for (const a of ["R", "B"] as const) {
    for (const b of ["R", "B"] as const) {
      for (const next of ["R", "B"] as const) {
        const nextSet = next === "R" ? RED : BLACK;
        const nextLabel = next === "R" ? "Vermelho" : "Preto";
        out.push({
          id: `skip-color-${a}-${b}-${next}`,
          group: "color-skipgram",
          description: `Skip [${a}_${b}_?] (1-skip cor) → ${nextLabel}`,
          activate(history) {
            if (history.length < 4) return null;
            if (colorCode(history[3]) !== a) return null;
            if (colorCode(history[1]) !== b) return null;
            return {
              numbers: nextSet,
              payout: 1,
              baseline: 18 / SLOTS,
              targetLabel: nextLabel,
              targetType: "color",
              strength: 0.55,
            };
          },
        });
      }
    }
  }
  return out;
};

const skipgramDozenPatterns = (): PatternRule[] => {
  const out: PatternRule[] = [];
  for (let a = 0; a < 3; a++) {
    for (let b = 0; b < 3; b++) {
      for (let next = 0; next < 3; next++) {
        out.push({
          id: `skip-dozen-${a}-${b}-${next}`,
          group: "dozen-skipgram",
          description: `Skip D${a + 1}_D${b + 1}_? → D${next + 1}`,
          activate(history) {
            if (history.length < 4) return null;
            if (dozenIndex(history[3]) !== a) return null;
            if (dozenIndex(history[1]) !== b) return null;
            return {
              numbers: dozenSets[next],
              payout: 2,
              baseline: 12 / SLOTS,
              targetLabel: dozenLabels[next],
              targetType: "dozen",
              strength: 0.5,
            };
          },
        });
      }
    }
  }
  return out;
};

const anchorRecoveryPatterns = (): PatternRule[] => {
  const out: PatternRule[] = [];
  for (let anchor = 0; anchor <= 36; anchor++) {
    const neighbors = physicalNeighbors(anchor, 3);
    const set = new Set([anchor, ...neighbors]);
    for (const recency of [1, 2, 4]) {
      out.push({
        id: `anchor-${anchor}-r${recency}`,
        group: "anchor-recovery",
        description: `Há ${recency} giros saiu ${anchor} → vizinhos ±3`,
        activate(history) {
          if (history.length <= recency) return null;
          if (history[recency] !== anchor) return null;
          return {
            numbers: set,
            payout: 35 / set.size,
            baseline: set.size / SLOTS,
            targetLabel: `Vizinhos ±3 do ${anchor}`,
            targetType: "neighbors",
            strength: 0.45 - recency * 0.05,
          };
        },
      });
    }
  }
  return out;
};

const pyramidColorPatterns = (): PatternRule[] => {
  const out: PatternRule[] = [];
  for (const color of ["R", "B"] as const) {
    const set = color === "R" ? RED : BLACK;
    const label = color === "R" ? "Vermelho" : "Preto";
    for (const k of [4, 5, 6, 7, 8]) {
      for (const window of [k + 1, k + 3]) {
        out.push({
          id: `pyr-color-${color}-${k}of${window}`,
          group: "color-pyramid",
          description: `${k} de ${window} foram ${label} → continua`,
          activate(history) {
            if (history.length < window) return null;
            const slice = history.slice(0, window);
            let count = 0;
            for (const n of slice) if (set.has(n)) count++;
            if (count < k) return null;
            return {
              numbers: set,
              payout: 1,
              baseline: 18 / SLOTS,
              targetLabel: label,
              targetType: "color",
              strength: Math.min(1, (count - k + 1) / 3 + 0.5),
            };
          },
        });
      }
    }
  }
  return out;
};

const pyramidDozenPatterns = (): PatternRule[] => {
  const out: PatternRule[] = [];
  for (let d = 0; d < 3; d++) {
    for (const k of [3, 4, 5, 6]) {
      for (const window of [k + 1, k + 3]) {
        out.push({
          id: `pyr-dozen-${d}-${k}of${window}`,
          group: "dozen-pyramid",
          description: `${k} de ${window} foram D${d + 1} → continua`,
          activate(history) {
            if (history.length < window) return null;
            const slice = history.slice(0, window);
            let count = 0;
            for (const n of slice) if (dozenSets[d].has(n)) count++;
            if (count < k) return null;
            return {
              numbers: dozenSets[d],
              payout: 2,
              baseline: 12 / SLOTS,
              targetLabel: dozenLabels[d],
              targetType: "dozen",
              strength: Math.min(1, (count - k + 1) / 3 + 0.45),
            };
          },
        });
      }
    }
  }
  return out;
};

const pyramidColumnPatterns = (): PatternRule[] => {
  const out: PatternRule[] = [];
  for (let c = 0; c < 3; c++) {
    for (const k of [3, 4, 5, 6]) {
      for (const window of [k + 1, k + 3]) {
        out.push({
          id: `pyr-col-${c}-${k}of${window}`,
          group: "column-pyramid",
          description: `${k} de ${window} foram C${c + 1} → continua`,
          activate(history) {
            if (history.length < window) return null;
            const slice = history.slice(0, window);
            let count = 0;
            for (const n of slice) if (colSets[c].has(n)) count++;
            if (count < k) return null;
            return {
              numbers: colSets[c],
              payout: 2,
              baseline: 12 / SLOTS,
              targetLabel: colLabels[c],
              targetType: "column",
              strength: Math.min(1, (count - k + 1) / 3 + 0.45),
            };
          },
        });
      }
    }
  }
  return out;
};

const pyramidSectorPatterns = (): PatternRule[] => {
  const out: PatternRule[] = [];
  for (const sc of ["V", "T", "O"] as const) {
    const set = sectorSets[sc];
    for (const k of [3, 4, 5]) {
      for (const window of [k + 1, k + 3]) {
        out.push({
          id: `pyr-sec-${sc}-${k}of${window}`,
          group: "sector-pyramid",
          description: `${k} de ${window} foram ${sectorLabels[sc]} → continua`,
          activate(history) {
            if (history.length < window) return null;
            const slice = history.slice(0, window);
            let count = 0;
            for (const n of slice) if (set.has(n)) count++;
            if (count < k) return null;
            return {
              numbers: set,
              payout: 35 / set.size,
              baseline: set.size / SLOTS,
              targetLabel: sectorLabels[sc],
              targetType: "sector",
              strength: Math.min(1, (count - k + 1) / 3 + 0.45),
            };
          },
        });
      }
    }
  }
  return out;
};

const streakBreakPatterns = (): PatternRule[] => {
  const out: PatternRule[] = [];
  for (const color of ["R", "B"] as const) {
    const opposite = color === "R" ? "B" : "R";
    const oppositeSet = color === "R" ? BLACK : RED;
    const oppositeLabel = color === "R" ? "Preto" : "Vermelho";
    for (const streakLen of [3, 4, 5, 6, 7]) {
      out.push({
        id: `streakbreak-color-${color}-${streakLen}`,
        group: "color-streak-broken",
        description: `${streakLen}× ${color === "R" ? "Vermelho" : "Preto"} quebrou → ${oppositeLabel} continua`,
        activate(history) {
          if (history.length < streakLen + 1) return null;
          if (colorCode(history[0]) !== opposite) return null;
          for (let i = 1; i <= streakLen; i++) {
            if (colorCode(history[i]) !== color) return null;
          }
          return {
            numbers: oppositeSet,
            payout: 1,
            baseline: 18 / SLOTS,
            targetLabel: oppositeLabel,
            targetType: "color",
            strength: Math.min(1, (streakLen - 2) / 5 + 0.5),
          };
        },
      });
    }
  }
  for (let d = 0; d < 3; d++) {
    for (const streakLen of [3, 4, 5]) {
      const next = (d + 1) % 3;
      out.push({
        id: `streakbreak-dozen-${d}-${streakLen}-next${next}`,
        group: "dozen-streak-broken",
        description: `D${d + 1} ${streakLen}× quebrou → D${next + 1} próxima`,
        activate(history) {
          if (history.length < streakLen + 1) return null;
          if (dozenIndex(history[0]) === d) return null;
          if (dozenIndex(history[0]) !== next) return null;
          for (let i = 1; i <= streakLen; i++) {
            if (dozenIndex(history[i]) !== d) return null;
          }
          return {
            numbers: dozenSets[next],
            payout: 2,
            baseline: 12 / SLOTS,
            targetLabel: dozenLabels[next],
            targetType: "dozen",
            strength: 0.5,
          };
        },
      });
    }
  }
  return out;
};

const wheelDistanceSeriesPatterns = (): PatternRule[] => {
  const out: PatternRule[] = [];
  const distanceOf = (a: number, b: number): number => {
    const i = wheelIndex(a);
    const j = wheelIndex(b);
    if (i < 0 || j < 0) return -1;
    return Math.min(Math.abs(i - j), WHEEL.length - Math.abs(i - j));
  };
  for (const range of [
    { key: "close", lo: 0, hi: 4, label: "perto na roleta" },
    { key: "medium", lo: 5, hi: 9, label: "distância média" },
    { key: "far", lo: 10, hi: 18, label: "longe na roleta" },
  ]) {
    for (const consec of [2, 3, 4]) {
      out.push({
        id: `wheeldist-${range.key}-c${consec}`,
        group: "wheel-distance-series",
        description: `${consec}× distâncias ${range.label} → continua perto/longe`,
        activate(history) {
          if (history.length < consec + 1) return null;
          for (let i = 0; i < consec; i++) {
            const d = distanceOf(history[i], history[i + 1]);
            if (d < range.lo || d > range.hi) return null;
          }
          const head = history[0];
          const neighbors = physicalNeighbors(
            head,
            range.key === "close" ? 4 : range.key === "medium" ? 6 : 9
          );
          const set = new Set([head, ...neighbors]);
          return {
            numbers: set,
            payout: 35 / set.size,
            baseline: set.size / SLOTS,
            targetLabel: `Vizinhos do ${head} (${range.label})`,
            targetType: "neighbors",
            strength: Math.min(1, consec / 4 + 0.25),
          };
        },
      });
    }
  }
  return out;
};

const conditionalPatterns = (): PatternRule[] => {
  const out: PatternRule[] = [];
  const all = new Set<number>();
  for (let i = 0; i <= 36; i++) all.add(i);
  for (let d = 0; d < 3; d++) {
    for (const color of ["R", "B"] as const) {
      const colorSet = color === "R" ? RED : BLACK;
      const intersection = new Set<number>();
      for (const n of dozenSets[d]) if (colorSet.has(n)) intersection.add(n);
      for (const lookback of [3, 6]) {
        out.push({
          id: `cond-dcd-${d}-${color}-l${lookback}`,
          group: "conditional-dozen-color",
          description: `D${d + 1} ≥${Math.ceil(lookback / 2)} vezes E último foi ${color === "R" ? "vermelho" : "preto"} → interseção`,
          activate(history) {
            if (history.length < lookback) return null;
            if (!colorSet.has(history[0])) return null;
            const slice = history.slice(0, lookback);
            let cnt = 0;
            for (const n of slice) if (dozenSets[d].has(n)) cnt++;
            if (cnt < Math.ceil(lookback / 2)) return null;
            return {
              numbers: intersection,
              payout: 35 / intersection.size,
              baseline: intersection.size / SLOTS,
              targetLabel: `${color === "R" ? "Vermelho" : "Preto"} ∩ D${d + 1}`,
              targetType: "neighbors",
              strength: 0.55,
            };
          },
        });
      }
    }
  }
  return out;
};

const sectorTransitionPatterns = (): PatternRule[] => {
  const out: PatternRule[] = [];
  const codes: Array<"V" | "T" | "O"> = ["V", "T", "O"];
  for (const fromCode of codes) {
    for (const toCode of codes) {
      for (const next of codes) {
        out.push({
          id: `secsec-${fromCode}-${toCode}-${next}`,
          group: "sector-transition-chain",
          description: `${sectorLabels[fromCode]}→${sectorLabels[toCode]} → ${sectorLabels[next]}`,
          activate(history) {
            if (history.length < 2) return null;
            if (sectorCode(history[1]) !== fromCode) return null;
            if (sectorCode(history[0]) !== toCode) return null;
            const set = sectorSets[next];
            return {
              numbers: set,
              payout: 35 / set.size,
              baseline: set.size / SLOTS,
              targetLabel: sectorLabels[next],
              targetType: "sector",
              strength: 0.6,
            };
          },
        });
      }
    }
  }
  return out;
};

export const buildDeepPatterns = (): PatternRule[] => {
  return [
    ...longColorNgram(5),
    ...longColorNgram(6),
    ...longParityNgram(4),
    ...longParityNgram(5),
    ...longHighLowNgram(4),
    ...longHighLowNgram(5),
    ...skipgramColorPatterns(),
    ...skipgramDozenPatterns(),
    ...anchorRecoveryPatterns(),
    ...pyramidColorPatterns(),
    ...pyramidDozenPatterns(),
    ...pyramidColumnPatterns(),
    ...pyramidSectorPatterns(),
    ...streakBreakPatterns(),
    ...wheelDistanceSeriesPatterns(),
    ...conditionalPatterns(),
    ...sectorTransitionPatterns(),
  ];
};
