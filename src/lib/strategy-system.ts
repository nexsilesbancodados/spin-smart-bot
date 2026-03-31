/**
 * SmartStrategySystem — 6 betting strategies with auto-selection
 * Martingale (safe), Fibonacci, Kelly Criterion, Momentum, Mean Reversion, Statistical Arbitrage
 */

export type StrategyId = 'martingale_safe' | 'fibonacci' | 'kelly_criterion' | 'momentum' | 'mean_reversion' | 'statistical_arbitrage';

export interface StrategyResult {
  id: StrategyId;
  name: string;
  emoji: string;
  betMultiplier: number;    // multiplier on base bet
  confidence: number;       // 0-100
  action: 'bet' | 'increase' | 'decrease' | 'wait' | 'reset';
  reason: string;
  suggestedNumbers: number[];
  riskLevel: 'low' | 'medium' | 'high';
}

export interface BetHistoryEntry {
  won: boolean;
  amount: number;
  profit: number;
  timestamp: number;
}

export interface StrategyConfig {
  balance: number;
  baseBet: number;
  history: BetHistoryEntry[];
  allNumbers: number[];  // roulette results
  winProbability?: number;
  odds?: number;
}

const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const WHEEL = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];

function countConsecutiveLosses(history: BetHistoryEntry[]): number {
  let count = 0;
  for (const h of history) {
    if (!h.won) count++;
    else break;
  }
  return count;
}

function countConsecutiveWins(history: BetHistoryEntry[]): number {
  let count = 0;
  for (const h of history) {
    if (h.won) count++;
    else break;
  }
  return count;
}

function getRecentWinRate(history: BetHistoryEntry[], window = 10): number {
  const recent = history.slice(0, window);
  if (recent.length === 0) return 0.5;
  return recent.filter(h => h.won).length / recent.length;
}

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

// ═══ STRATEGIES ═════════════════════════════════════════════════════════════

function martingaleSafe(cfg: StrategyConfig): StrategyResult {
  const MAX_LOSSES = 5;
  const MAX_BET_RATIO = 0.1; // max 10% of balance
  const losses = countConsecutiveLosses(cfg.history);

  let multiplier: number;
  let action: StrategyResult['action'];
  let reason: string;

  if (losses >= MAX_LOSSES) {
    multiplier = 1;
    action = 'reset';
    reason = `${losses} perdas seguidas — reset para aposta base (proteção)`;
  } else if (losses > 0) {
    multiplier = Math.pow(2, losses);
    const maxAllowed = cfg.balance * MAX_BET_RATIO / cfg.baseBet;
    multiplier = Math.min(multiplier, maxAllowed);
    action = 'increase';
    reason = `${losses} perda(s) — dobrar aposta (Martingale nível ${losses})`;
  } else {
    multiplier = 1;
    action = 'bet';
    reason = 'Sem perdas recentes — aposta base';
  }

  // Suggest hot numbers from recent results
  const freq: Record<number, number> = {};
  cfg.allNumbers.slice(0, 30).forEach(n => freq[n] = (freq[n] || 0) + 1);
  const suggested = Object.entries(freq).sort(([,a],[,b]) => b - a).slice(0, 5).map(([n]) => Number(n));

  return {
    id: 'martingale_safe',
    name: 'Martingale Seguro',
    emoji: '🔄',
    betMultiplier: multiplier,
    confidence: losses < 3 ? 70 : losses < 5 ? 50 : 30,
    action,
    reason,
    suggestedNumbers: suggested,
    riskLevel: losses >= 3 ? 'high' : losses >= 1 ? 'medium' : 'low',
  };
}

function fibonacciStrategy(cfg: StrategyConfig): StrategyResult {
  const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55];
  const losses = countConsecutiveLosses(cfg.history);
  const level = Math.min(losses, FIB.length - 1);
  const multiplier = FIB[level];

  const freq: Record<number, number> = {};
  cfg.allNumbers.slice(0, 30).forEach(n => freq[n] = (freq[n] || 0) + 1);
  const suggested = Object.entries(freq).sort(([,a],[,b]) => b - a).slice(0, 5).map(([n]) => Number(n));

  return {
    id: 'fibonacci',
    name: 'Fibonacci',
    emoji: '🌀',
    betMultiplier: multiplier,
    confidence: level < 4 ? 65 : level < 7 ? 45 : 25,
    action: losses === 0 ? 'bet' : 'increase',
    reason: `Fibonacci nível ${level} (×${multiplier}) — ${losses === 0 ? 'posição base' : `${losses} perda(s)`}`,
    suggestedNumbers: suggested,
    riskLevel: level >= 5 ? 'high' : level >= 2 ? 'medium' : 'low',
  };
}

