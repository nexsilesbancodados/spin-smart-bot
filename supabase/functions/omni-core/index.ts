import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ═══════════════════════════════════════════════════════════════════
// CONSTANTES DO CILINDRO EUROPEU
// ═══════════════════════════════════════════════════════════════════
const WHEEL = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const WL = WHEEL.length;
const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const VOISINS = new Set([22,18,29,7,28,12,35,3,26,0,32,15,19,4,21,2,25]);
const TIERS  = new Set([27,13,36,11,30,8,23,10,5,24,16,33]);
const ORPHELINS = new Set([1,20,14,31,9,17,34,6]);

const getColor = (n: number): 'red'|'black'|'green' => n === 0 ? 'green' : RED.has(n) ? 'red' : 'black';
const getDozen = (n: number) => n === 0 ? 0 : n <= 12 ? 1 : n <= 24 ? 2 : 3;
const getColumn = (n: number) => n === 0 ? 0 : ((n - 1) % 3) + 1;
const getSector = (n: number) => VOISINS.has(n) ? 'voisins' : TIERS.has(n) ? 'tiers' : ORPHELINS.has(n) ? 'orphelins' : 'zero';
const wheelPos = (n: number) => WHEEL.indexOf(n);
const wheelNeighbors = (n: number, radius = 4): number[] => {
  const pos = wheelPos(n);
  if (pos < 0) return [];
  const result: number[] = [];
  for (let i = -radius; i <= radius; i++) {
    result.push(WHEEL[((pos + i) % WL + WL) % WL]);
  }
  return result;
};

// ═══════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════
interface ModelSignal {
  modelId: 'markov' | 'neural_pattern' | 'gradient' | 'bayesian' | 'statistical' | 'pattern_discovery' | 'rl_optimizer';
  modelName: string;
  betType: string;
  label: string;
  numbers: number[];
  confidence: number;
  reasoning: string;
  predictedMain?: number;
}

interface EnsembleResult {
  mode: 'signal' | 'kill_switch' | 'no_signal' | 'waiting';
  winner?: ModelSignal;
  ensembleConfidence: number;
  ensembleConsensus: number;
  allModelSignals: ModelSignal[];
  modelWeights: Record<string, number>;
  modelPerformance: Record<string, { winRate: number; total: number; hits: number; streak: number; weight: number }>;
  temperature: 'fria' | 'morna' | 'quente' | 'caotica';
  entryForce: 'leve' | 'padrao' | 'forte';
  kellyFraction: number;
  arbiterLog: string[];
  killSwitch: boolean;
  killReason?: string;
}

// ═══════════════════════════════════════════════════════════════════
// MODELO 1: MARKOV CHAIN (Ordem 1-5)
// Prevê próximo estado baseado em sequências anteriores
// ═══════════════════════════════════════════════════════════════════
function modelMarkov(spins: number[]): ModelSignal[] {
  const signals: ModelSignal[] = [];
  if (spins.length < 20) return signals;

  // Build transition matrices for orders 1 through 5
  const transitions: Record<string, Record<string, number>>[] = [{}, {}, {}, {}, {}];

  for (let order = 1; order <= 5; order++) {
    const trans = transitions[order - 1];
    for (let i = 0; i < spins.length - order; i++) {
      const key = spins.slice(i, i + order).reverse().join(',');
      if (!trans[key]) trans[key] = {};
      const next = `${spins[i + order]}`;
      trans[key][next] = (trans[key][next] || 0) + 1;
    }
  }

  // Current state keys for each order
  const keys: (string | null)[] = [];
  for (let order = 1; order <= 5; order++) {
    keys.push(spins.length >= order ? spins.slice(0, order).reverse().join(',') : null);
  }

  // Merge predictions: higher orders get more weight (they're more specific)
  const orderWeights = [0.10, 0.20, 0.25, 0.25, 0.20];
  const scores: Record<number, number> = {};

  const addScores = (trans: Record<string, number> | undefined, weight: number) => {
    if (!trans) return;
    const total = Object.values(trans).reduce((a, b) => a + b, 0);
    for (const [num, count] of Object.entries(trans)) {
      const n = parseInt(num);
      scores[n] = (scores[n] || 0) + (count / total) * weight;
    }
  };

  for (let order = 0; order < 5; order++) {
    if (keys[order]) addScores(transitions[order][keys[order]!], orderWeights[order]);
  }

  // Get top predictions
  const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a);
  if (sorted.length >= 3) {
    const topNums = sorted.slice(0, 8).map(([n]) => parseInt(n));
    const topScore = sorted[0][1];
    const conf = Math.min(90, 45 + Math.round(topScore * 65));

    // Find which orders contributed most
    const activeOrders = keys.map((k, i) => k && transitions[i][k] ? i + 1 : 0).filter(o => o > 0);

    signals.push({
      modelId: 'markov',
      modelName: 'Markov Chain',
      betType: topNums.length <= 5 ? 'vizinhos' : 'grupo',
      label: `Markov (O${activeOrders.join('+')}${activeOrders.length}) → [${topNums.slice(0, 5).join(',')}]`,
      numbers: topNums,
      confidence: conf,
      reasoning: `Cadeia de Markov (ordens ${activeOrders.join(',')}) prevê [${topNums.slice(0, 3).join(',')}] como mais prováveis após ${spins[0]}. Score: ${(topScore * 100).toFixed(0)}%`,
      predictedMain: topNums[0],
    });
  }

  // Color transition prediction
  const colorTrans: Record<string, Record<string, number>> = {};
  for (let i = 0; i < Math.min(spins.length - 1, 100); i++) {
    const c = getColor(spins[i]);
    const next = getColor(spins[i + 1]);
    if (!colorTrans[c]) colorTrans[c] = {};
    colorTrans[c][next] = (colorTrans[c][next] || 0) + 1;
  }
  const current = spins[0];
  const currentColor = getColor(current);
  const colorNext = colorTrans[currentColor];
  if (colorNext) {
    const total = Object.values(colorNext).reduce((a, b) => a + b, 0);
    for (const [color, count] of Object.entries(colorNext)) {
      if (color === 'green') continue;
      const prob = count / total;
      if (prob > 0.58) {
        const targetNums = Array.from({ length: 37 }, (_, i) => i).filter(n => getColor(n) === color);
        signals.push({
          modelId: 'markov',
          modelName: 'Markov Chain',
          betType: 'cor',
          label: `Markov Cor → ${color === 'red' ? 'VERMELHO' : 'PRETO'}`,
          numbers: targetNums,
          confidence: Math.min(82, 50 + Math.round(prob * 40)),
          reasoning: `Transição de cor Markov: após ${currentColor}, ${color} tem ${(prob * 100).toFixed(0)}% de probabilidade`,
        });
      }
    }
  }

  return signals;
}

