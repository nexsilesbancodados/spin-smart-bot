import {
  WHEEL,
  SLOTS,
  RED,
  BLACK,
  VOISINS,
  TIERS,
  ORPHELINS,
  COLUMN_1,
  COLUMN_2,
  COLUMN_3,
  DOZEN_1,
  DOZEN_2,
  DOZEN_3,
  terminalOf,
  sectorOf,
  colorOf,
  wheelIndex,
  physicalNeighbors,
} from "./wheel";
import { analyzeGroup, type SectorAnalysis, type Verdict } from "./stats";

export interface PatternGroup extends SectorAnalysis {
  members: number[];
}

const toGroup = (name: string, members: Set<number>, spins: number[]): PatternGroup => {
  const analysis = analyzeGroup(name, members, spins);
  return { ...analysis, members: Array.from(members).sort((a, b) => a - b) };
};

export const groupsBasic = (spins: number[]): Record<string, PatternGroup[]> => ({
  setores: [
    toGroup("Voisins du Zéro", VOISINS, spins),
    toGroup("Tiers du Cylindre", TIERS, spins),
    toGroup("Orphelins", ORPHELINS, spins),
  ],
  duzias: [
    toGroup("1ª Dúzia (1–12)", DOZEN_1, spins),
    toGroup("2ª Dúzia (13–24)", DOZEN_2, spins),
    toGroup("3ª Dúzia (25–36)", DOZEN_3, spins),
  ],
  colunas: [
    toGroup("Coluna 1", COLUMN_1, spins),
    toGroup("Coluna 2", COLUMN_2, spins),
    toGroup("Coluna 3", COLUMN_3, spins),
  ],
  cores: [
    toGroup("Vermelho", RED, spins),
    toGroup("Preto", BLACK, spins),
    toGroup("Zero", new Set([0]), spins),
  ],
  paridade: [
    toGroup("Par (sem 0)", new Set(rangeFilter((n) => n !== 0 && n % 2 === 0)), spins),
    toGroup("Ímpar", new Set(rangeFilter((n) => n % 2 === 1)), spins),
  ],
  altoBaixo: [
    toGroup("Baixo (1–18)", new Set(rangeFilter((n) => n >= 1 && n <= 18)), spins),
    toGroup("Alto (19–36)", new Set(rangeFilter((n) => n >= 19 && n <= 36)), spins),
  ],
});

const rangeFilter = (pred: (n: number) => boolean): number[] => {
  const out: number[] = [];
  for (let n = 0; n < SLOTS; n++) if (pred(n)) out.push(n);
  return out;
};

export const terminalsBasic = (spins: number[]): PatternGroup[] => {
  return Array.from({ length: 10 }, (_, t) =>
    toGroup(`Terminal ${t}`, new Set(rangeFilter((n) => n % 10 === t)), spins)
  );
};

export const terminalsAltoBaixo = (spins: number[], threshold = 5): PatternGroup[] => {
  const low: number[] = [];
  const high: number[] = [];
  for (let n = 0; n < SLOTS; n++) {
    if (terminalOf(n) < threshold) low.push(n);
    else high.push(n);
  }
  return [
    toGroup(`Terminais baixos (0–${threshold - 1})`, new Set(low), spins),
    toGroup(`Terminais altos (${threshold}–9)`, new Set(high), spins),
  ];
};

export const terminalsCamuflados = (spins: number[]): PatternGroup[] => {
  const pairs: Array<[number, number]> = [
    [0, 9],
    [1, 8],
    [2, 7],
    [3, 6],
    [4, 5],
  ];
  return pairs.map(([a, b]) => {
    const members = rangeFilter((n) => terminalOf(n) === a || terminalOf(n) === b);
    return toGroup(`T${a}+T${b} (soma 9)`, new Set(members), spins);
  });
};

export const terminalsWithNeighbors = (spins: number[], neighborsPerSide = 1): PatternGroup[] => {
  return Array.from({ length: 10 }, (_, t) => {
    const base = rangeFilter((n) => n % 10 === t);
    const all = new Set<number>(base);
    for (const n of base) for (const neigh of physicalNeighbors(n, neighborsPerSide)) all.add(neigh);
    return toGroup(`T${t} + ${neighborsPerSide}V`, all, spins);
  });
};

