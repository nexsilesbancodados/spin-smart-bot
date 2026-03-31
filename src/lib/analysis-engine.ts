/**
 * AnalysisEngine — Complete statistical analysis system for roulette
 * Modules: Statistics, Patterns, Trends, Confidence, Risk Management
 */

const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const WHEEL = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const VOISINS = new Set([22,18,29,7,28,12,35,3,26,0,32,15,19,4,21,2,25]);
const TIERS = new Set([27,13,36,11,30,8,23,10,5,24,16,33]);
const ORPHELINS = new Set([1,20,14,31,9,17,34,6]);

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
  deviation: number; // how many std devs from expected
  lastSeen: number;  // rounds ago
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
}

export interface TrendInfo {
  category: string;
  shortTerm: 'up' | 'down' | 'neutral';   // last 10-20
  mediumTerm: 'up' | 'down' | 'neutral';  // last 50
  longTerm: 'up' | 'down' | 'neutral';    // last 200+
  momentum: number; // -100 to +100
  reversalRisk: number; // 0-100
}

export interface PatternDetection {
  id: string;
  name: string;
  description: string;
  strength: number; // 0-100
  type: 'alternation' | 'cycle' | 'cluster' | 'temporal' | 'recovery' | 'sequence';
  suggestedNumbers: number[];
}

export interface RiskAssessment {
  suggestion: 'CONSERVADORA' | 'MODERADA' | 'AGRESSIVA';
  betSizeMultiplier: number; // 0.5 to 2.0
  stopLossAlert: boolean;
  dangerousSequence: boolean;
  dangerReason?: string;
  martingaleLevel: number; // 0 = don't, 1-3 = controlled levels
  kellyFraction: number;
}

export interface FullAnalysis {
  // Module 1: Stats
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

  // Module 2: Patterns
  patterns: PatternDetection[];

  // Module 3: Trends
  trends: TrendInfo[];

  // Module 4: Confidence
  overallConfidence: number;
  recentAccuracy: number;
  patternStrength: number;
  dataConsistency: number;

  // Module 5: Risk
  risk: RiskAssessment;

  // Legacy signals
  signals: EngineSignal[];

  // Final output: TOP 5 convergence
  top5: { number: number; score: number; sources: string[] }[];

  // Formatted output
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

  // Frequency of each number
  const freq: Record<number, number> = {};
  for (let i = 0; i <= 36; i++) freq[i] = 0;
  h.forEach(n => freq[n]++);
  const expected = total / 37;
  
  // Standard deviation of frequencies
  const freqValues = Object.values(freq);
  const mean = freqValues.reduce((a, b) => a + b, 0) / freqValues.length;
  const variance = freqValues.reduce((a, v) => a + (v - mean) ** 2, 0) / freqValues.length;
  const stdDev = Math.sqrt(variance);

  // Number frequencies with deviation
  const frequencies: NumberFrequency[] = [];
  for (let n = 0; n <= 36; n++) {
    const count = freq[n];
    const deviation = stdDev > 0 ? (count - expected) / stdDev : 0;
    const lastSeen = h.indexOf(n);
    frequencies.push({
      number: n,
      count,
      expected: Math.round(expected * 10) / 10,
      deviation: Math.round(deviation * 100) / 100,
      lastSeen: lastSeen === -1 ? total : lastSeen,
      isHot: count > expected * 1.4,
      isCold: count < expected * 0.6,
    });
  }

  // Color distribution
  const colorDist = { red: 0, black: 0, green: 0 };
  h.forEach(n => colorDist[getColor(n)]++);

  // Parity
  const nonZero = h.filter(n => n > 0);
  const even = nonZero.filter(n => n % 2 === 0).length;
  const odd = nonZero.filter(n => n % 2 === 1).length;

  // High/Low
  const high = h.filter(n => n >= 19).length;
  const low = h.filter(n => n >= 1 && n <= 18).length;

  // Dozen
  const dz: [number, number, number] = [0, 0, 0];
  h.forEach(n => { if (n >= 1 && n <= 12) dz[0]++; else if (n <= 24 && n > 12) dz[1]++; else if (n > 24) dz[2]++; });

  // Column
  const col: [number, number, number] = [0, 0, 0];
  h.filter(n => n > 0).forEach(n => col[((n - 1) % 3)]++);

  // Sector
  const sec = { voisins: 0, tiers: 0, orphelins: 0 };
  h.forEach(n => { const s = getSector(n); if (s !== 'zero') sec[s as keyof typeof sec]++; });