// ═══════════════════════════════════════════════════════════════════
// MODELO 2: NEURAL PATTERN (Detector de padrões temporais complexos)
// Simula aprendizado de padrões via sliding windows e auto-correlação
// ═══════════════════════════════════════════════════════════════════
function modelNeuralPattern(spins: number[]): ModelSignal[] {
  const signals: ModelSignal[] = [];
  if (spins.length < 30) return signals;

  // Feature extraction: sliding windows of properties
  const windows = [5, 10, 20, 30];
  const features: Record<string, number[]> = {};

  for (const w of windows) {
    if (spins.length < w) continue;
    const window = spins.slice(0, w);

    // Sector distribution
    const sectors: Record<string, number> = { voisins: 0, tiers: 0, orphelins: 0, zero: 0 };
    window.forEach(n => sectors[getSector(n)]++);

    // Dozen distribution
    const dozens = [0, 0, 0, 0];
    window.forEach(n => dozens[getDozen(n)]++);

    // Wheel position autocorrelation
    const positions = window.map(wheelPos).filter(p => p >= 0);
    let autocorr = 0;
    if (positions.length >= 2) {
      for (let i = 0; i < positions.length - 1; i++) {
        const diff = Math.abs(positions[i] - positions[i + 1]);
        autocorr += Math.min(diff, WL - diff);
      }
      autocorr /= (positions.length - 1);
    }

    features[`w${w}`] = [
      sectors.voisins / w, sectors.tiers / w, sectors.orphelins / w,
      dozens[1] / w, dozens[2] / w, dozens[3] / w,
      autocorr / WL,
    ];
  }

  // Pattern: sector concentration (neural detects clustering)
  const w20 = features['w20'];
  const w5 = features['w5'];
  if (w20 && w5) {
    const sectorNames = ['voisins', 'tiers', 'orphelins'];
    const sectorSets: Record<string, Set<number>> = {
      voisins: VOISINS, tiers: TIERS, orphelins: ORPHELINS,
    };

    for (let i = 0; i < 3; i++) {
      // If short-term trend reinforces long-term
      if (w5[i] > 0.45 && w20[i] > 0.35) {
        const sectorNums = Array.from(sectorSets[sectorNames[i]]);
        const conf = Math.min(85, 55 + Math.round((w5[i] + w20[i]) * 25));
        signals.push({
          modelId: 'neural_pattern',
          modelName: 'Neural Pattern',
          betType: 'setor',
          label: `Neural → ${sectorNames[i].charAt(0).toUpperCase() + sectorNames[i].slice(1)}`,
          numbers: sectorNums,
          confidence: conf,
          reasoning: `Padrão temporal detectado: ${sectorNames[i]} concentrou ${(w5[i] * 100).toFixed(0)}% (5g) e ${(w20[i] * 100).toFixed(0)}% (20g) — tendência persistente`,
        });
      }
    }
  }

  // Pattern: wheel position clustering (dealer signature via autocorrelation)
  if (w5 && w20) {
    const shortAutocorr = w5[6]; // normalized autocorrelation
    const longAutocorr = w20[6];
    if (shortAutocorr < 0.25 && longAutocorr < 0.30) {
      // Numbers are clustering on the wheel
      const center = spins[0];
      const neighbors = wheelNeighbors(center, 6);
      const conf = Math.min(82, 55 + Math.round((1 - shortAutocorr) * 40));
      signals.push({
        modelId: 'neural_pattern',
        modelName: 'Neural Pattern',
        betType: 'vizinhos',
        label: `Neural → Cluster de ${center}`,
        numbers: neighbors,
        confidence: conf,
        reasoning: `Autocorrelação baixa (${(shortAutocorr * WL).toFixed(1)} posições médias) — padrão de cluster no cilindro detectado`,
        predictedMain: center,
      });
    }
  }

  // Dozen momentum detection
  if (w5 && w20) {
    for (let dz = 1; dz <= 3; dz++) {
      const shortFreq = w5[dz + 2]; // dozens are indices 3,4,5
      const longFreq = w20[dz + 2];
      if (shortFreq > 0.45 && longFreq > 0.38) {
        const dzNums = Array.from({ length: 12 }, (_, i) => (dz - 1) * 12 + i + 1);
        signals.push({
          modelId: 'neural_pattern',
          modelName: 'Neural Pattern',
          betType: 'duzia',
          label: `Neural → ${dz}ª Dúzia (momentum)`,
          numbers: dzNums,
          confidence: Math.min(80, 50 + Math.round((shortFreq + longFreq) * 25)),
          reasoning: `Momentum temporal: ${dz}ª Dúzia em ${(shortFreq * 100).toFixed(0)}% curto prazo, ${(longFreq * 100).toFixed(0)}% médio prazo`,
        });
      }
    }
  }

  return signals;
}

// ═══════════════════════════════════════════════════════════════════
// MODELO 3: GRADIENT BOOSTING (Feature-based scoring)
// Usa features estatísticas para pontuar cada número
// ═══════════════════════════════════════════════════════════════════
function modelGradient(spins: number[]): ModelSignal[] {
  const signals: ModelSignal[] = [];
  if (spins.length < 20) return signals;

  // Build feature matrix for each number 0-36
  const numScores: { num: number; score: number; features: string[] }[] = [];

  for (let n = 0; n <= 36; n++) {
    let score = 0;
    const feats: string[] = [];

    // Feature 1: Recency (how recently did it appear)
    const lastIdx = spins.indexOf(n);
    const recency = lastIdx >= 0 ? lastIdx : spins.length;
    const recencyScore = Math.min(1, recency / 50); // higher = more absent = more due
    score += recencyScore * 25;
    if (recency > 30) feats.push(`ausente ${recency}g`);

    // Feature 2: Frequency deviation (50 spins)
    const w50 = spins.slice(0, 50);
    const freq50 = w50.filter(x => x === n).length;
    const expected50 = w50.length / 37;
    const freqDev = (freq50 - expected50) / Math.max(1, Math.sqrt(expected50));
    if (freqDev < -1.2) {
      score += Math.min(20, Math.abs(freqDev) * 8);
      feats.push(`frio (${freqDev.toFixed(1)}σ)`);
    } else if (freqDev > 1.5) {
      score += Math.min(15, freqDev * 5); // hot number has momentum
      feats.push(`quente (${freqDev.toFixed(1)}σ)`);
    }

    // Feature 3: Sector heat
    const sector = getSector(n);
    const sectorCount = spins.slice(0, 20).filter(x => getSector(x) === sector).length;
    const sectorExpected = sector === 'voisins' ? 20 * 17 / 37 : sector === 'tiers' ? 20 * 12 / 37 : sector === 'orphelins' ? 20 * 8 / 37 : 20 / 37;
    if (sectorCount > sectorExpected * 1.3) {
      score += 10;
      feats.push(`setor quente`);
    }

    // Feature 4: Neighbor heat
    const neighbors = wheelNeighbors(n, 3);
    const neighborHits = spins.slice(0, 10).filter(x => neighbors.includes(x)).length;
    if (neighborHits >= 3) {
      score += neighborHits * 5;
      feats.push(`${neighborHits} vizinhos recentes`);
    }

    // Feature 5: Terminal pattern
    const terminal = n % 10;
    const termCount = spins.slice(0, 15).filter(x => x % 10 === terminal).length;
    if (termCount >= 4) {
      score += 8;
      feats.push(`terminal T${terminal} quente`);
    }

    // Feature 6: Dozen coldness
    const dz = getDozen(n);
    if (dz > 0) {
      let dzAbsence = 0;
      for (const s of spins) {
        if (s === 0) { dzAbsence++; continue; }
        if (getDozen(s) === dz) break;
        dzAbsence++;
      }
      if (dzAbsence >= 8) {
        score += Math.min(15, (dzAbsence - 8) * 3);
        feats.push(`dúzia ${dz} fria (${dzAbsence}g)`);
      }
    }

    // Feature 7: Column coldness
    const col = getColumn(n);
    if (col > 0) {
      let colAbsence = 0;
      for (const s of spins) {
        if (s === 0) { colAbsence++; continue; }
        if (getColumn(s) === col) break;
        colAbsence++;
      }
      if (colAbsence >= 8) {
        score += Math.min(12, (colAbsence - 8) * 2.5);
        feats.push(`coluna ${col} fria`);
      }
    }

    numScores.push({ num: n, score, features: feats });
  }

  // Sort by score and emit top group
  numScores.sort((a, b) => b.score - a.score);
  const topNums = numScores.slice(0, 10);
  const maxScore = topNums[0].score;

  if (maxScore > 30) {
    const numbers = topNums.map(t => t.num);
    const conf = Math.min(87, 45 + Math.round(maxScore * 0.8));
    const topFeats = topNums[0].features;

    signals.push({
      modelId: 'gradient',
      modelName: 'Gradient Boost',
      betType: 'grupo',
      label: `GBM → [${numbers.slice(0, 6).join(',')}]`,
      numbers,
      confidence: conf,
      reasoning: `Gradient scoring: ${topNums[0].num} lidera com score ${maxScore.toFixed(0)} (${topFeats.join(', ')})`,
      predictedMain: topNums[0].num,
    });

    // Also emit best dozen if there's a clear winner
    const dzScores = [0, 0, 0, 0];
    numScores.forEach(ns => {
      const dz = getDozen(ns.num);
      if (dz > 0) dzScores[dz] += ns.score;
    });
    const bestDz = dzScores.indexOf(Math.max(...dzScores.slice(1)), 1);
    const dzRatio = dzScores[bestDz] / (dzScores.reduce((a, b) => a + b, 0) || 1);
    if (dzRatio > 0.4) {
      const dzNums = Array.from({ length: 12 }, (_, i) => (bestDz - 1) * 12 + i + 1);
      signals.push({
        modelId: 'gradient',
        modelName: 'Gradient Boost',
        betType: 'duzia',
        label: `GBM → ${bestDz}ª Dúzia`,
        numbers: dzNums,
        confidence: Math.min(80, 50 + Math.round(dzRatio * 50)),
        reasoning: `${bestDz}ª Dúzia concentra ${(dzRatio * 100).toFixed(0)}% do score total do gradiente`,
      });
    }
  }

  return signals;
}

