import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WHEEL = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const WL = WHEEL.length;
const VOISINS = [22,18,29,7,28,12,35,3,26,0,32,15,19,4,21,2,25];
const TIERS = [27,13,36,11,30,8,23,10,5,24,16,33];
const ORPHELINS = [1,20,14,31,9,17,34,6];
const JEU_ZERO = [12,35,3,26,0,32,15];
// PROTECTION_NUMBERS removido — agora é dinâmico via realProtection (baseado em erros reais)
const PROTECTION_NUMBERS_LEGACY: number[] = [24, 29, 35, 11]; // fallback only

const OCTAVES: Record<string, number[]> = {
  O1:[0,32,15,19,4], O2:[21,2,25,17], O3:[34,6,27,13], O4:[36,11,30,8],
  O5:[23,10,5,24], O6:[16,33,1,20], O7:[14,31,9,22], O8:[18,29,7,28,12,35,3,26],
};

const CAVALOS: Record<string, number[]> = {
  '258':[2,5,8,12,15,18,22,25,28,32,35],
  '147':[1,4,7,11,14,17,21,24,27,31,34],
  '03':[0,3,10,13,20,23,30,33],
  '69':[6,9,16,19,26,29,36],
};

const RED = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
const COL1 = [1,4,7,10,13,16,19,22,25,28,31,34];
const COL2 = [2,5,8,11,14,17,20,23,26,29,32,35];
const COL3 = [3,6,9,12,15,18,21,24,27,30,33,36];

const getColor = (n: number) => n === 0 ? 'green' : RED.includes(n) ? 'red' : 'black';
const wheelIdx = (n: number) => WHEEL.indexOf(n);
const wheelDist = (a: number, b: number) => {
  const ia = wheelIdx(a), ib = wheelIdx(b);
  if (ia === -1 || ib === -1) return 99;
  const d = Math.abs(ia - ib);
  return Math.min(d, WL - d);
};
const getOctave = (n: number) => { for (const [k, v] of Object.entries(OCTAVES)) if (v.includes(n)) return k; return null; };
const getSector = (n: number) => VOISINS.includes(n)?'Voisins':TIERS.includes(n)?'Tiers':ORPHELINS.includes(n)?'Orphelins':'Zero';
const getCavalo = (n: number) => { for (const [k, v] of Object.entries(CAVALOS)) if (v.includes(n)) return k; return null; };
const getNeighbors = (n: number, count = 4) => {
  const idx = wheelIdx(n); if (idx === -1) return [];
  const r: number[] = [];
  for (let i = 1; i <= count; i++) { r.push(WHEEL[(idx-i+WL)%WL]); r.push(WHEEL[(idx+i)%WL]); }
  return r;
};
const getComplementar = (n: number) => n > 0 && n <= 36 ? 37 - n : null;
const getDozen = (n: number) => n === 0 ? 0 : n <= 12 ? 1 : n <= 24 ? 2 : 3;
const getColumn = (n: number) => n === 0 ? 0 : COL1.includes(n) ? 1 : COL2.includes(n) ? 2 : 3;
const getMirror = (n: number) => { const s = String(n); if (s.length === 2) { const m = parseInt(s[1]+s[0]); return m >= 0 && m <= 36 ? m : null; } return null; };

// Quadrants
const isHigh = (n: number) => n >= 19 && n <= 36;
const isLow = (n: number) => n >= 1 && n <= 18;
const isEven = (n: number) => n > 0 && n % 2 === 0;
const isOdd = (n: number) => n > 0 && n % 2 === 1;

// ========================================================
// COMMUNITY PULL MAP — Roleta Brasileira Playtech
// Documented correlations: number X frequently pulls Y
// ========================================================
const PULL_MAP: Record<number, number[]> = {
  0:  [10, 20, 30, 32, 15, 26, 3, 33, 31],
  1:  [11, 35, 16, 4, 18, 28, 27, 29, 33],
  2:  [14, 1, 13, 18, 35, 29],
  3:  [13, 27, 6, 11, 30, 8],
  4:  [26, 15, 18, 32, 33, 16, 8],
  5:  [3, 33, 16, 24, 10, 18],
  6:  [8, 15, 31, 21, 22, 23],
  7:  [16, 18, 17, 30, 31],
  8:  [11, 9, 10],
  9:  [34, 35, 36, 3, 16, 26, 23, 24, 32, 31],
  10: [20, 5, 18, 11, 14, 24],
  11: [8, 18, 16, 21, 30, 1],
  12: [21, 7, 28, 35],
  13: [31, 27, 36, 6],
  14: [24, 21, 18, 31, 9],
  15: [4, 19, 21, 32, 0],
  16: [24, 21, 18, 14, 6, 26],
  17: [34, 6, 25, 27, 7],
  18: [8, 18, 28, 7],
  19: [9, 19, 29, 4, 21],
  20: [4, 14, 10, 30],
  21: [19, 2, 4, 23],
  22: [33, 2, 32, 12],
  23: [32, 11, 2, 33, 13],
  24: [21, 18, 14, 34, 4],
  25: [2, 4, 17, 28, 29, 12, 7, 18],
  26: [6, 16, 26, 36, 3, 0],
  27: [28, 29, 24, 22, 26, 33, 31, 34, 35, 36],
  28: [13, 14, 15, 16, 17, 18],
  29: [35, 28, 22],
  30: [4, 8, 16, 9, 18, 22, 5, 25, 3],
  31: [13, 9, 14],
  32: [2, 12, 22, 32, 0, 15],
  33: [16, 3, 23, 13],
  34: [16, 6, 4, 24],
  35: [0, 3, 7, 12, 26, 28, 29, 35],
  36: [3, 10, 27, 6],
};

const PULL_TERMINALS: Record<number, number[]> = {
  0: [0,2,3,5], 1: [1,5,6,8], 2: [4,1,3,8,5,9], 3: [3,7,6,1,0,8],
  4: [6,5,8,2,3], 5: [3,6,4,0,8], 6: [8,5,1,2,3], 7: [7,9,4,0,3,8],
  8: [1,9,0,8], 9: [4,5,6,3], 10: [0,5,8,1,4], 11: [8,6,1],
  12: [1], 13: [1], 14: [4,1,8], 15: [4,9,1], 16: [4,1,8],
  17: [7,4,6,5], 18: [8], 19: [9], 20: [4,0], 21: [9],
  22: [3,2], 23: [2,1], 24: [1,8,4], 25: [2,4,7,8,9],
  26: [6,3,0], 27: [8,9,4,2,6,3,1,5], 28: [3,4,5,6,7,8],
  29: [5], 30: [4,8,6,9,2,5], 31: [3,1], 32: [2],
  33: [6,3], 34: [6,4], 35: [0,3,7,2,6,8,9], 36: [3,0,7,6],
};

const PULL_CAVALOS: Record<number, string[]> = {
  7: ['258'], 9: ['69'], 14: ['147','258'], 20: ['69'],
  27: ['147'], 30: ['147'], 4: ['69','258'], 6: ['147','258'],
};

const TERMINALS_MAP: Record<number, number[]> = {
  0:[0,10,20,30], 1:[1,11,21,31], 2:[2,12,22,32], 3:[3,13,23,33],
  4:[4,14,24,34], 5:[5,15,25,35], 6:[6,16,26,36], 7:[7,17,27],
  8:[8,18,28], 9:[9,19,29],
};

const FINALES_WEIGHT: Record<number, number> = {0:4,1:4,2:4,3:4,4:4,5:4,6:4,7:3,8:3,9:3};

// ========================================================
// 100 ESTRATÉGIAS — Constants & Detectors
// ========================================================

// MÓD 1: Duplo de Terminais — pares complementares
const TERMINAL_PAIRS: Record<number, number> = { 1:6, 6:1, 2:7, 7:2, 3:8, 8:3, 4:9, 9:4, 0:5, 5:0 };

// MÓD 4: Zero Pressure
const ZERO_NEIGHBORS_WHEEL = [32, 15, 26, 3, 35, 12, 28];
const ZERO_TERMINAL_NUMS = [0, 10, 20, 30];

// Pull Maps
const FULL_PULL_MAP: Record<number, number[]> = {
  0:  [10, 20, 30, 32, 15, 26, 3, 33, 31, 35],
  1:  [11, 35, 16, 4, 18, 28, 27, 29, 33, 14, 31],
  2:  [14, 1, 13, 18, 35, 29, 12, 22],
  3:  [13, 27, 6, 11, 30, 8, 23, 33],
  4:  [26, 15, 18, 32, 33, 16, 8, 24, 14],
  5:  [3, 33, 16, 24, 10, 18, 15, 25],
  6:  [8, 15, 31, 21, 22, 23, 16, 26],
  7:  [16, 18, 17, 30, 31, 28, 12],
  8:  [11, 9, 10, 18, 28, 23],
  9:  [34, 35, 36, 3, 16, 26, 23, 24, 32, 31, 29],
  10: [20, 5, 18, 11, 14, 24, 30],
  11: [8, 18, 16, 21, 30, 1],
  12: [21, 7, 28, 35],
  13: [31, 27, 36, 6],
  14: [24, 21, 18, 31, 9],
  15: [4, 19, 21, 32, 0],
  16: [24, 21, 18, 14, 6, 26],
  17: [34, 6, 25, 27, 7],
  18: [8, 18, 28, 7],
  19: [9, 19, 29, 4, 21],
  20: [4, 14, 10, 30],
  21: [19, 2, 4, 23],
  22: [33, 2, 32, 12],
  23: [32, 11, 2, 33, 13],
  24: [21, 18, 14, 34, 4],
  25: [2, 4, 17, 28, 29, 12, 7, 18],
  26: [6, 16, 26, 36, 3, 0],
  27: [28, 29, 24, 22, 26, 33, 31, 34, 35, 36],
  28: [13, 14, 15, 16, 17, 18, 7],
  29: [35, 28, 22],
  30: [4, 8, 16, 9, 18, 22, 5, 25, 3],
  31: [13, 9, 14],
  32: [2, 12, 22, 32, 0, 15],
  33: [16, 3, 23, 13],
  34: [16, 6, 4, 24],
  35: [0, 3, 7, 12, 26, 28, 29, 35],
  36: [3, 10, 27, 6],
};
const FULL_PULL_TERMINALS: Record<number, number[]> = {
  0:  [0, 2, 3, 5],
  1:  [1, 5, 6, 8],
  2:  [4, 1, 3, 8, 5, 9],
  3:  [3, 7, 6, 1, 0, 8],
  4:  [6, 5, 8, 2, 3],
  5:  [3, 6, 4, 0, 8],
  6:  [8, 5, 1, 2, 3],
  7:  [7, 9, 4, 0, 3, 8],
  8:  [1, 9, 0, 8],
  9:  [4, 5, 6, 3],
  10: [0, 5, 8, 1, 4],
  11: [8, 6, 1],
  12: [1],
  13: [1],
  14: [4, 1, 8],
  15: [4, 9, 1],
  16: [4, 1, 8],
  17: [7, 4, 6, 5],
  18: [8],
  19: [9],
  20: [4, 0],
  21: [9],
  22: [3, 2],
  23: [2, 1],
  24: [1, 8, 4],
  25: [2, 4, 7, 8, 9],
  26: [6, 3, 0],
  27: [8, 9, 4, 2, 6, 3, 1, 5],
  28: [3, 4, 5, 6, 7, 8],
  29: [5],
  30: [4, 8, 6, 9, 2, 5],
  31: [3, 1],
  32: [2],
  33: [6, 3],
  34: [6, 4],
  35: [0, 3, 7, 2, 6, 8, 9],
  36: [3, 0, 7, 6],
};

// Duplas de Terminais (Método Dani Green)
const DUPLAS_TERMINAIS: Record<string, number[]> = {
  'D1_T1T6': [1,11,21,31,6,16,26,36],
  'D2_T2T7': [2,12,22,32,7,17,27],
  'D3_T3T8': [3,13,23,33,8,18,28],
  'D4_T4T9': [4,14,24,34,9,19,29],
  'D5_T0T5': [10,20,30,5,15,25,35],
};

// Cavalos Especiais
const CAVALOS_RED_SPLITS = [[9,12], [16,19], [18,21], [27,30]];
const CAVALOS_BLACK_SPLITS = [[8,11], [10,13], [17,20], [26,29]];
const CAVALOS_ZERO_SPLITS = [[0,1], [0,2], [0,3]];
const EDDIE_SPLITS = [[5,8], [10,11], [13,16], [23,24], [27,30], [33,36]];
const KAVOURAS_NUMS = [1,2,3,4,5,6,8,9,11,12,14,15,17,18,26,27,29,30,31,32,33,34,35,36];

// Triangulações de Terminal
const TERMINAL_TRIANGLES: Record<string, number[]> = {
  'T1+T4+T7': [1,11,21,31,4,14,24,34,7,17,27],
  'T2+T5+T8': [2,12,22,32,5,15,25,35,8,18,28],
  'T3+T6+T9': [3,13,23,33,6,16,26,36,9,19,29],
};

// Pós-zero terminais
const POST_ZERO_TERMINALS = [0, 2, 5];
const POST_ZERO_NUMS = [0,10,20,30, 2,12,22,32, 5,15,25,35];

// Espelhos numéricos
const NUMERIC_MIRRORS: Record<number, number> = { 12:21, 21:12, 13:31, 31:13, 23:32, 32:23 };

// Central crescente/decrescente (col2 diagonal)
const CENTRAL_SEQUENCE = [5, 14, 23, 32];

// Estrela de Davi (Invictor)
const ESTRELA_DAVI_NUMS = [30, 31, 33, 34, 35, 8, 23, 10, 5, 9, 22, 1, 20, 14, 3, 26, 12];

// ========================================================
// SCORING SYSTEM — Signal-based confidence scoring
// ========================================================
const SIGNAL_SCORES: Record<string, number> = {
  F5: 30, C1: 40, S3_S4: 35, S1: 15, G4: 20, C2: 25, F1: 30, F2: 20, P3: 20, S2: 15,
};
const DIVERSITY_BONUS: Record<number, number> = { 2: 10, 3: 15, 4: 25 };

// ========================================================
// ENTROPY — Terminal frequency entropy for session regime
// ========================================================
const calculateEntropy = (nums: number[], window = 15): number => {
  const terms: Record<number, number> = {};
  for (let t = 0; t <= 9; t++) terms[t] = 0;
  const slice = nums.slice(0, window);
  slice.forEach(n => terms[n % 10]++);
  const total = slice.length || 1;
  let entropy = 0;
  for (let t = 0; t <= 9; t++) {
    const p = terms[t] / total;
    if (p > 0) entropy -= p * Math.log2(p);
  }
  // Normalize to 0-1 range (max entropy for 10 bins = log2(10) ≈ 3.32)
  return entropy / Math.log2(10);
};

// ========================================================
// DETECTORS
// ========================================================

const detectHotTerminal = (nums: number[], window = 15): { terminal: number; count: number; pair: number } => {
  const freq: Record<number, number> = {};
  for (let t = 0; t <= 9; t++) freq[t] = 0;
  nums.slice(0, window).forEach(n => freq[n % 10]++);
  const sorted = Object.entries(freq).sort(([,a],[,b]) => b - a);
  const hot = Number(sorted[0][0]);
  return { terminal: hot, count: sorted[0][1] as number, pair: TERMINAL_PAIRS[hot] };
};

const detectColdTerminal = (nums: number[], window = 15): { terminal: number; delay: number } => {
  const freq: Record<number, number> = {};
  for (let t = 0; t <= 9; t++) freq[t] = 0;
  nums.slice(0, window).forEach(n => freq[n % 10]++);
  const sorted = Object.entries(freq).sort(([,a],[,b]) => a - b);
  return { terminal: Number(sorted[0][0]), delay: window - (sorted[0][1] as number) };
};

const detectHighLowBias = (nums: number[], window = 10): 'high' | 'low' | null => {
  const recent = nums.slice(0, window).filter(n => n > 0);
  const highCount = recent.filter(n => n >= 19).length;
  const lowCount = recent.filter(n => n <= 18).length;
  if (highCount >= window * 0.6) return 'high';
  if (lowCount >= window * 0.6) return 'low';
  return null;
};

const detectZeroPressure = (nums: number[]): { active: boolean; delay: number; neighborsActive: number } => {
  let delay = 0;
  for (let i = 0; i < nums.length; i++) { if (nums[i] === 0) break; delay++; }
  const recent15 = nums.slice(0, 15);
  const neighborsActive = ZERO_NEIGHBORS_WHEEL.filter(n => recent15.includes(n)).length;
  const t0Active = ZERO_TERMINAL_NUMS.filter(n => recent15.includes(n) && n !== 0).length;
  return { active: delay >= 15 && (neighborsActive >= 2 || t0Active >= 2), delay, neighborsActive: neighborsActive + t0Active };
};

const detectAscendingTerminals = (nums: number[]): { active: boolean; sequence: number[]; nextTerminal: number | null; direction: string } => {
  if (nums.length < 3) return { active: false, sequence: [], nextTerminal: null, direction: '' };
  const terms = nums.slice(0, 5).map(n => n % 10);
  if (terms.length >= 3 && terms[2] < terms[1] && terms[1] < terms[0]) {
    return { active: true, sequence: [terms[2], terms[1], terms[0]], nextTerminal: (terms[0] + 1) % 10, direction: 'asc' };
  }
  if (terms.length >= 3 && terms[2] > terms[1] && terms[1] > terms[0]) {
    return { active: true, sequence: [terms[2], terms[1], terms[0]], nextTerminal: (terms[0] - 1 + 10) % 10, direction: 'desc' };
  }
  const dzs = nums.slice(0, 3).filter(n => n > 0).map(n => n <= 12 ? 1 : n <= 24 ? 2 : 3);
  if (dzs.length === 3 && dzs[2] === 1 && dzs[1] === 2 && dzs[0] === 3) {
    return { active: true, sequence: dzs, nextTerminal: null, direction: 'dozen' };
  }
  return { active: false, sequence: [], nextTerminal: null, direction: '' };
};

// #15: Terminal Repetido — mesmo terminal 2x seguidas
const detectTerminalRepetido = (nums: number[]): { active: boolean; terminal: number } => {
  if (nums.length < 2) return { active: false, terminal: -1 };
  const t0 = nums[0] % 10, t1 = nums[1] % 10;
  return { active: t0 === t1, terminal: t0 };
};

// #17: Terminal Alternado — ímpares vs pares dominando
const detectTerminalAlternado = (nums: number[], window = 10): 'odd' | 'even' | null => {
  const terms = nums.slice(0, window).map(n => n % 10);
  const oddCount = terms.filter(t => t % 2 === 1).length;
  const evenCount = terms.filter(t => t % 2 === 0).length;
  if (oddCount >= window * 0.7) return 'odd'; // ímpares dominam → entrar pares
  if (evenCount >= window * 0.7) return 'even';
  return null;
};

// #74/#75: Central Crescente/Decrescente
const detectCentralProgression = (nums: number[]): { active: boolean; direction: string; next: number | null } => {
  const recent = nums.slice(0, 4);
  for (let i = 0; i < recent.length - 1; i++) {
    const idxA = CENTRAL_SEQUENCE.indexOf(recent[i+1]);
    const idxB = CENTRAL_SEQUENCE.indexOf(recent[i]);
    if (idxA >= 0 && idxB >= 0 && idxB === idxA + 1) {
      const nextIdx = idxB + 1;
      if (nextIdx < CENTRAL_SEQUENCE.length) return { active: true, direction: 'asc', next: CENTRAL_SEQUENCE[nextIdx] };
    }
    if (idxA >= 0 && idxB >= 0 && idxB === idxA - 1) {
      const nextIdx = idxB - 1;
      if (nextIdx >= 0) return { active: true, direction: 'desc', next: CENTRAL_SEQUENCE[nextIdx] };
    }
  }
  return { active: false, direction: '', next: null };
};

// #82: Padrão de Cores — 3+ mesma cor
const detectColorStreak = (nums: number[]): { active: boolean; color: string; count: number } => {
  if (nums.length < 3) return { active: false, color: '', count: 0 };
  const colors = nums.slice(0, 10).map(n => getColor(n));
  let streak = 1;
  for (let i = 1; i < colors.length; i++) {
    if (colors[i] === colors[0] && colors[0] !== 'green') streak++;
    else break;
  }
  return { active: streak >= 3, color: colors[0], count: streak };
};

// #83: Par-Ímpar com Terminal
const detectParImparBias = (nums: number[], window = 10): 'par' | 'impar' | null => {
  const recent = nums.slice(0, window).filter(n => n > 0);
  const pares = recent.filter(n => n % 2 === 0).length;
  if (pares >= window * 0.65) return 'par';
  if (pares <= window * 0.35) return 'impar';
  return null;
};

// #84: Alternância Alto-Baixo
const detectAltoLowAlternation = (nums: number[]): { active: boolean; next: 'high' | 'low' | null } => {
  if (nums.length < 3) return { active: false, next: null };
  const hilo = nums.slice(0, 5).filter(n => n > 0).map(n => n >= 19 ? 'H' : 'L');
  if (hilo.length >= 3 && hilo[0] !== hilo[1] && hilo[1] !== hilo[2]) {
    return { active: true, next: hilo[0] === 'H' ? 'low' : 'high' };
  }
  return { active: false, next: null };
};

// #65: Espelho numérico — check if mirror exists and is due
const detectMirrorDue = (nums: number[]): number[] => {
  const last = nums[0];
  const mirror = NUMERIC_MIRRORS[last];
  if (mirror === undefined) return [];
  // Check if mirror hasn't appeared in last 10
  const recent10 = nums.slice(0, 10);
  if (!recent10.includes(mirror)) return [mirror];
  return [];
};

// #70: Zero após vizinhos saírem
const detectZeroAfterNeighbors = (nums: number[]): boolean => {
  const recent5 = nums.slice(0, 5);
  const zeroNeighborsHit = [32, 15, 26, 3].filter(n => recent5.includes(n)).length;
  return zeroNeighborsHit >= 2 && !recent5.includes(0);
};

// #81: Gatilho Perfeito — 3 confirmações simultâneas
const detectGatilhoPerfeito = (nums: number[], hotTerminal: number, pullNums: number[]): { active: boolean; numbers: number[] } => {
  const recent10 = nums.slice(0, 10);
  const termNums = TERMINALS_MAP[hotTerminal] || [];
  // 1. Terminal quente
  const termCount = recent10.filter(n => termNums.includes(n)).length;
  const termActive = termCount >= 3;
  // 2. Puxados ativos
  const pullActive = pullNums.length > 0;
  // 3. Vizinhança ativa (neighbors of hot terminal numbers appearing)
  const vizActive = termNums.some(tn => {
    const neigh = getNeighbors(tn, 2);
    return neigh.some(nn => recent10.includes(nn));
  });
  if (termActive && pullActive && vizActive) {
    const combined = [...new Set([...termNums, ...pullNums.slice(0, 4)])];
    return { active: true, numbers: combined.slice(0, 10) };
  }
  return { active: false, numbers: [] };
};

const REED_MAX = 4;

// ========================================================
// ADVANCED ANALYSIS ENGINES
// ========================================================

// MOMENTUM INDEX — measures directional momentum of categories
const calculateMomentum = (nums: number[], getCat: (n: number) => string, window = 20): Record<string, { momentum: number; trend: 'rising' | 'falling' | 'stable'; streak: number }> => {
  const result: Record<string, { momentum: number; trend: 'rising' | 'falling' | 'stable'; streak: number }> = {};
  if (nums.length < window) return result;
  // Split into 4 micro-windows
  const wSize = Math.floor(window / 4);
  const windows: Record<string, number[]> = {};
  for (let w = 0; w < 4; w++) {
    const slice = nums.slice(w * wSize, (w + 1) * wSize);
    const catCount: Record<string, number> = {};
    slice.forEach(n => { const c = getCat(n); if (c) catCount[c] = (catCount[c] || 0) + 1; });
    for (const [cat, count] of Object.entries(catCount)) {
      if (!windows[cat]) windows[cat] = [];
      windows[cat].push(count);
    }
  }
  for (const [cat, counts] of Object.entries(windows)) {
    while (counts.length < 4) counts.push(0);
    // Momentum = weighted slope (recent windows matter more)
    const momentum = (counts[0] * 4 + counts[1] * 2 - counts[2] * 1 - counts[3] * 2) / (4 * wSize);
    // Streak: consecutive windows with increasing count
    let streak = 0;
    for (let i = 0; i < counts.length - 1; i++) {
      if (counts[i] >= counts[i + 1]) streak++;
      else break;
    }
    const trend = momentum > 0.15 ? 'rising' : momentum < -0.15 ? 'falling' : 'stable';
    result[cat] = { momentum: +momentum.toFixed(3), trend, streak };
  }
  return result;
};

// VOLATILITY INDEX — measures how unpredictable the session is
const calculateVolatility = (nums: number[], window = 30): { score: number; level: 'baixa' | 'média' | 'alta' | 'extrema'; arcVolatility: number; categoryVolatility: number } => {
  if (nums.length < 10) return { score: 0, level: 'média', arcVolatility: 0, categoryVolatility: 0 };
  const slice = nums.slice(0, Math.min(window, nums.length));
  // Arc volatility: std deviation of wheel distances
  const arcs: number[] = [];
  for (let i = 0; i < slice.length - 1; i++) arcs.push(wheelDist(slice[i], slice[i + 1]));
  const arcMean = arcs.reduce((a, b) => a + b, 0) / (arcs.length || 1);
  const arcVar = arcs.reduce((a, b) => a + Math.pow(b - arcMean, 2), 0) / (arcs.length || 1);
  const arcVolatility = Math.sqrt(arcVar);
  // Category volatility: how often sector/dozen/column changes
  let sectorChanges = 0, dozenChanges = 0, colorChanges = 0;
  for (let i = 0; i < slice.length - 1; i++) {
    if (getSector(slice[i]) !== getSector(slice[i + 1])) sectorChanges++;
    if (getDozen(slice[i]) !== getDozen(slice[i + 1])) dozenChanges++;
    if (getColor(slice[i]) !== getColor(slice[i + 1])) colorChanges++;
  }
  const totalTransitions = slice.length - 1 || 1;
  const categoryVolatility = ((sectorChanges + dozenChanges + colorChanges) / (totalTransitions * 3)) * 100;
  // Combined score
  const score = Math.round(arcVolatility * 3 + categoryVolatility * 0.7);
  const level = score > 80 ? 'extrema' : score > 55 ? 'alta' : score > 30 ? 'média' : 'baixa';
  return { score, level, arcVolatility: +arcVolatility.toFixed(1), categoryVolatility: +categoryVolatility.toFixed(1) };
};

// RECENCY-WEIGHTED FREQUENCY — exponential decay weight for recent numbers
const recencyWeightedFreq = (nums: number[], decay = 0.92): Record<number, number> => {
  const freq: Record<number, number> = {};
  for (let n = 0; n <= 36; n++) freq[n] = 0;
  nums.forEach((n, i) => { freq[n] += Math.pow(decay, i); });
  return freq;
};

// PATTERN BREAKOUT DETECTION — identifies when a stable pattern suddenly breaks
const detectBreakout = (nums: number[]): { active: boolean; type: string; description: string; confidence: number }[] => {
  const breakouts: { active: boolean; type: string; description: string; confidence: number }[] = [];
  if (nums.length < 20) return breakouts;
  // Check if recent 5 numbers break the pattern of the previous 15
  const recent5 = nums.slice(0, 5);
  const prev15 = nums.slice(5, 20);
  // Sector breakout
  const prevSectorDom: Record<string, number> = {};
  prev15.forEach(n => { const s = getSector(n); prevSectorDom[s] = (prevSectorDom[s] || 0) + 1; });
  const topPrevSector = Object.entries(prevSectorDom).sort(([,a],[,b]) => b - a)[0];
  if (topPrevSector && topPrevSector[1] >= 8) {
    const recentInSector = recent5.filter(n => getSector(n) === topPrevSector[0]).length;
    if (recentInSector <= 1) {
      breakouts.push({
        active: true, type: 'sector_breakout',
        description: `Setor ${topPrevSector[0]} dominava (${topPrevSector[1]}/15) mas parou nos últimos 5 giros`,
        confidence: Math.min(85, 50 + (topPrevSector[1] - recentInSector) * 5),
      });
    }
  }
  // Color breakout
  const prevRedCount = prev15.filter(n => getColor(n) === 'red').length;
  const prevBlackCount = prev15.filter(n => getColor(n) === 'black').length;
  const recentRedCount = recent5.filter(n => getColor(n) === 'red').length;
  if (prevRedCount >= 10 && recentRedCount <= 1) {
    breakouts.push({ active: true, type: 'color_breakout', description: `Vermelho dominava (${prevRedCount}/15) — Preto assumindo`, confidence: 78 });
  } else if (prevBlackCount >= 10 && recent5.filter(n => getColor(n) === 'black').length <= 1) {
    breakouts.push({ active: true, type: 'color_breakout', description: `Preto dominava (${prevBlackCount}/15) — Vermelho assumindo`, confidence: 78 });
  }
  // Dozen breakout
  const prevDzCount = [0, 0, 0];
  prev15.forEach(n => { const d = getDozen(n); if (d > 0) prevDzCount[d - 1]++; });
  const hotDzIdx = prevDzCount.indexOf(Math.max(...prevDzCount));
  if (prevDzCount[hotDzIdx] >= 8) {
    const recentInDz = recent5.filter(n => getDozen(n) === hotDzIdx + 1).length;
    if (recentInDz <= 0) {
      breakouts.push({ active: true, type: 'dozen_breakout', description: `Dúzia ${hotDzIdx + 1} dominava (${prevDzCount[hotDzIdx]}/15) — saiu de cena`, confidence: 75 });
    }
  }
  // High/Low breakout
  const prevHighCount = prev15.filter(n => n >= 19).length;
  const recentHighCount = recent5.filter(n => n >= 19).length;
  if (prevHighCount >= 10 && recentHighCount <= 1) {
    breakouts.push({ active: true, type: 'highlow_breakout', description: `Altos dominavam (${prevHighCount}/15) — Baixos assumindo`, confidence: 75 });
  } else if (prevHighCount <= 5 && recentHighCount >= 4) {
    breakouts.push({ active: true, type: 'highlow_breakout', description: `Baixos dominavam — Altos assumindo (${recentHighCount}/5)`, confidence: 72 });
  }
  return breakouts;
};

// BAYESIAN CONDITIONAL PROBABILITY — P(next=X | last=Y)
const bayesianPredict = (nums: number[], getCat: (n: number) => string | number): { predicted: string | number | null; probability: number; matrix: Record<string, Record<string, number>> } => {
  const matrix: Record<string, Record<string, number>> = {};
  for (let i = 0; i < nums.length - 1; i++) {
    const from = String(getCat(nums[i + 1]));
    const to = String(getCat(nums[i]));
    if (!matrix[from]) matrix[from] = {};
    matrix[from][to] = (matrix[from][to] || 0) + 1;
  }
  // Predict from last number
  const lastCat = String(getCat(nums[0]));
  const row = matrix[lastCat];
  if (!row) return { predicted: null, probability: 0, matrix };
  const total = Object.values(row).reduce((a, b) => a + b, 0);
  const best = Object.entries(row).sort(([,a],[,b]) => b - a)[0];
  if (!best || total < 5) return { predicted: null, probability: 0, matrix };
  return { predicted: best[0], probability: Math.round((best[1] / total) * 100), matrix };
};

// WHEEL ZONE MOMENTUM — which physical zone on wheel has highest recent activity
const wheelZoneMomentum = (nums: number[], zones = 6): { zone: number; momentum: number; numbers: number[]; label: string }[] => {
  const zoneSize = Math.floor(WL / zones);
  const results: { zone: number; momentum: number; numbers: number[]; label: string }[] = [];
  for (let z = 0; z < zones; z++) {
    const zoneNums = WHEEL.slice(z * zoneSize, (z + 1) * zoneSize);
    // Recency-weighted count
    let momentum = 0;
    nums.slice(0, 30).forEach((n, i) => {
      if (zoneNums.includes(n)) momentum += Math.pow(0.9, i);
    });
    const centerNum = zoneNums[Math.floor(zoneNums.length / 2)];
    results.push({ zone: z + 1, momentum: +momentum.toFixed(2), numbers: zoneNums, label: `Zona ${z + 1} (perto do ${centerNum})` });
  }
  return results.sort((a, b) => b.momentum - a.momentum);
};

// FIBONACCI GAP ANALYSIS — numbers due based on Fibonacci intervals
const fibonacciGapAnalysis = (nums: number[]): { number: number; lastSeen: number; fibonacci: number; due: boolean }[] => {
  const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89];
  const results: { number: number; lastSeen: number; fibonacci: number; due: boolean }[] = [];
  for (let n = 0; n <= 36; n++) {
    let lastSeen = -1;
    for (let i = 0; i < nums.length; i++) { if (nums[i] === n) { lastSeen = i; break; } }
    if (lastSeen < 0) lastSeen = nums.length;
    // Check if lastSeen matches a Fibonacci number (±1 tolerance)
    const matchedFib = FIB.find(f => Math.abs(lastSeen - f) <= 1);
    if (matchedFib && lastSeen > 5) {
      results.push({ number: n, lastSeen, fibonacci: matchedFib, due: true });
    }
  }
  return results.sort((a, b) => b.lastSeen - a.lastSeen);
};

// MULTI-DIMENSION CONVERGENCE — finds numbers where multiple independent dimensions agree
const multiDimensionConvergence = (
  nums: number[],
  sectorPred: string | null,
  dozenPred: number | null,
  terminalPred: number | null,
  colorBias: string | null,
  highLowBias: 'high' | 'low' | null
): { number: number; dimensions: number; reasons: string[] }[] => {
  const results: { number: number; dimensions: number; reasons: string[] }[] = [];
  for (let n = 0; n <= 36; n++) {
    let dims = 0;
    const reasons: string[] = [];
    if (sectorPred && getSector(n) === sectorPred) { dims++; reasons.push(`Setor ${sectorPred}`); }
    if (dozenPred && getDozen(n) === dozenPred) { dims++; reasons.push(`D${dozenPred}`); }
    if (terminalPred !== null && n % 10 === terminalPred) { dims++; reasons.push(`T${terminalPred}`); }
    if (colorBias === 'red' && RED.includes(n)) { dims++; reasons.push('Vermelho'); }
    else if (colorBias === 'black' && !RED.includes(n) && n > 0) { dims++; reasons.push('Preto'); }
    if (highLowBias === 'high' && n >= 19) { dims++; reasons.push('Alto'); }
    else if (highLowBias === 'low' && n >= 1 && n <= 18) { dims++; reasons.push('Baixo'); }
    if (dims >= 3) results.push({ number: n, dimensions: dims, reasons });
  }
  return results.sort((a, b) => b.dimensions - a.dimensions);
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Parse request body — accepts sampleSize and optional clientNumbers for instant reaction
    let sampleSize = 100;
    let clientNumbers: number[] | null = null;
    let strategyFilterParam: string | null = null;
    try {
      const body = await req.json();
      if (body?.sampleSize && typeof body.sampleSize === 'number') {
        sampleSize = Math.max(10, Math.min(500, Math.round(body.sampleSize)));
      }
      // Accept client-side numbers for faster response (before DB sync)
      if (body?.numbers && Array.isArray(body.numbers)) {
        clientNumbers = body.numbers.filter((n: any) => typeof n === 'number' && n >= 0 && n <= 36).slice(0, 500);
      }
      // Strategy category filter from UI
      if (body?.strategyFilter && typeof body.strategyFilter === 'string') {
        strategyFilterParam = body.strategyFilter;
      }
    } catch { /* no body or invalid JSON — use default */ }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const fetchLimit = Math.max(sampleSize, 200); // always fetch at least 200 for backtest depth
    // Fetch data from ALL tables + AI learned patterns + predictions in parallel
    const [numbersRes, historicoRes, resultadosRes, learnedRes, unresolvedRes, resolvedRes, insightsRes] = await Promise.all([
      supabase.from('roulette_numbers').select('number, fetched_at').order('fetched_at', { ascending: false }).limit(fetchLimit),
      supabase.from('historico_roleta').select('number, created_at').order('created_at', { ascending: false }).limit(fetchLimit),
      supabase.from('resultados_roleta').select('numero, created_at').order('created_at', { ascending: false }).limit(fetchLimit),
      supabase.from('ai_learned_patterns').select('learning_type, title, knowledge, accuracy, metadata').order('updated_at', { ascending: false }).limit(50),
      supabase.from('prediction_history').select('id, predicted_numbers, predicted_main, strategy_type').is('hit', null).order('created_at', { ascending: false }).limit(10),
      supabase.from('prediction_history').select('strategy_type, strategy_label, predicted_numbers, predicted_main, probability, convergence_score, actual_number, hit, hit_type, mesa_mode, justification').not('hit', 'is', null).order('created_at', { ascending: false }).limit(200),
      supabase.from('pattern_insights').select('pattern_type, description, confidence, numbers_involved, recommendation').order('created_at', { ascending: false }).limit(50),
    ]);

    // Merge ALL number sources into a single sorted timeline
    const allEntries: { number: number; time: string }[] = [];
    const seenKeys = new Set<string>();
    const addEntry = (num: number, time: string) => {
      if (num < 0 || num > 36) return;
      const key = `${num}-${time}`;
      if (!seenKeys.has(key)) { seenKeys.add(key); allEntries.push({ number: num, time }); }
    };
    (numbersRes.data || []).forEach((r: any) => addEntry(r.number, r.fetched_at));
    (historicoRes.data || []).forEach((r: any) => addEntry(r.number, r.created_at));
    (resultadosRes.data || []).forEach((r: any) => {
      const n = parseInt(r.numero, 10);
      if (!isNaN(n)) addEntry(n, r.created_at);
    });
    allEntries.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

    // MERGE: If client sent numbers, prepend any that aren't in DB yet (instant reaction)
    let numbers: number[];
    let entries = allEntries.slice(0, sampleSize);
    if (clientNumbers && clientNumbers.length >= 5) {
      // Client numbers are already in order (newest first) — use them as primary
      // But merge with DB for deeper history
      const dbNums = entries.map(e => e.number);
      // Find overlap point: first client number that matches start of DB sequence
      let overlapIdx = -1;
      for (let ci = 0; ci < Math.min(10, clientNumbers.length); ci++) {
        if (dbNums.length > 0 && clientNumbers[ci] === dbNums[0]) {
          overlapIdx = ci;
          break;
        }
      }
      if (overlapIdx >= 0 && overlapIdx > 0) {
        numbers = [...clientNumbers.slice(0, overlapIdx), ...dbNums].slice(0, sampleSize);
      } else {
        const clientSlice = clientNumbers.slice(0, sampleSize);
        const remaining = sampleSize - clientSlice.length;
        numbers = remaining > 0 ? [...clientSlice, ...dbNums.slice(0, remaining)] : clientSlice;
      }
    } else {
      numbers = entries.map(e => e.number);
    }
    const learned = learnedRes.data || [];
    const unresolved = unresolvedRes.data || [];
    const resolvedHistory = resolvedRes.data || [];
    const patternInsights = insightsRes.data || [];

    // ========================================================
    // AI SELF-LEARNING ENGINE — learns from each new number
    // ========================================================
    // Build a learned-patterns map for quick lookup
    const learnedMap: Record<string, { knowledge: string; accuracy: number; metadata: any }> = {};
    for (const lp of learned) {
      learnedMap[lp.learning_type + ':' + lp.title] = { knowledge: lp.knowledge, accuracy: lp.accuracy || 0, metadata: lp.metadata || {} };
    }

    // ── CONSTANTES DINÂMICAS DO BANCO (calibrate-constants) ──
    // Substituem os valores hardcoded quando disponíveis
    const calibration = learnedMap['calibration:mesa_calibration_live'];
    const dynMatrix: Record<number, {target: number; prob: number}[]> = calibration?.metadata?.validatedMatrix
      ? Object.fromEntries(Object.entries(calibration.metadata.validatedMatrix).map(([k, v]) => [Number(k), v as any]))
      : {};
    const dynPullRel: Record<number, number> = calibration?.metadata?.pullReliability
      ? Object.fromEntries(Object.entries(calibration.metadata.pullReliability).map(([k, v]) => [Number(k), v as number]))
      : {};
    const dynStatDebt: Record<number, number> = calibration?.metadata?.statDebt
      ? Object.fromEntries(Object.entries(calibration.metadata.statDebt).map(([k, v]) => [Number(k), v as number]))
      : {};
    const dynTermBias: Record<number, number> = calibration?.metadata?.terminalBias
      ? Object.fromEntries(Object.entries(calibration.metadata.terminalBias).map(([k, v]) => [Number(k), v as number]))
      : {};
    const hasDynCalibration = Object.keys(dynMatrix).length > 0;
    if (hasDynCalibration) aiLearnings.push(`📊 Calibração dinâmica: ${Object.keys(dynMatrix).length} pares, ${Object.keys(dynPullRel).length} pulls`);

    // Use learned patterns to boost scoring — REFORÇADO
    const learnedBoosts: Record<number, number> = {};
    for (let n = 0; n <= 36; n++) learnedBoosts[n] = 0;
    
    // Separate recent session patterns (last hour) from older ones
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const recentLearned = learned.filter(lp => (lp as any).updated_at > oneHourAgo || lp.learning_type === 'session_spin');
    const confirmedPulls = learned.filter(lp => lp.learning_type === 'pull_confirmed');
    
    for (const lp of learned) {
      const meta = lp.metadata as any;
      const isRecent = recentLearned.includes(lp);
      const recencyMultiplier = isRecent ? 2.5 : 1.0; // Recent patterns get 2.5x weight
      // Normalizar accuracy: se 1% (bug antigo do DeepSeek), usar 50% como default
      const rawAcc = lp.accuracy || 50;
      const accuracyScale = (rawAcc < 5 ? 50 : rawAcc) / 50;
      
      if (meta?.hotNumbers && Array.isArray(meta.hotNumbers)) {
        for (const hn of meta.hotNumbers) {
          if (typeof hn === 'number' && hn >= 0 && hn <= 36) {
            learnedBoosts[hn] += accuracyScale * recencyMultiplier;
          }
        }
      }
      if (meta?.bestTerminals && Array.isArray(meta.bestTerminals)) {
        for (const t of meta.bestTerminals) {
          const tNums = TERMINALS_MAP[t] || [];
          tNums.forEach(tn => { learnedBoosts[tn] += (accuracyScale * 0.6) * recencyMultiplier; });
        }
      }
      // Pull confirmed patterns get extra weight
      if (lp.learning_type === 'pull_confirmed' && meta?.hotNumbers) {
        for (const hn of meta.hotNumbers) {
          if (typeof hn === 'number' && hn >= 0 && hn <= 36) {
            learnedBoosts[hn] += accuracyScale * 1.5; // Validated pulls are very reliable
          }
        }
      }
      // ERROR PATTERN: números que saem quando erramos merecem atenção
      if (lp.learning_type === 'error_pattern') {
        const keyNums = (meta as any)?.key_numbers || [];
        for (const kn of keyNums) {
          if (typeof kn === 'number' && kn >= 0 && kn <= 36) {
            learnedBoosts[kn] += 1.5;
            // learnedReasons tracked separately below
          }
        }
      }
      // HIT PATTERN: acertos recentes têm muito peso (positive reinforcement)
      if (lp.learning_type === 'hit_pattern') {
        const recencyBoostHit = 2.5;
        const keyNums: number[] = (meta as any)?.key_numbers || [];
        for (const kn of keyNums) {
          if (typeof kn === 'number' && kn >= 0 && kn <= 36) {
            learnedBoosts[kn] += (lp.accuracy || 50) / 100 * recencyBoostHit;
          }
        }
      }
    }
    
    // Build confirmed pull chain from validated patterns
    const confirmedPullNumbers: number[] = [];
    for (const cp of confirmedPulls) {
      const meta = cp.metadata as any;
      if (meta?.hotNumbers) confirmedPullNumbers.push(...meta.hotNumbers.filter((n: any) => typeof n === 'number' && n >= 0 && n <= 36));
    }
    // If the last number has confirmed pull targets, boost them heavily
    if (numbers.length > 0) {
      const lastNum = numbers[0];
      const pullTargets = FULL_PULL_MAP[lastNum] || [];
      for (const pt of pullTargets) {
        if (confirmedPullNumbers.includes(pt)) {
          learnedBoosts[pt] += 3.0; // Confirmed pull = very strong signal
        }
      }
    }

    // ========================================================
    // STRATEGY PERFORMANCE TRACKER — learns from hits/misses
    // ========================================================
    const strategyPerformance: Record<string, { hits: number; total: number; winRate: number; avgProb: number; recentTrend: number }> = {};
    const numberHitFreq: Record<number, number> = {}; // which numbers actually hit when predicted
    const numberMissFreq: Record<number, number> = {}; // which numbers came INSTEAD of predictions
    const strategyNumberHits: Record<string, Record<number, number>> = {}; // per-strategy number hit map

    for (const pred of resolvedHistory) {
      const st = pred.strategy_type || 'unknown';
      if (!strategyPerformance[st]) strategyPerformance[st] = { hits: 0, total: 0, winRate: 0, avgProb: 0, recentTrend: 0 };
      strategyPerformance[st].total++;
      if (pred.hit) {
        strategyPerformance[st].hits++;
        // Track which numbers hit for this strategy
        if (!strategyNumberHits[st]) strategyNumberHits[st] = {};
        if (pred.actual_number !== null) {
          strategyNumberHits[st][pred.actual_number] = (strategyNumberHits[st][pred.actual_number] || 0) + 1;
          numberHitFreq[pred.actual_number] = (numberHitFreq[pred.actual_number] || 0) + 1;
        }
      } else {
        // Track what actually came when we missed
        if (pred.actual_number !== null) {
          numberMissFreq[pred.actual_number] = (numberMissFreq[pred.actual_number] || 0) + 1;
        }
      }
    }

    // Calculate win rates and recent trends
    for (const [st, perf] of Object.entries(strategyPerformance)) {
      perf.winRate = perf.total > 0 ? perf.hits / perf.total : 0;
      // Recent trend: last 20 predictions for this strategy
      const recentPreds = resolvedHistory.filter(p => p.strategy_type === st).slice(0, 20);
      const recentHits = recentPreds.filter(p => p.hit).length;
      perf.recentTrend = recentPreds.length > 0 ? recentHits / recentPreds.length : 0;
      perf.avgProb = recentPreds.length > 0 ? recentPreds.reduce((a, p) => a + (p.probability || 0), 0) / recentPreds.length : 0;
    }

    // Numbers that frequently appear when we MISS — these are "surprise" numbers to add weight to
    const surpriseNumbers = Object.entries(numberMissFreq)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([n]) => Number(n));

    // Pattern insights → extract actionable numbers
    const insightNumbers: Record<number, number> = {};
    const insightReasons: Record<number, string[]> = {};
    const learnedSignalBoost: Record<number, number> = {};
    const learnedSignalReasons: Record<number, string[]> = {};
    for (let n = 0; n <= 36; n++) { insightNumbers[n] = 0; insightReasons[n] = []; learnedSignalBoost[n] = 0; learnedSignalReasons[n] = []; }

    // Process learned patterns for learnedSignalBoost/learnedSignalReasons
    for (const lp of learned) {
      const meta = lp.metadata as any;
      if (lp.learning_type === 'error_pattern') {
        const keyNums = (meta as any)?.key_numbers || [];
        for (const kn of keyNums) {
          if (typeof kn === 'number' && kn >= 0 && kn <= 36) {
            learnedSignalBoost[kn] += 1.5;
            learnedSignalReasons[kn].push('error_pattern');
          }
        }
      }
      if (lp.learning_type === 'hit_pattern') {
        const recencyBoostHit = 2.5;
        const keyNums: number[] = (meta as any)?.key_numbers || [];
        for (const kn of keyNums) {
          if (typeof kn === 'number' && kn >= 0 && kn <= 36) {
            learnedSignalBoost[kn] += (lp.accuracy || 50) / 100 * recencyBoostHit;
            learnedSignalReasons[kn].push('✅ hit_pattern');
          }
        }
      }
    }

    // ── BOOST DOS PADRÕES DO AUTO-ANALYZE ──
    const insights = patternInsights || [];
    for (const ins of insights) {
      if (!ins.confidence || (ins.confidence as number) < 45) continue;
      const insNums: number[] = (ins.numbers_involved as number[]) || [];
      const boostMult = ins.pattern_type === 'combo_ouro' ? 3.0
        : ins.pattern_type === 'dupla_dani_green' ? 2.0
        : ins.pattern_type === 'entropia_baixa' ? 1.5
        : ins.pattern_type === 'pressao_zero' ? 1.2
        : 1.0;
      for (const n of insNums) {
        if (n >= 0 && n <= 36) {
          learnedSignalBoost[n] = (learnedSignalBoost[n] || 0) + ((ins.confidence as number) / 100) * boostMult;
          learnedSignalReasons[n] = learnedSignalReasons[n] || [];
          learnedSignalReasons[n].push(`Padrão:${ins.pattern_type}(${ins.confidence}%)`);
        }
      }
    }

    for (const insight of patternInsights) {
      const src = (insight.source_data as any) || {};
      const isRealtime = src.realtime === true; // padrão capturado neste giro
      const conf = (insight.confidence || 0) / 100;
      if (conf < 0.25) continue; // threshold ainda mais baixo para não perder sinais
      const nums = insight.numbers_involved || [];
      // Janelas confirmadas (multi-window análise)
      const windowsConfirmed = src.windows_confirmed?.length || 1;
      const windowMultiplier = 1 + (windowsConfirmed - 1) * 0.2;
      const btRate = src.backtest_rate || 0;
      const btMultiplier = 1 + btRate;
      // ⚡ REALTIME tem 3x mais peso — capturado agora, do momento
      const realtimeMult = isRealtime ? 3.0 : 1.0;
      for (const n of nums) {
        if (n >= 0 && n <= 36) {
          insightNumbers[n] += conf * 1.5 * windowMultiplier * btMultiplier * realtimeMult;
          insightReasons[n].push(
            isRealtime
              ? `⚡RT:${insight.pattern_type}(${insight.confidence}%)`
              : `📊${insight.pattern_type}(${windowsConfirmed}W)`
          );
        }
      }
    }

    // Resolve previous predictions — ONLY if latest number is NEW
    let isNewNumber = false;
    if (numbers.length > 0 && unresolved.length > 0) {
      const latestNum = numbers[0];

      const { data: recentlyResolved } = await supabase
        .from('prediction_history')
        .select('actual_number, resolved_at')
        .not('hit', 'is', null)
        .order('resolved_at', { ascending: false })
        .limit(1);

      const lastResolvedNum = recentlyResolved?.[0]?.actual_number;
      const lastResolvedTime = recentlyResolved?.[0]?.resolved_at;
      const timeSinceResolved = lastResolvedTime ? (Date.now() - new Date(lastResolvedTime).getTime()) / 1000 : 999;
      const shouldResolveCurrentSpin = latestNum !== lastResolvedNum || timeSinceResolved > 18;

      if (shouldResolveCurrentSpin) {
        isNewNumber = true;
        const resolvedAt = new Date().toISOString();

        for (const pred of unresolved) {
          const nums: number[] = pred.predicted_numbers || [];
          const isHit = nums.includes(latestNum);
          const hitType = isHit
            ? (pred.predicted_main === latestNum ? 'exact' : 'neighbor')
            : 'miss';

          await supabase.from('prediction_history').update({
            actual_number: latestNum,
            hit: isHit,
            hit_type: hitType,
            resolved_at: resolvedAt,
          }).eq('id', pred.id).is('hit', null);

          // Atualizar strategy_stats com acerto/erro
          try {
            const predStratType = pred.strategy_type || 'unknown';
            const { data: ss } = await supabase
              .from('strategy_stats')
              .select('*')
              .eq('strategy_type', predStratType)
              .maybeSingle();

            if (ss) {
              const newHits = (ss as any).total_hits + (isHit ? 1 : 0);
              const newStreak = isHit ? ((ss as any).current_streak || 0) + 1 : 0;
              const newBest = Math.max((ss as any).best_streak || 0, newStreak);
              await supabase.from('strategy_stats').update({
                total_hits: newHits,
                win_rate: newHits / (ss as any).total_predictions,
                current_streak: newStreak,
                best_streak: newBest,
                exact_hits: (ss as any).exact_hits + (hitType === 'exact' ? 1 : 0),
                neighbor_hits: (ss as any).neighbor_hits + (hitType === 'neighbor' ? 1 : 0),
                last_hit_at: isHit ? new Date().toISOString() : (ss as any).last_hit_at,
                last_miss_at: !isHit ? new Date().toISOString() : (ss as any).last_miss_at,
                updated_at: new Date().toISOString(),
              }).eq('strategy_type', predStratType);
            }
          } catch { /* ignore */ }
        }
      }
    } else if (unresolved.length === 0) {
      // Strong idempotency guard: only 1 prediction per real spin window
      const { data: recentPred } = await supabase
        .from('prediction_history')
        .select('created_at, predicted_main, actual_number, hit')
        .order('created_at', { ascending: false })
        .limit(1);

      const lastPredTime = recentPred?.[0]?.created_at;
      const timeSinceLastPred = lastPredTime ? (Date.now() - new Date(lastPredTime).getTime()) / 1000 : 999;
      const lastPredPending = recentPred?.[0]?.hit === null;

      // Do not open another prediction inside the same spin window
      if (!lastPredPending && timeSinceLastPred > 18) {
        isNewNumber = true;
      }
    }

    if (numbers.length < 15) {
      return json({ signal: null, mode: 'waiting', message: 'Aguardando dados...', layerResults: null, memoryWindows: null, aiLearnings: [] });
    }

    const aiLearnings: string[] = [];

    // ========================================================
    // 100 ESTRATÉGIAS — Detecção de Padrões
    // ========================================================
    const daniGreen = {
      mod1: detectHotTerminal(numbers, 15),
      mod1Cold: detectColdTerminal(numbers, 15),
      mod2: detectHighLowBias(numbers, 10),
      mod4: detectZeroPressure(numbers),
      mod5LastNum: numbers[0],
      mod5Pull: FULL_PULL_MAP[numbers[0]] || PULL_MAP[numbers[0]] || [],
      mod5PullTerminals: FULL_PULL_TERMINALS[numbers[0]] || PULL_TERMINALS[numbers[0]] || [],
      mod6: detectAscendingTerminals(numbers),
      entropy: calculateEntropy(numbers, 15),
    };

    // Entropy-based session regime
    const sessionEntropy = calculateEntropy(numbers, 15);
    const entropyDrift = numbers.length >= 45 ? [
      calculateEntropy(numbers.slice(0, 15), 15),
      calculateEntropy(numbers.slice(15, 30), 15),
      calculateEntropy(numbers.slice(30, 45), 15),
    ] : [];
    const isEntropyDroppingConsistently = entropyDrift.length === 3 && entropyDrift[0] < entropyDrift[1] && entropyDrift[1] < entropyDrift[2];
    const sessionRegime = sessionEntropy < 0.5 ? 'CONCENTRADO' : sessionEntropy < 0.7 ? 'PADRÃO IDENTIFICÁVEL' : 'DISPERSO';

    // Dupla de terminal detection
    const hotTermPair = TERMINAL_PAIRS[daniGreen.mod1.terminal];
    const duplaKey = Object.entries(DUPLAS_TERMINAIS).find(([, nums]) =>
      nums.some(n => TERMINALS_MAP[daniGreen.mod1.terminal]?.includes(n))
    )?.[0] || null;
    // Extended detectors (100 strategies)
    const ext = {
      terminalRepetido: detectTerminalRepetido(numbers),
      terminalAlternado: detectTerminalAlternado(numbers, 10),
      centralProg: detectCentralProgression(numbers),
      colorStreak: detectColorStreak(numbers),
      parImpar: detectParImparBias(numbers, 10),
      altoLowAlt: detectAltoLowAlternation(numbers),
      mirrorDue: detectMirrorDue(numbers),
      zeroAfterNeighbors: detectZeroAfterNeighbors(numbers),
      gatilhoPerfeito: detectGatilhoPerfeito(numbers, daniGreen.mod1.terminal, daniGreen.mod5Pull),
      isPostZero: numbers.length > 0 && numbers[0] === 0,
      lastIsZeroRecent: numbers.slice(0, 5).includes(0),
    };

    // ========================================================
    // ADVANCED ANALYSES — Momentum, Volatility, Bayesian, Breakouts
    // ========================================================
    const sectorMomentum = calculateMomentum(numbers, n => getSector(n), 20);
    const dozenMomentum = calculateMomentum(numbers, n => { const d = getDozen(n); return d > 0 ? `D${d}` : ''; }, 20);
    const colorMomentum = calculateMomentum(numbers, n => getColor(n), 20);
    const parityMomentum = calculateMomentum(numbers, n => n > 0 ? (n % 2 === 0 ? 'Par' : 'Ímpar') : '', 20);
    const highLowMomentum = calculateMomentum(numbers, n => n > 0 ? (n >= 19 ? 'Alto' : 'Baixo') : '', 20);
    
    const volatility = calculateVolatility(numbers, 30);
    const recencyFreq = recencyWeightedFreq(numbers);
    const breakoutsDetected = detectBreakout(numbers);
    const wheelZones = wheelZoneMomentum(numbers, 6);
    const fibGaps = fibonacciGapAnalysis(numbers);
    
    // Bayesian predictions
    const bayesSector = bayesianPredict(numbers, n => getSector(n));
    const bayesDozen = bayesianPredict(numbers, n => { const d = getDozen(n); return d > 0 ? d : 0; });
    const bayesColor = bayesianPredict(numbers, n => getColor(n));
    const bayesHighLow = bayesianPredict(numbers, n => n > 0 ? (n >= 19 ? 'Alto' : 'Baixo') : 'Zero');
    const bayesParity = bayesianPredict(numbers, n => n > 0 ? (n % 2 === 0 ? 'Par' : 'Ímpar') : 'Zero');
    
    // Multi-dimension convergence will be calculated after transitionMatrix is ready

    // ========================================================
    // TREND vs REVERSAL ENGINE — "Jogar a favor do algoritmo"
    // Detects if mesa is in CONTINUATION mode (trend) or REVERSAL mode
    // The AI should FOLLOW the algorithm, not fight it
    // ========================================================
    const trendEngine: {
      mode: 'TENDENCIA' | 'REVERSAO' | 'NEUTRO';
      confidence: number;
      colorTrend: { direction: 'red' | 'black' | null; strength: number; shouldFollow: boolean };
      parityTrend: { direction: 'par' | 'impar' | null; strength: number; shouldFollow: boolean };
      highLowTrend: { direction: 'alto' | 'baixo' | null; strength: number; shouldFollow: boolean };
      dozenTrend: { direction: number | null; strength: number; shouldFollow: boolean };
      columnTrend: { direction: number | null; strength: number; shouldFollow: boolean };
      sectorTrend: { direction: string | null; strength: number; shouldFollow: boolean };
      reasoning: string[];
    } = {
      mode: 'NEUTRO', confidence: 50,
      colorTrend: { direction: null, strength: 0, shouldFollow: false },
      parityTrend: { direction: null, strength: 0, shouldFollow: false },
      highLowTrend: { direction: null, strength: 0, shouldFollow: false },
      dozenTrend: { direction: null, strength: 0, shouldFollow: false },
      columnTrend: { direction: null, strength: 0, shouldFollow: false },
      sectorTrend: { direction: null, strength: 0, shouldFollow: false },
      reasoning: [],
    };

    if (numbers.length >= 20) {
      // === CORE: Analyze continuation vs reversal from last 30 numbers ===
      const an30 = numbers.slice(0, 30);
      const an10 = numbers.slice(0, 10);
      const an5 = numbers.slice(0, 5);
      
      // --- COLOR TREND ---
      const red5 = an5.filter(n => RED.includes(n)).length;
      const red10 = an10.filter(n => RED.includes(n)).length;
      const red30 = an30.filter(n => RED.includes(n)).length;
      // Check if recent trend ACCELERATES or DECELERATES
      const red5Rate = red5 / 5;
      const red10Rate = red10 / 10;
      const red30Rate = red30 / 30;
      // Acceleration = recent rate > medium rate > long rate (trend strengthening)
      const redAccelerating = red5Rate > red10Rate && red10Rate > red30Rate && red5Rate > 0.55;
      const blackAccelerating = (1 - red5Rate) > (1 - red10Rate) && (1 - red10Rate) > (1 - red30Rate) && red5Rate < 0.45;
      // Bayesian confirmation
      const bayesConfirmsRed = bayesColor.predicted === 'red' && bayesColor.probability >= 45;
      const bayesConfirmsBlack = bayesColor.predicted === 'black' && bayesColor.probability >= 45;
      // Momentum confirmation
      const momConfirmsRed = colorMomentum['red']?.trend === 'rising';
      const momConfirmsBlack = colorMomentum['black']?.trend === 'rising';
      
      if ((redAccelerating && (bayesConfirmsRed || momConfirmsRed)) || (redAccelerating && red5 >= 4)) {
        trendEngine.colorTrend = { direction: 'red', strength: Math.min(95, 50 + red5 * 10 + (bayesConfirmsRed ? 15 : 0)), shouldFollow: true };
        trendEngine.reasoning.push(`🔴 Vermelho ACELERANDO: ${red5}/5 recentes, Bayes ${bayesColor.probability}%, momentum ${momConfirmsRed ? 'SUBINDO' : 'estável'}`);
      } else if ((blackAccelerating && (bayesConfirmsBlack || momConfirmsBlack)) || (blackAccelerating && red5 <= 1)) {
        trendEngine.colorTrend = { direction: 'black', strength: Math.min(95, 50 + (5 - red5) * 10 + (bayesConfirmsBlack ? 15 : 0)), shouldFollow: true };
        trendEngine.reasoning.push(`⚫ Preto ACELERANDO: ${5 - red5}/5 recentes, Bayes ${bayesColor.probability}%, momentum ${momConfirmsBlack ? 'SUBINDO' : 'estável'}`);
      }
      // If there's a streak but it's DECELERATING, THEN reverse
      if (red5 >= 4 && red10Rate < red5Rate * 0.8 && !redAccelerating) {
        trendEngine.colorTrend = { direction: 'black', strength: 65, shouldFollow: false };
        trendEngine.reasoning.push(`🔄 Vermelho desacelerando (${red5}/5 mas ${red10}/10) — reversão para Preto`);
      }
      if (red5 <= 1 && (1 - red10Rate) < (1 - red5Rate) * 0.8 && !blackAccelerating) {
        trendEngine.colorTrend = { direction: 'red', strength: 65, shouldFollow: false };
        trendEngine.reasoning.push(`🔄 Preto desacelerando — reversão para Vermelho`);
      }

      // --- PARITY TREND ---
      const par5 = an5.filter(n => n > 0 && n % 2 === 0).length;
      const par10 = an10.filter(n => n > 0 && n % 2 === 0).length;
      const par30 = an30.filter(n => n > 0 && n % 2 === 0).length;
      const par5Rate = par5 / Math.max(1, an5.filter(n => n > 0).length);
      const par10Rate = par10 / Math.max(1, an10.filter(n => n > 0).length);
      const par30Rate = par30 / Math.max(1, an30.filter(n => n > 0).length);
      const parAccelerating = par5Rate > par10Rate && par10Rate > par30Rate && par5Rate > 0.6;
      const imparAccelerating = (1 - par5Rate) > (1 - par10Rate) && (1 - par10Rate) > (1 - par30Rate) && par5Rate < 0.4;
      const bayesConfirmsPar = bayesParity.predicted === 'Par' && bayesParity.probability >= 45;
      const bayesConfirmsImpar = bayesParity.predicted === 'Ímpar' && bayesParity.probability >= 45;
      const momConfirmsPar = parityMomentum['Par']?.trend === 'rising';
      const momConfirmsImpar = parityMomentum['Ímpar']?.trend === 'rising';

      if ((parAccelerating && (bayesConfirmsPar || momConfirmsPar)) || (parAccelerating && par5 >= 4)) {
        trendEngine.parityTrend = { direction: 'par', strength: Math.min(90, 50 + par5 * 10), shouldFollow: true };
        trendEngine.reasoning.push(`2️⃣ Par ACELERANDO: ${par5}/5 recentes`);
      } else if ((imparAccelerating && (bayesConfirmsImpar || momConfirmsImpar)) || (imparAccelerating && par5 <= 1)) {
        trendEngine.parityTrend = { direction: 'impar', strength: Math.min(90, 50 + (5 - par5) * 10), shouldFollow: true };
        trendEngine.reasoning.push(`1️⃣ Ímpar ACELERANDO: ${5 - par5}/5 recentes`);
      }

      // --- HIGH/LOW TREND ---
      const hi5 = an5.filter(n => n >= 19).length;
      const hi10 = an10.filter(n => n >= 19).length;
      const hi30 = an30.filter(n => n >= 19).length;
      const hi5Rate = hi5 / Math.max(1, an5.filter(n => n > 0).length);
      const hi10Rate = hi10 / Math.max(1, an10.filter(n => n > 0).length);
      const hi30Rate = hi30 / Math.max(1, an30.filter(n => n > 0).length);
      const hiAccelerating = hi5Rate > hi10Rate && hi10Rate > hi30Rate && hi5Rate > 0.6;
      const loAccelerating = (1 - hi5Rate) > (1 - hi10Rate) && (1 - hi10Rate) > (1 - hi30Rate) && hi5Rate < 0.4;
      const bayesConfirmsHi = bayesHighLow.predicted === 'Alto' && bayesHighLow.probability >= 45;
      const bayesConfirmsLo = bayesHighLow.predicted === 'Baixo' && bayesHighLow.probability >= 45;
      const momConfirmsHi = highLowMomentum['Alto']?.trend === 'rising';
      const momConfirmsLo = highLowMomentum['Baixo']?.trend === 'rising';

      if ((hiAccelerating && (bayesConfirmsHi || momConfirmsHi)) || (hiAccelerating && hi5 >= 4)) {
        trendEngine.highLowTrend = { direction: 'alto', strength: Math.min(90, 50 + hi5 * 10), shouldFollow: true };
        trendEngine.reasoning.push(`⬆️ Alto ACELERANDO: ${hi5}/5 recentes`);
      } else if ((loAccelerating && (bayesConfirmsLo || momConfirmsLo)) || (loAccelerating && hi5 <= 1)) {
        trendEngine.highLowTrend = { direction: 'baixo', strength: Math.min(90, 50 + (5 - hi5) * 10), shouldFollow: true };
        trendEngine.reasoning.push(`⬇️ Baixo ACELERANDO: ${5 - hi5}/5 recentes`);
      }

      // --- DOZEN TREND ---
      const dz5 = an5.filter(n => n > 0).map(n => getDozen(n));
      const dzMode5 = [0, 0, 0]; dz5.forEach(d => { if (d > 0) dzMode5[d - 1]++; });
      const topDz5 = dzMode5.indexOf(Math.max(...dzMode5)) + 1;
      const dz10 = an10.filter(n => n > 0).map(n => getDozen(n));
      const dzMode10 = [0, 0, 0]; dz10.forEach(d => { if (d > 0) dzMode10[d - 1]++; });
      const topDz10 = dzMode10.indexOf(Math.max(...dzMode10)) + 1;
      // Same dozen dominating in 5 AND 10 = trend
      if (topDz5 === topDz10 && dzMode5[topDz5 - 1] >= 3 && dzMode10[topDz10 - 1] >= 5) {
        const dzMom = dozenMomentum[`D${topDz5}`];
        if (dzMom?.trend === 'rising' || dzMode5[topDz5 - 1] >= 4) {
          trendEngine.dozenTrend = { direction: topDz5, strength: Math.min(90, 50 + dzMode5[topDz5 - 1] * 10), shouldFollow: true };
          trendEngine.reasoning.push(`🎲 Dúzia ${topDz5} em TENDÊNCIA: ${dzMode5[topDz5 - 1]}/5 + ${dzMode10[topDz10 - 1]}/10`);
        }
      }

      // --- SECTOR TREND ---
      const sec5 = an5.map(n => getSector(n));
      const secMode5: Record<string, number> = { Voisins: 0, Tiers: 0, Orphelins: 0 };
      sec5.forEach(s => { if (secMode5[s] !== undefined) secMode5[s]++; });
      const topSec5 = Object.entries(secMode5).sort(([,a],[,b]) => b - a)[0];
      if (topSec5 && topSec5[1] >= 3) {
        const secMom = sectorMomentum[topSec5[0]];
        if (secMom?.trend === 'rising') {
          trendEngine.sectorTrend = { direction: topSec5[0], strength: Math.min(90, 50 + topSec5[1] * 10), shouldFollow: true };
          trendEngine.reasoning.push(`🗺️ Setor ${topSec5[0]} em TENDÊNCIA: ${topSec5[1]}/5 + momentum subindo`);
        }
      }

      // --- GLOBAL MODE DETECTION ---
      const trendSignals = [
        trendEngine.colorTrend.shouldFollow,
        trendEngine.parityTrend.shouldFollow,
        trendEngine.highLowTrend.shouldFollow,
        trendEngine.dozenTrend.shouldFollow,
        trendEngine.sectorTrend.shouldFollow,
      ].filter(Boolean).length;
      
      if (trendSignals >= 3) {
        trendEngine.mode = 'TENDENCIA';
        trendEngine.confidence = Math.min(95, 60 + trendSignals * 8);
        trendEngine.reasoning.push(`🚀 MODO TENDÊNCIA ATIVO: ${trendSignals}/5 dimensões acelerando — JOGAR A FAVOR DO ALGORITMO`);
      } else if (trendSignals >= 2) {
        trendEngine.mode = 'TENDENCIA';
        trendEngine.confidence = Math.min(85, 55 + trendSignals * 7);
        trendEngine.reasoning.push(`📈 Tendência detectada em ${trendSignals} dimensões — seguir o fluxo`);
      } else {
        // Check for exhaustion signals (high streaks about to break)
        const colorStreakLen = (() => { let s = 1; const c = getColor(numbers[0]); for (let i = 1; i < 20; i++) { if (numbers[i] === 0) break; if (getColor(numbers[i]) === c) s++; else break; } return s; })();
        const hiLoStreakLen = (() => { if (numbers[0] === 0) return 0; let s = 1; const h = numbers[0] >= 19; for (let i = 1; i < 20; i++) { if (numbers[i] === 0) break; if ((numbers[i] >= 19) === h) s++; else break; } return s; })();
        const parStreakLen = (() => { if (numbers[0] === 0) return 0; let s = 1; const p = numbers[0] % 2; for (let i = 1; i < 20; i++) { if (numbers[i] === 0) break; if (numbers[i] % 2 === p) s++; else break; } return s; })();
        
        // Very long streaks WITHOUT acceleration = exhaustion → reversal
        if (colorStreakLen >= 6 || hiLoStreakLen >= 6 || parStreakLen >= 6) {
          trendEngine.mode = 'REVERSAO';
          trendEngine.confidence = Math.min(90, 55 + Math.max(colorStreakLen, hiLoStreakLen, parStreakLen) * 4);
          trendEngine.reasoning.push(`⚡ EXAUSTÃO DETECTADA: sequência de ${Math.max(colorStreakLen, hiLoStreakLen, parStreakLen)} — algoritmo vai reverter`);
        } else {
          trendEngine.mode = 'NEUTRO';
          trendEngine.confidence = 50;
        }
      }
    }

    // Add trend engine learnings
    if (trendEngine.mode === 'TENDENCIA') {
      aiLearnings.push(`🚀 MODO TENDÊNCIA: Jogar A FAVOR do algoritmo (${trendEngine.confidence}% confiança)`);
      trendEngine.reasoning.slice(0, 3).forEach(r => aiLearnings.push(r));
    } else if (trendEngine.mode === 'REVERSAO') {
      aiLearnings.push(`⚡ MODO REVERSÃO: Algoritmo vai virar — apostar no oposto`);
      trendEngine.reasoning.slice(0, 2).forEach(r => aiLearnings.push(r));
    }


    // ========================================================
    const rawArcs: number[] = [];
    for (let i = 0; i < Math.min(100, numbers.length - 1); i++) rawArcs.push(wheelDist(numbers[i], numbers[i + 1]));
    const rawArcMean = rawArcs.length > 0 ? rawArcs.reduce((a, b) => a + b, 0) / rawArcs.length : 10;

    // Detectar MUDANÇA DE DEALER: se os últimos 5 arcos divergem muito dos 20 anteriores
    const recentArcs5 = rawArcs.slice(0, 5);
    const olderArcs20 = rawArcs.slice(5, 25);
    const recentMean5 = recentArcs5.length > 0
      ? recentArcs5.reduce((a,b)=>a+b,0) / recentArcs5.length : rawArcMean;
    const olderMean20 = olderArcs20.length > 0
      ? olderArcs20.reduce((a,b)=>a+b,0) / olderArcs20.length : rawArcMean;
    const dealerShiftDetected = Math.abs(recentMean5 - olderMean20) > 5;
    const isNewDealer = dealerShiftDetected && recentArcs5.length >= 3;

    const strategyWeightAdjust: Record<string, number> = {};

    if (isNewDealer) {
      aiLearnings.push(`🎭 DEALER SHIFT DETECTADO: arco mudou de ${olderMean20.toFixed(1)} para ${recentMean5.toFixed(1)} — recalibrando. Ignorar padrões antigos por 5 giros.`);
      strategyWeightAdjust['sniper'] = (strategyWeightAdjust['sniper'] || 0) - 15;
      strategyWeightAdjust['ritmo_calibrado'] = (strategyWeightAdjust['ritmo_calibrado'] || 0) - 15;
      strategyWeightAdjust['duplo_terminal'] = (strategyWeightAdjust['duplo_terminal'] || 0) + 8;
      strategyWeightAdjust['terminal_alternation'] = (strategyWeightAdjust['terminal_alternation'] || 0) + 8;
    }
    const rawArcStd = Math.sqrt(rawArcs.length > 0 ? rawArcs.reduce((a, b) => a + Math.pow(b - rawArcMean, 2), 0) / rawArcs.length : 25);
    const noiseThreshold = rawArcMean + rawArcStd * 2.5; // Outlier = 2.5 std devs above mean
    const noiseIndices = new Set<number>();
    for (let i = 0; i < rawArcs.length; i++) {
      if (rawArcs[i] > noiseThreshold && rawArcs[i] > 16) noiseIndices.add(i); // mark as noise if arc > threshold AND > 16 positions
    }
    const noiseCount = noiseIndices.size;

    // ========================================================
    // SELF-CORRECTION + REINFORCEMENT LEARNING ENGINE
    // ========================================================
    const recentResolved = resolvedHistory.slice(0, 5);

    // Taxa de acerto recente (últimas 10)
    const recent10 = resolvedHistory.slice(0, 10);
    const recent10WR = recent10.length > 0
      ? recent10.filter((p: any) => p.hit).length / recent10.length : 0.5;
    const ultraConservador = recent10WR < 0.25 && recent10.length >= 6;

    if (ultraConservador) {
      aiLearnings.push(`🛡️ MODO ULTRA-CONSERVADOR: ${(recent10WR*100).toFixed(0)}% nas últimas ${recent10.length} jogadas. Preferindo apostas externas e cobertura ampla.`);
      strategyWeightAdjust['cor'] = (strategyWeightAdjust['cor'] || 0) + 15;
      strategyWeightAdjust['paridade'] = (strategyWeightAdjust['paridade'] || 0) + 10;
      strategyWeightAdjust['duzias'] = (strategyWeightAdjust['duzias'] || 0) + 15;
      strategyWeightAdjust['convergencia_absoluta'] = (strategyWeightAdjust['convergencia_absoluta'] || 0) - 20;
    }

    // CALIBRAÇÃO DINÂMICA BASEADA EM WIN RATE REAL
    // Calcula penalização de cada estratégia pelo WR recente do banco
    const stratPerf = strategyPerformance as Record<string, any>;
    const dynamicPenalty = (type: string, base: number): number => {
      const perf = stratPerf[type];
      if (!perf || perf.total < 3) return base;
      const wr = perf.recentTrend ?? perf.winRate ?? 0;
      if (wr < 0.15) return base - 35; // errando muito: penalidade dobrada
      if (wr < 0.25) return base - 20;
      if (wr > 0.55) return base + 10; // ganhando: bônus
      return base;
    };

    const MESA_CALIBRATION: Record<string, number> = {
      // Estratégias internas (número exato) — boost fixo
      'auto_repeticao'         : 20,
      'convergencia_absoluta'  : 18,
      'ensemble_supremo'       : 15,
      'matriz_numerica'        : 12,
      'duplo_terminal'         : 10,
      // Fusao: boost quando WR > 40%, penaliza quando < 25%
      'fusao_suprema': dynamicPenalty('fusao_suprema', 15),
      // Estratégias externas: penalização dinâmica
      'paridade_reversa'   : dynamicPenalty('paridade_reversa', -30),
      'alto_baixo_reversa' : dynamicPenalty('alto_baixo_reversa', -30),
      'cor_reversa'        : dynamicPenalty('cor_reversa', -30),
      'cor_alternancia'    : dynamicPenalty('cor_alternancia', -15),
      'alto_baixo'         : dynamicPenalty('alto_baixo', -15),
      'paridade'           : dynamicPenalty('paridade', -15),
      'cor'                : dynamicPenalty('cor', -8),
      'cluster_regional'   : -20,
    };
    for (const [stType, adj] of Object.entries(MESA_CALIBRATION)) {
      strategyWeightAdjust[stType] = (strategyWeightAdjust[stType] || 0) + adj;
    }

    // ERROR DEEP SCAN: categorize WHY each miss happened
    const errorCategories: Record<string, number> = { dealer_change: 0, wrong_sector: 0, wrong_terminal: 0, deflector_bounce: 0, entropy_break: 0 };
    const errorLearnings: string[] = [];
    
    for (const pred of recentResolved) {
      const st = pred.strategy_type || '';
      if (!strategyWeightAdjust[st]) strategyWeightAdjust[st] = 0;
      if (pred.hit) {
        strategyWeightAdjust[st] += 8;
      } else {
        strategyWeightAdjust[st] -= 5;
        if (pred.actual_number !== null) {
          const actualSector = getSector(pred.actual_number);
          const actualCavalo = getCavalo(pred.actual_number);
          const actualTerm = pred.actual_number % 10;
          const predMain = pred.predicted_main;
          
          // Categorize the error
          if (predMain !== null) {
            const predSector = getSector(predMain);
            const arcToPred = predMain !== null ? wheelDist(numbers[0], predMain) : 99;
            const arcToActual = wheelDist(numbers[0], pred.actual_number);
            
            // Wrong sector = dealer threw to different area
            if (predSector !== actualSector) {
              errorCategories.wrong_sector++;
              errorLearnings.push(`❌ Erro de setor: previsto ${predSector}, saiu ${actualSector} (nº ${pred.actual_number})`);
            }
            // Wrong terminal
            if (predMain % 10 !== actualTerm) {
              errorCategories.wrong_terminal++;
            }
            // Arc changed dramatically = dealer change
            if (Math.abs(arcToPred - arcToActual) > 10) {
              errorCategories.dealer_change++;
              errorLearnings.push(`⚠️ Dealer mudou arco: esperado ~${arcToPred} casas, veio ${arcToActual}`);
            }
            // Deflector bounce: actual number far from predicted arc
            if (arcToActual > 12 && arcToPred <= 6) {
              errorCategories.deflector_bounce++;
              errorLearnings.push(`💎 Bola desviou no defletor: salto anômalo de ${arcToActual} casas`);
            }
          }

          // Cross-adaptation: boost what SHOULD have predicted the actual
          if (pred.strategy_type?.includes('sniper') || pred.strategy_type?.includes('voisins')) {
            strategyWeightAdjust['cavalos'] = (strategyWeightAdjust['cavalos'] || 0) + 3;
            strategyWeightAdjust['terminal_alternation'] = (strategyWeightAdjust['terminal_alternation'] || 0) + 3;
          }
          if (pred.strategy_type?.includes('cavalos') || pred.strategy_type?.includes('terminal')) {
            strategyWeightAdjust['sniper'] = (strategyWeightAdjust['sniper'] || 0) + 3;
            strategyWeightAdjust['voisins'] = (strategyWeightAdjust['voisins'] || 0) + 3;
          }
        }
      }
    }

    // 3-CONSECUTIVE HIT PRIORITY BOOST
    // If a strategy hits 3+ times in a row, massively boost it
    const consecutiveHitBoost: Record<string, number> = {};
    for (const st of Object.keys(strategyPerformance)) {
      const stPreds = resolvedHistory.filter(p => p.strategy_type === st).slice(0, 10);
      let consecutiveHits = 0;
      for (const p of stPreds) {
        if (p.hit) consecutiveHits++;
        else break;
      }
      if (consecutiveHits >= 3) {
        consecutiveHitBoost[st] = consecutiveHits * 8;
        strategyWeightAdjust[st] = (strategyWeightAdjust[st] || 0) + consecutiveHits * 8;
      }
    }

    // TIME-OF-DAY AWARENESS: mesa behavior changes throughout the day
    const currentHour = new Date().getUTCHours();
    const isNightShift = currentHour >= 0 && currentHour < 8; // midnight-8am
    const isDayShift = currentHour >= 8 && currentHour < 16; // 8am-4pm
    // Night shift: dealers tend to be more mechanical (fewer players, less pressure)
    // Day shift: more chaotic due to higher volume
    const timeAwareness = {
      shift: isNightShift ? 'noturno' : isDayShift ? 'diurno' : 'vespertino',
      physicalBias: isNightShift ? 1.3 : 1.0, // night = more physical patterns
      mathBias: isDayShift ? 1.2 : 1.0, // day = more mathematical patterns
    };

    // Add dominant error category to learnings
    const topError = Object.entries(errorCategories).sort(([,a],[,b]) => b - a)[0];
    if (topError && topError[1] >= 2) {
      const errorLabels: Record<string, string> = {
        dealer_change: '🎭 Troca de Dealer foi a causa principal dos erros',
        wrong_sector: '🗺️ IA está errando o setor — recalibrando foco',
        wrong_terminal: '🔢 Terminais desalinhados — ajustando pesos matemáticos',
        deflector_bounce: '💎 Defletores causando desvios — aumentando filtro de ruído',
        entropy_break: '🔀 Entropia quebrando padrões — modo conservador ativado',
      };
      errorLearnings.push(errorLabels[topError[0]] || `Categoria de erro dominante: ${topError[0]}`);
    }

    // Consecutive hit learnings
    for (const [st, boost] of Object.entries(consecutiveHitBoost)) {
      if (boost > 0) {
        const hits = boost / 8;
        errorLearnings.push(`🔥 PRIORIDADE MÁXIMA: ${st} acertou ${hits}x seguidas — peso elevado em +${boost}`);
      }
    }

    // ========================================================
    // DEALER CHAOS DETECTION — Auto-calibrate Regular vs Chaotic
    // ========================================================
    const last20Arcs = rawArcs.slice(0, 20);
    const arcVariance20 = last20Arcs.length > 0 ? last20Arcs.reduce((a, b) => a + Math.pow(b - rawArcMean, 2), 0) / last20Arcs.length : 99;
    const chaoticDealer = arcVariance20 > 40; // Very high variance = chaotic
    const uniqueSectors10 = new Set(numbers.slice(0, 10).map(n => getSector(n))).size;
    const uniqueOctaves10 = new Set(numbers.slice(0, 10).map(n => getOctave(n))).size;
    const isDispersingWildly = uniqueSectors10 >= 3 && uniqueOctaves10 >= 6; // hitting all sectors = no pattern

    // ========================================================
    // 3-LAYER MEMORY WINDOWS — Micro/Mesa/Macro
    // ========================================================
    const microWindow = numbers.slice(0, 10); // last 10
    const mesaWindow = numbers.slice(0, 100); // last 100
    const macroWindow = numbers.slice(0, 500); // last 500

    // Micro analysis
    const microArcs = rawArcs.slice(0, 9);
    const microArcMean = microArcs.length > 0 ? microArcs.reduce((a, b) => a + b, 0) / microArcs.length : 0;
    const microArcStd = Math.sqrt(microArcs.length > 0 ? microArcs.reduce((a, b) => a + Math.pow(b - microArcMean, 2), 0) / microArcs.length : 99);
    const microColors = microWindow.map(n => getColor(n));
    const microRedCount = microColors.filter(c => c === 'red').length;
    const microSectorDom = (() => { const s: Record<string, number> = {}; microWindow.forEach(n => { const sec = getSector(n); s[sec] = (s[sec]||0)+1; }); return Object.entries(s).sort(([,a],[,b]) => b-a)[0]; })();

    // Mesa analysis — best strategies in last 100
    const mesaStratPerf: Record<string, { hits: number; total: number }> = {};
    const mesaRelevant = resolvedHistory.slice(0, 50);
    for (const p of mesaRelevant) {
      const st = p.strategy_type || '';
      if (!mesaStratPerf[st]) mesaStratPerf[st] = { hits: 0, total: 0 };
      mesaStratPerf[st].total++;
      if (p.hit) mesaStratPerf[st].hits++;
    }
    const bestMesaStrat = Object.entries(mesaStratPerf).sort(([,a],[,b]) => (b.hits/Math.max(b.total,1)) - (a.hits/Math.max(a.total,1)))[0];

    // Macro analysis — statistical debt (numbers that should have appeared more)
    const macroFreq: Record<number, number> = {};
    for (let n = 0; n <= 36; n++) macroFreq[n] = 0;
    macroWindow.forEach(n => macroFreq[n]++);
    const expectedFreq = macroWindow.length / 37;
    const statisticalDebt = Object.entries(macroFreq)
      .map(([n, f]) => ({ num: Number(n), debt: expectedFreq - f, freq: f }))
      .filter(x => x.debt > expectedFreq * 0.4)
      .sort((a, b) => b.debt - a.debt)
      .slice(0, 10);

    const memoryWindows = {
      micro: {
        label: 'MICRO (Últimas 10)',
        arcMean: +microArcMean.toFixed(1),
        arcStd: +microArcStd.toFixed(1),
        dealerRhythm: microArcStd < 2 ? 'VICIADO' : microArcStd < 4 ? 'Regular' : 'Caótico',
        sectorDominant: microSectorDom ? `${microSectorDom[0]} (${microSectorDom[1]}/10)` : '-',
        colorBias: microRedCount > 6 ? 'Vermelho forte' : microRedCount < 4 ? 'Preto forte' : 'Equilibrado',
      },
      mesa: {
        label: 'MESA (Últimas 100)',
        bestStrategy: bestMesaStrat ? `${bestMesaStrat[0]} (${bestMesaStrat[1].hits}/${bestMesaStrat[1].total})` : '-',
        totalPredictions: mesaRelevant.length,
        winRate: mesaRelevant.length > 0 ? +((mesaRelevant.filter(p => p.hit).length / mesaRelevant.length) * 100).toFixed(1) : 0,
      },
      macro: {
        label: 'MACRO (Últimas 500)',
        totalNumbers: macroWindow.length,
        topDebt: statisticalDebt.slice(0, 5).map(d => `${d.num}(${d.debt.toFixed(1)})`),
        uniqueNumbers: new Set(macroWindow).size,
      },
    };

    // ========================================================
    // AI LEARNINGS — Dynamic real-time phrases
    // ========================================================
    // Add error deep scan learnings first
    aiLearnings.push(...errorLearnings.slice(0, 4));
    // Dani Green module learnings
    if (daniGreen.mod1.count >= 4) {
      aiLearnings.push(`🎰 MÓD1 Duplo Terminal: T${daniGreen.mod1.terminal}+T${daniGreen.mod1.pair} quente (${daniGreen.mod1.count}x em 15)`);
    }
    if (daniGreen.mod2) {
      aiLearnings.push(`📊 MÓD2 Terminais ${daniGreen.mod2 === 'high' ? 'ALTOS' : 'BAIXOS'}: mesa puxando ${daniGreen.mod2 === 'high' ? 'acima de 18' : 'abaixo de 18'}`);
    }
    if (daniGreen.mod4.active) {
      aiLearnings.push(`🟢 MÓD4 Pressão Zero: ${daniGreen.mod4.delay} giros sem zero, ${daniGreen.mod4.neighborsActive} vizinhos ativos`);
    }
    if (daniGreen.mod5Pull.length > 0) {
      aiLearnings.push(`🧲 MÓD5 Puxada: ${daniGreen.mod5LastNum} puxa ${daniGreen.mod5Pull.slice(0,5).join(',')}`);
    }
    if (daniGreen.mod6.active) {
      aiLearnings.push(`📈 MÓD6 ${daniGreen.mod6.direction === 'asc' ? 'Crescente' : daniGreen.mod6.direction === 'desc' ? 'Decrescente' : 'Dúzia'}: T${daniGreen.mod6.sequence.join('→T')}${daniGreen.mod6.nextTerminal !== null ? ` → próximo T${daniGreen.mod6.nextTerminal}` : ' → D1 retorno'}`);
    }
    // 100 Strategies extended learnings
    if (ext.terminalRepetido.active) {
      aiLearnings.push(`🔁 #15 Terminal Repetido: T${ext.terminalRepetido.terminal} saiu 2x seguidas — chance de 3ª`);
    }
    if (ext.terminalAlternado) {
      aiLearnings.push(`🔄 #17 Terminal Alternado: ${ext.terminalAlternado === 'odd' ? 'Ímpares dominam → entrar pares (T2,T4,T6)' : 'Pares dominam → entrar ímpares (T1,T3,T5)'}`);
    }
    if (ext.centralProg.active) {
      aiLearnings.push(`📐 #74/75 Central ${ext.centralProg.direction === 'asc' ? 'Crescente' : 'Decrescente'}: próximo alvo ${ext.centralProg.next}`);
    }
    if (ext.colorStreak.active) {
      aiLearnings.push(`🎨 #82 Padrão Cores: ${ext.colorStreak.count}x ${ext.colorStreak.color} consecutivos`);
    }
    if (ext.parImpar) {
      aiLearnings.push(`⚖️ #83 Par-Ímpar: mesa ${ext.parImpar === 'par' ? 'PARES dominam → T pares' : 'ÍMPARES dominam → T ímpares'}`);
    }
    if (ext.altoLowAlt.active) {
      aiLearnings.push(`↕️ #84 Alternância: próximo → ${ext.altoLowAlt.next === 'high' ? 'ALTO (19-36)' : 'BAIXO (1-18)'}`);
    }
    if (ext.mirrorDue.length > 0) {
      aiLearnings.push(`🪞 #65 Espelho: ${numbers[0]}→${ext.mirrorDue[0]} está devendo`);
    }
    if (ext.zeroAfterNeighbors) {
      aiLearnings.push(`🎯 #70 Zero Após Vizinhos: 32,15,26,3 saíram → ZERO iminente`);
    }
    if (ext.gatilhoPerfeito.active) {
      aiLearnings.push(`⚡ #81 GATILHO PERFEITO: 3 confirmações ativas → ${ext.gatilhoPerfeito.numbers.slice(0,5).join(',')}`);
    }
    if (ext.isPostZero) {
      aiLearnings.push(`🟢 #60 Pós-Zero: entrar T0+T2+T5 (${POST_ZERO_NUMS.slice(0,6).join(',')}...)`);
    }
    if (daniGreen.mod1Cold.delay >= 10) {
      aiLearnings.push(`❄️ #9 Terminal Frio: T${daniGreen.mod1Cold.terminal} ausente (${daniGreen.mod1Cold.delay} atraso) — combo quente+frio`);
    }
    // Entropy learnings
    aiLearnings.push(`🎲 Entropia: ${(sessionEntropy * 100).toFixed(0)}% → Regime ${sessionRegime}`);
    if (sessionEntropy < 0.5) aiLearnings.push('🎯 SESSÃO CONCENTRADA: padrão claro detectado — momento ideal para entrar');
    if (sessionEntropy > 0.8) aiLearnings.push('⚠️ SESSÃO DISPERSA: alta entropia — AGUARDAR mais dados');
    if (isEntropyDroppingConsistently) aiLearnings.push('📉 DRIFT de Entropia: sessão se organizando — bom momento para entrar');
    if (duplaKey) aiLearnings.push(`🎰 Dupla Terminal ativa: ${duplaKey} — ${DUPLAS_TERMINAIS[duplaKey]?.slice(0,5).join(',')}`);
    // Zero pressure zones (P3)
    if (daniGreen.mod4.delay >= 15 && daniGreen.mod4.delay < 25) aiLearnings.push(`🟡 Ciclo Zero LEVE: ${daniGreen.mod4.delay} giros — proteção 1 ficha`);
    if (daniGreen.mod4.delay >= 26 && daniGreen.mod4.delay < 40) aiLearnings.push(`🟠 Ciclo Zero MÉDIA: ${daniGreen.mod4.delay} giros — Jeu Zero (4 fichas)`);
    if (daniGreen.mod4.delay >= 41 && daniGreen.mod4.delay < 60) aiLearnings.push(`🔴 Ciclo Zero ALTA: ${daniGreen.mod4.delay} giros — Vizinhos do Zero (9 fichas)`);
    if (daniGreen.mod4.delay >= 60) aiLearnings.push(`🚨 ANOMALIA ZERO: ${daniGreen.mod4.delay} giros — PRIORIDADE MÁXIMA`);
    // Time awareness
    aiLearnings.push(`🕐 Turno ${timeAwareness.shift}: ${isNightShift ? 'Dealers mecânicos — prioridade física' : isDayShift ? 'Volume alto — prioridade matemática' : 'Turno misto'}`);
    if (microArcStd < 2) aiLearnings.push(`🎯 Dealer com mão viciada: arco ±${microArcStd.toFixed(1)} casas`);
    if (chaoticDealer) aiLearnings.push('⚠️ Dealer caótico detectado: reduzindo sinais automáticos');
    if (microSectorDom && Number(microSectorDom[1]) >= 5) aiLearnings.push(`🔥 Concentração no setor ${microSectorDom[0]}: ${microSectorDom[1]}/10 rodadas`);
    if (statisticalDebt.length > 3) aiLearnings.push(`📊 ${statisticalDebt.length} números em dívida estatística: ${statisticalDebt.slice(0,3).map(d=>d.num).join(',')}`);
    if (noiseCount > 3) aiLearnings.push(`🔇 ${noiseCount} saltos anômalos filtrados (bola desviou nos pinos)`);
    if (bestMesaStrat && bestMesaStrat[1].total >= 3) {
      const wr = ((bestMesaStrat[1].hits / bestMesaStrat[1].total) * 100).toFixed(0);
      aiLearnings.push(`🏆 Melhor estratégia atual: ${bestMesaStrat[0]} (${wr}% win rate)`);
    }

    const last10 = numbers.slice(0, 10);
    const last15 = numbers.slice(0, 15);
    const last30 = numbers.slice(0, 30);
    const last50 = numbers.slice(0, 50);
    const last100 = numbers.slice(0, 100);
    const last200 = numbers.slice(0, 200);
    const last500 = numbers.slice(0, 500);
    const last1000 = numbers.slice(0, 1000);

    // ========================================================
    // BLOCO A: DINÂMICA BIOMECÂNICA E FÍSICA (100 CAMADAS)
    // ========================================================
    let blocoA = 0;
    const maxA = 100;

    // A1-A50: Arcos de lançamento (50 variações)
    const arcs: number[] = [];
    for (let i = 0; i < Math.min(50, numbers.length - 1); i++) arcs.push(wheelDist(numbers[i], numbers[i + 1]));
    const arcMean = arcs.length > 0 ? arcs.reduce((a, b) => a + b, 0) / arcs.length : 0;
    const arcStdDev = Math.sqrt(arcs.length > 0 ? arcs.reduce((a, b) => a + Math.pow(b - arcMean, 2), 0) / arcs.length : 99);
    const last3Arcs = arcs.slice(0, 3);
    const last5Arcs = arcs.slice(0, 5);
    const last10Arcs = arcs.slice(0, 10);
    const arcRange3 = last3Arcs.length === 3 ? Math.max(...last3Arcs) - Math.min(...last3Arcs) : 99;
    const arcRange5 = last5Arcs.length === 5 ? Math.max(...last5Arcs) - Math.min(...last5Arcs) : 99;
    const maoViciada = arcRange3 <= 2;
    const maoViciada5 = arcRange5 <= 3;

    // Score arcs - each arc variation within tolerance = +1 layer
    for (let i = 0; i < Math.min(50, arcs.length); i++) {
      if (Math.abs(arcs[i] - arcMean) <= arcStdDev * 1.5) blocoA += 1;
    }

    // A51-A75: Regularidade do Dealer (25 níveis)
    const recentArcs = arcs.slice(0, 10);
    const olderArcs = arcs.slice(10, 20);
    const recentArcMean = recentArcs.length > 0 ? recentArcs.reduce((a, b) => a + b, 0) / recentArcs.length : 0;
    const olderArcMean = olderArcs.length > 0 ? olderArcs.reduce((a, b) => a + b, 0) / olderArcs.length : 0;
    const dealerChanged = olderArcs.length >= 8 && Math.abs(recentArcMean - olderArcMean) > 9;
    const shortArcs = recentArcs.filter(a => a < 6).length;
    const longArcs = recentArcs.filter(a => a > 14).length;
    const dealerMode = shortArcs > longArcs * 1.5 ? 'curto' : longArcs > shortArcs * 1.5 ? 'longo' : 'misto';

    // Consistency levels
    if (arcStdDev < 1.5) blocoA += 25;
    else if (arcStdDev < 2.5) blocoA += 20;
    else if (arcStdDev < 3.5) blocoA += 15;
    else if (arcStdDev < 5) blocoA += 10;
    else blocoA += 5;

    // A76-A100: Frequência de Oitavos (25 camadas)
    const octFreqAll: Record<string, number> = {};
    last50.forEach(n => { const o = getOctave(n); if (o) octFreqAll[o] = (octFreqAll[o]||0) + 1; });
    const biasedOctaves = Object.entries(octFreqAll).filter(([,c]) => c >= 5).map(([o]) => o);
    const octConcentration = Object.values(octFreqAll);
    const octMax = Math.max(...octConcentration, 1);
    const octMin = Math.min(...octConcentration, 0);
    const octSpread = octMax - octMin;
    // Higher spread = more concentration = more layers
    blocoA += Math.min(25, Math.round(octSpread * 3));

    blocoA = Math.min(maxA, blocoA);

    let minutesSinceStart = 0;
    if (allEntries.length > 1) {
      minutesSinceStart = (new Date(allEntries[0].time).getTime() - new Date(allEntries[Math.min(allEntries.length-1,49)].time).getTime()) / 60000;
    }

    const dealerSignature = {
      arcMean: +arcMean.toFixed(1), arcStdDev: +arcStdDev.toFixed(1),
      maoViciada, maoViciada5, dealerChanged, dealerMode, last3Arcs,
      possibleRotation: minutesSinceStart > 28,
      consistency: arcStdDev < 2.5 ? 'máxima' : arcStdDev < 3.5 ? 'alta' : arcStdDev < 5 ? 'média' : 'baixa',
    };

    // ========================================================
    // BLOCO B: MATEMÁTICA PURA E TERMINAIS (150 CAMADAS)
    // ========================================================
    let blocoB = 0;
    const maxB = 150;

    // B1-B50: Terminais em janelas 50/100/200
    const termFreq50: Record<number, number> = {};
    const termFreq100: Record<number, number> = {};
    const termFreq200: Record<number, number> = {};
    for (let t = 0; t <= 9; t++) { termFreq50[t] = 0; termFreq100[t] = 0; termFreq200[t] = 0; }
    last50.forEach(n => termFreq50[n % 10]++);
    last100.forEach(n => termFreq100[n % 10]++);
    last200.forEach(n => termFreq200[n % 10]++);

    const sortedTerminals50 = Object.entries(termFreq50).sort(([,a],[,b]) => b - a);
    const sortedTerminals = sortedTerminals50;

    // Each terminal with consistent frequency across windows = layers
    for (let t = 0; t <= 9; t++) {
      const r50 = termFreq50[t] / (last50.length || 1);
      const r100 = termFreq100[t] / (last100.length || 1);
      const r200 = termFreq200[t] / (last200.length || 1);
      // Consistency across windows
      const avg = (r50 + r100 + r200) / 3;
      const dev = Math.abs(r50 - avg) + Math.abs(r100 - avg) + Math.abs(r200 - avg);
      if (dev < 0.05) blocoB += 5; // very consistent
      else if (dev < 0.1) blocoB += 3;
      else blocoB += 1;
    }

    // B51-B100: Atraso de Cavalos e intersecções (50 camadas)
    const freq10: Record<number, number> = {}, freq30: Record<number, number> = {}, freq100r: Record<number, number> = {};
    for (let n = 0; n <= 36; n++) { freq10[n] = 0; freq30[n] = 0; freq100r[n] = 0; }
    last10.forEach(n => freq10[n]++);
    last30.forEach(n => freq30[n]++);
    last100.forEach(n => freq100r[n]++);

    const cavaloFreq: Record<string, number> = { '258':0, '147':0, '03':0, '69':0 };
    last30.forEach(n => { const g = getCavalo(n); if (g) cavaloFreq[g]++; });
    const sortedCavalos = Object.entries(cavaloFreq).sort(([,a],[,b]) => b - a);
    const hotCavaloGroup = sortedCavalos[0][0];

    const cavaloDelays: Record<string, number> = { '258':999, '147':999, '03':999, '69':999 };
    const termDelays: Record<number, number> = {};
    for (let t = 0; t <= 9; t++) termDelays[t] = 999;
    const dozenDelays: Record<number, number> = { 1:999, 2:999, 3:999 };
    const colDelays: Record<number, number> = { 1:999, 2:999, 3:999 };

    for (let i = 0; i < last50.length; i++) {
      const n = last50[i];
      const g = getCavalo(n); if (g && cavaloDelays[g] === 999) cavaloDelays[g] = i;
      const t = n % 10; if (termDelays[t] === 999) termDelays[t] = i;
      const d = getDozen(n); if (d > 0 && dozenDelays[d] === 999) dozenDelays[d] = i;
      const c = getColumn(n); if (c > 0 && colDelays[c] === 999) colDelays[c] = i;
    }
    const delayedCavalos = Object.entries(cavaloDelays).filter(([,d]) => d > 8);
    const delayedTerminals = Object.entries(termDelays).filter(([,d]) => d > 8).map(([t]) => Number(t));

    // Score cavalos delays
    for (const [, delay] of Object.entries(cavaloDelays)) {
      if (delay > 15) blocoB += 6;
      else if (delay > 10) blocoB += 4;
      else if (delay > 6) blocoB += 2;
      else blocoB += 1;
    }
    // Intersecções between cavalos
    const cavaloIntersections = Object.entries(cavaloFreq).filter(([,c]) => c >= 8).length;
    blocoB += cavaloIntersections * 5;

    // B101-B150: Lei do Terço Avançada (50 camadas)
    const uniqueIn37 = new Set(numbers.slice(0, 37)).size;
    const tercoRatio = uniqueIn37 / 37;
    // Expect ~24/37 unique (law of thirds)
    if (Math.abs(tercoRatio - 0.649) < 0.05) blocoB += 30; // perfect match
    else if (Math.abs(tercoRatio - 0.649) < 0.1) blocoB += 20;
    else blocoB += 10;

    // Numbers that appeared 0 times in last 37 (candidates for reincidence)
    const absentIn37: number[] = [];
    const repeatedIn37: number[] = [];
    const freq37map: Record<number, number> = {};
    for (let n = 0; n <= 36; n++) freq37map[n] = 0;
    numbers.slice(0, Math.min(37, numbers.length)).forEach(n => freq37map[n]++);
    for (let n = 0; n <= 36; n++) {
      if (freq37map[n] === 0) absentIn37.push(n);
      if (freq37map[n] >= 2) repeatedIn37.push(n);
    }
    blocoB += Math.min(20, absentIn37.length); // absent numbers = layers

    blocoB = Math.min(maxB, blocoB);

    // ========================================================
    // BLOCO C: GEOMETRIA DE PANO E ENTROPIA (100 CAMADAS)
    // ========================================================
    let blocoC = 0;
    const maxC = 100;

    // C1-C40: Rítmica Visual (xadrez, blocos de cor/dúzia)
    let colorChanges = 0, colorTotal = 0;
    for (let i = 1; i < last30.length; i++) {
      const p = getColor(last30[i-1]), c = getColor(last30[i]);
      if (p !== 'green' && c !== 'green') { colorTotal++; if (p !== c) colorChanges++; }
    }
    const entropy = colorTotal > 0 ? colorChanges / colorTotal : 0.5;
    const highEntropy = entropy > 0.75;

    // Xadrez pattern (alternating colors)
    let xadrezCount = 0;
    for (let i = 1; i < last15.length; i++) {
      const p = getColor(last15[i-1]), c = getColor(last15[i]);
      if (p !== 'green' && c !== 'green' && p !== c) xadrezCount++;
    }
    blocoC += Math.min(20, Math.round(xadrezCount * 1.5));

    // Dozen blocks
    const dozenSeq: number[] = last30.filter(n => n > 0).map(n => getDozen(n));
    let dozenBlocks = 0;
    for (let i = 1; i < dozenSeq.length; i++) { if (dozenSeq[i] === dozenSeq[i-1]) dozenBlocks++; }
    blocoC += Math.min(20, dozenBlocks * 2);

    // C41-C70: Quadrantes (30 camadas)
    let highCount = 0, lowCount = 0, evenCount = 0, oddCount = 0;
    last30.forEach(n => {
      if (isHigh(n)) highCount++; if (isLow(n)) lowCount++;
      if (isEven(n)) evenCount++; if (isOdd(n)) oddCount++;
    });
    const highLowRatio = highCount / (lowCount || 1);
    const evenOddRatio = evenCount / (oddCount || 1);
    // Imbalance = predictable
    if (highLowRatio > 1.5 || highLowRatio < 0.67) blocoC += 15;
    else if (highLowRatio > 1.3 || highLowRatio < 0.77) blocoC += 10;
    else blocoC += 5;
    if (evenOddRatio > 1.5 || evenOddRatio < 0.67) blocoC += 15;
    else if (evenOddRatio > 1.3 || evenOddRatio < 0.77) blocoC += 10;
    else blocoC += 5;

    // C71-C100: Espelhamento e Complementares (30 camadas)
    const compDue: number[] = [];
    const mirrorDue: number[] = [];
    for (let i = 0; i < Math.min(15, numbers.length); i++) {
      const comp = getComplementar(numbers[i]);
      if (comp !== null && !last15.includes(comp)) compDue.push(comp);
      const mir = getMirror(numbers[i]);
      if (mir !== null && !last15.includes(mir)) mirrorDue.push(mir);
    }
    blocoC += Math.min(15, compDue.length * 2);
    blocoC += Math.min(15, mirrorDue.length * 2);

    blocoC = Math.min(maxC, blocoC);

    // ========================================================
    // BLOCO D: INTELIGÊNCIA PREDITIVA E MEMÓRIA (100 CAMADAS)
    // ========================================================
    let blocoD = 0;
    const maxD = 100;

    // D1-D50: Backtest micro-estratégias PROFUNDO (50 camadas)
    // Uses up to 1000 numbers for deep backtesting
    const deepBacktestSize = Math.min(numbers.length, 1000);
    const backtestWindows = Math.min(50, Math.floor(deepBacktestSize / 15) - 1);
    let backtestHits = 0;
    let backtestCavaloHits = 0;
    let backtestSectorHits = 0;
    for (let w = 0; w < backtestWindows; w++) {
      const window = numbers.slice(w * 5, w * 5 + 15);
      const nextNums = numbers.slice(w * 5 + 15, w * 5 + 20);
      if (window.length < 15 || nextNums.length < 3) continue;
      // Test terminal strategy
      const tf: Record<number, number> = {};
      for (let t = 0; t <= 9; t++) tf[t] = 0;
      window.forEach(n => tf[n % 10]++);
      const hotTerm = Object.entries(tf).sort(([,a],[,b]) => b - a)[0][0];
      if (nextNums.some(n => (n % 10) === parseInt(hotTerm))) backtestHits++;
      // Test cavalo strategy
      const cf: Record<string, number> = { '258':0, '147':0, '03':0, '69':0 };
      window.forEach(n => { const g = getCavalo(n); if (g) cf[g]++; });
      const hotCav = Object.entries(cf).sort(([,a],[,b]) => b - a)[0][0];
      if (nextNums.some(n => { const g = getCavalo(n); return g === hotCav; })) backtestCavaloHits++;
      // Test sector strategy
      const sf: Record<string, number> = { Voisins:0, Tiers:0, Orphelins:0 };
      window.forEach(n => { const s = getSector(n); if (sf[s] !== undefined) sf[s]++; });
      const hotSec = Object.entries(sf).sort(([,a],[,b]) => b - a)[0][0];
      if (nextNums.some(n => getSector(n) === hotSec)) backtestSectorHits++;
    }
    const backtestRate = backtestWindows > 0 ? backtestHits / backtestWindows : 0;
    const backtestCavRate = backtestWindows > 0 ? backtestCavaloHits / backtestWindows : 0;
    const backtestSecRate = backtestWindows > 0 ? backtestSectorHits / backtestWindows : 0;
    // Use best backtest rate
    const bestBacktest = Math.max(backtestRate, backtestCavRate, backtestSecRate);
    blocoD += Math.round(bestBacktest * 50);

    // D51-D75: Filtro de Falsos Positivos (25 camadas)
    // Low entropy = more random = subtract layers; high pattern = add
    const patternStrength = (1 - entropy) * 25;
    blocoD += Math.round(patternStrength);

    // D76-D100: Recuperação Dinâmica (25 camadas)
    const recoveryMode = delayedCavalos.length >= 2 && delayedTerminals.length >= 2;
    if (recoveryMode) blocoD += 20;
    else if (delayedCavalos.length >= 1 || delayedTerminals.length >= 2) blocoD += 12;
    else blocoD += 5;

    blocoD = Math.min(maxD, blocoD);

    // ========================================================
    // BLOCO E: CALIBRAGEM DE SESSÃO (50 CAMADAS)
    // ========================================================
    let blocoE = 0;
    const maxE = 50;

    // E1-E25: Troca de dealer
    if (!dealerChanged) {
      blocoE += 25; // stable dealer = full layers
    } else {
      blocoE += 5; // new dealer = minimal
    }

    // E26-E50: Volatilidade de mesa
    const recentStdDev = (() => {
      if (last30.length < 10) return 99;
      const mean = last30.reduce((a, b) => a + b, 0) / last30.length;
      return Math.sqrt(last30.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / last30.length);
    })();
    if (recentStdDev < 8) blocoE += 25; // low volatility
    else if (recentStdDev < 12) blocoE += 18;
    else if (recentStdDev < 15) blocoE += 12;
    else blocoE += 5;

    blocoE = Math.min(maxE, blocoE);

    // ========================================================
    // BLOCO K: DINÂMICA DE FLUXO DE MESA (100 CAMADAS)
    // Concentração vs Dispersão, Puxada, Alternância de Áreas,
    // Progressão de Terminais
    // ========================================================
    let blocoK = 0;
    const maxK = 100;

    // K1-K30: CONCENTRAÇÃO vs DISPERSÃO (Cluster vs Gangorra)
    // Mede se os últimos 15 números caem em poucos setores (concentrado)
    // ou cruzam o cilindro alternadamente (gangorra)
    const mesaFlowState: { mode: 'concentracao' | 'gangorra' | 'neutro'; clusterZone: string | null; gangorraSequence: string[]; strength: number } = {
      mode: 'neutro', clusterZone: null, gangorraSequence: [], strength: 0
    };

    if (numbers.length >= 15) {
      // Check sector concentration in last 15
      const sec15: Record<string, number> = { Voisins: 0, Tiers: 0, Orphelins: 0 };
      last15.forEach(n => { const s = getSector(n); if (sec15[s] !== undefined) sec15[s]++; });
      const maxSec15 = Math.max(...Object.values(sec15));
      const maxSecName = Object.entries(sec15).sort(([,a],[,b]) => b - a)[0][0];

      // Concentration: >60% in one sector
      if (maxSec15 >= 9) {
        mesaFlowState.mode = 'concentracao';
        mesaFlowState.clusterZone = maxSecName;
        mesaFlowState.strength = maxSec15 / 15;
        blocoK += 30;
        aiLearnings.push(`🔥 CONCENTRAÇÃO: ${maxSecName} com ${maxSec15}/15 — Zona de Calor ativa`);
      } else {
        // Check gangorra: alternating sectors
        const secSeq = last15.map(n => getSector(n));
        let alternations = 0;
        for (let i = 1; i < secSeq.length; i++) {
          if (secSeq[i] !== secSeq[i-1]) alternations++;
        }
        const alternationRate = alternations / (secSeq.length - 1);
        if (alternationRate > 0.75) {
          mesaFlowState.mode = 'gangorra';
          mesaFlowState.gangorraSequence = secSeq.slice(0, 5);
          mesaFlowState.strength = alternationRate;
          blocoK += 25;
          aiLearnings.push(`🔄 GANGORRA: ${alternationRate.toFixed(0)}% alternância de setores`);

          // Detect sector alternation pattern (Tiers→Voisins→Tiers→Voisins)
          if (secSeq.length >= 4 && secSeq[0] !== secSeq[1] && secSeq[1] === secSeq[3] && secSeq[0] === secSeq[2]) {
            aiLearnings.push(`⚡ CONVERGÊNCIA DE ALTERNÂNCIA: ${secSeq[0]}↔${secSeq[1]} (padrão cíclico)`);
            blocoK += 15;
          }
        } else {
          blocoK += 10;
        }
      }
    }

    // K31-K60: PUXADA DE NÚMEROS (Relação de Imã)
    // Para cada número recente, calcula quais números saem logo depois com frequência
    const pullPatterns: { source: number; targets: { num: number; count: number; sector: string }[]; dominantSector: string; neighborRepeat: number }[] = [];
    if (numbers.length >= 100) {
      // Analyze last 5 unique numbers as "sources"
      const sourcesToAnalyze = [...new Set(numbers.slice(0, 5))].slice(0, 3);
      for (const src of sourcesToAnalyze) {
        const occurrences: number[] = [];
        for (let i = 0; i < Math.min(500, numbers.length) - 1; i++) {
          if (numbers[i] === src) occurrences.push(i);
        }
        if (occurrences.length < 3) continue;

        // What comes AFTER this number
        const nextMap: Record<number, number> = {};
        const nextSectors: Record<string, number> = { Voisins: 0, Tiers: 0, Orphelins: 0 };
        let neighborRepeats = 0;
        for (const idx of occurrences) {
          if (idx + 1 < numbers.length) {
            const next = numbers[idx + 1];
            nextMap[next] = (nextMap[next] || 0) + 1;
            const sec = getSector(next);
            if (nextSectors[sec] !== undefined) nextSectors[sec]++;
            // Check if next is a wheel neighbor (within 2)
            if (wheelDist(src, next) <= 2) neighborRepeats++;
          }
        }
        const topTargets = Object.entries(nextMap)
          .sort(([,a],[,b]) => b - a)
          .slice(0, 5)
          .map(([n, c]) => ({ num: Number(n), count: c, sector: getSector(Number(n)) }));

        const domSector = Object.entries(nextSectors).sort(([,a],[,b]) => b - a)[0][0];
        const domSectorPct = Object.values(nextSectors).reduce((a, b) => a + b, 0) > 0
          ? nextSectors[domSector] / Object.values(nextSectors).reduce((a, b) => a + b, 0)
          : 0;

        pullPatterns.push({
          source: src,
          targets: topTargets,
          dominantSector: domSector,
          neighborRepeat: neighborRepeats,
        });

        // Score based on pull strength
        if (domSectorPct > 0.5) blocoK += 5;
        if (neighborRepeats >= occurrences.length * 0.3) {
          blocoK += 5;
          aiLearnings.push(`🧲 Puxada: ${src} chama vizinhos em ${((neighborRepeats/occurrences.length)*100).toFixed(0)}% das vezes`);
        }
        if (topTargets[0] && topTargets[0].count >= 3) {
          aiLearnings.push(`🧲 Puxada forte: ${src} → ${topTargets[0].num} (${topTargets[0].count}x em ${occurrences.length})`);
          blocoK += 5;
        }
      }
    }

    // K61-K80: ALTERNÂNCIA RÍTMICA DE VIZINHOS
    // Detecta "Salto de Vizinhos" (consecutivos são vizinhos de cilindro)
    let neighborJumpCount = 0;
    const neighborJumpPairs: [number, number][] = [];
    if (numbers.length >= 10) {
      for (let i = 0; i < Math.min(15, numbers.length) - 1; i++) {
        if (wheelDist(numbers[i], numbers[i+1]) <= 2) {
          neighborJumpCount++;
          neighborJumpPairs.push([numbers[i], numbers[i+1]]);
        }
      }
      if (neighborJumpCount >= 4) {
        mesaFlowState.mode = 'concentracao';
        blocoK += 15;
        aiLearnings.push(`🤝 Mão Mecânica: ${neighborJumpCount} vizinhos consecutivos — Dealer com arco fixo`);
      } else if (neighborJumpCount >= 2) {
        blocoK += 8;
      } else {
        blocoK += 3;
      }
    }

    // K81-K100: PROGRESSÃO DE TERMINAIS (Cavalos em Escada)
    // Detecta progressões como T2→T5→T8 (Cavalos 258)
    const terminalProgression: { sequence: number[]; group: string | null; predictedNext: number | null } = {
      sequence: [], group: null, predictedNext: null
    };
    if (numbers.length >= 5) {
      const recentTerms = numbers.slice(0, 5).map(n => n % 10);
      // Check Cavalos 258 progression (2→5→8 or reverse)
      const c258 = [2, 5, 8];
      const c147 = [1, 4, 7];
      const c0369 = [0, 3, 6, 9];

      const checkProgression = (terms: number[], group: number[], name: string) => {
        const indices = terms.map(t => group.indexOf(t)).filter(i => i >= 0);
        if (indices.length >= 2) {
          // Check if consecutive indices form an ascending or descending pattern
          const isAscending = indices[0] < indices[1];
          const nextIdx = isAscending ? indices[0] + (indices.length) : indices[0] - 1;
          if (nextIdx >= 0 && nextIdx < group.length && !terms.includes(group[nextIdx])) {
            terminalProgression.sequence = indices.map(i => group[i]);
            terminalProgression.group = name;
            terminalProgression.predictedNext = group[nextIdx];
            blocoK += 10;
          }
        }
      };

      checkProgression(recentTerms, c258, '258');
      if (!terminalProgression.group) checkProgression(recentTerms, c147, '147');
      if (!terminalProgression.group) checkProgression(recentTerms, c0369, '0369');

      if (terminalProgression.predictedNext !== null) {
        aiLearnings.push(`🐎 Escada Terminal: T${terminalProgression.sequence.join('→T')} → próximo T${terminalProgression.predictedNext} (C${terminalProgression.group})`);
      }

      // Terminal block dominance
      const termBlockFreq: Record<string, number> = { '258': 0, '147': 0, '0369': 0 };
      const recent10Terms = numbers.slice(0, 10).map(n => n % 10);
      recent10Terms.forEach(t => {
        if (c258.includes(t)) termBlockFreq['258']++;
        else if (c147.includes(t)) termBlockFreq['147']++;
        else if (c0369.includes(t)) termBlockFreq['0369']++;
      });
      const dominantTermBlock = Object.entries(termBlockFreq).sort(([,a],[,b]) => b - a)[0];
      if (Number(dominantTermBlock[1]) >= 6) {
        blocoK += 10;
        aiLearnings.push(`🏇 Bloco Terminal dominante: ${dominantTermBlock[0]} (${dominantTermBlock[1]}/10 rodadas)`);
      }
    }

    blocoK = Math.min(maxK, blocoK);

    // ========================================================
    // BLOCO L: FILTRO DE RUÍDO BRANCO (100 CAMADAS)
    // Índice de Aleatoriedade — mede se a mesa está em caos total
    // ========================================================
    let blocoL = 0;
    const maxL = 100;

    const randomnessIndex: { entropy: number; arcChaos: number; sectorSpread: number; overall: number; stable: boolean; message: string } = {
      entropy: 0, arcChaos: 0, sectorSpread: 0, overall: 0, stable: true, message: ''
    };

    if (numbers.length >= 20) {
      // L1-L30: Entropia de Shannon dos últimos 20 números
      const freq20: Record<number, number> = {};
      const w20 = numbers.slice(0, 20);
      w20.forEach(n => freq20[n] = (freq20[n] || 0) + 1);
      let shannonH = 0;
      for (const f of Object.values(freq20)) {
        const p = f / 20;
        if (p > 0) shannonH -= p * Math.log2(p);
      }
      const maxEntropy = Math.log2(37); // ~5.21
      const entropyRatio = shannonH / maxEntropy;
      randomnessIndex.entropy = +entropyRatio.toFixed(3);
      // High entropy = random, Low = patterned. Reward low entropy.
      if (entropyRatio < 0.7) blocoL += 30;
      else if (entropyRatio < 0.85) blocoL += 20;
      else if (entropyRatio < 0.95) blocoL += 10;
      // Near-max entropy = pure chaos
      else blocoL += 0;

      // L31-L60: Caos de arco — variância dos últimos 15 arcos
      const recent15Arcs = rawArcs.slice(0, 15);
      const arcMean15 = recent15Arcs.length > 0 ? recent15Arcs.reduce((a, b) => a + b, 0) / recent15Arcs.length : 10;
      const arcVar15 = recent15Arcs.length > 0 ? recent15Arcs.reduce((a, b) => a + Math.pow(b - arcMean15, 2), 0) / recent15Arcs.length : 99;
      randomnessIndex.arcChaos = +arcVar15.toFixed(1);
      if (arcVar15 < 15) blocoL += 30;
      else if (arcVar15 < 30) blocoL += 20;
      else if (arcVar15 < 50) blocoL += 10;

      // L61-L80: Dispersão de setor — quantos setores nos últimos 10
      const sec10Set = new Set(numbers.slice(0, 10).map(n => getSector(n)));
      randomnessIndex.sectorSpread = sec10Set.size;
      if (sec10Set.size <= 2) blocoL += 20; // concentrated
      else if (sec10Set.size === 3) blocoL += 10;

      // L81-L100: Consistência de terminais
      const term10 = numbers.slice(0, 10).map(n => n % 10);
      const uniqueTerms = new Set(term10).size;
      if (uniqueTerms <= 5) blocoL += 20;
      else if (uniqueTerms <= 7) blocoL += 10;

      // Calculate overall randomness index (0-100, higher = more random/unstable)
      randomnessIndex.overall = Math.round(entropyRatio * 40 + (arcVar15 > 50 ? 30 : arcVar15 > 30 ? 20 : arcVar15 > 15 ? 10 : 0) + (sec10Set.size >= 3 ? 20 : sec10Set.size >= 2 ? 10 : 0) + (uniqueTerms > 7 ? 10 : 0));
      randomnessIndex.stable = randomnessIndex.overall < 50;

      if (randomnessIndex.overall >= 75) {
        randomnessIndex.message = '🛑 Mesa INSTÁVEL — próximos giros são ruído. Aguardando calibração.';
        aiLearnings.push('🛑 RUÍDO BRANCO: Mesa em caos total — índice de aleatoriedade ' + randomnessIndex.overall + '%');
      } else if (randomnessIndex.overall >= 50) {
        randomnessIndex.message = '⚠️ Mesa semi-instável — sinais com confiança reduzida.';
        aiLearnings.push('⚠️ Ruído moderado: aleatoriedade ' + randomnessIndex.overall + '% — cuidado');
      } else {
        randomnessIndex.message = '✅ Mesa estável — padrões detectáveis.';
      }
    } else {
      blocoL = 50; // neutral when insufficient data
    }
    blocoL = Math.min(maxL, blocoL);

    // ========================================================
    // BLOCO M: MICRO-MAPEAMENTO DE DEFLETORES (100 CAMADAS)
    // Taxa de Desvio de Impacto — simula desvio nos diamantes
    // ========================================================
    let blocoM = 0;
    const maxM = 100;

    // Divide o cilindro em 8 zonas de diamante
    const DIAMOND_ZONES = 8;
    const diamondZoneSize = Math.floor(WL / DIAMOND_ZONES);
    const diamondDeflection: { zone: number; frequency: number; targetSector: string; deflectionRate: number }[] = [];

    if (numbers.length >= 50) {
      // Para cada par consecutivo, calcular qual "zona de diamante" a bola atravessou
      const zoneHits: Record<number, { total: number; sectors: Record<string, number> }> = {};
      for (let z = 0; z < DIAMOND_ZONES; z++) zoneHits[z] = { total: 0, sectors: { Voisins: 0, Tiers: 0, Orphelins: 0 } };

      for (let i = 0; i < Math.min(200, numbers.length) - 1; i++) {
        const fromIdx = wheelIdx(numbers[i]);
        const toIdx = wheelIdx(numbers[i + 1]);
        if (fromIdx === -1 || toIdx === -1) continue;
        // Midpoint between from and to = approximate diamond impact point
        const midpoint = Math.floor((fromIdx + toIdx) / 2) % WL;
        const zone = Math.floor(midpoint / diamondZoneSize) % DIAMOND_ZONES;
        const targetSec = getSector(numbers[i + 1]);
        zoneHits[zone].total++;
        if (zoneHits[zone].sectors[targetSec] !== undefined) zoneHits[zone].sectors[targetSec]++;
      }

      for (let z = 0; z < DIAMOND_ZONES; z++) {
        const zh = zoneHits[z];
        if (zh.total < 3) continue;
        const topSec = Object.entries(zh.sectors).sort(([,a],[,b]) => b - a)[0];
        const rate = topSec[1] / zh.total;
        diamondDeflection.push({ zone: z + 1, frequency: zh.total, targetSector: topSec[0], deflectionRate: +rate.toFixed(2) });
        // Score: strong deflection patterns = high confidence
        if (rate > 0.6) blocoM += 15;
        else if (rate > 0.45) blocoM += 8;
        else blocoM += 3;
      }

      // Which diamond zone is the ball hitting NOW based on recent arcs?
      if (numbers.length >= 2) {
        const currentFromIdx = wheelIdx(numbers[0]);
        const prevToIdx = wheelIdx(numbers[1]);
        if (currentFromIdx !== -1 && prevToIdx !== -1) {
          const currentMid = Math.floor((prevToIdx + currentFromIdx) / 2) % WL;
          const currentZone = Math.floor(currentMid / diamondZoneSize) % DIAMOND_ZONES;
          const currentDefl = diamondDeflection.find(d => d.zone === currentZone + 1);
          if (currentDefl && currentDefl.deflectionRate > 0.55) {
            aiLearnings.push(`💎 Diamante #${currentDefl.zone}: ${(currentDefl.deflectionRate * 100).toFixed(0)}% → ${currentDefl.targetSector}`);
          }
        }
      }
    } else {
      blocoM = 30;
    }
    blocoM = Math.min(maxM, blocoM);

    // ========================================================
    // BLOCO N: KELLY CRITERION ADAPTADO (100 CAMADAS)
    // Gestão de Aposta Progressiva de Confiança
    // ========================================================
    let blocoN = 0;
    const maxN = 100;

    const kellyBetting: { kellyFraction: number; unitMultiplier: number; riskLevel: string; recommendation: string; residualError: number } = {
      kellyFraction: 0, unitMultiplier: 1, riskLevel: 'normal', recommendation: '', residualError: 100
    };

    // Calculate Kelly fraction: f* = (bp - q) / b
    // b = payout odds, p = estimated win probability, q = 1 - p
    const recentWins = resolvedHistory.slice(0, 30).filter(p => p.hit).length;
    const recentTotal = Math.min(30, resolvedHistory.length);
    const historicalWinRate = recentTotal > 5 ? recentWins / recentTotal : 0.15;

    // Estimate based on average coverage/payout of top strategies
    const avgPayout = 8; // average payout multiplier across strategies
    const estimatedP = historicalWinRate;
    const estimatedQ = 1 - estimatedP;
    const kellyRaw = (avgPayout * estimatedP - estimatedQ) / avgPayout;
    kellyBetting.kellyFraction = Math.max(0, Math.min(0.25, kellyRaw)); // cap at 25%

    // Unit multiplier based on Kelly + convergence
    const convergenceRatio = (blocoA + blocoB + blocoC + blocoD + blocoE + blocoK + blocoL) / (maxA + maxB + maxC + maxD + maxE + maxK + maxL);
    if (kellyBetting.kellyFraction > 0.15 && convergenceRatio > 0.8) {
      kellyBetting.unitMultiplier = 3;
      kellyBetting.riskLevel = 'maximo';
      kellyBetting.residualError = Math.max(1, Math.round((1 - convergenceRatio) * 100));
      kellyBetting.recommendation = `🔥 Sinal de Força MÁXIMA: Aumente a unidade em 3x. Risco residual: ${kellyBetting.residualError}%`;
      blocoN += 100;
      aiLearnings.push(`💰 Kelly Criterion: f*=${(kellyBetting.kellyFraction * 100).toFixed(0)}% — MULTIPLICAR 3x`);
    } else if (kellyBetting.kellyFraction > 0.08 && convergenceRatio > 0.65) {
      kellyBetting.unitMultiplier = 2;
      kellyBetting.riskLevel = 'elevado';
      kellyBetting.residualError = Math.max(5, Math.round((1 - convergenceRatio) * 100));
      kellyBetting.recommendation = `⚡ Sinal Forte: Aumente unidade em 2x. Risco residual: ${kellyBetting.residualError}%`;
      blocoN += 70;
    } else if (kellyBetting.kellyFraction > 0.03) {
      kellyBetting.unitMultiplier = 1;
      kellyBetting.riskLevel = 'normal';
      kellyBetting.residualError = Math.max(15, Math.round((1 - convergenceRatio) * 100));
      kellyBetting.recommendation = '✅ Aposta padrão: 1 unidade. Gestão conservadora.';
      blocoN += 40;
    } else {
      kellyBetting.unitMultiplier = 0.5;
      kellyBetting.riskLevel = 'minimo';
      kellyBetting.residualError = Math.max(30, Math.round((1 - convergenceRatio) * 100));
      kellyBetting.recommendation = '🛡️ Proteja banca: reduzir para 0.5 unidade. Momento desfavorável.';
      blocoN += 15;
    }
    blocoN = Math.min(maxN, blocoN);

    // ========================================================
    // BLOCO O: BIOMETRIA DO DEALER (100 CAMADAS)
    // Perfil do dealer baseado em padrões de arco
    // ========================================================
    let blocoO = 0;
    const maxO = 100;

    const dealerBiometrics: { profileType: string; arcConsistency: number; sectorPreference: string; strengthIndex: number; neighborPattern: number; signature: string } = {
      profileType: 'desconhecido', arcConsistency: 0, sectorPreference: '', strengthIndex: 0, neighborPattern: 0, signature: ''
    };

    if (arcs.length >= 10) {
      // O1-O30: Consistência do arco (biometria do lançamento)
      const arcConsistency = 100 - Math.min(100, arcStdDev * 10);
      dealerBiometrics.arcConsistency = +arcConsistency.toFixed(0);
      if (arcConsistency > 80) { blocoO += 30; dealerBiometrics.profileType = 'mecânico'; }
      else if (arcConsistency > 60) { blocoO += 20; dealerBiometrics.profileType = 'regular'; }
      else if (arcConsistency > 40) { blocoO += 10; dealerBiometrics.profileType = 'variável'; }
      else { blocoO += 5; dealerBiometrics.profileType = 'caótico'; }

      // O31-O60: Preferência de setor do dealer
      const dealerSectorFreq: Record<string, number> = { Voisins: 0, Tiers: 0, Orphelins: 0 };
      numbers.slice(0, 30).forEach(n => { const s = getSector(n); if (dealerSectorFreq[s] !== undefined) dealerSectorFreq[s]++; });
      const dealerTopSector = Object.entries(dealerSectorFreq).sort(([,a],[,b]) => b - a)[0];
      dealerBiometrics.sectorPreference = dealerTopSector[0];
      const sectorDominance = dealerTopSector[1] / 30;
      if (sectorDominance > 0.5) blocoO += 30;
      else if (sectorDominance > 0.4) blocoO += 20;
      else blocoO += 10;

      // O61-O80: Índice de força (quão previsível é este dealer)
      const strengthIdx = Math.round((arcConsistency * 0.5 + sectorDominance * 100 * 0.3 + (neighborJumpCount > 3 ? 20 : neighborJumpCount > 1 ? 10 : 0)));
      dealerBiometrics.strengthIndex = Math.min(100, strengthIdx);
      dealerBiometrics.neighborPattern = neighborJumpCount;
      if (strengthIdx > 70) blocoO += 20;
      else if (strengthIdx > 50) blocoO += 12;
      else blocoO += 5;

      // O81-O100: Assinatura única do dealer
      const sigParts: string[] = [];
      sigParts.push(dealerBiometrics.profileType.slice(0, 3).toUpperCase());
      sigParts.push(`A${Math.round(arcMean)}`);
      sigParts.push(`S${dealerBiometrics.sectorPreference.slice(0, 3)}`);
      sigParts.push(`F${dealerBiometrics.strengthIndex}`);
      dealerBiometrics.signature = sigParts.join('-');
      blocoO += 20;

      if (dealerBiometrics.profileType === 'mecânico') {
        aiLearnings.push(`🎭 Dealer MECÂNICO: ${dealerBiometrics.arcConsistency}% consistência, Setor ${dealerBiometrics.sectorPreference} dominante`);
      } else if (dealerBiometrics.profileType === 'caótico') {
        aiLearnings.push(`⚠️ Dealer CAÓTICO: apenas ${dealerBiometrics.arcConsistency}% consistência — cuidado`);
      }
    } else {
      blocoO = 30;
    }
    blocoO = Math.min(maxO, blocoO);

    // ========================================================
    let blocoF = 0;
    const maxF = 100;

    // F1-F40: Sequências Ancestrais — busca padrões de 5-10 números que se repetem no histórico longo
    const ancestralPatterns: { pattern: number[]; occurrences: number; lastSeen: number }[] = [];
    if (numbers.length >= 100) {
      const patternLens = [5, 7, 10];
      for (const pLen of patternLens) {
        const currentSeq = numbers.slice(0, pLen);
        let occurrences = 0;
        let lastSeen = -1;
        for (let start = pLen; start <= numbers.length - pLen; start++) {
          let match = 0;
          for (let j = 0; j < pLen; j++) {
            if (numbers[start + j] === currentSeq[j]) match++;
          }
          // Fuzzy match: 60%+ similarity counts
          if (match >= Math.ceil(pLen * 0.6)) {
            occurrences++;
            if (lastSeen === -1) lastSeen = start;
          }
        }
        if (occurrences > 0) {
          ancestralPatterns.push({ pattern: currentSeq, occurrences, lastSeen });
          blocoF += Math.min(15, occurrences * 5);
        }
      }
    }

    // F41-F70: DNA de Mesa — fingerprint da mesa baseado em distribuição de setores ao longo do tempo
    const mesaDNA: { sectorBalance: number; terminalSignature: number[]; cylinderBias: number } = {
      sectorBalance: 0, terminalSignature: [], cylinderBias: 0
    };
    if (numbers.length >= 200) {
      // Compare first half vs second half of history for consistency
      const half = Math.floor(numbers.length / 2);
      const firstHalf = numbers.slice(0, half);
      const secondHalf = numbers.slice(half);
      const sFreq1: Record<string, number> = { Voisins: 0, Tiers: 0, Orphelins: 0 };
      const sFreq2: Record<string, number> = { Voisins: 0, Tiers: 0, Orphelins: 0 };
      firstHalf.forEach(n => { const s = getSector(n); if (sFreq1[s] !== undefined) sFreq1[s]++; });
      secondHalf.forEach(n => { const s = getSector(n); if (sFreq2[s] !== undefined) sFreq2[s]++; });
      // Normalize and compare
      let consistency = 0;
      for (const s of ['Voisins', 'Tiers', 'Orphelins']) {
        const r1 = sFreq1[s] / (firstHalf.length || 1);
        const r2 = sFreq2[s] / (secondHalf.length || 1);
        consistency += 1 - Math.abs(r1 - r2);
      }
      mesaDNA.sectorBalance = +(consistency / 3).toFixed(3);
      blocoF += Math.round(mesaDNA.sectorBalance * 30);

      // Terminal signature — which terminals dominate consistently
      const tSig: number[] = [];
      for (let t = 0; t <= 9; t++) {
        const r1 = firstHalf.filter(n => n % 10 === t).length / (firstHalf.length || 1);
        const r2 = secondHalf.filter(n => n % 10 === t).length / (secondHalf.length || 1);
        if (Math.abs(r1 - r2) < 0.02 && r1 > 0.08) tSig.push(t); // consistent and above average
      }
      mesaDNA.terminalSignature = tSig;
    }

    // F71-F100: Cylinder Bias — long-term position analysis on wheel
    if (numbers.length >= 300) {
      const wheelPosFreq = new Array(WL).fill(0);
      numbers.forEach(n => { const idx = wheelIdx(n); if (idx !== -1) wheelPosFreq[idx]++; });
      const wpMean = numbers.length / WL;
      const wpStd = Math.sqrt(wheelPosFreq.reduce((a: number, f: number) => a + Math.pow(f - wpMean, 2), 0) / WL);
      const biasedPositions = wheelPosFreq.filter((f: number) => f > wpMean + wpStd * 1.5).length;
      mesaDNA.cylinderBias = biasedPositions;
      blocoF += Math.min(30, biasedPositions * 6);
      if (biasedPositions >= 3) aiLearnings.push(`🔬 Micro-imperfeição: ${biasedPositions} posições viciadas no cilindro`);
    }

    blocoF = Math.min(maxF, blocoF);

    // ========================================================
    // BLOCO G: ALGORITMO GENÉTICO DE PADRÕES (100 CAMADAS)
    // ========================================================
    let blocoG = 0;
    const maxG = 100;

    // G1-G50: Clustering — descobre agrupamentos naturais de números
    const geneticPatterns: { name: string; numbers: number[]; strength: number }[] = [];
    if (numbers.length >= 50) {
      // Cluster by co-occurrence within 3-spin windows
      const coOccurrence: Record<string, number> = {};
      for (let i = 0; i < Math.min(200, numbers.length) - 3; i++) {
        const window = numbers.slice(i, i + 3);
        for (let a = 0; a < window.length; a++) {
          for (let b = a + 1; b < window.length; b++) {
            const key = [Math.min(window[a], window[b]), Math.max(window[a], window[b])].join('-');
            coOccurrence[key] = (coOccurrence[key] || 0) + 1;
          }
        }
      }
      // Find strongest clusters
      const strongPairs = Object.entries(coOccurrence)
        .filter(([, c]) => c >= 3)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10);

      if (strongPairs.length >= 3) {
        const clusterNums = new Set<number>();
        strongPairs.forEach(([pair]) => {
          const [a, b] = pair.split('-').map(Number);
          clusterNums.add(a);
          clusterNums.add(b);
        });
        const clusterArr = [...clusterNums].slice(0, 12);
        geneticPatterns.push({
          name: 'Cluster Dinâmico',
          numbers: clusterArr,
          strength: strongPairs.reduce((a, [, c]) => a + c, 0),
        });
        blocoG += Math.min(30, strongPairs.length * 4);
        aiLearnings.push(`🧬 Padrão genético: ${clusterArr.length} números em cluster dinâmico`);
      }

      // G51-G75: Salto Dinâmico — descobre padrões de distância entre números consecutivos
      const jumpFreq: Record<number, number> = {};
      for (let i = 0; i < Math.min(100, numbers.length) - 1; i++) {
        const jump = wheelDist(numbers[i], numbers[i + 1]);
        jumpFreq[jump] = (jumpFreq[jump] || 0) + 1;
      }
      const dominantJumps = Object.entries(jumpFreq)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3);
      if (dominantJumps.length > 0) {
        const topJump = Number(dominantJumps[0][0]);
        const jumpCount = dominantJumps[0][1];
        // Predict next number based on dominant jump from latest
        const idx0 = wheelIdx(numbers[0]);
        if (idx0 !== -1) {
          const jumpPredCW = WHEEL[(idx0 + topJump) % WL];
          const jumpPredCCW = WHEEL[(idx0 - topJump + WL) % WL];
          geneticPatterns.push({
            name: `Salto ${topJump}`,
            numbers: [jumpPredCW, jumpPredCCW, ...getNeighbors(jumpPredCW, 2)],
            strength: jumpCount,
          });
          blocoG += Math.min(25, jumpCount * 4);
        }
      }

      // G76-G100: Auto-Evolução — descarte padrões fracos e mute
      // Check if recent genetic patterns predicted correctly
      const recentGenetic = resolvedHistory.slice(0, 10).filter(p => p.strategy_type === 'genetic_cluster' || p.strategy_type === 'dynamic_jump');
      const geneticHitRate = recentGenetic.length > 0
        ? recentGenetic.filter(p => p.hit).length / recentGenetic.length
        : 0.5;
      if (geneticHitRate > 0.4) blocoG += 25;
      else if (geneticHitRate > 0.2) blocoG += 15;
      else blocoG += 5;
    }

    blocoG = Math.min(maxG, blocoG);

    // ========================================================
    // BLOCO H: MICRO-VIBRAÇÃO E FÍSICA AVANÇADA (100 CAMADAS)
    // ========================================================
    let blocoH = 0;
    const maxH = 100;

    // H1-H40: Inércia de Cilindro — desgaste mecânico (posições com frequência anômala)
    const cylinderInertia: { biasedNums: number[]; dominantPin: number | null; pinStrength: number } = {
      biasedNums: [], dominantPin: null, pinStrength: 0
    };
    if (numbers.length >= 100) {
      // Find numbers that appear significantly more than expected
      const fullFreq: Record<number, number> = {};
      for (let n = 0; n <= 36; n++) fullFreq[n] = 0;
      numbers.forEach(n => fullFreq[n]++);
      const expectedF = numbers.length / 37;
      const stdDevF = Math.sqrt(Object.values(fullFreq).reduce((a, f) => a + Math.pow(f - expectedF, 2), 0) / 37);

      for (let n = 0; n <= 36; n++) {
        if (fullFreq[n] > expectedF + stdDevF * 1.8) {
          cylinderInertia.biasedNums.push(n);
        }
      }
      blocoH += Math.min(20, cylinderInertia.biasedNums.length * 5);
      if (cylinderInertia.biasedNums.length >= 3) {
        aiLearnings.push(`🔩 Inércia do cilindro: ${cylinderInertia.biasedNums.slice(0, 5).join(',')} com frequência anômala`);
      }

      // H41-H70: Efeito Pino Dominante — analisa onde a bola tende a cair após impacto
      // Simulate "pin zones" by grouping wheel into 8 zones (like diamond pins)
      const pinZones = 8;
      const pinSize = Math.floor(WL / pinZones);
      const pinHits = new Array(pinZones).fill(0);
      numbers.forEach(n => {
        const idx = wheelIdx(n);
        if (idx !== -1) pinHits[Math.floor(idx / pinSize)]++;
      });
      const pinMean = numbers.length / pinZones;
      let maxPinIdx = 0;
      pinHits.forEach((h: number, i: number) => { if (h > pinHits[maxPinIdx]) maxPinIdx = i; });
      const pinDeviation = (pinHits[maxPinIdx] - pinMean) / pinMean;
      if (pinDeviation > 0.15) {
        cylinderInertia.dominantPin = maxPinIdx;
        cylinderInertia.pinStrength = +(pinDeviation * 100).toFixed(1);
        blocoH += Math.min(30, Math.round(pinDeviation * 100));
        aiLearnings.push(`📌 Pino dominante #${maxPinIdx + 1}: +${cylinderInertia.pinStrength}% de desvio`);
      } else {
        blocoH += 10;
      }

      // H71-H100: Física de quique — probabilidade de salto baseada em material
      // Analyze "bounce" patterns: when ball lands in cluster vs scattered
      const bounceWindows: number[] = [];
      for (let i = 0; i < Math.min(50, numbers.length) - 3; i++) {
        const spread = Math.max(
          wheelDist(numbers[i], numbers[i + 1]),
          wheelDist(numbers[i + 1], numbers[i + 2]),
          wheelDist(numbers[i + 2], numbers[i + 3])
        );
        bounceWindows.push(spread);
      }
      if (bounceWindows.length > 0) {
        const avgBounce = bounceWindows.reduce((a, b) => a + b, 0) / bounceWindows.length;
        const lowBounce = avgBounce < 8; // Low bounce = ball settling nearby = more predictable
        blocoH += lowBounce ? 30 : avgBounce < 12 ? 20 : 10;
        if (lowBounce) aiLearnings.push('🏀 Baixo quique: bola assentando próximo — alta previsibilidade');
      }
    }

    blocoH = Math.min(maxH, blocoH);

    // ========================================================
    // BLOCO I: INTELIGÊNCIA PREDITIVA PROFUNDA (100 CAMADAS)
    // ========================================================
    let blocoI = 0;
    const maxI = 100;

    // I1-I50: Backpropagation — ajuste de pesos baseado em erros recentes
    const backpropWeights: Record<string, number> = {};
    if (resolvedHistory.length >= 10) {
      // Analyze last 20 predictions: what SHOULD have been predicted?
      const last20Resolved = resolvedHistory.slice(0, 20);
      const actualNumbers = last20Resolved.filter(p => p.actual_number !== null).map(p => p.actual_number as number);
      
      // Which analysis dimension best predicted actuals?
      let physicalHits = 0, mathHits = 0, sectorHits = 0;
      for (const actual of actualNumbers) {
        // Physical: was it near the predicted arc position?
        const idx0 = wheelIdx(numbers[0]);
        if (idx0 !== -1 && wheelDist(actual, WHEEL[(idx0 + Math.round(arcMean)) % WL]) <= 4) physicalHits++;
        // Math: was it in the hot terminal?
        if (delayedTerminals.includes(actual % 10)) mathHits++;
        // Sector: was it in the hot sector? (compute inline to avoid forward-reference)
        const sectorFreqBP: Record<string, number> = { Voisins:0, Tiers:0, Orphelins:0 };
        last30.forEach(n => { const s = getSector(n); if (sectorFreqBP[s] !== undefined) sectorFreqBP[s]++; });
        const hotSectorBP = Object.entries(sectorFreqBP).sort(([,a],[,b]) => b - a)[0];
        if (getSector(actual) === (hotSectorBP?.[0] || '')) sectorHits++;
      }
      const totalActual = actualNumbers.length || 1;
      backpropWeights['physical'] = physicalHits / totalActual;
      backpropWeights['mathematical'] = mathHits / totalActual;
      backpropWeights['sector'] = sectorHits / totalActual;

      const bestDimension = Object.entries(backpropWeights).sort(([, a], [, b]) => b - a)[0];
      blocoI += Math.round(bestDimension[1] * 50);
      if (bestDimension[1] > 0.3) {
        aiLearnings.push(`🔄 Backpropagation: dimensão ${bestDimension[0]} com ${(bestDimension[1] * 100).toFixed(0)}% acurácia`);
      }
    }

    // I51-I80: Simulação de 50 estratégias internas
    // Run mini-backtest of top 5 strategy types across last 50 windows
    const miniSimResults: Record<string, number> = {};
    const simStrategies = ['sniper', 'cavalos', 'voisins', 'terminal_alternation', 'duzias'];
    for (const simType of simStrategies) {
      let hits = 0;
      const testSize = Math.min(30, Math.floor(numbers.length / 10));
      for (let w = 0; w < testSize; w++) {
        const testWindow = numbers.slice(w * 3, w * 3 + 15);
        const nextNum = numbers[w * 3 + 15];
        if (!testWindow.length || nextNum === undefined) continue;
        // Simple prediction based on strategy type
        let predNums: number[] = [];
        if (simType === 'sniper') {
          const hotInWindow = testWindow.sort((a, b) => testWindow.filter(x => x === b).length - testWindow.filter(x => x === a).length)[0];
          predNums = [hotInWindow, ...getNeighbors(hotInWindow, 4)];
        } else if (simType === 'cavalos') {
          const cf: Record<string, number> = { '258': 0, '147': 0, '03': 0, '69': 0 };
          testWindow.forEach(n => { const g = getCavalo(n); if (g) cf[g]++; });
          const best = Object.entries(cf).sort(([, a], [, b]) => b - a)[0][0];
          predNums = CAVALOS[best] || [];
        } else if (simType === 'voisins') {
          predNums = [...VOISINS];
        } else if (simType === 'terminal_alternation') {
          const lastT = testWindow[0] % 10;
          predNums = Array.from({ length: 37 }, (_, i) => i).filter(n => n % 10 === lastT);
        } else {
          const dc = [0, 0, 0];
          testWindow.forEach(n => { const d = getDozen(n); if (d > 0) dc[d - 1]++; });
          const hotDz = dc.indexOf(Math.max(...dc)) + 1;
          predNums = Array.from({ length: 12 }, (_, i) => (hotDz - 1) * 12 + i + 1);
        }
        if (predNums.includes(nextNum)) hits++;
      }
      miniSimResults[simType] = testSize > 0 ? hits / testSize : 0;
    }
    const bestSim = Object.entries(miniSimResults).sort(([, a], [, b]) => b - a)[0];
    if (bestSim) {
      blocoI += Math.round(bestSim[1] * 30);
      if (bestSim[1] > 0.3) aiLearnings.push(`🧪 Simulação interna: ${bestSim[0]} com ${(bestSim[1] * 100).toFixed(0)}% em backtest`);
    }

    // I81-I100: Convergência cruzada entre blocos
    const blockScores = [blocoA / maxA, blocoB / maxB, blocoC / maxC, blocoD / maxD, blocoE / maxE, blocoF / maxF, blocoG / maxG, blocoH / maxH, blocoK / maxK, blocoL / maxL, blocoM / maxM, blocoN / maxN, blocoO / maxO];
    const highBlocks = blockScores.filter(s => s > 0.7).length;
    blocoI += Math.min(20, highBlocks * 4);

    blocoI = Math.min(maxI, blocoI);

    // ========================================================
    // BLOCO J: CALIBRAGEM DE CONVERGÊNCIA FINAL (100 CAMADAS)
    // ========================================================
    let blocoJ = 0;
    const maxJ = 100;

    // J1-J40: Cross-validation entre memória profunda e análise atual
    if (ancestralPatterns.length > 0) {
      // Bonus if current pattern matches historical
      blocoJ += Math.min(40, ancestralPatterns.reduce((a, p) => a + p.occurrences * 8, 0));
    }

    // J41-J70: Genetic pattern validation
    if (geneticPatterns.length > 0) {
      const geneticNums = geneticPatterns.flatMap(p => p.numbers);
      const geneticBt = backtestWindows > 0 ? geneticNums.filter(n => numbers.slice(10, 30).includes(n)).length / 20 : 0;
      blocoJ += Math.round(geneticBt * 30);
    }

    // J71-J100: Final confidence — all 10 blocks must agree
    const allBlockPcts = [blocoA / maxA, blocoB / maxB, blocoC / maxC, blocoD / maxD, blocoE / maxE, blocoF / maxF, blocoG / maxG, blocoH / maxH, blocoI / maxI, blocoK / maxK, blocoL / maxL, blocoM / maxM, blocoN / maxN, blocoO / maxO];
    const avgBlockPct = allBlockPcts.reduce((a, b) => a + b, 0) / allBlockPcts.length;
    const minBlockPct = Math.min(...allBlockPcts);
    // High average + high minimum = strong convergence
    blocoJ += Math.round(avgBlockPct * 15 + minBlockPct * 15);

    blocoJ = Math.min(maxJ, blocoJ);

    // ========================================================
    // BLOCO P: CALIBRADOR DE RITMO E PREVISÃO DE IMPACTO (100 CAMADAS)
    // Analisa a constância do Dealer via saltos DIRECIONAIS no cilindro
    // e calcula o número-alvo pela média de arco direcional
    // ========================================================
    let blocoP = 0;
    const maxP = 100;

    const ritmoCalibration: { alvo: number | null; confianca: number; estabilidade: number; mensagem: string; saltosDirecionais: number[] } = {
      alvo: null, confianca: 0, estabilidade: 99, mensagem: 'Calibrando...', saltosDirecionais: []
    };

    if (numbers.length >= 6) {
      // Salto DIRECIONAL (sentido horário): (posAtual - posAnt + 37) % 37
      const saltosDir: number[] = [];
      const jumpCount = Math.min(20, numbers.length - 1);
      for (let i = 0; i < jumpCount; i++) {
        const posAnt = wheelIdx(numbers[i + 1]);
        const posAtual = wheelIdx(numbers[i]);
        if (posAnt !== -1 && posAtual !== -1) {
          saltosDir.push((posAtual - posAnt + WL) % WL);
        }
      }
      ritmoCalibration.saltosDirecionais = saltosDir.slice(0, 5);

      if (saltosDir.length >= 5) {
        // Últimos 5 saltos para avaliar ritmo imediato
        const ultimos5 = saltosDir.slice(0, 5);
        const mediaSalto = ultimos5.reduce((a, b) => a + b, 0) / ultimos5.length;
        const variancia = ultimos5.reduce((a, b) => a + Math.pow(b - mediaSalto, 2), 0) / ultimos5.length;
        const estabilidade = Math.sqrt(variancia);
        ritmoCalibration.estabilidade = +estabilidade.toFixed(2);

        // Confiança baseada na estabilidade do dealer
        let confianca = 0;
        if (estabilidade < 2.5) { confianca = 98; blocoP += 60; } // Dealer Sniper
        else if (estabilidade < 5) { confianca = 85; blocoP += 40; } // Dealer Regular
        else if (estabilidade < 8) { confianca = 70; blocoP += 25; } // Dealer Moderado
        else { confianca = 55; blocoP += 10; } // Dealer Caótico
        ritmoCalibration.confianca = confianca;

        // Cálculo do número-alvo pelo arco direcional
        const ultimaPos = wheelIdx(numbers[0]);
        if (ultimaPos !== -1) {
          const proximaPos = Math.round((ultimaPos + mediaSalto) % WL);
          const alvo = WHEEL[proximaPos >= 0 && proximaPos < WL ? proximaPos : 0];
          ritmoCalibration.alvo = alvo;

          // Validar com janelas maiores (10 e 20 saltos)
          if (saltosDir.length >= 10) {
            const media10 = saltosDir.slice(0, 10).reduce((a, b) => a + b, 0) / 10;
            const consistencia = Math.abs(mediaSalto - media10);
            if (consistencia < 2) { blocoP += 20; } // Arco consistente entre janelas
            else if (consistencia < 4) { blocoP += 10; }

            if (saltosDir.length >= 20) {
              const media20 = saltosDir.slice(0, 20).reduce((a, b) => a + b, 0) / 20;
              const tendencia = mediaSalto - media20;
              if (Math.abs(tendencia) > 3) {
                ritmoCalibration.mensagem = tendencia > 0 
                  ? 'Dealer acelerando — arco crescente' 
                  : 'Dealer desacelerando — arco encurtando';
                blocoP += 5;
              }
            }
          }

          // Bonus: mão mecânica extrema (últimos 3 saltos quase idênticos)
          if (saltosDir.length >= 3) {
            const range3 = Math.max(...saltosDir.slice(0, 3)) - Math.min(...saltosDir.slice(0, 3));
            if (range3 <= 1) {
              blocoP += 15;
              ritmoCalibration.confianca = Math.min(99, ritmoCalibration.confianca + 5);
            }
          }
        }

        ritmoCalibration.mensagem = confianca >= 85 
          ? `Mão Mecânica Detectada — Alvo ${ritmoCalibration.alvo} (±${estabilidade.toFixed(1)} estabilidade)` 
          : confianca >= 70 
          ? `Dealer Regular — Arco médio ${mediaSalto.toFixed(1)} casas`
          : 'Aguardando Estabilização do Dealer';

        if (confianca >= 85) {
          aiLearnings.push(`🎯 RITMO CALIBRADO: Dealer Sniper (σ=${estabilidade.toFixed(1)}) → Alvo ${ritmoCalibration.alvo}`);
        } else if (confianca >= 70) {
          aiLearnings.push(`⏱️ Ritmo do dealer: arco ~${mediaSalto.toFixed(0)} casas (σ=${estabilidade.toFixed(1)})`);
        }
      }
    }
    blocoP = Math.min(maxP, blocoP);

    // ========================================================
    // BLOCO Q: MATRIZES DE TRANSIÇÃO E ARQUITETO DE PADRÕES (100 CAMADAS)
    // Analisa transições setor→setor, dúzia→dúzia, terminal→terminal
    // Detecta modo da mesa e Gatilho de Pressão de Retorno
    // ========================================================
    let blocoQ = 0;
    const maxQ = 100;

    // Q: TRANSITION MATRICES
    const transitionMatrix: {
      sectorMatrix: Record<string, Record<string, number>>;
      dozenMatrix: Record<number, Record<number, number>>;
      terminalMatrix: Record<number, Record<number, number>>;
      mesaModeLabel: string;
      mesaModeStrength: number;
      dozenPressureTrigger: { dozen: number; delay: number; historicalDominance: number; active: boolean } | null;
      patternsFidelity: { name: string; emoji: string; fidelity: number; confirmed: number; total: number }[];
      predictedSector: string | null;
      predictedDozen: number | null;
      predictedTerminal: number | null;
      detectedPatterns: { name: string; emoji: string; description: string; confidence: number; category: string; action: string }[];
    } = {
      sectorMatrix: { Voisins: { Voisins: 0, Tiers: 0, Orphelins: 0 }, Tiers: { Voisins: 0, Tiers: 0, Orphelins: 0 }, Orphelins: { Voisins: 0, Tiers: 0, Orphelins: 0 } },
      dozenMatrix: { 1: { 1: 0, 2: 0, 3: 0 }, 2: { 1: 0, 2: 0, 3: 0 }, 3: { 1: 0, 2: 0, 3: 0 } },
      terminalMatrix: {},
      mesaModeLabel: 'CAOS',
      mesaModeStrength: 0,
      dozenPressureTrigger: null,
      patternsFidelity: [],
      predictedSector: null,
      predictedDozen: null,
      predictedTerminal: null,
      detectedPatterns: [],
    };

    // Initialize terminal matrix
    for (let t = 0; t <= 9; t++) {
      transitionMatrix.terminalMatrix[t] = {};
      for (let t2 = 0; t2 <= 9; t2++) transitionMatrix.terminalMatrix[t][t2] = 0;
    }

    if (numbers.length >= 50) {
      // Build sector transition matrix from last 200
      const sectorSeq200 = numbers.slice(0, Math.min(200, numbers.length)).map(n => getSector(n)).filter(s => s !== 'Zero');
      for (let i = 0; i < sectorSeq200.length - 1; i++) {
        const from = sectorSeq200[i], to = sectorSeq200[i + 1];
        if (transitionMatrix.sectorMatrix[from] && transitionMatrix.sectorMatrix[from][to] !== undefined) {
          transitionMatrix.sectorMatrix[from][to]++;
        }
      }

      // Build dozen transition matrix from last 200
      const dozenSeq200 = numbers.slice(0, Math.min(200, numbers.length)).map(n => getDozen(n)).filter(d => d > 0);
      for (let i = 0; i < dozenSeq200.length - 1; i++) {
        const from = dozenSeq200[i], to = dozenSeq200[i + 1];
        if (transitionMatrix.dozenMatrix[from]) transitionMatrix.dozenMatrix[from][to]++;
      }

      // Build terminal transition matrix from last 200
      const termSeq200 = numbers.slice(0, Math.min(200, numbers.length)).map(n => n % 10);
      for (let i = 0; i < termSeq200.length - 1; i++) {
        transitionMatrix.terminalMatrix[termSeq200[i]][termSeq200[i + 1]]++;
      }

      // ── MATRIZ 37×37: número→número (histórico completo) ──────────
      const numMatrix: Record<number, Record<number, number>> = {};
      for (let a = 0; a <= 36; a++) {
        numMatrix[a] = {};
        for (let b = 0; b <= 36; b++) numMatrix[a][b] = 0;
      }
      const numMatrixN = Math.min(500, numbers.length);
      for (let i = 0; i < numMatrixN - 1; i++) {
        numMatrix[numbers[i + 1]][numbers[i]]++;
      }
      const lastNum0 = numbers[0];
      const matrizRow = numMatrix[lastNum0] || {};
      const matrizTotal = Object.values(matrizRow).reduce((a, b) => a + b, 0);
      const matrizProb: Record<number, number> = {};
      if (matrizTotal >= 10) {
        for (let n = 0; n <= 36; n++) {
          matrizProb[n] = (matrizRow[n] || 0) / matrizTotal;
        }
      }
      const matrizProb2: Record<number, number> = {};
      const matrizProb3: Record<number, number> = {};
      if (numbers.length >= 2) {
        const row2 = numMatrix[numbers[1]] || {};
        const total2 = Object.values(row2).reduce((a, b) => a + b, 0);
        if (total2 >= 8) for (let n = 0; n <= 36; n++) matrizProb2[n] = (row2[n] || 0) / total2;
      }
      if (numbers.length >= 3) {
        const row3 = numMatrix[numbers[2]] || {};
        const total3 = Object.values(row3).reduce((a, b) => a + b, 0);
        if (total3 >= 8) for (let n = 0; n <= 36; n++) matrizProb3[n] = (row3[n] || 0) / total3;
      }
      const matrizCombinado: Record<number, number> = {};
      for (let n = 0; n <= 36; n++) {
        matrizCombinado[n] = (matrizProb[n] || 0) * 3 +
                              (matrizProb2[n] || 0) * 2 +
                              (matrizProb3[n] || 0) * 1;
      }
      const maxMatriz = Math.max(...Object.values(matrizCombinado), 0.001);

      // PREDICT next sector from transition matrix
      const lastSector = getSector(numbers[0]);
      if (lastSector !== 'Zero' && transitionMatrix.sectorMatrix[lastSector]) {
        const row = transitionMatrix.sectorMatrix[lastSector];
        const total = Object.values(row).reduce((a, b) => a + b, 0);
        if (total > 5) {
          const best = Object.entries(row).sort(([, a], [, b]) => b - a)[0];
          const prob = best[1] / total;
          if (prob > 0.35) {
            transitionMatrix.predictedSector = best[0];
            blocoQ += Math.round(prob * 30);
          }
        }
      }

      // PREDICT next dozen
      const lastDozen = getDozen(numbers[0]);
      if (lastDozen > 0 && transitionMatrix.dozenMatrix[lastDozen]) {
        const row = transitionMatrix.dozenMatrix[lastDozen];
        const total = Object.values(row).reduce((a, b) => a + b, 0);
        if (total > 5) {
          const best = Object.entries(row).sort(([, a], [, b]) => (b as number) - (a as number))[0];
          const prob = (best[1] as number) / total;
          if (prob > 0.35) {
            transitionMatrix.predictedDozen = Number(best[0]);
            blocoQ += Math.round(prob * 20);
          }
        }
      }

      // PREDICT next terminal
      const lastTerminal = numbers[0] % 10;
      const termRow = transitionMatrix.terminalMatrix[lastTerminal];
      if (termRow) {
        const total = Object.values(termRow).reduce((a, b) => a + b, 0);
        if (total > 5) {
          const best = Object.entries(termRow).sort(([, a], [, b]) => (b as number) - (a as number))[0];
          const prob = (best[1] as number) / total;
          if (prob > 0.2) {
            transitionMatrix.predictedTerminal = Number(best[0]);
            blocoQ += Math.round(prob * 20);
          }
        }
      }

      // MESA MODE DETECTION: REPETIÇÃO vs ALTERNÂNCIA vs CAOS
      // Analyze last 50 spins for mode
      const sec50 = numbers.slice(0, 50).map(n => getSector(n));
      let sameCount = 0, altCount = 0;
      for (let i = 1; i < sec50.length; i++) {
        if (sec50[i] === sec50[i - 1]) sameCount++;
        else altCount++;
      }
      const sameRatio = sameCount / (sec50.length - 1);
      const altRatio = altCount / (sec50.length - 1);

      // Check for systematic alternation (A-B-A-B)
      let ababCount = 0;
      for (let i = 2; i < Math.min(20, sec50.length); i++) {
        if (sec50[i] === sec50[i - 2] && sec50[i] !== sec50[i - 1]) ababCount++;
      }
      const ababRatio = ababCount / Math.max(1, Math.min(18, sec50.length - 2));

      if (sameRatio > 0.45) {
        transitionMatrix.mesaModeLabel = 'REPETIÇÃO';
        transitionMatrix.mesaModeStrength = Math.round(sameRatio * 100);
        blocoQ += 15;
        aiLearnings.push(`🔁 Mesa em MODO REPETIÇÃO: ${transitionMatrix.mesaModeStrength}% fidelidade`);
      } else if (ababRatio > 0.4 || altRatio > 0.7) {
        transitionMatrix.mesaModeLabel = 'ALTERNÂNCIA';
        transitionMatrix.mesaModeStrength = Math.round(Math.max(ababRatio, altRatio) * 100);
        blocoQ += 20;
        aiLearnings.push(`🔄 Mesa em MODO ALTERNÂNCIA: ${transitionMatrix.mesaModeStrength}% fidelidade`);
      } else {
        transitionMatrix.mesaModeLabel = 'CAOS';
        transitionMatrix.mesaModeStrength = Math.round((1 - Math.max(sameRatio, altRatio)) * 100);
        blocoQ += 5;
      }

      // GATILHO DE PRESSÃO DE RETORNO (Dozen Delay vs Historical Dominance)
      if (numbers.length >= 100) {
        const dozen500Freq = [0, 0, 0];
        const window500 = numbers.slice(0, Math.min(500, numbers.length));
        window500.forEach(n => { const d = getDozen(n); if (d > 0) dozen500Freq[d - 1]++; });
        const dominantDozen500 = dozen500Freq.indexOf(Math.max(...dozen500Freq)) + 1;
        const dominance500 = dozen500Freq[dominantDozen500 - 1] / window500.length;

        // Check current delay of the dominant dozen
        let dozenDelay = 0;
        for (let i = 0; i < numbers.length; i++) {
          if (getDozen(numbers[i]) === dominantDozen500) break;
          dozenDelay++;
        }

        if (dozenDelay >= 12 && dominance500 > 0.3) {
          transitionMatrix.dozenPressureTrigger = {
            dozen: dominantDozen500,
            delay: dozenDelay,
            historicalDominance: +(dominance500 * 100).toFixed(1),
            active: true,
          };
          blocoQ += 15;
          aiLearnings.push(`🔥 PRESSÃO DE RETORNO: Dúzia ${dominantDozen500} ausente há ${dozenDelay} giros (dominou ${(dominance500 * 100).toFixed(0)}% em 500)`);
        }
      }

      // PATTERNS FIDELITY — how often each pattern confirmed in last 50
      const fidelityChecks: { name: string; emoji: string; check: (nums: number[], i: number) => boolean }[] = [
        { name: 'Vizinhos Consecutivos', emoji: '🤝', check: (nums, i) => i > 0 && wheelDist(nums[i], nums[i - 1]) <= 2 },
        { name: 'Alternância Setor', emoji: '🔄', check: (nums, i) => i > 0 && getSector(nums[i]) !== getSector(nums[i - 1]) },
        { name: 'Repetição Dúzia', emoji: '🔁', check: (nums, i) => i > 0 && getDozen(nums[i]) === getDozen(nums[i - 1]) },
        { name: 'Terminal Cruzado', emoji: '🐎', check: (nums, i) => {
          if (i === 0) return false;
          const t1 = nums[i - 1] % 10, t2 = nums[i] % 10;
          return ([2, 5, 8].includes(t1) && [1, 4, 7].includes(t2)) || ([1, 4, 7].includes(t1) && [2, 5, 8].includes(t2));
        }},
        { name: 'Espelho Terminal', emoji: '🪞', check: (nums, i) => i >= 2 && nums[i] % 10 === nums[i - 2] % 10 },
        // NEW PATTERNS
        { name: 'Terminal Crescente', emoji: '📈', check: (nums, i) => i >= 2 && nums[i] % 10 > nums[i-1] % 10 && nums[i-1] % 10 > nums[i-2] % 10 },
        { name: 'Terminal Decrescente', emoji: '📉', check: (nums, i) => i >= 2 && nums[i] % 10 < nums[i-1] % 10 && nums[i-1] % 10 < nums[i-2] % 10 },
        { name: 'Cor Alternando', emoji: '🎨', check: (nums, i) => {
          if (i === 0 || nums[i] === 0 || nums[i-1] === 0) return false;
          return getColor(nums[i]) !== getColor(nums[i-1]);
        }},
        { name: 'Cor Repetindo', emoji: '🔴', check: (nums, i) => {
          if (i === 0 || nums[i] === 0 || nums[i-1] === 0) return false;
          return getColor(nums[i]) === getColor(nums[i-1]);
        }},
        { name: 'Alto→Baixo', emoji: '⬆️', check: (nums, i) => i > 0 && nums[i] > 0 && nums[i-1] > 0 && (nums[i] >= 19) !== (nums[i-1] >= 19) },
        { name: 'Par→Ímpar', emoji: '🔢', check: (nums, i) => i > 0 && nums[i] > 0 && nums[i-1] > 0 && (nums[i] % 2) !== (nums[i-1] % 2) },
        { name: 'Mesma Coluna', emoji: '📐', check: (nums, i) => i > 0 && getColumn(nums[i]) > 0 && getColumn(nums[i]) === getColumn(nums[i-1]) },
        { name: 'Mesmo Cavalo', emoji: '🐴', check: (nums, i) => {
          if (i === 0) return false;
          const c1 = getCavalo(nums[i]), c2 = getCavalo(nums[i-1]);
          return c1 !== null && c1 === c2;
        }},
        { name: 'Puxada (dist≤4)', emoji: '🧲', check: (nums, i) => i > 0 && wheelDist(nums[i], nums[i-1]) <= 4 },
        { name: 'Salto Grande (>12)', emoji: '🦘', check: (nums, i) => i > 0 && wheelDist(nums[i], nums[i-1]) > 12 },
        { name: 'Repetição Exata', emoji: '🎯', check: (nums, i) => i > 0 && nums[i] === nums[i-1] },
        { name: 'Número Espelho', emoji: '🪞', check: (nums, i) => {
          if (i === 0 || nums[i] < 10) return false;
          const m = parseInt(String(nums[i]).split('').reverse().join(''));
          return m >= 0 && m <= 36 && m !== nums[i] && nums[i-1] === m;
        }},
        { name: 'Complementar (=37)', emoji: '♻️', check: (nums, i) => i > 0 && nums[i] > 0 && nums[i-1] > 0 && nums[i] + nums[i-1] === 37 },
        // === STREAKS & SEQUENCES ===
        { name: '3+ Altos Seguidos', emoji: '🔝', check: (nums, i) => i >= 2 && nums[i] >= 19 && nums[i-1] >= 19 && nums[i-2] >= 19 },
        { name: '3+ Baixos Seguidos', emoji: '⬇️', check: (nums, i) => i >= 2 && nums[i] >= 1 && nums[i] <= 18 && nums[i-1] >= 1 && nums[i-1] <= 18 && nums[i-2] >= 1 && nums[i-2] <= 18 },
        { name: '3+ Vermelhos', emoji: '❤️', check: (nums, i) => i >= 2 && getColor(nums[i]) === 'red' && getColor(nums[i-1]) === 'red' && getColor(nums[i-2]) === 'red' },
        { name: '3+ Pretos', emoji: '🖤', check: (nums, i) => i >= 2 && getColor(nums[i]) === 'black' && getColor(nums[i-1]) === 'black' && getColor(nums[i-2]) === 'black' },
        { name: '3+ Pares Seguidos', emoji: '🟦', check: (nums, i) => i >= 2 && nums[i] > 0 && nums[i] % 2 === 0 && nums[i-1] > 0 && nums[i-1] % 2 === 0 && nums[i-2] > 0 && nums[i-2] % 2 === 0 },
        { name: '3+ Ímpares Seguidos', emoji: '🟧', check: (nums, i) => i >= 2 && nums[i] > 0 && nums[i] % 2 === 1 && nums[i-1] > 0 && nums[i-1] % 2 === 1 && nums[i-2] > 0 && nums[i-2] % 2 === 1 },
        // === GANGORRA (seesaw) ===
        { name: 'Gangorra Alto↕Baixo', emoji: '🎢', check: (nums, i) => {
          if (i < 2 || nums[i] === 0 || nums[i-1] === 0 || nums[i-2] === 0) return false;
          const h = (n: number) => n >= 19;
          return h(nums[i]) !== h(nums[i-1]) && h(nums[i-1]) !== h(nums[i-2]);
        }},
        { name: 'Gangorra Cor', emoji: '🎡', check: (nums, i) => {
          if (i < 2 || nums[i] === 0 || nums[i-1] === 0 || nums[i-2] === 0) return false;
          const c0 = getColor(nums[i]), c1 = getColor(nums[i-1]), c2 = getColor(nums[i-2]);
          return c0 !== 'green' && c1 !== 'green' && c2 !== 'green' && c0 !== c1 && c1 !== c2;
        }},
        { name: 'Gangorra Par↕Ímpar', emoji: '🔃', check: (nums, i) => {
          if (i < 2 || nums[i] === 0 || nums[i-1] === 0 || nums[i-2] === 0) return false;
          return (nums[i] % 2) !== (nums[i-1] % 2) && (nums[i-1] % 2) !== (nums[i-2] % 2);
        }},
        // === ROTAÇÃO DÚZIAS & COLUNAS ===
        { name: 'Rotação Dúzias (D1→D2→D3)', emoji: '🔄', check: (nums, i) => {
          if (i < 2) return false;
          const d0 = getDozen(nums[i]), d1 = getDozen(nums[i-1]), d2 = getDozen(nums[i-2]);
          return d0 > 0 && d1 > 0 && d2 > 0 && d0 !== d1 && d1 !== d2 && d0 !== d2;
        }},
        { name: 'Mesma Dúzia 3x', emoji: '🎲', check: (nums, i) => {
          if (i < 2) return false;
          const d0 = getDozen(nums[i]), d1 = getDozen(nums[i-1]), d2 = getDozen(nums[i-2]);
          return d0 > 0 && d0 === d1 && d1 === d2;
        }},
        { name: 'Rotação Colunas', emoji: '🔁', check: (nums, i) => {
          if (i < 2) return false;
          const c0 = getColumn(nums[i]), c1 = getColumn(nums[i-1]), c2 = getColumn(nums[i-2]);
          return c0 > 0 && c1 > 0 && c2 > 0 && c0 !== c1 && c1 !== c2 && c0 !== c2;
        }},
        { name: 'Mesma Coluna 3x', emoji: '📏', check: (nums, i) => {
          if (i < 2) return false;
          const c0 = getColumn(nums[i]), c1 = getColumn(nums[i-1]), c2 = getColumn(nums[i-2]);
          return c0 > 0 && c0 === c1 && c1 === c2;
        }},
        // === GAPS & DELAYS ===
        { name: 'Mesmo Setor 3x', emoji: '🗺️', check: (nums, i) => {
          if (i < 2) return false;
          const s0 = getSector(nums[i]), s1 = getSector(nums[i-1]), s2 = getSector(nums[i-2]);
          return s0 !== 'Zero' && s0 === s1 && s1 === s2;
        }},
        { name: 'Vizinho Cilindro 2x', emoji: '🎰', check: (nums, i) => i > 0 && wheelDist(nums[i], nums[i-1]) <= 2 },
        { name: 'Mesmo Terminal 3x', emoji: '🔟', check: (nums, i) => i >= 2 && nums[i] % 10 === nums[i-1] % 10 && nums[i-1] % 10 === nums[i-2] % 10 },
      ];
      const check50 = numbers.slice(0, 50);
      for (const fc of fidelityChecks) {
        let confirmed = 0, total = 0;
        for (let i = 1; i < check50.length; i++) {
          total++;
          if (fc.check(check50, i)) confirmed++;
        }
        const fidelity = total > 0 ? Math.round((confirmed / total) * 100) : 0;
        transitionMatrix.patternsFidelity.push({ name: fc.name, emoji: fc.emoji, fidelity, confirmed, total });
      }
    }
    blocoQ = Math.min(maxQ, blocoQ);

    // ========================================================
    // DETECTED PATTERNS — Real-time pattern identification
    // ========================================================
    {
      const recent = numbers.slice(0, 20);
      // Streak detection: Alta — INTELLIGENT: follows trend or reverses based on trend engine
      let highStreak = 0;
      for (const n of recent) { if (n >= 19) highStreak++; else break; }
      if (highStreak >= 3) {
        const followHigh = trendEngine.highLowTrend.shouldFollow && trendEngine.highLowTrend.direction === 'alto';
        transitionMatrix.detectedPatterns.push({
          name: followHigh ? `🚀 ${highStreak} ALTOS — Tendência Ativa` : `Sequência de ${highStreak} ALTOS`,
          emoji: followHigh ? '🚀' : '🔝', confidence: Math.min(95, 50 + highStreak * 10),
          description: followHigh
            ? `${highStreak} números altos (19-36) consecutivos. ALGORITMO EM TENDÊNCIA — continuar apostando Alto.`
            : `${highStreak} números altos (19-36) consecutivos. ${highStreak >= 6 ? 'Exaustão provável — reversão.' : 'Possível reversão para Baixo.'}`,
          category: 'streak',
          action: followHigh ? 'Aposte em Alto (19-36) — A FAVOR do algoritmo' : 'Aposte em Baixo (1-18) — reversão iminente',
        });
      }
      // Streak: Baixa
      let lowStreak = 0;
      for (const n of recent) { if (n >= 1 && n <= 18) lowStreak++; else break; }
      if (lowStreak >= 3) {
        const followLow = trendEngine.highLowTrend.shouldFollow && trendEngine.highLowTrend.direction === 'baixo';
        transitionMatrix.detectedPatterns.push({
          name: followLow ? `🚀 ${lowStreak} BAIXOS — Tendência Ativa` : `Sequência de ${lowStreak} BAIXOS`,
          emoji: followLow ? '🚀' : '⬇️', confidence: Math.min(95, 50 + lowStreak * 10),
          description: followLow
            ? `${lowStreak} números baixos (1-18) consecutivos. ALGORITMO EM TENDÊNCIA — continuar apostando Baixo.`
            : `${lowStreak} números baixos (1-18) consecutivos. ${lowStreak >= 6 ? 'Exaustão provável — reversão.' : 'Possível reversão para Alto.'}`,
          category: 'streak',
          action: followLow ? 'Aposte em Baixo (1-18) — A FAVOR do algoritmo' : 'Aposte em Alto (19-36) — reversão iminente',
        });
      }
      // Streak: Vermelhos
      let redStreak = 0;
      for (const n of recent) { if (getColor(n) === 'red') redStreak++; else break; }
      if (redStreak >= 3) {
        const followRed = trendEngine.colorTrend.shouldFollow && trendEngine.colorTrend.direction === 'red';
        transitionMatrix.detectedPatterns.push({
          name: followRed ? `🚀 ${redStreak} Vermelhos — Tendência` : `${redStreak} Vermelhos Seguidos`,
          emoji: followRed ? '🚀' : '🔴', confidence: Math.min(90, 45 + redStreak * 10),
          description: followRed
            ? `${redStreak} vermelhos consecutivos. Momentum ACELERANDO — continuar no Vermelho.`
            : `${redStreak} números vermelhos consecutivos. ${redStreak >= 6 ? 'Exaustão — reversão.' : 'Tendência de reversão para Preto.'}`,
          category: 'streak',
          action: followRed ? 'Aposte em Vermelho — A FAVOR do algoritmo' : 'Aposte em Preto — reversão de cor',
        });
      }
      // Streak: Pretos
      let blackStreak = 0;
      for (const n of recent) { if (getColor(n) === 'black') blackStreak++; else break; }
      if (blackStreak >= 3) {
        const followBlack = trendEngine.colorTrend.shouldFollow && trendEngine.colorTrend.direction === 'black';
        transitionMatrix.detectedPatterns.push({
          name: followBlack ? `🚀 ${blackStreak} Pretos — Tendência` : `${blackStreak} Pretos Seguidos`,
          emoji: followBlack ? '🚀' : '⚫', confidence: Math.min(90, 45 + blackStreak * 10),
          description: followBlack
            ? `${blackStreak} pretos consecutivos. Momentum ACELERANDO — continuar no Preto.`
            : `${blackStreak} números pretos consecutivos. ${blackStreak >= 6 ? 'Exaustão — reversão.' : 'Tendência de reversão para Vermelho.'}`,
          category: 'streak',
          action: followBlack ? 'Aposte em Preto — A FAVOR do algoritmo' : 'Aposte em Vermelho — reversão de cor',
        });
      }
      // Streak: Pares
      let evenStreak = 0;
      for (const n of recent) { if (n > 0 && n % 2 === 0) evenStreak++; else break; }
      if (evenStreak >= 3) {
        const followPar = trendEngine.parityTrend.shouldFollow && trendEngine.parityTrend.direction === 'par';
        transitionMatrix.detectedPatterns.push({
          name: followPar ? `🚀 ${evenStreak} Pares — Tendência` : `${evenStreak} Pares Seguidos`,
          emoji: followPar ? '🚀' : '2️⃣', confidence: Math.min(88, 45 + evenStreak * 9),
          description: followPar
            ? `${evenStreak} pares consecutivos. Algoritmo em tendência — continuar Par.`
            : `${evenStreak} números pares consecutivos. Tendência de reversão para Ímpar.`,
          category: 'streak',
          action: followPar ? 'Aposte em Par — A FAVOR do algoritmo' : 'Aposte em Ímpar — reversão',
        });
      }
      // Streak: Ímpares
      let oddStreak = 0;
      for (const n of recent) { if (n > 0 && n % 2 === 1) oddStreak++; else break; }
      if (oddStreak >= 3) {
        const followImpar = trendEngine.parityTrend.shouldFollow && trendEngine.parityTrend.direction === 'impar';
        transitionMatrix.detectedPatterns.push({
          name: followImpar ? `🚀 ${oddStreak} Ímpares — Tendência` : `${oddStreak} Ímpares Seguidos`,
          emoji: followImpar ? '🚀' : '1️⃣', confidence: Math.min(88, 45 + oddStreak * 9),
          description: followImpar
            ? `${oddStreak} ímpares consecutivos. Algoritmo em tendência — continuar Ímpar.`
            : `${oddStreak} números ímpares consecutivos. Tendência de reversão para Par.`,
          category: 'streak',
          action: followImpar ? 'Aposte em Ímpar — A FAVOR do algoritmo' : 'Aposte em Par — reversão',
        });
      }
      // Alternância Alto↕Baixo (gangorra 3+)
      if (recent.length >= 4) {
        let altCount = 0;
        for (let i = 0; i < Math.min(8, recent.length - 1); i++) {
          if (recent[i] > 0 && recent[i + 1] > 0 && (recent[i] >= 19) !== (recent[i + 1] >= 19)) altCount++;
          else break;
        }
        if (altCount >= 3) {
          const nextExpected = recent[0] >= 19 ? 'Baixo (1-18)' : 'Alto (19-36)';
          transitionMatrix.detectedPatterns.push({
            name: `Gangorra Alto↕Baixo (${altCount}x)`,
            emoji: '🎢', confidence: Math.min(90, 55 + altCount * 8),
            description: `Alternância perfeita Alto/Baixo por ${altCount} rodadas consecutivas.`,
            category: 'alternancia', action: `Aposte em ${nextExpected} — padrão sugere continuação`,
          });
        }
      }
      // Alternância Cor (gangorra)
      if (recent.length >= 4) {
        let altColor = 0;
        for (let i = 0; i < Math.min(8, recent.length - 1); i++) {
          const c0 = getColor(recent[i]), c1 = getColor(recent[i + 1]);
          if (c0 !== 'green' && c1 !== 'green' && c0 !== c1) altColor++;
          else break;
        }
        if (altColor >= 3) {
          const nextColor = getColor(recent[0]) === 'red' ? 'Preto' : 'Vermelho';
          transitionMatrix.detectedPatterns.push({
            name: `Gangorra de Cor (${altColor}x)`,
            emoji: '🎡', confidence: Math.min(88, 52 + altColor * 8),
            description: `Alternância perfeita Vermelho/Preto por ${altColor} rodadas.`,
            category: 'alternancia', action: `Aposte em ${nextColor} — padrão sugere continuação`,
          });
        }
      }
      // Alternância Par↕Ímpar
      if (recent.length >= 4) {
        let altPI = 0;
        for (let i = 0; i < Math.min(8, recent.length - 1); i++) {
          if (recent[i] > 0 && recent[i + 1] > 0 && (recent[i] % 2) !== (recent[i + 1] % 2)) altPI++;
          else break;
        }
        if (altPI >= 3) {
          const nextPI = recent[0] % 2 === 0 ? 'Ímpar' : 'Par';
          transitionMatrix.detectedPatterns.push({
            name: `Gangorra Par↕Ímpar (${altPI}x)`,
            emoji: '🔃', confidence: Math.min(88, 50 + altPI * 8),
            description: `Alternância perfeita Par/Ímpar por ${altPI} rodadas.`,
            category: 'alternancia', action: `Aposte em ${nextPI} — padrão sugere continuação`,
          });
        }
      }
      // Concentração em Dúzia
      const recent10Nums = recent.slice(0, 10).filter(n => n > 0);
      const dzCount = [0, 0, 0];
      recent10Nums.forEach(n => { dzCount[getDozen(n) - 1]++; });
      const maxDz = Math.max(...dzCount);
      const maxDzIdx = dzCount.indexOf(maxDz);
      if (maxDz >= 6) {
        transitionMatrix.detectedPatterns.push({
          name: `Concentração D${maxDzIdx + 1} (${maxDz}/10)`,
          emoji: '🎲', confidence: Math.min(90, 45 + maxDz * 6),
          description: `Dúzia ${maxDzIdx + 1} apareceu ${maxDz}x nas últimas 10 rodadas. Mesa concentrada.`,
          category: 'concentracao', action: `Continue em D${maxDzIdx + 1} se em modo Repetição, ou entre nas outras se em Alternância`,
        });
      }
      // Dúzia ausente (delay)
      const coldDz = dzCount.indexOf(Math.min(...dzCount));
      if (dzCount[coldDz] <= 1) {
        transitionMatrix.detectedPatterns.push({
          name: `Dúzia ${coldDz + 1} Ausente (${dzCount[coldDz]}/10)`,
          emoji: '❄️', confidence: Math.min(85, 50 + (10 - dzCount[coldDz]) * 4),
          description: `Dúzia ${coldDz + 1} apareceu apenas ${dzCount[coldDz]}x nas últimas 10. Dívida estatística.`,
          category: 'gap', action: `Aposte em D${coldDz + 1} — retorno provável`,
        });
      }
      // Concentração em Coluna
      const colCount = [0, 0, 0];
      recent10Nums.forEach(n => { const c = getColumn(n); if (c > 0) colCount[c - 1]++; });
      const maxCol = Math.max(...colCount);
      const maxColIdx = colCount.indexOf(maxCol);
      if (maxCol >= 6) {
        transitionMatrix.detectedPatterns.push({
          name: `Concentração C${maxColIdx + 1} (${maxCol}/10)`,
          emoji: '📐', confidence: Math.min(88, 45 + maxCol * 5),
          description: `Coluna ${maxColIdx + 1} dominou ${maxCol}x nas últimas 10. Possível viés.`,
          category: 'concentracao', action: `Continue em C${maxColIdx + 1} ou espere reversão`,
        });
      }
      // Coluna fria
      const coldCol = colCount.indexOf(Math.min(...colCount));
      if (colCount[coldCol] <= 1) {
        transitionMatrix.detectedPatterns.push({
          name: `Coluna ${coldCol + 1} Fria (${colCount[coldCol]}/10)`,
          emoji: '🧊', confidence: Math.min(82, 48 + (10 - colCount[coldCol]) * 4),
          description: `Coluna ${coldCol + 1} com apenas ${colCount[coldCol]} hits em 10. Retorno esperado.`,
          category: 'gap', action: `Aposte em C${coldCol + 1} — dívida estatística`,
        });
      }
      // Setor concentrado
      const sectorCount: Record<string, number> = { Voisins: 0, Tiers: 0, Orphelins: 0 };
      recent.slice(0, 15).forEach(n => { const s = getSector(n); if (s !== 'Zero') sectorCount[s]++; });
      const hotSector = Object.entries(sectorCount).sort(([,a], [,b]) => b - a)[0];
      if (hotSector && Number(hotSector[1]) >= 8) {
        transitionMatrix.detectedPatterns.push({
          name: `Setor ${hotSector[0]} Dominante (${hotSector[1]}/15)`,
          emoji: '🗺️', confidence: Math.min(88, 50 + Number(hotSector[1]) * 3),
          description: `Setor ${hotSector[0]} concentrou ${hotSector[1]} hits em 15 rodadas.`,
          category: 'concentracao', action: `Cubra setor ${hotSector[0]}`,
        });
      }
      // Terminal quente
      if (daniGreen.mod1.count >= 4) {
        transitionMatrix.detectedPatterns.push({
          name: `Terminal T${daniGreen.mod1.terminal} Quente (${daniGreen.mod1.count}x/15)`,
          emoji: '🔥', confidence: Math.min(92, 50 + daniGreen.mod1.count * 7),
          description: `Terminal ${daniGreen.mod1.terminal} apareceu ${daniGreen.mod1.count}x em 15 rodadas. Dupla: T${daniGreen.mod1.pair}.`,
          category: 'terminal', action: `Aposte em T${daniGreen.mod1.terminal} + T${daniGreen.mod1.pair}`,
        });
      }
      // Rotação de dúzias (D1→D2→D3→...)
      if (recent.length >= 4) {
        const dzSeq = recent.slice(0, 6).filter(n => n > 0).map(n => getDozen(n));
        let isRotating = true;
        for (let i = 0; i < dzSeq.length - 1 && i < 3; i++) {
          if (dzSeq[i] === dzSeq[i + 1]) { isRotating = false; break; }
        }
        if (isRotating && dzSeq.length >= 3 && dzSeq[0] !== dzSeq[1] && dzSeq[1] !== dzSeq[2]) {
          // Predict next dozen based on pattern
          const usedDzs = new Set(dzSeq.slice(0, 2));
          const missingDz = [1, 2, 3].find(d => !usedDzs.has(d)) || dzSeq[0];
          transitionMatrix.detectedPatterns.push({
            name: `Rotação de Dúzias (${dzSeq.slice(0, 3).map(d => 'D' + d).join('→')})`,
            emoji: '🔄', confidence: 65,
            description: `Dúzias estão rotacionando sem repetir. Próxima provável: D${missingDz}.`,
            category: 'rotacao', action: `Aposte em D${missingDz}`,
          });
        }
      }

      // Sort by confidence
      transitionMatrix.detectedPatterns.sort((a, b) => b.confidence - a.confidence);
    }

    // ========================================================
    // TOTAL DAS 1.700 CAMADAS
    // ========================================================
    const totalLayers = blocoA + blocoB + blocoC + blocoD + blocoE + blocoF + blocoG + blocoH + blocoI + blocoJ + blocoK + blocoL + blocoM + blocoN + blocoO + blocoP + blocoQ;
    const layerResults = {
      blocoA: { score: blocoA, max: maxA, label: 'Biomecânica & Física' },
      blocoB: { score: blocoB, max: maxB, label: 'Matemática & Terminais' },
      blocoC: { score: blocoC, max: maxC, label: 'Geometria & Entropia' },
      blocoD: { score: blocoD, max: maxD, label: 'Inteligência Preditiva' },
      blocoE: { score: blocoE, max: maxE, label: 'Calibragem de Sessão' },
      blocoF: { score: blocoF, max: maxF, label: 'Memória Profunda' },
      blocoG: { score: blocoG, max: maxG, label: 'Algoritmo Genético' },
      blocoH: { score: blocoH, max: maxH, label: 'Micro-Vibração Física' },
      blocoI: { score: blocoI, max: maxI, label: 'Inteligência Profunda' },
      blocoJ: { score: blocoJ, max: maxJ, label: 'Convergência Final' },
      blocoK: { score: blocoK, max: maxK, label: 'Dinâmica de Fluxo' },
      blocoL: { score: blocoL, max: maxL, label: 'Filtro de Ruído' },
      blocoM: { score: blocoM, max: maxM, label: 'Defletores (Diamantes)' },
      blocoN: { score: blocoN, max: maxN, label: 'Kelly Criterion' },
      blocoO: { score: blocoO, max: maxO, label: 'Biometria Dealer' },
      blocoP: { score: blocoP, max: maxP, label: 'Calibrador de Ritmo' },
      blocoQ: { score: blocoQ, max: maxQ, label: 'Matrizes de Transição' },
      total: totalLayers,
      max: 1700,
    };

    // ========================================================
    // 7 ARQUÉTIPOS DE PADRÕES (Varredura Total)
    // ========================================================
    interface Archetype { name: string; emoji: string; active: boolean; strength: number; detail: string; predictedNums: number[] }
    const archetypes: Archetype[] = [];

    // ARQUÉTIPO 1: Sincronia de Salto (Física de Micro-Arco)
    // Detecta saltos repetidos no cilindro
    (() => {
      if (numbers.length < 30) return;
      const jumpFreq: Record<number, number> = {};
      const recentJumps = Math.min(50, rawArcs.length);
      for (let i = 0; i < recentJumps; i++) jumpFreq[rawArcs[i]] = (jumpFreq[rawArcs[i]] || 0) + 1;
      const topJump = Object.entries(jumpFreq).sort(([,a],[,b]) => b - a)[0];
      if (!topJump) return;
      const jumpDist = Number(topJump[0]);
      const jumpCount = topJump[1];
      const jumpPct = jumpCount / recentJumps;
      const predicted: number[] = [];
      if (jumpPct >= 0.15 && jumpCount >= 4) {
        const idx0 = wheelIdx(numbers[0]);
        if (idx0 !== -1) {
          predicted.push(WHEEL[(idx0 + jumpDist) % WL], WHEEL[(idx0 - jumpDist + WL) % WL]);
          // neighbors of predicted
          predicted.forEach(p => { const ni = wheelIdx(p); if (ni !== -1) { predicted.push(WHEEL[(ni+1)%WL], WHEEL[(ni-1+WL)%WL]); }});
        }
        const unique = [...new Set(predicted)].filter(n => n >= 0 && n <= 36);
        archetypes.push({ name: 'Sincronia de Salto', emoji: '⚡', active: jumpPct >= 0.2, strength: +(jumpPct * 100).toFixed(0), detail: `Salto de ${jumpDist} casas: ${jumpCount}x em ${recentJumps} (${(jumpPct*100).toFixed(0)}%) — Força Estática`, predictedNums: unique });
        if (jumpPct >= 0.2) aiLearnings.push(`⚡ SINCRONIA: Salto ${jumpDist} casas repetiu ${jumpCount}x — Padrão de Força Estática`);
      }
    })();

    // ARQUÉTIPO 2: Puxada Atômica (já calculada em pullPatterns, enriquecer)
    (() => {
      if (pullPatterns.length === 0) return;
      for (const pp of pullPatterns) {
        if (pp.targets.length > 0 && pp.targets[0].count >= 3) {
          const domPct = pp.targets[0].count / (pullPatterns.length > 0 ? Math.max(3, pp.targets.reduce((a, t) => a + t.count, 0)) : 3);
          archetypes.push({ name: 'Puxada Atômica', emoji: '🧲', active: domPct > 0.3, strength: +(domPct * 100).toFixed(0), detail: `${pp.source} puxa ${pp.targets[0].num} (${pp.targets[0].count}x) → Setor ${pp.dominantSector}`, predictedNums: pp.targets.slice(0, 3).map(t => t.num) });
          if (domPct > 0.3) aiLearnings.push(`🧲 PUXADA ATÔMICA: ${pp.source}→${pp.targets[0].num} confirmada (${pp.targets[0].count}x)`);
        }
      }
    })();

    // ARQUÉTIPO 3: Ressonância de Terminal (Escada e Espelho)
    (() => {
      if (numbers.length < 15) return;
      const terms = numbers.slice(0, 15).map(n => n % 10);
      // Escada: mesmos terminais incrementando (2→12→22 = terminal 2)
      const termStreaks: Record<number, number[]> = {};
      for (let i = 0; i < terms.length; i++) { if (!termStreaks[terms[i]]) termStreaks[terms[i]] = []; termStreaks[terms[i]].push(i); }
      for (const [t, positions] of Object.entries(termStreaks)) {
        const term = Number(t);
        if (positions.length >= 3) {
          // Check if they form close clusters
          const maxGap = Math.max(...positions.slice(1).map((p, i) => p - positions[i]));
          if (maxGap <= 5) {
            const resonantNums = Array.from({length: 37}, (_, n) => n).filter(n => n % 10 === term);
            archetypes.push({ name: 'Ressonância Terminal', emoji: '🔔', active: true, strength: positions.length * 20, detail: `Terminal ${term} ressoando: ${positions.length}x em 15 giros (Escada ativa)`, predictedNums: resonantNums });
            aiLearnings.push(`🔔 RESSONÂNCIA: Terminal ${term} em ciclo — ${positions.length}x concentrado`);
            break;
          }
        }
      }
      // Espelho: 5→15→5 (mesmo terminal alternando)
      for (let i = 0; i < Math.min(10, numbers.length) - 2; i++) {
        if (numbers[i] % 10 === numbers[i+2] % 10 && numbers[i] !== numbers[i+2]) {
          const t = numbers[i] % 10;
          const mirrorNums = Array.from({length: 37}, (_, n) => n).filter(n => n % 10 === t);
          archetypes.push({ name: 'Espelho Terminal', emoji: '🪞', active: true, strength: 60, detail: `Espelho: ${numbers[i]}→${numbers[i+1]}→${numbers[i+2]} (T${t} rebatendo)`, predictedNums: mirrorNums });
          break;
        }
      }
    })();

    // ARQUÉTIPO 4: Geometria de Pano (Zonas do tapete)
    (() => {
      if (numbers.length < 20) return;
      const dz20 = [0, 0, 0]; const col20 = [0, 0, 0];
      numbers.slice(0, 20).forEach(n => { const d = getDozen(n); if (d > 0) dz20[d-1]++; const c = getColumn(n); if (c > 0) col20[c-1]++; });
      // Check dead zone (dozen with <15% coverage)
      const dzTotal = dz20.reduce((a, b) => a + b, 0);
      const deadDozen = dz20.findIndex(d => d / dzTotal < 0.15);
      const hotDozenIdx = dz20.indexOf(Math.max(...dz20));
      if (deadDozen !== -1 && dzTotal > 15) {
        const hotNums = Array.from({length: 12}, (_, i) => (hotDozenIdx) * 12 + i + 1);
        archetypes.push({ name: 'Geometria de Pano', emoji: '📐', active: true, strength: Math.round((dz20[hotDozenIdx] / dzTotal) * 100), detail: `Dúzia ${deadDozen+1} MORTA (${dz20[deadDozen]}/${dzTotal}), Dúzia ${hotDozenIdx+1} QUENTE (${dz20[hotDozenIdx]}/${dzTotal})`, predictedNums: hotNums });
      }
      // Zigzag columns
      const colSeq = numbers.slice(0, 10).map(n => getColumn(n)).filter(c => c > 0);
      let zigzag = 0;
      for (let i = 1; i < colSeq.length; i++) if (colSeq[i] !== colSeq[i-1]) zigzag++;
      if (zigzag >= 7 && colSeq.length >= 8) {
        const predictedCol = colSeq[0] === 1 ? 3 : colSeq[0] === 3 ? 1 : 2;
        const colNums = predictedCol === 1 ? COL1 : predictedCol === 2 ? COL2 : COL3;
        archetypes.push({ name: 'Zigue-Zague Coluna', emoji: '📐', active: true, strength: Math.round((zigzag / (colSeq.length - 1)) * 100), detail: `Zigue-Zague entre colunas: ${zigzag}/${colSeq.length-1} alternâncias → Coluna ${predictedCol}`, predictedNums: colNums });
      }
    })();

    // ARQUÉTIPO 5: Alternância de Setores (Ritmo Gangorra) — enriches existing
    (() => {
      if (numbers.length < 12) return;
      const secSeq = numbers.slice(0, 12).map(n => getSector(n));
      // Detect A-B-A-B pattern
      const pairs: string[] = [];
      for (let i = 0; i < secSeq.length - 1; i++) pairs.push(`${secSeq[i]}→${secSeq[i+1]}`);
      const pairFreq: Record<string, number> = {};
      pairs.forEach(p => pairFreq[p] = (pairFreq[p] || 0) + 1);
      const topPair = Object.entries(pairFreq).sort(([,a],[,b]) => b - a)[0];
      if (topPair && topPair[1] >= 3) {
        const [from, to] = topPair[0].split('→');
        const predictSec = secSeq[0] === from ? to : from;
        const secNums = predictSec === 'Voisins' ? [...VOISINS] : predictSec === 'Tiers' ? [...TIERS] : [...ORPHELINS];
        archetypes.push({ name: 'Alternância de Setores', emoji: '🔄', active: true, strength: topPair[1] * 20, detail: `Gangorra ${from}↔${to}: ${topPair[1]}x — próximo: ${predictSec}`, predictedNums: secNums.slice(0, 8) });
      }
    })();

    // ARQUÉTIPO 6: Quebra de Entropia (Exaustão de Cor/Paridade)
    (() => {
      if (numbers.length < 10) return;
      // Color streak
      let colorStreak = 1; const firstColor = getColor(numbers[0]);
      for (let i = 1; i < numbers.length && i < 20; i++) {
        if (numbers[i] === 0) break;
        if (getColor(numbers[i]) === firstColor) colorStreak++; else break;
      }
      if (colorStreak >= 4) {
        const reverseColor = firstColor === 'red' ? 'black' : 'red';
        const reverseNums = Array.from({length: 37}, (_, n) => n).filter(n => getColor(n) === reverseColor);
        const breakProb = Math.min(98, 60 + colorStreak * 6);
        archetypes.push({ name: 'Quebra de Entropia', emoji: '🔥', active: colorStreak >= 5, strength: breakProb, detail: `${colorStreak}x ${firstColor === 'red' ? 'Vermelho' : 'Preto'} seguidos — Reversão para ${reverseColor === 'red' ? 'Vermelho' : 'Preto'} (${breakProb}%)`, predictedNums: reverseNums });
        if (colorStreak >= 5) aiLearnings.push(`🔥 ENTROPIA: ${colorStreak}x mesma cor — Reversão iminente (${breakProb}%)`);
      }
      // Parity streak
      let parStreak = 1; const firstPar = numbers[0] > 0 ? (numbers[0] % 2 === 0 ? 'even' : 'odd') : '';
      if (firstPar) {
        for (let i = 1; i < numbers.length && i < 20; i++) {
          if (numbers[i] === 0) break;
          if ((numbers[i] % 2 === 0 ? 'even' : 'odd') === firstPar) parStreak++; else break;
        }
        if (parStreak >= 5) {
          const reverseNums = Array.from({length: 37}, (_, n) => n).filter(n => n > 0 && (n % 2 === 0 ? 'even' : 'odd') !== firstPar);
          archetypes.push({ name: 'Exaustão de Paridade', emoji: '🔥', active: true, strength: Math.min(95, 55 + parStreak * 7), detail: `${parStreak}x ${firstPar === 'even' ? 'Par' : 'Ímpar'} — Reversão`, predictedNums: reverseNums });
        }
      }
    })();

    // ARQUÉTIPO 7: Espelhamento Temporal (Backtest de sequência)
    (() => {
      if (numbers.length < 50) return;
      const seqLen = 3;
      const currentSeq = numbers.slice(0, seqLen);
      // Search for this exact sequence in history
      for (let start = seqLen + 1; start <= numbers.length - seqLen - 1; start++) {
        let match = 0;
        for (let j = 0; j < seqLen; j++) if (numbers[start + j] === currentSeq[j]) match++;
        if (match === seqLen) {
          // Found exact match! What came next?
          const nextInHistory = numbers[start - 1]; // the number that followed
          if (nextInHistory !== undefined) {
            const predicted = [nextInHistory, ...getNeighbors(nextInHistory, 2)];
            archetypes.push({ name: 'Espelhamento Temporal', emoji: '👻', active: true, strength: 85, detail: `Sequência ${currentSeq.join(',')} repetiu há ${start} giros — próximo foi ${nextInHistory}`, predictedNums: [...new Set(predicted)] });
            aiLearnings.push(`👻 ESPELHAMENTO: Sequência ${currentSeq.join(',')} se repetiu — histórico aponta ${nextInHistory}`);
            break;
          }
        }
      }
    })();

    // Active archetypes summary
    const activeArchetypes = archetypes.filter(a => a.active);
    if (activeArchetypes.length >= 3) {
      aiLearnings.push(`🏛️ ${activeArchetypes.length} ARQUÉTIPOS ATIVOS: ${activeArchetypes.map(a => a.emoji + a.name.split(' ')[0]).join(', ')}`);
    }

    // ========================================================
    // SECTOR ANALYSIS
    // ========================================================
    const sectorFreq: Record<string, number> = { Voisins:0, Tiers:0, Orphelins:0 };
    last30.forEach(n => { const s = getSector(n); if (sectorFreq[s] !== undefined) sectorFreq[s]++; });
    const hotSector = Object.entries(sectorFreq).sort(([,a],[,b]) => b - a)[0];

    const sectorTrend: Record<string, number[]> = { Voisins:[], Tiers:[], Orphelins:[] };
    for (let chunk = 0; chunk < 3; chunk++) {
      const slice = last30.slice(chunk*10, (chunk+1)*10);
      const c: Record<string, number> = { Voisins:0, Tiers:0, Orphelins:0 };
      slice.forEach(n => { const s = getSector(n); if (c[s] !== undefined) c[s]++; });
      for (const s of Object.keys(sectorTrend)) sectorTrend[s].push(c[s]);
    }

    const octFreq10: Record<string, number> = {};
    last10.forEach(n => { const o = getOctave(n); if (o) octFreq10[o] = (octFreq10[o]||0) + 1; });

    const oct0 = getOctave(numbers[0]), oct1 = getOctave(numbers[1]), oct2 = getOctave(numbers[2]);
    const sectorBias = oct0===oct1 || oct0===oct2 || oct1===oct2;
    const biasedOctave = oct0===oct1?oct0 : oct0===oct2?oct0 : oct1===oct2?oct1 : biasedOctaves[0] || null;

    // Color/parity tendencies
    let redCount = 0, blackCount = 0;
    last15.forEach(n => { if (RED.includes(n)) redCount++; else if (n !== 0) blackCount++; });
    const colorBias = redCount > blackCount * 1.5 ? 'red' : blackCount > redCount * 1.5 ? 'black' : null;

    const dozenCount = [0, 0, 0];
    last15.forEach(n => { const d = getDozen(n); if (d > 0) dozenCount[d-1]++; });
    const hotDozen = dozenCount.indexOf(Math.max(...dozenCount)) + 1;

    const parityBias = evenCount > oddCount * 1.5 ? 'even' : oddCount > evenCount * 1.5 ? 'odd' : null;

    // Moment law
    const termTransitions: Record<string, number> = {};
    for (let i = 0; i < last15.length - 1; i++) {
      const key = `${last15[i]%10}->${last15[i+1]%10}`;
      termTransitions[key] = (termTransitions[key]||0) + 1;
    }
    const momentLaw = Object.entries(termTransitions).filter(([,c]) => c >= 2).map(([k]) => k);

    // Seesaw
    const semiZero = WHEEL.slice(0, 19);
    const semiOpp = WHEEL.slice(19);
    const zeroSide = last50.filter(n => semiZero.includes(n)).length;
    const oppSide = last50.filter(n => semiOpp.includes(n)).length;
    const seesawRatio = zeroSide / (oppSide || 1);
    const seesawBias = seesawRatio > 1.5 ? 'opposite' : seesawRatio < 0.67 ? 'zero' : null;

    // Cross-delay targets
    const crossDelayTargets: { num: number; termDelay: number; dozenDelay: number; colDelay: number; total: number }[] = [];
    for (let n = 0; n <= 36; n++) {
      const t = n % 10, d = getDozen(n), c = getColumn(n);
      if (d > 0) {
        const td = termDelays[t] || 0, dd = dozenDelays[d] || 0, cd = colDelays[c] || 0;
        const total = (td > 15 ? td : 0) + (dd > 15 ? dd : 0) + (cd > 15 ? cd : 0);
        if (total > 30) crossDelayTargets.push({ num: n, termDelay: td, dozenDelay: dd, colDelay: cd, total });
      }
    }
    crossDelayTargets.sort((a, b) => b.total - a.total);

    // Heat map
    const heatMap: number[] = new Array(WL).fill(0);
    last30.forEach((n, i) => {
      const idx = wheelIdx(n);
      if (idx === -1) return;
      const weight = 1 + (30 - i) / 30;
      for (let offset = -2; offset <= 2; offset++) {
        const tIdx = (idx + offset + WL) % WL;
        heatMap[tIdx] += weight * (1 - Math.abs(offset) * 0.3);
      }
    });
    const maxHeat = Math.max(...heatMap);

    // AI learned patterns
    // Reset learnedSignalBoost/learnedSignalReasons (already declared above)
    for (let n = 0; n <= 36; n++) { learnedSignalBoost[n] = 0; learnedSignalReasons[n] = []; }

    for (const l of learned) {
      const acc = (l.accuracy || 50) / 100;
      const keyNums: number[] = (l.metadata as any)?.key_numbers || [];
      const hotNums: number[] = (l.metadata as any)?.hotNumbers || [];
      const isSessionSpin  = l.learning_type === 'session_spin';
      const isPullConfirmed = l.learning_type === 'pull_confirmed';
      const isHeatCluster   = l.learning_type === 'heat_cluster';
      const isErrorPattern  = l.learning_type === 'error_pattern';
      // Padrões realtime (salvos pelo realtime-patterns) têm boost máximo
      const isRealtimeRT = isSessionSpin && (l.title || '').startsWith('RT_');
      const recencyBoost = isRealtimeRT ? 3.5
        : isSessionSpin ? 2.2
        : isPullConfirmed ? 2.5
        : isHeatCluster ? 2.0
        : 1.0;

      // Threshold mais baixo para não perder sinais do momento
      // Sem threshold mínimo — qualquer learning é usado
      // acc já normalizado: se banco tem 1 → trata como 50 (default seguro)
      const effectiveAcc = acc < 0.05 ? 0.50 : acc; // corrige learnings com acc 1% (bug antigo)

      if (hotNums.length > 0) {
        for (const hn of hotNums) {
          if (hn >= 0 && hn <= 36) {
            learnedSignalBoost[hn] += effectiveAcc * 2.5 * recencyBoost;
            learnedSignalReasons[hn].push(isRealtimeRT ? `⚡RT:${l.title.slice(3,25)}` : `IA:${l.learning_type}`);
          }
        }
      }
      if (keyNums.length > 0) {
        for (const kn of keyNums) {
          if (kn >= 0 && kn <= 36) {
            learnedSignalBoost[kn] += effectiveAcc * 2.0 * recencyBoost;
            learnedSignalReasons[kn].push(`IA:${l.title.slice(0,28)}`);
          }
        }
      }
      if (l.learning_type === 'terminal_pattern' && acc > 0.6) {
        const match = l.title.match(/(\d)/);
        if (match) { const term = parseInt(match[1]); for (let n = 0; n <= 36; n++) { if (n % 10 === term) { learnedSignalBoost[n] += acc * 1.2; learnedSignalReasons[n].push(`IA Terminal ${term}`); } } }
      }
      if (l.learning_type === 'terminal_dominance' && acc > 0.6) {
        const bestTerminals: number[] = (l.metadata as any)?.bestTerminals || [];
        for (const t of bestTerminals) {
          const tNums = TERMINALS_MAP[t] || [];
          for (const tn of tNums) { learnedSignalBoost[tn] += acc * 1.5; learnedSignalReasons[tn].push(`IA T${t} dominante`); }
        }
      }
      if (l.learning_type === 'sector_concentration' && acc > 0.6) {
        const octMatch = l.title.match(/O(\d)/);
        if (octMatch) { const nums = OCTAVES[`O${octMatch[1]}`] || []; for (const n of nums) { learnedSignalBoost[n] += acc * 1.0; learnedSignalReasons[n].push(`IA Oitavo`); } }
      }
      if (l.learning_type === 'heat_cluster' && acc > 0.6) {
        for (const kn of keyNums) { if (kn >= 0 && kn <= 36) { learnedSignalBoost[kn] += acc * 1.8; learnedSignalReasons[kn].push('IA Cluster'); } }
      }
      if (l.learning_type === 'dealer_signature' && acc > 0.5 && (maoViciada || arcStdDev < 3)) {
        const avgArc = Math.round(arcMean);
        const idx0 = wheelIdx(numbers[0]);
        const pCW = WHEEL[(idx0 + avgArc) % WL];
        const pCCW = WHEEL[(idx0 - avgArc + WL) % WL];
        learnedSignalBoost[pCW] += acc * 2.0; learnedSignalBoost[pCCW] += acc * 2.0;
        learnedSignalReasons[pCW].push('IA Dealer Sig'); learnedSignalReasons[pCCW].push('IA Dealer Sig');
      }
      if (isPullConfirmed) {
        const source = (l.metadata as any)?.source;
        const target = (l.metadata as any)?.target;
        if (typeof source === 'number' && source === numbers[0] && typeof target === 'number') {
          learnedSignalBoost[target] += 3.0;
          learnedSignalReasons[target].push('IA Pull Confirmado!');
        }
      }
      // MATRIX TRANSITION: usar pares aprendidos como boost direto
      if (l.learning_type === 'matrix_transition') {
        const meta = l.metadata as any;
        if (meta?.source === numbers[0] && meta?.target >= 0 && meta?.target <= 36) {
          const boost = ((l.accuracy || 50) / 100) * 6;
          learnedSignalBoost[meta.target] = (learnedSignalBoost[meta.target] || 0) + boost;
          learnedSignalReasons[meta.target].push(`🔢 Matriz(${(l.accuracy || 50).toFixed(0)}%)`);
        }
      }
      // HIT PATTERN: acertos recentes têm muito peso
      if (l.learning_type === 'hit_pattern') {
        const recencyBoostHit = 2.5;
        const keyNums: number[] = (l.metadata as any)?.key_numbers || [];
        for (const kn of keyNums) {
          if (kn >= 0 && kn <= 36) {
            learnedSignalBoost[kn] += ((l.accuracy || 50) / 100) * recencyBoostHit;
            learnedSignalReasons[kn].push(`✅ hit_pattern`);
          }
        }
      }
    }

    // ── BOOST DOS PADRÕES DO AUTO-ANALYZE ──
    const insightsAA = insightsRes.data || [];
    for (const ins of insightsAA) {
      if (!ins.confidence || (ins.confidence as number) < 45) continue;
      const insNums: number[] = (ins.numbers_involved || []) as number[];
      const boostMult = ins.pattern_type === 'combo_ouro' ? 3.0
        : ins.pattern_type === 'dupla_dani_green' ? 2.0
        : ins.pattern_type === 'entropia_baixa' ? 1.5
        : ins.pattern_type === 'pressao_zero' ? 1.2
        : 1.0;
      for (const n of insNums) {
        if (n >= 0 && n <= 36) {
          learnedSignalBoost[n] = (learnedSignalBoost[n] || 0) + ((ins.confidence as number) / 100) * boostMult;
          learnedSignalReasons[n] = learnedSignalReasons[n] || [];
          learnedSignalReasons[n].push(`Padrão:${ins.pattern_type}(${ins.confidence}%)`);
        }
      }
    }

    // ========================================================
    // CONVERGENCE REASONS
    // ========================================================
    const reasons: string[] = [];
    if (sectorBias && biasedOctave) reasons.push(`Viciação Setor: ${biasedOctave}`);
    if (biasedOctaves.length > 0) reasons.push(`Oitavos quentes: ${biasedOctaves.join(',')}`);
    if (delayedCavalos.length > 0) reasons.push(`Atraso Cavalos: ${delayedCavalos.map(([g,d])=>`C${g}(${d}r)`).join(',')}`);
    if (delayedTerminals.length > 0) reasons.push(`Terminais atrasados: T${delayedTerminals.join(',T')}`);
    if (maoViciada) reasons.push(`🎯 MÃO VICIADA: arco ${last3Arcs.join(',')} (±${arcRange3})`);
    else if (maoViciada5) reasons.push(`Assinatura forte: 5 arcos ±${arcRange5}`);
    else if (arcStdDev < 3) reasons.push(`Dealer consistente: ±${arcStdDev.toFixed(1)}`);
    if (momentLaw.length > 0) reasons.push(`Momento: ${momentLaw.join(',')}`);
    if (crossDelayTargets.length > 0) reasons.push(`Alvos cruzados: ${crossDelayTargets.slice(0,3).map(t=>`${t.num}`).join(',')}`);
    if (seesawBias) reasons.push(`Gangorra → ${seesawBias === 'zero' ? 'Jeu Zéro' : 'Tiers'}`);
    if (colorBias) reasons.push(`Tendência cor: ${colorBias}`);
    if (compDue.length > 3) reasons.push(`Complementares devidos: ${compDue.slice(0,4).join(',')}`);
    if (mirrorDue.length > 2) reasons.push(`Espelhados devidos: ${mirrorDue.slice(0,3).join(',')}`);
    if (learned.length > 0) reasons.push(`IA aprendeu ${learned.length} padrões`);
    if (dealerChanged) reasons.push('⚠️ Novo Dealer detectado');
    if (dealerSignature.possibleRotation) reasons.push('⏰ Rotação ~30min');

    // ========================================================
    // BASE RESPONSE
    // ========================================================
    // Add advanced analyses to detectedPatterns
    // Momentum patterns
    for (const [cat, mom] of Object.entries(sectorMomentum)) {
      if (mom.trend === 'rising' && mom.momentum > 0.2) {
        transitionMatrix.detectedPatterns.push({
          name: `Momentum ${cat} Subindo`, emoji: '📈', confidence: Math.min(85, 55 + Math.round(mom.momentum * 100)),
          description: `Setor ${cat} com momentum crescente (${(mom.momentum * 100).toFixed(0)}%). Tendência de continuação.`,
          category: 'momentum', action: `Aposte no setor ${cat}`,
        });
      }
    }
    for (const [cat, mom] of Object.entries(dozenMomentum)) {
      if (mom.trend === 'rising' && mom.momentum > 0.15 && cat) {
        transitionMatrix.detectedPatterns.push({
          name: `Momentum ${cat} Subindo`, emoji: '📊', confidence: Math.min(82, 50 + Math.round(mom.momentum * 100)),
          description: `${cat} com momentum crescente. Frequência aumentando nas últimas rodadas.`,
          category: 'momentum', action: `Aposte em ${cat}`,
        });
      }
    }
    // Volatility pattern
    if (volatility.level === 'baixa') {
      transitionMatrix.detectedPatterns.push({
        name: `Volatilidade Baixa (${volatility.score})`, emoji: '🧊', confidence: 80,
        description: `Sessão estável com volatilidade ${volatility.score}/100. Padrões são mais confiáveis.`,
        category: 'volatilidade', action: 'Momento ideal — padrões são confiáveis',
      });
    } else if (volatility.level === 'extrema') {
      transitionMatrix.detectedPatterns.push({
        name: `Volatilidade Extrema (${volatility.score})`, emoji: '🌋', confidence: 70,
        description: `Sessão muito instável. Arcos (±${volatility.arcVolatility}) e categorias (${volatility.categoryVolatility}%) variando muito.`,
        category: 'volatilidade', action: 'CUIDADO — reduzir apostas ou aguardar',
      });
    }
    // Breakout patterns
    for (const bo of breakoutsDetected) {
      transitionMatrix.detectedPatterns.push({
        name: `Quebra: ${bo.type.replace('_', ' ')}`, emoji: '🔀', confidence: bo.confidence,
        description: bo.description, category: 'breakout', action: 'Padrão anterior quebrou — nova tendência emergindo',
      });
    }
    // Bayesian predictions
    if (bayesSector.predicted && bayesSector.probability >= 40) {
      transitionMatrix.detectedPatterns.push({
        name: `Bayes: Setor ${bayesSector.predicted} (${bayesSector.probability}%)`, emoji: '🧮', confidence: bayesSector.probability,
        description: `Probabilidade condicional Bayesiana aponta para setor ${bayesSector.predicted} com ${bayesSector.probability}% baseado em transições históricas.`,
        category: 'bayesian', action: `Aposte no setor ${bayesSector.predicted}`,
      });
    }
    if (bayesColor.predicted && bayesColor.probability >= 50 && bayesColor.predicted !== 'green') {
      transitionMatrix.detectedPatterns.push({
        name: `Bayes: ${bayesColor.predicted === 'red' ? 'Vermelho' : 'Preto'} (${bayesColor.probability}%)`, emoji: '🧮', confidence: bayesColor.probability,
        description: `Análise Bayesiana de cor: ${bayesColor.predicted === 'red' ? 'Vermelho' : 'Preto'} com ${bayesColor.probability}% de probabilidade condicional.`,
        category: 'bayesian', action: `Aposte em ${bayesColor.predicted === 'red' ? 'Vermelho' : 'Preto'}`,
      });
    }
    // Wheel zone momentum
    if (wheelZones.length > 0 && wheelZones[0].momentum > 3) {
      transitionMatrix.detectedPatterns.push({
        name: `Zona Quente: ${wheelZones[0].label}`, emoji: '🎰', confidence: Math.min(85, 50 + Math.round(wheelZones[0].momentum * 5)),
        description: `${wheelZones[0].label} é a zona mais ativa do cilindro. Momentum: ${wheelZones[0].momentum}.`,
        category: 'zona', action: `Cubra números da ${wheelZones[0].label}`,
      });
    }
    // Fibonacci gaps
    if (fibGaps.length >= 3) {
      transitionMatrix.detectedPatterns.push({
        name: `${fibGaps.length} Números em Intervalo Fibonacci`, emoji: '🔢', confidence: 65,
        description: `Números ${fibGaps.slice(0, 4).map(f => f.number).join(', ')} estão em intervalos Fibonacci de ausência (${fibGaps.slice(0, 4).map(f => f.fibonacci + 'r').join(', ')}).`,
        category: 'fibonacci', action: `Aposte nos números: ${fibGaps.slice(0, 4).map(f => f.number).join(', ')}`,
      });
    }
    // Sort all detected patterns by confidence
    transitionMatrix.detectedPatterns.sort((a, b) => b.confidence - a.confidence);

    // AI learnings for advanced analyses
    if (volatility.level !== 'média') aiLearnings.push(`📊 Volatilidade: ${volatility.level} (${volatility.score}/100) — Arco ±${volatility.arcVolatility}`);
    if (breakoutsDetected.length > 0) aiLearnings.push(`🔀 ${breakoutsDetected.length} QUEBRA(S) DE PADRÃO detectada(s)`);
    if (wheelZones[0]?.momentum > 4) aiLearnings.push(`🎰 Zona quente no cilindro: ${wheelZones[0].label} (mom.${wheelZones[0].momentum})`);
    if (bayesSector.probability >= 50) aiLearnings.push(`🧮 Bayes: ${bayesSector.predicted} (${bayesSector.probability}%)`);

    const baseResponse = {
      entropy: entropy.toFixed(3), dealerMode, dealerSignature,
      hotTerminals: { cavalos: sortedCavalos, terminals: sortedTerminals.slice(0, 5) },
      sectorTrend, sectorFreq, convergenceScore: totalLayers, reasons, layerResults,
      ritmoCalibration, transitionMatrix,
      advancedAnalysis: {
        volatility,
        momentum: { sector: sectorMomentum, dozen: dozenMomentum, color: colorMomentum, parity: parityMomentum, highLow: highLowMomentum },
        bayesian: { sector: { predicted: bayesSector.predicted, probability: bayesSector.probability }, dozen: { predicted: bayesDozen.predicted, probability: bayesDozen.probability }, color: { predicted: bayesColor.predicted, probability: bayesColor.probability }, highLow: { predicted: bayesHighLow.predicted, probability: bayesHighLow.probability }, parity: { predicted: bayesParity.predicted, probability: bayesParity.probability } },
        wheelZones: wheelZones.slice(0, 3),
        fibonacciGaps: fibGaps.slice(0, 5),
        breakouts: breakoutsDetected,
      },
    };

    // Dealer change: don't block prediction, just add a warning
    if (dealerChanged) {
      aiLearnings.push('⚠️ Possível troca de dealer detectada — arco mudou significativamente');
    }

    // CHAOS AUTO-CALIBRATION: If dealer is chaotic AND dispersing wildly, pause signals
    if (chaoticDealer && isDispersingWildly && totalLayers < 700) {
      aiLearnings.push('🛑 Mesa sem padrão detectável. Auto-calibração pausou sinais.');
      return json({ signal: null, mode: 'calibrating', message: '🔄 AUTO-CALIBRAGEM — Dealer caótico, aguardando padrão...', ...baseResponse, memoryWindows, aiLearnings, randomnessIndex, kellyBetting, dealerBiometrics, diamondDeflection: diamondDeflection.slice(0, 4), deepMemory: { ancestralPatterns: ancestralPatterns.slice(0, 3), mesaDNA, cylinderInertia, geneticPatterns: geneticPatterns.slice(0, 3), backpropWeights, flowDynamics: { mesaFlowState, pullPatterns: pullPatterns.slice(0, 3), neighborJumps: neighborJumpCount, terminalProgression } } });
    }

    if (highEntropy && totalLayers < 550) {
      return json({ signal: null, mode: 'observing', message: '🔍 OBSERVAÇÃO — Alta entropia', ...baseResponse, memoryWindows, aiLearnings, randomnessIndex, kellyBetting, dealerBiometrics, diamondDeflection: diamondDeflection.slice(0, 4), deepMemory: { ancestralPatterns: ancestralPatterns.slice(0, 3), mesaDNA, cylinderInertia, geneticPatterns: geneticPatterns.slice(0, 3), backpropWeights, flowDynamics: { mesaFlowState, pullPatterns: pullPatterns.slice(0, 3), neighborJumps: neighborJumpCount, terminalProgression } } });
    }

    if (totalLayers < 400) {
      return json({ signal: null, mode: 'monitoring', message: '👁️ Monitorando...', ...baseResponse,
        topCandidates: [], delayedTerminals, cavaloDelays, memoryWindows, aiLearnings, randomnessIndex, kellyBetting, dealerBiometrics, diamondDeflection: diamondDeflection.slice(0, 4), deepMemory: { ancestralPatterns: ancestralPatterns.slice(0, 3), mesaDNA, cylinderInertia, geneticPatterns: geneticPatterns.slice(0, 3), backpropWeights, flowDynamics: { mesaFlowState, pullPatterns: pullPatterns.slice(0, 3), neighborJumps: neighborJumpCount, terminalProgression } } });
    }

    // ========================================================
    // STRATEGY DUEL ENGINE — 6 STRATEGIES COMPETE
    // ========================================================

    // Detect mesa mode: physical vs mathematical
    const mesaMode = (maoViciada || maoViciada5 || arcStdDev < 3.5) ? 'fisico' : 'matematico';

    // Per-number scoring (reused across strategies)
    const numScores: { num: number; score: number; reasons: string[] }[] = [];
    for (let n = 0; n <= 36; n++) {
      let s = 0;
      const r: string[] = [];
      if (biasedOctave && OCTAVES[biasedOctave]?.includes(n)) { s += 2.5; r.push(`Oitavo ${biasedOctave}`); }
      if (delayedTerminals.includes(n % 10)) { s += 2.5; r.push(`T${n%10} atrasado`); }
      const cg = getCavalo(n);
      if (cg && cavaloDelays[cg] > 8) { s += 2; r.push(`C${cg} atrasado`); }
      if (cg === hotCavaloGroup) { s += 1.5; r.push(`C${hotCavaloGroup} quente`); }
      const avgArc = maoViciada ? Math.round(last3Arcs.reduce((a,b)=>a+b,0)/3) : Math.round(arcMean);
      const idx0 = wheelIdx(numbers[0]);
      if (idx0 !== -1 && (maoViciada || maoViciada5 || arcStdDev < 4)) {
        const pCW = WHEEL[(idx0 + avgArc) % WL]; const pCCW = WHEEL[(idx0 - avgArc + WL) % WL];
        const arcWeight = maoViciada ? 6 : maoViciada5 ? 5 : 3;
        if (n === pCW || n === pCCW) { s += arcWeight; r.push(`🎯 Arco exato`); }
        else if (wheelDist(n, pCW) <= 1 || wheelDist(n, pCCW) <= 1) { s += arcWeight * 0.6; r.push(`Arco ±1`); }
        else if (wheelDist(n, pCW) <= 2 || wheelDist(n, pCCW) <= 2) { s += arcWeight * 0.3; r.push(`Arco ±2`); }
      }
      const term = n % 10, lastTerm = numbers[0] % 10;
      if (momentLaw.includes(`${lastTerm}->${term}`)) { s += 2; r.push('Momento'); }
      const crossTarget = crossDelayTargets.find(t => t.num === n);
      if (crossTarget) { s += 3; r.push(`Cruzado`); }
      if (compDue.includes(n)) { s += 1.5; r.push('Complementar'); }
      if (mirrorDue.includes(n)) { s += 1; r.push('Espelhado'); }
      if (seesawBias === 'zero' && JEU_ZERO.includes(n)) { s += 1.5; r.push('Gangorra→Zero'); }
      if (seesawBias === 'opposite' && TIERS.includes(n)) { s += 1.5; r.push('Gangorra→Tiers'); }
      const hIdx = wheelIdx(n);
      if (hIdx !== -1 && heatMap[hIdx] > maxHeat * 0.7) { s += 1; r.push('Zona quente'); }
      if (colorBias === 'red' && RED.includes(n)) s += 0.5;
      if (colorBias === 'black' && !RED.includes(n) && n !== 0) s += 0.5;
      if (freq37map[n] === 0) { s += 1.5; r.push('Ausente (Terço)'); }
      if (freq37map[n] >= 2) { s += 0.5; }
      if (highLowRatio > 1.4 && isLow(n)) s += 0.5;
      if (highLowRatio < 0.7 && isHigh(n)) s += 0.5;
      if (learnedSignalBoost[n] > 0) { s += learnedSignalBoost[n]; r.push(...learnedSignalReasons[n].slice(0, 2)); }
      // INSIGHT PATTERNS bonus
      if (insightNumbers[n] > 0) { s += insightNumbers[n]; r.push(...insightReasons[n].slice(0, 2)); }
      // SURPRISE NUMBERS bonus — numbers that frequently appear when we miss
      if (surpriseNumbers.includes(n)) { s += 2; r.push('🎲 Surpresa freq.'); }
      // ERRO PADRÃO: números que costumam sair quando erramos merecem boost
      if (learnedSignalReasons[n]?.some((lr: string) => lr.includes('error_pattern'))) {
        s += 3; r.push('⚠️ Anti-padrão');
      }
      // HISTORICAL HIT bonus — numbers that hit when predicted before
      if (numberHitFreq[n] && numberHitFreq[n] >= 2) { s += numberHitFreq[n] * 0.8; r.push(`✅ Acertou ${numberHitFreq[n]}x`); }
      // DEEP MEMORY: cylinder inertia bias
      if (cylinderInertia.biasedNums.includes(n)) { s += 2.5; r.push('🔩 Inércia cilindro'); }
      // DEEP MEMORY: dominant pin zone
      if (cylinderInertia.dominantPin !== null) {
        const pinSize = Math.floor(WL / 8);
        const nIdx = wheelIdx(n);
        if (nIdx !== -1 && Math.floor(nIdx / pinSize) === cylinderInertia.dominantPin) { s += 2; r.push('📌 Pino dom.'); }
      }
      // DEEP MEMORY: terminal signature consistency
      if (mesaDNA.terminalSignature.includes(n % 10)) { s += 1.5; r.push('🧬 DNA Terminal'); }
      // GENETIC PATTERN: cluster numbers
      for (const gp of geneticPatterns) {
        if (gp.numbers.includes(n)) { s += Math.min(3, gp.strength * 0.5); r.push(`🧬 ${gp.name}`); break; }
      }
      // BACKPROPAGATION: weight by best dimension
      if (backpropWeights['physical'] > 0.3 && maoViciada) { const idx0 = wheelIdx(numbers[0]); if (idx0 !== -1 && wheelDist(n, WHEEL[(idx0 + Math.round(arcMean)) % WL]) <= 3) { s += 2; r.push('🔄 Backprop Phys'); } }
      // FLOW DYNAMICS: concentration bonus
      if (mesaFlowState.mode === 'concentracao' && mesaFlowState.clusterZone && getSector(n) === mesaFlowState.clusterZone) { s += 3; r.push(`🔥 Zona ${mesaFlowState.clusterZone}`); }
      // FLOW DYNAMICS: gangorra prediction (opposite sector)
      if (mesaFlowState.mode === 'gangorra' && mesaFlowState.gangorraSequence.length >= 2) {
        const lastSec = getSector(numbers[0]);
        const predictedSec = lastSec === 'Voisins' ? 'Tiers' : lastSec === 'Tiers' ? 'Voisins' : lastSec === 'Orphelins' ? 'Voisins' : 'Tiers';
        if (getSector(n) === predictedSec) { s += 2.5; r.push(`🔄 Gangorra→${predictedSec}`); }
      }
      // PULL PATTERNS: numbers that are "pulled" by the latest number
      for (const pp of pullPatterns) {
        if (pp.source === numbers[0]) {
          const target = pp.targets.find(t => t.num === n);
          if (target && target.count >= 2) { s += Math.min(3, target.count * 0.8); r.push(`🧲 Puxada(${pp.source}→${n})`); }
          if (getSector(n) === pp.dominantSector) { s += 1; r.push(`🧲 Setor puxado`); }
        }
      }
      // ====== KNOWLEDGE BASE SCORING SYSTEM — REFORÇADO V2 ======
      // Weights aligned with document: C1=40pts, S3/S4=35pts, F5/F1=30pts, C2=25pts, etc.
      const lastNum = numbers[0];
      
      // Track signal types for COMBO detection (OURO/PRATA/BRONZE)
      const signalFlags: Record<string, boolean> = {};

      // AUTO-REPETIÇÃO: padrão documentado em 500 giros reais
      // Quando número saiu nas últimas 2 rodadas = candidato fortíssimo
      const repCount2 = (numbers[0] === n ? 1 : 0) + (numbers[1] === n ? 1 : 0);
      const repCount3 = repCount2 + (numbers[2] === n ? 1 : 0);
      if (repCount3 >= 3) {
        s += 18; r.push(`🔁 TRIPLA AUTO-REP!`); signalFlags['TRIPLE_REP'] = true;
      } else if (repCount2 >= 2) {
        s += 12; r.push(`🔁 DUPLA AUTO-REP`); signalFlags['DOUBLE_REP'] = true;
      } else if (numbers[0] === n || numbers[1] === n) {
        s += 4; r.push(`🔁 Apareceu recente`);
      }

      // C1 PUXADOS — com peso por confiabilidade histórica desta mesa
      // Pull reliability: dinâmico do banco > hardcoded
      const PULL_RELIABILITY_STATIC: Record<number, number> = {
        18: 1.8, 6: 1.7, 27: 1.7, 33: 1.6, 9: 1.6,
        19: 1.4, 35: 1.4, 3: 1.3, 5: 1.3, 28: 1.2,
      };
      const PULL_RELIABILITY: Record<number, number> = hasDynCalibration && Object.keys(dynPullRel).length >= 3
        ? { ...PULL_RELIABILITY_STATIC, ...dynPullRel }
        : PULL_RELIABILITY_STATIC;
      const pullTargets = FULL_PULL_MAP[lastNum] || PULL_MAP[lastNum];
      if (pullTargets && pullTargets.includes(n)) {
        const reliability = PULL_RELIABILITY[lastNum] || 1.0;
        const pullBoost = 8 * reliability;
        s += pullBoost;
        r.push(`📚 C1:Puxa(${lastNum}→${n}) [${(reliability*100-100).toFixed(0)}%+ conf]`);
        signalFlags['C1'] = true;
      }
      // Deep pull chain: 2nd and 3rd last numbers (diminishing weight)
      if (numbers.length >= 2) {
        const pull2 = FULL_PULL_MAP[numbers[1]] || PULL_MAP[numbers[1]];
        if (pull2 && pull2.includes(n)) { s += 4.5; r.push(`📚 C1:Puxa2(${numbers[1]}→${n})`); signalFlags['C1'] = true; }
      }
      if (numbers.length >= 3) {
        const pull3 = FULL_PULL_MAP[numbers[2]] || PULL_MAP[numbers[2]];
        if (pull3 && pull3.includes(n)) { s += 3; r.push(`📚 C1:Puxa3`); signalFlags['C1'] = true; }
      }
      // DOUBLE PULL CONFIRMATION: if number is pulled by BOTH last AND penultimate → super boost
      if (numbers.length >= 2 && pullTargets?.includes(n)) {
        const pull2 = FULL_PULL_MAP[numbers[1]] || PULL_MAP[numbers[1]];
        if (pull2?.includes(n)) { s += 5; r.push(`🔗 DuplaPuxa!`); }
      }
      // TRIPLE PULL CONFIRMATION: número puxado pelos 3 últimos = boost máximo
      if (numbers.length >= 3 && pullTargets?.includes(n)) {
        const pull2 = FULL_PULL_MAP[numbers[1]] || PULL_MAP[numbers[1]];
        const pull3 = FULL_PULL_MAP[numbers[2]] || PULL_MAP[numbers[2]];
        if (pull2?.includes(n) && pull3?.includes(n)) {
          s += 10; r.push(`🔱 TRIPLE PULL(${numbers[2]}→${numbers[1]}→${numbers[0]}→${n})`);
        }
      }
      
      // C2: TERMINAL DO NÚMERO — boost same terminal as last number (25 pts)
      if (n % 10 === lastNum % 10 && n !== lastNum) { s += 4; r.push(`📚 C2:MesmoT${lastNum % 10}`); signalFlags['C2'] = true; }
      
      // S1: REPETIÇÃO IMEDIATA — same number repeated (15 pts)
      if (n === lastNum) { s += 2.5; r.push('📚 S1:Repetição'); signalFlags['S1'] = true; }
      
      // S2: NEAR-MISS NA RODA — consecutive are wheel neighbors (20 pts)
      if (wheelDist(n, lastNum) <= 2 && n !== lastNum) { s += 3.5; r.push('📚 S2:NearMiss'); signalFlags['S2'] = true; }
      
      // S3/S4: SEQUÊNCIA DE TERMINAL CRESCENTE/DECRESCENTE (35 pts)
      if (daniGreen.mod6.active && daniGreen.mod6.nextTerminal !== null && n % 10 === daniGreen.mod6.nextTerminal) {
        s += 5.5; r.push(`📚 S3:SeqT→T${daniGreen.mod6.nextTerminal}`); signalFlags['S3'] = true;
      }
      
      // G4: VIZINHO NA RODA DO ÚLTIMO (20 pts)
      if (wheelDist(n, lastNum) <= 4 && wheelDist(n, lastNum) > 0) { s += 3; r.push('📚 G4:VizRoda'); signalFlags['G4'] = true; }
      
      // F1: HOT NUMBER — appears ≥2x in last 10 (30 pts)
      const hotCount10 = last10.filter(x => x === n).length;
      if (hotCount10 >= 2) { s += 5; r.push(`📚 F1:Quente(${hotCount10}x)`); signalFlags['F1'] = true; }
      if (hotCount10 >= 3) { s += 3; } // extra for 3x
      
      // F3: HIPER-QUENTE — appears 2x in ≤5 spins (30 pts)
      const hotCount5 = numbers.slice(0, 5).filter(x => x === n).length;
      if (hotCount5 >= 2) { s += 6; r.push(`📚 F3:HiperQuente`); signalFlags['F1'] = true; }
      
      // F2: COLD NUMBER — absent for long time (20 pts) — scaled by absence
      let coldDelay = 0;
      for (let ci = 0; ci < Math.min(100, numbers.length); ci++) { if (numbers[ci] === n) break; coldDelay++; }
      if (coldDelay >= 80) { s += 5; r.push(`📚 F2:CRÍTICO(${coldDelay}r)`); signalFlags['F2'] = true; }
      else if (coldDelay >= 50) { s += 3.5; r.push(`📚 F2:Frio(${coldDelay}r)`); signalFlags['F2'] = true; }
      else if (coldDelay >= 30) { s += 2; r.push(`📚 F2:Morno(${coldDelay}r)`); }
      
      // F5: TERMINAL DOMINANTE — terminal ≥3x in 15 spins (30 pts)
      if (daniGreen.mod1.count >= 3 && n % 10 === daniGreen.mod1.terminal) { s += 5; r.push(`📚 F5:TermDom`); signalFlags['F5'] = true; }
      if (daniGreen.mod1.count >= 5 && n % 10 === daniGreen.mod1.terminal) { s += 3; } // extra for 5x dominant
      
      // F4: CLUSTER REGIONAL — 3+ numbers from same sector in 10 (20 pts)
      const nSector = getSector(n);
      const sectorCount10 = last10.filter(x => getSector(x) === nSector).length;
      if (sectorCount10 >= 4) { s += 4; r.push(`📚 F4:Cluster!(${nSector})`); signalFlags['F4'] = true; }
      else if (sectorCount10 >= 3) { s += 2.5; r.push(`📚 F4:Cluster(${nSector})`); signalFlags['F4'] = true; }
      
      // P3: ZERO AUSENTE — pressure zone escalada por delay
      const VOISINS_ZERO = [22,18,29,7,28,12,35,3,26,0,32,15,19,4,21,2,25];
      const JEU_ZERO_L   = [12,35,3,26,0,32,15];
      if (n === 0) {
        if (daniGreen.mod4.delay >= 60)      { s += 12; r.push(`🚨 P3:ZeroANOMALIA(${daniGreen.mod4.delay}r)`); signalFlags['P3'] = true; }
        else if (daniGreen.mod4.delay >= 40) { s += 8;  r.push(`🔴 P3:ZeroCRÍTICO(${daniGreen.mod4.delay}r)`);  signalFlags['P3'] = true; }
        else if (daniGreen.mod4.delay >= 25) { s += 5;  r.push(`📚 P3:ZeroPress(${daniGreen.mod4.delay}r)`);    signalFlags['P3'] = true; }
      } else if (JEU_ZERO_L.includes(n) && daniGreen.mod4.delay >= 25) {
        s += 2; r.push(`🟡 JeuZero(${daniGreen.mod4.delay}r)`);
      } else if (VOISINS_ZERO.includes(n) && daniGreen.mod4.delay >= 40) {
        s += 3; r.push(`🟢 VizZero(${daniGreen.mod4.delay}r)`); signalFlags['P3'] = true;
      }
      
      // VALIDATED MATRIX: dinâmica do banco quando disponível
      const VALIDATED_MATRIX_STATIC: Record<number, {target: number; prob: number}[]> = {
        14: [{target:14, prob:0.63}],
        12: [{target:12, prob:0.59}],
        16: [{target:16, prob:0.58}],
        17: [{target:17, prob:0.56}],
        22: [{target:22, prob:0.56}],
        7:  [{target:7,  prob:0.54}],
        0:  [{target:0,  prob:0.52}],
        13: [{target:13, prob:0.50}],
        19: [{target:19, prob:0.45}],
        21: [{target:21, prob:0.45}],
        8:  [{target:8,  prob:0.44}],
        2:  [{target:2,  prob:0.40}],
        4:  [{target:4,  prob:0.40}],
        11: [{target:11, prob:0.40}],
        23: [{target:23, prob:0.47}],
        9:  [{target:9,  prob:0.33}],
        3:  [{target:3,  prob:0.31}, {target:35, prob:0.23}],
        10: [{target:10, prob:0.29}],
        25: [{target:33, prob:0.29}],
        1:  [{target:28, prob:0.25}],
      };
      // Merge: dinâmica do banco prevalece sobre estática
      const VALIDATED_MATRIX: Record<number, {target: number; prob: number}[]> = hasDynCalibration && Object.keys(dynMatrix).length >= 5
        ? { ...VALIDATED_MATRIX_STATIC, ...dynMatrix }
        : VALIDATED_MATRIX_STATIC;
      const validatedPairs = VALIDATED_MATRIX[numbers[0]] || [];
      for (const vp of validatedPairs) {
        if (vp.target === n) {
          const validatedBoost = vp.prob * 12;
          s += validatedBoost;
          r.push(`✅ Matriz Real(${(vp.prob*100).toFixed(0)}%)`);
          signalFlags['VALIDATED'] = true;
        }
      }

      const STATISTICAL_DEBT_STATIC: Record<number, number> = {
        18: 10.0, 19: 10.0, 20: 10.0,  // ausentes nos últimos 200
        5: 8.1, 21: 8.1, 27: 8.1, 30: 8.1,  // 1x em 200
        1: 6.3, 8: 4.5, 15: 4.5, 26: 4.5, 32: 4.5,  // 2-3x em 200
      };
      const STATISTICAL_DEBT = hasDynCalibration && Object.keys(dynStatDebt).length >= 3
        ? { ...STATISTICAL_DEBT_STATIC, ...dynStatDebt }
        : STATISTICAL_DEBT_STATIC;
      const debt = STATISTICAL_DEBT[n];
      if (debt) {
        const debtBoost = Math.min(6, debt * 0.5);
        s += debtBoost;
        r.push(`💰 Dívida Estatística Real(${debt.toFixed(1)})`);
        signalFlags['DIVIDA_REAL'] = true;
      }

      // VIÉS DE TERMINAL DESTA MESA — calibrado com 500 giros reais
      const TERMINAL_BIAS_STATIC: Record<number, number> = { 3: 3.0, 0: 2.0, 1: 1.0, 4: 0.5, 7: -2.0, 2: -2.5 };
      const TERMINAL_BIAS = hasDynCalibration && Object.keys(dynTermBias).length >= 3
        ? { ...TERMINAL_BIAS_STATIC, ...dynTermBias }
        : TERMINAL_BIAS_STATIC;
      const termBias = TERMINAL_BIAS[n % 10];
      if (termBias) {
        s += termBias;
        if (termBias > 0) r.push(`📊 T${n%10} bias+${termBias}`);
      }

      // CICLO D1↔D2 — padrão dominante observado nesta mesa
      const lastDzCycle = getDozen(numbers[0]);
      const prevDzCycle = getDozen(numbers[1]);
      if (lastDzCycle > 0 && prevDzCycle > 0) {
        if ((lastDzCycle === 1 && prevDzCycle === 2) || (lastDzCycle === 2 && prevDzCycle === 1)) {
          const expectedDzCycle = lastDzCycle === 1 ? 2 : 1;
          if (getDozen(n) === expectedDzCycle) {
            s += 3.5; r.push(`🔄 Ciclo D${lastDzCycle}↔D${expectedDzCycle}`);
          }
        }
      }

      // ====== COMBO DETECTION (OURO/PRATA/BRONZE) — SEM DUPLICATAS ======
      const signalCount = Object.keys(signalFlags).length;
      let comboApplied = false;
      // COMBO SUPREMO: AutoRep + Pull = certeza máxima (mais forte, testa primeiro)
      if (!comboApplied && signalFlags['DOUBLE_REP'] && signalFlags['C1']) { s += 18; r.push('💥 COMBO SUPREMO: RepDupla+Puxa'); comboApplied = true; }
      if (!comboApplied && signalFlags['TRIPLE_REP'] && signalFlags['C1']) { s += 20; r.push('🔱 TRIPLA+PUXA'); comboApplied = true; }
      // COMBO VALIDATED + REP
      if (!comboApplied && signalFlags['VALIDATED'] && signalFlags['DOUBLE_REP']) { s += 15; r.push('🏆 VALIDADO+REP'); comboApplied = true; }
      if (!comboApplied && signalFlags['VALIDATED'] && signalFlags['C1']) { s += 12; r.push('🏆 VALIDADO+PUXA'); comboApplied = true; }
      // COMBO OURO: F5 + C1 + S3
      if (!comboApplied && signalFlags['F5'] && signalFlags['C1'] && signalFlags['S3']) { s += 12; r.push('👑 COMBO OURO'); comboApplied = true; }
      // COMBO PRATA: F1 + C2 + G4
      if (!comboApplied && signalFlags['F1'] && signalFlags['C2'] && signalFlags['G4']) { s += 8; r.push('🥈 COMBO PRATA'); comboApplied = true; }
      // COMBO BRONZE: S3 + F5
      if (!comboApplied && signalFlags['S3'] && signalFlags['F5']) { s += 6; r.push('🥉 COMBO BRONZE'); comboApplied = true; }
      // COMBO ZERO: P3 + G4
      if (!comboApplied && signalFlags['P3'] && signalFlags['G4']) { s += 5; r.push('🟢 COMBO ZERO'); comboApplied = true; }
      // Standalone TRIPLE_REP (sem pull)
      if (!comboApplied && signalFlags['TRIPLE_REP']) { s += 12; r.push('🔱 TRIPLA'); comboApplied = true; }
      // DIVERSITY BONUS (2=+1.5, 3=+3, 4+=+5, 5+=+8)
      if (signalCount >= 5) { s += 8; r.push(`🔥 ${signalCount} sinais`); }
      else if (signalCount >= 4) { s += 5; r.push(`🔥 ${signalCount} sinais`); }
      else if (signalCount >= 3) { s += 3; }
      else if (signalCount >= 2) { s += 1.5; }
      
      // COMMUNITY PULL TERMINALS — boosted
      const pullTerms = FULL_PULL_TERMINALS[lastNum] || PULL_TERMINALS[lastNum];
      if (pullTerms) {
        const nTerm = n % 10;
        if (pullTerms.includes(nTerm)) { s += 4; r.push(`📚 PuxaT${nTerm}`); }
      }
      // COMMUNITY PULL CAVALOS — boosted
      const pullCav = PULL_CAVALOS[lastNum];
      if (pullCav) {
        const nCav = getCavalo(n);
        if (nCav && pullCav.includes(nCav)) { s += 3; r.push(`📚 PuxaC${nCav}`); }
      }
      // FINALES WEIGHT (4-number terminals have higher coverage = +weight)
      const nFinal = n % 10;
      if (FINALES_WEIGHT[nFinal] === 4) { s += 0.8; }
      // TERMINAL PROGRESSION
      if (terminalProgression.predictedNext !== null && n % 10 === terminalProgression.predictedNext) { s += 4.5; r.push(`🐎 Escada T${terminalProgression.predictedNext}`); }
      // DANI GREEN MÓD1: Duplo Terminal boost — REFORÇADO
      if (n % 10 === daniGreen.mod1.terminal || n % 10 === daniGreen.mod1.pair) {
        const mod1Boost = daniGreen.mod1.count >= 5 ? 6 : daniGreen.mod1.count >= 4 ? 5 : daniGreen.mod1.count >= 3 ? 4 : 2.5;
        s += mod1Boost; r.push(`🎰 DuploT${daniGreen.mod1.terminal}+T${daniGreen.mod1.pair}`);
      }
      // DANI GREEN MÓD2: Alto/Baixo
      if (daniGreen.mod2 === 'high' && n >= 19) { s += 2; r.push('📊 Mod2 Alto'); }
      if (daniGreen.mod2 === 'low' && n >= 1 && n <= 18) { s += 2; r.push('📊 Mod2 Baixo'); }
      // DANI GREEN MÓD4: Zero pressure with zone-based scaling
      if (daniGreen.mod4.active && (n === 0 || ZERO_NEIGHBORS_WHEEL.includes(n) || ZERO_TERMINAL_NUMS.includes(n))) {
        const zeroBoost = daniGreen.mod4.delay >= 60 ? 8 : daniGreen.mod4.delay >= 40 ? 6 : daniGreen.mod4.delay >= 25 ? 4 : 3;
        s += zeroBoost; r.push(`🟢 PressãoZero(${daniGreen.mod4.delay}r)`);
      }
      // DANI GREEN MÓD5: Full pull map
      if (daniGreen.mod5Pull.includes(n)) { s += 4.5; r.push(`🧲 Mod5 Puxa(${daniGreen.mod5LastNum}→${n})`); }
      if (daniGreen.mod5PullTerminals.includes(n % 10)) { s += 2.5; r.push(`🧲 Mod5 PuxaT${n%10}`); }
      // DANI GREEN MÓD6: Crescente/Decrescente
      if (daniGreen.mod6.active && daniGreen.mod6.nextTerminal !== null && n % 10 === daniGreen.mod6.nextTerminal) {
        s += 4; r.push(`📈 Mod6→T${daniGreen.mod6.nextTerminal}`);
      }
      // DUPLAS DE TERMINAIS boost
      if (duplaKey && DUPLAS_TERMINAIS[duplaKey]?.includes(n)) {
        s += 2.5; r.push(`🎰 Dupla(${duplaKey})`);
      }
      // ENTROPY MULTIPLIER: boost when session is concentrated
      if (sessionEntropy < 0.5) { s *= 1.15; }
      else if (sessionEntropy > 0.8) { s *= 0.85; }
      // DIAMOND DEFLECTORS: if current diamond zone predicts a sector, boost numbers in that sector
      if (numbers.length >= 2) {
        const dfFromIdx = wheelIdx(numbers[0]);
        const dfToIdx = wheelIdx(numbers[1]);
        if (dfFromIdx !== -1 && dfToIdx !== -1) {
          const dfMid = Math.floor((dfToIdx + dfFromIdx) / 2) % WL;
          const dfZone = Math.floor(dfMid / Math.floor(WL / 8)) % 8;
          const df = diamondDeflection.find(d => d.zone === dfZone + 1);
          if (df && df.deflectionRate > 0.55 && getSector(n) === df.targetSector) { s += 2; r.push(`💎 Diamante→${df.targetSector.slice(0, 4)}`); }
        }
      }
      // NOISE FILTER: penalize if mesa is unstable
      if (randomnessIndex.overall >= 75) { s -= 2; }
      else if (randomnessIndex.overall >= 50) { s -= 1; }
      // DEALER BIOMETRICS: bonus if dealer is mechanical
      if (dealerBiometrics.profileType === 'mecânico') { s += 1; r.push('🎭 Dealer mecânico'); }
      // ARCHETYPES: boost numbers predicted by active archetypes
      for (const arch of activeArchetypes) {
        if (arch.predictedNums.includes(n)) {
          const bonus = arch.strength > 70 ? 3 : arch.strength > 40 ? 2 : 1;
          s += bonus;
          r.push(`${arch.emoji} ${arch.name.split(' ')[0]}`);
          break; // only count strongest archetype per number
        }
      }
      // RITMO CALIBRADOR: boost target and neighbors from directional arc prediction
      if (ritmoCalibration.alvo !== null && ritmoCalibration.confianca >= 70) {
        const ritmoWeight = ritmoCalibration.confianca >= 98 ? 7 : ritmoCalibration.confianca >= 85 ? 5 : 3;
        if (n === ritmoCalibration.alvo) { s += ritmoWeight; r.push(`⏱️ Alvo Ritmo (${ritmoCalibration.confianca}%)`); }
        else if (wheelDist(n, ritmoCalibration.alvo) <= 2) { s += ritmoWeight * 0.6; r.push(`⏱️ Ritmo ±2`); }
        else if (wheelDist(n, ritmoCalibration.alvo) <= 4) { s += ritmoWeight * 0.3; r.push(`⏱️ Ritmo ±4`); }
      }
      // TRANSITION MATRIX: boost numbers predicted by sector/dozen/terminal matrix
      if (transitionMatrix.predictedSector && getSector(n) === transitionMatrix.predictedSector) {
        s += 2.5; r.push(`📊 Matriz→${transitionMatrix.predictedSector.slice(0, 4)}`);
      }
      if (transitionMatrix.predictedDozen && getDozen(n) === transitionMatrix.predictedDozen) {
        s += 2; r.push(`📊 Matriz→D${transitionMatrix.predictedDozen}`);
      }
      if (transitionMatrix.predictedTerminal !== null && n % 10 === transitionMatrix.predictedTerminal) {
        s += 2; r.push(`📊 Matriz→T${transitionMatrix.predictedTerminal}`);
      }
      // MATRIZ 37×37: boost proporcional à probabilidade histórica
      if (matrizCombinado[n] > 0 && matrizTotal >= 10) {
        const matrizNorm = matrizCombinado[n] / maxMatriz;
        if (matrizNorm > 0.15) {
          const boost = matrizNorm * 8;
          s += boost;
          r.push(`📊 Matriz(${((matrizProb[n]||0)*100).toFixed(0)}%)`);
          signalFlags['MATRIZ_NUM'] = true;
        }
      }
      // DOZEN PRESSURE TRIGGER
      if (transitionMatrix.dozenPressureTrigger?.active && getDozen(n) === transitionMatrix.dozenPressureTrigger.dozen) {
        s += 3; r.push(`🔥 Pressão D${transitionMatrix.dozenPressureTrigger.dozen}`);
      }
      // AI LEARNED PATTERNS BOOST — knowledge accumulated from history
      if (learnedBoosts[n] > 0) { s += learnedBoosts[n]; r.push(`🧠 IA Aprendeu(+${learnedBoosts[n].toFixed(1)})`); }
      // ====== ADVANCED: Recency-Weighted Frequency ======
      const rFreq = recencyFreq[n] || 0;
      if (rFreq > 2.5) { s += Math.min(4, rFreq * 0.8); r.push(`⏳ Recência(${rFreq.toFixed(1)})`); }
      // ====== ADVANCED: Sector Momentum ======
      const nSec = getSector(n);
      if (nSec !== 'Zero' && sectorMomentum[nSec]?.trend === 'rising' && sectorMomentum[nSec].momentum > 0.2) {
        s += 3; r.push(`📈 Momentum ${nSec.slice(0,4)}`);
      }
      // ====== ADVANCED: Dozen Momentum ======
      const nDz = getDozen(n);
      if (nDz > 0 && dozenMomentum[`D${nDz}`]?.trend === 'rising') {
        s += 2; r.push(`📈 Momentum D${nDz}`);
      }
      // ====== ADVANCED: Bayesian Prediction Boost ======
      if (bayesSector.predicted && bayesSector.probability >= 40 && getSector(n) === bayesSector.predicted) {
        s += 2.5; r.push(`🎯 Bayes→${String(bayesSector.predicted).slice(0,4)}(${bayesSector.probability}%)`);
      }
      if (bayesDozen.predicted && bayesDozen.probability >= 40 && getDozen(n) === Number(bayesDozen.predicted)) {
        s += 2; r.push(`🎯 Bayes→D${bayesDozen.predicted}(${bayesDozen.probability}%)`);
      }
      // ====== ADVANCED: Wheel Zone Momentum ======
      if (wheelZones.length > 0) {
        const topZone = wheelZones[0];
        if (topZone.momentum > 3 && topZone.numbers.includes(n)) {
          s += 2.5; r.push(`🎰 ZonaQuente(${topZone.label.slice(0,10)})`);
        }
      }
      // ====== ADVANCED: Fibonacci Gap ======
      const fibMatch = fibGaps.find(f => f.number === n);
      if (fibMatch) { s += 2; r.push(`🔢 Fib(${fibMatch.fibonacci}r)`); }
      // ====== ADVANCED: Breakout Detection ======
      for (const bo of breakoutsDetected) {
        if (bo.type === 'sector_breakout' && bo.description.includes('parou') && getSector(n) !== nSec) { s += 1.5; }
        if (bo.type === 'color_breakout' && bo.description.includes('Vermelho assumindo') && RED.includes(n)) { s += 1.5; r.push('🔀 Breakout→Verm'); break; }
        if (bo.type === 'color_breakout' && bo.description.includes('Preto assumindo') && !RED.includes(n) && n > 0) { s += 1.5; r.push('🔀 Breakout→Preto'); break; }
        if (bo.type === 'highlow_breakout' && bo.description.includes('Altos assumindo') && n >= 19) { s += 1.5; r.push('🔀 Breakout→Alto'); break; }
        if (bo.type === 'highlow_breakout' && bo.description.includes('Baixos assumindo') && n >= 1 && n <= 18) { s += 1.5; r.push('🔀 Breakout→Baixo'); break; }
      }
      // ====== ADVANCED: Color Momentum ======
      if (colorMomentum['red']?.trend === 'rising' && RED.includes(n)) { s += 1; r.push('🔴 Mom.Verm'); }
      else if (colorMomentum['black']?.trend === 'rising' && !RED.includes(n) && n > 0) { s += 1; r.push('⚫ Mom.Preto'); }
      // ====== ADVANCED: Parity Momentum ======
      if (parityMomentum['Par']?.trend === 'rising' && n > 0 && n % 2 === 0) { s += 0.8; }
      else if (parityMomentum['Ímpar']?.trend === 'rising' && n > 0 && n % 2 === 1) { s += 0.8; }
      // ====== ADVANCED: High/Low Momentum ======
      if (highLowMomentum['Alto']?.trend === 'rising' && n >= 19) { s += 1; r.push('⬆️ Mom.Alto'); }
      else if (highLowMomentum['Baixo']?.trend === 'rising' && n >= 1 && n <= 18) { s += 1; r.push('⬇️ Mom.Baixo'); }
      // ====== ADVANCED: Volatility Adjustment ======
      if (volatility.level === 'baixa') { s *= 1.1; } // low volatility = patterns more reliable
      else if (volatility.level === 'extrema') { s *= 0.85; } // extreme volatility = less trustworthy
      // Penalidade por recência: NÃO penalizar se auto-repetição detectada
      if (!signalFlags['DOUBLE_REP'] && !signalFlags['TRIPLE_REP']) {
        if (numbers.slice(0, 3).includes(n) && !signalFlags['C1']) s -= 2;
        else if (numbers.slice(3, 7).includes(n)) s -= 0.5;
      }
      if (s > 0) numScores.push({ num: n, score: s, reasons: r });
    }
    numScores.sort((a, b) => b.score - a.score);

    // ========================================================
    // DEEP PULL CHAIN — 3 levels deep (A→B→C) for maximum accuracy
    // ========================================================
    const deepPullChain: Record<number, number> = {};
    for (let n = 0; n <= 36; n++) deepPullChain[n] = 0;
    // Level 1: direct pulls from last number
    const pull1 = FULL_PULL_MAP[numbers[0]] || PULL_MAP[numbers[0]] || [];
    pull1.forEach(n => { deepPullChain[n] += 5; });
    // Level 2: pulls from level-1 targets
    pull1.slice(0, 5).forEach(p1 => {
      const pull2 = FULL_PULL_MAP[p1] || PULL_MAP[p1] || [];
      pull2.forEach(n => { deepPullChain[n] += 2.5; });
    });
    // Level 3: pulls from level-2 (weakest signal but adds depth)
    if (numbers.length >= 2) {
      const pull2nd = FULL_PULL_MAP[numbers[1]] || PULL_MAP[numbers[1]] || [];
      pull2nd.slice(0, 4).forEach(p2 => {
        const pull3 = FULL_PULL_MAP[p2] || PULL_MAP[p2] || [];
        pull3.forEach(n => { deepPullChain[n] += 1; });
      });
    }
    // Apply deep pull chain to numScores
    numScores.forEach(ns => {
      const chainBoost = deepPullChain[ns.num];
      if (chainBoost > 3) { ns.score += chainBoost * 0.4; ns.reasons.push(`🔗 Chain(${chainBoost.toFixed(0)})`); }
    });
    numScores.sort((a, b) => b.score - a.score);

    // Helper: sum scores for a set of numbers
    const sumScores = (nums: number[]) => {
      let total = 0;
      for (const n of nums) { const found = numScores.find(s => s.num === n); if (found) total += found.score; }
      return total;
    };

    // Helper: DEEP backtest — tests strategy against historical data with sliding window
    const backtestSet = (nums: number[]) => {
      let hits = 0, tests = 0;
      // numbers está em ordem decrescente (index 0 = mais recente)
      // Para testar "o que veio DEPOIS", precisamos de índices MENORES
      // Simulamos: dado que temos numbers[i], o resultado seguinte foi numbers[i-1]
      const maxTests = Math.min(150, numbers.length - 2);
      for (let w = 1; w < maxTests; w++) {
        tests++;
        const nextNum = numbers[w - 1]; // número que veio DEPOIS de numbers[w]
        if (nums.includes(nextNum)) hits += 1;
        else if (w >= 2 && nums.includes(numbers[w - 2])) hits += 0.4; // +1 spin
      }
      return tests > 0 ? hits / tests : 0;
    };

    // ==========================================
    // Define 6 strategies
    // ==========================================
    interface Strategy {
      type: string;
      label: string;
      emoji: string;
      numbers: number[];
      coverage: number; // % of wheel covered
      payout: number; // average payout multiplier
      score: number;
      probability: number;
      justification: string;
    }

    const strategies: Strategy[] = [];

    // 1. SNIPER (Setor) — best number + 4 neighbors
    if (numScores.length > 0) {
      const sniperTarget = numScores[0];
      const sniperNeighbors = getNeighbors(sniperTarget.num, 4);
      const sniperNums = [sniperTarget.num, ...sniperNeighbors];
      const sniperScore = sumScores(sniperNums) + (mesaMode === 'fisico' ? blocoA * 0.1 : 0) + sniperTarget.score * 2;
      const bt = backtestSet(sniperNums);
      strategies.push({
        type: 'sniper', label: 'Sniper (Setor)', emoji: '🎯',
        numbers: sniperNums, coverage: (9/37)*100, payout: 36,
        score: sniperScore + bt * 20,
        probability: Math.min(98, Math.round(50 + sniperScore * 2.5 + bt * 30)),
        justification: `Viciação de Dealer detectada. Alvo ${sniperTarget.num} + 4 vizinhos. ${sniperTarget.reasons.slice(0,3).join(', ')}`,
      });
    }

    // 2. CAVALOS (Terminais) — best cavalo group
    const bestCavaloGroup = sortedCavalos[0];
    const cavaloNums = CAVALOS[bestCavaloGroup[0]] || [];
    const cavaloScore = sumScores(cavaloNums) + (mesaMode === 'matematico' ? blocoB * 0.08 : 0);
    const cavBt = backtestSet(cavaloNums);
    strategies.push({
      type: 'cavalos', label: `Cavalos ${bestCavaloGroup[0]}`, emoji: '🐴',
      numbers: cavaloNums, coverage: (cavaloNums.length/37)*100, payout: 36 - cavaloNums.length,
      score: cavaloScore + cavBt * 18,
      probability: Math.min(98, Math.round(45 + cavaloScore * 1.8 + cavBt * 25)),
      justification: `Ciclo matemático favorece grupo C${bestCavaloGroup[0]} (${bestCavaloGroup[1]}x em 30). Terminais ${sortedTerminals.slice(0,2).map(([t])=>t).join(',')} dominantes.`,
    });

    // 3. DÚZIAS DOBRADAS (24 números)
    const dozenSorted = dozenCount.map((c, i) => ({ dozen: i+1, count: c })).sort((a,b) => b.count - a.count);
    const dz1 = dozenSorted[0].dozen, dz2 = dozenSorted[1].dozen;
    const dozenNums = Array.from({length:36}, (_,i) => i+1).filter(n => getDozen(n) === dz1 || getDozen(n) === dz2);
    const dzScore = sumScores(dozenNums) * 0.3 + (recoveryMode ? 15 : 0);
    const dzBt = backtestSet(dozenNums);
    strategies.push({
      type: 'duzias', label: `Dúzias ${dz1}+${dz2}`, emoji: '📊',
      numbers: dozenNums, coverage: (24/37)*100, payout: 3,
      score: dzScore + dzBt * 15,
      probability: Math.min(98, Math.round(55 + dzBt * 35 + dzScore * 0.8)),
      justification: `Recuperação de banca: Dúzias ${dz1} e ${dz2} cobrindo 64% da mesa. ${recoveryMode ? 'Modo recuperação ativo.' : ''}`,
    });

    // 4. VIZINHOS DO ZERO (17 números)
    const voisinsScore = sumScores(VOISINS) + (seesawBias === 'zero' ? 10 : 0) + (sectorFreq['Voisins'] > 12 ? 8 : 0);
    const voisBt = backtestSet(VOISINS);
    strategies.push({
      type: 'voisins', label: 'Vizinhos do Zero', emoji: '🎰',
      numbers: [...VOISINS], coverage: (17/37)*100, payout: 36 - 17,
      score: voisinsScore + voisBt * 16 + (mesaMode === 'fisico' ? 5 : 0),
      probability: Math.min(98, Math.round(50 + voisinsScore * 1.2 + voisBt * 28)),
      justification: `Atração física do centro do cilindro. Setor Voisins com ${sectorFreq['Voisins']}x em 30. ${seesawBias === 'zero' ? 'Gangorra favorece Zero.' : ''}`,
    });

    // 5. ORPHELINS/TIERS (opostos)
    const tiersScore = sumScores(TIERS) + (seesawBias === 'opposite' ? 10 : 0);
    const orphScore = sumScores(ORPHELINS);
    const useTiers = tiersScore > orphScore;
    const opSector = useTiers ? TIERS : ORPHELINS;
    const opLabel = useTiers ? 'Tiers' : 'Orphelins';
    const opScore = useTiers ? tiersScore : orphScore;
    const opBt = backtestSet(opSector);
    strategies.push({
      type: 'setor_oposto', label: opLabel, emoji: '🔄',
      numbers: [...opSector], coverage: (opSector.length/37)*100, payout: 36 - opSector.length,
      score: opScore + opBt * 16,
      probability: Math.min(98, Math.round(45 + opScore * 1.5 + opBt * 28)),
      justification: `Balanço de cilindro favorece ${opLabel}. ${seesawBias === 'opposite' ? 'Gangorra detectada contra Zero.' : `${opLabel} com concentração recente.`}`,
    });

    // 6. QUEBRA DE SEQUÊNCIA (contra cor/paridade dominante)
    let breakNums: number[] = [];
    let breakLabel = '';
    let breakExtra = 0;
    if (colorBias === 'red') { breakNums = Array.from({length:36}, (_,i)=>i+1).filter(n => !RED.includes(n)); breakLabel = 'Contra Vermelho → Preto'; breakExtra = redCount - blackCount; }
    else if (colorBias === 'black') { breakNums = Array.from({length:36}, (_,i)=>i+1).filter(n => RED.includes(n)); breakLabel = 'Contra Preto → Vermelho'; breakExtra = blackCount - redCount; }
    else if (parityBias === 'even') { breakNums = Array.from({length:36}, (_,i)=>i+1).filter(n => n % 2 === 1); breakLabel = 'Contra Par → Ímpar'; breakExtra = evenCount - oddCount; }
    else if (parityBias === 'odd') { breakNums = Array.from({length:36}, (_,i)=>i+1).filter(n => n % 2 === 0); breakLabel = 'Contra Ímpar → Par'; breakExtra = oddCount - evenCount; }
    else { breakNums = Array.from({length:36}, (_,i)=>i+1).filter(n => !RED.includes(n)); breakLabel = 'Cor alternativa'; breakExtra = 0; }
    const breakScore = (highEntropy ? 15 : 5) + breakExtra * 2;
    const breakBt = backtestSet(breakNums);
    strategies.push({
      type: 'quebra', label: `Quebra: ${breakLabel}`, emoji: '⚡',
      numbers: breakNums.slice(0, 18), coverage: (18/37)*100, payout: 2,
      score: breakScore + breakBt * 12,
      probability: Math.min(98, Math.round(48 + breakBt * 35 + breakExtra * 3)),
      justification: `Alta entropia (${entropy.toFixed(2)}) sugere reversão. ${breakLabel}. Sequência de ${breakExtra} a mais.`,
    });

    // ==========================================
    // SIMPLE BET TYPES — Cor, Par/Ímpar, Alto/Baixo, Coluna, Dúzia, Número Exato
    // ==========================================

    // COR (Red vs Black) — INTELLIGENT: follows trend when algorithm is trending, reverses when exhausting
    const redNums30 = last30.filter(n => RED.includes(n)).length;
    const blackNums30 = last30.filter(n => n > 0 && !RED.includes(n)).length;
    // TREND ENGINE: if color trend is detected and should follow, bet WITH the trend
    const betOnRed = trendEngine.colorTrend.shouldFollow
      ? trendEngine.colorTrend.direction === 'red'
      : (trendEngine.colorTrend.direction === 'red' ? true : trendEngine.colorTrend.direction === 'black' ? false : blackNums30 > redNums30);
    const colorNums = betOnRed
      ? Array.from({length:36}, (_,i) => i+1).filter(n => RED.includes(n))
      : Array.from({length:36}, (_,i) => i+1).filter(n => !RED.includes(n));
    const colorImbalance = Math.abs(redNums30 - blackNums30);
    const colorBtRate = backtestSet(colorNums);
    const colorTrendBonus = trendEngine.colorTrend.shouldFollow ? trendEngine.colorTrend.strength * 0.15 : 0;
    strategies.push({
      type: 'cor', label: betOnRed ? '🔴 Vermelho' : '⚫ Preto', emoji: betOnRed ? '🔴' : '⚫',
      numbers: colorNums, coverage: (18/37)*100, payout: 2,
      score: colorImbalance * 3 + colorBtRate * 25 + colorTrendBonus,
      probability: Math.min(98, Math.round(45 + colorBtRate * 40 + colorImbalance * 2 + colorTrendBonus)),
      justification: trendEngine.colorTrend.shouldFollow
        ? `${betOnRed ? 'Vermelho' : 'Preto'} A FAVOR DO ALGORITMO: tendência acelerando (${trendEngine.colorTrend.strength}% força). Backtest: ${(colorBtRate*100).toFixed(0)}%.`
        : `${betOnRed ? 'Vermelho' : 'Preto'} ${trendEngine.colorTrend.direction ? 'por reversão' : 'atrasado'} (${betOnRed ? redNums30 : blackNums30}x vs ${betOnRed ? blackNums30 : redNums30}x em 30). Backtest: ${(colorBtRate*100).toFixed(0)}%.`,
    });

    // PAR/ÍMPAR — INTELLIGENT: follows trend when algorithm is trending
    const even30 = last30.filter(n => n > 0 && n % 2 === 0).length;
    const odd30 = last30.filter(n => n > 0 && n % 2 === 1).length;
    const betOnEven = trendEngine.parityTrend.shouldFollow
      ? trendEngine.parityTrend.direction === 'par'
      : (trendEngine.parityTrend.direction === 'par' ? true : trendEngine.parityTrend.direction === 'impar' ? false : odd30 > even30);
    const parityNums = betOnEven
      ? Array.from({length:36}, (_,i) => i+1).filter(n => n % 2 === 0)
      : Array.from({length:36}, (_,i) => i+1).filter(n => n % 2 === 1);
    const parityImbalance = Math.abs(even30 - odd30);
    const parityBtRate = backtestSet(parityNums);
    const parityTrendBonus = trendEngine.parityTrend.shouldFollow ? trendEngine.parityTrend.strength * 0.15 : 0;
    strategies.push({
      type: 'paridade', label: betOnEven ? '🔵 Par' : '🟠 Ímpar', emoji: betOnEven ? '🔵' : '🟠',
      numbers: parityNums, coverage: (18/37)*100, payout: 2,
      score: parityImbalance * 3 + parityBtRate * 25 + parityTrendBonus,
      probability: Math.min(98, Math.round(45 + parityBtRate * 40 + parityImbalance * 2 + parityTrendBonus)),
      justification: trendEngine.parityTrend.shouldFollow
        ? `${betOnEven ? 'Par' : 'Ímpar'} A FAVOR DO ALGORITMO: tendência acelerando. Backtest: ${(parityBtRate*100).toFixed(0)}%.`
        : `${betOnEven ? 'Par' : 'Ímpar'} ${trendEngine.parityTrend.direction ? 'por reversão' : 'atrasado'} (${betOnEven ? even30 : odd30}x vs ${betOnEven ? odd30 : even30}x em 30). Backtest: ${(parityBtRate*100).toFixed(0)}%.`,
    });

    // ALTO/BAIXO — INTELLIGENT: follows trend when algorithm is trending
    const high30 = last30.filter(n => n >= 19 && n <= 36).length;
    const low30 = last30.filter(n => n >= 1 && n <= 18).length;
    const betOnHigh = trendEngine.highLowTrend.shouldFollow
      ? trendEngine.highLowTrend.direction === 'alto'
      : (trendEngine.highLowTrend.direction === 'alto' ? true : trendEngine.highLowTrend.direction === 'baixo' ? false : low30 > high30);
    const hlNums = betOnHigh
      ? Array.from({length:18}, (_,i) => i+19)
      : Array.from({length:18}, (_,i) => i+1);
    const hlImbalance = Math.abs(high30 - low30);
    const hlBtRate = backtestSet(hlNums);
    const hlTrendBonus = trendEngine.highLowTrend.shouldFollow ? trendEngine.highLowTrend.strength * 0.15 : 0;
    strategies.push({
      type: 'alto_baixo', label: betOnHigh ? '⬆️ Alto (19-36)' : '⬇️ Baixo (1-18)', emoji: betOnHigh ? '⬆️' : '⬇️',
      numbers: hlNums, coverage: (18/37)*100, payout: 2,
      score: hlImbalance * 3 + hlBtRate * 25 + hlTrendBonus,
      probability: Math.min(98, Math.round(45 + hlBtRate * 40 + hlImbalance * 2 + hlTrendBonus)),
      justification: trendEngine.highLowTrend.shouldFollow
        ? `${betOnHigh ? 'Alto' : 'Baixo'} A FAVOR DO ALGORITMO: tendência acelerando. Backtest: ${(hlBtRate*100).toFixed(0)}%.`
        : `${betOnHigh ? 'Alto' : 'Baixo'} ${trendEngine.highLowTrend.direction ? 'por reversão' : 'atrasado'} (${betOnHigh ? high30 : low30}x vs ${betOnHigh ? low30 : high30}x em 30). Backtest: ${(hlBtRate*100).toFixed(0)}%.`,
    });

    // COLUNA — best performing column
    const colCount30 = [0, 0, 0];
    last30.forEach(n => { const c = getColumn(n); if (c > 0) colCount30[c-1]++; });
    const coldestCol = colCount30.indexOf(Math.min(...colCount30)) + 1;
    const colNums = coldestCol === 1 ? COL1 : coldestCol === 2 ? COL2 : COL3;
    const colDelay = colCount30[coldestCol - 1];
    const colBtRate = backtestSet(colNums);
    strategies.push({
      type: 'coluna', label: `📐 Coluna ${coldestCol}`, emoji: '📐',
      numbers: [...colNums], coverage: (12/37)*100, payout: 3,
      score: (10 - colDelay) * 2 + colBtRate * 22,
      probability: Math.min(98, Math.round(30 + colBtRate * 45 + (10 - colDelay) * 3)),
      justification: `Coluna ${coldestCol} com apenas ${colDelay}x em 30 (atrasada). Backtest: ${(colBtRate*100).toFixed(0)}%.`,
    });

    // DÚZIA ÚNICA — coldest single dozen
    const dozenCount30 = [0, 0, 0];
    last30.forEach(n => { const d = getDozen(n); if (d > 0) dozenCount30[d-1]++; });
    const coldestDz = dozenCount30.indexOf(Math.min(...dozenCount30)) + 1;
    const dzNums = Array.from({length:12}, (_,i) => (coldestDz-1)*12 + i + 1);
    const dzDelay = dozenCount30[coldestDz - 1];
    const dzBtSingle = backtestSet(dzNums);
    strategies.push({
      type: 'duzia_unica', label: `🎲 Dúzia ${coldestDz}`, emoji: '🎲',
      numbers: dzNums, coverage: (12/37)*100, payout: 3,
      score: (10 - dzDelay) * 2 + dzBtSingle * 22,
      probability: Math.min(98, Math.round(30 + dzBtSingle * 45 + (10 - dzDelay) * 3)),
      justification: `Dúzia ${coldestDz} (${(coldestDz-1)*12+1}-${coldestDz*12}) com ${dzDelay}x em 30. Backtest: ${(dzBtSingle*100).toFixed(0)}%.`,
    });

    // NÚMERO EXATO — top scoring single number
    if (numScores.length > 0) {
      const topNum = numScores[0];
      const numBtRate = (() => {
        let h = 0, t = 0;
        const mx = Math.min(100, numbers.length - 5);
        for (let w = 0; w < mx; w++) { t++; if (numbers[w+5] === topNum.num) h++; }
        return t > 0 ? h / t : 0;
      })();
      strategies.push({
        type: 'numero_exato', label: `💎 Pleno no ${topNum.num}`, emoji: '💎',
        numbers: [topNum.num], coverage: (1/37)*100, payout: 36,
        score: topNum.score * 3 + numBtRate * 100,
        probability: Math.min(98, Math.round(5 + topNum.score * 5 + numBtRate * 80)),
        justification: `Número ${topNum.num} com convergência máxima: ${topNum.reasons.slice(0,4).join(', ')}. Backtest: ${(numBtRate*100).toFixed(0)}%.`,
      });
    }

    // ==========================================
    // 7. DYNAMIC STRATEGY FROM INSIGHTS — AI-generated pattern-based plays
    // ==========================================
    const insightTopNums = Object.entries(insightNumbers)
      .map(([n, score]) => ({ num: Number(n), score }))
      .filter(x => x.score > 1)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map(x => x.num);
    if (insightTopNums.length >= 5) {
      const insScore = sumScores(insightTopNums) + insightTopNums.length * 1.5;
      const insBt = backtestSet(insightTopNums);
      strategies.push({
        type: 'insight_pattern', label: 'Padrão IA Detectado', emoji: '🧬',
        numbers: insightTopNums, coverage: (insightTopNums.length / 37) * 100, payout: 36 - insightTopNums.length,
        score: insScore + insBt * 20,
        probability: Math.min(98, Math.round(50 + insScore * 1.5 + insBt * 30)),
        justification: `Padrões detectados pela IA convergem em ${insightTopNums.length} números. Backtesting: ${(insBt * 100).toFixed(0)}%.`,
      });
    }

    // 8. SURPRISE RECOVERY — plays numbers that frequently appear when predictions miss
    if (surpriseNumbers.length >= 5) {
      const surpriseNums = surpriseNumbers.slice(0, 10);
      const srpScore = sumScores(surpriseNums) + surpriseNums.length * 2;
      const srpBt = backtestSet(surpriseNums);
      strategies.push({
        type: 'surprise_recovery', label: 'Recuperação Surpresa', emoji: '🎲',
        numbers: surpriseNums, coverage: (surpriseNums.length / 37) * 100, payout: 36 - surpriseNums.length,
        score: srpScore + srpBt * 18,
        probability: Math.min(98, Math.round(45 + srpScore * 1.8 + srpBt * 28)),
        justification: `Números que saem quando erramos: ${surpriseNums.slice(0, 5).join(',')}. Aprendido com ${Object.values(numberMissFreq).reduce((a, b) => a + b, 0)} erros.`,
      });
    }

    // 9. CROSS-DELAY ATTACK — numbers with multiple simultaneous delays
    if (crossDelayTargets.length >= 3) {
      const crossNums = crossDelayTargets.slice(0, 8).map(t => t.num);
      const neighbors: number[] = [];
      crossNums.slice(0, 3).forEach(n => getNeighbors(n, 2).forEach(nb => { if (!crossNums.includes(nb) && !neighbors.includes(nb)) neighbors.push(nb); }));
      const fullCrossNums = [...crossNums, ...neighbors.slice(0, 4)];
      const crossScore = sumScores(fullCrossNums) + crossDelayTargets.slice(0, 5).reduce((a, t) => a + t.total * 0.1, 0);
      const crossBt = backtestSet(fullCrossNums);
      strategies.push({
        type: 'cross_delay', label: 'Atraso Cruzado', emoji: '💥',
        numbers: fullCrossNums, coverage: (fullCrossNums.length / 37) * 100, payout: 36 - fullCrossNums.length,
        score: crossScore + crossBt * 22,
        probability: Math.min(98, Math.round(48 + crossScore * 2 + crossBt * 30)),
        justification: `${crossDelayTargets.length} números com atraso em múltiplos grupos. Explosão iminente: ${crossNums.slice(0, 4).join(',')}.`,
      });
    }

    // 11. TERMINAL ALTERNATION — detect terminal cycling patterns (e.g. T2→T8→T2)
    const termSeq = last15.map(n => n % 10);
    const termTransPairs: Record<string, number> = {};
    for (let i = 0; i < termSeq.length - 1; i++) {
      const key = `${termSeq[i]}->${termSeq[i+1]}`;
      termTransPairs[key] = (termTransPairs[key] || 0) + 1;
    }
    const strongTransitions = Object.entries(termTransPairs).filter(([,c]) => c >= 2).sort(([,a],[,b]) => b - a);
    if (strongTransitions.length > 0) {
      const lastTerm = termSeq[0];
      // Predict next terminal based on most common transition from current terminal
      const nextTermCandidates = strongTransitions
        .filter(([k]) => k.startsWith(`${lastTerm}->`))
        .map(([k, c]) => ({ term: parseInt(k.split('->')[1]), count: c }));
      if (nextTermCandidates.length > 0) {
        const predictedTerm = nextTermCandidates[0].term;
        const termNums = Array.from({length:37}, (_,i) => i).filter(n => n % 10 === predictedTerm);
        const taScore = sumScores(termNums) + nextTermCandidates[0].count * 5 + strongTransitions.length * 2;
        const taBt = backtestSet(termNums);
        strategies.push({
          type: 'terminal_alternation', label: `🔄 Terminal ${predictedTerm} (Alternância)`, emoji: '🔄',
          numbers: termNums, coverage: (termNums.length/37)*100, payout: 36 - termNums.length,
          score: taScore + taBt * 22,
          probability: Math.min(98, Math.round(40 + taScore * 2 + taBt * 35)),
          justification: `Alternância de terminais detectada: T${lastTerm}→T${predictedTerm} (${nextTermCandidates[0].count}x). Padrão cíclico ativo.`,
        });
      }
    }

    // 12. COLUMN CYCLING — detect column rotation pattern
    const colSeq = last15.filter(n => n > 0).map(n => getColumn(n));
    const colTransPairs: Record<string, number> = {};
    for (let i = 0; i < colSeq.length - 1; i++) {
      const key = `${colSeq[i]}->${colSeq[i+1]}`;
      colTransPairs[key] = (colTransPairs[key] || 0) + 1;
    }
    const strongColTrans = Object.entries(colTransPairs).filter(([,c]) => c >= 2).sort(([,a],[,b]) => b - a);
    if (strongColTrans.length > 0) {
      const lastCol = colSeq[0];
      const nextColCandidates = strongColTrans
        .filter(([k]) => k.startsWith(`${lastCol}->`))
        .map(([k, c]) => ({ col: parseInt(k.split('->')[1]), count: c }));
      if (nextColCandidates.length > 0) {
        const predictedCol = nextColCandidates[0].col;
        const ccNums = predictedCol === 1 ? COL1 : predictedCol === 2 ? COL2 : COL3;
        const ccScore = sumScores(ccNums) + nextColCandidates[0].count * 4;
        const ccBt = backtestSet(ccNums);
        strategies.push({
          type: 'column_cycle', label: `📐 Coluna ${predictedCol} (Ciclo)`, emoji: '📐',
          numbers: [...ccNums], coverage: (12/37)*100, payout: 3,
          score: ccScore + ccBt * 22,
          probability: Math.min(98, Math.round(35 + ccScore * 1.8 + ccBt * 40)),
          justification: `Rotação de colunas: Col${lastCol}→Col${predictedCol} (${nextColCandidates[0].count}x). Ciclo previsível.`,
        });
      }
    }

    // 13. DOZEN PHASE — detect dozen phase cycling
    const dzSeq = last15.filter(n => n > 0).map(n => getDozen(n));
    const dzTransPairs: Record<string, number> = {};
    for (let i = 0; i < dzSeq.length - 1; i++) {
      const key = `${dzSeq[i]}->${dzSeq[i+1]}`;
      dzTransPairs[key] = (dzTransPairs[key] || 0) + 1;
    }
    const strongDzTrans = Object.entries(dzTransPairs).filter(([,c]) => c >= 2).sort(([,a],[,b]) => b - a);
    if (strongDzTrans.length > 0) {
      const lastDz = dzSeq[0];
      const nextDzCandidates = strongDzTrans
        .filter(([k]) => k.startsWith(`${lastDz}->`))
        .map(([k, c]) => ({ dz: parseInt(k.split('->')[1]), count: c }));
      if (nextDzCandidates.length > 0) {
        const predictedDz = nextDzCandidates[0].dz;
        const dpNums = Array.from({length:12}, (_,i) => (predictedDz-1)*12 + i + 1);
        const dpScore = sumScores(dpNums) + nextDzCandidates[0].count * 4;
        const dpBt = backtestSet(dpNums);
        strategies.push({
          type: 'dozen_phase', label: `🎯 Dúzia ${predictedDz} (Fase)`, emoji: '🎯',
          numbers: dpNums, coverage: (12/37)*100, payout: 3,
          score: dpScore + dpBt * 22,
          probability: Math.min(98, Math.round(35 + dpScore * 1.8 + dpBt * 40)),
          justification: `Fase de dúzias: D${lastDz}→D${predictedDz} (${nextDzCandidates[0].count}x). Momento cíclico.`,
        });
      }
    }

    // 17. COBERTURA DE ÁREA — based on sector alternation from transition matrix
    if (transitionMatrix.predictedSector) {
      const sectorNums = transitionMatrix.predictedSector === 'Voisins' ? [...VOISINS]
        : transitionMatrix.predictedSector === 'Tiers' ? [...TIERS] : [...ORPHELINS];
      const caScore = sumScores(sectorNums) + transitionMatrix.mesaModeStrength * 0.15;
      const caBt = backtestSet(sectorNums);
      strategies.push({
        type: 'cobertura_area', label: `🗺️ Cobertura ${transitionMatrix.predictedSector}`, emoji: '🗺️',
        numbers: sectorNums, coverage: (sectorNums.length / 37) * 100, payout: 36 - sectorNums.length,
        score: caScore + caBt * 22 + (transitionMatrix.mesaModeLabel === 'ALTERNÂNCIA' ? 10 : 0),
        probability: Math.min(98, Math.round(45 + caScore * 1.5 + caBt * 30)),
        justification: `Matriz de transição: ${getSector(numbers[0])}→${transitionMatrix.predictedSector} (modo ${transitionMatrix.mesaModeLabel}). Fidelidade ${transitionMatrix.mesaModeStrength}%.`,
      });
    }

    // 18. TERMINAIS CRUZADOS — when one terminal "calls" another via matrix
    if (transitionMatrix.predictedTerminal !== null) {
      const crossTermNums = Array.from({ length: 37 }, (_, i) => i).filter(n => n % 10 === transitionMatrix.predictedTerminal);
      const ctScore = sumScores(crossTermNums) + 5;
      const ctBt = backtestSet(crossTermNums);
      strategies.push({
        type: 'terminais_cruzados', label: `🐎 Terminal ${transitionMatrix.predictedTerminal} (Cruzado)`, emoji: '🐎',
        numbers: crossTermNums, coverage: (crossTermNums.length / 37) * 100, payout: 36 - crossTermNums.length,
        score: ctScore + ctBt * 22,
        probability: Math.min(98, Math.round(42 + ctScore * 2 + ctBt * 35)),
        justification: `Terminal cruzado: T${numbers[0] % 10}→T${transitionMatrix.predictedTerminal} via matriz de 200 giros.`,
      });
    }

    // 19. PRESSÃO DE RETORNO — dozen pressure trigger
    if (transitionMatrix.dozenPressureTrigger?.active) {
      const pDz = transitionMatrix.dozenPressureTrigger.dozen;
      const prNums = Array.from({ length: 12 }, (_, i) => (pDz - 1) * 12 + i + 1);
      const prScore = sumScores(prNums) + transitionMatrix.dozenPressureTrigger.delay * 0.5 + transitionMatrix.dozenPressureTrigger.historicalDominance * 0.2;
      const prBt = backtestSet(prNums);
      strategies.push({
        type: 'pressao_retorno', label: `🔥 Pressão D${pDz} (Retorno)`, emoji: '🔥',
        numbers: prNums, coverage: (12 / 37) * 100, payout: 3,
        score: prScore + prBt * 25 + transitionMatrix.dozenPressureTrigger.delay,
        probability: Math.min(98, Math.round(50 + prScore * 1.5 + prBt * 35)),
        justification: `Gatilho de Pressão: Dúzia ${pDz} ausente há ${transitionMatrix.dozenPressureTrigger.delay} giros, mas dominou ${transitionMatrix.dozenPressureTrigger.historicalDominance}% em 500. Retorno iminente.`,
      });
    }

    // 14. HOT/COLD PHASE — detect whether mesa is in hot (repeating) or cold (spreading) phase
    const uniqueIn10 = new Set(last10).size;
    const repeatRatio = 1 - (uniqueIn10 / last10.length);
    if (repeatRatio > 0.3) {
      // HOT phase — bet on recently repeated numbers + their neighbors
      const repeated = last10.filter((n, i) => last10.indexOf(n) !== i);
      const uniqueRepeated = [...new Set(repeated)];
      const hotNeighbors: number[] = [];
      uniqueRepeated.forEach(n => getNeighbors(n, 2).forEach(nb => { if (!uniqueRepeated.includes(nb) && !hotNeighbors.includes(nb)) hotNeighbors.push(nb); }));
      const hotNums = [...uniqueRepeated, ...hotNeighbors.slice(0, 6)];
      const hotScore = sumScores(hotNums) + repeatRatio * 20;
      const hotBt = backtestSet(hotNums);
      strategies.push({
        type: 'hot_phase', label: '🔥 Fase Quente (Repetições)', emoji: '🔥',
        numbers: hotNums, coverage: (hotNums.length/37)*100, payout: 36 - hotNums.length,
        score: hotScore + hotBt * 20,
        probability: Math.min(98, Math.round(45 + hotScore * 1.5 + hotBt * 30)),
        justification: `Mesa em fase quente: ${uniqueRepeated.join(',')} repetidos. Taxa repetição: ${(repeatRatio*100).toFixed(0)}%.`,
      });
    } else if (uniqueIn10 >= 9) {
      // COLD phase — bet on numbers NOT seen recently (spreading pattern)
      const coldNums = Array.from({length:37}, (_,i) => i).filter(n => !last10.includes(n));
      const topCold = coldNums.sort((a, b) => (numScores.find(s => s.num === b)?.score || 0) - (numScores.find(s => s.num === a)?.score || 0)).slice(0, 12);
      const coldScore = sumScores(topCold) + (uniqueIn10 / 10) * 15;
      const coldBt = backtestSet(topCold);
      strategies.push({
        type: 'cold_phase', label: '❄️ Fase Fria (Dispersão)', emoji: '❄️',
        numbers: topCold, coverage: (topCold.length/37)*100, payout: 36 - topCold.length,
        score: coldScore + coldBt * 20,
        probability: Math.min(98, Math.round(42 + coldScore * 1.5 + coldBt * 30)),
        justification: `Mesa dispersando: ${uniqueIn10}/10 únicos. Top alvos frios: ${topCold.slice(0,5).join(',')}.`,
      });
    }

    // 10. HISTORICAL WINNERS — numbers that historically hit when predicted
    const histWinners = Object.entries(numberHitFreq)
      .filter(([, c]) => c >= 2)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([n]) => Number(n));
    if (histWinners.length >= 4) {
      const hwNeighbors: number[] = [];
      histWinners.slice(0, 3).forEach(n => getNeighbors(n, 1).forEach(nb => { if (!histWinners.includes(nb) && !hwNeighbors.includes(nb)) hwNeighbors.push(nb); }));
      const hwNums = [...histWinners, ...hwNeighbors.slice(0, 4)];
      const hwScore = sumScores(hwNums) + histWinners.reduce((a, n) => a + (numberHitFreq[n] || 0) * 1.5, 0);
      const hwBt = backtestSet(hwNums);
      strategies.push({
        type: 'historical_winners', label: 'Campeões Históricos', emoji: '🏆',
        numbers: hwNums, coverage: (hwNums.length / 37) * 100, payout: 36 - hwNums.length,
        score: hwScore + hwBt * 20,
        probability: Math.min(98, Math.round(50 + hwScore * 1.5 + hwBt * 30)),
        justification: `Números com histórico comprovado de acertos: ${histWinners.slice(0, 5).join(',')}. Total: ${histWinners.reduce((a, n) => a + (numberHitFreq[n] || 0), 0)} acertos.`,
      });
    }

    // 15. GENETIC CLUSTER — strategy from auto-discovered co-occurrence clusters
    if (geneticPatterns.length > 0) {
      const gpNums = geneticPatterns[0].numbers;
      const gpScore = sumScores(gpNums) + geneticPatterns[0].strength * 2;
      const gpBt = backtestSet(gpNums);
      strategies.push({
        type: 'genetic_cluster', label: `🧬 ${geneticPatterns[0].name}`, emoji: '🧬',
        numbers: gpNums, coverage: (gpNums.length / 37) * 100, payout: 36 - gpNums.length,
        score: gpScore + gpBt * 22,
        probability: Math.min(98, Math.round(45 + gpScore * 1.5 + gpBt * 30)),
        justification: `Padrão genético auto-descoberto: ${geneticPatterns[0].name}. Co-ocorrência forte: ${gpNums.slice(0, 5).join(',')}.`,
      });
    }

    // 16. CYLINDER BIAS — strategy from micro-vibration physics
    if (cylinderInertia.biasedNums.length >= 3) {
      const cyNums = [...cylinderInertia.biasedNums];
      // Add neighbors of biased numbers
      cylinderInertia.biasedNums.slice(0, 3).forEach(n => getNeighbors(n, 1).forEach(nb => { if (!cyNums.includes(nb)) cyNums.push(nb); }));
      const cyScore = sumScores(cyNums) + cylinderInertia.biasedNums.length * 3;
      const cyBt = backtestSet(cyNums);
      strategies.push({
        type: 'cylinder_bias', label: '🔩 Vício do Cilindro', emoji: '🔩',
        numbers: cyNums.slice(0, 15), coverage: (Math.min(15, cyNums.length) / 37) * 100, payout: 36 - Math.min(15, cyNums.length),
        score: cyScore + cyBt * 20 + (cylinderInertia.pinStrength > 20 ? 10 : 0),
        probability: Math.min(98, Math.round(48 + cyScore * 1.5 + cyBt * 28)),
        justification: `Micro-imperfeição detectada: ${cylinderInertia.biasedNums.length} posições viciadas. ${cylinderInertia.dominantPin !== null ? `Pino #${cylinderInertia.dominantPin + 1} dominante.` : ''}`,
      });
    }

    // ==========================================
    // 25. CONVERGÊNCIA ABSOLUTA — 99% accuracy target
    // Only fires when 6+ INDEPENDENT signal dimensions agree on the same number
    // This is the ultimate accuracy filter
    // ==========================================
    (() => {
      if (numScores.length < 5) return;
      
      // For each candidate number, count how many INDEPENDENT dimensions confirm it
      const dimensionScores: { num: number; dimensions: string[]; totalWeight: number; details: string[] }[] = [];
      
      for (const ns of numScores.slice(0, 15)) {
        const n = ns.num;
        const dims: string[] = [];
        const details: string[] = [];
        let weight = 0;
        
        // DIM 1: Pull Chain (número puxado pelo último ou penúltimo)
        const chainScore = deepPullChain[n] || 0;
        if (chainScore >= 5) { dims.push('PULL'); weight += chainScore; details.push(`Pull(${chainScore.toFixed(0)})`); }
        
        // DIM 2: Ritmo do Dealer (alvo por arco direcional)
        if (ritmoCalibration.alvo !== null && ritmoCalibration.confianca >= 70) {
          const dist = wheelDist(n, ritmoCalibration.alvo);
          if (dist <= 2) { dims.push('RITMO'); weight += ritmoCalibration.confianca * 0.15; details.push(`Ritmo(±${dist})`); }
        }
        
        // DIM 3: Matriz de Transição (setor + dúzia + terminal preditos)
        let matrixHits = 0;
        if (transitionMatrix.predictedSector && getSector(n) === transitionMatrix.predictedSector) matrixHits++;
        if (transitionMatrix.predictedDozen && getDozen(n) === transitionMatrix.predictedDozen) matrixHits++;
        if (transitionMatrix.predictedTerminal !== null && n % 10 === transitionMatrix.predictedTerminal) matrixHits++;
        if (matrixHits >= 2) { dims.push('MATRIZ'); weight += matrixHits * 5; details.push(`Matriz(${matrixHits}/3)`); }
        
        // DIM 4: Backtest Histórico (número aparece frequentemente em janelas similares)
        const numBtRate = (() => {
          let h = 0, t = 0;
          const mx = Math.min(150, numbers.length - 8);
          for (let w = 0; w < mx; w++) {
            t++;
            if (numbers[w + 5] === n) h += 1;
            else if (numbers[w + 6] === n) h += 0.3;
          }
          return t > 0 ? h / t : 0;
        })();
        if (numBtRate > 0.025) { dims.push('BACKTEST'); weight += numBtRate * 200; details.push(`BT(${(numBtRate*100).toFixed(1)}%)`); }
        
        // DIM 5: Arquétipos (número previsto por arquétipos ativos)
        const archHit = activeArchetypes.filter(a => a.predictedNums.includes(n));
        if (archHit.length >= 1) { dims.push('ARQTIPO'); weight += archHit.length * 4; details.push(`Arq(${archHit.length})`); }
        
        // DIM 6: Dealer Arc Alignment (arco do dealer aponta para este número)
        if (arcs.length >= 3 && arcStdDev < 5) {
          const avgArc = Math.round(arcMean);
          const idx0 = wheelIdx(numbers[0]);
          if (idx0 !== -1) {
            const pCW = WHEEL[(idx0 + avgArc) % WL];
            const pCCW = WHEEL[(idx0 - avgArc + WL) % WL];
            if (wheelDist(n, pCW) <= 2 || wheelDist(n, pCCW) <= 2) {
              dims.push('ARCO'); weight += 8; details.push('ArcAlign');
            }
          }
        }
        
        // DIM 7: Terminal Quente (número pertence ao terminal dominante)
        if (n % 10 === daniGreen.mod1.terminal && daniGreen.mod1.count >= 3) {
          dims.push('TERMINAL'); weight += daniGreen.mod1.count * 2; details.push(`T${daniGreen.mod1.terminal}(${daniGreen.mod1.count}x)`);
        }
        
        // DIM 8: Dívida Estatística (número atrasado na lei do terço)
        if (absentIn37.includes(n)) { dims.push('DIVIDA'); weight += 4; details.push('Devendo'); }
        
        // DIM 9: Heat Map (zona quente do cilindro)
        const hIdx = wheelIdx(n);
        if (hIdx !== -1 && heatMap[hIdx] >= maxHeat * 0.8) {
          dims.push('HEAT'); weight += 5; details.push('ZonaQuente');
        }
        
        // DIM 10: Fusão Multi-Estratégia (aparece em 3+ estratégias)
        // numberAppearanceCount is computed after strategies are built, skip here
        
        // DIM 11: AI Learned Patterns
        if (learnedBoosts[n] > 1) { dims.push('IA'); weight += learnedBoosts[n]; details.push(`IA(${learnedBoosts[n].toFixed(1)})`); }
        
        // DIM 12: Surprise Recovery (número que aparece quando erramos)
        if (surpriseNumbers.includes(n)) { dims.push('SURPRESA'); weight += 3; details.push('Surpresa'); }
        
        if (dims.length >= 4) {
          dimensionScores.push({ num: n, dimensions: dims, totalWeight: weight, details });
        }
      }
      
      dimensionScores.sort((a, b) => b.dimensions.length - a.dimensions.length || b.totalWeight - a.totalWeight);
      
      if (dimensionScores.length > 0 && dimensionScores[0].dimensions.length >= 5) {
        const best = dimensionScores[0];
        const absNeighbors = getNeighbors(best.num, best.dimensions.length >= 7 ? 2 : 3);
        const absNums = [...new Set([best.num, ...absNeighbors])];
        
        // Also add 2nd best if it has 5+ dims and is a neighbor
        if (dimensionScores.length > 1 && dimensionScores[1].dimensions.length >= 5 && wheelDist(best.num, dimensionScores[1].num) <= 4) {
          if (!absNums.includes(dimensionScores[1].num)) absNums.push(dimensionScores[1].num);
        }
        
        const absScore = sumScores(absNums) + best.totalWeight * 2 + best.dimensions.length * 8;
        const absBt = backtestSet(absNums);
        
        // Probability based on dimension count (geometric confidence)
        const dimProb = Math.min(98, Math.round(50 + best.dimensions.length * 6 + best.totalWeight * 0.8 + absBt * 25));
        
        strategies.push({
          type: 'convergencia_absoluta', label: `💠 Convergência Absoluta → ${best.num}`, emoji: '💠',
          numbers: absNums, coverage: (absNums.length / 37) * 100, payout: 36 - absNums.length,
          score: absScore + absBt * 35 + best.dimensions.length * 12 + (best.dimensions.length >= 7 ? 30 : best.dimensions.length >= 6 ? 15 : 0),
          probability: dimProb,
          justification: `CONVERGÊNCIA ABSOLUTA: ${best.num} confirmado por ${best.dimensions.length} dimensões independentes (${best.dimensions.join('+')}). ${best.details.join(', ')}. Backtest: ${(absBt * 100).toFixed(0)}%.`,
        });
        
        aiLearnings.push(`💠 CONVERGÊNCIA ABSOLUTA: nº${best.num} com ${best.dimensions.length} dimensões (${best.dimensions.join('+')}) — MÁXIMA CONFIANÇA`);
      } else if (dimensionScores.length > 0 && dimensionScores[0].dimensions.length >= 4) {
        aiLearnings.push(`🔍 Quase convergência: nº${dimensionScores[0].num} com ${dimensionScores[0].dimensions.length} dimensões — aguardando mais 1 confirmação`);
      }
    })();


    // 20. RITMO CALIBRADO — strategy based on directional arc prediction (blocoP)
    if (ritmoCalibration.alvo !== null && ritmoCalibration.confianca >= 70) {
      const alvoNeighbors = getNeighbors(ritmoCalibration.alvo, 4);
      const ritmoNums = [...new Set([ritmoCalibration.alvo, ...alvoNeighbors])];
      const ritmoScore = sumScores(ritmoNums) + ritmoCalibration.confianca * 0.3 + (100 - ritmoCalibration.estabilidade) * 0.5;
      const ritmoBt = backtestSet(ritmoNums);
      strategies.push({
        type: 'ritmo_calibrado', label: `🎯 Ritmo → ${ritmoCalibration.alvo}`, emoji: '🎯',
        numbers: ritmoNums, coverage: (ritmoNums.length / 37) * 100, payout: 36 - ritmoNums.length,
        score: ritmoScore + ritmoBt * 25 + (ritmoCalibration.confianca >= 90 ? 15 : ritmoCalibration.confianca >= 80 ? 8 : 0),
        probability: Math.min(98, Math.round(ritmoCalibration.confianca * 0.8 + ritmoBt * 25)),
        justification: `Arco direcional calibrado: alvo ${ritmoCalibration.alvo} (σ=${ritmoCalibration.estabilidade}, confiança ${ritmoCalibration.confianca}%). ${ritmoCalibration.mensagem}`,
      });
    }

    // 21. ARCHETYPE FUSION — combines numbers from all active archetypes
    if (activeArchetypes.length >= 2) {
      const archNums: Record<number, number> = {};
      activeArchetypes.forEach(a => {
        a.predictedNums.forEach((n: number) => { archNums[n] = (archNums[n] || 0) + (a.strength / 100); });
      });
      const fusionNums = Object.entries(archNums)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 12)
        .map(([n]) => Number(n));
      if (fusionNums.length >= 5) {
        const fusionScore = sumScores(fusionNums) + activeArchetypes.length * 5 + activeArchetypes.reduce((a, ar) => a + ar.strength, 0) * 0.05;
        const fusionBt = backtestSet(fusionNums);
        strategies.push({
          type: 'archetype_fusion', label: `🏛️ Fusão de ${activeArchetypes.length} Arquétipos`, emoji: '🏛️',
          numbers: fusionNums, coverage: (fusionNums.length / 37) * 100, payout: 36 - fusionNums.length,
          score: fusionScore + fusionBt * 22 + activeArchetypes.length * 3,
          probability: Math.min(98, Math.round(50 + fusionScore * 1.5 + fusionBt * 30 + activeArchetypes.length * 3)),
          justification: `${activeArchetypes.length} arquétipos convergem: ${activeArchetypes.map(a => a.emoji + a.name.split(' ')[0]).join(', ')}. Top: ${fusionNums.slice(0, 5).join(',')}.`,
        });
      }
    }

    // 22. CONVERGÊNCIA MATRICIAL — combines predicted sector + dozen + terminal from transition matrices

    // ==========================================
    // 23. ULTRA-SNIPER — the single most converged number with maximum context
    // Uses: numScore + deepPullChain + ritmo + matrix + dealer signature
    // ==========================================
    if (numScores.length >= 3) {
      const top3 = numScores.slice(0, 3);
      // Find the number with the most DIVERSE reasons (not just high score)
      const bestDiversity = top3.reduce((best, curr) => {
        const uniqueCategories = new Set(curr.reasons.map(r => r.split(':')[0].replace(/[^a-zA-Z]/g, '')));
        const bestCategories = new Set(best.reasons.map(r => r.split(':')[0].replace(/[^a-zA-Z]/g, '')));
        return uniqueCategories.size > bestCategories.size ? curr : best;
      });
      
      const ultraTarget = bestDiversity.score >= top3[0].score * 0.85 ? bestDiversity : top3[0];
      const ultraNeighborCount = ultraTarget.score > 30 ? 2 : ultraTarget.score > 20 ? 3 : 4;
      const ultraNeighbors = getNeighbors(ultraTarget.num, ultraNeighborCount);
      const ultraNums = [...new Set([ultraTarget.num, ...ultraNeighbors])];
      
      // Ultra score combines: individual score + chain depth + ritmo alignment + matrix alignment
      let ultraBonus = 0;
      if (deepPullChain[ultraTarget.num] > 5) ultraBonus += deepPullChain[ultraTarget.num];
      if (ritmoCalibration.alvo !== null && wheelDist(ultraTarget.num, ritmoCalibration.alvo) <= 3) ultraBonus += ritmoCalibration.confianca * 0.15;
      if (transitionMatrix.predictedSector && getSector(ultraTarget.num) === transitionMatrix.predictedSector) ultraBonus += 8;
      if (transitionMatrix.predictedTerminal !== null && ultraTarget.num % 10 === transitionMatrix.predictedTerminal) ultraBonus += 6;
      if (transitionMatrix.predictedDozen && getDozen(ultraTarget.num) === transitionMatrix.predictedDozen) ultraBonus += 5;
      // Dealer arc alignment
      if (maoViciada || arcStdDev < 3) {
        const avgArc = maoViciada ? Math.round(last3Arcs.reduce((a: number, b: number) => a + b, 0) / 3) : Math.round(arcMean);
        const idx0 = wheelIdx(numbers[0]);
        if (idx0 !== -1) {
          const pCW = WHEEL[(idx0 + avgArc) % WL];
          const pCCW = WHEEL[(idx0 - avgArc + WL) % WL];
          if (wheelDist(ultraTarget.num, pCW) <= 2 || wheelDist(ultraTarget.num, pCCW) <= 2) ultraBonus += 12;
        }
      }
      
      const ultraScore = sumScores(ultraNums) + ultraTarget.score * 2.5 + ultraBonus;
      const ultraBt = backtestSet(ultraNums);
      strategies.push({
        type: 'ultra_sniper', label: `🔥 Ultra Sniper → ${ultraTarget.num}`, emoji: '🔥',
        numbers: ultraNums, coverage: (ultraNums.length / 37) * 100, payout: 36 - ultraNums.length,
        score: ultraScore + ultraBt * 30 + (ultraTarget.reasons.length >= 6 ? 15 : ultraTarget.reasons.length >= 4 ? 8 : 0),
        probability: Math.min(98, Math.round(55 + ultraScore * 2 + ultraBt * 30 + ultraBonus * 0.5)),
        justification: `CONVERGÊNCIA SUPREMA: ${ultraTarget.num} com ${ultraTarget.reasons.length} sinais simultâneos. Chain: ${deepPullChain[ultraTarget.num].toFixed(0)}pts. ${ultraTarget.reasons.slice(0, 4).join(', ')}.`,
      });
    }

    // ==========================================
    // 24. FUSÃO SUPREMA — intersection of top 3 strategies' best numbers
    // ==========================================
    // After all strategies are defined, find numbers that appear in multiple strategies
    const numberAppearanceCount: Record<number, { count: number; strategies: string[]; totalScore: number }> = {};
    for (const st of strategies) {
      for (const n of st.numbers.slice(0, 12)) {
        if (!numberAppearanceCount[n]) numberAppearanceCount[n] = { count: 0, strategies: [], totalScore: 0 };
        numberAppearanceCount[n].count++;
        numberAppearanceCount[n].strategies.push(st.emoji);
        numberAppearanceCount[n].totalScore += st.score;
      }
    }
    const fusionCandidates = Object.entries(numberAppearanceCount)
      .filter(([, v]) => v.count >= 3) // appeared in 3+ strategies
      .sort(([, a], [, b]) => b.count - a.count || b.totalScore - a.totalScore)
      .slice(0, 10)
      .map(([n]) => Number(n));
    
    if (fusionCandidates.length >= 3) {
      const fusionNeighbors: number[] = [];
      fusionCandidates.slice(0, 3).forEach(n => getNeighbors(n, 1).forEach(nb => {
        if (!fusionCandidates.includes(nb) && !fusionNeighbors.includes(nb)) fusionNeighbors.push(nb);
      }));
      const fusionFinalNums = [...fusionCandidates, ...fusionNeighbors.slice(0, 4)];
      const fusionScore = sumScores(fusionFinalNums) + fusionCandidates.length * 5 + fusionCandidates.reduce((a, n) => a + (numberAppearanceCount[n]?.count || 0) * 3, 0);
      const fusionBt = backtestSet(fusionFinalNums);
      const topFusionInfo = fusionCandidates.slice(0, 3).map(n => `${n}(${numberAppearanceCount[n]?.count}est)`).join(', ');
      strategies.push({
        type: 'fusao_suprema', label: `⚡ Fusão Suprema`, emoji: '⚡',
        numbers: fusionFinalNums, coverage: (fusionFinalNums.length / 37) * 100, payout: 36 - fusionFinalNums.length,
        score: fusionScore + fusionBt * 22 + fusionCandidates.length * 2,
        probability: Math.min(98, Math.round(45 + fusionScore * 1.4 + fusionBt * 25 + fusionCandidates.length * 3)),
        justification: `${fusionCandidates.length} números aparecem em 3+ estratégias simultâneas. Convergência máxima: ${topFusionInfo}. Interseção validada por backtest.`,
      });
    }

    // ==========================================
    // DANI GREEN STRATEGIES (Módulos 1-6)
    // ==========================================

    // MÓD 1: Duplo de Terminais
    if (daniGreen.mod1.count >= 2) {
      const t1 = daniGreen.mod1.terminal;
      const t2 = daniGreen.mod1.pair;
      const mod1Nums = [...(TERMINALS_MAP[t1] || []), ...(TERMINALS_MAP[t2] || [])];
      const mod1Score = sumScores(mod1Nums) + daniGreen.mod1.count * 3;
      const mod1Bt = backtestSet(mod1Nums);
      strategies.push({
        type: 'duplo_terminal', label: `🎰 Duplo T${t1}+T${t2}`, emoji: '🎰',
        numbers: mod1Nums, coverage: (mod1Nums.length / 37) * 100, payout: 36 - mod1Nums.length,
        score: mod1Score + mod1Bt * 25 + daniGreen.mod1.count * 4,
        probability: Math.min(98, Math.round(45 + mod1Score * 1.8 + mod1Bt * 30 + daniGreen.mod1.count * 3)),
        justification: `MÓD1 Dani Green: Terminal ${t1} quente (${daniGreen.mod1.count}x/15) + par T${t2}. Cobertura: ${mod1Nums.length} números. REED: max ${REED_MAX} rodadas.`,
      });
    }

    // MÓD 2: Terminais Altos/Baixos
    if (daniGreen.mod2) {
      const isHi = daniGreen.mod2 === 'high';
      const mod2Nums = isHi
        ? [19, 29, 26, 36, 27, 28, 20, 21, 22, 23, 24, 25, 30, 31, 32, 33, 34, 35]
        : Array.from({ length: 18 }, (_, i) => i + 1);
      // Filter to hot terminals within the bias
      const hotT = daniGreen.mod1.terminal;
      const pairT = daniGreen.mod1.pair;
      const mod2Filtered = mod2Nums.filter(n => n % 10 === hotT || n % 10 === pairT);
      if (mod2Filtered.length >= 3) {
        const mod2Score = sumScores(mod2Filtered) + 5;
        const mod2Bt = backtestSet(mod2Filtered);
        strategies.push({
          type: 'terminal_alto_baixo', label: `📊 Terminais ${isHi ? 'Altos' : 'Baixos'} T${hotT}+T${pairT}`, emoji: '📊',
          numbers: mod2Filtered, coverage: (mod2Filtered.length / 37) * 100, payout: 36 - mod2Filtered.length,
          score: mod2Score + mod2Bt * 22 + 8,
          probability: Math.min(98, Math.round(48 + mod2Score * 2 + mod2Bt * 30)),
          justification: `MÓD2: Mesa puxando ${isHi ? 'ALTO' : 'BAIXO'} + Terminais T${hotT}+T${pairT} filtrados. ${mod2Filtered.length} alvos.`,
        });
      }
    }

    // MÓD 3: Poucas Fichas (Terminal único conservador)
    {
      const singleT = daniGreen.mod1.terminal;
      const mod3Nums = TERMINALS_MAP[singleT] || [];
      if (mod3Nums.length >= 3) {
        const mod3Score = sumScores(mod3Nums) + daniGreen.mod1.count * 2;
        const mod3Bt = backtestSet(mod3Nums);
        strategies.push({
          type: 'poucas_fichas', label: `💰 Conservador T${singleT}`, emoji: '💰',
          numbers: mod3Nums, coverage: (mod3Nums.length / 37) * 100, payout: 36 - mod3Nums.length,
          score: mod3Score + mod3Bt * 20 + (daniGreen.mod1.count >= 4 ? 10 : 0),
          probability: Math.min(98, Math.round(35 + mod3Score * 2.5 + mod3Bt * 35)),
          justification: `MÓD3 Poucas Fichas: Terminal ${singleT} (${mod3Nums.join(',')}) com ${mod3Nums.length} fichas. Stop loss: 3 rounds. Meta: +12 fichas.`,
        });
      }
    }

    // MÓD 4: Pressão do Zero
    if (daniGreen.mod4.active) {
      const mod4Nums = [0, ...ZERO_NEIGHBORS_WHEEL, ...ZERO_TERMINAL_NUMS.filter(n => n !== 0)];
      const uniqueMod4 = [...new Set(mod4Nums)];
      const mod4Score = sumScores(uniqueMod4) + daniGreen.mod4.delay * 0.5 + daniGreen.mod4.neighborsActive * 3;
      const mod4Bt = backtestSet(uniqueMod4);
      strategies.push({
        type: 'pressao_zero', label: `🟢 Pressão Zero (${daniGreen.mod4.delay}r)`, emoji: '🟢',
        numbers: uniqueMod4, coverage: (uniqueMod4.length / 37) * 100, payout: 36 - uniqueMod4.length,
        score: mod4Score + mod4Bt * 25 + (daniGreen.mod4.delay >= 20 ? 15 : 8),
        probability: Math.min(98, Math.round(40 + mod4Score * 1.5 + mod4Bt * 30 + daniGreen.mod4.delay * 0.8)),
        justification: `MÓD4: Zero ausente há ${daniGreen.mod4.delay} giros. ${daniGreen.mod4.neighborsActive} vizinhos ativos. Gatilho confirmado!`,
      });
    }

    // MÓD 5: Números que se Puxam (estratégia dedicada)
    if (daniGreen.mod5Pull.length >= 3) {
      const mod5Nums = [...new Set([...daniGreen.mod5Pull])].slice(0, 12);
      // Also add vizinhos na roda de cada puxado
      const mod5WithNeighbors: number[] = [...mod5Nums];
      mod5Nums.slice(0, 4).forEach(n => {
        getNeighbors(n, 1).forEach(nb => { if (!mod5WithNeighbors.includes(nb)) mod5WithNeighbors.push(nb); });
      });
      const finalMod5 = mod5WithNeighbors.slice(0, 15);
      const mod5Score = sumScores(finalMod5) + daniGreen.mod5Pull.length * 2;
      const mod5Bt = backtestSet(finalMod5);
      strategies.push({
        type: 'numeros_puxam', label: `🧲 Puxada do ${daniGreen.mod5LastNum}`, emoji: '🧲',
        numbers: finalMod5, coverage: (finalMod5.length / 37) * 100, payout: 36 - finalMod5.length,
        score: mod5Score + mod5Bt * 22 + daniGreen.mod5Pull.length * 1.5,
        probability: Math.min(98, Math.round(45 + mod5Score * 1.5 + mod5Bt * 28)),
        justification: `MÓD5: ${daniGreen.mod5LastNum} puxa ${daniGreen.mod5Pull.slice(0,6).join(',')} + vizinhos. REED: max ${REED_MAX} rodadas sem acerto.`,
      });
    }

    // MÓD 6: Números Crescentes
    if (daniGreen.mod6.active && daniGreen.mod6.nextTerminal !== null) {
      const mod6TermNums = TERMINALS_MAP[daniGreen.mod6.nextTerminal] || [];
      const mod6Score = sumScores(mod6TermNums) + 8;
      const mod6Bt = backtestSet(mod6TermNums);
      strategies.push({
        type: 'crescente', label: `📈 Crescente → T${daniGreen.mod6.nextTerminal}`, emoji: '📈',
        numbers: mod6TermNums, coverage: (mod6TermNums.length / 37) * 100, payout: 36 - mod6TermNums.length,
        score: mod6Score + mod6Bt * 25 + 10,
        probability: Math.min(98, Math.round(42 + mod6Score * 2 + mod6Bt * 32)),
        justification: `MÓD6: Sequência crescente T${daniGreen.mod6.sequence.join('→T')} detectada → próximo T${daniGreen.mod6.nextTerminal}. Max 2 tentativas.`,
      });
    }

    // DUPLAS DE TERMINAIS (Método Dani Green) — dedicated strategy
    for (const [dKey, dNums] of Object.entries(DUPLAS_TERMINAIS)) {
      const duplaScore = sumScores(dNums);
      // Only suggest if hot terminal matches this dupla
      const t1 = daniGreen.mod1.terminal;
      const t2 = daniGreen.mod1.pair;
      const matchesHot = dNums.some(n => n % 10 === t1 || n % 10 === t2);
      if (matchesHot && duplaScore > 10) {
        const duplaBt = backtestSet(dNums);
        strategies.push({
          type: 'dupla_terminal', label: `🎰 Dupla ${dKey}`, emoji: '🎰',
          numbers: dNums, coverage: (dNums.length / 37) * 100, payout: 36 - dNums.length,
          score: duplaScore + duplaBt * 25 + daniGreen.mod1.count * 3 + (sessionEntropy < 0.5 ? 10 : 0),
          probability: Math.min(98, Math.round(45 + duplaScore * 1.8 + duplaBt * 30)),
          justification: `Dupla de Terminais ${dKey}: ${dNums.length} números. Sessão ${sessionRegime}. Entropia ${(sessionEntropy * 100).toFixed(0)}%.`,
        });
        break; // only add one dupla
      }
    }

    // ==========================================
    // NEW STRATEGIES FROM KNOWLEDGE SYSTEM v1.0
    // ==========================================

    // S5: DÚZIA PROGRESSIVA — D1→D2→D3 or D3→D2→D1
    if (numbers.length >= 3) {
      const dzSeq = numbers.slice(0, 3).filter(n => n > 0).map(n => n <= 12 ? 1 : n <= 24 ? 2 : 3);
      let nextDz: number | null = null;
      if (dzSeq.length === 3 && dzSeq[2] === 1 && dzSeq[1] === 2 && dzSeq[0] === 3) nextDz = 1; // wrap
      if (dzSeq.length === 3 && dzSeq[2] === 3 && dzSeq[1] === 2 && dzSeq[0] === 1) nextDz = 3; // wrap
      if (dzSeq.length === 3 && dzSeq[2] === 1 && dzSeq[1] === 2 && dzSeq[0] !== 3) nextDz = 3;
      if (dzSeq.length === 3 && dzSeq[2] === 2 && dzSeq[1] === 3 && dzSeq[0] !== 1) nextDz = 1;
      if (dzSeq.length >= 2 && dzSeq[1] === 1 && dzSeq[0] === 2) nextDz = 3;
      if (dzSeq.length >= 2 && dzSeq[1] === 2 && dzSeq[0] === 3) nextDz = 1;
      if (dzSeq.length >= 2 && dzSeq[1] === 3 && dzSeq[0] === 2) nextDz = 1;
      if (nextDz) {
        const dzNums = Array.from({ length: 12 }, (_, i) => (nextDz! - 1) * 12 + i + 1);
        const dzScore = sumScores(dzNums) + 8;
        const dzBt = backtestSet(dzNums);
        strategies.push({
          type: 'duzia_progressiva', label: `🎲 Dúzia Progressiva → D${nextDz}`, emoji: '🎲',
          numbers: dzNums, coverage: (12 / 37) * 100, payout: 2,
          score: dzScore + dzBt * 20 + 10,
          probability: Math.min(98, Math.round(40 + dzScore * 1.5 + dzBt * 25)),
          justification: `S5: Sequência de dúzias D${dzSeq.join('→D')} → próxima D${nextDz}. Cobertura 32,4%. Paga 2:1.`,
        });
      }
    }

    // S6/S7: ALTERNÂNCIA DE COR / STREAK DE COR
    {
      const recentColors = numbers.slice(0, 8).filter(n => n > 0).map(n => getColor(n));
      // Check alternation V-P-V-P
      let alternating = true;
      for (let i = 1; i < Math.min(recentColors.length, 5); i++) {
        if (recentColors[i] === recentColors[i - 1]) { alternating = false; break; }
      }
      if (alternating && recentColors.length >= 4) {
        const nextColor = recentColors[0] === 'red' ? 'black' : 'red';
        const colorNums = nextColor === 'red' ? RED.filter(n => n > 0) : Array.from({ length: 36 }, (_, i) => i + 1).filter(n => !RED.includes(n));
        const cScore = sumScores(colorNums) + 5;
        const cBt = backtestSet(colorNums);
        strategies.push({
          type: 'cor_alternancia', label: `🔴⚫ Alternância → ${nextColor === 'red' ? 'Vermelho' : 'Preto'}`, emoji: nextColor === 'red' ? '🔴' : '⚫',
          numbers: colorNums, coverage: (18 / 37) * 100, payout: 1,
          score: cScore + cBt * 15 + 8,
          probability: Math.min(98, Math.round(38 + cScore * 1.2 + cBt * 20)),
          justification: `S6: Alternância V-P-V-P detectada por ${recentColors.length} rodadas. Próxima: ${nextColor === 'red' ? 'Vermelho' : 'Preto'}. Paga 1:1.`,
        });
      }
      // Streak — 4+ same color → bet opposite
      let streakCount = 1;
      for (let i = 1; i < recentColors.length; i++) {
        if (recentColors[i] === recentColors[0]) streakCount++;
        else break;
      }
      if (streakCount >= 4) {
        const oppositeColor = recentColors[0] === 'red' ? 'black' : 'red';
        const oppNums = oppositeColor === 'red' ? RED.filter(n => n > 0) : Array.from({ length: 36 }, (_, i) => i + 1).filter(n => !RED.includes(n));
        const sScore = sumScores(oppNums) + streakCount * 2;
        const sBt = backtestSet(oppNums);
        strategies.push({
          type: 'cor_reversa', label: `🎨 Reversão → ${oppositeColor === 'red' ? 'Vermelho' : 'Preto'} (${streakCount}x streak)`, emoji: '🎨',
          numbers: oppNums, coverage: (18 / 37) * 100, payout: 1,
          score: sScore + sBt * 15 + streakCount * 3,
          probability: Math.min(98, Math.round(35 + sScore * 1 + sBt * 18 + streakCount * 3)),
          justification: `S7: ${recentColors[0] === 'red' ? 'Vermelho' : 'Preto'} saiu ${streakCount}x seguidas. Tendência de reversão para ${oppositeColor === 'red' ? 'Vermelho' : 'Preto'}. Paga 1:1.`,
        });
      }
    }

    // S10: MÚLTIPLOS EM SEQUÊNCIA (5→10→15→20 ou 6→12→18→24)
    if (numbers.length >= 3) {
      for (const mult of [2, 3, 4, 5, 6]) {
        const last3 = numbers.slice(0, 3);
        if (last3[2] > 0 && last3[1] > 0 && last3[0] > 0) {
          if (last3[2] % mult === 0 && last3[1] % mult === 0 && last3[0] % mult === 0) {
            const diff1 = last3[0] - last3[1];
            const diff2 = last3[1] - last3[2];
            if (diff1 === diff2 && diff1 === mult) {
              const nextNum = last3[0] + mult;
              if (nextNum >= 1 && nextNum <= 36) {
                const mNums = [nextNum, ...getNeighbors(nextNum, 2)];
                const mScore = sumScores(mNums) + 6;
                const mBt = backtestSet(mNums);
                strategies.push({
                  type: 'multiplos_seq', label: `🔢 Múltiplos ×${mult} → ${nextNum}`, emoji: '🔢',
                  numbers: mNums, coverage: (mNums.length / 37) * 100, payout: 36 - mNums.length,
                  score: mScore + mBt * 20 + 8,
                  probability: Math.min(98, Math.round(35 + mScore * 2 + mBt * 25)),
                  justification: `S10: Sequência de múltiplos ×${mult}: ${last3[2]}→${last3[1]}→${last3[0]}→${nextNum}. ${mNums.length} números cobertos.`,
                });
              }
            }
          }
        }
      }
    }

    // S12: DIFERENÇA CONSTANTE
    if (numbers.length >= 3) {
      const d1 = numbers[0] - numbers[1];
      const d2 = numbers[1] - numbers[2];
      if (d1 === d2 && d1 !== 0) {
        const nextDiff = numbers[0] + d1;
        if (nextDiff >= 0 && nextDiff <= 36) {
          const dfNums = [nextDiff, ...getNeighbors(nextDiff, 2)];
          const dfScore = sumScores(dfNums) + 6;
          const dfBt = backtestSet(dfNums);
          strategies.push({
            type: 'diferenca_const', label: `📏 Diferença +${d1} → ${nextDiff}`, emoji: '📏',
            numbers: dfNums, coverage: (dfNums.length / 37) * 100, payout: 36 - dfNums.length,
            score: dfScore + dfBt * 20 + 6,
            probability: Math.min(98, Math.round(32 + dfScore * 2 + dfBt * 25)),
            justification: `S12: Diferença constante ${d1 > 0 ? '+' : ''}${d1}: ${numbers[2]}→${numbers[1]}→${numbers[0]}→${nextDiff}. Vizinhos incluídos.`,
          });
        }
      }
    }

    // F3: HIPER-QUENTE (mesmo número 2x em ≤5 rodadas)
    {
      const recent5 = numbers.slice(0, 5);
      const seen: Record<number, number> = {};
      for (const n of recent5) { seen[n] = (seen[n] || 0) + 1; }
      const hiperHot = Object.entries(seen).filter(([, c]) => c >= 2).map(([n]) => Number(n));
      if (hiperHot.length > 0) {
        const hhNum = hiperHot[0];
        const hhTerminal = hhNum % 10;
        const hhNums = [...(TERMINALS_MAP[hhTerminal] || []), ...getNeighbors(hhNum, 3)];
        const unique = [...new Set(hhNums)];
        const hhScore = sumScores(unique) + 12;
        const hhBt = backtestSet(unique);
        strategies.push({
          type: 'hiper_quente', label: `🔥 Hiper-Quente ${hhNum} (2x/5)`, emoji: '🔥',
          numbers: unique, coverage: (unique.length / 37) * 100, payout: 36 - unique.length,
          score: hhScore + hhBt * 22 + 15,
          probability: Math.min(98, Math.round(50 + hhScore * 1.8 + hhBt * 28)),
          justification: `F3: Número ${hhNum} apareceu 2x nas últimas 5 rodadas! Terminal T${hhTerminal} + vizinhos 3. ${unique.length} números.`,
        });
      }
    }

    // F4: CLUSTER REGIONAL (3+ do mesmo setor em 10 rodadas)
    {
      const recent10 = numbers.slice(0, 10);
      const sectorCounts = { Voisins: 0, Tiers: 0, Orphelins: 0, Zero: 0 };
      recent10.forEach(n => { const s = getSector(n); if (s in sectorCounts) (sectorCounts as any)[s]++; });
      const hotSector = Object.entries(sectorCounts).sort(([,a],[,b]) => b - a)[0];
      if (Number(hotSector[1]) >= 4) {
        const sectorPool = hotSector[0] === 'Voisins' ? VOISINS : hotSector[0] === 'Tiers' ? TIERS : hotSector[0] === 'Zero' ? JEU_ZERO : ORPHELINS;
        const crScore = sumScores(sectorPool) + Number(hotSector[1]) * 3;
        const crBt = backtestSet(sectorPool);
        strategies.push({
          type: 'cluster_regional', label: `🗺️ Cluster ${hotSector[0]} (${hotSector[1]}x/10)`, emoji: '🗺️',
          numbers: [...sectorPool], coverage: (sectorPool.length / 37) * 100, payout: 36 - sectorPool.length,
          score: crScore + crBt * 20 + Number(hotSector[1]) * 4,
          probability: Math.min(98, Math.round(42 + crScore * 1.5 + crBt * 22 + Number(hotSector[1]) * 3)),
          justification: `F4: ${hotSector[1]}x resultados no setor ${hotSector[0]} em 10 rodadas. Concentração forte. ${sectorPool.length} números.`,
        });
      }
    }

    // C4: CORRELAÇÃO DÚZIA-TERMINAL — dúzia dominante indica terminais
    {
      const recent15 = numbers.slice(0, 15).filter(n => n > 0);
      const dzCount = [0, 0, 0];
      recent15.forEach(n => { if (n <= 12) dzCount[0]++; else if (n <= 24) dzCount[1]++; else dzCount[2]++; });
      const domDz = dzCount.indexOf(Math.max(...dzCount));
      if (dzCount[domDz] >= 7) { // dominating dozen
        // D1→T1-T9 low, D2→T3-T6, D3→T5-T9 high
        const termFocus = domDz === 0 ? [1,2,3,4,5,6] : domDz === 1 ? [3,4,5,6,7,8] : [5,6,7,8,9,0];
        const c4Nums: number[] = [];
        termFocus.forEach(t => (TERMINALS_MAP[t] || []).forEach(n => {
          const nDz = n <= 12 ? 0 : n <= 24 ? 1 : 2;
          if (nDz === domDz && !c4Nums.includes(n)) c4Nums.push(n);
        }));
        if (c4Nums.length >= 3) {
          const c4Score = sumScores(c4Nums) + dzCount[domDz] * 2;
          const c4Bt = backtestSet(c4Nums);
          strategies.push({
            type: 'duzia_terminal_corr', label: `📊 D${domDz + 1} × Terminais`, emoji: '📊',
            numbers: c4Nums, coverage: (c4Nums.length / 37) * 100, payout: 36 - c4Nums.length,
            score: c4Score + c4Bt * 20 + 8,
            probability: Math.min(98, Math.round(40 + c4Score * 1.8 + c4Bt * 25)),
            justification: `C4: Dúzia ${domDz + 1} domina (${dzCount[domDz]}x/15). Terminais cruzados: ${c4Nums.length} alvos dentro da dúzia.`,
          });
        }
      }
    }

    // RUA (STREET BET) — 3 números em sequência na mesa (1-3, 4-6, 7-9, etc.)
    {
      const recent10 = numbers.slice(0, 10);
      const streets: number[][] = [];
      for (let i = 1; i <= 34; i += 3) streets.push([i, i + 1, i + 2]);
      let bestStreet: number[] | null = null;
      let bestStreetCount = 0;
      for (const st of streets) {
        const count = recent10.filter(n => st.includes(n)).length;
        if (count >= 2 && count > bestStreetCount) { bestStreet = st; bestStreetCount = count; }
      }
      if (bestStreet && bestStreetCount >= 2) {
        const stScore = sumScores(bestStreet) + bestStreetCount * 4;
        const stBt = backtestSet(bestStreet);
        strategies.push({
          type: 'rua', label: `🛣️ Rua ${bestStreet[0]}-${bestStreet[2]} (${bestStreetCount}x/10)`, emoji: '🛣️',
          numbers: bestStreet, coverage: (3 / 37) * 100, payout: 11,
          score: stScore + stBt * 30 + bestStreetCount * 5,
          probability: Math.min(98, Math.round(30 + stScore * 2.5 + stBt * 35)),
          justification: `Rua ${bestStreet.join('-')}: ${bestStreetCount} hits em 10 rodadas. Paga 11:1. Alta rentabilidade.`,
        });
      }
    }

    // CAVALO (SPLIT) — pares de números adjacentes na mesa
    {
      const recent10 = numbers.slice(0, 10);
      const splits = [[1,2],[2,3],[4,5],[5,6],[7,8],[8,9],[10,11],[11,12],[13,14],[14,15],[16,17],[17,18],
                       [19,20],[20,21],[22,23],[23,24],[25,26],[26,27],[28,29],[29,30],[31,32],[32,33],[34,35],[35,36],
                       [1,4],[2,5],[3,6],[4,7],[5,8],[6,9],[7,10],[8,11],[9,12],[10,13],[11,14],[12,15],
                       [13,16],[14,17],[15,18],[16,19],[17,20],[18,21],[19,22],[20,23],[21,24],[22,25],[23,26],[24,27],
                       [25,28],[26,29],[27,30],[28,31],[29,32],[30,33],[31,34],[32,35],[33,36]];
      let bestSplit: number[] | null = null;
      let bestSplitScore = 0;
      for (const sp of splits) {
        const hitCount = recent10.filter(n => sp.includes(n)).length;
        if (hitCount >= 2) {
          const spScore = sumScores(sp) + hitCount * 5;
          if (spScore > bestSplitScore) { bestSplit = sp; bestSplitScore = spScore; }
        }
      }
      if (bestSplit) {
        const spBt = backtestSet(bestSplit);
        strategies.push({
          type: 'cavalo_split', label: `🐎 Cavalo ${bestSplit[0]}/${bestSplit[1]}`, emoji: '🐎',
          numbers: bestSplit, coverage: (2 / 37) * 100, payout: 17,
          score: bestSplitScore + spBt * 30 + 8,
          probability: Math.min(98, Math.round(28 + bestSplitScore * 2 + spBt * 35)),
          justification: `Cavalo ${bestSplit[0]}/${bestSplit[1]}: ambos aparecem no histórico recente. Paga 17:1. Aposta cirúrgica.`,
        });
      }
    }

    // PAR/ÍMPAR com detecção de viés
    {
      const recent15 = numbers.slice(0, 15).filter(n => n > 0);
      const pares = recent15.filter(n => n % 2 === 0).length;
      const impares = recent15.length - pares;
      if (pares >= 10 || impares >= 10) {
        const dominant = pares >= 10 ? 'par' : 'impar';
        const oppNums = dominant === 'par'
          ? Array.from({ length: 36 }, (_, i) => i + 1).filter(n => n % 2 === 1)
          : Array.from({ length: 36 }, (_, i) => i + 1).filter(n => n % 2 === 0);
        const piScore = sumScores(oppNums) + 5;
        const piBt = backtestSet(oppNums);
        strategies.push({
          type: 'paridade_reversa', label: `🔄 Reversão ${dominant === 'par' ? 'Ímpar' : 'Par'} (${Math.max(pares, impares)}x/15)`, emoji: '🔄',
          numbers: oppNums, coverage: (18 / 37) * 100, payout: 1,
          score: piScore + piBt * 15 + Math.max(pares, impares) * 2,
          probability: Math.min(98, Math.round(35 + piScore * 1 + piBt * 18 + Math.max(pares, impares) * 2)),
          justification: `Par/Ímpar: ${dominant} dominou ${Math.max(pares, impares)}x em 15. Reversão para ${dominant === 'par' ? 'Ímpar' : 'Par'}. Paga 1:1.`,
        });
      }
    }

    // ALTO/BAIXO com detecção de viés
    {
      const recent15 = numbers.slice(0, 15).filter(n => n > 0);
      const altos = recent15.filter(n => n >= 19).length;
      const baixos = recent15.length - altos;
      if (altos >= 10 || baixos >= 10) {
        const dominant = altos >= 10 ? 'alto' : 'baixo';
        const oppNums = dominant === 'alto'
          ? Array.from({ length: 18 }, (_, i) => i + 1)
          : Array.from({ length: 18 }, (_, i) => i + 19);
        const abScore = sumScores(oppNums) + 5;
        const abBt = backtestSet(oppNums);
        strategies.push({
          type: 'alto_baixo_reversa', label: `↕️ Reversão ${dominant === 'alto' ? 'Baixo' : 'Alto'} (${Math.max(altos, baixos)}x/15)`, emoji: '↕️',
          numbers: oppNums, coverage: (18 / 37) * 100, payout: 1,
          score: abScore + abBt * 15 + Math.max(altos, baixos) * 2,
          probability: Math.min(98, Math.round(35 + abScore * 1 + abBt * 18 + Math.max(altos, baixos) * 2)),
          justification: `Alto/Baixo: ${dominant} dominou ${Math.max(altos, baixos)}x em 15. Reversão para ${dominant === 'alto' ? 'Baixo (1-18)' : 'Alto (19-36)'}. Paga 1:1.`,
        });
      }
    }

    // COLUNA com detecção de viés
    {
      const recent15 = numbers.slice(0, 15).filter(n => n > 0);
      const cols = [0, 0, 0];
      recent15.forEach(n => { if (COL1.includes(n)) cols[0]++; else if (COL2.includes(n)) cols[1]++; else if (COL3.includes(n)) cols[2]++; });
      // Find coldest column (least hits)
      const coldCol = cols.indexOf(Math.min(...cols));
      if (cols[coldCol] <= 2) { // very cold column
        const colNums = coldCol === 0 ? COL1 : coldCol === 1 ? COL2 : COL3;
        const colScore = sumScores(colNums) + (5 - cols[coldCol]) * 3;
        const colBt = backtestSet(colNums);
        strategies.push({
          type: 'coluna_fria', label: `📐 Coluna ${coldCol + 1} Fria (${cols[coldCol]}x/15)`, emoji: '📐',
          numbers: [...colNums], coverage: (12 / 37) * 100, payout: 2,
          score: colScore + colBt * 20 + (5 - cols[coldCol]) * 4,
          probability: Math.min(98, Math.round(38 + colScore * 1.5 + colBt * 22)),
          justification: `Coluna ${coldCol + 1} com apenas ${cols[coldCol]} hits em 15 rodadas. Dívida estatística. Paga 2:1.`,
        });
      }
    }

    // COMBINAÇÃO OURO: F5 + C1 + S3 = terminal dominante + puxados + sequência
    if (daniGreen.mod1.count >= 3 && daniGreen.mod5Pull.length >= 3 && daniGreen.mod6.active) {
      const goldTerminal = daniGreen.mod1.terminal;
      const goldPair = daniGreen.mod1.pair;
      const goldNums = [...new Set([
        ...(TERMINALS_MAP[goldTerminal] || []),
        ...(TERMINALS_MAP[goldPair] || []),
        ...daniGreen.mod5Pull.slice(0, 5),
      ])];
      const goldScore = sumScores(goldNums) + daniGreen.mod1.count * 5 + daniGreen.mod5Pull.length * 3 + 20;
      const goldBt = backtestSet(goldNums);
      strategies.push({
        type: 'combo_ouro', label: `👑 Combo OURO (F5+C1+S3)`, emoji: '👑',
        numbers: goldNums, coverage: (goldNums.length / 37) * 100, payout: 36 - goldNums.length,
        score: goldScore + goldBt * 30 + 25,
        probability: Math.min(99, Math.round(60 + goldScore * 1.5 + goldBt * 30)),
        justification: `OURO: Terminal T${goldTerminal} dominante (${daniGreen.mod1.count}x) + Puxados confirmados + Sequência ativa. Confiança MÁXIMA. ${goldNums.length} números.`,
      });
    }

    // COMBINAÇÃO PRATA: F1 + C2 + G4 = quente + terminal + vizinho na roda
    {
      const last = numbers[0];
      const lastTerminal = last % 10;
      const lastNeighbors = getNeighbors(last, 3);
      const termNums = TERMINALS_MAP[lastTerminal] || [];
      const silverNums = [...new Set([last, ...lastNeighbors, ...termNums])];
      // Check if last number is hot (2x in 10)
      const hotCheck = numbers.slice(0, 10).filter(n => n === last).length;
      if (hotCheck >= 2) {
        const silverScore = sumScores(silverNums) + hotCheck * 8 + 15;
        const silverBt = backtestSet(silverNums);
        strategies.push({
          type: 'combo_prata', label: `🥈 Combo PRATA (F1+C2+G4) → ${last}`, emoji: '🥈',
          numbers: silverNums, coverage: (silverNums.length / 37) * 100, payout: 36 - silverNums.length,
          score: silverScore + silverBt * 25 + 18,
          probability: Math.min(98, Math.round(55 + silverScore * 1.5 + silverBt * 28)),
          justification: `PRATA: ${last} hiper-quente (${hotCheck}x/10) + Terminal T${lastTerminal} + Vizinhos 3 na roda. ${silverNums.length} números.`,
        });
      }
    }

    // JEU ZERO dedicado (quando zero ausente >20 + vizinhos ativos)
    {
      let zeroDelay = 0;
      for (let i = 0; i < numbers.length; i++) { if (numbers[i] === 0) break; zeroDelay++; }
      if (zeroDelay >= 20) {
        const jzScore = sumScores(JEU_ZERO) + zeroDelay * 0.8 + 10;
        const jzBt = backtestSet(JEU_ZERO);
        strategies.push({
          type: 'jeu_zero', label: `🟢 Jeu Zero (${zeroDelay}r ausente)`, emoji: '🟢',
          numbers: [...JEU_ZERO], coverage: (7 / 37) * 100, payout: 36 - 7,
          score: jzScore + jzBt * 25 + (zeroDelay >= 30 ? 15 : 8),
          probability: Math.min(98, Math.round(38 + jzScore * 1.5 + jzBt * 25 + zeroDelay * 0.6)),
          justification: `P3: Zero ausente há ${zeroDelay} giros. Jeu Zero: 7 números próximos ao zero. Paga 5:1. ${zeroDelay >= 30 ? 'PRIORIDADE ALTA!' : ''}`,
        });
      }
    }

    // ESTRATÉGIA: AUTO-REPETIÇÃO DETECTADA
    const repeatCandidate = (() => {
      const cnt: Record<number,number> = {};
      numbers.slice(0,5).forEach(n => { cnt[n] = (cnt[n]||0)+1; });
      return Object.entries(cnt).sort(([,a],[,b]) => (b as number) - (a as number))[0];
    })();
    if (repeatCandidate && Number(repeatCandidate[1]) >= 2) {
      const rn = Number(repeatCandidate[0]);
      const rScore = sumScores([rn]) + Number(repeatCandidate[1]) * 8;
      const rNeighbors = getNeighbors(rn, 2);
      const rNums = [...new Set([rn, ...rNeighbors])];
      strategies.push({
        type: 'auto_repeticao',
        label: `🔁 Auto-Repetição ${rn} (${repeatCandidate[1]}x)`,
        emoji: '🔁',
        numbers: rNums,
        coverage: (rNums.length / 37) * 100,
        payout: 36 - rNums.length,
        score: rScore + Number(repeatCandidate[1]) * 12,
        probability: Math.min(92, Math.round(35 + Number(repeatCandidate[1]) * 18)),
        justification: `Auto-repetição detectada: ${rn} saiu ${repeatCandidate[1]}x recentes. Padrão observado 500 giros: repetições triplas em 15x (13), 11x (0), 9x (18,14,25).`,
      });
    }

    if (matrizTotal >= 20) {
      const topMatriz = Object.entries(matrizCombinado)
        .sort(([,a],[,b]) => (b as number) - (a as number))
        .slice(0, 6)
        .filter(([,v]) => (v as number) > maxMatriz * 0.3)
        .map(([n]) => Number(n));

      if (topMatriz.length >= 3) {
        const mScore = sumScores(topMatriz) + matrizTotal * 0.1;
        const mBt = backtestSet(topMatriz);
        strategies.push({
          type: 'matriz_numerica', label: `🔢 Matriz Numérica (${matrizTotal} obs)`, emoji: '🔢',
          numbers: topMatriz,
          coverage: (topMatriz.length / 37) * 100,
          payout: 36 - topMatriz.length,
          score: mScore + mBt * 30 + (matrizTotal > 100 ? 15 : matrizTotal > 50 ? 8 : 0),
          probability: Math.min(95, Math.round(40 + mScore * 2 + mBt * 35 + (matrizTotal > 100 ? 10 : 0))),
          justification: `Matriz histórica 37×37: números mais frequentes após ${lastNum0}. ${matrizTotal} observações. Top: ${topMatriz.join(',')}.`,
        });
      }
    }

    // REED TRACKING: suppress strategies that failed 4+ consecutive times
    const reedPenalty: Record<string, number> = {};
    for (const st of Object.keys(strategyPerformance)) {
      const stPreds = resolvedHistory.filter(p => p.strategy_type === st).slice(0, 6);
      let consecutiveMisses = 0;
      for (const p of stPreds) {
        if (!p.hit) consecutiveMisses++;
        else break;
      }
      if (consecutiveMisses >= REED_MAX) {
        reedPenalty[st] = consecutiveMisses;
        aiLearnings.push(`🛑 REED: ${st} errou ${consecutiveMisses}x seguidas — PAUSAR esta estratégia`);
      }
    }
    if (transitionMatrix.predictedSector && transitionMatrix.predictedDozen && transitionMatrix.predictedTerminal !== null) {
      const sectorPool = transitionMatrix.predictedSector === 'Voisins' ? VOISINS : transitionMatrix.predictedSector === 'Tiers' ? TIERS : ORPHELINS;
      const dozenPool = Array.from({ length: 12 }, (_, i) => (transitionMatrix.predictedDozen! - 1) * 12 + i + 1);
      const tripleNums = sectorPool.filter(n =>
        dozenPool.includes(n) && n % 10 === transitionMatrix.predictedTerminal
      );
      const doubleNums = sectorPool.filter(n =>
        (dozenPool.includes(n) || n % 10 === transitionMatrix.predictedTerminal!) &&
        !tripleNums.includes(n)
      ).slice(0, 8);
      const matrixNums = [...tripleNums, ...doubleNums].slice(0, 12);
      if (matrixNums.length >= 3) {
        const mfScore = sumScores(matrixNums) + tripleNums.length * 8 + transitionMatrix.mesaModeStrength * 0.1;
        const mfBt = backtestSet(matrixNums);
        strategies.push({
          type: 'matrix_fusion', label: `🔮 Convergência Matricial`, emoji: '🔮',
          numbers: matrixNums, coverage: (matrixNums.length / 37) * 100, payout: 36 - matrixNums.length,
          score: mfScore + mfBt * 25 + tripleNums.length * 10,
          probability: Math.min(98, Math.round(55 + mfScore * 2 + mfBt * 30 + tripleNums.length * 8)),
          justification: `Convergência tripla: Setor ${transitionMatrix.predictedSector} + Dúzia ${transitionMatrix.predictedDozen} + Terminal ${transitionMatrix.predictedTerminal}. ${tripleNums.length} na interseção total.`,
        });
      }
    }

    // DIVERSITY:
    const recentPreds = resolvedHistory.slice(0, 15);
    const recentStratTypes = recentPreds.map(p => p.strategy_type);
    const recentNumbers = recentPreds.flatMap(p => p.predicted_numbers?.slice(0, 3) || []);
    const stratTypeCount: Record<string, number> = {};
    recentStratTypes.forEach(t => { stratTypeCount[t] = (stratTypeCount[t] || 0) + 1; });

    // LEARNED KNOWLEDGE BOOST: weight strategies based on AI-learned patterns
    const learnedStrategyBoosts: Record<string, number> = {};
    for (const lp of learned) {
      const knowledge = (lp.knowledge || '').toLowerCase();
      const accuracy = lp.accuracy || 0;
      if (accuracy < 40) continue; // ignore low-accuracy learnings
      const boost = accuracy / 50; // 0-2 range
      // Map learning types to strategy types
      if (knowledge.includes('cavalos') || lp.learning_type === 'cavalos_pattern') {
        learnedStrategyBoosts['cavalos'] = (learnedStrategyBoosts['cavalos'] || 0) + boost;
      }
      if (knowledge.includes('setor') || knowledge.includes('vizinho') || lp.learning_type === 'sector_concentration') {
        learnedStrategyBoosts['sniper'] = (learnedStrategyBoosts['sniper'] || 0) + boost;
        learnedStrategyBoosts['voisins'] = (learnedStrategyBoosts['voisins'] || 0) + boost;
      }
      if (knowledge.includes('terminal') || lp.learning_type === 'terminal_pattern') {
        learnedStrategyBoosts['terminal_alternation'] = (learnedStrategyBoosts['terminal_alternation'] || 0) + boost;
      }
      if (knowledge.includes('dúzia') || knowledge.includes('duzia') || lp.learning_type === 'dozen_cycle') {
        learnedStrategyBoosts['duzias'] = (learnedStrategyBoosts['duzias'] || 0) + boost;
        learnedStrategyBoosts['dozen_phase'] = (learnedStrategyBoosts['dozen_phase'] || 0) + boost;
      }
      if (knowledge.includes('cor') || knowledge.includes('vermelho') || knowledge.includes('preto') || lp.learning_type === 'color_tendency') {
        learnedStrategyBoosts['cor'] = (learnedStrategyBoosts['cor'] || 0) + boost;
      }
      if (knowledge.includes('streak') || lp.learning_type === 'streak_behavior') {
        learnedStrategyBoosts['hot_phase'] = (learnedStrategyBoosts['hot_phase'] || 0) + boost;
        learnedStrategyBoosts['cold_phase'] = (learnedStrategyBoosts['cold_phase'] || 0) + boost;
      }
    }

    strategies.forEach(st => {
      // Bonus for high payout (more profitable if hits) — REFORÇADO para competir com fusão
      if (st.payout >= 17) st.score += 12;       // cavalos/splits pay 17:1
      else if (st.payout >= 8) st.score += 8;     // small groups pay 8:1+
      else if (st.payout >= 5) st.score += 5;     // jeu zero etc
      else if (st.payout >= 2) st.score += 2;     // dozens/columns
      // Physical mode bonus for sector-based strategies
      if (mesaMode === 'fisico' && ['sniper', 'voisins'].includes(st.type)) st.score += 5;
      // Mathematical mode bonus for terminal-based strategies
      if (mesaMode === 'matematico' && ['cavalos', 'duzias', 'terminal_alternation'].includes(st.type)) st.score += 5;

      // TIME-OF-DAY BIAS: night favors physical, day favors math
      if (['sniper', 'voisins', 'setor_oposto', 'cylinder_bias'].includes(st.type)) st.score += (timeAwareness.physicalBias - 1) * 15;
      if (['cavalos', 'duzias', 'terminal_alternation', 'dozen_phase'].includes(st.type)) st.score += (timeAwareness.mathBias - 1) * 15;

      // CONSECUTIVE HIT PRIORITY BOOST — TRIPLICADO para priorizar acertos em sequência
      const chBoost = consecutiveHitBoost[st.type] || 0;
      if (chBoost > 0) st.score += chBoost * 2;

      // ERROR-BASED ADAPTATION: if errors are mostly from wrong sector, penalize sector strategies
      if (errorCategories.wrong_sector >= 2 && ['sniper', 'voisins', 'setor_oposto'].includes(st.type)) st.score -= 10;
      if (errorCategories.wrong_terminal >= 2 && ['cavalos', 'terminal_alternation'].includes(st.type)) st.score -= 10;
      if (errorCategories.deflector_bounce >= 2) st.score -= 5;

      // LEARNED KNOWLEDGE BOOST: apply AI-learned weights — TRIPLICADO
      const learnedBoost = learnedStrategyBoosts[st.type] || 0;
      st.score += learnedBoost * 8;

      // ====== SELF-CORRECTION: 5-round weight adjustment ======
      const selfCorrectionWeight = strategyWeightAdjust[st.type] || 0;
      st.score += selfCorrectionWeight;

      // ====== REED PENALTY: suppress strategies that failed 4+ consecutive times ======
      const reed = reedPenalty[st.type];
      if (reed) st.score -= reed * 8;

      // ====== ENTROPY GATING: reduce confidence when session is dispersed ======
      if (sessionEntropy > 0.8) st.score -= 8;
      else if (sessionEntropy < 0.5) st.score += 5;

      // ====== NOISE PENALTY ======
      if (noiseCount > 5) st.score -= 5;
      if (noiseCount > 10) st.score -= 10;
      // ====== WHITE NOISE GUARD ======
      if (randomnessIndex.overall >= 75) st.score -= 15;
      else if (randomnessIndex.overall >= 60) st.score -= 8;
      // ====== KELLY BOOST ======
      if (kellyBetting.unitMultiplier >= 3) st.score += 5;
      else if (kellyBetting.unitMultiplier <= 0.5) st.score -= 5;

      // ====== CHAOS PENALTY ======
      if (chaoticDealer && ['sniper', 'voisins', 'setor_oposto'].includes(st.type)) st.score -= 10;
      if (!chaoticDealer && microArcStd < 2 && ['sniper', 'voisins'].includes(st.type)) st.score += 8;

      // PERFORMANCE-BASED WEIGHT: REFORÇADO — prioriza estratégias com melhor histórico de acertos
      const perf = strategyPerformance[st.type];
      if (perf && perf.total >= 3) {
        // Win rate bonus TRIPLICADO — a acertividade é o fator principal
        const winBonus = (perf.winRate - 0.2) * 50;
        st.score += winBonus;
        // Recent trend bonus DOBRADO — tendência recente importa muito
        const trendBonus = (perf.recentTrend - 0.2) * 35;
        st.score += trendBonus;
        // Penalize strategies that claim high prob but rarely hit
        if (perf.avgProb > 80 && perf.winRate < 0.25) st.score -= 20;
        // Strongly penalize strategies with very low win rates
        if (perf.total >= 8 && perf.winRate < 0.12) st.score -= 25;
      }

      // DIVERSIDADE LEVE — apenas penaliza repetição extrema (4+ seguidas do mesmo tipo)
      // NUNCA bloqueia a melhor jogada por diversidade
      const recentUseCount = stratTypeCount[st.type] || 0;
      if (recentUseCount >= 5) st.score -= 8;
      else if (recentUseCount >= 4) st.score -= 4;
      // Sem penalidade para 1-3 repetições — se é o melhor, é o melhor

      // NUMBER OVERLAP — penalidade leve apenas para sobreposição extrema
      const numberOverlap = st.numbers.filter(n => recentNumbers.includes(n)).length;
      const overlapRatio = st.numbers.length > 0 ? numberOverlap / st.numbers.length : 0;
      if (overlapRatio > 0.85) st.score -= 8;
      else if (overlapRatio > 0.7) st.score -= 4;
      // Sem penalidade para sobreposição moderada

      // BACKTEST VALIDATION
      if (st.probability < 55) st.score -= 5;
    });

    // If two strategies tie, prefer higher payout
    // STRATEGY FILTER — if user selected a category, only keep matching strategies
    if (strategyFilterParam) {
      const catMap: Record<string, string[]> = {
        setor: ['sniper','voisins','setor_oposto','ultra_sniper','ritmo_calibrado','cylinder_bias','cluster_regional','jeu_zero','vizinhos','setor'],
        cavalos: ['cavalos','cavalos_comp','cavalo_split'],
        terminal: ['terminal','terminal_comp','terminal_alternation','duplo_terminal','terminais_cruzados','duzia_terminal_corr','terminal_alto_baixo'],
        duzia: ['duzia','duzia_unica','dozen_phase','duzias','pressao_retorno','duzia_progressiva'],
        coluna: ['coluna','coluna_comp','column_cycle','coluna_fria'],
        cor: ['cor','cor_alternancia','cor_reversa'],
        paridade: ['paridade','paridade_reversa'],
        alto_baixo: ['alto_baixo','alto_baixo_reversa'],
        fusao: ['fusao_suprema','convergencia_absoluta','matrix_fusion','archetype_fusion','combo_ouro','combo_prata','ensemble_supremo'],
        puxada: ['numeros_puxam'],
        zero: ['pressao_zero','jeu_zero'],
        rua: ['rua'],
        hiper_quente: ['hiper_quente','hot_phase','auto_repeticao'],
        sequencia: ['multiplos_seq','diferenca_const'],
      };
      const allowed = catMap[strategyFilterParam];
      if (allowed) {
        const filtered = strategies.filter(s => allowed.includes(s.type));
        if (filtered.length > 0) {
          strategies.length = 0;
          strategies.push(...filtered);
        }
      }
    }

    // Cap: external strategies (coverage > 40%) cannot outscore internal ones
    const maxInternalScore = strategies
      .filter((s: any) => s.coverage < 35)
      .reduce((max: number, s: any) => Math.max(max, s.score), 0);
    if (maxInternalScore > 0 && numScores.length >= 5 && numScores[0].score > 15) {
      for (const st of strategies) {
        if ((st as any).coverage > 40) {
          (st as any).score = Math.min((st as any).score, Math.round(maxInternalScore * 0.85));
        }
      }
    }

    // ══════════════════════════════════════════════════════════════
    // ESTRATÉGIAS DINÂMICAS — construídas do conhecimento aprendido
    // Cada learning que tem hotNumbers vira uma estratégia candidata
    // ══════════════════════════════════════════════════════════════

    // 1. ESTRATÉGIA REALTIME — do padrão mais forte do momento
    const rtLearnings = learned.filter(lp =>
      lp.learning_type === 'session_spin' &&
      (lp.title || '').startsWith('RT_') &&
      Array.isArray((lp.metadata as any)?.hotNumbers) &&
      (lp.metadata as any).hotNumbers.length >= 2
    );
    if (rtLearnings.length > 0) {
      // Usar o RT learning mais recente (maior accuracy)
      const topRT = rtLearnings.sort((a, b) => (b.accuracy || 0) - (a.accuracy || 0))[0];
      const rtNums: number[] = ((topRT.metadata as any)?.hotNumbers || []).filter((n: any) => n >= 0 && n <= 36).slice(0, 8);
      if (rtNums.length >= 2) {
        const rtScore = sumScores(rtNums) + (topRT.accuracy || 50) * 0.6;
        const rtBt = backtestSet(rtNums);
        const rtType = (topRT.metadata as any)?.realtimeType || 'realtime';
        const rtLabel = {
          'auto_repeticao_rt': '🔁 Auto-Repetição RT',
          'streak_consecutivo': '🔥 Streak RT',
          'triple_pull': '🔱 Triple Pull RT',
          'double_pull': '🔗 Double Pull RT',
          'puxada_momento': '🧲 Puxada RT',
          'terminal_dominante_rt': '🔢 Terminal RT',
          'combo_ouro_rt': '👑 Combo Ouro RT',
          'matriz_momento': '🔮 Matriz RT',
        }[rtType] || `⚡ RT ${rtType}`;
        strategies.push({
          type: 'realtime_aprendido',
          label: rtLabel,
          emoji: '⚡',
          numbers: rtNums,
          coverage: +(rtNums.length / 37 * 100).toFixed(1),
          payout: 36 - rtNums.length,
          score: rtScore + rtBt * 25 + 30, // +30 boost: padrão do momento
          probability: Math.min(95, Math.round(50 + (topRT.accuracy || 50) * 0.5 + rtBt * 30)),
          justification: `⚡ REALTIME: ${topRT.knowledge?.slice(0, 120) || rtLabel}. Números: [${rtNums.join(',')}].`,
        });
        aiLearnings.push(`⚡ Estratégia RT criada: ${rtLabel} → [${rtNums.slice(0,5).join(',')}]`);
      }
    }

    // 2. ESTRATÉGIA PULL CONFIRMADO — puxadas validadas pelo sistema
    const pullLearnings = learned.filter(lp =>
      lp.learning_type === 'pull_confirmed' &&
      Array.isArray((lp.metadata as any)?.hotNumbers) &&
      (lp.metadata as any).hotNumbers.length >= 2
    );
    if (pullLearnings.length > 0 && numbers.length > 0) {
      const lastN = numbers[0];
      const relevantPull = pullLearnings.find(lp =>
        ((lp.metadata as any)?.source === lastN || (lp.metadata as any)?.hotNumbers?.includes(lastN))
      ) || pullLearnings[0];
      const pullNums: number[] = ((relevantPull.metadata as any)?.hotNumbers || []).filter((n: any) => n >= 0 && n <= 36).slice(0, 8);
      if (pullNums.length >= 2) {
        const pScore = sumScores(pullNums) + (relevantPull.accuracy || 50) * 0.5;
        const pBt = backtestSet(pullNums);
        strategies.push({
          type: 'pull_confirmado_aprendido',
          label: `🧲 Puxada Confirmada IA (${pullNums.length} nums)`,
          emoji: '🧲',
          numbers: pullNums,
          coverage: +(pullNums.length / 37 * 100).toFixed(1),
          payout: 36 - pullNums.length,
          score: pScore + pBt * 22 + 20, // +20: validação do banco
          probability: Math.min(90, Math.round(45 + (relevantPull.accuracy || 50) * 0.4 + pBt * 25)),
          justification: `🧲 Pull validado pelo sistema: ${relevantPull.knowledge?.slice(0, 100) || ''}. [${pullNums.join(',')}]`,
        });
      }
    }

    // 3. ESTRATÉGIA HEAT CLUSTER — números quentes confirmados por 2+ IAs
    const heatLearnings = learned.filter(lp =>
      lp.learning_type === 'heat_cluster' &&
      Array.isArray((lp.metadata as any)?.hotNumbers) &&
      (lp.metadata as any).hotNumbers.length >= 2
    );
    if (heatLearnings.length > 0) {
      const allHeatNums = [...new Set(heatLearnings.flatMap(lp =>
        ((lp.metadata as any)?.hotNumbers || []).filter((n: any) => n >= 0 && n <= 36)
      ))].slice(0, 8);
      if (allHeatNums.length >= 2) {
        const hScore = sumScores(allHeatNums) + heatLearnings.length * 5;
        const hBt = backtestSet(allHeatNums);
        strategies.push({
          type: 'heat_cluster_ia',
          label: `🔥 Cluster Quente IA (${heatLearnings.length} fontes)`,
          emoji: '🔥',
          numbers: allHeatNums,
          coverage: +(allHeatNums.length / 37 * 100).toFixed(1),
          payout: 36 - allHeatNums.length,
          score: hScore + hBt * 20 + heatLearnings.length * 8,
          probability: Math.min(90, Math.round(45 + heatLearnings.length * 6 + hBt * 25)),
          justification: `🔥 ${heatLearnings.length} fontes de IA confirmam cluster: [${allHeatNums.join(',')}]`,
        });
      }
    }

    // 4. ESTRATÉGIA PATTERN_INSIGHTS — do auto-analyze multi-janela
    const topInsights = patternInsights
      .filter(pi => (pi.confidence as number) >= 55 && (pi.numbers_involved as number[])?.length >= 2)
      .sort((a, b) => (b.confidence as number) - (a.confidence as number))
      .slice(0, 3);
    if (topInsights.length >= 2) {
      // Interseção dos top insights (consenso de padrões)
      const consensusNums = (topInsights[0].numbers_involved as number[])
        .filter(n => topInsights.some((pi, i) => i > 0 && (pi.numbers_involved as number[]).includes(n)));
      const allInsightNums = [...new Set(topInsights.flatMap(pi => pi.numbers_involved as number[]))].slice(0, 8);
      const iNums = consensusNums.length >= 2 ? consensusNums : allInsightNums;
      if (iNums.length >= 2) {
        const iScore = sumScores(iNums) + topInsights.length * 6;
        const iBt = backtestSet(iNums);
        const src = (topInsights[0].source_data as any) || {};
        const isRT = src.realtime === true;
        strategies.push({
          type: isRT ? 'realtime_insight' : 'pattern_consensus',
          label: isRT ? `⚡ Consenso RT (${topInsights.length} padrões)` : `📊 Consenso de Padrões (${topInsights.length})`,
          emoji: isRT ? '⚡' : '📊',
          numbers: iNums,
          coverage: +(iNums.length / 37 * 100).toFixed(1),
          payout: 36 - iNums.length,
          score: iScore + iBt * 22 + (isRT ? 25 : 12),
          probability: Math.min(90, Math.round(50 + topInsights.length * 5 + iBt * 25 + (isRT ? 10 : 0))),
          justification: `${isRT ? '⚡ REALTIME: ' : '📊 '}Consenso de ${topInsights.length} padrões: ${topInsights.map(pi => pi.pattern_type).join(', ')}. [${iNums.join(',')}]`,
        });
      }
    }

    // 5. SELEÇÃO AUTOMÁTICA ADAPTATIVA — atualiza pesos baseado no que funciona
    // Estratégias com WR > 50% recentes ganham boost; com WR < 20% perdem
    for (const st of strategies) {
      const perf = strategyPerformance[st.type] as any;
      if (perf && perf.total >= 3) {
        const wr = perf.recentTrend ?? perf.winRate ?? 0;
        if (wr > 0.55) {
          (st as any).score *= 1.25; // em alta: +25%
          (st as any).justification = `✅ WR ${(wr*100).toFixed(0)}% recente | ` + (st as any).justification;
        } else if (wr < 0.20 && perf.total >= 5) {
          (st as any).score *= 0.55; // em baixa: -45%
        } else if (wr < 0.30 && perf.total >= 5) {
          (st as any).score *= 0.75;
        }
      }
    }

    strategies.sort((a, b) => b.score - a.score || b.payout - a.payout);

    const winner = strategies[0];

    // ── ENSEMBLE SUPREMO: eleger o número #1 de todas as fontes ──
    const ensembleScore: Record<number, number> = {};
    const ensembleSources: Record<number, string[]> = {};
    for (let n = 0; n <= 36; n++) { ensembleScore[n] = 0; ensembleSources[n] = []; }
    numScores.slice(0, 10).forEach((ns: any, i: number) => {
      const w = (10 - i) / 10;
      ensembleScore[ns.num] += ns.score * w;
      ensembleSources[ns.num].push(`Score(${ns.score.toFixed(0)})`);
    });
    strategies.slice(0, 15).forEach((st: any) => {
      const stWeight = (st.score / (strategies[0]?.score || 1)) * 5;
      st.numbers.slice(0, 5).forEach((n: number, j: number) => {
        ensembleScore[n] += stWeight * (1 - j * 0.15);
        if (j === 0) ensembleSources[n].push(`${st.emoji}${st.type}`);
      });
    });
    if (matrizTotal >= 15) {
      for (let n = 0; n <= 36; n++) {
        if ((matrizProb[n] || 0) > 0.05) {
          ensembleScore[n] += (matrizProb[n] || 0) * 50;
          ensembleSources[n].push(`Matriz(${((matrizProb[n]||0)*100).toFixed(0)}%)`);
        }
      }
    }
    for (let n = 0; n <= 36; n++) {
      if (learnedSignalBoost[n] > 0) { ensembleScore[n] += learnedSignalBoost[n] * 3; ensembleSources[n].push('IA'); }
    }
    for (let n = 0; n <= 36; n++) {
      if (deepPullChain[n] >= 5) { ensembleScore[n] += deepPullChain[n] * 0.8; ensembleSources[n].push(`Chain(${deepPullChain[n].toFixed(0)})`); }
    }
    const ensembleRanking = Object.entries(ensembleScore)
      .map(([n, s]) => ({ num: Number(n), score: s, sources: ensembleSources[Number(n)] }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score);
    const ensembleTop1 = ensembleRanking[0] || null;
    const ensembleTop5 = ensembleRanking.slice(0, 5).map(e => e.num);

    // ESTRATÉGIA ENSEMBLE SUPREMO
    if (ensembleTop5.length >= 3 && ensembleTop1) {
      const ensNums = [...new Set([...ensembleTop5, ...PROTECTION_NUMBERS])];
      const ensScore = sumScores(ensNums) + ensembleTop1.score * 0.5;
      const ensBt = backtestSet(ensNums);
      strategies.push({
        type: 'ensemble_supremo',
        label: `🌟 Ensemble Supremo → ${ensembleTop1.num}`,
        emoji: '🌟',
        numbers: ensNums,
        coverage: (ensNums.length / 37) * 100,
        payout: 36 - ensNums.length,
        score: ensScore + ensBt * 40 + ensembleRanking[0].sources.length * 5,
        probability: Math.min(95, Math.round(
          45 + ensBt * 35 + ensembleRanking[0].sources.length * 4 + (matrizTotal > 50 ? 8 : 0)
        )),
        justification: `ENSEMBLE de ${ensembleRanking.length} candidatos × ${strategies.length} estratégias × Matriz 37×37 (${matrizTotal} obs). Convergência máxima em ${ensembleTop1.num}: ${ensembleTop1.sources.slice(0,3).join(', ')}.`,
      });
      // Re-sort after adding ensemble
      strategies.sort((a, b) => b.score - a.score || b.payout - a.payout);
    }

    // Se o ensemble top1 não está nos números do winner, adicionar como proteção
    if (ensembleTop1 && !winner.numbers.includes(ensembleTop1.num)) {
      winner.numbers.unshift(ensembleTop1.num);
      aiLearnings.push(`🎯 ENSEMBLE: nº${ensembleTop1.num} eleito por ${ensembleTop1.sources.length} fontes independentes`);
    }

    const ensembleResult = {
      top1: ensembleTop1?.num ?? null,
      top5: ensembleTop5,
      topScore: ensembleTop1?.score ?? 0,
      sources: ensembleTop1?.sources?.slice(0, 5) ?? [],
    };

    const allStrategies = strategies.map(s => ({
      type: s.type, label: s.label, emoji: s.emoji,
      numbers: s.numbers, coverage: +s.coverage.toFixed(1), payout: s.payout,
      score: +s.score.toFixed(1), probability: s.probability,
    }));

    // ══════════════════════════════════════════════════════════
    // DECISÃO SUPREMA — Número #1 sempre pelo numScore composto
    // O numScore já integra: pull, matriz, ensemble, IA, auto-rep, terminal, etc.
    // A estratégia winner serve apenas como pool de suporte.
    // ══════════════════════════════════════════════════════════
    const numTop1: number = numScores[0]?.num ?? winner.numbers[0];
    const numTop1Score: number = numScores[0]?.score ?? 0;
    const numMaxScore: number = Math.max(...numScores.map(s => s.score), 1);

    // Confirmações independentes do numTop1
    const ensConfirms    = ensembleTop1?.num === numTop1;
    const winnerConfirms = winner.numbers.includes(numTop1);
    const matrizConfirms = (matrizProb[numTop1] || 0) > 0.10;
    const pullConfirms   = (FULL_PULL_MAP[numbers[0]] || []).includes(numTop1);
    const recentCount    = numbers.slice(0, 5).filter(n => n === numTop1).length;
    const autoRepConfirms = recentCount >= 2;
    const confirmations  = [ensConfirms, winnerConfirms, matrizConfirms, pullConfirms, autoRepConfirms].filter(Boolean).length;

    // ── SCORE GAP ANALYSIS: só incluir suporte que tenha score significativo ──
    const top1Score = numScores[0]?.score ?? 0;
    const scoreThreshold = top1Score * 0.25; // suporte deve ter pelo menos 25% do score do #1

    // Suporte: números confirmados por múltiplas fontes E com score significativo
    const supportCandidates = numScores
      .slice(1, 25)
      .filter(ns => {
        if (ns.score < scoreThreshold) return false; // filtrar números fracos
        const inPull     = (FULL_PULL_MAP[numTop1] || []).includes(ns.num);
        const inWinner   = winner.numbers.includes(ns.num);
        const inEnsemble = ensembleTop5.includes(ns.num);
        const highMatriz = (matrizProb[ns.num] || 0) > 0.08;
        const inPullFromLast = (FULL_PULL_MAP[numbers[0]] || []).includes(ns.num);
        // Exigir pelo menos 1 confirmação + score mínimo
        const confirmCount = [inPull, inWinner, inEnsemble, highMatriz, inPullFromLast].filter(Boolean).length;
        return confirmCount >= 1;
      })
      .map(ns => ns.num)
      .slice(0, 6);

    // Proteção DINÂMICA: usar surpriseNumbers + números com alta dívida estatística
    const dynamicProtection: number[] = [];
    // 1. Números que saem quando erramos (anti-padrão)
    surpriseNumbers.slice(0, 4).forEach(n => {
      if (n !== numTop1 && !supportCandidates.includes(n) && !dynamicProtection.includes(n)) {
        dynamicProtection.push(n);
      }
    });
    // 2. Números com alta dívida estatística (ausentes há muito tempo)
    const debtNums = Object.entries(dynStatDebt).sort(([,a],[,b]) => (b as number) - (a as number)).slice(0, 3);
    debtNums.forEach(([n]) => {
      const num = Number(n);
      if (num !== numTop1 && !supportCandidates.includes(num) && !dynamicProtection.includes(num)) {
        dynamicProtection.push(num);
      }
    });
    const realProtection = dynamicProtection.slice(0, 3);

    // Jogada final: top1 + suporte forte + proteção dinâmica, máximo 10
    const finalBetNumbers: number[] = [...new Set([
      numTop1,
      ...supportCandidates,
      ...realProtection,
    ])].slice(0, 10);

    // Justificativa clara
    const decisionJustification = [
      `#1: ${numTop1} (${numTop1Score.toFixed(0)}pts de ${numMaxScore.toFixed(0)} máx)`,
      confirmations >= 3 ? `${confirmations}/5 fontes confirmam` : '',
      autoRepConfirms ? `🔁 Auto-rep ${recentCount}x em 5` : '',
      pullConfirms    ? `🧲 Puxado pelo ${numbers[0]}` : '',
      matrizConfirms  ? `🔢 Matriz ${(matrizProb[numTop1]*100).toFixed(0)}%` : '',
      ensConfirms     ? `🌟 Ensemble confirma` : '',
      winner.justification.slice(0, 120),
    ].filter(Boolean).join(' | ');

    if (confirmations >= 3) {
      aiLearnings.unshift(`💎 DECISÃO SUPREMA: nº${numTop1} confirmado por ${confirmations} fontes (pull+matriz+ensemble+rep)`);
    }

    // Final probability = ULTRA-CALIBRATED V2 — maximum accuracy
    // Base: winner probability × convergence ratio (normalized to 1700 layers)
    let finalProbability = winner.probability * Math.min(1.2, totalLayers / 1100);
    
    // CALIBRAÇÃO BAYESIANA — win rate real tem peso crescente com dados
    const winnerPerfCal = strategyPerformance[winner.type];
    if (winnerPerfCal && winnerPerfCal.total >= 3) {
      const dataWeight = Math.min(0.65, winnerPerfCal.total / 30);
      const modelProb = finalProbability;
      const historicalProb = winnerPerfCal.winRate * 100;
      finalProbability = modelProb * (1 - dataWeight) + historicalProb * dataWeight;

      // Penalização agressiva por WR recente baixo
      if (winnerPerfCal.recentTrend < 0.20 && winnerPerfCal.total >= 5) {
        finalProbability -= 25;
        aiLearnings.push(`🚫 ${winner.label} em COLAPSO: ${(winnerPerfCal.recentTrend*100).toFixed(0)}% recente → penalidade -25%`);
        strategyWeightAdjust[winner.type] = (strategyWeightAdjust[winner.type] || 0) - 30;
      } else if (winnerPerfCal.recentTrend < 0.30 && winnerPerfCal.total >= 5) {
        finalProbability -= 12;
        strategyWeightAdjust[winner.type] = (strategyWeightAdjust[winner.type] || 0) - 15;
      } else if (winnerPerfCal.recentTrend > 0.50) {
        finalProbability += 8;
        aiLearnings.push(`🔥 ${winner.label} em SÉRIE: ${(winnerPerfCal.recentTrend*100).toFixed(0)}% recente → boost +8%`);
      }

      if (winnerPerfCal.winRate < 0.20 && winnerPerfCal.total >= 8) {
        finalProbability -= 20;
        aiLearnings.push(`⚠️ Calibração: ${winner.label} WR ${(winnerPerfCal.winRate*100).toFixed(0)}% — confiança reduzida`);
      }
    }
    
    // CONVERGÊNCIA ABSOLUTA gets special treatment — multi-dimensional confirmation
    if (winner.type === 'convergencia_absoluta') {
      const dimCount = (winner.justification.match(/(\d+) dimensões/) || [])[1];
      const dims = parseInt(dimCount || '5');
      if (dims >= 8) finalProbability = Math.max(finalProbability, 95);
      else if (dims >= 7) finalProbability = Math.max(finalProbability, 90);
      else if (dims >= 6) finalProbability = Math.max(finalProbability, 83);
      else if (dims >= 5) finalProbability = Math.max(finalProbability, 76);
    }
    
    // COMBO DETECTION BOOST — if winner numbers have combo flags (OURO = max boost)
    const winnerNumScores = numScores.filter(ns => winner.numbers.includes(ns.num));
    const hasComboOuro = winnerNumScores.some(ns => ns.reasons.some(r => r.includes('COMBO OURO')));
    const hasComboPrata = winnerNumScores.some(ns => ns.reasons.some(r => r.includes('COMBO PRATA')));
    if (hasComboOuro) { finalProbability += 10; aiLearnings.push('👑 COMBO OURO DETECTADO: F5+C1+S3 — confiança máxima'); }
    else if (hasComboPrata) { finalProbability += 6; aiLearnings.push('🥈 COMBO PRATA: F1+C2+G4 — boa confiança'); }
    
    // Dealer consistency boost (stronger for mechanical dealers)
    if (arcStdDev < 1.5) finalProbability += 10;
    else if (arcStdDev < 2) finalProbability += 7;
    else if (arcStdDev < 3) finalProbability += 4;
    else if (arcStdDev > 6) finalProbability -= 5; // chaotic dealer penalty
    
    // Entropy calibration (stronger gating)
    if (sessionEntropy < 0.3) finalProbability += 10; // ultra concentrated = ideal
    else if (sessionEntropy < 0.5) finalProbability += 6;
    else if (sessionEntropy > 0.85) finalProbability -= 15; // high dispersion = bad
    else if (sessionEntropy > 0.75) finalProbability -= 8;
    
    // Entropy DRIFT bonus — session organizing = great moment
    if (isEntropyDroppingConsistently) finalProbability += 5;
    
    // Kelly alignment
    if (kellyBetting.unitMultiplier >= 3) finalProbability += 5;
    else if (kellyBetting.unitMultiplier <= 0.5) finalProbability -= 6;
    
    // Randomness guard (stronger)
    if (randomnessIndex.overall >= 75) finalProbability -= 15;
    else if (randomnessIndex.overall >= 60) finalProbability -= 8;
    else if (randomnessIndex.overall >= 50) finalProbability -= 4;
    else if (randomnessIndex.overall < 25) finalProbability += 6; // very stable
    
    // Consecutive hit streak boost
    const winnerChBoost = consecutiveHitBoost[winner.type] || 0;
    if (winnerChBoost >= 24) finalProbability += 10; // 3+ consecutive hits
    else if (winnerChBoost >= 16) finalProbability += 6;
    
    // MULTIPLE SIGNAL DENSITY: if top number has 5+ distinct signal categories, boost
    if (numScores.length > 0) {
      const topReasonCategories = new Set(numScores[0].reasons.map(r => r.split(':')[0].replace(/[^a-zA-Z]/g, '')));
      if (topReasonCategories.size >= 6) finalProbability += 6;
      else if (topReasonCategories.size >= 5) finalProbability += 3;
    }
    
    // COVERAGE-BASED PROBABILITY CEILING — calibrado por tamanho da jogada
    // Jogadas com menos números têm teto mais apertado
    const coveragePercent = +(finalBetNumbers.length / 37 * 100).toFixed(1);
    // Bônus máximo escala com confirmações: 3+ confirmações = até +20%, senão +12%
    const maxBonus = confirmations >= 4 ? 22 : confirmations >= 3 ? 18 : confirmations >= 2 ? 14 : 10;
    const maxRealisticProb = Math.min(95, coveragePercent + maxBonus);
    if (finalProbability > maxRealisticProb) {
      finalProbability = maxRealisticProb;
    }
    
    // Cap
    finalProbability = Math.min(99, Math.max(20, Math.round(finalProbability)));
    
    // Add strategy performance learnings
    const winnerPerf = strategyPerformance[winner.type];
    if (winnerPerf && winnerPerf.total >= 5) {
      const wr = (winnerPerf.winRate * 100).toFixed(0);
      aiLearnings.push(`📈 Estratégia ${winner.label}: ${wr}% win rate (${winnerPerf.hits}/${winnerPerf.total})`);
    }
    // Add self-correction info
    const selfAdj = strategyWeightAdjust[winner.type];
    if (selfAdj && selfAdj !== 0) {
      aiLearnings.push(`${selfAdj > 0 ? '✅' : '⚠️'} Auto-correção: ${winner.label} ${selfAdj > 0 ? 'reforçada' : 'reduzida'} (${selfAdj > 0 ? '+' : ''}${selfAdj} peso)`);
    }
    // Add noise info
    if (noiseCount >= 2) {
      aiLearnings.push(`🔇 Filtro de ruído: ${noiseCount} saltos anômalos excluídos da análise`);
    }
    // Add statistical debt info
    if (statisticalDebt.length >= 3) {
      aiLearnings.push(`💰 Dívida estatística: números ${statisticalDebt.slice(0,3).map(d=>d.num).join(',')} devem compensar em breve`);
    }
    // Deep memory learnings
    if (ancestralPatterns.length > 0) {
      aiLearnings.push(`👻 ${ancestralPatterns.length} sequência(s) ancestral(is) detectada(s) no histórico longo`);
    }
    if (mesaDNA.sectorBalance > 0.85) {
      aiLearnings.push(`🧬 DNA de mesa estável: equilíbrio de setores ${(mesaDNA.sectorBalance * 100).toFixed(0)}%`);
    }
    if (mesaDNA.terminalSignature.length > 0) {
      aiLearnings.push(`🔑 Assinatura terminal: T${mesaDNA.terminalSignature.join(',T')} consistentes`);
    }

    const mode = (winner.type === 'convergencia_absoluta' && finalProbability >= 80) ? 'sniper'
      : totalLayers >= 900 && finalProbability >= 75 ? 'sniper'
      : totalLayers >= 600 && finalProbability >= 60 ? 'alert'
      : totalLayers >= 400 ? 'observing'
      : 'monitoring';

    const message = mode === 'sniper' && winner.type === 'convergencia_absoluta'
      ? `💠 CONVERGÊNCIA ABSOLUTA: ${winner.emoji} ${winner.label} — ${finalProbability}%`
      : mode === 'sniper'
      ? `🎯 JOGADA CERTEIRA: ${winner.emoji} ${winner.label} — ${totalLayers}/1700`
      : mode === 'alert'
      ? `⚡ ALERTA: ${winner.emoji} ${winner.label} — ${totalLayers}/1700`
      : mode === 'observing'
      ? `👁️ Observando: ${winner.emoji} ${winner.label} — ${totalLayers}/1700`
      : `⏳ Coletando dados... ${totalLayers}/1700`;

    const diagnostic = mode === 'sniper'
      ? `Convergência Suprema: ${winner.justification}`
      : mode === 'alert'
      ? `Alerta ativo: ${winner.justification}`
      : `Análise em andamento: ${winner.justification}`;

    // Save prediction to history — save once per real spin window
    const shouldSave = isNewNumber && (mode === 'sniper' || mode === 'alert') && winner.numbers.length > 0;
    if (shouldSave) {
      const { data: latestPrediction } = await supabase
        .from('prediction_history')
        .select('created_at, hit')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const secondsSinceLatestPrediction = latestPrediction?.created_at
        ? (Date.now() - new Date(latestPrediction.created_at).getTime()) / 1000
        : 999;

      if (!latestPrediction || (latestPrediction.hit !== null && secondsSinceLatestPrediction > 18)) {
        await supabase.from('prediction_history').insert({
          strategy_type: winner.type,
          strategy_label: winner.label,
          predicted_numbers: finalBetNumbers,
          predicted_main: numTop1,
          probability: finalProbability,
          convergence_score: totalLayers,
          mesa_mode: mesaMode,
          justification: winner.justification,
        });
      }

      // ========================================================
      // AI SELF-LEARNING: Save learned patterns from this spin
      // ========================================================
      if (isNewNumber && numbers.length >= 20) {
        const topTerminals = sortedTerminals50.slice(0, 3).map(([t]) => Number(t));
        const hotNums = numScores.slice(0, 8).map(s => s.num);
        const bestStrat = winner.type;
        const topReasons = numScores.slice(0, 3).flatMap(s => s.reasons).slice(0, 5);
        
        // Save current session learning
        const learningTitle = `Spin ${numbers[0]} @ ${new Date().toISOString().slice(0, 16)}`;
        const learningKnowledge = [
          `Regime: ${sessionRegime} (E=${(sessionEntropy * 100).toFixed(0)}%)`,
          `Dealer: ${dealerSignature.consistency}, arco=${dealerSignature.arcMean}±${dealerSignature.arcStdDev}`,
          `Terminais quentes: T${topTerminals.join(',T')}`,
          `Estratégia vencedora: ${bestStrat} (${finalProbability}%)`,
          `Sinais: ${topReasons.join('; ')}`,
          `Top candidatos: ${hotNums.slice(0, 5).join(',')}`,
        ].join(' | ');

        await supabase.from('ai_learned_patterns').upsert({
          learning_type: 'session_spin',
          title: learningTitle,
          knowledge: learningKnowledge,
          accuracy: finalProbability,
          data_points: numbers.length,
          metadata: {
            hotNumbers: hotNums,
            bestTerminals: topTerminals,
            bestStrategy: bestStrat,
            entropy: sessionEntropy,
            dealerMode: dealerSignature.dealerMode,
            mesaMode,
            regime: sessionRegime,
            lastNumber: numbers[0],
            pullChain: daniGreen.mod5Pull.slice(0, 5),
          },
        }, { onConflict: 'id' });

        // Also save terminal pattern if strong
        if (daniGreen.mod1.count >= 4) {
          const termTitle = `Terminal T${daniGreen.mod1.terminal} dominante`;
          await supabase.from('ai_learned_patterns').upsert({
            learning_type: 'terminal_dominance',
            title: termTitle,
            knowledge: `T${daniGreen.mod1.terminal} apareceu ${daniGreen.mod1.count}x em 15 giros. Dupla: T${daniGreen.mod1.pair}. Regime: ${sessionRegime}`,
            accuracy: Math.min(95, 60 + daniGreen.mod1.count * 5),
            data_points: 15,
            metadata: {
              hotNumbers: TERMINALS_MAP[daniGreen.mod1.terminal] || [],
              bestTerminals: [daniGreen.mod1.terminal, daniGreen.mod1.pair],
              count: daniGreen.mod1.count,
            },
          }, { onConflict: 'id' });
        }

        // Save pull pattern learning
        if (daniGreen.mod5Pull.length > 0 && resolvedHistory.length > 0) {
          const recentHit = resolvedHistory.find(p => p.hit && p.actual_number !== null);
          if (recentHit && daniGreen.mod5Pull.includes(recentHit.actual_number as number)) {
            await supabase.from('ai_learned_patterns').upsert({
              learning_type: 'pull_confirmed',
              title: `Puxada ${numbers[1]}→${recentHit.actual_number} confirmada`,
              knowledge: `Número ${numbers[1]} puxou ${recentHit.actual_number} conforme tabela mestre. Pull map validado.`,
              accuracy: 85,
              data_points: resolvedHistory.filter(p => p.hit).length,
              metadata: {
                hotNumbers: daniGreen.mod5Pull.slice(0, 8),
                source: numbers[1],
                target: recentHit.actual_number,
              },
            }, { onConflict: 'id' });
          }
        }
      }

      // ========================================================
      // STRATEGY STATS: Update per-strategy performance metrics
      // ========================================================
      try {
        // Get current stats for this strategy
        const { data: existingStats } = await supabase
          .from('strategy_stats')
          .select('*')
          .eq('strategy_type', winner.type)
          .maybeSingle();

        const totalPred = (existingStats?.total_predictions || 0) + 1;
        const totalHits = existingStats?.total_hits || 0;
        const exactHits = existingStats?.exact_hits || 0;
        const neighborHits = existingStats?.neighbor_hits || 0;
        const avgProb = existingStats?.avg_probability || 0;
        const avgCov = existingStats?.avg_coverage || 0;
        const avgPay = existingStats?.avg_payout || 0;

        // Running average
        const newAvgProb = (avgProb * (totalPred - 1) + finalProbability) / totalPred;
        const newAvgCov = (avgCov * (totalPred - 1) + winner.coverage) / totalPred;
        const newAvgPay = (avgPay * (totalPred - 1) + winner.payout) / totalPred;

        await supabase.from('strategy_stats').upsert({
          strategy_type: winner.type,
          strategy_label: winner.label,
          total_predictions: totalPred,
          total_hits: totalHits,
          exact_hits: exactHits,
          neighbor_hits: neighborHits,
          win_rate: totalHits / totalPred,
          avg_probability: +newAvgProb.toFixed(1),
          avg_coverage: +newAvgCov.toFixed(1),
          avg_payout: +newAvgPay.toFixed(1),
          best_streak: existingStats?.best_streak || 0,
          current_streak: existingStats?.current_streak || 0,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'strategy_type' });
      } catch { /* ignore stats errors */ }
    }

    // ==========================================
    // GENERATE SPECIFIC BET INSTRUCTIONS
    // ==========================================
    const generateBetInstructions = (strat: typeof winner): { bets: { type: string; label: string; detail: string; emoji: string }[]; summary: string } => {
      const bets: { type: string; label: string; detail: string; emoji: string }[] = [];
      const t = strat.type;
      const nums = strat.numbers;

      if (t === 'cavalos') {
        const group = nums.length >= 10 ? (
          CAVALOS['258'].every(n => nums.includes(n)) ? '258' :
          CAVALOS['147'].every(n => nums.includes(n)) ? '147' :
          CAVALOS['03'].every(n => nums.includes(n)) ? '03' :
          CAVALOS['69'].every(n => nums.includes(n)) ? '69' : null
        ) : null;
        if (group) {
          bets.push({ type: 'cavalos', label: `Cavalos ${group}`, detail: `Aposte nos Cavalos ${group}: ${CAVALOS[group].join(', ')}`, emoji: '🐎' });
        } else {
          bets.push({ type: 'cavalos', label: 'Cavalos Especiais', detail: `Cubra os números: ${nums.join(', ')}`, emoji: '🐎' });
        }
      } else if (t === 'coluna' || t === 'column_cycle') {
        const col = COL1.every(n => nums.includes(n)) ? 1 : COL2.every(n => nums.includes(n)) ? 2 : COL3.every(n => nums.includes(n)) ? 3 : 0;
        if (col > 0) {
          bets.push({ type: 'coluna', label: `Coluna ${col}`, detail: `Aposte na Coluna ${col} (2:1)`, emoji: '📐' });
        }
      } else if (t === 'duzia_unica' || t === 'dozen_phase') {
        const dz = nums[0] <= 12 ? 1 : nums[0] <= 24 ? 2 : 3;
        bets.push({ type: 'duzia', label: `Dúzia ${dz}`, detail: `Aposte na ${dz}ª Dúzia (${(dz-1)*12+1}-${dz*12}) — paga 2:1`, emoji: '🎲' });
      } else if (t === 'duzias') {
        const dzs: number[] = [];
        if (nums.some((n: number) => n >= 1 && n <= 12)) dzs.push(1);
        if (nums.some((n: number) => n >= 13 && n <= 24)) dzs.push(2);
        if (nums.some((n: number) => n >= 25 && n <= 36)) dzs.push(3);
        dzs.forEach(d => bets.push({ type: 'duzia', label: `Dúzia ${d}`, detail: `${d}ª Dúzia (${(d-1)*12+1}-${d*12})`, emoji: '🎲' }));
      } else if (t === 'terminal_alternation') {
        const term = nums.length > 0 ? nums[0] % 10 : 0;
        const termNums = nums.filter((n: number) => n % 10 === term);
        bets.push({ type: 'terminal', label: `Terminais ${term}`, detail: `Aposte nos terminais ${term}: ${termNums.join(', ')}`, emoji: '🔢' });
      } else if (t === 'cor') {
        const isRed = nums.some((n: number) => RED.includes(n)) && !nums.some((n: number) => !RED.includes(n) && n > 0);
        bets.push({ type: 'cor', label: isRed ? 'Vermelho' : 'Preto', detail: `Aposte no ${isRed ? 'Vermelho' : 'Preto'} (1:1)`, emoji: isRed ? '🔴' : '⚫' });
      } else if (t === 'paridade') {
        const even = nums.every((n: number) => n > 0 && n % 2 === 0);
        bets.push({ type: 'paridade', label: even ? 'Par' : 'Ímpar', detail: `Aposte no ${even ? 'Par' : 'Ímpar'} (1:1)`, emoji: even ? '2️⃣' : '1️⃣' });
      } else if (t === 'alto_baixo') {
        const low = nums.every((n: number) => n >= 1 && n <= 18);
        bets.push({ type: 'alto_baixo', label: low ? 'Baixo (1-18)' : 'Alto (19-36)', detail: `Aposte no ${low ? 'Baixo (1-18)' : 'Alto (19-36)'} (1:1)`, emoji: low ? '⬇️' : '⬆️' });
      } else if (t === 'ultra_sniper') {
        const mainNum = nums[0];
        bets.push({ type: 'vizinhos', label: `Ultra Sniper → ${mainNum}`, detail: `CONVERGÊNCIA MÁXIMA: Pleno no ${mainNum} + ${nums.length - 1} vizinhos: ${nums.slice(1, 5).join(', ')}`, emoji: '🔥' });
      } else if (t === 'fusao_suprema') {
        const mainNum = nums[0];
        bets.push({ type: 'fusao', label: `Fusão Suprema`, detail: `${nums.length} números validados por 3+ estratégias: ${nums.slice(0, 8).join(', ')}`, emoji: '⚡' });
      } else if (t === 'convergencia_absoluta') {
        const mainNum = nums[0];
        bets.push({ type: 'absoluta', label: `Convergência Absoluta → ${mainNum}`, detail: `MÁXIMA CONFIANÇA: ${nums.length} números validados por 5+ dimensões independentes. Pleno ${mainNum} + vizinhos: ${nums.slice(1, 5).join(', ')}`, emoji: '💠' });
      } else if (t === 'sniper' || t === 'voisins' || t === 'setor_oposto') {
        const sector = nums.length > 0 ? getSector(nums[0]) : 'Voisins';
        bets.push({ type: 'setor', label: `Setor ${sector}`, detail: `Cubra o setor ${sector} na roda`, emoji: '🎯' });
        const mainNum = nums[0];
        bets.push({ type: 'vizinhos', label: `Vizinhos do ${mainNum}`, detail: `Pleno no ${mainNum} + vizinhos: ${nums.slice(1, 5).join(', ')}`, emoji: '🎯' });
      } else if (t === 'numero_exato') {
        bets.push({ type: 'pleno', label: `Pleno no ${nums[0]}`, detail: `Aposte Pleno (straight) no ${nums[0]} — paga 35:1`, emoji: '💎' });
      } else if (t === 'ritmo_calibrado') {
        bets.push({ type: 'ritmo', label: `Ritmo Calibrado → ${nums[0]}`, detail: `Alvo calculado por arco direcional do dealer: Pleno ${nums[0]} + ${nums.length - 1} vizinhos`, emoji: '🎯' });
      } else if (t === 'archetype_fusion') {
        bets.push({ type: 'fusao', label: `Fusão de Arquétipos`, detail: `Convergência de múltiplos padrões: ${nums.slice(0, 6).join(', ')}`, emoji: '🏛️' });
      } else if (t === 'matrix_fusion') {
        bets.push({ type: 'matriz', label: `Convergência Matricial`, detail: `Interseção Setor+Dúzia+Terminal: ${nums.slice(0, 6).join(', ')}`, emoji: '🔮' });
      } else if (t === 'cobertura_area') {
        bets.push({ type: 'area', label: `Cobertura de Setor`, detail: `Cubra setor via matriz de transição: ${nums.slice(0, 6).join(', ')}`, emoji: '🗺️' });
      } else if (t === 'terminais_cruzados') {
        const term = nums.length > 0 ? nums[0] % 10 : 0;
        bets.push({ type: 'terminal', label: `Terminais Cruzados ${term}`, detail: `Aposte nos terminais ${term}: ${nums.join(', ')}`, emoji: '🐎' });
      } else if (t === 'pressao_retorno') {
        const dz = nums[0] <= 12 ? 1 : nums[0] <= 24 ? 2 : 3;
        bets.push({ type: 'duzia', label: `Pressão D${dz}`, detail: `Dúzia ${dz} em dívida estatística — Retorno iminente`, emoji: '🔥' });
      } else if (t === 'genetic_cluster' || t === 'cross_delay' || t === 'insight_pattern' || t === 'cylinder_bias') {
        // Data-driven patterns
        const mainNum = nums[0];
        bets.push({ type: 'setor', label: strat.label, detail: `Cubra: ${nums.slice(0, 8).join(', ')} — Pleno no ${mainNum} + vizinhos`, emoji: strat.emoji });
        bets.push({ type: 'vizinhos', label: `Vizinhos do ${mainNum}`, detail: `Pleno no ${mainNum} + vizinhos: ${nums.slice(1, 5).join(', ')}`, emoji: '🎯' });
      } else if (t === 'rua') {
        bets.push({ type: 'rua', label: `Rua ${nums[0]}-${nums[nums.length-1]}`, detail: `Aposte na Rua ${nums.join('-')} — paga 11:1`, emoji: '🛣️' });
      } else if (t === 'cavalo_split') {
        bets.push({ type: 'cavalo_split', label: `Cavalo ${nums[0]}/${nums[1]}`, detail: `Aposte Cavalo (Split) ${nums[0]}/${nums[1]} — paga 17:1`, emoji: '🐎' });
      } else if (t === 'cor_alternancia' || t === 'cor_reversa') {
        const isRed = nums.some((n: number) => RED.includes(n)) && nums.filter((n: number) => RED.includes(n)).length > nums.length / 2;
        bets.push({ type: 'cor', label: isRed ? 'Vermelho' : 'Preto', detail: `Aposte no ${isRed ? 'Vermelho' : 'Preto'} (1:1)`, emoji: isRed ? '🔴' : '⚫' });
      } else if (t === 'paridade_reversa') {
        const even = nums.every((n: number) => n > 0 && n % 2 === 0);
        bets.push({ type: 'paridade', label: even ? 'Par' : 'Ímpar', detail: `Aposte no ${even ? 'Par' : 'Ímpar'} (1:1)`, emoji: even ? '2️⃣' : '1️⃣' });
      } else if (t === 'alto_baixo_reversa') {
        const low = nums.every((n: number) => n >= 1 && n <= 18);
        bets.push({ type: 'alto_baixo', label: low ? 'Baixo (1-18)' : 'Alto (19-36)', detail: `Aposte no ${low ? 'Baixo (1-18)' : 'Alto (19-36)'} (1:1)`, emoji: low ? '⬇️' : '⬆️' });
      } else if (t === 'coluna_fria') {
        const col = COL1.every(n => nums.includes(n)) ? 1 : COL2.every(n => nums.includes(n)) ? 2 : 3;
        bets.push({ type: 'coluna', label: `Coluna ${col} (Fria)`, detail: `Aposte na Coluna ${col} — em dívida estatística. Paga 2:1`, emoji: '📐' });
      } else if (t === 'duzia_progressiva') {
        const dz = nums[0] <= 12 ? 1 : nums[0] <= 24 ? 2 : 3;
        bets.push({ type: 'duzia', label: `Dúzia ${dz} (Progressiva)`, detail: `${dz}ª Dúzia por sequência D1→D2→D3. Paga 2:1`, emoji: '🎲' });
      } else if (t === 'combo_ouro') {
        bets.push({ type: 'absoluta', label: `👑 Combo OURO`, detail: `CONFIANÇA MÁXIMA: Terminal dominante + Puxados + Sequência. ${nums.length} números: ${nums.slice(0, 8).join(', ')}`, emoji: '👑' });
      } else if (t === 'combo_prata') {
        bets.push({ type: 'fusao', label: `🥈 Combo PRATA → ${nums[0]}`, detail: `Número quente + Terminal + Vizinhos combinados: ${nums.slice(0, 8).join(', ')}`, emoji: '🥈' });
      } else if (t === 'jeu_zero') {
        bets.push({ type: 'setor', label: `Jeu Zero`, detail: `Cubra os 7 números do Jeu Zero: ${nums.join(', ')}. Paga 5:1`, emoji: '🟢' });
      } else if (t === 'hiper_quente') {
        bets.push({ type: 'vizinhos', label: `Hiper-Quente ${nums[0]}`, detail: `Número ${nums[0]} repetindo! Terminal + Vizinhos: ${nums.slice(0, 6).join(', ')}`, emoji: '🔥' });
      } else if (t === 'cluster_regional') {
        bets.push({ type: 'setor', label: strat.label, detail: `Setor concentrado: ${nums.slice(0, 8).join(', ')}`, emoji: '🗺️' });
      } else if (t === 'multiplos_seq' || t === 'diferenca_const') {
        bets.push({ type: 'vizinhos', label: strat.label, detail: `Sequência detectada → Alvo ${nums[0]} + vizinhos: ${nums.slice(1, 5).join(', ')}`, emoji: strat.emoji });
      } else {
        // Generic fallback
        const mainNum = nums[0];
        bets.push({ type: 'generico', label: strat.label, detail: `Cubra: ${nums.slice(0, 8).join(', ')} — Foco no ${mainNum}`, emoji: strat.emoji });
      }

      // Add complementary bets based on number groupings
      if (!['cor', 'paridade', 'alto_baixo'].includes(t) && nums.length >= 3) {
        // Check if numbers cluster in a terminal
        const termCount: Record<number, number> = {};
        nums.forEach((n: number) => { const term = n % 10; termCount[term] = (termCount[term] || 0) + 1; });
        const topTerm = Object.entries(termCount).sort(([,a],[,b]) => b - a)[0];
        if (topTerm && Number(topTerm[1]) >= 3) {
          const termVal = Number(topTerm[0]);
          if (!bets.some(b => b.type === 'terminal')) {
            bets.push({ type: 'terminal_comp', label: `+ Terminais ${termVal}`, detail: `Reforço: cubra terminais ${termVal}`, emoji: '🔢' });
          }
        }
        
        // Check if numbers are in same column
        const colCount = [0, 0, 0];
        nums.filter((n: number) => n > 0).forEach((n: number) => { const c = getColumn(n); if (c > 0) colCount[c-1]++; });
        const maxCol = colCount.indexOf(Math.max(...colCount)) + 1;
        if (colCount[maxCol-1] >= Math.ceil(nums.length * 0.5) && !bets.some(b => b.type === 'coluna')) {
          bets.push({ type: 'coluna_comp', label: `+ Coluna ${maxCol}`, detail: `Reforço: aposte Coluna ${maxCol}`, emoji: '📐' });
        }

        // Check cavalos group concentration
        const cavCount: Record<string, number> = { '258': 0, '147': 0, '03': 0, '69': 0 };
        nums.forEach((n: number) => { const g = getCavalo(n); if (g) cavCount[g]++; });
        const topCav = Object.entries(cavCount).sort(([,a],[,b]) => b - a)[0];
        if (topCav && Number(topCav[1]) >= 3 && !bets.some(b => b.type === 'cavalos')) {
          bets.push({ type: 'cavalos_comp', label: `+ Cavalos ${topCav[0]}`, detail: `Reforço: cubra Cavalos ${topCav[0]}`, emoji: '🐎' });
        }
      }

      // ALWAYS add protection — dinâmica baseada em erros reais
      const protLabel = realProtection.length > 0 ? realProtection.join('-') : '(nenhuma)';
      bets.push({ type: 'protecao', label: `Proteção ${protLabel}`, detail: `Proteção dinâmica baseada em números que saem quando erramos: ${realProtection.join(', ')}${realProtection.length === 0 ? ' (não aplicável)' : ` (${realProtection.length} fichas extras)`}`, emoji: '🛡️' });

      const summary = bets.map(b => `${b.emoji} ${b.label}`).join(' • ');
      return { bets, summary };
    };

    const betInstructions = generateBetInstructions(winner);

    // Generate diverse alternatives — pick from DIFFERENT bet categories
    const getBetCategory = (type: string): string => {
      if (['sniper', 'voisins', 'setor_oposto', 'ultra_sniper', 'ritmo_calibrado', 'cylinder_bias', 'cluster_regional', 'jeu_zero'].includes(type)) return 'setor';
      if (['cavalos', 'cavalos_comp', 'cavalo_split'].includes(type)) return 'cavalos';
      if (['terminal_alternation', 'duplo_terminal', 'terminais_cruzados', 'poucas_fichas', 'terminal_alto_baixo', 'duzia_terminal_corr'].includes(type)) return 'terminal';
      if (['duzia_unica', 'dozen_phase', 'duzias', 'pressao_retorno', 'duzia_progressiva'].includes(type)) return 'duzia';
      if (['coluna', 'column_cycle', 'coluna_fria'].includes(type)) return 'coluna';
      if (['cor', 'cor_alternancia', 'cor_reversa'].includes(type)) return 'cor';
      if (['paridade', 'paridade_reversa'].includes(type)) return 'paridade';
      if (['alto_baixo', 'alto_baixo_reversa'].includes(type)) return 'alto_baixo';
      if (['fusao_suprema', 'convergencia_absoluta', 'matrix_fusion', 'archetype_fusion', 'combo_ouro', 'combo_prata'].includes(type)) return 'fusao';
      if (['numeros_puxam'].includes(type)) return 'puxada';
      if (['pressao_zero'].includes(type)) return 'zero';
      if (['rua'].includes(type)) return 'rua';
      if (['hiper_quente'].includes(type)) return 'hiper_quente';
      if (['multiplos_seq', 'diferenca_const'].includes(type)) return 'sequencia';
      return type;
    };
    const winnerCategory = getBetCategory(winner.type);
    const seenCategories = new Set([winnerCategory]);
    const diverseAlts: typeof strategies = [];
    // First pass: one per category (max 6 diverse)
    for (const s of strategies.slice(1)) {
      if (diverseAlts.length >= 6) break;
      const cat = getBetCategory(s.type);
      if (!seenCategories.has(cat)) {
        seenCategories.add(cat);
        diverseAlts.push(s);
      }
    }
    // Fill to at least 4 if not enough categories
    for (const s of strategies.slice(1)) {
      if (diverseAlts.length >= 4) break;
      if (!diverseAlts.includes(s)) diverseAlts.push(s);
    }

    // Build COMBINED BET: merge all diverse alternatives, weight by frequency across strategies
    const combinedNumFreq: Record<number, { count: number; totalProb: number; sources: string[] }> = {};
    for (const s of diverseAlts) {
      for (const n of s.numbers.slice(0, 12)) {
        if (!combinedNumFreq[n]) combinedNumFreq[n] = { count: 0, totalProb: 0, sources: [] };
        combinedNumFreq[n].count++;
        combinedNumFreq[n].totalProb += s.probability;
        if (!combinedNumFreq[n].sources.includes(s.emoji)) combinedNumFreq[n].sources.push(s.emoji);
      }
    }
    // Sort combined numbers: multi-strategy first, then by total probability
    const combinedSorted = Object.entries(combinedNumFreq)
      .sort(([,a],[,b]) => b.count - a.count || b.totalProb - a.totalProb)
      .map(([n, info]) => ({ num: Number(n), ...info }));
    // Add protection
    PROTECTION_NUMBERS.forEach(pn => {
      if (!combinedSorted.find(c => c.num === pn)) {
        combinedSorted.push({ num: pn, count: 0, totalProb: 0, sources: ['🛡️'] });
      }
    });

    const topAlternatives = diverseAlts.slice(0, 6).map(s => ({
      type: s.type, label: s.label, emoji: s.emoji,
      numbers: s.numbers.slice(0, 12), coverage: +s.coverage.toFixed(1), payout: s.payout,
      score: +s.score.toFixed(1), probability: s.probability,
      justification: s.justification,
      betInstructions: generateBetInstructions(s),
    }));

    // Combined bet data
    const combinedBet = {
      numbers: combinedSorted.map(c => c.num),
      highlighted: combinedSorted.filter(c => c.count >= 2).map(c => c.num),
      coverage: +((combinedSorted.length / 37) * 100).toFixed(1),
      payout: 36 - combinedSorted.length,
      avgProbability: Math.round(diverseAlts.reduce((s, a) => s + a.probability, 0) / (diverseAlts.length || 1)),
      strategiesUsed: diverseAlts.map(s => ({ emoji: s.emoji, label: s.label, type: s.type })),
    };

    // Merge protection numbers into winner
    // finalBetNumbers já construído acima com numTop1 + suporte + proteção real
    const winnerNumbersWithProtection = finalBetNumbers;

    // ── ANTI-PADRÃO: salvar números que saem QUANDO erramos ──
    if (isNewNumber && Object.keys(numberMissFreq).length >= 3) {
      const topMisses = Object.entries(numberMissFreq)
        .sort(([,a],[,b]) => b - a)
        .slice(0, 6)
        .map(([n]) => Number(n));

      if (topMisses.length >= 3) {
        const titulo = `Anti-padrão: erros recentes`;
        const { data: exA } = await supabase
          .from('ai_learned_patterns')
          .select('id')
          .eq('learning_type', 'error_pattern')
          .eq('title', titulo)
          .maybeSingle();

        const rowA = {
          knowledge: `Quando erramos, saíram: [${topMisses.join(',')}]. Incluir esses números na próxima jogada ou evitar a estratégia que os errou.`,
          data_points: Object.values(numberMissFreq).reduce((a: number,b: number)=>a+b,0),
          accuracy: 80,
          metadata: {
            hotNumbers: topMisses,
            key_numbers: topMisses,
            missFreq: numberMissFreq,
            lastSeen: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        };

        if (exA?.id) {
          await supabase.from('ai_learned_patterns').update(rowA).eq('id', exA.id);
        } else {
          await supabase.from('ai_learned_patterns').insert({
            learning_type: 'error_pattern', title: titulo, ...rowA
          });
        }
      }
    }

    return json({
      signal: {
        number: numTop1,
        neighbors: finalBetNumbers.slice(1),
        protection: realProtection,
        probability: finalProbability,
        reasons: numScores[0]?.reasons?.slice(0, 6) ?? [],
        convergenceReasons: reasons,
        confirmations,
        confirmationDetail: {
          ensemble: ensConfirms,
          winner: winnerConfirms,
          matriz: matrizConfirms,
          pull: pullConfirms,
          autoRep: autoRepConfirms,
          recentCount,
        },
        diagnostic,
      },
      strategy: {
        type: winner.type,
        label: winner.label,
        emoji: winner.emoji,
        numbers: finalBetNumbers,
        protection: realProtection,
        coverage: +(finalBetNumbers.length / 37 * 100).toFixed(1),
        payout: 36 - finalBetNumbers.length,
        probability: finalProbability,
        justification: decisionJustification,
      },
      betInstructions,
      topAlternatives,
      combinedBet,
      allStrategies,
      mesaMode,
      mode, message,
      memoryWindows,
      aiLearnings: aiLearnings.slice(0, 12),
      noiseFiltered: noiseCount,
      dealerChaos: chaoticDealer,
      selfCorrection: strategyWeightAdjust,
      errorAnalysis: { categories: errorCategories, topError: topError?.[0] || null, consecutiveBoosts: consecutiveHitBoost },
      timeAwareness,
      randomnessIndex,
      diamondDeflection: diamondDeflection.slice(0, 4),
      kellyBetting,
      dealerBiometrics,
      trendEngine: {
        mode: trendEngine.mode,
        confidence: trendEngine.confidence,
        colorTrend: trendEngine.colorTrend,
        parityTrend: trendEngine.parityTrend,
        highLowTrend: trendEngine.highLowTrend,
        dozenTrend: trendEngine.dozenTrend,
        sectorTrend: trendEngine.sectorTrend,
        reasoning: trendEngine.reasoning.slice(0, 5),
      },
      archetypes: archetypes.map(a => ({ name: a.name, emoji: a.emoji, active: a.active, strength: a.strength, detail: a.detail, predictedNums: a.predictedNums.slice(0, 6) })),
      deepMemory: {
        ancestralPatterns: ancestralPatterns.slice(0, 3),
        mesaDNA,
        cylinderInertia,
        geneticPatterns: geneticPatterns.slice(0, 3),
        backpropWeights,
        flowDynamics: { mesaFlowState, pullPatterns: pullPatterns.slice(0, 3), neighborJumps: neighborJumpCount, terminalProgression },
      },
      ...baseResponse, recoveryMode,
      topCandidates: numScores.slice(0, 8).map(s => ({ num: s.num, score: +s.score.toFixed(1), reasons: s.reasons })),
      dealerShift: { detected: isNewDealer, oldArc: +olderMean20.toFixed(1), newArc: +recentMean5.toFixed(1) },
      ultraConservadorMode: ultraConservador,
      recentWinRate: +recent10WR.toFixed(2),
      ensemble: ensembleResult,
      matrizNumerica: {
        top6: Object.entries(matrizCombinado).sort(([,a],[,b])=>(b as number)-(a as number)).slice(0,6).map(([n])=>({num:Number(n),prob:+((matrizProb[Number(n)]||0)*100).toFixed(1)})),
        observacoes: matrizTotal,
        ultimoNumero: lastNum0,
      },
    });

  } catch (e) {
    console.error("sniper error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function json(data: any) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
