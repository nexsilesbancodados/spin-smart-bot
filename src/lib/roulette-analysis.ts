import { type RouletteNumber, getNumberColor } from './roulette';

// ===== WHEEL ORDER (European Roulette) =====
export const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];

// ===== TERMINAIS (last digit grouping) =====
export const TERMINAIS: Record<number, number[]> = {
  0: [0, 10, 20, 30],
  1: [1, 11, 21, 31],
  2: [2, 12, 22, 32],
  3: [3, 13, 23, 33],
  4: [4, 14, 24, 34],
  5: [5, 15, 25, 35],
  6: [6, 16, 26, 36],
  7: [7, 17, 27],
  8: [8, 18, 28],
  9: [9, 19, 29],
};

// ===== TERMINAIS COM VIZINHOS 1V =====
export const getTerminaisVizinhos1V = (terminal: number): number[] => {
  const base = TERMINAIS[terminal];
  const expanded = new Set<number>();
  base.forEach(n => {
    const idx = WHEEL_ORDER.indexOf(n);
    if (idx !== -1) {
      expanded.add(WHEEL_ORDER[(idx - 1 + WHEEL_ORDER.length) % WHEEL_ORDER.length]);
      expanded.add(n);
      expanded.add(WHEEL_ORDER[(idx + 1) % WHEEL_ORDER.length]);
    }
  });
  return Array.from(expanded).sort((a, b) => a - b);
};

// ===== TERMINAIS COM VIZINHOS 2V =====
export const getTerminaisVizinhos2V = (terminal: number): number[] => {
  const base = TERMINAIS[terminal];
  const expanded = new Set<number>();
  base.forEach(n => {
    const idx = WHEEL_ORDER.indexOf(n);
    if (idx !== -1) {
      for (let d = -2; d <= 2; d++) {
        expanded.add(WHEEL_ORDER[(idx + d + WHEEL_ORDER.length) % WHEEL_ORDER.length]);
      }
    }
  });
  return Array.from(expanded).sort((a, b) => a - b);
};

// ===== TERMINAIS CAMUFLADOS =====
// Groups numbers by sum of digits
export const TERMINAIS_CAMUFLADOS: Record<number, number[]> = {};
for (let i = 0; i <= 36; i++) {
  const sum = i < 10 ? i : Math.floor(i / 10) + (i % 10);
  if (!TERMINAIS_CAMUFLADOS[sum]) TERMINAIS_CAMUFLADOS[sum] = [];
  TERMINAIS_CAMUFLADOS[sum].push(i);
}