// ═══════════════════════════════════════════════════════════════════
// MODELO 4: BAYESIANO DINÂMICO
// Atualiza probabilidades a cada giro com priors
// ═══════════════════════════════════════════════════════════════════
function modelBayesian(spins: number[]): ModelSignal[] {
  const signals: ModelSignal[] = [];
  if (spins.length < 15) return signals;

  // Prior: uniform 1/37 for each number
  const prior = 1 / 37;
  const posteriors: number[] = new Array(37).fill(prior);

  // Update posteriors with observed frequencies (Dirichlet-like)
  const alpha = 1; // prior strength (pseudo-counts)
  const counts = new Array(37).fill(alpha);
  const window = spins.slice(0, Math.min(200, spins.length));

  // Weight recent spins more heavily
  for (let i = 0; i < window.length; i++) {
    const weight = Math.exp(-i * 0.02); // exponential decay
    counts[window[i]] += weight;
  }

  const totalCounts = counts.reduce((a: number, b: number) => a + b, 0);
  for (let i = 0; i <= 36; i++) {
    posteriors[i] = counts[i] / totalCounts;
  }

  // Bias detection: compute KL divergence from uniform
  const uniform = 1 / 37;
  let klDiv = 0;
  for (let i = 0; i <= 36; i++) {
    if (posteriors[i] > 0) {
      klDiv += posteriors[i] * Math.log(posteriors[i] / uniform);
    }
  }

  // If significant bias detected, emit signals
  if (klDiv > 0.05) {
    // Top numbers by posterior
    const ranked = posteriors.map((p, i) => ({ num: i, prob: p })).sort((a, b) => b.prob - a.prob);
    const topNums = ranked.slice(0, 8).map(r => r.num);
    const topProb = ranked[0].prob;
    const conf = Math.min(85, 50 + Math.round(klDiv * 200));

    signals.push({
      modelId: 'bayesian',
      modelName: 'Bayesiano Dinâmico',
      betType: 'grupo',
      label: `Bayes → [${topNums.slice(0, 5).join(',')}]`,
      numbers: topNums,
      confidence: conf,
      reasoning: `Distribuição posterior com viés detectado (KL=${klDiv.toFixed(3)}). ${ranked[0].num} tem probabilidade ${(topProb * 100).toFixed(1)}% vs ${(uniform * 100).toFixed(1)}% esperado`,
      predictedMain: ranked[0].num,
    });
  }

  // Bayesian color prediction
  const colorCounts = { red: alpha, black: alpha, green: alpha };
  for (let i = 0; i < Math.min(50, spins.length); i++) {
    const w = Math.exp(-i * 0.03);
    const c = getColor(spins[i]);
    colorCounts[c] += w;
  }
  const colorTotal = colorCounts.red + colorCounts.black + colorCounts.green;
  const redProb = colorCounts.red / colorTotal;
  const blackProb = colorCounts.black / colorTotal;

  // Recent bias check
  const expectedColorProb = 18 / 37;
  if (Math.abs(redProb - expectedColorProb) > 0.08) {
    const favoredColor = redProb > expectedColorProb ? 'red' : 'black';
    const favoredNums = Array.from({ length: 37 }, (_, i) => i).filter(n => getColor(n) === favoredColor);
    signals.push({
      modelId: 'bayesian',
      modelName: 'Bayesiano Dinâmico',
      betType: 'cor',
      label: `Bayes → ${favoredColor === 'red' ? 'VERMELHO' : 'PRETO'} (momentum)`,
      numbers: favoredNums,
      confidence: Math.min(78, 50 + Math.round(Math.abs(redProb - expectedColorProb) * 200)),
      reasoning: `Posterior Bayesiana: ${favoredColor === 'red' ? 'vermelho' : 'preto'} com ${(Math.max(redProb, blackProb) * 100).toFixed(1)}% (esperado: ${(expectedColorProb * 100).toFixed(1)}%)`,
    });
  }

  // Bayesian dozen prediction with cold reversal
  for (let dz = 1; dz <= 3; dz++) {
    let absence = 0;
    for (const n of spins) {
      if (n === 0) { absence++; continue; }
      if (getDozen(n) === dz) break;
      absence++;
    }
    if (absence >= 8) {
      // Bayesian prior says it should have appeared ~every 3 spins
      const priorProb = 12 / 37;
      // Posterior increases with absence
      const posteriorProb = priorProb * (1 + 0.02 * absence);
      const dzNums = Array.from({ length: 12 }, (_, i) => (dz - 1) * 12 + i + 1);
      signals.push({
        modelId: 'bayesian',
        modelName: 'Bayesiano Dinâmico',
        betType: 'duzia',
        label: `Bayes → ${dz}ª Dúzia (reversão)`,
        numbers: dzNums,
        confidence: Math.min(84, 55 + Math.round(posteriorProb * 40)),
        reasoning: `Posterior Bayesiana: ${dz}ª Dúzia ausente ${absence}g — probabilidade condicional elevada a ${(posteriorProb * 100).toFixed(1)}%`,
      });
    }
  }

  return signals;
}