  // Volatility index: coefficient of variation of recent vs expected
  const recent20 = h.slice(0, 20);
  const recent20Freq: Record<number, number> = {};
  recent20.forEach(n => recent20Freq[n] = (recent20Freq[n] || 0) + 1);
  const r20Values = Object.values(recent20Freq);
  const r20Mean = r20Values.length > 0 ? r20Values.reduce((a, b) => a + b, 0) / r20Values.length : 0;
  const r20Var = r20Values.length > 0 ? r20Values.reduce((a, v) => a + (v - r20Mean) ** 2, 0) / r20Values.length : 0;
  const volatility = r20Mean > 0 ? Math.round(Math.sqrt(r20Var) / r20Mean * 100) : 50;

  // Moving average (of number values, last 20)
  const movingAvg = recent20.length > 0 ? Math.round(recent20.reduce((a, b) => a + b, 0) / recent20.length * 10) / 10 : 18;

  // Streaks
  const streaks: StreakInfo[] = [];
  // Color streaks
  const colors = h.map(getColor);
  let cStreak = 1;
  for (let i = 1; i < Math.min(colors.length, 50); i++) {
    if (colors[i] === colors[0] && colors[0] !== 'green') cStreak++;
    else break;
  }
  if (cStreak >= 3) streaks.push({ type: 'cor', value: colors[0], length: cStreak, active: true });
  
  // Parity streaks
  const parities = h.filter(n => n > 0).map(n => n % 2 === 0 ? 'par' : 'ímpar');
  let pStreak = 1;
  for (let i = 1; i < Math.min(parities.length, 30); i++) {
    if (parities[i] === parities[0]) pStreak++;
    else break;
  }
  if (pStreak >= 3) streaks.push({ type: 'paridade', value: parities[0], length: pStreak, active: true });

  // High/Low streaks
  const hlSeq = h.filter(n => n > 0).map(n => n >= 19 ? 'alto' : 'baixo');
  let hlStreak = 1;
  for (let i = 1; i < Math.min(hlSeq.length, 30); i++) {
    if (hlSeq[i] === hlSeq[0]) hlStreak++;
    else break;
  }
  if (hlStreak >= 3) streaks.push({ type: 'alto/baixo', value: hlSeq[0], length: hlStreak, active: true });

  // Gaps (rounds since last seen)
  const gaps: GapInfo[] = [];
  for (let n = 0; n <= 36; n++) {
    const positions = h.map((v, i) => v === n ? i : -1).filter(p => p >= 0);
    const gap = positions.length > 0 ? positions[0] : total;
    const avgGap = positions.length > 1
      ? positions.slice(0, -1).reduce((acc, p, i) => acc + (positions[i + 1] - p), 0) / (positions.length - 1)
      : 37;
    gaps.push({ number: n, gap, averageGap: Math.round(avgGap * 10) / 10, overdue: gap > avgGap * 1.5 });
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

// ═══ MODULE 2: PATTERN DETECTION ════════════════════════════════════════════

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
      id: 'alt-color',
      name: 'Alternância de Cor',
      description: `Padrão de alternância ativo (${Math.round(altRate * 100)}%) — próximo: ${nextColor === 'red' ? 'VERMELHO' : 'PRETO'}`,
      strength: Math.round(altRate * 100),
      type: 'alternation',
      suggestedNumbers: nums.slice(0, 8),
    });
  }

  // 2. Cycle detection (same number repeating at intervals)
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
            id: `cycle-${n}`,
            name: `Ciclo do ${n}`,
            description: `Aparece a cada ~${Math.round(avgInterval)} rodadas (consistência ${Math.round(consistency * 100)}%). Previsto para agora!`,
            strength: Math.round(consistency * 85),
            type: 'cycle',
            suggestedNumbers: [n, ...getNeighbors(n, 2)],
          });
        }
      }
    }
  }

  // 3. Cluster detection (numbers from same sector appearing together)
  const recent10 = h.slice(0, 10);
  const sectorCounts: Record<string, number> = { voisins: 0, tiers: 0, orphelins: 0 };
  recent10.forEach(n => { const s = getSector(n); if (s !== 'zero') sectorCounts[s]++; });
  const dominantSector = Object.entries(sectorCounts).sort(([,a],[,b]) => b - a)[0];
  if (dominantSector[1] >= 6) {
    const sectorNums = dominantSector[0] === 'voisins' ? Array.from(VOISINS)
      : dominantSector[0] === 'tiers' ? Array.from(TIERS) : Array.from(ORPHELINS);
    patterns.push({
      id: `cluster-${dominantSector[0]}`,
      name: `Cluster ${dominantSector[0]}`,
      description: `${dominantSector[1]}/10 últimos números são do setor ${dominantSector[0]} — agrupamento forte!`,
      strength: Math.round((dominantSector[1] / 10) * 90),
      type: 'cluster',
      suggestedNumbers: sectorNums.slice(0, 8),
    });
  }

  // 4. Recovery after long streak (mean reversion)
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
      id: `recovery-${oppositeColor}`,
      name: 'Reversão de Streak',
      description: `${streakLen}× ${colorSeq[0] === 'red' ? 'VERMELHO' : 'PRETO'} seguidos — reversão estatística iminente`,
      strength: Math.min(95, 70 + (streakLen - 5) * 5),
      type: 'recovery',
      suggestedNumbers: nums.slice(0, 8),
    });
  }

  // 5. Terminal pattern (same terminal digit repeating)
  const terminals = h.slice(0, 15).map(n => n % 10);
  const termCounts: Record<number, number> = {};
  terminals.forEach(t => termCounts[t] = (termCounts[t] || 0) + 1);
  const hotTerminal = Object.entries(termCounts).sort(([,a],[,b]) => b - a)[0];
  if (Number(hotTerminal[1]) >= 4) {
    const termNum = Number(hotTerminal[0]);
    const termNumbers = Array.from({ length: 37 }, (_, i) => i).filter(n => n % 10 === termNum);
    patterns.push({
      id: `terminal-${termNum}`,
      name: `Terminal ${termNum} Quente`,
      description: `Terminal ${termNum} saiu ${hotTerminal[1]}× nos últimos 15 giros`,
      strength: Math.min(85, 50 + Number(hotTerminal[1]) * 8),
      type: 'sequence',
      suggestedNumbers: termNumbers,
    });
  }

  // 6. Dozen absence pattern
  const recent15 = h.slice(0, 15);
  for (let dz = 1; dz <= 3; dz++) {
    const dzNums = recent15.filter(n => getDozen(n) === dz);
    if (dzNums.length === 0) {
      const dzNumbers = Array.from({ length: 12 }, (_, i) => (dz - 1) * 12 + i + 1);
      patterns.push({
        id: `absence-dz-${dz}`,
        name: `${dz}ª Dúzia Ausente`,
        description: `${dz}ª dúzia não apareceu nos últimos 15 giros — retorno provável`,
        strength: 78,
        type: 'recovery',
        suggestedNumbers: dzNumbers,
      });
    }
  }

  patterns.sort((a, b) => b.strength - a.strength);
  return patterns.slice(0, 8);
}

