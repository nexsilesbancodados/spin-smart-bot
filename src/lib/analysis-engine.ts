/**
 * AnalysisEngine v3 — Maximum Precision Statistical Analysis
 * Modules: Statistics, Patterns, Trends, Confidence, Risk, Transition Matrix, Multi-Window, Statistical Debt, Pull Chain
 */

const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const WHEEL = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const VOISINS = new Set([22,18,29,7,28,12,35,3,26,0,32,15,19,4,21,2,25]);
const TIERS = new Set([27,13,36,11,30,8,23,10,5,24,16,33]);
const ORPHELINS = new Set([1,20,14,31,9,17,34,6]);

// Pull table — Mesa Brasileira Playtech
const PULL: Record<number,number[]> = {0:[10,20,30,32,15,26,3,33,31,35],1:[11,35,16,4,18,28,27,29,33,14,31],2:[14,1,13,18,35,29,12,22],3:[13,27,6,11,30,8,23,33],4:[26,15,18,32,33,16,8,24,14],5:[3,33,16,24,10,18,15,25],6:[8,15,31,21,22,23,16,26],7:[16,18,17,30,31,28,12],8:[11,9,10,18,28,23],9:[34,35,36,3,16,26,23,24,32,31,29],10:[20,5,18,11,14,24,30],11:[8,18,16,21,30,1],12:[21,7,28,35],13:[31,27,36,6],14:[24,21,18,31,9],15:[4,19,21,32,0],16:[24,21,18,14,6,26],17:[34,6,25,27,7],18:[8,18,28,7],19:[9,19,29,4,21],20:[4,14,10,30],21:[19,2,4,23],22:[33,2,32,12],23:[32,11,2,33,13],24:[21,18,14,34,4],25:[2,4,17,28,29,12,7,18],26:[6,16,26,36,3,0],27:[28,29,24,22,26,33,31,34,35,36],28:[13,14,15,16,17,18,7],29:[35,28,22],30:[4,8,16,9,18,22,5,25,3],31:[13,9,14],32:[2,12,22,32,0,15],33:[16,3,23,13],34:[16,6,4,24],35:[0,3,7,12,26,28,29,35],36:[3,10,27,6]};

type Color = 'red' | 'black' | 'green';
const getColor = (n: number): Color => n === 0 ? 'green' : RED.has(n) ? 'red' : 'black';
const getDozen = (n: number) => n === 0 ? 0 : n <= 12 ? 1 : n <= 24 ? 2 : 3;
const getColumn = (n: number) => n === 0 ? 0 : ((n - 1) % 3) + 1;
const getSector = (n: number) => VOISINS.has(n) ? 'voisins' : TIERS.has(n) ? 'tiers' : ORPHELINS.has(n) ? 'orphelins' : 'zero';

// ═══ TYPES ═══════════════════════════════════════════════════════════════════

export interface EngineSignal {
  id: string;
  type: 'streak_break' | 'cold_dozen' | 'cold_column' | 'pattern';
  action: string;
  actionColor: 'red' | 'black' | 'green' | 'dozen' | 'column';
  confidence: number;
  detail: string;
  protection: string;
  numbers?: number[];
  urgency: 'high' | 'medium' | 'low';
  streakLength?: number;
  absentRounds?: number;
}

export interface NumberFrequency {
  number: number;
  count: number;
  expected: number;
  deviation: number;
  lastSeen: number;
  isHot: boolean;
  isCold: boolean;
}

export interface StreakInfo {
  type: string;
  value: string;
  length: number;
  active: boolean;
}

export interface GapInfo {
  number: number;
  gap: number;
  averageGap: number;
  overdue: boolean;
  debtScore: number; // statistical debt score
}

export interface TrendInfo {
  category: string;
  shortTerm: 'up' | 'down' | 'neutral';
  mediumTerm: 'up' | 'down' | 'neutral';
  longTerm: 'up' | 'down' | 'neutral';
  momentum: number;
  reversalRisk: number;
}

export interface PatternDetection {
  id: string;
  name: string;
  description: string;
  strength: number;
  type: 'alternation' | 'cycle' | 'cluster' | 'temporal' | 'recovery' | 'sequence' | 'transition' | 'pull' | 'fibonacci' | 'debt';
  suggestedNumbers: number[];
}

export interface RiskAssessment {
  suggestion: 'CONSERVADORA' | 'MODERADA' | 'AGRESSIVA';
  betSizeMultiplier: number;
  stopLossAlert: boolean;
  dangerousSequence: boolean;
  dangerReason?: string;
  martingaleLevel: number;
  kellyFraction: number;
}

export interface TransitionData {
  from: number;
  topTransitions: { to: number; prob: number; count: number }[];
}