// ═══════════════════════════════════════════════════════════════════
// MODELO 5: REGRAS ESTATÍSTICAS CLÁSSICAS
// Desvio padrão, hot/cold, lei dos terços, streaks
// ═══════════════════════════════════════════════════════════════════
function modelStatistical(spins: number[]): ModelSignal[] {
  const signals: ModelSignal[] = [];
  if (spins.length < 10) return signals;

  const window = spins.slice(0, 50);

  // 1. Color streak reversal
  const colors = spins.map(getColor);
  let colorStreak = 1;
  for (let i = 1; i < colors.length; i++) {
    if (colors[i] === colors[0] && colors[0] !== 'green') colorStreak++;
    else break;
  }
  if (colorStreak >= 5) {
    const opposite = colors[0] === 'red' ? 'black' : 'red';
    const oppositeNums = Array.from({ length: 37 }, (_, i) => i).filter(n => getColor(n) === opposite);
    signals.push({
      modelId: 'statistical',
      modelName: 'Estatístico Clássico',
      betType: 'cor',
      label: `${opposite === 'red' ? 'VERMELHO' : 'PRETO'} (${colorStreak}x streak)`,
      numbers: oppositeNums,
      confidence: Math.min(92, 70 + (colorStreak - 5) * 5),
      reasoning: `${colorStreak} ${colors[0] === 'red' ? 'vermelhos' : 'pretos'} consecutivos — probabilidade de continuação: ${(Math.pow(18 / 37, colorStreak) * 100).toFixed(1)}%`,
    });
  }

  // 2. Dozen absence
  for (let dz = 1; dz <= 3; dz++) {
    let absence = 0;
    for (const n of window) {
      if (n === 0) { absence++; continue; }
      if (getDozen(n) === dz) break;
      absence++;
    }
    if (absence >= 7) {
      const dzNums = Array.from({ length: 12 }, (_, i) => (dz - 1) * 12 + i + 1);
      signals.push({
        modelId: 'statistical',
        modelName: 'Estatístico Clássico',
        betType: 'duzia',
        label: `${dz}ª Dúzia (ausente ${absence}g)`,
        numbers: dzNums,
        confidence: Math.min(90, 60 + (absence - 7) * 4),
        reasoning: `${dz}ª Dúzia ausente há ${absence} giros — desvio significativo`,
      });
    }
  }

  // 3. Column absence
  for (let col = 1; col <= 3; col++) {
    let absence = 0;
    for (const n of window) {
      if (n === 0) { absence++; continue; }
      if (getColumn(n) === col) break;
      absence++;
    }
    if (absence >= 7) {
      const colNums: number[] = [];
      for (let i = col; i <= 36; i += 3) colNums.push(i);
      signals.push({
        modelId: 'statistical',
        modelName: 'Estatístico Clássico',
        betType: 'coluna',
        label: `${col}ª Coluna (ausente ${absence}g)`,
        numbers: colNums,
        confidence: Math.min(85, 58 + (absence - 7) * 3),
        reasoning: `${col}ª Coluna ausente há ${absence} giros`,
      });
    }
  }

  // 4. Parity streak
  const parities = spins.filter(n => n > 0).slice(0, 20).map(n => n % 2);
  if (parities.length >= 6) {
    let pStreak = 1;
    for (let i = 1; i < parities.length; i++) {
      if (parities[i] === parities[0]) pStreak++;
      else break;
    }
    if (pStreak >= 6) {
      const target = parities[0] === 0 ? 'ímpar' : 'par';
      const targetNums = Array.from({ length: 36 }, (_, i) => i + 1).filter(n => (target === 'par' ? n % 2 === 0 : n % 2 === 1));
      signals.push({
        modelId: 'statistical',
        modelName: 'Estatístico Clássico',
        betType: 'paridade',
        label: `${target.toUpperCase()} (${pStreak}x streak)`,
        numbers: targetNums,
        confidence: Math.min(88, 65 + (pStreak - 6) * 5),
        reasoning: `${pStreak} ${parities[0] === 0 ? 'pares' : 'ímpares'} seguidos — anomalia extrema`,
      });
    }
  }

  // 5. High/Low streak
  const hiLo = spins.filter(n => n > 0).slice(0, 20).map(n => n >= 19 ? 'high' : 'low');
  if (hiLo.length >= 6) {
    let hlStreak = 1;
    for (let i = 1; i < hiLo.length; i++) {
      if (hiLo[i] === hiLo[0]) hlStreak++;
      else break;
    }
    if (hlStreak >= 6) {
      const target = hiLo[0] === 'high' ? 'low' : 'high';
      const targetNums = target === 'low' ? Array.from({ length: 18 }, (_, i) => i + 1) : Array.from({ length: 18 }, (_, i) => i + 19);
      signals.push({
        modelId: 'statistical',
        modelName: 'Estatístico Clássico',
        betType: 'alto_baixo',
        label: `${target === 'high' ? 'ALTO' : 'BAIXO'} (${hlStreak}x streak)`,
        numbers: targetNums,
        confidence: Math.min(86, 63 + (hlStreak - 6) * 5),
        reasoning: `${hlStreak} ${hiLo[0] === 'high' ? 'altos' : 'baixos'} consecutivos`,
      });
    }
  }

  // 6. Sector analysis (Voisins, Tiers, Orphelins)
  const recent = spins.slice(0, 30);
  const sectorCounts: Record<string, number> = { voisins: 0, tiers: 0, orphelins: 0, zero: 0 };
  recent.forEach(n => sectorCounts[getSector(n)]++);
  const sectorExpected: Record<string, number> = {
    voisins: 17 / 37 * recent.length,
    tiers: 12 / 37 * recent.length,
    orphelins: 8 / 37 * recent.length,
  };
  const sectorSets: Record<string, Set<number>> = { voisins: VOISINS, tiers: TIERS, orphelins: ORPHELINS };
  const sectorNames: Record<string, string> = { voisins: 'Voisins du Zéro', tiers: 'Tiers du Cylindre', orphelins: 'Orphelins' };

  for (const [sector, count] of Object.entries(sectorCounts)) {
    if (sector === 'zero' || !sectorExpected[sector]) continue;
    const ratio = count / sectorExpected[sector];
    if (ratio > 1.35 && count >= 5) {
      signals.push({
        modelId: 'statistical',
        modelName: 'Estatístico Clássico',
        betType: 'setor',
        label: `${sectorNames[sector]} (HOT)`,
        numbers: Array.from(sectorSets[sector]),
        confidence: Math.min(82, 55 + Math.round((ratio - 1) * 40)),
        reasoning: `Setor ${sectorNames[sector]} com ${count}/${recent.length} (${(ratio * 100 - 100).toFixed(0)}% acima do esperado)`,
      });
    }
  }

  return signals;
}

