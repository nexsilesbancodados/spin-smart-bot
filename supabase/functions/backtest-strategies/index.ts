import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ========== WHEEL & CONSTANTS ==========
const WHEEL = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const WL = WHEEL.length;
const RED = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
const VOISINS = [22,18,29,7,28,12,35,3,26,0,32,15,19,4,21,2,25];
const TIERS = [27,13,36,11,30,8,23,10,5,24,16,33];
const ORPHELINS = [1,20,14,31,9,17,34,6];
const COL1 = [1,4,7,10,13,16,19,22,25,28,31,34];
const COL2 = [2,5,8,11,14,17,20,23,26,29,32,35];
const COL3 = [3,6,9,12,15,18,21,24,27,30,33,36];

const TERMINALS_MAP: Record<number, number[]> = {
  0:[0,10,20,30],1:[1,11,21,31],2:[2,12,22,32],3:[3,13,23,33],
  4:[4,14,24,34],5:[5,15,25,35],6:[6,16,26,36],7:[7,17,27],8:[8,18,28],9:[9,19,29],
};

const CAVALOS: Record<string, number[]> = {
  '258':[2,5,8,12,15,18,22,25,28,32,35],
  '147':[1,4,7,11,14,17,21,24,27,31,34],
  '03':[0,3,10,13,20,23,30,33],
  '69':[6,9,16,19,26,29,36],
};

const PULL_MAP: Record<number, number[]> = {
  0:[10,20,30,32,15,26,3,33,31],1:[11,35,16,4,18,28,27,29,33],
  2:[14,1,13,18,35,29],3:[13,27,6,11,30,8],4:[26,15,18,32,33,16,8],
  5:[3,33,16,24,10,18],6:[8,15,31,21,22,23],7:[16,18,17,30,31],
  8:[11,9,10],9:[34,35,36,3,16,26,23,24,32,31],10:[20,5,18,11,14,24],
  11:[8,18,16,21,30,1],12:[21,7,28,35],13:[31,27,36,6],
  14:[24,21,18,31,9],15:[4,19,21,32,0],16:[24,21,18,14,6,26],
  17:[34,6,25,27,7],18:[8,18,28,7],19:[9,19,29,4,21],
  20:[4,14,10,30],21:[19,2,4,23],22:[33,2,32,12],23:[32,11,2,33,13],
  24:[21,18,14,34,4],25:[2,4,17,28,29,12,7,18],26:[6,16,26,36,3,0],
  27:[28,29,24,22,26,33,31,34,35,36],28:[13,14,15,16,17,18],
  29:[35,28,22],30:[4,8,16,9,18,22,5,25,3],31:[13,9,14],
  32:[2,12,22,32,0,15],33:[16,3,23,13],34:[16,6,4,24],
  35:[0,3,7,12,26,28,29,35],36:[3,10,27,6],
};

const getColor = (n: number) => n === 0 ? 'green' : RED.includes(n) ? 'red' : 'black';
const wheelIdx = (n: number) => WHEEL.indexOf(n);
const getNeighbors = (n: number, count = 4): number[] => {
  const idx = wheelIdx(n); if (idx === -1) return [];
  const r: number[] = [];
  for (let i = 1; i <= count; i++) { r.push(WHEEL[(idx-i+WL)%WL]); r.push(WHEEL[(idx+i)%WL]); }
  return r;
};
const getDozen = (n: number) => n === 0 ? 0 : n <= 12 ? 1 : n <= 24 ? 2 : 3;
const getColumn = (n: number) => n === 0 ? 0 : COL1.includes(n) ? 1 : COL2.includes(n) ? 2 : 3;
const getSector = (n: number) => VOISINS.includes(n)?'Voisins':TIERS.includes(n)?'Tiers':ORPHELINS.includes(n)?'Orphelins':'Zero';

// ========== STRATEGY DEFINITIONS ==========
// Each strategy: given history[window..], predict numbers for the NEXT spin
// We test if history[0] (next spin) is in the predicted set

interface StrategyResult {
  numbers: number[];
  label: string;
  category: string;
}

type StrategyFn = (history: number[]) => StrategyResult | null;

