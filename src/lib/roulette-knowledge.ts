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

// === 10. Diamantes (Zonas de Choque - Defletores Físicos) ===
export const DIAMONDS = {
  topo: { label: 'Diamante Topo', numbers: [0, 32], sector: [0, 32, 15, 26, 3, 35] },
  baixo: { label: 'Diamante Baixo', numbers: [5, 24], sector: [5, 24, 10, 23, 16] },
  esquerda: { label: 'Diamante Esquerda', numbers: [1, 20], sector: [1, 20, 33, 14] },
  direita: { label: 'Diamante Direita', numbers: [10, 23], sector: [10, 23, 8, 5, 24] },
};

// === 11. Oitavos do Cilindro (Divisão Profissional em 8 setores) ===
export const OCTAVES = {
  O1: [0, 32, 15, 19, 4],
  O2: [21, 2, 25, 17],
  O3: [34, 6, 27, 13],
  O4: [36, 11, 30, 8],
  O5: [23, 10, 5, 24],
  O6: [16, 33, 1, 20],
  O7: [14, 31, 9, 22],
  O8: [18, 29, 7, 28, 12, 35, 3, 26],
};

// === 12.5 Community Pull Map — Roleta Brasileira Playtech ===
export const PULL_MAP: Record<number, number[]> = {
  1: [11,35,16,4,18,28,27,29,33],
  4: [26,15,18,32,33,16,8],
  6: [8,15,31,21,22,23],
  7: [30,31,16,18,17],
  9: [34,35,36,3,16,26,1,23,24,32,31],
  10: [20,5,18,11,14,24],
  14: [22,33,2],
  16: [24,21,18,14],
  20: [4,14],
  27: [28,29,24,22,26,33,31,34,35,36],
  30: [4,8,16,9,18,22,5,25,3],
};

export const PULL_TERMINALS: Record<number, number[]> = {
  1: [6,1], 7: [7,9,4,0,3], 9: [8,0], 10: [0,5,8,3,4],
  14: [5], 16: [6,9,4], 20: [5,6,0], 27: [5,6], 30: [6,5],
  4: [8,0,4], 6: [4,2,6,0],
};

export const PULL_CAVALOS: Record<number, string[]> = {
  7: ['258'], 9: ['69'], 14: ['147','258'], 20: ['69'],
  27: ['147'], 30: ['147'], 4: ['69','258'], 6: ['147','258'],
};

// === Módulos Dani Green ===

// Módulo 1: Duplo de Terminais — pares complementares
export const TERMINAL_PAIRS: Record<number, number> = { 1:6, 6:1, 2:7, 7:2, 3:8, 8:3, 4:9, 9:4, 0:5, 5:0 };

// Módulo 4: Zero Pressure — vizinhos do zero na roda
export const ZERO_NEIGHBORS_WHEEL = [32, 15, 26, 3, 35, 12, 28];
export const ZERO_TERMINAL_NUMS = [0, 10, 20, 30];

// Módulo 5: Pull Map expandido
export const FULL_PULL_MAP: Record<number, number[]> = {
  0: [10, 20, 30, 32, 15, 26, 3],
  1: [11, 35, 16, 4, 18, 28, 27, 29, 33],
  4: [26, 15, 18, 32, 33, 16, 8],
  6: [8, 15, 31, 21, 22, 23],
  7: [16, 18, 17, 30],
  9: [34, 35, 36, 3, 16, 26, 1, 23, 24, 32, 31],
  10: [20, 5, 18, 11, 14, 24],
  14: [24, 21, 18, 22, 33, 2],
  16: [24, 21, 18, 14],
  20: [4, 14],
  27: [28, 29, 24, 22, 26, 33, 31, 34, 35, 36],
  30: [4, 8, 16, 9, 18, 22, 5, 25, 3],
};

// REED rule
export const REED_MAX = 4;

// Módulo 6: Detect ascending/descending terminal sequences
export const detectTerminalProgression = (nums: number[]): { active: boolean; sequence: number[]; nextTerminal: number | null } => {
  if (nums.length < 3) return { active: false, sequence: [], nextTerminal: null };
  const terms = nums.slice(0, 5).map(n => n % 10);
  if (terms.length >= 3 && terms[2] < terms[1] && terms[1] < terms[0]) {
    return { active: true, sequence: [terms[2], terms[1], terms[0]], nextTerminal: (terms[0] + 1) % 10 };
  }
  if (terms.length >= 3 && terms[2] > terms[1] && terms[1] > terms[0]) {
    return { active: true, sequence: [terms[2], terms[1], terms[0]], nextTerminal: (terms[0] - 1 + 10) % 10 };
  }
  return { active: false, sequence: [], nextTerminal: null };
};