// ═══ MODULE 3: TREND ANALYSIS ═══════════════════════════════════════════════

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

    // Momentum: how much short term differs from long term (-100 to 100)
    const momentum = longVal > 0 ? Math.round(((shortVal - longVal) / longVal) * 100) : 0;

    // Reversal risk: high if short term is very different from long term
    const reversalRisk = Math.min(100, Math.abs(momentum) * 1.5);

    return { category, shortTerm: shortTrend, mediumTerm: medTrend, longTerm: longTrend, momentum: Math.max(-100, Math.min(100, momentum)), reversalRisk: Math.round(reversalRisk) };
  };

  // Red rate trend
  trends.push(analyzeCategoryTrend('Vermelho', (h) => h.filter(n => RED.has(n)).length / Math.max(1, h.length) * 100));
  // Even rate
  trends.push(analyzeCategoryTrend('Par', (h) => h.filter(n => n > 0 && n % 2 === 0).length / Math.max(1, h.filter(n => n > 0).length) * 100));
  // High rate
  trends.push(analyzeCategoryTrend('Alto (19-36)', (h) => h.filter(n => n >= 19).length / Math.max(1, h.length) * 100));
  // Average number
  trends.push(analyzeCategoryTrend('Média Numérica', (h) => h.length > 0 ? h.reduce((a, b) => a + b, 0) / h.length : 18));

  return trends;
}

// ═══ MODULE 4: CONFIDENCE INDICATORS ════════════════════════════════════════

function calculateConfidence(stats: ReturnType<typeof analyzeStatistics>, patterns: PatternDetection[], trends: TrendInfo[]) {
  if (!stats) return { overallConfidence: 0, recentAccuracy: 0, patternStrength: 0, dataConsistency: 0 };

  // Pattern strength: average of top 3 patterns
  const topPatterns = patterns.slice(0, 3);
  const patternStrength = topPatterns.length > 0
    ? Math.round(topPatterns.reduce((a, p) => a + p.strength, 0) / topPatterns.length)
    : 30;

  // Data consistency: how well distributed are the numbers (lower variance = more consistent)
  const dataConsistency = Math.max(20, Math.min(95, 100 - stats.volatilityIndex));

  // Trend agreement: do trends align?
  const trendAgreement = trends.filter(t => t.shortTerm !== 'neutral').length;
  const trendBonus = Math.min(20, trendAgreement * 5);

  // Overall confidence
  const overallConfidence = Math.round(
    patternStrength * 0.4 +
    dataConsistency * 0.3 +
    trendBonus +
    (stats.streaks.length > 0 ? 10 : 0)
  );

  return {
    overallConfidence: Math.min(95, Math.max(15, overallConfidence)),
    recentAccuracy: patternStrength,
    patternStrength,
    dataConsistency,
  };
}

