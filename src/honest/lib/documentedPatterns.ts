import {
  numbersWithTerminal,
  JEU_ZERO,
  physicalNeighbors,
  wheelIndex,
  WHEEL,
} from "./wheel";
import type { PatternRule } from "./patternBank";

const SLOTS = 37;
const terminalOf = (n: number) => n % 10;

const setOf = (nums: number[]): Set<number> => new Set(nums);

// --- ANDRUCCI: top-K most frequent in last W spins ---
const andrucciHotPatterns = (): PatternRule[] => {
  const out: PatternRule[] = [];
  for (const window of [30, 50]) {
    for (const topK of [3, 5, 8]) {
      out.push({
        id: `andrucci-w${window}-k${topK}`,
        group: "andrucci-hot-numbers",
        description: `Andrucci: top-${topK} mais quentes dos últimos ${window} giros (continua quente)`,
        activate(history) {
          if (history.length < window) return null;
          const slice = history.slice(0, window);
          const counts = new Array(37).fill(0);
          for (const n of slice) counts[n]++;
          const sorted = counts
            .map((c, i) => ({ n: i, c }))
            .sort((a, b) => b.c - a.c);
          const minCount = Math.ceil((window / 37) * 1.4);
          const hot = sorted.slice(0, topK).filter((x) => x.c >= minCount);
          if (hot.length < topK) return null;
          const numbers = new Set(hot.map((x) => x.n));
          return {
            numbers,
            payout: 35 / topK,
            baseline: topK / 37,
            targetLabel: `Top-${topK} hot: ${[...numbers].join(",")}`,
            targetType: "neighbors",
            strength: 0.5,
          };
        },
      });
    }
  }
  return out;
};

// --- SLEEPERS: number absent for K+ spins, "due" to come (gambler's fallacy mas é documentado) ---
const sleeperPatterns = (): PatternRule[] => {
  const out: PatternRule[] = [];
  for (let n = 0; n <= 36; n++) {
    for (const threshold of [30, 50, 80]) {
      out.push({
        id: `sleeper-${n}-t${threshold}`,
        group: "sleeper-overdue",
        description: `Número ${n} ausente em ${threshold}+ giros (sleeper) → predito retornar`,
        activate(history) {
          if (history.length < threshold) return null;
          const slice = history.slice(0, threshold);
          if (slice.includes(n)) return null;
          return {
            numbers: new Set([n]),
            payout: 35,
            baseline: 1 / SLOTS,
            targetLabel: `Sleeper ${n}`,
            targetType: "number",
            strength: Math.min(1, threshold / 80),
          };
        },
      });
    }
  }
  return out;
};

// --- ACTION NUMBERS: numbers > 1.5× expected freq in last 100 spins ---
const actionNumberPatterns = (): PatternRule[] => {
  const out: PatternRule[] = [];
  for (const window of [50, 100, 200]) {
    out.push({
      id: `action-numbers-w${window}`,
      group: "action-numbers",
      description: `Números com frequência ≥1.5× esperada em ${window} giros (Action numbers)`,
      activate(history) {
        if (history.length < window) return null;
        const slice = history.slice(0, window);
        const counts = new Array(37).fill(0);
        for (const n of slice) counts[n]++;
        const expected = window / 37;
        const action = counts
          .map((c, i) => ({ n: i, c }))
          .filter((x) => x.c >= expected * 1.5);
        if (action.length === 0 || action.length > 10) return null;
        const numbers = new Set(action.map((x) => x.n));
        return {
          numbers,
          payout: 35 / numbers.size,
          baseline: numbers.size / SLOTS,
          targetLabel: `Action #${numbers.size}: ${[...numbers].slice(0, 6).join(",")}${numbers.size > 6 ? "…" : ""}`,
          targetType: "neighbors",
          strength: Math.min(1, action.length / 5 + 0.3),
        };
      },
    });
  }
  return out;
};