export interface FullAnalysis {
  frequencies: NumberFrequency[];
  colorDistribution: { red: number; black: number; green: number };
  parityDistribution: { even: number; odd: number };
  highLowDistribution: { high: number; low: number };
  dozenDistribution: [number, number, number];
  columnDistribution: [number, number, number];
  sectorDistribution: { voisins: number; tiers: number; orphelins: number };
  volatilityIndex: number;
  standardDeviation: number;
  movingAverage: number;
  streaks: StreakInfo[];
  gaps: GapInfo[];
  patterns: PatternDetection[];
  trends: TrendInfo[];
  overallConfidence: number;
  recentAccuracy: number;
  patternStrength: number;
  dataConsistency: number;
  risk: RiskAssessment;
  signals: EngineSignal[];
  top5: { number: number; score: number; sources: string[] }[];
  transitionMatrix: TransitionData | null;
  multiWindowValidation: { window: number; topNumbers: number[]; agreement: number }[];
  statisticalDebt: { number: number; debt: number; expected: number; actual: number }[];
  pullChainScore: { number: number; pullScore: number }[];
  prediction: {
    previsao: string;
    confianca: number;
    padroes_detectados: string[];
    tendencia_atual: string;
    sugestao_aposta: string;
    alerta: string | null;
  };
}

// ═══ MODULE 1: ADVANCED STATISTICS ══════════════════════════════════════════

function analyzeStatistics(history: number[]) {
  const h = history.slice(0, 500);
  const total = h.length;
  if (total < 5) return null;

  const freq: Record<number, number> = {};
  for (let i = 0; i <= 36; i++) freq[i] = 0;
  h.forEach(n => freq[n]++);
  const expected = total / 37;
  
  const freqValues = Object.values(freq);
  const mean = freqValues.reduce((a, b) => a + b, 0) / freqValues.length;
  const variance = freqValues.reduce((a, v) => a + (v - mean) ** 2, 0) / freqValues.length;
  const stdDev = Math.sqrt(variance);

  const frequencies: NumberFrequency[] = [];
  for (let n = 0; n <= 36; n++) {
    const count = freq[n];
    const deviation = stdDev > 0 ? (count - expected) / stdDev : 0;
    const lastSeen = h.indexOf(n);
    frequencies.push({
      number: n, count, expected: Math.round(expected * 10) / 10,
      deviation: Math.round(deviation * 100) / 100,
      lastSeen: lastSeen === -1 ? total : lastSeen,
      isHot: count > expected * 1.4,
      isCold: count < expected * 0.6,
    });
  }

  const colorDist = { red: 0, black: 0, green: 0 };
  h.forEach(n => colorDist[getColor(n)]++);

  const nonZero = h.filter(n => n > 0);
  const even = nonZero.filter(n => n % 2 === 0).length;
  const odd = nonZero.filter(n => n % 2 === 1).length;

  const high = h.filter(n => n >= 19).length;
  const low = h.filter(n => n >= 1 && n <= 18).length;

  const dz: [number, number, number] = [0, 0, 0];
  h.forEach(n => { if (n >= 1 && n <= 12) dz[0]++; else if (n <= 24 && n > 12) dz[1]++; else if (n > 24) dz[2]++; });

  const col: [number, number, number] = [0, 0, 0];
  h.filter(n => n > 0).forEach(n => col[((n - 1) % 3)]++);

  const sec = { voisins: 0, tiers: 0, orphelins: 0 };
  h.forEach(n => { const s = getSector(n); if (s !== 'zero') sec[s as keyof typeof sec]++; });

  const recent20 = h.slice(0, 20);
  const recent20Freq: Record<number, number> = {};
  recent20.forEach(n => recent20Freq[n] = (recent20Freq[n] || 0) + 1);
  const r20Values = Object.values(recent20Freq);
  const r20Mean = r20Values.length > 0 ? r20Values.reduce((a, b) => a + b, 0) / r20Values.length : 0;
  const r20Var = r20Values.length > 0 ? r20Values.reduce((a, v) => a + (v - r20Mean) ** 2, 0) / r20Values.length : 0;
  const volatility = r20Mean > 0 ? Math.round(Math.sqrt(r20Var) / r20Mean * 100) : 50;

  const movingAvg = recent20.length > 0 ? Math.round(recent20.reduce((a, b) => a + b, 0) / recent20.length * 10) / 10 : 18;

  // Streaks
  const streaks: StreakInfo[] = [];
  const colors = h.map(getColor);
  let cStreak = 1;
  for (let i = 1; i < Math.min(colors.length, 50); i++) {
    if (colors[i] === colors[0] && colors[0] !== 'green') cStreak++;
    else break;
  }
  if (cStreak >= 3) streaks.push({ type: 'cor', value: colors[0], length: cStreak, active: true });
  
  const parities = h.filter(n => n > 0).map(n => n % 2 === 0 ? 'par' : 'ímpar');
  let pStreak = 1;
  for (let i = 1; i < Math.min(parities.length, 30); i++) {
    if (parities[i] === parities[0]) pStreak++;
    else break;
  }
  if (pStreak >= 3) streaks.push({ type: 'paridade', value: parities[0], length: pStreak, active: true });

  const hlSeq = h.filter(n => n > 0).map(n => n >= 19 ? 'alto' : 'baixo');
  let hlStreak = 1;
  for (let i = 1; i < Math.min(hlSeq.length, 30); i++) {
    if (hlSeq[i] === hlSeq[0]) hlStreak++;
    else break;
  }
  if (hlStreak >= 3) streaks.push({ type: 'alto/baixo', value: hlSeq[0], length: hlStreak, active: true });

  // Dozen streak
  const dzSeq = h.filter(n => n > 0).map(getDozen);
  let dzStreak = 1;
  for (let i = 1; i < Math.min(dzSeq.length, 30); i++) {
    if (dzSeq[i] === dzSeq[0]) dzStreak++;
    else break;
  }
  if (dzStreak >= 3) streaks.push({ type: 'dúzia', value: `${dzSeq[0]}ª`, length: dzStreak, active: true });

  // Gaps with statistical debt
  const gaps: GapInfo[] = [];
  for (let n = 0; n <= 36; n++) {
    const positions = h.map((v, i) => v === n ? i : -1).filter(p => p >= 0);
    const gap = positions.length > 0 ? positions[0] : total;
    const avgGap = positions.length > 1
      ? positions.slice(0, -1).reduce((acc, p, i) => acc + (positions[i + 1] - p), 0) / (positions.length - 1)
      : 37;
    const overdue = gap > avgGap * 1.5;
    // Statistical debt: how much this number "owes" based on deviation from expected
    const debtScore = Math.max(0, (expected - freq[n]) / Math.max(1, expected) * 100);
    gaps.push({ number: n, gap, averageGap: Math.round(avgGap * 10) / 10, overdue, debtScore: Math.round(debtScore * 10) / 10 });
  }

  return {
    frequencies: frequencies.sort((a, b) => b.count - a.count),
    colorDistribution: colorDist,
    parityDistribution: { even, odd },
    highLowDistribution: { high, low },
    dozenDistribution: dz,
    columnDistribution: col,
    sectorDistribution: sec,
    volatilityIndex: volatility,
    standardDeviation: Math.round(stdDev * 100) / 100,
    movingAverage: movingAvg,
    streaks,
    gaps: gaps.sort((a, b) => b.gap - a.gap),
  };
}

