// Complete roulette knowledge base - European roulette mappings

// === 1. Basic Properties ===
export const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
export const BLACK_NUMBERS = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];
export const EVEN_NUMBERS = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36];
export const ODD_NUMBERS = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35];
export const LOW_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
export const HIGH_NUMBERS = [19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36];

// === 2. Cylinder Sectors (Physical Wheel) ===
export const VOISINS_DU_ZERO = [22, 18, 29, 7, 28, 12, 35, 3, 26, 0, 32, 15, 19, 4, 21, 2, 25];
export const TIERS_DU_CYLINDRE = [27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33];
export const ORPHELINS = [1, 20, 14, 31, 9, 17, 34, 6];
export const JEU_ZERO = [12, 35, 3, 26, 0, 32, 15];

// European wheel order (clockwise)
export const WHEEL_ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];

// === 3. Terminals ===
export const TERMINALS: Record<number, number[]> = {
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

// === 4. Table Divisions ===
export const DOZENS = {
  first: Array.from({ length: 12 }, (_, i) => i + 1),   // 1-12
  second: Array.from({ length: 12 }, (_, i) => i + 13),  // 13-24
  third: Array.from({ length: 12 }, (_, i) => i + 25),   // 25-36
};

export const COLUMNS = {
  col1: [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
  col2: [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
  col3: [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
};

export const SIX_LINES = {
  S1: [1, 2, 3, 4, 5, 6],
  S2: [7, 8, 9, 10, 11, 12],
  S3: [13, 14, 15, 16, 17, 18],
  S4: [19, 20, 21, 22, 23, 24],
  S5: [25, 26, 27, 28, 29, 30],
  S6: [31, 32, 33, 34, 35, 36],
};

// === 5. Cavalos (Splits by Terminal) ===
export const CAVALOS = {
  '2/5/8': [2, 5, 8, 12, 15, 18, 22, 25, 28, 32, 35],
  '1/4/7': [1, 4, 7, 11, 14, 17, 21, 24, 27, 31, 34],
  '0/3': [0, 3, 10, 13, 20, 23, 30, 33],
  '6/9': [6, 9, 16, 19, 26, 29, 36],
};

// === 6. Cross Mapping (Color + Parity) ===
export const RED_EVEN = [12, 14, 16, 18, 30, 32, 34, 36];
export const RED_ODD = [1, 3, 5, 7, 9, 19, 21, 23, 25, 27];
export const BLACK_EVEN = [2, 4, 6, 8, 10, 20, 22, 24, 26, 28];
export const BLACK_ODD = [11, 13, 15, 17, 29, 31, 33, 35];

// === 7. Finais em Pleno (Finales en Plein) ===
// Finais 0-6: 4 números cada (33% mais prováveis que finais 7-9)
// Finais 7-9: 3 números cada
export const FINAIS_PLENO: Record<number, { numbers: number[]; count: 4 | 3 }> = {
  0: { numbers: [0, 10, 20, 30], count: 4 },
  1: { numbers: [1, 11, 21, 31], count: 4 },
  2: { numbers: [2, 12, 22, 32], count: 4 },
  3: { numbers: [3, 13, 23, 33], count: 4 },
  4: { numbers: [4, 14, 24, 34], count: 4 },
  5: { numbers: [5, 15, 25, 35], count: 4 },
  6: { numbers: [6, 16, 26, 36], count: 4 },
  7: { numbers: [7, 17, 27], count: 3 },
  8: { numbers: [8, 18, 28], count: 3 },
  9: { numbers: [9, 19, 29], count: 3 },
};

// === 8. Dominância de Coluna por Cor ===
export const COLUMN_COLOR_DOMINANCE = {
  col1: { red: 6, black: 6, label: 'Equilibrada' },
  col2: { red: 4, black: 8, label: 'Dominante Preta' },
  col3: { red: 8, black: 4, label: 'Dominante Vermelha' },
};

// === 9. Espelhos Visuais (mesma posição em dúzias diferentes) ===
export const VISUAL_MIRRORS = [
  [1, 13, 25],  // 1º de cada dúzia
  [2, 14, 26],
  [3, 15, 27],
  [4, 16, 28],
  [5, 17, 29],
  [6, 18, 30],
  [7, 19, 31],
  [8, 20, 32],
  [9, 21, 33],
  [10, 22, 34],
  [11, 23, 35],
  [12, 24, 36],  // último de cada dúzia
];
export const RED_EVEN = [12, 14, 16, 18, 30, 32, 34, 36];
export const RED_ODD = [1, 3, 5, 7, 9, 19, 21, 23, 25, 27];
export const BLACK_EVEN = [2, 4, 6, 8, 10, 20, 22, 24, 26, 28];
export const BLACK_ODD = [11, 13, 15, 17, 29, 31, 33, 35];

// === 10. Utility Functions ===

export const getNumberColor = (n: number): 'red' | 'black' | 'green' => {
  if (n === 0) return 'green';
  return RED_NUMBERS.includes(n) ? 'red' : 'black';
};

export const getTerminal = (n: number): number => n % 10;

export const getDozen = (n: number): number | null => {
  if (n === 0) return null;
  if (n <= 12) return 1;
  if (n <= 24) return 2;
  return 3;
};

export const getColumn = (n: number): number | null => {
  if (n === 0) return null;
  return ((n - 1) % 3) + 1;
};

export const getSixLine = (n: number): string | null => {
  if (n === 0) return null;
  const idx = Math.ceil(n / 6);
  return `S${idx}`;
};

export const getSector = (n: number): string => {
  if (VOISINS_DU_ZERO.includes(n)) return 'Vizinhos do Zero';
  if (TIERS_DU_CYLINDRE.includes(n)) return 'Terço do Cilindro';
  if (ORPHELINS.includes(n)) return 'Órfãos';
  return 'Desconhecido';
};

export const getCavaloGroup = (n: number): string | null => {
  for (const [key, nums] of Object.entries(CAVALOS)) {
    if (nums.includes(n)) return key;
  }
  return null;
};

export const getWheelNeighbors = (n: number, count: number = 2): number[] => {
  const idx = WHEEL_ORDER.indexOf(n);
  if (idx === -1) return [];
  const neighbors: number[] = [];
  for (let i = 1; i <= count; i++) {
    neighbors.push(WHEEL_ORDER[(idx - i + WHEEL_ORDER.length) % WHEEL_ORDER.length]); // left
    neighbors.push(WHEEL_ORDER[(idx + i) % WHEEL_ORDER.length]); // right
  }
  return neighbors;
};

export const getCrossMapping = (n: number): string => {
  if (n === 0) return 'Zero';
  if (RED_EVEN.includes(n)) return 'Vermelho Par';
  if (RED_ODD.includes(n)) return 'Vermelho Ímpar';
  if (BLACK_EVEN.includes(n)) return 'Preto Par';
  if (BLACK_ODD.includes(n)) return 'Preto Ímpar';
  return 'Desconhecido';
};

export const getVisualMirror = (n: number): number[] | null => {
  if (n === 0) return null;
  return VISUAL_MIRRORS.find(group => group.includes(n)) || null;
};

export const getFinalPleno = (n: number): { final: number; count: 4 | 3; numbers: number[] } => {
  const f = n % 10;
  return { final: f, ...FINAIS_PLENO[f] };
};

export const getColumnColorDominance = (n: number): string | null => {
  const col = getColumn(n);
  if (!col) return null;
  const key = `col${col}` as keyof typeof COLUMN_COLOR_DOMINANCE;
  return COLUMN_COLOR_DOMINANCE[key].label;
};

// Full analysis of a single number
export const analyzeNumber = (n: number) => ({
  value: n,
  color: getNumberColor(n),
  terminal: getTerminal(n),
  dozen: getDozen(n),
  column: getColumn(n),
  sixLine: getSixLine(n),
  sector: getSector(n),
  cavalo: getCavaloGroup(n),
  crossMapping: getCrossMapping(n),
  isEven: n > 0 && n % 2 === 0,
  isLow: n >= 1 && n <= 18,
  neighbors: getWheelNeighbors(n),
  finalPleno: getFinalPleno(n),
  visualMirror: getVisualMirror(n),
  columnDominance: getColumnColorDominance(n),
});

// Generate the complete knowledge prompt for AI
export const generateKnowledgePrompt = (): string => `
## CONHECIMENTO COMPLETO DE ROLETA EUROPEIA

### 1. Classificação por Unidade
- Vermelhos (18): ${RED_NUMBERS.join(', ')}
- Pretos (18): ${BLACK_NUMBERS.join(', ')}
- Zero: 0 (Verde)
- Pares (18): ${EVEN_NUMBERS.join(', ')}
- Ímpares (18): ${ODD_NUMBERS.join(', ')}
- Baixos (1-18) | Altos (19-36)

### 2. Setores do Cilindro
- Vizinhos do Zero (17): ${VOISINS_DU_ZERO.join(', ')}
- Terço do Cilindro (12): ${TIERS_DU_CYLINDRE.join(', ')}
- Órfãos (8): ${ORPHELINS.join(', ')}
- Jogo do Zero (7): ${JEU_ZERO.join(', ')}
- Ordem do cilindro: ${WHEEL_ORDER.join(', ')}

### 3. Terminais (0-9)
${Object.entries(TERMINALS).map(([t, nums]) => `- Terminal ${t}: ${nums.join(', ')}`).join('\n')}

### 4. Mesa
- 1ª Dúzia: 1-12 | 2ª Dúzia: 13-24 | 3ª Dúzia: 25-36
- Coluna 1: ${COLUMNS.col1.join(', ')}
- Coluna 2: ${COLUMNS.col2.join(', ')}
- Coluna 3: ${COLUMNS.col3.join(', ')}
- Seisenas: ${Object.entries(SIX_LINES).map(([k, v]) => `${k}: ${v[0]}-${v[v.length-1]}`).join(' | ')}

### 5. Cavalos (Splits por Terminal)
${Object.entries(CAVALOS).map(([k, v]) => `- Cavalos ${k}: ${v.join(', ')}`).join('\n')}

### 6. Mapeamento Cruzado (Cor + Paridade)
- Vermelhos Pares (8): ${RED_EVEN.join(', ')}
- Vermelhos Ímpares (10): ${RED_ODD.join(', ')}
- Pretos Pares (10): ${BLACK_EVEN.join(', ')}
- Pretos Ímpares (8): ${BLACK_ODD.join(', ')}

### 7. Vizinhos no Cilindro
Cada número tem vizinhos à esquerda e direita no cilindro físico. Use a ordem do cilindro para calcular.
`;