// --- JEU ZERO: 7 numbers around zero (12-35-3-26-0-32-15) ---
const jeuZeroPatterns = (): PatternRule[] => {
  const out: PatternRule[] = [];
  for (const repeat of [2, 3]) {
    out.push({
      id: `jeuzero-rep-${repeat}`,
      group: "jeuzero-repeat",
      description: `Jeu Zero ${repeat}× seguido (12,35,3,26,0,32,15) → continua`,
      activate(history) {
        if (history.length < repeat) return null;
        for (let i = 0; i < repeat; i++) if (!JEU_ZERO.has(history[i])) return null;
        return {
          numbers: JEU_ZERO,
          payout: 35 / JEU_ZERO.size,
          baseline: JEU_ZERO.size / SLOTS,
          targetLabel: "Jeu Zero (7 nº)",
          targetType: "sector",
          strength: Math.min(1, repeat / 3),
        };
      },
    });
  }
  for (const lookback of [8, 14, 20]) {
    out.push({
      id: `jeuzero-cluster-l${lookback}`,
      group: "jeuzero-cluster",
      description: `≥3 do Jeu Zero em ${lookback} giros → continua`,
      activate(history) {
        if (history.length < lookback) return null;
        const slice = history.slice(0, lookback);
        let count = 0;
        for (const n of slice) if (JEU_ZERO.has(n)) count++;
        if (count < 3) return null;
        return {
          numbers: JEU_ZERO,
          payout: 35 / JEU_ZERO.size,
          baseline: JEU_ZERO.size / SLOTS,
          targetLabel: "Jeu Zero (7 nº)",
          targetType: "sector",
          strength: Math.min(1, count / 5 + 0.3),
        };
      },
    });
  }
  for (const gap of [15, 30]) {
    out.push({
      id: `jeuzero-overdue-g${gap}`,
      group: "jeuzero-overdue",
      description: `Jeu Zero ausente ${gap} giros → atrasado`,
      activate(history) {
        if (history.length < gap) return null;
        const slice = history.slice(0, gap);
        if (slice.some((n) => JEU_ZERO.has(n))) return null;
        return {
          numbers: JEU_ZERO,
          payout: 35 / JEU_ZERO.size,
          baseline: JEU_ZERO.size / SLOTS,
          targetLabel: "Jeu Zero (atrasado)",
          targetType: "sector",
          strength: Math.min(1, gap / 30),
        };
      },
    });
  }
  return out;
};

// --- FINALES À CHEVAL: pairs of digit-groups (final 0+3, 1+4, 2+5, etc.) ---
const finalesChevalPatterns = (): PatternRule[] => {
  const out: PatternRule[] = [];
  const pairs: Array<[number, number]> = [
    [0, 3],
    [1, 4],
    [2, 5],
    [3, 6],
    [4, 7],
    [5, 8],
    [6, 9],
  ];
  for (const [a, b] of pairs) {
    const set = new Set([...numbersWithTerminal(a), ...numbersWithTerminal(b)]);
    for (const lookback of [6, 12, 20]) {
      out.push({
        id: `finales-cheval-${a}-${b}-l${lookback}`,
        group: "finales-cheval",
        description: `Finales à cheval ${a}/${b}: ≥3 desses terminais em ${lookback} giros → continua`,
        activate(history) {
          if (history.length < lookback) return null;
          const slice = history.slice(0, lookback);
          let count = 0;
          for (const n of slice) if (set.has(n)) count++;
          if (count < 3) return null;
          return {
            numbers: set,
            payout: 35 / set.size,
            baseline: set.size / SLOTS,
            targetLabel: `Finais ${a}/${b}`,
            targetType: "terminal",
            strength: Math.min(1, count / 6 + 0.3),
          };
        },
      });
    }
  }
  return out;
};

// --- DEALER SIGNATURE: consistent wheel distance N times in a row ---
const dealerSignaturePatterns = (): PatternRule[] => {
  const distOf = (a: number, b: number): number => {
    const i = wheelIndex(a);
    const j = wheelIndex(b);
    if (i < 0 || j < 0) return -1;
    return Math.min(Math.abs(i - j), WHEEL.length - Math.abs(i - j));
  };
  const out: PatternRule[] = [];
  for (const consec of [3, 4, 5]) {
    for (const tolerance of [1, 2]) {
      out.push({
        id: `dealer-sig-c${consec}-t${tolerance}`,
        group: "dealer-signature",
        description: `Assinatura do crupiê: ${consec}× distâncias consistentes (±${tolerance}) → próximo na mesma distância`,
        activate(history) {
          if (history.length < consec + 1) return null;
          const distances: number[] = [];
          for (let i = 0; i < consec; i++) {
            const d = distOf(history[i], history[i + 1]);
            if (d < 0) return null;
            distances.push(d);
          }
          const avg = distances.reduce((a, b) => a + b, 0) / distances.length;
          for (const d of distances) {
            if (Math.abs(d - avg) > tolerance) return null;
          }
          const expectedDist = Math.round(avg);
          const head = history[0];
          const headIdx = wheelIndex(head);
          if (headIdx < 0) return null;
          const candidates = new Set<number>();
          for (const delta of [-1, 0, 1]) {
            const targetIdx1 = (headIdx + expectedDist + delta + WHEEL.length) % WHEEL.length;
            const targetIdx2 = (headIdx - expectedDist + delta + WHEEL.length) % WHEEL.length;
            candidates.add(WHEEL[targetIdx1]);
            candidates.add(WHEEL[targetIdx2]);
          }
          return {
            numbers: candidates,
            payout: 35 / candidates.size,
            baseline: candidates.size / SLOTS,
            targetLabel: `Assinatura crupiê dist≈${expectedDist}`,
            targetType: "neighbors",
            strength: Math.min(1, consec / 5 + 0.3),
          };
        },
      });
    }
  }
  return out;
};