// ═══ MODULE 2: TRANSITION MATRIX (37×37) ════════════════════════════════════

function buildTransitionMatrix(history: number[]): TransitionData | null {
  const h = history.slice(0, 500);
  if (h.length < 20) return null;

  const matrix: number[][] = Array.from({ length: 37 }, () => Array(37).fill(0));
  
  for (let i = 0; i < h.length - 1; i++) {
    const from = h[i];
    const to = h[i + 1];
    if (from >= 0 && from <= 36 && to >= 0 && to <= 36) {
      matrix[from][to]++;
    }
  }

  // Get transitions from the last number
  const lastNum = h[0];
  if (lastNum < 0 || lastNum > 36) return null;

  const row = matrix[lastNum];
  const total = row.reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  const transitions = row
    .map((count, to) => ({ to, prob: Math.round((count / total) * 1000) / 10, count }))
    .filter(t => t.count > 0)
    .sort((a, b) => b.prob - a.prob)
    .slice(0, 10);

  return { from: lastNum, topTransitions: transitions };
}

// ═══ MODULE 3: MULTI-WINDOW VALIDATION ══════════════════════════════════════

function multiWindowValidation(history: number[]): { window: number; topNumbers: number[]; agreement: number }[] {
  const windows = [50, 100, 200, 300, 400, 500];
  const results: { window: number; topNumbers: number[]; agreement: number }[] = [];

  const windowResults: number[][] = [];

  for (const w of windows) {
    const slice = history.slice(0, Math.min(w, history.length));
    if (slice.length < 20) continue;

    const freq: Record<number, number> = {};
    for (let i = 0; i <= 36; i++) freq[i] = 0;
    slice.forEach(n => freq[n]++);
    const expected = slice.length / 37;

    // Score: frequency deviation + gap pressure
    const scores: { num: number; score: number }[] = [];
    for (let n = 0; n <= 36; n++) {
      const gap = slice.indexOf(n);
      const gapScore = gap === -1 ? 3 : Math.max(0, (gap - 37) / 37);
      const freqScore = freq[n] > expected * 1.3 ? (freq[n] - expected) / expected * 2 : 0;
      const debtScore = freq[n] < expected * 0.7 ? (expected - freq[n]) / expected * 2.5 : 0;
      scores.push({ num: n, score: freqScore + gapScore + debtScore });
    }

    const topNums = scores.sort((a, b) => b.score - a.score).slice(0, 8).map(s => s.num);
    windowResults.push(topNums);
    results.push({ window: w, topNumbers: topNums, agreement: 0 });
  }

  // Calculate cross-window agreement
  if (windowResults.length >= 2) {
    for (let i = 0; i < results.length; i++) {
      let agreementCount = 0;
      for (const num of results[i].topNumbers) {
        const appearsIn = windowResults.filter(wr => wr.includes(num)).length;
        if (appearsIn >= Math.ceil(windowResults.length * 0.5)) agreementCount++;
      }
      results[i].agreement = Math.round((agreementCount / results[i].topNumbers.length) * 100);
    }
  }

  return results;
}

// ═══ MODULE 4: STATISTICAL DEBT ═════════════════════════════════════════════