// ═══════════════════════════════════════════════════════════════════
// MODELO 6: PATTERN DISCOVERY (Association Rules / FP-Growth inspired)
// Mineração de regras de associação em sequências
// ═══════════════════════════════════════════════════════════════════
function modelPatternDiscovery(spins: number[]): ModelSignal[] {
  const signals: ModelSignal[] = [];
  if (spins.length < 50) return signals;

  // Mine frequent sequential patterns of length 2-3
  const pairs: Record<string, number> = {};
  const triples: Record<string, number> = {};

  for (let i = 0; i < spins.length - 2; i++) {
    const p = `${spins[i + 1]},${spins[i]}`;
    pairs[p] = (pairs[p] || 0) + 1;
    if (i < spins.length - 3) {
      const t = `${spins[i + 2]},${spins[i + 1]},${spins[i]}`;
      triples[t] = (triples[t] || 0) + 1;
    }
  }

  // Check if current sequence matches any frequent pattern
  const currentPair = `${spins[0]},${spins[1]}`;
  const currentTriple = spins.length >= 3 ? `${spins[0]},${spins[1]},${spins[2]}` : null;

  // Find what follows current pair
  const followers: Record<number, number> = {};
  for (let i = 0; i < spins.length - 2; i++) {
    const p = `${spins[i + 1]},${spins[i]}`;
    if (p === currentPair) {
      if (i > 0) {
        followers[spins[i - 1]] = (followers[spins[i - 1]] || 0) + 1;
      }
    }
  }

  const totalFollowers = Object.values(followers).reduce((a, b) => a + b, 0);
  if (totalFollowers >= 3) {
    const sortedFollowers = Object.entries(followers).sort(([, a], [, b]) => b - a);
    const topNums = sortedFollowers.slice(0, 6).map(([n]) => parseInt(n));
    const topProb = sortedFollowers[0][1] / totalFollowers;

    if (topProb > 0.15) {
      signals.push({
        modelId: 'pattern_discovery',
        modelName: 'Pattern Discovery',
        betType: 'grupo',
        label: `Padrão ${spins[1]}→${spins[0]}→? → [${topNums.slice(0, 4).join(',')}]`,
        numbers: topNums,
        confidence: Math.min(85, 45 + Math.round(topProb * 100) + Math.min(20, totalFollowers * 2)),
        reasoning: `Regra de associação: após sequência [${spins[1]},${spins[0]}], os números [${topNums.slice(0, 3).join(',')}] apareceram ${sortedFollowers[0][1]}/${totalFollowers} vezes (${(topProb * 100).toFixed(0)}%)`,
        predictedMain: topNums[0],
      });
    }
  }

  // Color pattern rules: "after N reds, what happens?"
  const colorSeqs: Record<string, Record<string, number>> = {};
  for (let w = 3; w <= 5; w++) {
    for (let i = 0; i < spins.length - w; i++) {
      const seq = spins.slice(i, i + w).map(n => getColor(n)).join('');
      if (!colorSeqs[seq]) colorSeqs[seq] = {};
      const next = getColor(spins[i + w]);
      colorSeqs[seq][next] = (colorSeqs[seq][next] || 0) + 1;
    }
  }

  // Check current color sequence
  for (let w = 3; w <= 5; w++) {
    if (spins.length < w) continue;
    const currentSeq = spins.slice(0, w).map(n => getColor(n)).join('');
    const nextColors = colorSeqs[currentSeq];
    if (nextColors) {
      const total = Object.values(nextColors).reduce((a, b) => a + b, 0);
      if (total >= 5) {
        for (const [color, count] of Object.entries(nextColors)) {
          if (color === 'green') continue;
          const prob = count / total;
          if (prob > 0.65) {
            const nums = Array.from({ length: 37 }, (_, i) => i).filter(n => getColor(n) === color);
            signals.push({
              modelId: 'pattern_discovery',
              modelName: 'Pattern Discovery',
              betType: 'cor',
              label: `Regra: ${currentSeq}→${color === 'red' ? 'VERM' : 'PRETO'} (${(prob * 100).toFixed(0)}%)`,
              numbers: nums,
              confidence: Math.min(82, 50 + Math.round(prob * 40)),
              reasoning: `Regra de associação: após padrão ${currentSeq}, ${color} apareceu ${count}/${total} vezes`,
            });
          }
        }
      }
    }
  }

  return signals;
}

// ═══════════════════════════════════════════════════════════════════
// MODELO 7: RL OPTIMIZER (Reinforcement Learning inspired)
// Simula aprendizado por reforço para otimizar apostas
// ═══════════════════════════════════════════════════════════════════
function modelRLOptimizer(spins: number[], modelWeights: Record<string, ModelWeight>): ModelSignal[] {
  const signals: ModelSignal[] = [];
  if (spins.length < 30) return signals;

  // State: recent pattern features
  // Action: which bet type to recommend
  // Reward: based on historical model performance

  // Compute "value function" for each bet type by simulating past performance
  const betTypes = ['duzia', 'cor', 'setor', 'vizinhos', 'coluna'];
  const betScores: Record<string, { wins: number; total: number; ev: number }> = {};

  for (const bet of betTypes) {
    betScores[bet] = { wins: 0, total: 0, ev: 0 };
  }

  // Simulate: for each historical window, what bet would have been optimal?
  const simWindow = 20;
  for (let i = 0; i < Math.min(spins.length - simWindow - 1, 100); i++) {
    const window = spins.slice(i + 1, i + 1 + simWindow);
    const actual = spins[i];

    // Dozen bet
    for (let dz = 1; dz <= 3; dz++) {
      const dzCount = window.filter(n => getDozen(n) === dz).length;
      if (dzCount / simWindow > 0.38) {
        betScores.duzia.total++;
        if (getDozen(actual) === dz) { betScores.duzia.wins++; betScores.duzia.ev += 2; }
        else betScores.duzia.ev -= 1;
      }
    }

    // Color bet
    const reds = window.filter(n => getColor(n) === 'red').length;
    const nonZero = window.filter(n => n > 0).length;
    if (nonZero > 0 && (reds / nonZero > 0.58 || reds / nonZero < 0.42)) {
      betScores.cor.total++;
      const predicted = reds / nonZero > 0.58 ? 'red' : 'black';
      if (getColor(actual) === predicted) { betScores.cor.wins++; betScores.cor.ev += 1; }
      else betScores.cor.ev -= 1;
    }

    // Sector bet
    const sectors: Record<string, number> = { voisins: 0, tiers: 0, orphelins: 0 };
    window.forEach(n => { const s = getSector(n); if (s !== 'zero') sectors[s]++; });
    const hotSector = Object.entries(sectors).sort(([, a], [, b]) => b - a)[0];
    if (hotSector && hotSector[1] / simWindow > 0.40) {
      betScores.setor.total++;
      if (getSector(actual) === hotSector[0]) { betScores.setor.wins++; betScores.setor.ev += 1.5; }
      else betScores.setor.ev -= 1;
    }
  }

  // Find optimal bet type by expected value
  const bestBet = Object.entries(betScores)
    .filter(([, s]) => s.total >= 10)
    .sort(([, a], [, b]) => (b.ev / b.total) - (a.ev / a.total))[0];

  if (bestBet) {
    const [betType, stats] = bestBet;
    const winRate = stats.wins / stats.total;
    const avgEV = stats.ev / stats.total;

    if (winRate > 0.30 && avgEV > 0) {
      // Generate specific numbers based on best bet type
      let nums: number[] = [];
      let label = '';
      const recent = spins.slice(0, 20);

      if (betType === 'duzia') {
        const dzCounts = [0, 0, 0, 0];
        recent.forEach(n => dzCounts[getDozen(n)]++);
        const bestDz = dzCounts.indexOf(Math.max(...dzCounts.slice(1)), 1);
        nums = Array.from({ length: 12 }, (_, i) => (bestDz - 1) * 12 + i + 1);
        label = `RL → D${bestDz} (EV+${avgEV.toFixed(2)})`;
      } else if (betType === 'cor') {
        const reds = recent.filter(n => getColor(n) === 'red').length;
        const isRedHot = reds / recent.filter(n => n > 0).length > 0.55;
        nums = Array.from({ length: 37 }, (_, i) => i).filter(n => getColor(n) === (isRedHot ? 'red' : 'black'));
        label = `RL → ${isRedHot ? 'VERM' : 'PRETO'} (EV+${avgEV.toFixed(2)})`;
      } else if (betType === 'setor') {
        const VOISINS_S = new Set([22,18,29,7,28,12,35,3,26,0,32,15,19,4,21,2,25]);
        const TIERS_S = new Set([27,13,36,11,30,8,23,10,5,24,16,33]);
        const sc: Record<string, number> = { voisins: 0, tiers: 0, orphelins: 0 };
        recent.forEach(n => { if (VOISINS_S.has(n)) sc.voisins++; else if (TIERS_S.has(n)) sc.tiers++; else sc.orphelins++; });
        const hotS = Object.entries(sc).sort(([, a], [, b]) => b - a)[0][0];
        nums = Array.from(hotS === 'voisins' ? VOISINS_S : hotS === 'tiers' ? TIERS_S : ORPHELINS);
        label = `RL → ${hotS} (EV+${avgEV.toFixed(2)})`;
      }

      if (nums.length > 0) {
        signals.push({
          modelId: 'rl_optimizer',
          modelName: 'RL Optimizer',
          betType,
          label,
          numbers: nums,
          confidence: Math.min(84, 45 + Math.round(winRate * 50) + Math.round(avgEV * 10)),
          reasoning: `RL simulado: ${betType} teve WR ${(winRate * 100).toFixed(0)}% e EV +${avgEV.toFixed(2)} em ${stats.total} simulações recentes`,
          predictedMain: nums[0],
        });
      }
    }
  }

  return signals;
}