// ═══ MODULE 5: RISK MANAGEMENT ══════════════════════════════════════════════

function assessRisk(stats: ReturnType<typeof analyzeStatistics>, confidence: number): RiskAssessment {
  if (!stats) return {
    suggestion: 'CONSERVADORA', betSizeMultiplier: 0.5, stopLossAlert: false,
    dangerousSequence: false, martingaleLevel: 0, kellyFraction: 0.02,
  };

  // Check for dangerous sequences
  const longestStreak = stats.streaks.reduce((max, s) => Math.max(max, s.length), 0);
  const dangerousSequence = longestStreak >= 7;
  const dangerReason = dangerousSequence ? `Streak de ${longestStreak}× detectado — cuidado com martingale` : undefined;

  // Stop loss alert: if volatility is very high
  const stopLossAlert = stats.volatilityIndex > 80;

  // Kelly fraction: f = (bp - q) / b where b = payout, p = probability, q = 1-p
  // For even money bets: b = 1, so f = p - q = 2p - 1
  // We use confidence as proxy for edge
  const edgeEstimate = Math.max(0, (confidence - 50) / 100);
  const kellyFraction = Math.round(edgeEstimate * 100) / 100;

  // Bet suggestion based on confidence and volatility
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

// ═══ LEGACY SIGNALS (kept for backward compat) ══════════════════════════════

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

// ═══ TOP 5 CONVERGENCE ══════════════════════════════════════════════════════

function computeTop5(
  stats: ReturnType<typeof analyzeStatistics>,
  patterns: PatternDetection[],
  gaps: GapInfo[],
): { number: number; score: number; sources: string[] }[] {
  if (!stats) return [];

  const scores: Record<number, { score: number; sources: Set<string> }> = {};
  const add = (n: number, pts: number, source: string) => {
    if (n < 0 || n > 36) return;
    if (!scores[n]) scores[n] = { score: 0, sources: new Set() };
    scores[n].score += pts;
    scores[n].sources.add(source);
  };

  // From hot frequencies
  stats.frequencies.filter(f => f.isHot).forEach(f => add(f.number, 3 + f.deviation, 'Frequência'));

  // From overdue gaps (mean reversion)
  gaps.filter(g => g.overdue).sort((a, b) => b.gap - a.gap).slice(0, 10).forEach(g => {
    add(g.number, 2 + (g.gap / g.averageGap), 'Gap/Atraso');
  });

  // From pattern suggestions
  patterns.forEach(p => {
    const weight = p.strength / 100 * 3;
    p.suggestedNumbers.slice(0, 5).forEach((n, i) => add(n, weight * (1 - i * 0.15), p.name));
  });

  // From streaks (counter-bet)
  stats.streaks.filter(s => s.active && s.length >= 4).forEach(s => {
    if (s.type === 'cor') {
      const counterColor = s.value === 'red' ? 'black' : 'red';
      Array.from({ length: 37 }, (_, i) => i).filter(n => getColor(n) === counterColor)
        .forEach(n => add(n, 1.5, 'Anti-Streak'));
    }
  });

  // Sector bonus: numbers in dominant sector get a small bonus
  const secs = stats.sectorDistribution;
  const hotSector = Object.entries(secs).sort(([,a],[,b]) => b - a)[0][0];
  const sectorSet = hotSector === 'voisins' ? VOISINS : hotSector === 'tiers' ? TIERS : ORPHELINS;
  sectorSet.forEach(n => add(n, 1, 'Setor'));

  return Object.entries(scores)
    .map(([n, data]) => ({ number: Number(n), score: Math.round(data.score * 10) / 10, sources: Array.from(data.sources) }))
    .sort((a, b) => b.score - a.score)
    .filter(item => item.sources.length >= 2) // at least 2 sources agree
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
  const confidence = calculateConfidence(stats, patterns, trends);
  const risk = assessRisk(stats, confidence.overallConfidence);
  const signals = analyzeSpins(history);
  const top5 = computeTop5(stats, patterns, stats.gaps);

  // Build prediction object
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
    prediction,
  };
}