function calculateStatisticalDebt(history: number[]): { number: number; debt: number; expected: number; actual: number }[] {
  const h = history.slice(0, 500);
  if (h.length < 30) return [];

  const freq: Record<number, number> = {};
  for (let i = 0; i <= 36; i++) freq[i] = 0;
  h.forEach(n => freq[n]++);
  const expected = h.length / 37;

  return Array.from({ length: 37 }, (_, n) => ({
    number: n,
    debt: Math.round((expected - freq[n]) * 100) / 100,
    expected: Math.round(expected * 10) / 10,
    actual: freq[n],
  }))
    .filter(d => d.debt > 0)
    .sort((a, b) => b.debt - a.debt);
}

// ═══ MODULE 5: PULL CHAIN SCORING ═══════════════════════════════════════════

function calculatePullChainScore(history: number[]): { number: number; pullScore: number }[] {
  if (history.length < 2) return [];

  const lastNum = history[0];
  const pullNums = PULL[lastNum] || [];
  if (pullNums.length === 0) return [];

  // Validate pull effectiveness in history
  const pullHits: Record<number, number> = {};
  let pullCheckCount = 0;
  
  for (let i = 0; i < Math.min(history.length - 1, 200); i++) {
    const from = history[i + 1]; // the number before
    const to = history[i]; // the number after
    const expectedPull = PULL[from] || [];
    if (expectedPull.includes(to)) {
      pullHits[to] = (pullHits[to] || 0) + 1;
    }
    pullCheckCount++;
  }

  const pullRate = pullCheckCount > 0 
    ? Object.values(pullHits).reduce((a, b) => a + b, 0) / pullCheckCount 
    : 0;

  // Score each pull number based on historical effectiveness
  return pullNums.map((n, i) => {
    const positionWeight = 1 - (i / pullNums.length) * 0.5; // first positions get more weight
    const historicalBonus = (pullHits[n] || 0) * 0.3;
    const pullScore = Math.round((positionWeight + historicalBonus + pullRate) * 100) / 100;
    return { number: n, pullScore };
  }).sort((a, b) => b.pullScore - a.pullScore);
}

// ═══ MODULE 6: PATTERN DETECTION (ENHANCED) ═════════════════════════════════