// ═══════════════════════════════════════════════════════════════════
// ENSEMBLE VOTING: Combina todos os modelos com pesos dinâmicos
// ═══════════════════════════════════════════════════════════════════
interface ModelWeight {
  model_id: string;
  weight: number;
  win_rate: number;
  total_predictions: number;
  total_hits: number;
  current_streak: number;
}

function ensembleVote(
  allSignals: ModelSignal[],
  weights: Record<string, ModelWeight>,
): { winner: ModelSignal; consensus: number; ensembleConfidence: number; scored: Array<ModelSignal & { score: number }> } {
  // Score each signal: confidence × model weight
  const scored = allSignals.map(s => ({
    ...s,
    score: s.confidence * (weights[s.modelId]?.weight ?? 1.0),
  }));
  scored.sort((a, b) => b.score - a.score);

  const winner = scored[0];

  // Compute consensus: how many models agree on similar bet type or numbers
  const winnerNums = new Set(winner.numbers);
  let consensus = 0;
  const modelsSeen = new Set<string>();
  for (const s of scored) {
    if (modelsSeen.has(s.modelId)) continue;
    modelsSeen.add(s.modelId);
    const overlap = s.numbers.filter(n => winnerNums.has(n)).length;
    if (overlap >= 3 || s.betType === winner.betType) {
      consensus++;
    }
  }

  // Ensemble confidence: weighted average of top signals
  const topSignals = scored.slice(0, Math.min(5, scored.length));
  const totalWeight = topSignals.reduce((a, b) => a + (weights[b.modelId]?.weight ?? 1), 0);
  const ensembleConfidence = totalWeight > 0
    ? Math.round(topSignals.reduce((a, b) => a + b.confidence * (weights[b.modelId]?.weight ?? 1), 0) / totalWeight)
    : winner.confidence;

  return { winner, consensus, ensembleConfidence, scored };
}

// ═══════════════════════════════════════════════════════════════════
// KELLY + KILL SWITCH
// ═══════════════════════════════════════════════════════════════════
function computeKelly(winRate: number, odds: number): { fraction: number; force: 'leve' | 'padrao' | 'forte' } {
  const p = Math.max(0.01, Math.min(0.99, winRate));
  const q = 1 - p;
  const b = Math.max(1, odds);
  const kelly = Math.max(0, (b * p - q) / b);
  let force: 'leve' | 'padrao' | 'forte';
  if (kelly >= 0.12) force = 'forte';
  else if (kelly >= 0.05) force = 'padrao';
  else force = 'leve';
  return { fraction: kelly, force };
}

function checkKillSwitch(weights: Record<string, ModelWeight>): { active: boolean; reason?: string } {
  const models = Object.values(weights).filter(w => w.total_predictions >= 5);
  if (models.length >= 3 && models.every(w => w.win_rate < 0.40)) {
    return { active: true, reason: '⚠️ Anomalia detectada na roleta. Todos os modelos abaixo de 40% — sinais suspensos por 5 giros para proteção de banca.' };
  }
  return { active: false };
}

function getTemperature(weights: Record<string, ModelWeight>): 'fria' | 'morna' | 'quente' | 'caotica' {
  const models = Object.values(weights).filter(w => w.total_predictions >= 3);
  if (models.length === 0) return 'morna';
  const avgRate = models.reduce((a, w) => a + w.win_rate, 0) / models.length;
  const anyHot = models.some(w => w.current_streak >= 4);
  if (avgRate < 0.30) return 'caotica';
  if (avgRate < 0.40) return 'fria';
  if (anyHot || avgRate > 0.55) return 'quente';
  return 'morna';
}

// ═══════════════════════════════════════════════════════════════════
// RECALIBRATION: Update model weights based on recent performance
// ═══════════════════════════════════════════════════════════════════
async function recalibrateWeights(supabase: any) {
  // Get recent model predictions (last 200)
  const { data: predictions } = await supabase
    .from('model_predictions')
    .select('model_id, hit, created_at')
    .not('hit', 'is', null)
    .order('created_at', { ascending: false })
    .limit(200);

  if (!predictions || predictions.length < 5) return;

  const modelStats: Record<string, { hits: number; total: number; streak: number }> = {};

  for (const pred of predictions) {
    if (!modelStats[pred.model_id]) {
      modelStats[pred.model_id] = { hits: 0, total: 0, streak: 0 };
    }
    const stats = modelStats[pred.model_id];
    stats.total++;
    if (pred.hit) stats.hits++;
  }

  // Compute streaks (from most recent)
  const modelRecent: Record<string, boolean[]> = {};
  for (const pred of predictions) {
    if (!modelRecent[pred.model_id]) modelRecent[pred.model_id] = [];
    if (modelRecent[pred.model_id].length < 30) {
      modelRecent[pred.model_id].push(pred.hit);
    }
  }

  for (const [modelId, results] of Object.entries(modelRecent)) {
    if (results.length > 0 && modelStats[modelId]) {
      let streak = results[0] ? 1 : -1;
      for (let i = 1; i < results.length; i++) {
        if (results[i] === results[0]) streak += results[0] ? 1 : -1;
        else break;
      }
      modelStats[modelId].streak = streak;
    }
  }

  // UCB1-inspired weight calculation
  for (const [modelId, stats] of Object.entries(modelStats)) {
    const winRate = stats.total > 0 ? stats.hits / stats.total : 0.5;
    const exploration = stats.total > 0 ? Math.sqrt(2 * Math.log(200) / stats.total) : 1;
    let weight = winRate + exploration * 0.2;

    // Streak bonus/penalty
    if (stats.streak >= 3) weight *= 1.3;
    if (stats.streak <= -2) weight *= 0.5;

    weight = Math.max(0.1, Math.min(3.0, weight));

    await supabase.from('ensemble_weights').upsert({
      model_id: modelId,
      weight,
      win_rate: winRate,
      total_predictions: stats.total,
      total_hits: stats.hits,
      current_streak: stats.streak,
      best_streak: Math.max(stats.streak, 0),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'model_id' });
  }
}