function kellyCriterion(cfg: StrategyConfig): StrategyResult {
  const p = cfg.winProbability ?? getRecentWinRate(cfg.history);
  const b = cfg.odds ?? 35; // roulette payout
  const q = 1 - p;

  let f = (p * b - q) / b;
  f = f * 0.25; // quarter Kelly for safety
  f = Math.max(0, Math.min(f, 0.1)); // cap at 10%

  const betAmount = cfg.balance * f;
  const multiplier = cfg.baseBet > 0 ? betAmount / cfg.baseBet : 1;

  return {
    id: 'kelly_criterion',
    name: 'Kelly Criterion',
    emoji: '📐',
    betMultiplier: Math.max(0.5, Math.min(multiplier, 5)),
    confidence: Math.round(p * 100),
    action: f > 0.02 ? 'bet' : 'wait',
    reason: `Kelly f=${(f * 100).toFixed(1)}% — ${f > 0.02 ? 'edge positivo' : 'sem edge — esperar'}`,
    suggestedNumbers: [],
    riskLevel: f > 0.05 ? 'high' : f > 0.02 ? 'medium' : 'low',
  };
}

function momentumStrategy(cfg: StrategyConfig): StrategyResult {
  const WINDOW = 10;
  const recentWR = getRecentWinRate(cfg.history, WINDOW);
  const consWins = countConsecutiveWins(cfg.history);

  let multiplier = 1;
  let action: StrategyResult['action'] = 'bet';
  let reason: string;

  if (recentWR > 0.7) {
    multiplier = 1.5;
    action = 'increase';
    reason = `Momentum alto! WR ${Math.round(recentWR * 100)}% — aumentar aposta`;
  } else if (recentWR < 0.3) {
    multiplier = 0.5;
    action = 'decrease';
    reason = `Momentum baixo (WR ${Math.round(recentWR * 100)}%) — reduzir aposta`;
  } else {
    reason = `Momentum neutro (WR ${Math.round(recentWR * 100)}%) — manter`;
  }

  // Suggest numbers that appeared in winning bets
  const winNums = cfg.allNumbers.slice(0, 20);
  const freq: Record<number, number> = {};
  winNums.forEach(n => freq[n] = (freq[n] || 0) + 1);
  const suggested = Object.entries(freq).sort(([,a],[,b]) => b - a).slice(0, 5).map(([n]) => Number(n));

  return {
    id: 'momentum',
    name: 'Momentum',
    emoji: '🚀',
    betMultiplier: multiplier,
    confidence: Math.round(Math.max(recentWR, 1 - recentWR) * 100),
    action,
    reason,
    suggestedNumbers: suggested,
    riskLevel: recentWR > 0.7 ? 'medium' : recentWR < 0.3 ? 'low' : 'low',
  };
}

function meanReversionStrategy(cfg: StrategyConfig): StrategyResult {
  const recent = cfg.allNumbers.slice(0, 50);
  if (recent.length < 10) {
    return {
      id: 'mean_reversion', name: 'Mean Reversion', emoji: '🔁',
      betMultiplier: 1, confidence: 30, action: 'wait',
      reason: 'Dados insuficientes', suggestedNumbers: [], riskLevel: 'low',
    };
  }

  // Find the most underrepresented categories
  const colorCount = { red: 0, black: 0 };
  recent.forEach(n => { if (RED.has(n)) colorCount.red++; else if (n > 0) colorCount.black++; });
  const total = colorCount.red + colorCount.black;
  const redPct = total > 0 ? colorCount.red / total : 0.5;

  // Dozen imbalance
  const dz = [0, 0, 0];
  recent.forEach(n => { if (n >= 1 && n <= 12) dz[0]++; else if (n <= 24 && n > 12) dz[1]++; else if (n > 24) dz[2]++; });
  const coldDz = dz.indexOf(Math.min(...dz));

  const underColor = redPct < 0.45 ? 'red' : redPct > 0.55 ? 'black' : null;
  const suggested: number[] = [];
  
  if (underColor) {
    Array.from({ length: 37 }, (_, i) => i)
      .filter(n => (underColor === 'red' ? RED.has(n) : n > 0 && !RED.has(n)))
      .slice(0, 5)
      .forEach(n => suggested.push(n));
  }

  // Add cold dozen numbers
  Array.from({ length: 12 }, (_, i) => coldDz * 12 + i + 1)
    .filter(n => !suggested.includes(n))
    .slice(0, 3)
    .forEach(n => suggested.push(n));

  const imbalance = Math.abs(redPct - 0.5) * 200;
  const dzImbalance = Math.max(...dz) - Math.min(...dz);

  return {
    id: 'mean_reversion',
    name: 'Mean Reversion',
    emoji: '🔁',
    betMultiplier: 1 + (imbalance > 15 ? 0.5 : 0),
    confidence: Math.round(50 + imbalance + dzImbalance),
    action: imbalance > 10 || dzImbalance > 5 ? 'bet' : 'wait',
    reason: underColor 
      ? `${underColor === 'red' ? 'Vermelho' : 'Preto'} subrepresentado (${Math.round(redPct * 100)}%) + ${coldDz + 1}ª dúzia fria — reversão provável`
      : `Sem desvio significativo — aguardar`,
    suggestedNumbers: suggested.slice(0, 5),
    riskLevel: 'medium',
  };
}