function detectPatterns(history: number[]): PatternDetection[] {
  const patterns: PatternDetection[] = [];
  const h = history.slice(0, 200);
  if (h.length < 10) return patterns;

  // 1. Alternation patterns (color)
  const colors = h.slice(0, 20).map(getColor).filter(c => c !== 'green');
  let alternations = 0;
  for (let i = 1; i < colors.length; i++) {
    if (colors[i] !== colors[i - 1]) alternations++;
  }
  const altRate = colors.length > 1 ? alternations / (colors.length - 1) : 0.5;
  if (altRate > 0.7) {
    const nextColor = colors[0] === 'red' ? 'black' : 'red';
    const nums = Array.from({ length: 37 }, (_, i) => i).filter(n => getColor(n) === nextColor);
    patterns.push({
      id: 'alt-color', name: 'Alternância de Cor',
      description: `Padrão de alternância ativo (${Math.round(altRate * 100)}%) — próximo: ${nextColor === 'red' ? 'VERMELHO' : 'PRETO'}`,
      strength: Math.round(altRate * 100), type: 'alternation', suggestedNumbers: nums.slice(0, 8),
    });
  }

  // 2. Cycle detection
  for (let n = 0; n <= 36; n++) {
    const positions = h.map((v, i) => v === n ? i : -1).filter(p => p >= 0);
    if (positions.length >= 3) {
      const intervals = positions.slice(0, -1).map((p, i) => positions[i + 1] - p);
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const consistency = 1 - (intervals.reduce((a, v) => a + Math.abs(v - avgInterval), 0) / intervals.length / avgInterval);
      if (consistency > 0.6 && avgInterval <= 20) {
        const roundsSinceLast = positions[0];
        if (roundsSinceLast >= avgInterval * 0.8) {
          patterns.push({
            id: `cycle-${n}`, name: `Ciclo do ${n}`,
            description: `Aparece a cada ~${Math.round(avgInterval)} rodadas (consistência ${Math.round(consistency * 100)}%). Previsto para agora!`,
            strength: Math.round(consistency * 85), type: 'cycle',
            suggestedNumbers: [n, ...getNeighbors(n, 2)],
          });
        }
      }
    }
  }

  // 3. Cluster detection (sector)
  const recent10 = h.slice(0, 10);
  const sectorCounts: Record<string, number> = { voisins: 0, tiers: 0, orphelins: 0 };
  recent10.forEach(n => { const s = getSector(n); if (s !== 'zero') sectorCounts[s]++; });
  const dominantSector = Object.entries(sectorCounts).sort(([,a],[,b]) => b - a)[0];
  if (dominantSector[1] >= 6) {
    const sectorNums = dominantSector[0] === 'voisins' ? Array.from(VOISINS) : dominantSector[0] === 'tiers' ? Array.from(TIERS) : Array.from(ORPHELINS);
    patterns.push({
      id: `cluster-${dominantSector[0]}`, name: `Cluster ${dominantSector[0]}`,
      description: `${dominantSector[1]}/10 últimos números são do setor ${dominantSector[0]} — agrupamento forte!`,
      strength: Math.round((dominantSector[1] / 10) * 90), type: 'cluster',
      suggestedNumbers: sectorNums.slice(0, 8),
    });
  }

  // 4. Recovery after long streak
  const colorSeq = h.map(getColor);
  let streakLen = 1;
  for (let i = 1; i < colorSeq.length; i++) {
    if (colorSeq[i] === colorSeq[0] && colorSeq[0] !== 'green') streakLen++;
    else break;
  }
  if (streakLen >= 5) {
    const oppositeColor = colorSeq[0] === 'red' ? 'black' : 'red';
    const nums = Array.from({ length: 37 }, (_, i) => i).filter(n => getColor(n) === oppositeColor);
    patterns.push({
      id: `recovery-${oppositeColor}`, name: 'Reversão de Streak',
      description: `${streakLen}× ${colorSeq[0] === 'red' ? 'VERMELHO' : 'PRETO'} seguidos — reversão estatística iminente`,
      strength: Math.min(95, 70 + (streakLen - 5) * 5), type: 'recovery',
      suggestedNumbers: nums.slice(0, 8),
    });
  }

  // 5. Terminal pattern
  const terminals = h.slice(0, 15).map(n => n % 10);
  const termCounts: Record<number, number> = {};
  terminals.forEach(t => termCounts[t] = (termCounts[t] || 0) + 1);
  const hotTerminal = Object.entries(termCounts).sort(([,a],[,b]) => b - a)[0];
  if (Number(hotTerminal[1]) >= 4) {
    const termNum = Number(hotTerminal[0]);
    const termNumbers = Array.from({ length: 37 }, (_, i) => i).filter(n => n % 10 === termNum);
    patterns.push({
      id: `terminal-${termNum}`, name: `Terminal ${termNum} Quente`,
      description: `Terminal ${termNum} saiu ${hotTerminal[1]}× nos últimos 15 giros`,
      strength: Math.min(85, 50 + Number(hotTerminal[1]) * 8), type: 'sequence',
      suggestedNumbers: termNumbers,
    });
  }

  // 6. Dozen absence
  const recent15 = h.slice(0, 15);
  for (let dz = 1; dz <= 3; dz++) {
    const dzNums = recent15.filter(n => getDozen(n) === dz);
    if (dzNums.length === 0) {
      const dzNumbers = Array.from({ length: 12 }, (_, i) => (dz - 1) * 12 + i + 1);
      patterns.push({
        id: `absence-dz-${dz}`, name: `${dz}ª Dúzia Ausente`,
        description: `${dz}ª dúzia não apareceu nos últimos 15 giros — retorno provável`,
        strength: 78, type: 'recovery', suggestedNumbers: dzNumbers,
      });
    }
  }

  // 7. Transition pattern — conditional probability
  const transMatrix = buildTransitionMatrix(h);
  if (transMatrix && transMatrix.topTransitions.length > 0) {
    const topTrans = transMatrix.topTransitions.slice(0, 5);
    if (topTrans[0].prob >= 8) { // >8% is significant for a single number
      patterns.push({
        id: `transition-${transMatrix.from}`, name: `Transição do ${transMatrix.from}`,
        description: `Após o ${transMatrix.from}, os mais prováveis: ${topTrans.map(t => `${t.to}(${t.prob}%)`).join(', ')}`,
        strength: Math.min(85, Math.round(topTrans[0].prob * 3)),
        type: 'transition',
        suggestedNumbers: topTrans.map(t => t.to),
      });
    }
  }

  // 8. Pull chain pattern
  if (h.length >= 2) {
    const pullNums = PULL[h[0]] || [];
    if (pullNums.length > 0) {
      // Validate: how often does the pull actually work in recent history?
      let pullWorks = 0;
      let pullChecks = 0;
      for (let i = 0; i < Math.min(h.length - 1, 100); i++) {
        const fromNum = h[i + 1];
        const toNum = h[i];
        const expectedPull = PULL[fromNum] || [];
        if (expectedPull.length > 0) {
          pullChecks++;
          if (expectedPull.includes(toNum)) pullWorks++;
        }
      }
      const pullRate = pullChecks > 0 ? pullWorks / pullChecks : 0;
      if (pullRate > 0.15) { // >15% hit rate on pull is significant
        patterns.push({
          id: `pull-${h[0]}`, name: `Puxada do ${h[0]}`,
          description: `Mesa puxa ${pullNums.slice(0,5).join(',')} após o ${h[0]} (taxa: ${Math.round(pullRate*100)}%)`,
          strength: Math.min(80, Math.round(pullRate * 200)),
          type: 'pull',
          suggestedNumbers: pullNums.slice(0, 6),
        });
      }
    }
  }

  // 9. Statistical debt pattern
  const debtNumbers = calculateStatisticalDebt(h);
  const topDebt = debtNumbers.slice(0, 5);
  if (topDebt.length > 0 && topDebt[0].debt > 2) {
    patterns.push({
      id: 'statistical-debt', name: 'Dívida Estatística',
      description: `Números com maior dívida: ${topDebt.map(d => `${d.number}(-${d.debt.toFixed(1)})`).join(', ')}`,
      strength: Math.min(75, Math.round(topDebt[0].debt * 15)),
      type: 'debt',
      suggestedNumbers: topDebt.map(d => d.number),
    });
  }

  // 10. Fibonacci sequence detection in gaps
  const fibSeq = [1, 1, 2, 3, 5, 8, 13, 21, 34];
  for (let n = 0; n <= 36; n++) {
    const positions = h.map((v, i) => v === n ? i : -1).filter(p => p >= 0);
    if (positions.length >= 3) {
      const intervals = positions.slice(0, -1).map((p, i) => positions[i + 1] - p);
      // Check if intervals match fibonacci
      let fibMatch = 0;
      for (const interval of intervals) {
        if (fibSeq.includes(interval)) fibMatch++;
      }
      if (fibMatch >= 2 && intervals.length <= 5) {
        const nextFib = fibSeq.find(f => f > intervals[0]) || intervals[0];
        if (positions[0] >= nextFib * 0.8) {
          patterns.push({
            id: `fib-${n}`, name: `Fibonacci ${n}`,
            description: `Intervalos de aparição seguem sequência Fibonacci. Próxima aparição prevista!`,
            strength: Math.min(70, 45 + fibMatch * 12),
            type: 'fibonacci',
            suggestedNumbers: [n, ...getNeighbors(n, 1)],
          });
        }
      }
    }
  }

  patterns.sort((a, b) => b.strength - a.strength);
  return patterns.slice(0, 12);
}