const strategies: Record<string, StrategyFn> = {

  // 1. Terminal Quente
  terminal_quente: (h) => {
    const freq: Record<number, number> = {};
    for (let t = 0; t <= 9; t++) freq[t] = 0;
    h.slice(0, 15).forEach(n => freq[n % 10]++);
    const sorted = Object.entries(freq).sort(([,a],[,b]) => b - a);
    const hot = Number(sorted[0][0]);
    if ((sorted[0][1] as number) < 3) return null;
    return { numbers: TERMINALS_MAP[hot] || [], label: `Terminal ${hot}`, category: 'terminal' };
  },

  // 2. Terminal Frio (Lei do Terço)
  terminal_frio: (h) => {
    const freq: Record<number, number> = {};
    for (let t = 0; t <= 9; t++) freq[t] = 0;
    h.slice(0, 15).forEach(n => freq[n % 10]++);
    const sorted = Object.entries(freq).sort(([,a],[,b]) => a - b);
    const cold = Number(sorted[0][0]);
    return { numbers: TERMINALS_MAP[cold] || [], label: `Terminal Frio ${cold}`, category: 'terminal' };
  },

  // 3. Terminal Repetido (mesmo terminal 2x)
  terminal_repetido: (h) => {
    if (h.length < 2) return null;
    const t0 = h[0] % 10, t1 = h[1] % 10;
    if (t0 !== t1) return null;
    return { numbers: TERMINALS_MAP[t0] || [], label: `Terminal Rep ${t0}`, category: 'terminal' };
  },

  // 4. Puxada Direta
  puxada_direta: (h) => {
    if (h.length < 1) return null;
    const last = h[0];
    const pulls = PULL_MAP[last];
    if (!pulls || pulls.length === 0) return null;
    const top = pulls.slice(0, 5);
    const withNeigh = [...new Set([...top, ...top.flatMap(n => getNeighbors(n, 2))])].slice(0, 12);
    return { numbers: withNeigh, label: `Puxada ${last}→`, category: 'puxada' };
  },

  // 5. Puxada Dupla (2 últimos concordam)
  puxada_dupla: (h) => {
    if (h.length < 2) return null;
    const p1 = PULL_MAP[h[0]] || [];
    const p2 = PULL_MAP[h[1]] || [];
    const common = p1.filter(n => p2.includes(n));
    if (common.length < 2) return null;
    return { numbers: common.slice(0, 8), label: `Puxada Dupla`, category: 'puxada' };
  },

  // 6. Vizinhos do Último
  vizinhos_ultimo: (h) => {
    if (h.length < 1) return null;
    const neigh = getNeighbors(h[0], 4);
    return { numbers: [h[0], ...neigh], label: `Vizinhos ${h[0]}`, category: 'vizinhos' };
  },

  // 7. Setor Voisins
  setor_voisins: (h) => {
    const recent = h.slice(0, 10);
    const count = recent.filter(n => VOISINS.includes(n)).length;
    if (count < 5) return null;
    return { numbers: VOISINS, label: 'Setor Voisins', category: 'setor' };
  },

  // 8. Setor Tiers
  setor_tiers: (h) => {
    const recent = h.slice(0, 10);
    const count = recent.filter(n => TIERS.includes(n)).length;
    if (count < 5) return null;
    return { numbers: TIERS, label: 'Setor Tiers', category: 'setor' };
  },

  // 9. Setor Orphelins
  setor_orphelins: (h) => {
    const recent = h.slice(0, 10);
    const count = recent.filter(n => ORPHELINS.includes(n)).length;
    if (count < 4) return null;
    return { numbers: ORPHELINS, label: 'Setor Orphelins', category: 'setor' };
  },

  // 10. Dúzia Quente
  duzia_quente: (h) => {
    const recent = h.slice(0, 12).filter(n => n > 0);
    const dz = [0, 0, 0];
    recent.forEach(n => { if (n <= 12) dz[0]++; else if (n <= 24) dz[1]++; else dz[2]++; });
    const best = dz.indexOf(Math.max(...dz));
    if (dz[best] < 5) return null;
    const nums = best === 0 ? Array.from({length:12},(_, i) => i+1) : best === 1 ? Array.from({length:12},(_, i) => i+13) : Array.from({length:12},(_, i) => i+25);
    return { numbers: nums, label: `Dúzia ${best + 1}`, category: 'duzia' };
  },

  // 11. Dúzia Fria (ausente)
  duzia_fria: (h) => {
    const recent = h.slice(0, 10).filter(n => n > 0);
    const d1 = recent.some(n => n <= 12), d2 = recent.some(n => n >= 13 && n <= 24), d3 = recent.some(n => n >= 25);
    if (!d1) return { numbers: Array.from({length:12},(_, i) => i+1), label: 'Dúzia 1 Fria', category: 'duzia' };
    if (!d2) return { numbers: Array.from({length:12},(_, i) => i+13), label: 'Dúzia 2 Fria', category: 'duzia' };
    if (!d3) return { numbers: Array.from({length:12},(_, i) => i+25), label: 'Dúzia 3 Fria', category: 'duzia' };
    return null;
  },

  // 12. Coluna Quente
  coluna_quente: (h) => {
    const recent = h.slice(0, 12).filter(n => n > 0);
    const cols = [0, 0, 0];
    recent.forEach(n => { if (COL1.includes(n)) cols[0]++; else if (COL2.includes(n)) cols[1]++; else if (COL3.includes(n)) cols[2]++; });
    const best = cols.indexOf(Math.max(...cols));
    if (cols[best] < 5) return null;
    return { numbers: best === 0 ? COL1 : best === 1 ? COL2 : COL3, label: `Coluna ${best + 1}`, category: 'coluna' };
  },

  // 13. Coluna Fria
  coluna_fria: (h) => {
    const recent = h.slice(0, 10).filter(n => n > 0);
    const c1 = recent.some(n => COL1.includes(n)), c2 = recent.some(n => COL2.includes(n)), c3 = recent.some(n => COL3.includes(n));
    if (!c1) return { numbers: COL1, label: 'Coluna 1 Fria', category: 'coluna' };
    if (!c2) return { numbers: COL2, label: 'Coluna 2 Fria', category: 'coluna' };
    if (!c3) return { numbers: COL3, label: 'Coluna 3 Fria', category: 'coluna' };
    return null;
  },

  // 14. Cor Vermelho dominante
  cor_vermelho: (h) => {
    const recent = h.slice(0, 10).filter(n => n > 0);
    const reds = recent.filter(n => RED.includes(n)).length;
    if (reds >= 7) return { numbers: RED, label: 'Cor Vermelho', category: 'cor' };
    return null;
  },

  // 15. Cor Preto dominante
  cor_preto: (h) => {
    const recent = h.slice(0, 10).filter(n => n > 0);
    const blacks = recent.filter(n => !RED.includes(n)).length;
    if (blacks >= 7) return { numbers: Array.from({length:36},(_, i) => i+1).filter(n => !RED.includes(n)), label: 'Cor Preto', category: 'cor' };
    return null;
  },

  // 16. Cor Inversão (5+ mesma cor → apostar oposta)
  cor_inversao: (h) => {
    const colors = h.slice(0, 8).map(n => getColor(n));
    let streak = 1;
    for (let i = 1; i < colors.length; i++) { if (colors[i] === colors[0] && colors[0] !== 'green') streak++; else break; }
    if (streak < 5) return null;
    const opposite = colors[0] === 'red' ? Array.from({length:36},(_, i) => i+1).filter(n => !RED.includes(n)) : RED.slice();
    return { numbers: opposite, label: `Inversão ${colors[0] === 'red' ? 'Preto' : 'Vermelho'}`, category: 'cor' };
  },

  // 17. Par dominante
  paridade_par: (h) => {
    const recent = h.slice(0, 10).filter(n => n > 0);
    const pares = recent.filter(n => n % 2 === 0).length;
    if (pares >= 7) return { numbers: Array.from({length:18},(_, i) => (i+1)*2).filter(n => n <= 36), label: 'Par', category: 'paridade' };
    return null;
  },

  // 18. Ímpar dominante
  paridade_impar: (h) => {
    const recent = h.slice(0, 10).filter(n => n > 0);
    const impares = recent.filter(n => n % 2 === 1).length;
    if (impares >= 7) return { numbers: Array.from({length:18},(_, i) => i*2+1).filter(n => n <= 36), label: 'Ímpar', category: 'paridade' };
    return null;
  },

  // 19. Alto dominante
  alto_dominante: (h) => {
    const recent = h.slice(0, 10).filter(n => n > 0);
    const altos = recent.filter(n => n >= 19).length;
    if (altos >= 7) return { numbers: Array.from({length:18},(_, i) => i+19), label: 'Alto (19-36)', category: 'alto_baixo' };
    return null;
  },

  // 20. Baixo dominante
  baixo_dominante: (h) => {
    const recent = h.slice(0, 10).filter(n => n > 0);
    const baixos = recent.filter(n => n >= 1 && n <= 18).length;
    if (baixos >= 7) return { numbers: Array.from({length:18},(_, i) => i+1), label: 'Baixo (1-18)', category: 'alto_baixo' };
    return null;
  },

  // 21. Cavalos 258
  cavalos_258: (h) => {
    const recent = h.slice(0, 10);
    const count = recent.filter(n => CAVALOS['258'].includes(n)).length;
    if (count < 5) return null;
    return { numbers: CAVALOS['258'], label: 'Cavalos 258', category: 'cavalos' };
  },

  // 22. Cavalos 147
  cavalos_147: (h) => {
    const recent = h.slice(0, 10);
    const count = recent.filter(n => CAVALOS['147'].includes(n)).length;
    if (count < 5) return null;
    return { numbers: CAVALOS['147'], label: 'Cavalos 147', category: 'cavalos' };
  },

  // 23. Cavalos 03
  cavalos_03: (h) => {
    const recent = h.slice(0, 10);
    const count = recent.filter(n => CAVALOS['03'].includes(n)).length;
    if (count < 4) return null;
    return { numbers: CAVALOS['03'], label: 'Cavalos 03', category: 'cavalos' };
  },

  // 24. Cavalos 69
  cavalos_69: (h) => {
    const recent = h.slice(0, 10);
    const count = recent.filter(n => CAVALOS['69'].includes(n)).length;
    if (count < 4) return null;
    return { numbers: CAVALOS['69'], label: 'Cavalos 69', category: 'cavalos' };
  },

  // 25. Zero Pressure
  zero_pressure: (h) => {
    let delay = 0;
    for (let i = 0; i < h.length; i++) { if (h[i] === 0) break; delay++; }
    if (delay < 15) return null;
    return { numbers: [0, 32, 15, 26, 3, 35, 12, 28], label: 'Zero Pressure', category: 'setor' };
  },

  // 26. Rua Quente
  rua_quente: (h) => {
    const freq: Record<number, number> = {};
    h.slice(0, 15).filter(n => n > 0).forEach(n => {
      const street = Math.ceil(n / 3);
      freq[street] = (freq[street] || 0) + 1;
    });
    const sorted = Object.entries(freq).sort(([,a],[,b]) => b - a);
    if (!sorted[0] || (sorted[0][1] as number) < 3) return null;
    const st = Number(sorted[0][0]);
    const nums = [(st-1)*3+1, (st-1)*3+2, (st-1)*3+3].filter(n => n <= 36);
    return { numbers: nums, label: `Rua ${st}`, category: 'rua' };
  },

  // 27. Auto-Repetição
  auto_repeticao: (h) => {
    if (h.length < 2 || h[0] !== h[1]) return null;
    const n = h[0];
    return { numbers: [n, ...getNeighbors(n, 3)], label: `Auto-Rep ${n}`, category: 'pleno' };
  },

  // 28. Espelho Numérico
  espelho: (h) => {
    const last = h[0];
    const s = String(last);
    if (s.length !== 2) return null;
    const mirror = parseInt(s[1] + s[0]);
    if (mirror < 0 || mirror > 36) return null;
    return { numbers: [mirror, ...getNeighbors(mirror, 2)], label: `Espelho ${last}↔${mirror}`, category: 'pleno' };
  },

  // 29. Complementar (37-n)
  complementar: (h) => {
    const last = h[0];
    if (last <= 0 || last > 36) return null;
    const comp = 37 - last;
    return { numbers: [comp, ...getNeighbors(comp, 2)], label: `Compl ${last}↔${comp}`, category: 'pleno' };
  },

  // 30. Fibonacci Gap (números "due" por Fibonacci)
  fibonacci_gap: (h) => {
    const FIB = [5, 8, 13, 21, 34];
    const candidates: number[] = [];
    for (let n = 0; n <= 36; n++) {
      let lastSeen = -1;
      for (let i = 0; i < h.length; i++) { if (h[i] === n) { lastSeen = i; break; } }
      if (lastSeen < 0) lastSeen = h.length;
      if (FIB.some(f => Math.abs(lastSeen - f) <= 1) && lastSeen > 5) candidates.push(n);
    }
    if (candidates.length < 3) return null;
    return { numbers: candidates.slice(0, 10), label: 'Fibonacci Gap', category: 'pleno' };
  },

  // 31. Lei do Terço (ausentes em 37 giros)
  lei_terco: (h) => {
    if (h.length < 30) return null;
    const appeared = new Set(h.slice(0, 37));
    const absent: number[] = [];
    for (let n = 0; n <= 36; n++) { if (!appeared.has(n)) absent.push(n); }
    if (absent.length < 5) return null;
    return { numbers: absent.slice(0, 13), label: 'Lei do Terço', category: 'pleno' };
  },

  // 32. Hot Numbers (top 5 frequentes em 50 giros)
  hot_numbers: (h) => {
    const freq: Record<number, number> = {};
    h.slice(0, 50).forEach(n => freq[n] = (freq[n] || 0) + 1);
    const sorted = Object.entries(freq).sort(([,a],[,b]) => b - a).slice(0, 5);
    if ((sorted[0]?.[1] as number) < 3) return null;
    const nums = sorted.map(([n]) => Number(n));
    const withNeigh = [...new Set([...nums, ...nums.flatMap(n => getNeighbors(n, 2))])].slice(0, 15);
    return { numbers: withNeigh, label: 'Hot Numbers', category: 'pleno' };
  },

  // 33. Cold Numbers (top 5 ausentes)
  cold_numbers: (h) => {
    const freq: Record<number, number> = {};
    for (let n = 0; n <= 36; n++) freq[n] = 0;
    h.slice(0, 50).forEach(n => freq[n]++);
    const sorted = Object.entries(freq).sort(([,a],[,b]) => a - b).slice(0, 5);
    const nums = sorted.map(([n]) => Number(n));
    return { numbers: nums, label: 'Cold Numbers', category: 'pleno' };
  },

  // 34. Bayesian Cor
  bayesian_cor: (h) => {
    if (h.length < 20) return null;
    const matrix: Record<string, Record<string, number>> = {};
    for (let i = 0; i < h.length - 1; i++) {
      const from = getColor(h[i + 1]);
      const to = getColor(h[i]);
      if (!matrix[from]) matrix[from] = {};
      matrix[from][to] = (matrix[from][to] || 0) + 1;
    }
    const lastColor = getColor(h[0]);
    const row = matrix[lastColor];
    if (!row) return null;
    const total = Object.values(row).reduce((a, b) => a + b, 0);
    const best = Object.entries(row).sort(([,a],[,b]) => b - a)[0];
    if (!best || total < 10 || (best[1] / total) < 0.45) return null;
    const predictedColor = best[0];
    if (predictedColor === 'green') return null;
    const nums = predictedColor === 'red' ? RED.slice() : Array.from({length:36},(_, i) => i+1).filter(n => !RED.includes(n));
    return { numbers: nums, label: `Bayes→${predictedColor === 'red' ? 'Verm' : 'Preto'}`, category: 'cor' };
  },

  // 35. Bayesian Dúzia
  bayesian_duzia: (h) => {
    if (h.length < 20) return null;
    const matrix: Record<number, Record<number, number>> = {};
    for (let i = 0; i < h.length - 1; i++) {
      const from = getDozen(h[i + 1]);
      const to = getDozen(h[i]);
      if (from === 0 || to === 0) continue;
      if (!matrix[from]) matrix[from] = {};
      matrix[from][to] = (matrix[from][to] || 0) + 1;
    }
    const lastDz = getDozen(h[0]);
    if (lastDz === 0) return null;
    const row = matrix[lastDz];
    if (!row) return null;
    const total = Object.values(row).reduce((a, b) => a + b, 0);
    const best = Object.entries(row).sort(([,a],[,b]) => b - a)[0];
    if (!best || total < 10) return null;
    const dz = Number(best[0]);
    const nums = dz === 1 ? Array.from({length:12},(_, i) => i+1) : dz === 2 ? Array.from({length:12},(_, i) => i+13) : Array.from({length:12},(_, i) => i+25);
    return { numbers: nums, label: `Bayes D${dz}`, category: 'duzia' };
  },

  // 36. Bayesian Setor
  bayesian_setor: (h) => {
    if (h.length < 20) return null;
    const matrix: Record<string, Record<string, number>> = {};
    for (let i = 0; i < h.length - 1; i++) {
      const from = getSector(h[i + 1]);
      const to = getSector(h[i]);
      if (!matrix[from]) matrix[from] = {};
      matrix[from][to] = (matrix[from][to] || 0) + 1;
    }
    const lastSector = getSector(h[0]);
    const row = matrix[lastSector];
    if (!row) return null;
    const total = Object.values(row).reduce((a, b) => a + b, 0);
    const best = Object.entries(row).sort(([,a],[,b]) => b - a)[0];
    if (!best || total < 8) return null;
    const sectors: Record<string, number[]> = { Voisins: VOISINS, Tiers: TIERS, Orphelins: ORPHELINS };
    const sNums = sectors[best[0]];
    if (!sNums) return null;
    return { numbers: sNums, label: `Bayes→${best[0]}`, category: 'setor' };
  },

  // 37. Bayesian Terminal
  bayesian_terminal: (h) => {
    if (h.length < 20) return null;
    const matrix: Record<number, Record<number, number>> = {};
    for (let i = 0; i < h.length - 1; i++) {
      const from = h[i + 1] % 10;
      const to = h[i] % 10;
      if (!matrix[from]) matrix[from] = {};
      matrix[from][to] = (matrix[from][to] || 0) + 1;
    }
    const lastTerm = h[0] % 10;
    const row = matrix[lastTerm];
    if (!row) return null;
    const total = Object.values(row).reduce((a, b) => a + b, 0);
    const best = Object.entries(row).sort(([,a],[,b]) => b - a)[0];
    if (!best || total < 8) return null;
    const t = Number(best[0]);
    return { numbers: TERMINALS_MAP[t] || [], label: `Bayes T${t}`, category: 'terminal' };
  },

  // 38. Alternância Cor (cor alterna 3x)
  alternancia_cor: (h) => {
    if (h.length < 4) return null;
    const cols = h.slice(0, 4).map(n => getColor(n)).filter(c => c !== 'green');
    if (cols.length < 4) return null;
    if (cols[0] !== cols[1] && cols[1] !== cols[2] && cols[2] !== cols[3]) {
      const next = cols[0] === 'red' ? Array.from({length:36},(_, i) => i+1).filter(n => !RED.includes(n)) : RED.slice();
      return { numbers: next, label: 'Alternância Cor', category: 'cor' };
    }
    return null;
  },

  // 39. Alternância Alto/Baixo
  alternancia_alto_baixo: (h) => {
    if (h.length < 4) return null;
    const hilo = h.slice(0, 4).filter(n => n > 0).map(n => n >= 19 ? 'H' : 'L');
    if (hilo.length < 4) return null;
    if (hilo[0] !== hilo[1] && hilo[1] !== hilo[2] && hilo[2] !== hilo[3]) {
      const next = hilo[0] === 'H' ? Array.from({length:18},(_, i) => i+1) : Array.from({length:18},(_, i) => i+19);
      return { numbers: next, label: 'Alt Alto/Baixo', category: 'alto_baixo' };
    }
    return null;
  },

  // 40. Oitavo Quente
  oitavo_quente: (h) => {
    const OCTAVES: Record<string, number[]> = {
      O1:[0,32,15,19,4], O2:[21,2,25,17], O3:[34,6,27,13], O4:[36,11,30,8],
      O5:[23,10,5,24], O6:[16,33,1,20], O7:[14,31,9,22], O8:[18,29,7,28,12,35,3,26],
    };
    const freq: Record<string, number> = {};
    for (const k of Object.keys(OCTAVES)) freq[k] = 0;
    h.slice(0, 15).forEach(n => {
      for (const [k, v] of Object.entries(OCTAVES)) if (v.includes(n)) freq[k]++;
    });
    const sorted = Object.entries(freq).sort(([,a],[,b]) => b - a);
    if ((sorted[0][1] as number) < 4) return null;
    return { numbers: OCTAVES[sorted[0][0]], label: `Oitavo ${sorted[0][0]}`, category: 'setor' };
  },

  // 41-50: Momentum strategies
  momentum_cor: (h) => {
    if (h.length < 20) return null;
    const w1 = h.slice(0, 5).filter(n => RED.includes(n)).length;
    const w2 = h.slice(5, 10).filter(n => RED.includes(n)).length;
    const w3 = h.slice(10, 15).filter(n => RED.includes(n)).length;
    const trend = w1 > w2 && w2 > w3;
    if (trend && w1 >= 4) return { numbers: RED.slice(), label: 'Momentum Verm', category: 'cor' };
    const bw1 = 5 - h.slice(0, 5).filter(n => n === 0).length - w1;
    const bw2 = 5 - h.slice(5, 10).filter(n => n === 0).length - w2;
    if (bw1 > bw2 && bw2 > w3 && bw1 >= 4) {
      return { numbers: Array.from({length:36},(_, i) => i+1).filter(n => !RED.includes(n)), label: 'Momentum Preto', category: 'cor' };
    }
    return null;
  },

  // 42. Wheel Zone Hot
  wheel_zone_hot: (h) => {
    if (h.length < 15) return null;
    const zoneSize = 6;
    const zones = Math.floor(WL / zoneSize);
    let bestZone = 0, bestScore = 0;
    for (let z = 0; z < zones; z++) {
      const zoneNums = WHEEL.slice(z * zoneSize, (z + 1) * zoneSize);
      let score = 0;
      h.slice(0, 20).forEach((n, i) => { if (zoneNums.includes(n)) score += Math.pow(0.9, i); });
      if (score > bestScore) { bestScore = score; bestZone = z; }
    }
    if (bestScore < 3) return null;
    const nums = WHEEL.slice(bestZone * 6, (bestZone + 1) * 6);
    return { numbers: nums, label: `Zona ${bestZone + 1}`, category: 'setor' };
  },

  // 43. Sequência Terminal Crescente
  seq_terminal_cresc: (h) => {
    if (h.length < 3) return null;
    const terms = h.slice(0, 3).map(n => n % 10);
    if (terms[2] < terms[1] && terms[1] < terms[0]) {
      const next = (terms[0] + 1) % 10;
      return { numbers: TERMINALS_MAP[next] || [], label: `Seq Cresc→T${next}`, category: 'terminal' };
    }
    if (terms[2] > terms[1] && terms[1] > terms[0]) {
      const next = (terms[0] - 1 + 10) % 10;
      return { numbers: TERMINALS_MAP[next] || [], label: `Seq Desc→T${next}`, category: 'terminal' };
    }
    return null;
  },

  // 44. Dupla Terminal (par complementar)
  dupla_terminal: (h) => {
    const PAIRS: Record<number, number> = {1:6,6:1,2:7,7:2,3:8,8:3,4:9,9:4,0:5,5:0};
    const last = h[0] % 10;
    const pair = PAIRS[last];
    if (pair === undefined) return null;
    return { numbers: [...(TERMINALS_MAP[last]||[]), ...(TERMINALS_MAP[pair]||[])], label: `Dupla T${last}+T${pair}`, category: 'terminal' };
  },

  // 45. Convergência Multi-Dimensional
  convergencia: (h) => {
    if (h.length < 15) return null;
    // Find numbers where multiple dimensions agree
    const hotTerminals = h.slice(0, 15).map(n => n % 10);
    const termFreq: Record<number, number> = {};
    hotTerminals.forEach(t => termFreq[t] = (termFreq[t] || 0) + 1);
    const bestTerm = Number(Object.entries(termFreq).sort(([,a],[,b]) => b - a)[0][0]);
    
    const recent = h.slice(0, 10);
    const redDom = recent.filter(n => RED.includes(n)).length > 6;
    const highDom = recent.filter(n => n >= 19).length > 6;
    
    const candidates: number[] = [];
    for (let n = 0; n <= 36; n++) {
      let dims = 0;
      if (n % 10 === bestTerm) dims++;
      if (redDom && RED.includes(n)) dims++;
      if (!redDom && !RED.includes(n) && n > 0) dims++;
      if (highDom && n >= 19) dims++;
      if (!highDom && n >= 1 && n <= 18) dims++;
      if (dims >= 2) candidates.push(n);
    }
    if (candidates.length < 3 || candidates.length > 15) return null;
    return { numbers: candidates.slice(0, 12), label: 'Convergência', category: 'fusao' };
  },

  // 46-50: Breakout strategies
  breakout_setor: (h) => {
    if (h.length < 20) return null;
    const prev = h.slice(5, 20);
    const recent = h.slice(0, 5);
    const sectorCount: Record<string, number> = {};
    prev.forEach(n => { const s = getSector(n); sectorCount[s] = (sectorCount[s] || 0) + 1; });
    const top = Object.entries(sectorCount).sort(([,a],[,b]) => b - a)[0];
    if (!top || (top[1] as number) < 8) return null;
    const recentInSector = recent.filter(n => getSector(n) === top[0]).length;
    if (recentInSector > 1) return null;
    // Bet on the OTHER sectors
    const sectors: Record<string, number[]> = { Voisins: VOISINS, Tiers: TIERS, Orphelins: ORPHELINS };
    const otherSectors = Object.entries(sectors).filter(([k]) => k !== top[0]).flatMap(([,v]) => v);
    return { numbers: [...new Set(otherSectors)].slice(0, 15), label: `Breakout ${top[0]}`, category: 'setor' };
  },

  breakout_duzia: (h) => {
    if (h.length < 15) return null;
    const prev = h.slice(5, 15);
    const dz = [0, 0, 0];
    prev.forEach(n => { if (n >= 1 && n <= 12) dz[0]++; else if (n >= 13 && n <= 24) dz[1]++; else if (n >= 25) dz[2]++; });
    const hotIdx = dz.indexOf(Math.max(...dz));
    if (dz[hotIdx] < 6) return null;
    const recent = h.slice(0, 5);
    const recentInDz = recent.filter(n => { const d = getDozen(n); return d === hotIdx + 1; }).length;
    if (recentInDz > 0) return null;
    // Bet on cold dozens
    const coldDzNums: number[] = [];
    for (let d = 0; d < 3; d++) {
      if (d !== hotIdx) {
        const start = d * 12 + 1;
        for (let i = start; i < start + 12; i++) coldDzNums.push(i);
      }
    }
    return { numbers: coldDzNums, label: `Break D${hotIdx + 1}`, category: 'duzia' };
  },

  // 48. Recency Weighted Top
  recency_weighted: (h) => {
    if (h.length < 20) return null;
    const freq: Record<number, number> = {};
    for (let n = 0; n <= 36; n++) freq[n] = 0;
    h.slice(0, 50).forEach((n, i) => freq[n] += Math.pow(0.92, i));
    const sorted = Object.entries(freq).sort(([,a],[,b]) => b - a).slice(0, 5);
    const nums = sorted.map(([n]) => Number(n));
    const withNeigh = [...new Set([...nums, ...nums.flatMap(n => getNeighbors(n, 2))])].slice(0, 12);
    return { numbers: withNeigh, label: 'Recency Top', category: 'pleno' };
  },

  // 49. Volatility-based (low vol = repeat pattern)
  low_volatility_repeat: (h) => {
    if (h.length < 20) return null;
    const arcs: number[] = [];
    for (let i = 0; i < Math.min(20, h.length) - 1; i++) {
      const ia = WHEEL.indexOf(h[i]), ib = WHEEL.indexOf(h[i+1]);
      if (ia >= 0 && ib >= 0) { const d = Math.abs(ia - ib); arcs.push(Math.min(d, WL - d)); }
    }
    const mean = arcs.reduce((a, b) => a + b, 0) / (arcs.length || 1);
    const variance = arcs.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (arcs.length || 1);
    if (Math.sqrt(variance) > 6) return null; // high volatility
    // Low volatility: bet on similar zone as last number
    const neigh = getNeighbors(h[0], 5);
    return { numbers: [h[0], ...neigh], label: 'Low Vol Zone', category: 'vizinhos' };
  },

  // 50. Estrela de Davi (Invictor)
  estrela_davi: (h) => {
    const ESTRELA = [30,31,33,34,35,8,23,10,5,9,22,1,20,14,3,26,12];
    const recent = h.slice(0, 10);
    const count = recent.filter(n => ESTRELA.includes(n)).length;
    if (count < 5) return null;
    return { numbers: ESTRELA, label: 'Estrela de Davi', category: 'setor' };
  },

  // 51-60: Additional strategies
  kavouras: (h) => {
    const KAVOURAS = [1,2,3,4,5,6,8,9,11,12,14,15,17,18,26,27,29,30,31,32,33,34,35,36];
    const recent = h.slice(0, 10);
    const count = recent.filter(n => KAVOURAS.includes(n)).length;
    if (count < 7) return null;
    return { numbers: KAVOURAS, label: 'Kavouras', category: 'setor' };
  },

  // 52. Terminal Triplo (3x mesmo terminal)
  terminal_triplo: (h) => {
    if (h.length < 3) return null;
    const t0 = h[0] % 10, t1 = h[1] % 10, t2 = h[2] % 10;
    if (t0 === t1 && t1 === t2) {
      return { numbers: TERMINALS_MAP[t0] || [], label: `Triplo T${t0}`, category: 'terminal' };
    }
    return null;
  },

  // 53. Puxada + Terminal
  puxada_terminal: (h) => {
    if (h.length < 1) return null;
    const last = h[0];
    const pulls = PULL_MAP[last] || [];
    const term = last % 10;
    const termNums = TERMINALS_MAP[term] || [];
    const combined = [...new Set([...pulls.slice(0, 4), ...termNums])].slice(0, 10);
    if (combined.length < 4) return null;
    return { numbers: combined, label: `Pull+T${term}`, category: 'fusao' };
  },

  // 54. Sector Momentum
  sector_momentum: (h) => {
    if (h.length < 20) return null;
    const sectors = { Voisins: VOISINS, Tiers: TIERS, Orphelins: ORPHELINS };
    let bestSector = '', bestMom = -Infinity;
    for (const [name, nums] of Object.entries(sectors)) {
      const w1 = h.slice(0, 5).filter(n => nums.includes(n)).length;
      const w2 = h.slice(5, 10).filter(n => nums.includes(n)).length;
      const w3 = h.slice(10, 15).filter(n => nums.includes(n)).length;
      const mom = w1 * 3 + w2 - w3;
      if (mom > bestMom) { bestMom = mom; bestSector = name; }
    }
    if (bestMom < 8) return null;
    return { numbers: sectors[bestSector as keyof typeof sectors], label: `Mom ${bestSector}`, category: 'setor' };
  },

  // 55. Column Momentum
  col_momentum: (h) => {
    if (h.length < 15) return null;
    const cols = [COL1, COL2, COL3];
    let best = 0, bestScore = 0;
    cols.forEach((col, idx) => {
      const w1 = h.slice(0, 5).filter(n => col.includes(n)).length;
      const w2 = h.slice(5, 10).filter(n => col.includes(n)).length;
      const score = w1 * 2 + w2;
      if (score > bestScore) { bestScore = score; best = idx; }
    });
    if (bestScore < 7) return null;
    return { numbers: cols[best], label: `Mom Col ${best + 1}`, category: 'coluna' };
  },

  // 56. Dozen Sequence (1→2→3)
  dozen_sequence: (h) => {
    if (h.length < 3) return null;
    const dzs = h.slice(0, 3).filter(n => n > 0).map(n => getDozen(n));
    if (dzs.length < 3) return null;
    if (dzs[2] === 1 && dzs[1] === 2 && dzs[0] === 3) {
      return { numbers: Array.from({length:12},(_, i) => i+1), label: 'Seq D1→D2→D3→D1', category: 'duzia' };
    }
    if (dzs[2] === 3 && dzs[1] === 2 && dzs[0] === 1) {
      return { numbers: Array.from({length:12},(_, i) => i+25), label: 'Seq D3→D2→D1→D3', category: 'duzia' };
    }
    return null;
  },

  // 57. Color+Parity Combined
  cor_paridade: (h) => {
    if (h.length < 10) return null;
    const recent = h.slice(0, 10).filter(n => n > 0);
    const redPar = recent.filter(n => RED.includes(n) && n % 2 === 0).length;
    const redImpar = recent.filter(n => RED.includes(n) && n % 2 === 1).length;
    const blackPar = recent.filter(n => !RED.includes(n) && n % 2 === 0).length;
    const blackImpar = recent.filter(n => !RED.includes(n) && n % 2 === 1).length;
    const best = Math.max(redPar, redImpar, blackPar, blackImpar);
    if (best < 5) return null;
    let nums: number[];
    let label: string;
    if (best === redPar) { nums = RED.filter(n => n % 2 === 0); label = 'Verm+Par'; }
    else if (best === redImpar) { nums = RED.filter(n => n % 2 === 1); label = 'Verm+Ímpar'; }
    else if (best === blackPar) { nums = Array.from({length:36},(_, i) => i+1).filter(n => !RED.includes(n) && n % 2 === 0); label = 'Preto+Par'; }
    else { nums = Array.from({length:36},(_, i) => i+1).filter(n => !RED.includes(n) && n % 2 === 1); label = 'Preto+Ímpar'; }
    return { numbers: nums, label, category: 'fusao' };
  },

  // 58. Sector+Terminal
  setor_terminal: (h) => {
    if (h.length < 10) return null;
    const lastSector = getSector(h[0]);
    const hotTerm = h.slice(0, 10).map(n => n % 10);
    const termFreq: Record<number, number> = {};
    hotTerm.forEach(t => termFreq[t] = (termFreq[t] || 0) + 1);
    const bestTerm = Number(Object.entries(termFreq).sort(([,a],[,b]) => b - a)[0][0]);
    const sectors: Record<string, number[]> = { Voisins: VOISINS, Tiers: TIERS, Orphelins: ORPHELINS };
    const sectorNums = sectors[lastSector] || VOISINS;
    const termNums = TERMINALS_MAP[bestTerm] || [];
    const intersection = sectorNums.filter(n => termNums.includes(n));
    if (intersection.length < 1) return null;
    const combined = [...new Set([...intersection, ...sectorNums.slice(0, 5)])].slice(0, 10);
    return { numbers: combined, label: `${lastSector}+T${bestTerm}`, category: 'fusao' };
  },

  // 59. Dozen+Column intersection
  duzia_coluna: (h) => {
    if (h.length < 10) return null;
    const recent = h.slice(0, 10).filter(n => n > 0);
    const dzFreq = [0, 0, 0];
    const colFreq = [0, 0, 0];
    recent.forEach(n => {
      if (n <= 12) dzFreq[0]++; else if (n <= 24) dzFreq[1]++; else dzFreq[2]++;
      if (COL1.includes(n)) colFreq[0]++; else if (COL2.includes(n)) colFreq[1]++; else colFreq[2]++;
    });
    const bestDz = dzFreq.indexOf(Math.max(...dzFreq));
    const bestCol = colFreq.indexOf(Math.max(...colFreq));
    const dzNums = bestDz === 0 ? Array.from({length:12},(_, i) => i+1) : bestDz === 1 ? Array.from({length:12},(_, i) => i+13) : Array.from({length:12},(_, i) => i+25);
    const colNums = bestCol === 0 ? COL1 : bestCol === 1 ? COL2 : COL3;
    const intersection = dzNums.filter(n => colNums.includes(n));
    if (intersection.length < 2) return null;
    return { numbers: intersection, label: `D${bestDz+1}×C${bestCol+1}`, category: 'fusao' };
  },

  // 60. Tripla Convergência (Pull + Terminal + Vizinhos)
  tripla_convergencia: (h) => {
    if (h.length < 5) return null;
    const last = h[0];
    const pulls = (PULL_MAP[last] || []).slice(0, 5);
    const term = last % 10;
    const termNums = TERMINALS_MAP[term] || [];
    const neigh = getNeighbors(last, 3);
    // Find numbers that appear in at least 2 of 3 sources
    const allNums = [...pulls, ...termNums, ...neigh];
    const freq: Record<number, number> = {};
    allNums.forEach(n => freq[n] = (freq[n] || 0) + 1);
    const convergent = Object.entries(freq).filter(([,c]) => c >= 2).map(([n]) => Number(n));
    if (convergent.length < 2) return null;
    const combined = [...new Set([...convergent, ...pulls.slice(0, 3)])].slice(0, 10);
    return { numbers: combined, label: 'Tripla Conv', category: 'fusao' };
  },

  // 61-65: Additional pattern strategies
  parity_streak: (h) => {
    if (h.length < 5) return null;
    const parities = h.slice(0, 6).filter(n => n > 0).map(n => n % 2);
    let streak = 1;
    for (let i = 1; i < parities.length; i++) { if (parities[i] === parities[0]) streak++; else break; }
    if (streak < 5) return null;
    // Bet opposite
    const opposite = parities[0] === 0
      ? Array.from({length:18},(_, i) => i*2+1).filter(n => n <= 36)
      : Array.from({length:18},(_, i) => (i+1)*2).filter(n => n <= 36);
    return { numbers: opposite, label: `Inversão ${parities[0] === 0 ? 'Ímpar' : 'Par'}`, category: 'paridade' };
  },

  highlow_streak: (h) => {
    if (h.length < 5) return null;
    const hilo = h.slice(0, 6).filter(n => n > 0).map(n => n >= 19 ? 'H' : 'L');
    let streak = 1;
    for (let i = 1; i < hilo.length; i++) { if (hilo[i] === hilo[0]) streak++; else break; }
    if (streak < 5) return null;
    const opposite = hilo[0] === 'H' ? Array.from({length:18},(_, i) => i+1) : Array.from({length:18},(_, i) => i+19);
    return { numbers: opposite, label: `Inv ${hilo[0] === 'H' ? 'Baixo' : 'Alto'}`, category: 'alto_baixo' };
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Fetch all numbers
    const [r1, r2, r3] = await Promise.all([
      supabase.from('roulette_numbers').select('number, fetched_at').order('fetched_at', { ascending: false }).limit(600),
      supabase.from('historico_roleta').select('number, created_at').order('created_at', { ascending: false }).limit(600),
      supabase.from('resultados_roleta').select('numero, created_at').order('created_at', { ascending: false }).limit(600),
    ]);

    const all: { number: number; time: string }[] = [];
    const seen = new Set<string>();
    const add = (n: number, t: string) => {
      const k = `${n}-${t}`; if (seen.has(k) || n < 0 || n > 36) return; seen.add(k); all.push({ number: n, time: t });
    };
    (r1.data || []).forEach((r: any) => add(r.number, r.fetched_at));
    (r2.data || []).forEach((r: any) => add(r.number, r.created_at));
    (r3.data || []).forEach((r: any) => { const n = parseInt(r.numero, 10); if (!isNaN(n)) add(n, r.created_at); });
    all.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

    const numbers = all.slice(0, 550).map(e => e.number);
    if (numbers.length < 30) {
      return new Response(JSON.stringify({ error: "Dados insuficientes (mínimo 30 giros)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Run backtest: for each position i (from 20 to numbers.length-1),
    // use numbers[i-20..i] as history, predict, check if numbers[i-1-20] = actual next
    // Actually: for position i, history = numbers.slice(i, i+WINDOW), next = numbers[i-1]
    const WINDOW = 20; // history window for each strategy
    const MIN_START = 1; // start from index 1 (so we have index 0 as "next")
    const maxI = Math.min(numbers.length - WINDOW, 500);

    const results: Record<string, { hits: number; total: number; exactHits: number; neighborHits: number; category: string; label: string }> = {};

    for (const [name, fn] of Object.entries(strategies)) {
      results[name] = { hits: 0, total: 0, exactHits: 0, neighborHits: 0, category: '', label: name };
    }

    for (let i = MIN_START; i < maxI; i++) {
      const history = numbers.slice(i, i + WINDOW + 30); // give strategies enough data
      const actual = numbers[i - 1]; // the "next" number that came

      for (const [name, fn] of Object.entries(strategies)) {
        try {
          const result = fn(history);
          if (!result) continue; // strategy didn't fire
          
          results[name].total++;
          results[name].category = result.category;
          results[name].label = result.label;

          if (result.numbers.includes(actual)) {
            results[name].hits++;
            results[name].exactHits++;
          } else {
            // Check neighbor hit (±2 positions on wheel)
            const neighs = getNeighbors(actual, 2);
            if (result.numbers.some(n => neighs.includes(n))) {
              results[name].hits++;
              results[name].neighborHits++;
            }
          }
        } catch { /* skip errors */ }
      }
    }

    // Calculate win rates and build response
    const strategyResults = Object.entries(results)
      .filter(([, r]) => r.total >= 5) // at least 5 activations
      .map(([name, r]) => ({
        name,
        label: r.label,
        category: r.category,
        total: r.total,
        hits: r.hits,
        exactHits: r.exactHits,
        neighborHits: r.neighborHits,
        winRate: +(r.hits / r.total * 100).toFixed(1),
        exactRate: +(r.exactHits / r.total * 100).toFixed(1),
        activationRate: +(r.total / maxI * 100).toFixed(1),
      }))
      .sort((a, b) => b.winRate - a.winRate);

    // Category aggregation
    const categoryStats: Record<string, { hits: number; total: number }> = {};
    for (const s of strategyResults) {
      if (!categoryStats[s.category]) categoryStats[s.category] = { hits: 0, total: 0 };
      categoryStats[s.category].hits += s.hits;
      categoryStats[s.category].total += s.total;
    }
    const categories = Object.entries(categoryStats).map(([cat, st]) => ({
      category: cat,
      winRate: +(st.hits / st.total * 100).toFixed(1),
      totalBets: st.total,
    })).sort((a, b) => b.winRate - a.winRate);

    return new Response(JSON.stringify({
      strategies: strategyResults,
      categories,
      totalSpins: numbers.length,
      testedSpins: maxI - MIN_START,
      totalStrategies: Object.keys(strategies).length,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("backtest error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