// ═══════════════════════════════════════════════════════════════════
// ORQUESTRADOR PRINCIPAL
// ═══════════════════════════════════════════════════════════════════
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    let clientNumbers: number[] | undefined;
    let recalibrate = false;
    try {
      const body = await req.json();
      clientNumbers = body?.numbers;
      recalibrate = body?.recalibrate === true;
    } catch { /* no body */ }

    // Recalibrate weights if requested
    if (recalibrate) {
      await recalibrateWeights(supabase);
    }

    // ── 1. Fetch data in parallel ──────────────────────────
    const [numbersRes, weightsRes] = await Promise.all([
      supabase.from('roulette_numbers').select('number, fetched_at')
        .order('fetched_at', { ascending: false }).limit(500),
      supabase.from('ensemble_weights').select('*'),
    ]);

    const dbNumbers = (numbersRes.data || []).map((r: any) => r.number as number);
    const spins = clientNumbers && clientNumbers.length > 0
      ? clientNumbers.slice(0, 500)
      : dbNumbers;

    if (spins.length < 10) {
      return new Response(JSON.stringify({
        mode: 'waiting',
        message: 'Aguardando dados suficientes (mínimo 10 giros)...',
        killSwitch: false,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Build weights map
    const weightRows = (weightsRes.data || []) as ModelWeight[];
    const weights: Record<string, ModelWeight> = {};
    for (const w of weightRows) {
      weights[w.model_id] = w;
    }
    // Ensure all models have defaults
    for (const id of ['markov', 'neural_pattern', 'gradient', 'bayesian', 'statistical', 'pattern_discovery', 'rl_optimizer']) {
      if (!weights[id]) {
        weights[id] = { model_id: id, weight: 1.0, win_rate: 0, total_predictions: 0, total_hits: 0, current_streak: 0 };
      }
    }

    // ── 2. Kill Switch check ───────────────────────────────
    const killCheck = checkKillSwitch(weights);
    const temperature = getTemperature(weights);

    if (killCheck.active) {
      return new Response(JSON.stringify({
        mode: 'kill_switch',
        message: killCheck.reason,
        killSwitch: true,
        temperature,
        modelPerformance: Object.fromEntries(Object.entries(weights).map(([id, w]) => [id, {
          winRate: w.win_rate, total: w.total_predictions, hits: w.total_hits,
          streak: w.current_streak, weight: w.weight,
        }])),
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── 3. Run all 7 Models with BAGGING (Bootstrap Aggregation) ──
    // Each model runs on 3 bootstrap samples + full data = 4 runs
    // Signals are aggregated and boosted by consistency across samples
    const BOOTSTRAP_SAMPLES = 3;
    const bootstrapSamples: number[][] = [];
    for (let b = 0; b < BOOTSTRAP_SAMPLES; b++) {
      const sample: number[] = [];
      const sampleSize = Math.min(spins.length, 200);
      for (let i = 0; i < sampleSize; i++) {
        sample.push(spins[Math.floor(Math.random() * spins.length)]);
      }
      bootstrapSamples.push(sample);
    }

    // Run models on full data
    const fullSignals = [
      ...modelMarkov(spins),
      ...modelNeuralPattern(spins),
      ...modelGradient(spins),
      ...modelBayesian(spins),
      ...modelStatistical(spins),
      ...modelPatternDiscovery(spins),
      ...modelRLOptimizer(spins, weights),
    ];

    // Run models on bootstrap samples (bagging)
    const baggedSignalSets: ModelSignal[][] = [];
    for (const sample of bootstrapSamples) {
      baggedSignalSets.push([
        ...modelMarkov(sample),
        ...modelNeuralPattern(sample),
        ...modelGradient(sample),
        ...modelBayesian(sample),
        ...modelStatistical(sample),
        ...modelPatternDiscovery(sample),
        ...modelRLOptimizer(sample, weights),
      ]);
    }

    // BOOSTING: Increase confidence of signals that appear consistently across bootstraps
    const boostedSignals: ModelSignal[] = fullSignals.map(signal => {
      let consistencyCount = 0;
      for (const bagSet of baggedSignalSets) {
        const match = bagSet.find(bs => 
          bs.modelId === signal.modelId && 
          bs.betType === signal.betType &&
          (bs.predictedMain === signal.predictedMain || 
           bs.numbers.filter(n => signal.numbers.includes(n)).length >= Math.min(3, signal.numbers.length * 0.5))
        );
        if (match) consistencyCount++;
      }
      // Boost factor: signal found in N/3 bootstrap samples
      const boostFactor = 1 + (consistencyCount / BOOTSTRAP_SAMPLES) * 0.25; // up to +25%
      const penaltyFactor = consistencyCount === 0 ? 0.75 : 1; // -25% if never in bootstraps
      
      return {
        ...signal,
        confidence: Math.min(95, Math.round(signal.confidence * boostFactor * penaltyFactor)),
        reasoning: `${signal.reasoning} [Bagging: ${consistencyCount}/${BOOTSTRAP_SAMPLES} amostras${consistencyCount === BOOTSTRAP_SAMPLES ? ' ✅ consistente' : consistencyCount === 0 ? ' ⚠️ instável' : ''}]`,
      };
    });

    // Aggregate unique numbers from bagged signals to find "bag consensus" numbers
    const bagNumberVotes: Record<number, number> = {};
    for (const bagSet of baggedSignalSets) {
      for (const sig of bagSet) {
        if (sig.predictedMain !== undefined) {
          bagNumberVotes[sig.predictedMain] = (bagNumberVotes[sig.predictedMain] || 0) + 1;
        }
        for (const n of sig.numbers.slice(0, 5)) {
          bagNumberVotes[n] = (bagNumberVotes[n] || 0) + 0.3;
        }
      }
    }

    const allSignals = boostedSignals;

    // Build per-bet-type analysis summary
    const betTypeAnalysis: Record<string, { confidence: number; models: string[]; numbers: number[]; reasoning: string }> = {};
    for (const sig of allSignals) {
      const bt = sig.betType;
      if (!betTypeAnalysis[bt]) {
        betTypeAnalysis[bt] = { confidence: 0, models: [], numbers: [], reasoning: '' };
      }
      const entry = betTypeAnalysis[bt];
      entry.confidence = Math.max(entry.confidence, sig.confidence);
      if (!entry.models.includes(sig.modelName)) entry.models.push(sig.modelName);
      for (const n of sig.numbers) {
        if (!entry.numbers.includes(n)) entry.numbers.push(n);
      }
      entry.reasoning += (entry.reasoning ? ' | ' : '') + sig.reasoning.slice(0, 100);
    }

    if (allSignals.length === 0) {
      return new Response(JSON.stringify({
        mode: 'no_signal',
        message: '🔎 Ensemble analisando — nenhum padrão forte detectado. Aguardando...',
        killSwitch: false,
        temperature,
        modelPerformance: Object.fromEntries(Object.entries(weights).map(([id, w]) => [id, {
          winRate: w.win_rate, total: w.total_predictions, hits: w.total_hits,
          streak: w.current_streak, weight: w.weight,
        }])),
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── 4. Ensemble Voting ─────────────────────────────────
    const { winner, consensus, ensembleConfidence, scored } = ensembleVote(allSignals, weights);

    // ── 4.5 FUSÃO TOP 5: Convergência absoluta de TODOS os modelos ──
    // Cada número 0-36 recebe votos ponderados de todos os sinais
    const fusionScores: { num: number; score: number; voters: string[]; reasons: string[] }[] = [];
    for (let n = 0; n <= 36; n++) {
      let score = 0;
      const voters: string[] = [];
      const reasons: string[] = [];

      for (const signal of scored) {
        const modelWeight = weights[signal.modelId]?.weight ?? 1.0;
        const confFactor = signal.confidence / 100;

        if (signal.numbers.includes(n)) {
          // Base vote: confidence × model weight
          let vote = confFactor * modelWeight;

          // Bonus if this is the predicted main number
          if (signal.predictedMain === n) vote *= 2.5;

          // Bonus for first 3 numbers in the signal (higher priority)
          const idx = signal.numbers.indexOf(n);
          if (idx >= 0 && idx < 3) vote *= 1.5;
          else if (idx >= 0 && idx < 6) vote *= 1.2;

          score += vote;
          if (!voters.includes(signal.modelName)) {
            voters.push(signal.modelName);
            reasons.push(`${signal.modelName}: ${signal.label}`);
          }
        }
      }

      if (score > 0) {
        fusionScores.push({ num: n, score, voters, reasons });
      }
    }

    // Sort by fusion score and pick Top 5
    fusionScores.sort((a, b) => b.score - a.score);
    const top5 = fusionScores.slice(0, 5);
    const top5Numbers = top5.map(t => t.num);
    const top5MaxScore = top5[0]?.score ?? 0;

    // Compute fusion confidence: how concentrated the scores are
    const totalFusionScore = fusionScores.reduce((a, b) => a + b.score, 0);
    const top5Score = top5.reduce((a, b) => a + b.score, 0);
    const fusionConfidence = totalFusionScore > 0
      ? Math.min(95, Math.round((top5Score / totalFusionScore) * 100 + top5[0]?.voters.length * 5))
      : 0;

    // Build fusion reasoning
    const fusionReasoning = top5.map((t, i) => 
      `#${i + 1} → ${t.num} (score: ${t.score.toFixed(1)}, ${t.voters.length} modelos: ${t.voters.join(', ')})`
    ).join(' | ');

    // ── 5. Kelly criterion ─────────────────────────────────
    const modelWR = weights[winner.modelId];
    const winRate = modelWR && modelWR.total_predictions > 0
      ? modelWR.total_hits / modelWR.total_predictions : 0.45;
    const payout = Math.max(1, Math.round(35 / 5)); // Based on 5 numbers
    const kelly = computeKelly(winRate, payout);

    // ── 6. Store predictions ───────────────────────────────
    // Store the fusion prediction as a special entry
    const predInserts = [
      {
        model_id: 'fusion_top5',
        predicted_numbers: top5Numbers,
        predicted_main: top5Numbers[0],
        confidence: fusionConfidence,
        bet_type: 'fusion',
        reasoning: fusionReasoning,
        ensemble_weight: 1.0,
        spin_context: { temperature, consensus, totalModels: 7, fusion: true, top5_details: top5 },
      },
      ...scored.slice(0, 7).map(s => ({
        model_id: s.modelId,
        predicted_numbers: s.numbers.slice(0, 15),
        predicted_main: s.predictedMain ?? s.numbers[0],
        confidence: s.confidence,
        bet_type: s.betType,
        reasoning: s.reasoning,
        ensemble_weight: weights[s.modelId]?.weight ?? 1.0,
        spin_context: { temperature, consensus, totalModels: 7 },
      })),
    ];

    // Fire and forget
    supabase.from('model_predictions').insert(predInserts).then(() => {});

    // Recalibrate periodically
    if (Math.random() < 0.08) {
      recalibrateWeights(supabase).catch(() => {});
    }

    // ── 7. Build arbiter log ───────────────────────────────
    const modelNames: Record<string, string> = {
      markov: 'Markov', neural_pattern: 'Neural', gradient: 'Gradient',
      bayesian: 'Bayesiano', statistical: 'Estatístico',
      pattern_discovery: 'PatternDisc', rl_optimizer: 'RL-Opt',
    };
    const arbiterLog: string[] = [];
    arbiterLog.push(`🌡️ Mesa ${temperature.toUpperCase()}`);
    arbiterLog.push(`🤖 7 modelos ativos — ${allSignals.length} sinais gerados`);
    for (const [id, w] of Object.entries(weights)) {
      const name = modelNames[id] || id;
      const wr = w.total_predictions > 0 ? `${(w.win_rate * 100).toFixed(0)}%` : 'N/A';
      arbiterLog.push(`${name}: WR ${wr} | peso ${w.weight.toFixed(2)} | streak ${w.current_streak}`);
    }
    arbiterLog.push(`🏆 Líder: ${winner.modelName} → ${winner.label}`);
    arbiterLog.push(`🎯 FUSÃO TOP 5: [${top5Numbers.join(', ')}] — confiança ${fusionConfidence}%`);
    arbiterLog.push(`📊 Consenso: ${consensus}/7 modelos concordam`);
    arbiterLog.push(`💰 Kelly: ${(kelly.fraction * 100).toFixed(1)}% → Entrada ${kelly.force.toUpperCase()}`);

    return new Response(JSON.stringify({
      mode: 'signal',
      // === FUSÃO TOP 5 como sinal principal ===
      signal: {
        number: top5Numbers[0],
        numbers: top5Numbers,
        probability: fusionConfidence,
      },
      fusionTop5: top5.map(t => ({
        number: t.num,
        score: Math.round(t.score * 10) / 10,
        voters: t.voters,
        voterCount: t.voters.length,
        reasons: t.reasons,
      })),
      fusionConfidence,
      fusionReasoning,
      strategy: {
        type: 'fusion_top5',
        label: `FUSÃO TOP 5 → [${top5Numbers.join(', ')}]`,
        numbers: top5Numbers,
      },
      entryForce: kelly.force,
      kellyFraction: kelly.fraction,
      temperature,
      killSwitch: false,
      ensembleConsensus: consensus,
      ensembleConfidence,
      totalModels: 7,
      arbiterLog,
      // NEW: Bagging consensus numbers (numbers that appeared across bootstrap samples)
      bagConsensus: Object.entries(bagNumberVotes)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([n, votes]) => ({ number: parseInt(n), votes: Math.round(votes * 10) / 10 })),
      // NEW: Per-bet-type analysis summary for unified view
      betTypeAnalysis,
      modelPerformance: Object.fromEntries(Object.entries(weights).map(([id, w]) => [id, {
        winRate: w.win_rate,
        total: w.total_predictions,
        hits: w.total_hits,
        streak: w.current_streak,
        weight: w.weight,
      }])),
      modelSignals: scored.slice(0, 10).map(s => ({
        modelId: s.modelId,
        modelName: s.modelName,
        label: s.label,
        confidence: s.confidence,
        score: s.score,
        betType: s.betType,
        reasoning: s.reasoning,
      })),
      agents: {
        statistical: { weight: weights.statistical?.weight ?? 1, winRate: weights.statistical?.total_predictions > 0 ? `${(weights.statistical.win_rate * 100).toFixed(0)}%` : 'N/A', streak: weights.statistical?.current_streak ?? 0 },
        ballistic: { weight: weights.neural_pattern?.weight ?? 1, winRate: weights.neural_pattern?.total_predictions > 0 ? `${(weights.neural_pattern.win_rate * 100).toFixed(0)}%` : 'N/A', streak: weights.neural_pattern?.current_streak ?? 0 },
        reversion: { weight: weights.bayesian?.weight ?? 1, winRate: weights.bayesian?.total_predictions > 0 ? `${(weights.bayesian.win_rate * 100).toFixed(0)}%` : 'N/A', streak: weights.bayesian?.current_streak ?? 0 },
        pattern_discovery: { weight: weights.pattern_discovery?.weight ?? 1, winRate: weights.pattern_discovery?.total_predictions > 0 ? `${(weights.pattern_discovery.win_rate * 100).toFixed(0)}%` : 'N/A', streak: weights.pattern_discovery?.current_streak ?? 0 },
        rl_optimizer: { weight: weights.rl_optimizer?.weight ?? 1, winRate: weights.rl_optimizer?.total_predictions > 0 ? `${(weights.rl_optimizer.win_rate * 100).toFixed(0)}%` : 'N/A', streak: weights.rl_optimizer?.current_streak ?? 0 },
      },
      aiReasoning: {
        betType: 'fusion_top5',
        betDescription: fusionReasoning,
        patternIdentified: `FUSÃO: ${top5.map(t => `${t.num}(${t.voters.length}v)`).join(' ')}`,
        suggestedBet: `TOP 5: [${top5Numbers.join(', ')}] — ${kelly.force.toUpperCase()} (${consensus}/7)`,
        consensus,
        confidence: fusionConfidence,
      },
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[omni-core] Error:', error);
    return new Response(JSON.stringify({
      mode: 'error',
      message: '⚠️ Erro no processamento — tentando novamente...',
      error: (error as Error).message,
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