// ═══ MODULE 7: TREND ANALYSIS ═══════════════════════════════════════════════

function analyzeTrends(history: number[]): TrendInfo[] {
  const trends: TrendInfo[] = [];
  if (history.length < 20) return trends;

  const analyzeCategoryTrend = (category: string, extractFn: (h: number[]) => number): TrendInfo => {
    const short10 = history.slice(0, 10);
    const short20 = history.slice(0, 20);
    const medium = history.slice(0, Math.min(50, history.length));
    const long = history.slice(0, Math.min(200, history.length));

    const shortVal = extractFn(short10);
    const shortVal2 = extractFn(short20);
    const medVal = extractFn(medium);
    const longVal = extractFn(long);

    const shortTrend: 'up' | 'down' | 'neutral' =
      shortVal > shortVal2 * 1.1 ? 'up' : shortVal < shortVal2 * 0.9 ? 'down' : 'neutral';
    const medTrend: 'up' | 'down' | 'neutral' =
      shortVal2 > medVal * 1.1 ? 'up' : shortVal2 < medVal * 0.9 ? 'down' : 'neutral';
    const longTrend: 'up' | 'down' | 'neutral' =
      medVal > longVal * 1.05 ? 'up' : medVal < longVal * 0.95 ? 'down' : 'neutral';

    const momentum = longVal > 0 ? Math.round(((shortVal - longVal) / longVal) * 100) : 0;
    const reversalRisk = Math.min(100, Math.abs(momentum) * 1.5);

    return { category, shortTerm: shortTrend, mediumTerm: medTrend, longTerm: longTrend, momentum: Math.max(-100, Math.min(100, momentum)), reversalRisk: Math.round(reversalRisk) };
  };

  trends.push(analyzeCategoryTrend('Vermelho', (h) => h.filter(n => RED.has(n)).length / Math.max(1, h.length) * 100));
  trends.push(analyzeCategoryTrend('Par', (h) => h.filter(n => n > 0 && n % 2 === 0).length / Math.max(1, h.filter(n => n > 0).length) * 100));
  trends.push(analyzeCategoryTrend('Alto (19-36)', (h) => h.filter(n => n >= 19).length / Math.max(1, h.length) * 100));
  trends.push(analyzeCategoryTrend('Média Numérica', (h) => h.length > 0 ? h.reduce((a, b) => a + b, 0) / h.length : 18));

  // Sector trend
  trends.push(analyzeCategoryTrend('Voisins', (h) => h.filter(n => VOISINS.has(n)).length / Math.max(1, h.length) * 100));
  trends.push(analyzeCategoryTrend('Tiers', (h) => h.filter(n => TIERS.has(n)).length / Math.max(1, h.length) * 100));

  return trends;
}

// ═══ MODULE 8: CONFIDENCE INDICATORS ════════════════════════════════════════

function calculateConfidence(
  stats: ReturnType<typeof analyzeStatistics>,
  patterns: PatternDetection[],
  trends: TrendInfo[],
  multiWindow: { window: number; topNumbers: number[]; agreement: number }[],
) {
  if (!stats) return { overallConfidence: 0, recentAccuracy: 0, patternStrength: 0, dataConsistency: 0 };

  const topPatterns = patterns.slice(0, 3);
  const patternStrength = topPatterns.length > 0
    ? Math.round(topPatterns.reduce((a, p) => a + p.strength, 0) / topPatterns.length)
    : 30;

  const dataConsistency = Math.max(20, Math.min(95, 100 - stats.volatilityIndex));

  const trendAgreement = trends.filter(t => t.shortTerm !== 'neutral').length;
  const trendBonus = Math.min(20, trendAgreement * 5);

  // Multi-window agreement bonus
  const avgAgreement = multiWindow.length > 0
    ? multiWindow.reduce((a, w) => a + w.agreement, 0) / multiWindow.length
    : 0;
  const multiWindowBonus = Math.min(15, avgAgreement / 100 * 15);

  const overallConfidence = Math.round(
    patternStrength * 0.35 +
    dataConsistency * 0.25 +
    trendBonus +
    multiWindowBonus +
    (stats.streaks.length > 0 ? 10 : 0)
  );

  return {
    overallConfidence: Math.min(95, Math.max(15, overallConfidence)),
    recentAccuracy: patternStrength,
    patternStrength,
    dataConsistency,
  };
}