function statisticalArbitrage(cfg: StrategyConfig): StrategyResult {
  const recent = cfg.allNumbers.slice(0, 100);
  if (recent.length < 20) {
    return {
      id: 'statistical_arbitrage', name: 'Arbitragem Estatística', emoji: '📊',
      betMultiplier: 1, confidence: 20, action: 'wait',
      reason: 'Dados insuficientes', suggestedNumbers: [], riskLevel: 'low',
    };
  }

  // Find numbers that are statistically overdue
  const freq: Record<number, number> = {};
  for (let i = 0; i <= 36; i++) freq[i] = 0;
  recent.forEach(n => freq[n]++);
  const expected = recent.length / 37;
  
  const overdue = Object.entries(freq)
    .map(([n, count]) => ({ number: Number(n), count, deficit: expected - count }))
    .filter(x => x.deficit > expected * 0.4)
    .sort((a, b) => b.deficit - a.deficit)
    .slice(0, 5);

  const confidence = overdue.length > 0 
    ? Math.round(50 + overdue[0].deficit / expected * 30)
    : 30;

  return {
    id: 'statistical_arbitrage',
    name: 'Arbitragem Estatística',
    emoji: '📊',
    betMultiplier: confidence > 65 ? 1.3 : 1,
    confidence: Math.min(85, confidence),
    action: overdue.length >= 3 ? 'bet' : 'wait',
    reason: overdue.length >= 3
      ? `${overdue.length} números atrasados detectados (déficit > ${Math.round(expected * 0.4)})`
      : 'Distribuição equilibrada — sem oportunidade de arbitragem',
    suggestedNumbers: overdue.map(x => x.number),
    riskLevel: 'medium',
  };
}

// ═══ AUTO-SELECT ════════════════════════════════════════════════════════════

export function autoSelectStrategy(cfg: StrategyConfig): StrategyId {
  const recentWR = getRecentWinRate(cfg.history);
  const losses = countConsecutiveLosses(cfg.history);
  
  // Calculate volatility from number distribution
  const recent = cfg.allNumbers.slice(0, 30);
  const freq: Record<number, number> = {};
  recent.forEach(n => freq[n] = (freq[n] || 0) + 1);
  const values = Object.values(freq);
  const mean = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const variance = values.length > 0 ? values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length : 0;
  const volatility = mean > 0 ? Math.sqrt(variance) / mean : 0.5;

  if (volatility > 0.7) return 'kelly_criterion';  // high volatility
  if (recentWR > 0.65) return 'momentum';           // hot streak
  if (recentWR < 0.35) return 'mean_reversion';     // cold streak
  if (losses >= 3) return 'martingale_safe';         // recovering
  if (cfg.allNumbers.length > 50) return 'statistical_arbitrage'; // enough data
  return 'fibonacci';                                 // neutral
}

// ═══ MAIN EXPORT ════════════════════════════════════════════════════════════

const STRATEGY_FNS: Record<StrategyId, (cfg: StrategyConfig) => StrategyResult> = {
  martingale_safe: martingaleSafe,
  fibonacci: fibonacciStrategy,
  kelly_criterion: kellyCriterion,
  momentum: momentumStrategy,
  mean_reversion: meanReversionStrategy,
  statistical_arbitrage: statisticalArbitrage,
};

export function runStrategy(id: StrategyId, cfg: StrategyConfig): StrategyResult {
  return STRATEGY_FNS[id](cfg);
}

export function runAllStrategies(cfg: StrategyConfig): StrategyResult[] {
  return Object.keys(STRATEGY_FNS).map(id => STRATEGY_FNS[id as StrategyId](cfg));
}

export const STRATEGY_LIST: { id: StrategyId; name: string; emoji: string; desc: string }[] = [
  { id: 'martingale_safe', name: 'Martingale Seguro', emoji: '🔄', desc: 'Dobra com limite de 5 perdas e teto de 10% do saldo' },
  { id: 'fibonacci', name: 'Fibonacci', emoji: '🌀', desc: 'Progressão Fibonacci com reset automático' },
  { id: 'kelly_criterion', name: 'Kelly Criterion', emoji: '📐', desc: 'Tamanho ótimo de aposta baseado na vantagem estimada' },
  { id: 'momentum', name: 'Momentum', emoji: '🚀', desc: 'Aumenta quando ganhando, reduz quando perdendo' },
  { id: 'mean_reversion', name: 'Mean Reversion', emoji: '🔁', desc: 'Aposta contra desvios da média (cores, dúzias)' },
  { id: 'statistical_arbitrage', name: 'Arbitragem Estatística', emoji: '📊', desc: 'Identifica números atrasados por deficit estatístico' },
];