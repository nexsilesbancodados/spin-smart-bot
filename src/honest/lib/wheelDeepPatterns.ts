import { WHEEL, wheelIndex, physicalNeighbors } from "./wheel";
import type { PatternRule } from "./patternBank";

const SLOTS = 37;

const wheelDistance = (a: number, b: number): number => {
  const i = wheelIndex(a);
  const j = wheelIndex(b);
  if (i < 0 || j < 0) return -1;
  return Math.min(Math.abs(i - j), WHEEL.length - Math.abs(i - j));
};

interface WheelArc {
  key: string;
  label: string;
  set: Set<number>;
  centerIdx: number;
}

const buildWheelArcs = (sliceSize: number): WheelArc[] => {
  const arcs: WheelArc[] = [];
  const sliceCount = Math.floor(WHEEL.length / sliceSize);
  for (let i = 0; i < sliceCount; i++) {
    const start = i * sliceSize;
    const nums = new Set<number>();
    for (let j = 0; j < sliceSize; j++) {
      nums.add(WHEEL[(start + j) % WHEEL.length]);
    }
    const centerIdx = (start + Math.floor(sliceSize / 2)) % WHEEL.length;
    const centerNum = WHEEL[centerIdx];
    arcs.push({
      key: `arc${sliceSize}-${i}`,
      label: `Arco roleta perto do ${centerNum}`,
      set: nums,
      centerIdx,
    });
  }
  return arcs;
};

const MICRO_ARCS = buildWheelArcs(5);
const MINI_ARCS = buildWheelArcs(7);

const microArcContinuation = (): PatternRule[] => {
  const out: PatternRule[] = [];
  for (const arc of MICRO_ARCS) {
    for (const lookback of [3, 6, 10]) {
      for (const minHits of [2, 3]) {
        if (minHits > lookback) continue;
        out.push({
          id: `micro-cont-${arc.key}-l${lookback}-m${minHits}`,
          group: "wheel-micro-arc-continuation",
          description: `≥${minHits} dos últimos ${lookback} no ${arc.label} → continua`,
          activate(history) {
            if (history.length < lookback) return null;
            const slice = history.slice(0, lookback);
            let count = 0;
            for (const n of slice) if (arc.set.has(n)) count++;
            if (count < minHits) return null;
            return {
              numbers: arc.set,
              payout: 35 / arc.set.size,
              baseline: arc.set.size / SLOTS,
              targetLabel: arc.label,
              targetType: "neighbors",
              strength: Math.min(1, count / minHits / 1.5),
            };
          },
        });
      }
    }
  }
  return out;
};

const miniArcContinuation = (): PatternRule[] => {
  const out: PatternRule[] = [];
  for (const arc of MINI_ARCS) {
    for (const lookback of [4, 8, 14]) {
      const minHits = Math.max(2, Math.floor(lookback / 4));
      out.push({
        id: `mini-cont-${arc.key}-l${lookback}`,
        group: "wheel-mini-arc-continuation",
        description: `≥${minHits} dos últimos ${lookback} no ${arc.label} → continua`,
        activate(history) {
          if (history.length < lookback) return null;
          const slice = history.slice(0, lookback);
          let count = 0;
          for (const n of slice) if (arc.set.has(n)) count++;
          if (count < minHits) return null;
          return {
            numbers: arc.set,
            payout: 35 / arc.set.size,
            baseline: arc.set.size / SLOTS,
            targetLabel: arc.label,
            targetType: "neighbors",
            strength: Math.min(1, count / 5 + 0.3),
          };
        },
      });
    }
  }
  return out;
};

const arcBouncePatterns = (): PatternRule[] => {
  const out: PatternRule[] = [];
  for (const a of MICRO_ARCS) {
    for (const b of MICRO_ARCS) {
      if (a === b) continue;
      const distance = Math.min(
        Math.abs(a.centerIdx - b.centerIdx),
        WHEEL.length - Math.abs(a.centerIdx - b.centerIdx)
      );
      if (distance < 8) continue;
      out.push({
        id: `bounce4-${a.key}-${b.key}`,
        group: "wheel-bounce-oscillation",
        description: `Oscilação ${a.label} ↔ ${b.label} (4 últimos) → volta para ${a.label}`,
        activate(history) {
          if (history.length < 4) return null;
          if (!b.set.has(history[0])) return null;
          if (!a.set.has(history[1])) return null;
          if (!b.set.has(history[2])) return null;
          if (!a.set.has(history[3])) return null;
          return {
            numbers: a.set,
            payout: 35 / a.set.size,
            baseline: a.set.size / SLOTS,
            targetLabel: a.label,
            targetType: "neighbors",
            strength: 0.7,
          };
        },
      });
      out.push({
        id: `bounce3-${a.key}-${b.key}`,
        group: "wheel-bounce-short",
        description: `${a.label}→${b.label}→${a.label} (3 últimos) → volta para ${b.label}`,
        activate(history) {
          if (history.length < 3) return null;
          if (!a.set.has(history[0])) return null;
          if (!b.set.has(history[1])) return null;
          if (!a.set.has(history[2])) return null;
          return {
            numbers: b.set,
            payout: 35 / b.set.size,
            baseline: b.set.size / SLOTS,
            targetLabel: b.label,
            targetType: "neighbors",
            strength: 0.55,
          };
        },
      });
    }
  }
  return out;
};