// === 12. Complementares (Soma 37) ===
export const COMPLEMENTARES: [number, number][] = [
  [1, 36], [2, 35], [3, 34], [4, 33], [5, 32], [6, 31],
  [7, 30], [8, 29], [9, 28], [10, 27], [11, 26], [12, 25],
  [13, 24], [14, 23], [15, 22], [16, 21], [17, 20], [18, 19],
];

// === 13. Utility Functions ===

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

export const getOctave = (n: number): string | null => {
  for (const [key, nums] of Object.entries(OCTAVES)) {
    if (nums.includes(n)) return key;
  }
  return null;
};

export const getComplementar = (n: number): number | null => {
  if (n === 0 || n > 36) return null;
  return 37 - n;
};

export const getDiamond = (n: number): string | null => {
  for (const [, d] of Object.entries(DIAMONDS)) {
    if (d.sector.includes(n)) return d.label;
  }
  return null;
};

// Wheel distance between two numbers
export const getWheelDistance = (a: number, b: number): number => {
  const idxA = WHEEL_ORDER.indexOf(a);
  const idxB = WHEEL_ORDER.indexOf(b);
  if (idxA === -1 || idxB === -1) return -1;
  const diff = Math.abs(idxA - idxB);
  return Math.min(diff, WHEEL_ORDER.length - diff);
};

// Lei do Terço analysis
export const analyzeThirdLaw = (last37: number[]): { absent: number[]; once: number[]; repeated: number[] } => {
  const freq: Record<number, number> = {};
  last37.forEach(n => { freq[n] = (freq[n] || 0) + 1; });
  const all = Array.from({ length: 37 }, (_, i) => i);
  return {
    absent: all.filter(n => !freq[n]),
    once: all.filter(n => freq[n] === 1),
    repeated: all.filter(n => (freq[n] || 0) >= 2),
  };
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
  octave: getOctave(n),
  complementar: getComplementar(n),
  diamond: getDiamond(n),
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

### 8. Finais em Pleno (Finales en Plein)
- Finais 0-6: 4 números cada (prob ~10.8% cada grupo) — 33% mais prováveis que finais 7-9
- Finais 7-9: 3 números cada (prob ~8.1% cada grupo)
${Object.entries(FINAIS_PLENO).map(([f, d]) => `- Final ${f} (${d.count} nºs): ${d.numbers.join(', ')}`).join('\n')}

### 9. Dominância de Coluna por Cor
- Coluna 1: 6 pretos, 6 vermelhos (Equilibrada)
- Coluna 2: 8 pretos, 4 vermelhos (Dominante Preta)
- Coluna 3: 4 pretos, 8 vermelhos (Dominante Vermelha)

### 10. Espelhos Visuais (mesma posição em dúzias diferentes)
${VISUAL_MIRRORS.map(g => `- Espelho: ${g.join(', ')}`).join('\n')}

### 11. Diamantes (Zonas de Choque - Defletores Físicos)
${Object.values(DIAMONDS).map(d => `- ${d.label}: números ${d.numbers.join(', ')} (setor: ${d.sector.join(', ')})`).join('\n')}

### 12. Oitavos do Cilindro (Divisão Profissional em 8 setores)
${Object.entries(OCTAVES).map(([k, v]) => `- ${k}: ${v.join(', ')}`).join('\n')}

### 13. Lei do Terço
Em 37 rodadas: ~12 números não saem, ~12 saem 1x, ~12 se repetem (2x+). Rastreie a zona de repetição.

### 14. Padrões de Salto (Skips)
- Salto Curto: <5 posições no cilindro entre rodadas consecutivas
- Salto Longo: >18 posições (lado oposto ~180°)
- Calcule distância no cilindro entre cada resultado consecutivo

### 15. Complementares (Soma 37)
${COMPLEMENTARES.map(([a, b]) => `(${a},${b})`).join(' | ')}

### 16. Módulos Dani Green (Estratégias Avançadas)
- **MÓD 1 - Duplo Terminal**: Apostar em 2 terminais complementares (T1+T6, T2+T7, T3+T8, T4+T9, T0+T5). REED: sair após 4 rounds sem acertar.
- **MÓD 2 - Terminais Altos/Baixos**: 3+ consecutivos acima/abaixo de 18 → foco nos terminais com predominância alta/baixa.
- **MÓD 3 - Poucas Fichas**: Terminal único, stop loss 3 rounds, meta +12 fichas.
- **MÓD 4 - Pressão Zero**: Zero ausente 15+ rodadas + vizinhos (32,15,26,3) ativos → apostar no zero e adjacentes.
- **MÓD 5 - Números que Puxam**: Correlações empíricas da mesa Playtech BR + vizinhos de cada alvo. REED: max 4 rounds.
- **MÓD 6 - Crescentes**: Sequência ascendente de terminais (ex: T3→T4→T5→T6) → apostar no próximo terminal.
- **Pares de Terminais**: ${Object.entries(TERMINAL_PAIRS).map(([a, b]) => `T${a}↔T${b}`).join(', ')}
`;