// ===== COLUNAS =====
export const COLUNAS: Record<string, number[]> = {
  C1: [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
  C2: [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
  C3: [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
};

// ===== DÚZIAS =====
export const DUZIAS: Record<string, number[]> = {
  D1: Array.from({ length: 12 }, (_, i) => i + 1),
  D2: Array.from({ length: 12 }, (_, i) => i + 13),
  D3: Array.from({ length: 12 }, (_, i) => i + 25),
};

// ===== DÚZIAS AB =====
export const DUZIAS_AB: Record<string, number[]> = {
  DA: [...DUZIAS.D1, ...DUZIAS.D2], // 1-24
  DB: [...DUZIAS.D2, ...DUZIAS.D3], // 13-36
};

// ===== TERM. ALTO/BAIXO =====
export const TERM_ALTO_BAIXO: Record<string, number[]> = {
  TA: [5, 6, 7, 8, 9].flatMap(t => TERMINAIS[t]),    // Terminais altos (5-9)
  TB: [0, 1, 2, 3, 4].flatMap(t => TERMINAIS[t]),     // Terminais baixos (0-4)
};

// ===== SETORES DA ROLETA (wheel sectors) =====
export const SETORES: Record<string, number[]> = {
  TIER: [27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33],        // Tier du Cylindre
  ORPHELINS: [1, 20, 14, 31, 9, 17, 34, 6],                      // Orphelins
  VOISINS: [22, 18, 29, 7, 28, 12, 35, 3, 26, 0, 32, 15, 19, 4, 21, 2, 25], // Voisins du Zero
};

// ===== VIZINHOS 7/27 =====
const getWheelNeighbors = (center: number, range: number): number[] => {
  const idx = WHEEL_ORDER.indexOf(center);
  const result: number[] = [];
  for (let d = -range; d <= range; d++) {
    result.push(WHEEL_ORDER[(idx + d + WHEEL_ORDER.length) % WHEEL_ORDER.length]);
  }
  return result;
};

export const VIZINHOS: Record<string, number[]> = {
  VIZSETE: getWheelNeighbors(7, 9),
  VIZVINTESETE: getWheelNeighbors(27, 9),
};

// ===== JUNTO/SEPARADO =====
// "Junto" = consecutive numbers on the wheel, "Separado" = non-consecutive
export const isJunto = (n1: number, n2: number): boolean => {
  const idx1 = WHEEL_ORDER.indexOf(n1);
  const idx2 = WHEEL_ORDER.indexOf(n2);
  const dist = Math.abs(idx1 - idx2);
  return dist <= 6 || dist >= WHEEL_ORDER.length - 6;
};

// ===== LADO RACE =====
// PB = Preto Baixo, PA = Preto Alto, VB = Vermelho Baixo, VA = Vermelho Alto
export const LADO_RACE: Record<string, number[]> = {
  PB: [2, 4, 6, 8, 10, 11, 13, 15, 17].filter(n => getNumberColor(n) === 'black' && n <= 18),
  PA: [20, 22, 24, 26, 28, 29, 31, 33, 35].filter(n => getNumberColor(n) === 'black'),
  VB: [1, 3, 5, 7, 9, 12, 14, 16, 18].filter(n => getNumberColor(n) === 'red' && n <= 18),
  VA: [19, 21, 23, 25, 27, 30, 32, 34, 36].filter(n => getNumberColor(n) === 'red'),
};

// ===== LADO 0/10 =====
export const LADO_ZERO_DEZ: Record<string, number[]> = {
  LADOZERO: getWheelNeighbors(0, 9),
  LADODEZ: getWheelNeighbors(10, 9),
};

// ===== 5/2 grouping =====
export const CINCO_DOIS: Record<string, number[]> = {};
for (let i = 0; i <= 36; i++) {
  const group = i <= 5 ? 'G1' : i <= 10 ? 'G2' : i <= 15 ? 'G3' : i <= 20 ? 'G4' : i <= 25 ? 'G5' : i <= 30 ? 'G6' : 'G7';
  if (!CINCO_DOIS[group]) CINCO_DOIS[group] = [];
  CINCO_DOIS[group].push(i);
}

// ===== SETORES PERSONALIZADOS (4 sectors) =====
export const SETORES_CUSTOM: Record<string, number[]> = {
  S1: [0, 32, 15, 19, 4, 21, 2, 25, 17],
  S2: [34, 6, 27, 13, 36, 11, 30, 8, 23],
  S3: [10, 5, 24, 16, 33, 1, 20, 14, 31],
  S4: [9, 22, 18, 29, 7, 28, 12, 35, 3, 26],
};

// ===== ANALYSIS FUNCTIONS =====

export type AnalysisType =
  | 'Colunas' | 'Duzias' | 'Duziasab' | 'Terminais'
  | 'TerminaisVizinho' | 'TerminaisVizinho2v'
  | 'TerminaisCamuflado' | 'TerminaisCamuflado1V' | 'TerminaisCamuflado2V'
  | 'TermAB' | 'Setores' | 'Vizinhos'
  | 'JuntoSeparado' | 'LadoRace' | 'ZeroDez';

export interface AnalysisGroup {
  id: string;
  label: string;
  numbers: number[];
  count: number;
  percentage: number;
  color: string;
}

const GROUP_COLORS = [
  'hsl(217 89% 61%)',  // blue
  'hsl(262 83% 58%)',  // purple
  'hsl(152 69% 31%)',  // green
  'hsl(291 47% 29%)',  // dark purple
  'hsl(33 90% 50%)',   // orange
  'hsl(0 72% 51%)',    // red
];

export const getAnalysisGroups = (type: AnalysisType, history: RouletteNumber[]): AnalysisGroup[] => {
  const total = history.length || 1;
  let groups: Record<string, number[]>;

  switch (type) {
    case 'Colunas':
      groups = COLUNAS;
      return Object.entries(groups).map(([id, nums], i) => {
        const count = history.filter(h => nums.includes(h.value)).length;
        return { id, label: id, numbers: nums, count, percentage: (count / total) * 100, color: GROUP_COLORS[i] };
      });
    case 'Duzias':
      groups = DUZIAS;
      return Object.entries(groups).map(([id, nums], i) => {
        const count = history.filter(h => nums.includes(h.value)).length;
        return { id, label: id, numbers: nums, count, percentage: (count / total) * 100, color: GROUP_COLORS[i] };
      });
    case 'Duziasab':
      groups = DUZIAS_AB;
      return Object.entries(groups).map(([id, nums], i) => {
        const count = history.filter(h => nums.includes(h.value)).length;
        return { id, label: id, numbers: nums, count, percentage: (count / total) * 100, color: GROUP_COLORS[i * 2] };
      });
    case 'Terminais':
      return Object.entries(TERMINAIS).map(([id, nums], i) => {
        const count = history.filter(h => nums.includes(h.value)).length;
        return { id, label: id, numbers: nums, count, percentage: (count / total) * 100, color: GROUP_COLORS[i % GROUP_COLORS.length] };
      });
    case 'TermAB':
      groups = TERM_ALTO_BAIXO;
      return Object.entries(groups).map(([id, nums], i) => {
        const count = history.filter(h => nums.includes(h.value)).length;
        return { id, label: id === 'TA' ? 'T.Alto' : 'T.Baixo', numbers: nums, count, percentage: (count / total) * 100, color: GROUP_COLORS[i * 2] };
      });
    case 'Setores':
      groups = SETORES;
      return Object.entries(groups).map(([id, nums], i) => {
        const count = history.filter(h => nums.includes(h.value)).length;
        const labels: Record<string, string> = { TIER: 'Tier', ORPHELINS: 'Orp', VOISINS: 'Vois' };
        return { id, label: labels[id] || id, numbers: nums, count, percentage: (count / total) * 100, color: GROUP_COLORS[i] };
      });
    case 'Vizinhos':
      groups = VIZINHOS;
      return Object.entries(groups).map(([id, nums], i) => {
        const count = history.filter(h => nums.includes(h.value)).length;
        const labels: Record<string, string> = { VIZSETE: '7', VIZVINTESETE: '27' };
        return { id, label: labels[id] || id, numbers: nums, count, percentage: (count / total) * 100, color: GROUP_COLORS[i * 2] };
      });
    case 'JuntoSeparado': {
      let juntoCount = 0;
      let separadoCount = 0;
      for (let i = 0; i < history.length - 1; i++) {
        if (isJunto(history[i].value, history[i + 1].value)) juntoCount++;
        else separadoCount++;
      }
      const jTotal = juntoCount + separadoCount || 1;
      return [
        { id: 'JUNTO', label: 'J', numbers: [], count: juntoCount, percentage: (juntoCount / jTotal) * 100, color: GROUP_COLORS[0] },
        { id: 'SEPARADO', label: 'S', numbers: [], count: separadoCount, percentage: (separadoCount / jTotal) * 100, color: GROUP_COLORS[2] },
      ];
    }
    case 'LadoRace':
      groups = LADO_RACE;
      return Object.entries(groups).map(([id, nums], i) => {
        const count = history.filter(h => nums.includes(h.value)).length;
        return { id, label: id, numbers: nums, count, percentage: (count / total) * 100, color: GROUP_COLORS[i] };
      });
    case 'ZeroDez':
      groups = LADO_ZERO_DEZ;
      return Object.entries(groups).map(([id, nums], i) => {
        const count = history.filter(h => nums.includes(h.value)).length;
        const labels: Record<string, string> = { LADOZERO: '0', LADODEZ: '10' };
        return { id, label: labels[id] || id, numbers: nums, count, percentage: (count / total) * 100, color: GROUP_COLORS[i * 2] };
      });
    default:
      return [];
  }
};

// ===== TABELA PREMIUM =====
export interface PremiumTableRow {
  number: number;
  color: string;
  terminal: number;
  coluna: string;
  duzia: string;
  altoBaixo: string;
  parImpar: string;
  setor: string;
  zeroDez: string;
  juntoSeparado: string;
  lado: string;
  cincoDois: string;
}

export const getPremiumRow = (n: number, prevNumber?: number): PremiumTableRow => {
  const color = getNumberColor(n);
  const terminal = n % 10;
  const coluna = n === 0 ? '-' : `C${((n - 1) % 3) + 1}`;
  const duzia = n === 0 ? '-' : n <= 12 ? 'D1' : n <= 24 ? 'D2' : 'D3';
  const altoBaixo = n === 0 ? '-' : n <= 18 ? 'Baixo' : 'Alto';
  const parImpar = n === 0 ? '-' : n % 2 === 0 ? 'Par' : 'Ímpar';

  let setor = '-';
  for (const [key, nums] of Object.entries(SETORES)) {
    if (nums.includes(n)) { setor = key === 'TIER' ? 'Tier' : key === 'ORPHELINS' ? 'Orp' : 'Vois'; break; }
  }

  let zeroDez = '-';
  if (LADO_ZERO_DEZ.LADOZERO.includes(n)) zeroDez = 'L0';
  if (LADO_ZERO_DEZ.LADODEZ.includes(n)) zeroDez = 'L10';

  const juntoSeparado = prevNumber !== undefined ? (isJunto(n, prevNumber) ? 'J' : 'S') : '-';

  let lado = '-';
  for (const [key, nums] of Object.entries(LADO_RACE)) {
    if (nums.includes(n)) { lado = key; break; }
  }

  let cincoDois = '-';
  for (const [key, nums] of Object.entries(CINCO_DOIS)) {
    if (nums.includes(n)) { cincoDois = key; break; }
  }

  return { number: n, color, terminal, coluna, duzia, altoBaixo, parImpar, setor, zeroDez, juntoSeparado, lado, cincoDois };
};

// ===== FILTER OPTIONS =====
export const FILTER_OPTIONS = [
  { group: 'Padrão', options: [
    { value: 'Colunas', label: 'Colunas' },
    { value: 'Duzias', label: 'Duzias' },
    { value: 'Duziasab', label: 'Duzias AB' },
    { value: 'Terminais', label: 'Terminais' },
    { value: 'TermAB', label: 'Term. Alto - Baixo' },
    { value: 'Setores', label: 'Setores' },
    { value: 'Vizinhos', label: 'Vizinhos 7 - 27' },
    { value: 'JuntoSeparado', label: 'Junto - Separado' },
    { value: 'LadoRace', label: 'Lado Race' },
    { value: 'ZeroDez', label: 'Lado 0 - 10' },
  ]},
];