export const duziasAB = (spins: number[]): PatternGroup[] => {
  const ab = [
    { name: "D1+D2 vs D3", a: new Set([...DOZEN_1, ...DOZEN_2]), b: DOZEN_3 },
    { name: "D1+D3 vs D2", a: new Set([...DOZEN_1, ...DOZEN_3]), b: DOZEN_2 },
    { name: "D2+D3 vs D1", a: new Set([...DOZEN_2, ...DOZEN_3]), b: DOZEN_1 },
  ];
  const out: PatternGroup[] = [];
  for (const g of ab) {
    out.push(toGroup(`${g.name} → A`, g.a, spins));
    out.push(toGroup(`${g.name} → B`, g.b, spins));
  }
  return out;
};

export const neighborsCentered = (spins: number[], center: number, neighbors = 2): PatternGroup => {
  const set = new Set<number>([center, ...physicalNeighbors(center, neighbors)]);
  return toGroup(`Vizinhos de ${center} (±${neighbors})`, set, spins);
};

export const arc = (spins: number[], fromN: number, toN: number, name: string): PatternGroup => {
  const i = wheelIndex(fromN);
  const j = wheelIndex(toN);
  if (i < 0 || j < 0) return toGroup(name, new Set(), spins);
  const cw: number[] = [];
  let k = i;
  while (true) {
    cw.push(WHEEL[k]);
    if (k === j) break;
    k = (k + 1) % WHEEL.length;
  }
  const ccw: number[] = [];
  k = i;
  while (true) {
    ccw.push(WHEEL[k]);
    if (k === j) break;
    k = (k - 1 + WHEEL.length) % WHEEL.length;
  }
  const shorter = cw.length <= ccw.length ? cw : ccw;
  return toGroup(name, new Set(shorter), spins);
};

export const ladoRace = (spins: number[]): PatternGroup[] => {
  const i0 = wheelIndex(0);
  const half = (WHEEL.length - 1) / 2;
  const right: number[] = [];
  const left: number[] = [];
  for (let k = 1; k <= half; k++) {
    right.push(WHEEL[(i0 + k) % WHEEL.length]);
    left.push(WHEEL[(i0 - k + WHEEL.length) % WHEEL.length]);
  }
  return [
    toGroup("Lado direito da race", new Set(right), spins),
    toGroup("Lado esquerdo da race", new Set(left), spins),
    toGroup("Zero", new Set([0]), spins),
  ];
};

export const lado0a10 = (spins: number[]): PatternGroup[] => {
  const arcA = arc(spins, 0, 10, "Arco 0 → 10 (curto)");
  const opposite = new Set<number>();
  for (let n = 0; n < SLOTS; n++) if (!arcA.members.includes(n)) opposite.add(n);
  return [arcA, toGroup("Arco oposto", opposite, spins)];
};

export const vizinhos7a27 = (spins: number[]): PatternGroup[] => {
  const a = arc(spins, 7, 27, "Arco 7 ↔ 27 (curto)");
  const rest = new Set<number>();
  for (let n = 0; n < SLOTS; n++) if (!a.members.includes(n)) rest.add(n);
  return [a, toGroup("Resto da roda", rest, spins)];
};

export interface JuntoSeparadoReport {
  windowMeasured: number;
  junto: number;
  separado: number;
  juntoPct: number;
  z: number;
  verdict: Verdict;
}

export const juntoSeparado = (spins: number[], arcRadius = 4): JuntoSeparadoReport => {
  let junto = 0;
  let separado = 0;
  for (let i = 0; i < spins.length - 1; i++) {
    const a = spins[i];
    const b = spins[i + 1];
    const ia = wheelIndex(a);
    const ib = wheelIndex(b);
    if (ia < 0 || ib < 0) continue;
    const diff = Math.min(
      (ia - ib + WHEEL.length) % WHEEL.length,
      (ib - ia + WHEEL.length) % WHEEL.length
    );
    if (diff <= arcRadius) junto += 1;
    else separado += 1;
  }
  const total = junto + separado;
  const p = (2 * arcRadius + 1) / SLOTS;
  const expected = total * p;
  const variance = expected * (1 - p);
  const z = variance > 0 ? (junto - expected) / Math.sqrt(variance) : 0;
  const verdict: Verdict = Math.abs(z) < 2 ? "aleatorio" : Math.abs(z) < 3 ? "leve" : "incomum";
  return { windowMeasured: total, junto, separado, juntoPct: total > 0 ? junto / total : 0, z, verdict };
};