// ═══ MODULE 9: RISK MANAGEMENT ══════════════════════════════════════════════

function assessRisk(stats: ReturnType<typeof analyzeStatistics>, confidence: number): RiskAssessment {
  if (!stats) return {
    suggestion: 'CONSERVADORA', betSizeMultiplier: 0.5, stopLossAlert: false,
    dangerousSequence: false, martingaleLevel: 0, kellyFraction: 0.02,
  };

  const longestStreak = stats.streaks.reduce((max, s) => Math.max(max, s.length), 0);
  const dangerousSequence = longestStreak >= 7;
  const dangerReason = dangerousSequence ? `Streak de ${longestStreak}× detectado — cuidado com martingale` : undefined;
  const stopLossAlert = stats.volatilityIndex > 80;

  const edgeEstimate = Math.max(0, (confidence - 50) / 100);
  const kellyFraction = Math.round(edgeEstimate * 100) / 100;

  let suggestion: RiskAssessment['suggestion'] = 'MODERADA';
  let betSizeMultiplier = 1.0;
  let martingaleLevel = 0;

  if (confidence >= 75 && stats.volatilityIndex < 60) {
    suggestion = 'AGRESSIVA';
    betSizeMultiplier = 1.5;
    martingaleLevel = dangerousSequence ? 0 : 2;
  } else if (confidence < 50 || stats.volatilityIndex > 70) {
    suggestion = 'CONSERVADORA';
    betSizeMultiplier = 0.5;
    martingaleLevel = 0;
  } else {
    martingaleLevel = dangerousSequence ? 0 : 1;
  }

  return { suggestion, betSizeMultiplier, stopLossAlert, dangerousSequence, dangerReason, martingaleLevel, kellyFraction };
}

// ═══ LEGACY SIGNALS ════════════════════════════════════════════════════════

export function analyzeSpins(history: number[]): EngineSignal[] {
  const h = history.slice(0, 50);
  if (h.length < 5) return [];

  const signals: EngineSignal[] = [];
  const colors = h.map(getColor);
  let colorStreak = 1;
  for (let i = 1; i < colors.length; i++) {
    if (colors[i] === colors[0] && colors[0] !== 'green') colorStreak++;
    else break;
  }
  if (colorStreak >= 5) {
    const opposite = colors[0] === 'red' ? 'black' : 'red';
    signals.push({
      id: `streak-color-${opposite}`, type: 'streak_break',
      action: `ENTRAR NO ${opposite === 'red' ? 'VERMELHO' : 'PRETO'}`, actionColor: opposite,
      confidence: Math.min(95, 75 + (colorStreak - 5) * 5),
      detail: `${colors[0] === 'red' ? 'Vermelho' : 'Preto'} saiu ${colorStreak}× — quebra iminente`,
      protection: '🛡️ Cobrir o Zero', urgency: colorStreak >= 7 ? 'high' : 'medium', streakLength: colorStreak,
    });
  }
  
  for (let dz = 1; dz <= 3; dz++) {
    let absence = 0;
    for (const n of h) {
      if (n === 0) { absence++; continue; }
      if (getDozen(n) === dz) break;
      absence++;
    }
    if (absence >= 7) {
      signals.push({
        id: `cold-dozen-${dz}`, type: 'cold_dozen',
        action: `ENTRAR NA ${dz}ª DÚZIA`, actionColor: 'dozen',
        confidence: Math.min(88, 65 + Math.min(absence - 7, 8) * 3),
        detail: `${dz}ª Dúzia ausente há ${absence} rodadas`,
        protection: '🛡️ Cobrir o Zero', urgency: absence >= 12 ? 'high' : 'medium', absentRounds: absence,
      });
    }
  }
  
  signals.sort((a, b) => b.confidence - a.confidence);
  return signals;
}

// ═══ TOP 5 CONVERGENCE (ENHANCED) ══════════════════════════════════════════