const anchorOscillation = (): PatternRule[] => {
  const out: PatternRule[] = [];
  for (let a = 0; a <= 36; a++) {
    for (let b = 0; b <= 36; b++) {
      if (a === b) continue;
      const dist = wheelDistance(a, b);
      if (dist < 10) continue;
      const aNeighbors = new Set([a, ...physicalNeighbors(a, 2)]);
      const bNeighbors = new Set([b, ...physicalNeighbors(b, 2)]);
      out.push({
        id: `anchor-osc-${a}-${b}`,
        group: "wheel-anchor-oscillation",
        description: `Oscilação anchor ${a}↔${b}: bate em ${a}, longe em ${b}, próximo ${a} → próximo ${b}`,
        activate(history) {
          if (history.length < 3) return null;
          if (!bNeighbors.has(history[0])) return null;
          if (!aNeighbors.has(history[1])) return null;
          if (!bNeighbors.has(history[2])) return null;
          return {
            numbers: aNeighbors,
            payout: 35 / aNeighbors.size,
            baseline: aNeighbors.size / SLOTS,
            targetLabel: `Vizinhos do ${a}`,
            targetType: "neighbors",
            strength: 0.65,
          };
        },
      });
    }
  }
  return out;
};

const verticalThreeClusters = (): PatternRule[] => {
  const out: PatternRule[] = [];
  for (let col = 1; col <= 3; col++) {
    for (let startRow = 0; startRow <= 9; startRow++) {
      const a = col + startRow * 3;
      const b = col + (startRow + 1) * 3;
      const c = col + (startRow + 2) * 3;
      if (c > 36) continue;
      const set = new Set([a, b, c]);
      out.push({
        id: `cavalo3-${a}-${b}-${c}-anchor`,
        group: "vertical-cluster-3-anchor",
        description: `Cavalo vertical ${a}-${b}-${c}: último foi um deles → próximo no cluster`,
        activate(history) {
          if (history.length < 1) return null;
          if (!set.has(history[0])) return null;
          return {
            numbers: set,
            payout: 11,
            baseline: 3 / SLOTS,
            targetLabel: `Vertical ${a}-${b}-${c}`,
            targetType: "neighbors",
            strength: 0.5,
          };
        },
      });
      for (const lookback of [6, 12]) {
        out.push({
          id: `cavalo3-${a}-${b}-${c}-cluster-l${lookback}`,
          group: "vertical-cluster-3-cluster",
          description: `≥2 do cavalo vertical ${a}-${b}-${c} em ${lookback} giros → continua cluster`,
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
              targetLabel: `Vertical ${a}-${b}-${c}`,
              targetType: "neighbors",
              strength: Math.min(1, count / 3 + 0.35),
            };
          },
        });
      }
    }
  }
  return out;
};

const sectorLockPatterns = (): PatternRule[] => {
  const out: PatternRule[] = [];
  for (const arc of MINI_ARCS) {
    for (const consec of [2, 3, 4]) {
      out.push({
        id: `sector-lock-${arc.key}-c${consec}`,
        group: "wheel-sector-lock",
        description: `${consec}× consecutivos no ${arc.label} → trava de setor, continua`,
        activate(history) {
          if (history.length < consec) return null;
          for (let i = 0; i < consec; i++) if (!arc.set.has(history[i])) return null;
          return {
            numbers: arc.set,
            payout: 35 / arc.set.size,
            baseline: arc.set.size / SLOTS,
            targetLabel: `${arc.label} (trava de setor)`,
            targetType: "neighbors",
            strength: Math.min(1, consec / 4 + 0.4),
          };
        },
      });
    }
  }
  return out;
};

const alternationReturnPatterns = (): PatternRule[] => {
  const out: PatternRule[] = [];
  for (let a = 0; a <= 36; a++) {
    for (const radius of [2, 3]) {
      const aNeighbors = new Set([a, ...physicalNeighbors(a, radius)]);
      out.push({
        id: `alt-return-${a}-r${radius}`,
        group: "wheel-alternation-return",
        description: `Saiu ${a}, depois algo longe, depois algo perto de ${a} → volta perto de ${a}`,
        activate(history) {
          if (history.length < 3) return null;
          if (history[2] !== a) return null;
          const dist1 = wheelDistance(a, history[1]);
          if (dist1 < 7) return null;
          if (!aNeighbors.has(history[0])) return null;
          return {
            numbers: aNeighbors,
            payout: 35 / aNeighbors.size,
            baseline: aNeighbors.size / SLOTS,
            targetLabel: `Vizinhos do ${a} ±${radius}`,
            targetType: "neighbors",
            strength: 0.55,
          };
        },
      });
    }
  }
  return out;
};

export const buildWheelDeepPatterns = (): PatternRule[] => {
  return [
    ...microArcContinuation(),
    ...miniArcContinuation(),
    ...arcBouncePatterns(),
    ...anchorOscillation(),
    ...verticalThreeClusters(),
    ...sectorLockPatterns(),
    ...alternationReturnPatterns(),
  ];
};