// --- PIVOT (Mihail/Pivot strategy): first repeating number in last K, bet it stays hot ---
const pivotPatterns = (): PatternRule[] => {
  const out: PatternRule[] = [];
  for (const window of [10, 20]) {
    out.push({
      id: `pivot-w${window}`,
      group: "pivot-strategy",
      description: `Pivot: primeiro número que repetiu nos últimos ${window} giros (continua)`,
      activate(history) {
        if (history.length < window) return null;
        const slice = history.slice(0, window);
        const seen = new Set<number>();
        let pivotNumber: number | null = null;
        for (const n of slice) {
          if (seen.has(n)) {
            pivotNumber = n;
            break;
          }
          seen.add(n);
        }
        if (pivotNumber === null) return null;
        const neighbors = new Set([pivotNumber, ...physicalNeighbors(pivotNumber, 2)]);
        return {
          numbers: neighbors,
          payout: 35 / neighbors.size,
          baseline: neighbors.size / SLOTS,
          targetLabel: `Pivot ${pivotNumber} +vizinhos`,
          targetType: "neighbors",
          strength: 0.5,
        };
      },
    });
  }
  return out;
};

// --- LAST NUMBER REPEAT (one of the most common patterns observed): bet last number ---
const lastNumberRepeatPatterns = (): PatternRule[] => {
  const out: PatternRule[] = [];
  for (const radius of [0, 1, 2]) {
    out.push({
      id: `last-repeat-r${radius}`,
      group: "last-number-repeat",
      description: `Último número repete${radius > 0 ? ` ou cai dentro de ±${radius}` : ""}`,
      activate(history) {
        if (history.length < 1) return null;
        const head = history[0];
        const target =
          radius === 0
            ? new Set([head])
            : new Set([head, ...physicalNeighbors(head, radius)]);
        return {
          numbers: target,
          payout: 35 / target.size,
          baseline: target.size / SLOTS,
          targetLabel: radius === 0 ? `Repete ${head}` : `${head} ±${radius}`,
          targetType: "neighbors",
          strength: 0.4,
        };
      },
    });
  }
  return out;
};

// --- TWIN NUMBERS: number + its "twin" in the table layout (n and n+18, classic mirror) ---
const twinNumberPatterns = (): PatternRule[] => {
  const out: PatternRule[] = [];
  for (let n = 1; n <= 18; n++) {
    const twin = n + 18;
    const set = new Set([n, twin]);
    out.push({
      id: `twin-${n}-${twin}`,
      group: "twin-numbers",
      description: `Twin ${n}/${twin}: após um dos gêmeos → outro do par`,
      activate(history) {
        if (history.length < 1) return null;
        if (!set.has(history[0])) return null;
        return {
          numbers: set,
          payout: 17,
          baseline: 2 / SLOTS,
          targetLabel: `${n}↔${twin}`,
          targetType: "number",
          strength: 0.4,
        };
      },
    });
  }
  return out;
};

// --- BIASED WHEEL DETECTION: chi-square > threshold over 200 spins, bet top 5 hot ---
const biasedWheelPatterns = (): PatternRule[] => {
  const out: PatternRule[] = [];
  out.push({
    id: `biased-wheel-200`,
    group: "biased-wheel-suspected",
    description: `Suspeita de viés de mesa: top-5 mais frequentes em 200 giros com z>2`,
    activate(history) {
      if (history.length < 200) return null;
      const slice = history.slice(0, 200);
      const counts = new Array(37).fill(0);
      for (const n of slice) counts[n]++;
      const expected = slice.length / 37;
      const sigma = Math.sqrt(slice.length * (1 / 37) * (36 / 37));
      const sorted = counts
        .map((c, i) => ({ n: i, c, z: (c - expected) / sigma }))
        .sort((a, b) => b.z - a.z);
      const candidates = sorted.filter((x) => x.z > 2).slice(0, 5);
      if (candidates.length < 3) return null;
      const numbers = new Set(candidates.map((x) => x.n));
      return {
        numbers,
        payout: 35 / numbers.size,
        baseline: numbers.size / SLOTS,
        targetLabel: `Viés? ${[...numbers].join(",")} (z>2)`,
        targetType: "neighbors",
        strength: Math.min(1, candidates.length / 5 + 0.4),
      };
    },
  });
  return out;
};

export const buildDocumentedPatterns = (): PatternRule[] => {
  return [
    ...andrucciHotPatterns(),
    ...sleeperPatterns(),
    ...actionNumberPatterns(),
    ...jeuZeroPatterns(),
    ...finalesChevalPatterns(),
    ...dealerSignaturePatterns(),
    ...pivotPatterns(),
    ...lastNumberRepeatPatterns(),
    ...twinNumberPatterns(),
    ...biasedWheelPatterns(),
  ];
};

void setOf;
void terminalOf;