export interface HotColdItem {
  n: number;
  count: number;
  gap: number;
  z: number;
  color: ReturnType<typeof colorOf>;
}

export const hotColdNumbers = (
  spins: number[],
  top = 8
): { hot: HotColdItem[]; cold: HotColdItem[]; absent: HotColdItem[] } => {
  const counts = new Array<number>(SLOTS).fill(0);
  const firstSeen = new Array<number>(SLOTS).fill(-1);
  for (let i = 0; i < spins.length; i++) {
    const n = spins[i];
    if (n < 0 || n >= SLOTS) continue;
    counts[n] += 1;
    if (firstSeen[n] === -1) firstSeen[n] = i;
  }
  const expected = spins.length / SLOTS;
  const p = 1 / SLOTS;
  const sd = Math.sqrt(Math.max(1e-9, spins.length * p * (1 - p)));
  const items: HotColdItem[] = Array.from({ length: SLOTS }, (_, n) => ({
    n,
    count: counts[n],
    gap: firstSeen[n] === -1 ? spins.length : firstSeen[n],
    z: sd > 0 ? (counts[n] - expected) / sd : 0,
    color: colorOf(n),
  }));
  const hot = items.slice().sort((a, b) => b.count - a.count).slice(0, top);
  const cold = items.slice().sort((a, b) => b.gap - a.gap).slice(0, top);
  const absent = items.filter((it) => it.count === 0);
  return { hot, cold, absent };
};

export interface StreakSummary {
  category: string;
  currentValue: string;
  currentLength: number;
  longestValue: string;
  longestLength: number;
  longestDryValue: string;
  longestDryLength: number;
}

const labelFor = (cat: string, n: number): string => {
  switch (cat) {
    case "Número":
      return String(n);
    case "Cor":
      return colorOf(n) === "red" ? "Vermelho" : colorOf(n) === "black" ? "Preto" : "Zero";
    case "Setor":
      return sectorOf(n);
    case "Dúzia":
      return DOZEN_1.has(n) ? "D1" : DOZEN_2.has(n) ? "D2" : DOZEN_3.has(n) ? "D3" : "0";
    case "Coluna":
      return COLUMN_1.has(n) ? "C1" : COLUMN_2.has(n) ? "C2" : COLUMN_3.has(n) ? "C3" : "0";
    case "Terminal":
      return `T${terminalOf(n)}`;
    case "Paridade":
      return n === 0 ? "Zero" : n % 2 === 0 ? "Par" : "Ímpar";
    case "Alto/Baixo":
      return n === 0 ? "Zero" : n <= 18 ? "Baixo" : "Alto";
    default:
      return String(n);
  }
};

export const computeStreaks = (spins: number[]): StreakSummary[] => {
  const cats = ["Número", "Cor", "Setor", "Dúzia", "Coluna", "Terminal", "Paridade", "Alto/Baixo"];
  const out: StreakSummary[] = [];
  const newestFirst = spins;
  for (const cat of cats) {
    const labels = newestFirst.map((n) => labelFor(cat, n));
    let currentLen = 0;
    let currentVal = "";
    if (labels.length > 0) {
      currentVal = labels[0];
      currentLen = 1;
      for (let i = 1; i < labels.length; i++) {
        if (labels[i] === currentVal) currentLen += 1;
        else break;
      }
    }
    const counts = new Map<string, number>();
    let prev = "";
    let run = 0;
    let longestVal = "";
    let longestLen = 0;
    for (const lab of labels.slice().reverse()) {
      if (lab === prev) run += 1;
      else {
        prev = lab;
        run = 1;
      }
      if (run > longestLen) {
        longestLen = run;
        longestVal = lab;
      }
      counts.set(lab, (counts.get(lab) ?? 0) + 1);
    }
    const lastSeenIdx = new Map<string, number>();
    for (let i = 0; i < labels.length; i++) {
      if (!lastSeenIdx.has(labels[i])) lastSeenIdx.set(labels[i], i);
    }
    let longestDryVal = "";
    let longestDryLen = 0;
    for (const [lab, idx] of lastSeenIdx) {
      if (idx > longestDryLen) {
        longestDryLen = idx;
        longestDryVal = lab;
      }
    }
    out.push({
      category: cat,
      currentValue: currentVal,
      currentLength: currentLen,
      longestValue: longestVal,
      longestLength: longestLen,
      longestDryValue: longestDryVal,
      longestDryLength: longestDryLen,
    });
  }
  return out;
};