function computeTop5(
  stats: ReturnType<typeof analyzeStatistics>,
  patterns: PatternDetection[],
  gaps: GapInfo[],
  transitionMatrix: TransitionData | null,
  pullChain: { number: number; pullScore: number }[],
  multiWindow: { window: number; topNumbers: number[]; agreement: number }[],
  debtData: { number: number; debt: number; expected: number; actual: number }[],
): { number: number; score: number; sources: string[] }[] {
  if (!stats) return [];

  const scores: Record<number, { score: number; sources: Set<string> }> = {};
  const add = (n: number, pts: number, source: string) => {
    if (n < 0 || n > 36) return;
    if (!scores[n]) scores[n] = { score: 0, sources: new Set() };
    scores[n].score += pts;
    scores[n].sources.add(source);
  };

  // Source 1: Hot frequencies
  stats.frequencies.filter(f => f.isHot).forEach(f => add(f.number, 3 + f.deviation, 'Frequência'));

  // Source 2: Overdue gaps (mean reversion)
  gaps.filter(g => g.overdue).sort((a, b) => b.gap - a.gap).slice(0, 10).forEach(g => {
    add(g.number, 2 + (g.gap / g.averageGap), 'Gap/Atraso');
  });

  // Source 3: Pattern suggestions
  patterns.forEach(p => {
    const weight = p.strength / 100 * 3;
    p.suggestedNumbers.slice(0, 5).forEach((n, i) => add(n, weight * (1 - i * 0.15), p.name));
  });

  // Source 4: Anti-Streak
  stats.streaks.filter(s => s.active && s.length >= 4).forEach(s => {
    if (s.type === 'cor') {
      const counterColor = s.value === 'red' ? 'black' : 'red';
      Array.from({ length: 37 }, (_, i) => i).filter(n => getColor(n) === counterColor)
        .forEach(n => add(n, 1.5, 'Anti-Streak'));
    }
  });

  // Source 5: Sector bonus
  const secs = stats.sectorDistribution;
  const hotSector = Object.entries(secs).sort(([,a],[,b]) => b - a)[0][0];
  const sectorSet = hotSector === 'voisins' ? VOISINS : hotSector === 'tiers' ? TIERS : ORPHELINS;
  sectorSet.forEach(n => add(n, 1, 'Setor'));

  // Source 6: Transition matrix
  if (transitionMatrix) {
    transitionMatrix.topTransitions.slice(0, 5).forEach((t, i) => {
      add(t.to, (t.prob / 10) * (1 - i * 0.1), 'Transição');
    });
  }

  // Source 7: Pull chain
  pullChain.slice(0, 6).forEach((p, i) => {
    add(p.number, p.pullScore * (1 - i * 0.1), 'Puxada');
  });

  // Source 8: Multi-window consensus
  const windowConsensus: Record<number, number> = {};
  multiWindow.forEach(w => {
    w.topNumbers.forEach(n => {
      windowConsensus[n] = (windowConsensus[n] || 0) + 1;
    });
  });
  Object.entries(windowConsensus).forEach(([n, count]) => {
    if (count >= 3) { // appears in 3+ windows
      add(Number(n), count * 0.8, 'Multi-Janela');
    }
  });

  // Source 9: Statistical debt
  debtData.slice(0, 8).forEach((d, i) => {
    add(d.number, d.debt * 0.5 * (1 - i * 0.08), 'Dívida');
  });

  return Object.entries(scores)
    .map(([n, data]) => ({ number: Number(n), score: Math.round(data.score * 10) / 10, sources: Array.from(data.sources) }))
    .sort((a, b) => b.score - a.score)
    .filter(item => item.sources.length >= 2)
    .slice(0, 5);
}

// ═══ HELPER ═════════════════════════════════════════════════════════════════

function getNeighbors(n: number, distance: number): number[] {
  const idx = WHEEL.indexOf(n);
  if (idx === -1) return [];
  const neighbors: number[] = [];
  for (let d = 1; d <= distance; d++) {
    neighbors.push(WHEEL[(idx + d) % WHEEL.length]);
    neighbors.push(WHEEL[(idx - d + WHEEL.length) % WHEEL.length]);
  }
  return neighbors;
}

// ═══ MAIN EXPORT ════════════════════════════════════════════════════════════

export function runFullAnalysis(history: number[]): FullAnalysis | null {
  if (history.length < 10) return null;

  const stats = analyzeStatistics(history);
  if (!stats) return null;

  const patterns = detectPatterns(history);
  const trends = analyzeTrends(history);
  const transitionMatrix = buildTransitionMatrix(history);
  const multiWindow = multiWindowValidation(history);
  const debtData = calculateStatisticalDebt(history);
  const pullChain = calculatePullChainScore(history);
  const confidence = calculateConfidence(stats, patterns, trends, multiWindow);
  const risk = assessRisk(stats, confidence.overallConfidence);
  const signals = analyzeSpins(history);
  const top5 = computeTop5(stats, patterns, stats.gaps, transitionMatrix, pullChain, multiWindow, debtData);

  const topPattern = patterns[0]?.name || 'Nenhum forte';
  const trendSummary = trends.length > 0
    ? (trends[0].shortTerm === 'up' ? 'ALTA' : trends[0].shortTerm === 'down' ? 'BAIXA' : 'NEUTRA')
    : 'NEUTRA';

  const prediction = {
    previsao: top5.length > 0 ? `TOP5: [${top5.map(t => t.number).join(', ')}]` : 'Dados insuficientes',
    confianca: confidence.overallConfidence,
    padroes_detectados: patterns.slice(0, 5).map(p => p.name),
    tendencia_atual: trendSummary,
    sugestao_aposta: risk.suggestion,
    alerta: risk.dangerReason || (risk.stopLossAlert ? '⚠️ Volatilidade alta — considere pausar' : null),
  };

  return {
    ...stats,
    patterns,
    trends,
    ...confidence,
    risk,
    signals,
    top5,
    transitionMatrix,
    multiWindowValidation: multiWindow,
    statisticalDebt: debtData,
    pullChainScore: pullChain,
    prediction,
  };
}
