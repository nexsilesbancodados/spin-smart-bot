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

// Pull map (simplified — numbers that tend to follow each other on Brazilian Playtech)
const PULL_MAP: Record<number, number[]> = {};
for (let n = 0; n <= 36; n++) {
  // Neighbors on wheel + same terminal
  const neighbors = wheelNeighbors(n, 2).filter(x => x !== n);
  const terminal = n % 10;
  const termNums = [];
  for (let t = terminal; t <= 36; t += 10) if (t !== n) termNums.push(t);
  PULL_MAP[n] = [...new Set([...neighbors, ...termNums])];
}

// Sector groupings for momentum
const SECTOR_GROUPS: Record<string, number[]> = {
  voisins: Array.from(VOISINS),
  tiers: Array.from(TIERS),
  orphelins: Array.from(ORPHELINS),
};

// ═══════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════
interface ModelSignal {
  modelId: string;
  modelName: string;
  betType: string;
  label: string;
  numbers: number[];
  confidence: number;
  reasoning: string;
  predictedMain?: number;
}

interface ModelWeight {
  model_id: string;
  weight: number;
  win_rate: number;
  total_predictions: number;
  total_hits: number;
  current_streak: number;
}

// ═══════════════════════════════════════════════════════════════════
// MODELO 1: MARKOV CHAIN (APROFUNDADO)
// Auto-seleção de ordem, matriz multi-temporal, ruptura de padrão
// ═══════════════════════════════════════════════════════════════════
function modelMarkov(spins: number[]): ModelSignal[] {
  const signals: ModelSignal[] = [];
  if (spins.length < 20) return signals;

  // A. MATRIZ DE TRANSIÇÃO MULTI-TEMPORAL (37x37)
  const buildMatrix = (data: number[]): number[][] => {
    const m = Array.from({ length: 37 }, () => new Array(37).fill(0));
    for (let i = 0; i < data.length - 1; i++) {
      m[data[i + 1]][data[i]]++;
    }
    return m;
  };

  const matriz_50 = buildMatrix(spins.slice(0, Math.min(50, spins.length)));
  const matriz_200 = buildMatrix(spins.slice(0, Math.min(200, spins.length)));
  const matriz_500 = buildMatrix(spins.slice(0, Math.min(500, spins.length)));

  // Weighted score for each next number given last number
  const last = spins[0];
  const scores: Record<number, number> = {};
  for (let n = 0; n <= 36; n++) {
    const s50 = matriz_50[last]?.[n] || 0;
    const s200 = matriz_200[last]?.[n] || 0;
    const s500 = matriz_500[last]?.[n] || 0;
    const total50 = matriz_50[last]?.reduce((a: number, b: number) => a + b, 0) || 1;
    const total200 = matriz_200[last]?.reduce((a: number, b: number) => a + b, 0) || 1;
    const total500 = matriz_500[last]?.reduce((a: number, b: number) => a + b, 0) || 1;
    scores[n] = (s50 / total50) * 3.0 + (s200 / total200) * 2.0 + (s500 / total500) * 1.0;
  }

  // B. AUTO-SELEÇÃO DE ORDEM ÓTIMA (1-6)
  const orderWeights: Record<number, number> = {};
  let totalOrderWeight = 0;
  for (let order = 1; order <= Math.min(6, spins.length - 1); order++) {
    const transitions: Record<string, Record<string, number>> = {};
    for (let i = 0; i < spins.length - order; i++) {
      const key = spins.slice(i, i + order).reverse().join(',');
      if (!transitions[key]) transitions[key] = {};
      const next = `${spins[i + order]}`;
      transitions[key][next] = (transitions[key][next] || 0) + 1;
    }
    // Hit rate calculation on last 50 spins
    let hits = 0, attempts = 0;
    for (let i = 0; i < Math.min(50, spins.length - order - 1); i++) {
      const key = spins.slice(i, i + order).reverse().join(',');
      const trans = transitions[key];
      if (!trans) continue;
      const total = Object.values(trans).reduce((a, b) => a + b, 0);
      const predicted = Object.entries(trans).sort(([,a],[,b]) => b - a)[0];
      if (predicted) {
        attempts++;
        if (parseInt(predicted[0]) === spins[i + order]) hits++;
      }
    }
    const hitRate = attempts > 0 ? hits / attempts : 0;
    if (hitRate > 0.02) { // Lower threshold since exact number prediction is hard
      orderWeights[order] = hitRate;
      totalOrderWeight += hitRate;
    }

    // Add higher-order predictions to scores
    if (spins.length >= order) {
      const key = spins.slice(0, order).reverse().join(',');
      const trans = transitions[key];
      if (trans) {
        const transTotal = Object.values(trans).reduce((a, b) => a + b, 0);
        const w = totalOrderWeight > 0 ? (hitRate / totalOrderWeight) : (1 / 6);
        for (const [num, count] of Object.entries(trans)) {
          const n = parseInt(num);
          scores[n] = (scores[n] || 0) + (count / transTotal) * w * 2.0;
        }
      }
    }
  }

  // C. DETECÇÃO DE RUPTURA DE PADRÃO
  let ruptureDetected = false;
  if (spins.length >= 12) {
    const total50 = matriz_50[last]?.reduce((a: number, b: number) => a + b, 0) || 1;
    let avgTransProb = 0;
    for (let i = 0; i < Math.min(10, spins.length - 1); i++) {
      const from = spins[i + 1];
      const to = spins[i];
      const p = (matriz_50[from]?.[to] || 0) / (matriz_50[from]?.reduce((a: number, b: number) => a + b, 0) || 1);
      avgTransProb += p;
    }
    avgTransProb /= 10;
    if (avgTransProb < 0.02) { // Very low probability transitions
      ruptureDetected = true;
    }
  }

  // Get top predictions
  const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a);
  if (sorted.length >= 3 && !ruptureDetected) {
    const topNums = sorted.slice(0, 8).map(([n]) => parseInt(n));
    const topScore = sorted[0][1];
    const activeOrders = Object.keys(orderWeights).map(Number);
    const conf = Math.min(90, 45 + Math.round(topScore * 12));

    signals.push({
      modelId: 'markov',
      modelName: 'Markov Chain',
      betType: topNums.length <= 5 ? 'vizinhos' : 'grupo',
      label: `Markov (O${activeOrders.join('+')} multi-temporal) → [${topNums.slice(0, 5).join(',')}]`,
      numbers: topNums,
      confidence: conf,
      reasoning: `Matriz 37×37 multi-temporal (50/200/500g). ${ruptureDetected ? '⚡ Ruptura detectada!' : `Score: ${(topScore * 100).toFixed(0)}%`}. Ordens ativas: ${activeOrders.join(',')}`,
      predictedMain: topNums[0],
    });
  } else if (ruptureDetected) {
    signals.push({
      modelId: 'markov',
      modelName: 'Markov Chain',
      betType: 'ruptura',
      label: `Markov → ⚡ RUPTURA DETECTADA`,
      numbers: sorted.slice(0, 5).map(([n]) => parseInt(n)),
      confidence: 35,
      reasoning: `Ruptura de padrão: últimas 10 transições com probabilidade média muito baixa. Markov em modo aprendizado.`,
      predictedMain: parseInt(sorted[0]?.[0] ?? '0'),
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
  const currentColor = getColor(last);
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
          reasoning: `Transição de cor: após ${currentColor}, ${color} tem ${(prob * 100).toFixed(0)}%`,
        });
      }
    }
  }

  return signals;
}

// ═══════════════════════════════════════════════════════════════════
// MODELO 2: NEURAL PATTERN (APROFUNDADO)
// Sliding window multi-escala, ritmo do dealer, autocorrelação
// ═══════════════════════════════════════════════════════════════════
function modelNeuralPattern(spins: number[]): ModelSignal[] {
  const signals: ModelSignal[] = [];
  if (spins.length < 30) return signals;

  // A. SLIDING WINDOW MULTI-ESCALA
  const windowSizes = [3, 5, 7, 10, 15];
  for (const ws of windowSizes) {
    if (spins.length < ws + 10) continue;
    // Fingerprint: hash of numbers mod 10
    const currentFP = spins.slice(0, ws).map(n => n % 10).join('');
    let matchCount = 0;
    const nextNums: Record<number, number> = {};
    const searchLen = Math.min(500, spins.length);
    for (let i = ws; i < searchLen - ws - 3; i++) {
      const fp = spins.slice(i, i + ws).map(n => n % 10).join('');
      if (fp === currentFP) {
        matchCount++;
        // What came after this fingerprint?
        for (let j = 1; j <= 3 && (i - j) >= 0; j++) {
          const next = spins[i - j];
          nextNums[next] = (nextNums[next] || 0) + (4 - j); // Weight by proximity
        }
      }
    }
    if (matchCount >= 2 && Object.keys(nextNums).length > 0) {
      const sorted = Object.entries(nextNums).sort(([,a],[,b]) => b - a);
      const topNums = sorted.slice(0, 6).map(([n]) => parseInt(n));
      const conf = Math.min(82, 40 + matchCount * 8 + ws * 2);
      signals.push({
        modelId: 'neural_pattern',
        modelName: 'Neural Pattern',
        betType: 'fingerprint',
        label: `Neural FP${ws} → [${topNums.slice(0, 4).join(',')}] (${matchCount}x match)`,
        numbers: topNums,
        confidence: conf,
        reasoning: `Fingerprint janela-${ws} encontrado ${matchCount}x no histórico. Próximos mais prováveis: [${topNums.slice(0, 3).join(',')}]`,
        predictedMain: topNums[0],
      });
    }
  }

  // B. DETECTOR DE RITMO DO DEALER
  if (spins.length >= 7) {
    const arcs: number[] = [];
    for (let i = 0; i < Math.min(10, spins.length - 1); i++) {
      const pos1 = wheelPos(spins[i]);
      const pos2 = wheelPos(spins[i + 1]);
      if (pos1 >= 0 && pos2 >= 0) {
        const diff = Math.abs(pos1 - pos2);
        arcs.push(Math.min(diff, WL - diff));
      }
    }
    if (arcs.length >= 5) {
      const arcMean5 = arcs.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
      const arcStd5 = Math.sqrt(arcs.slice(0, 5).reduce((a, b) => a + (b - arcMean5) ** 2, 0) / 5);
      
      if (arcStd5 < 4) {
        // Dealer consistent — predict based on average arc
        const lastPos = wheelPos(spins[0]);
        if (lastPos >= 0) {
          const predictedPos = Math.round((lastPos + arcMean5) % WL);
          const predicted = WHEEL[predictedPos];
          const neighbors = wheelNeighbors(predicted, 2);
          const conf = Math.min(85, 60 + Math.round((4 - arcStd5) * 8));
          signals.push({
            modelId: 'neural_pattern',
            modelName: 'Neural Pattern',
            betType: 'dealer_rhythm',
            label: `Neural Dealer → ${predicted} (arco ${arcMean5.toFixed(1)}±${arcStd5.toFixed(1)})`,
            numbers: neighbors,
            confidence: conf,
            reasoning: `Dealer com arco médio ${arcMean5.toFixed(1)} posições (σ=${arcStd5.toFixed(1)}). Ponto previsto: ${predicted} + vizinhos`,
            predictedMain: predicted,
          });
        }
      }
    }
  }

  // C. AUTOCORRELAÇÃO TEMPORAL
  if (spins.length >= 15) {
    for (let lag = 1; lag <= 10; lag++) {
      if (spins.length < lag + 10) continue;
      let sumXY = 0, sumX = 0, sumY = 0, sumX2 = 0, sumY2 = 0;
      const n = Math.min(50, spins.length - lag);
      for (let i = 0; i < n; i++) {
        const x = spins[i];
        const y = spins[i + lag];
        sumXY += x * y;
        sumX += x;
        sumY += y;
        sumX2 += x * x;
        sumY2 += y * y;
      }
      const denom = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
      const corr = denom > 0 ? (n * sumXY - sumX * sumY) / denom : 0;
      
      if (Math.abs(corr) > 0.2) {
        const lagNum = spins[lag - 1]; // Number from lag positions ago
        const related = wheelNeighbors(lagNum, 3);
        signals.push({
          modelId: 'neural_pattern',
          modelName: 'Neural Pattern',
          betType: 'autocorrelacao',
          label: `Neural Lag-${lag} (r=${corr.toFixed(2)}) → vizinhos de ${lagNum}`,
          numbers: related,
          confidence: Math.min(72, 45 + Math.round(Math.abs(corr) * 60)),
          reasoning: `Autocorrelação lag-${lag}: r=${corr.toFixed(3)}. Número ${lagNum} (${lag} giros atrás) influenciando`,
          predictedMain: lagNum,
        });
        break; // Only the strongest lag
      }
    }
  }

  // Original sector concentration
  const w5: Record<string, number> = { voisins: 0, tiers: 0, orphelins: 0 };
  const w20: Record<string, number> = { voisins: 0, tiers: 0, orphelins: 0 };
  spins.slice(0, 5).forEach(n => { const s = getSector(n); if (s !== 'zero') w5[s]++; });
  spins.slice(0, 20).forEach(n => { const s = getSector(n); if (s !== 'zero') w20[s]++; });
  for (const sector of ['voisins', 'tiers', 'orphelins'] as const) {
    const short = w5[sector] / 5;
    const long = w20[sector] / 20;
    if (short > 0.45 && long > 0.35) {
      const sectorNums = Array.from(sector === 'voisins' ? VOISINS : sector === 'tiers' ? TIERS : ORPHELINS);
      signals.push({
        modelId: 'neural_pattern',
        modelName: 'Neural Pattern',
        betType: 'setor',
        label: `Neural → ${sector.charAt(0).toUpperCase() + sector.slice(1)}`,
        numbers: sectorNums,
        confidence: Math.min(85, 55 + Math.round((short + long) * 25)),
        reasoning: `${sector} concentrou ${(short * 100).toFixed(0)}% (5g) e ${(long * 100).toFixed(0)}% (20g)`,
      });
    }
  }

  return signals;
}

// ═══════════════════════════════════════════════════════════════════
// MODELO 3: GRADIENT BOOSTING (mantido com melhorias menores)
// ═══════════════════════════════════════════════════════════════════
function modelGradient(spins: number[]): ModelSignal[] {
  const signals: ModelSignal[] = [];
  if (spins.length < 20) return signals;

  const numScores: { num: number; score: number; features: string[] }[] = [];
  for (let n = 0; n <= 36; n++) {
    let score = 0;
    const feats: string[] = [];

    const lastIdx = spins.indexOf(n);
    const recency = lastIdx >= 0 ? lastIdx : spins.length;
    score += Math.min(1, recency / 50) * 25;
    if (recency > 30) feats.push(`ausente ${recency}g`);

    const w50 = spins.slice(0, Math.min(50, spins.length));
    const freq50 = w50.filter(x => x === n).length;
    const expected50 = w50.length / 37;
    const freqDev = (freq50 - expected50) / Math.max(1, Math.sqrt(expected50));
    if (freqDev < -1.2) { score += Math.min(20, Math.abs(freqDev) * 8); feats.push(`frio (${freqDev.toFixed(1)}σ)`); }
    else if (freqDev > 1.5) { score += Math.min(15, freqDev * 5); feats.push(`quente (${freqDev.toFixed(1)}σ)`); }

    const neighbors = wheelNeighbors(n, 3);
    const neighborHits = spins.slice(0, 10).filter(x => neighbors.includes(x)).length;
    if (neighborHits >= 3) { score += neighborHits * 5; feats.push(`${neighborHits} vizinhos`); }

    const terminal = n % 10;
    const termCount = spins.slice(0, 15).filter(x => x % 10 === terminal).length;
    if (termCount >= 4) { score += 8; feats.push(`T${terminal} quente`); }

    numScores.push({ num: n, score, features: feats });
  }

  numScores.sort((a, b) => b.score - a.score);
  const topNums = numScores.slice(0, 10);
  const maxScore = topNums[0].score;

  if (maxScore > 30) {
    signals.push({
      modelId: 'gradient',
      modelName: 'Gradient Boost',
      betType: 'grupo',
      label: `GBM → [${topNums.slice(0, 6).map(t => t.num).join(',')}]`,
      numbers: topNums.map(t => t.num),
      confidence: Math.min(87, 45 + Math.round(maxScore * 0.8)),
      reasoning: `Gradient: ${topNums[0].num} lidera (score ${maxScore.toFixed(0)}: ${topNums[0].features.join(', ')})`,
      predictedMain: topNums[0].num,
    });
  }

  return signals;
}

// ═══════════════════════════════════════════════════════════════════
// MODELO 4: BAYESIANO DINÂMICO (APROFUNDADO)
// Prior adaptativo, múltiplas hipóteses, likelihood decay
// ═══════════════════════════════════════════════════════════════════
function modelBayesian(spins: number[]): ModelSignal[] {
  const signals: ModelSignal[] = [];
  if (spins.length < 15) return signals;

  // A. PRIOR ADAPTATIVO (baseado em 500 giros, não uniforme)
  const histWindow = spins.slice(0, Math.min(500, spins.length));
  const prior = new Array(37).fill(0);
  for (const n of histWindow) prior[n]++;
  const priorTotal = histWindow.length;
  for (let i = 0; i <= 36; i++) prior[i] = Math.max(0.5, prior[i]) / (priorTotal + 37 * 0.5);

  // B. MÚLTIPLAS HIPÓTESES SIMULTÂNEAS
  const last = spins[0];
  const hypotheses: { name: string; id: string; priors: number[] }[] = [
    // H1: Auto-repetição
    { name: 'Auto-repetição', id: 'H1', priors: (() => {
      const p = new Array(37).fill(0.005);
      p[last] = 0.8;
      const neighbors = wheelNeighbors(last, 2);
      for (const n of neighbors) p[n] = Math.max(p[n], 0.03);
      const sum = p.reduce((a, b) => a + b);
      return p.map(v => v / sum);
    })() },
    // H2: Puxada
    { name: 'Puxada', id: 'H2', priors: (() => {
      const p = new Array(37).fill(0.005);
      const pulls = PULL_MAP[last] || [];
      for (const n of pulls) p[n] = 0.12;
      const sum = p.reduce((a, b) => a + b);
      return p.map(v => v / sum);
    })() },
    // H3: Reversão terminal (terminais frios)
    { name: 'Reversão Terminal', id: 'H3', priors: (() => {
      const p = new Array(37).fill(0.01);
      const termFreq: Record<number, number> = {};
      spins.slice(0, 30).forEach(n => { termFreq[n % 10] = (termFreq[n % 10] || 0) + 1; });
      // Boost cold terminals
      for (let t = 0; t <= 9; t++) {
        const freq = termFreq[t] || 0;
        const expected = 30 / 10;
        if (freq < expected * 0.6) {
          for (let n = t; n <= 36; n += 10) p[n] = 0.08;
        }
      }
      const sum = p.reduce((a, b) => a + b);
      return p.map(v => v / sum);
    })() },
    // H4: Mesa normal (prior histórico)
    { name: 'Normal', id: 'H4', priors: [...prior] },
  ];

  // C. LIKELIHOOD DECAY
  // Detect change speed via entropy of last 20 transitions
  const recent20 = spins.slice(0, Math.min(20, spins.length));
  const freqMap: Record<number, number> = {};
  recent20.forEach(n => { freqMap[n] = (freqMap[n] || 0) + 1; });
  let entropy = 0;
  for (const count of Object.values(freqMap)) {
    const p = count / recent20.length;
    if (p > 0) entropy -= p * Math.log2(p);
  }
  const maxEntropy = Math.log2(37);
  const lambda = 0.02 + (entropy / maxEntropy) * 0.08; // Faster decay if high entropy

  // Evaluate each hypothesis
  let bestH = hypotheses[0];
  let bestLikelihood = -Infinity;

  for (const h of hypotheses) {
    let logLikelihood = 0;
    const window = spins.slice(0, Math.min(30, spins.length));
    for (let i = 0; i < window.length; i++) {
      const w = Math.exp(-i * lambda);
      const p = Math.max(1e-10, h.priors[window[i]]);
      logLikelihood += w * Math.log(p);
    }
    if (logLikelihood > bestLikelihood) {
      bestLikelihood = logLikelihood;
      bestH = h;
    }
  }

  // Generate signal from best hypothesis
  const posteriors = new Array(37).fill(0);
  const counts = new Array(37).fill(0);
  for (let i = 0; i < Math.min(200, spins.length); i++) {
    const w = Math.exp(-i * lambda);
    counts[spins[i]] += w;
  }
  const totalCounts = counts.reduce((a: number, b: number) => a + b, 0);
  for (let i = 0; i <= 36; i++) {
    posteriors[i] = (bestH.priors[i] * 100 + counts[i]) / (100 + totalCounts);
  }

  const ranked = posteriors.map((p, i) => ({ num: i, prob: p })).sort((a, b) => b.prob - a.prob);
  const topNums = ranked.slice(0, 8).map(r => r.num);
  const klDiv = posteriors.reduce((acc, p, i) => {
    const u = 1 / 37;
    return acc + (p > 0 ? p * Math.log(p / u) : 0);
  }, 0);

  if (klDiv > 0.03) {
    signals.push({
      modelId: 'bayesian',
      modelName: 'Bayesiano Dinâmico',
      betType: 'grupo',
      label: `Bayes ${bestH.id} (${bestH.name}) → [${topNums.slice(0, 5).join(',')}]`,
      numbers: topNums,
      confidence: Math.min(88, 48 + Math.round(klDiv * 180)),
      reasoning: `Hipótese dominante: ${bestH.name} (KL=${klDiv.toFixed(3)}, λ=${lambda.toFixed(3)}, entropy=${entropy.toFixed(2)})`,
      predictedMain: topNums[0],
    });
  }

  // Dozen reversal
  for (let dz = 1; dz <= 3; dz++) {
    let absence = 0;
    for (const n of spins) {
      if (n === 0) { absence++; continue; }
      if (getDozen(n) === dz) break;
      absence++;
    }
    if (absence >= 8) {
      const dzNums = Array.from({ length: 12 }, (_, i) => (dz - 1) * 12 + i + 1);
      signals.push({
        modelId: 'bayesian',
        modelName: 'Bayesiano Dinâmico',
        betType: 'duzia',
        label: `Bayes → ${dz}ª Dúzia (reversão, ${absence}g)`,
        numbers: dzNums,
        confidence: Math.min(84, 55 + Math.round(absence * 2)),
        reasoning: `${dz}ª Dúzia ausente ${absence}g — posterior elevada`,
      });
    }
  }

  return signals;
}

// ═══════════════════════════════════════════════════════════════════
// MODELO 5: ESTATÍSTICO CLÁSSICO (mantido)
// ═══════════════════════════════════════════════════════════════════
function modelStatistical(spins: number[]): ModelSignal[] {
  const signals: ModelSignal[] = [];
  if (spins.length < 10) return signals;

  const window = spins.slice(0, 50);

  // Color streak
  const colors = spins.map(getColor);
  let colorStreak = 1;
  for (let i = 1; i < colors.length; i++) {
    if (colors[i] === colors[0] && colors[0] !== 'green') colorStreak++;
    else break;
  }
  if (colorStreak >= 5) {
    const opposite = colors[0] === 'red' ? 'black' : 'red';
    signals.push({
      modelId: 'statistical',
      modelName: 'Estatístico Clássico',
      betType: 'cor',
      label: `${opposite === 'red' ? 'VERM' : 'PRETO'} (${colorStreak}x streak)`,
      numbers: Array.from({ length: 37 }, (_, i) => i).filter(n => getColor(n) === opposite),
      confidence: Math.min(92, 70 + (colorStreak - 5) * 5),
      reasoning: `${colorStreak} ${colors[0] === 'red' ? 'vermelhos' : 'pretos'} consecutivos`,
    });
  }

  // Dozen absence
  for (let dz = 1; dz <= 3; dz++) {
    let absence = 0;
    for (const n of window) {
      if (n === 0) { absence++; continue; }
      if (getDozen(n) === dz) break;
      absence++;
    }
    if (absence >= 7) {
      signals.push({
        modelId: 'statistical',
        modelName: 'Estatístico Clássico',
        betType: 'duzia',
        label: `${dz}ª Dúzia (ausente ${absence}g)`,
        numbers: Array.from({ length: 12 }, (_, i) => (dz - 1) * 12 + i + 1),
        confidence: Math.min(90, 60 + (absence - 7) * 4),
        reasoning: `${dz}ª Dúzia ausente há ${absence} giros`,
      });
    }
  }

  // Sector analysis
  const recent = spins.slice(0, 30);
  const sectorCounts: Record<string, number> = { voisins: 0, tiers: 0, orphelins: 0 };
  recent.forEach(n => { const s = getSector(n); if (s !== 'zero') sectorCounts[s]++; });
  const sectorExpected: Record<string, number> = { voisins: 17/37*30, tiers: 12/37*30, orphelins: 8/37*30 };
  for (const [sector, count] of Object.entries(sectorCounts)) {
    const expected = sectorExpected[sector];
    if (!expected) continue;
    const ratio = count / expected;
    if (ratio > 1.35 && count >= 5) {
      const sectorNums = Array.from(sector === 'voisins' ? VOISINS : sector === 'tiers' ? TIERS : ORPHELINS);
      signals.push({
        modelId: 'statistical',
        modelName: 'Estatístico Clássico',
        betType: 'setor',
        label: `${sector} (HOT ${(ratio*100-100).toFixed(0)}%+)`,
        numbers: sectorNums,
        confidence: Math.min(82, 55 + Math.round((ratio - 1) * 40)),
        reasoning: `Setor ${sector} ${count}/${recent.length} (${(ratio*100-100).toFixed(0)}% acima)`,
      });
    }
  }

  return signals;
}

// ═══════════════════════════════════════════════════════════════════
// MODELO 6: PATTERN DISCOVERY (mantido)
// ═══════════════════════════════════════════════════════════════════
function modelPatternDiscovery(spins: number[]): ModelSignal[] {
  const signals: ModelSignal[] = [];
  if (spins.length < 50) return signals;

  const followers: Record<number, number> = {};
  const currentPair = `${spins[0]},${spins[1]}`;
  for (let i = 0; i < spins.length - 2; i++) {
    const p = `${spins[i + 1]},${spins[i]}`;
    if (p === currentPair && i > 0) {
      followers[spins[i - 1]] = (followers[spins[i - 1]] || 0) + 1;
    }
  }
  const totalFollowers = Object.values(followers).reduce((a, b) => a + b, 0);
  if (totalFollowers >= 3) {
    const sorted = Object.entries(followers).sort(([, a], [, b]) => b - a);
    const topNums = sorted.slice(0, 6).map(([n]) => parseInt(n));
    const topProb = sorted[0][1] / totalFollowers;
    if (topProb > 0.15) {
      signals.push({
        modelId: 'pattern_discovery',
        modelName: 'Pattern Discovery',
        betType: 'grupo',
        label: `Padrão ${spins[1]}→${spins[0]}→? → [${topNums.slice(0, 4).join(',')}]`,
        numbers: topNums,
        confidence: Math.min(85, 45 + Math.round(topProb * 100) + Math.min(20, totalFollowers * 2)),
        reasoning: `Regra: após [${spins[1]},${spins[0]}], [${topNums.slice(0,3).join(',')}] apareceram ${sorted[0][1]}/${totalFollowers}x`,
        predictedMain: topNums[0],
      });
    }
  }

  return signals;
}

// ═══════════════════════════════════════════════════════════════════
// MODELO 7: RL OPTIMIZER (APROFUNDADO)
// Q-Table persistida, epsilon-greedy, reward shaping
// ═══════════════════════════════════════════════════════════════════
function modelRLOptimizer(spins: number[], weights: Record<string, ModelWeight>, qTable: Record<string, Record<string, { q: number; visits: number }>>): ModelSignal[] {
  const signals: ModelSignal[] = [];
  if (spins.length < 30) return signals;

  const last = spins[0];
  const terminal = last % 10;
  const sector = getSector(last);
  const zeroQuadrant = wheelPos(last) < 9 ? 'Q1' : wheelPos(last) < 18 ? 'Q2' : wheelPos(last) < 27 ? 'Q3' : 'Q4';
  const state = `L${last}_T${terminal}_S${sector}_Z${zeroQuadrant}`;

  const actions = ['auto_rep', 'pull', 'terminal_hot', 'debt', 'sector'];
  
  // Get Q-values for current state
  const stateQ = qTable[state] || {};
  
  // Epsilon-greedy: exploit with highest Q, or explore
  const totalRounds = Object.values(weights).reduce((a, w) => a + w.total_predictions, 0);
  const epsilon = Math.max(0.05, 0.3 - totalRounds * 0.001);
  
  let bestAction: string;
  if (Math.random() < epsilon) {
    bestAction = actions[Math.floor(Math.random() * actions.length)];
  } else {
    bestAction = actions.reduce((best, a) => 
      (stateQ[a]?.q ?? 0) > (stateQ[best]?.q ?? 0) ? a : best, actions[0]);
  }

  // Generate numbers based on chosen action
  let nums: number[] = [];
  let label = '';
  const recent = spins.slice(0, 20);
  const qVal = stateQ[bestAction]?.q ?? 0;
  const visits = stateQ[bestAction]?.visits ?? 0;

  switch (bestAction) {
    case 'auto_rep':
      nums = [last, ...wheelNeighbors(last, 2).filter(n => n !== last)];
      label = `RL → Auto-Rep ${last}`;
      break;
    case 'pull':
      nums = PULL_MAP[last] || wheelNeighbors(last, 3);
      label = `RL → Puxada de ${last}`;
      break;
    case 'terminal_hot': {
      const termFreq: Record<number, number> = {};
      recent.forEach(n => { termFreq[n % 10] = (termFreq[n % 10] || 0) + 1; });
      const hotT = Object.entries(termFreq).sort(([,a],[,b]) => b - a)[0];
      const t = Number(hotT[0]);
      nums = [];
      for (let n = t; n <= 36; n += 10) nums.push(n);
      label = `RL → Terminal T${t}`;
      break;
    }
    case 'debt': {
      const absences: { num: number; absence: number }[] = [];
      for (let n = 0; n <= 36; n++) {
        const idx = spins.indexOf(n);
        absences.push({ num: n, absence: idx < 0 ? spins.length : idx });
      }
      absences.sort((a, b) => b.absence - a.absence);
      nums = absences.slice(0, 8).map(a => a.num);
      label = `RL → Dívida (${nums[0]} ausente ${absences[0].absence}g)`;
      break;
    }
    case 'sector': {
      const sCounts: Record<string, number> = { voisins: 0, tiers: 0, orphelins: 0 };
      recent.forEach(n => { const s = getSector(n); if (s !== 'zero') sCounts[s]++; });
      const hotS = Object.entries(sCounts).sort(([,a],[,b]) => b - a)[0][0];
      nums = SECTOR_GROUPS[hotS] || [];
      label = `RL → Setor ${hotS}`;
      break;
    }
  }

  if (nums.length > 0) {
    const evEstimate = qVal > 0 ? qVal : 0;
    signals.push({
      modelId: 'rl_optimizer',
      modelName: 'RL Optimizer',
      betType: bestAction,
      label: `${label} (Q=${qVal.toFixed(2)}, ε=${epsilon.toFixed(2)})`,
      numbers: nums.slice(0, 10),
      confidence: Math.min(82, 40 + Math.round(Math.max(0, qVal) * 30) + Math.min(20, visits)),
      reasoning: `RL ε-greedy: ação "${bestAction}" para estado ${state}. Q=${qVal.toFixed(3)}, visitas=${visits}, EV≈${evEstimate.toFixed(2)}`,
      predictedMain: nums[0],
    });
  }

  return signals;
}

// ═══════════════════════════════════════════════════════════════════
// MODELO 8: MOMENTUM ANALYSIS (NOVO)
// Analisa aceleração e direção de tendências
// ═══════════════════════════════════════════════════════════════════
function modelMomentum(spins: number[]): ModelSignal[] {
  const signals: ModelSignal[] = [];
  if (spins.length < 20) return signals;

  // A. MOMENTUM DE SETOR
  for (const [sectorName, sectorNums] of Object.entries(SECTOR_GROUPS)) {
    const freq5 = spins.slice(0, 5).filter(n => sectorNums.includes(n)).length;
    const freq15 = spins.slice(0, 15).filter(n => sectorNums.includes(n)).length || 1;
    const momentum = (freq5 / 5) / (freq15 / 15) - 1;
    if (momentum > 0.5) {
      signals.push({
        modelId: 'momentum',
        modelName: 'Momentum',
        betType: 'setor_momentum',
        label: `Momentum → ${sectorName} acelerando (+${(momentum * 100).toFixed(0)}%)`,
        numbers: sectorNums,
        confidence: Math.min(78, 50 + Math.round(momentum * 25)),
        reasoning: `Setor ${sectorName}: ${freq5}/5 recentes vs ${freq15}/15 médio = momentum +${(momentum * 100).toFixed(0)}%`,
      });
    }
  }

  // B. MOMENTUM DE TERMINAL
  for (let t = 0; t <= 9; t++) {
    const termNums: number[] = [];
    for (let n = t; n <= 36; n += 10) termNums.push(n);
    const freq5 = spins.slice(0, 5).filter(n => n % 10 === t).length;
    const freq15 = spins.slice(0, 15).filter(n => n % 10 === t).length || 1;
    const momentum = (freq5 / 5) / (freq15 / 15);
    if (momentum > 1.8 && freq5 >= 2) {
      signals.push({
        modelId: 'momentum',
        modelName: 'Momentum',
        betType: 'terminal_momentum',
        label: `Momentum → T${t} acelerando (${momentum.toFixed(1)}x)`,
        numbers: termNums,
        confidence: Math.min(78, 48 + Math.round(momentum * 12)),
        reasoning: `Terminal T${t}: ${freq5}/5 recentes, momentum ${momentum.toFixed(1)}x`,
        predictedMain: termNums[0],
      });
    }
  }

  // C. EMA DE NÚMERO HOT
  const ema = new Array(37).fill(0);
  const alphaEma = 0.3;
  // Process from oldest to newest
  for (let i = Math.min(50, spins.length) - 1; i >= 0; i--) {
    for (let n = 0; n <= 36; n++) {
      ema[n] = alphaEma * (spins[i] === n ? 1 : 0) + (1 - alphaEma) * ema[n];
    }
  }
  const emaRanked = ema.map((v, i) => ({ num: i, ema: v })).sort((a, b) => b.ema - a.ema);
  const topEma = emaRanked.slice(0, 5);
  if (topEma[0].ema > 0.1) {
    signals.push({
      modelId: 'momentum',
      modelName: 'Momentum',
      betType: 'ema_hot',
      label: `Momentum EMA → [${topEma.map(t => t.num).join(',')}]`,
      numbers: topEma.map(t => t.num),
      confidence: Math.min(78, Math.round(topEma[0].ema * 100 * 2.5)),
      reasoning: `EMA top: ${topEma[0].num} (${(topEma[0].ema * 100).toFixed(1)}%), momentum crescente`,
      predictedMain: topEma[0].num,
    });
  }

  // D. BREAKOUT DETECTOR
  for (let n = 0; n <= 36; n++) {
    const count20 = spins.slice(0, 20).filter(x => x === n).length;
    const count50 = spins.slice(0, Math.min(50, spins.length)).filter(x => x === n).length;
    if (count20 === 0 && count50 >= 3) {
      signals.push({
        modelId: 'momentum',
        modelName: 'Momentum',
        betType: 'breakout',
        label: `Momentum → Breakout #${n} (0/20 mas ${count50}/50)`,
        numbers: [n, ...wheelNeighbors(n, 2).filter(x => x !== n)],
        confidence: Math.min(72, 40 + count50 * 6),
        reasoning: `Breakout: ${n} ausente 20g mas ${count50}x nos últimos 50 — reversão iminente`,
        predictedMain: n,
      });
      break; // Only strongest breakout
    }
  }

  return signals;
}

// ═══════════════════════════════════════════════════════════════════
// MODELO 9: CONVERGÊNCIA MULTI-INDICADOR (NOVO)
// Meta-modelo que agrega indicadores primitivos
// ═══════════════════════════════════════════════════════════════════
function modelConvergence(spins: number[]): ModelSignal[] {
  if (spins.length < 15) return [];

  const votes: Record<number, { count: number; indicators: string[] }> = {};
  const vote = (n: number, indicator: string) => {
    if (n < 0 || n > 36) return;
    if (!votes[n]) votes[n] = { count: 0, indicators: [] };
    votes[n].count++;
    votes[n].indicators.push(indicator);
  };

  const last = spins[0];

  // Indicador 1: Auto-repetição
  let streak = 1;
  for (let i = 1; i < spins.length; i++) { if (spins[i] === last) streak++; else break; }
  if (streak >= 2) vote(last, `streak${streak}x`);

  // Indicador 2: Puxada direta
  for (const n of (PULL_MAP[last] || [])) vote(n, `pull_${last}`);

  // Indicador 3: Double pull
  if (spins.length >= 2) {
    const pull0 = PULL_MAP[spins[0]] || [];
    const pull1 = PULL_MAP[spins[1]] || [];
    const intersection = pull0.filter(n => pull1.includes(n));
    for (const n of intersection) vote(n, 'double_pull');
    
    // Indicador 4: Triple pull
    if (spins.length >= 3) {
      const pull2 = PULL_MAP[spins[2]] || [];
      const tripleInt = intersection.filter(n => pull2.includes(n));
      for (const n of tripleInt) vote(n, 'triple_pull');
    }
  }

  // Indicador 5: Terminal dominante
  const termFreq: Record<number, number> = {};
  spins.slice(0, 10).forEach(n => { termFreq[n % 10] = (termFreq[n % 10] || 0) + 1; });
  const sortedTerms = Object.entries(termFreq).sort(([,a],[,b]) => b - a);
  if (sortedTerms.length > 0 && Number(sortedTerms[0][1]) >= 4) {
    const t = Number(sortedTerms[0][0]);
    for (let n = t; n <= 36; n += 10) vote(n, `terminal_T${t}`);
  }

  // Indicador 6: Dívida estatística
  for (let n = 0; n <= 36; n++) {
    const lastIdx = spins.indexOf(n);
    const absence = lastIdx < 0 ? spins.length : lastIdx;
    const expected = spins.length / 37;
    if (absence > expected * 2) vote(n, `debt_${absence}g`);
  }

  // Indicador 7: Vizinhos do número quente
  const freq20: Record<number, number> = {};
  spins.slice(0, 20).forEach(n => { freq20[n] = (freq20[n] || 0) + 1; });
  const hotNumEntry = Object.entries(freq20).sort(([,a],[,b]) => b - a)[0];
  if (hotNumEntry && Number(hotNumEntry[1]) >= 3) {
    const h = Number(hotNumEntry[0]);
    const wIdx = WHEEL.indexOf(h);
    if (wIdx >= 0) {
      for (let d = 1; d <= 2; d++) {
        vote(WHEEL[((wIdx + d) % WL + WL) % WL], `neighbor_${h}`);
        vote(WHEEL[((wIdx - d) % WL + WL) % WL], `neighbor_${h}`);
      }
    }
  }

  // Indicador 8: Zero pressure
  const zeroAbs = spins.indexOf(0);
  const zeroAbsence = zeroAbs < 0 ? spins.length : zeroAbs;
  if (zeroAbsence > 30) {
    for (const n of [0, 32, 15, 26, 3, 35, 12]) vote(n, `zero_${zeroAbsence}g`);
  }

  // Rank by vote count
  const ranked = Object.entries(votes)
    .filter(([, v]) => v.count >= 2)
    .sort(([, a], [, b]) => b.count - a.count);

  if (ranked.length === 0) return [];

  const topNums = ranked.slice(0, 8).map(([n]) => Number(n));
  const topVotes = ranked[0][1].count;
  const confidence = Math.min(95, 30 + topVotes * 13 + ranked.filter(([, v]) => v.count >= 3).length * 5);

  return [{
    modelId: 'convergence',
    modelName: 'Convergência',
    betType: 'convergencia',
    label: `Convergência ${topVotes} indicadores → ${topNums[0]}`,
    numbers: topNums,
    confidence,
    reasoning: `${topNums[0]} confirmado por: ${ranked[0][1].indicators.join(', ')}`,
    predictedMain: topNums[0],
  }];
}

// ═══════════════════════════════════════════════════════════════════
// ENSEMBLE VOTING (3 RODADAS)
// ═══════════════════════════════════════════════════════════════════
function ensembleVote3Rounds(
  allSignals: ModelSignal[],
  weights: Record<string, ModelWeight>,
): {
  winner: ModelSignal;
  consensus: number;
  ensembleConfidence: number;
  scored: Array<ModelSignal & { score: number }>;
  debateLog: Array<{ modelId: string; modelName: string; numbers: number[]; confidence: number; reasoning: string; score: number }>;
  consensusMap: Record<number, number>;
  killSwitch: boolean;
  killReason?: string;
  temperatureFactor: number;
  entryAction: string;
} {
  // INDICATOR BOOSTS
  const indicatorBoost: Record<string, number> = {
    convergence: 1.5,
    rl_optimizer: 1.3,
    markov: 1.2,
    momentum: 1.1,
  };

  // RODADA 1 — Coleta de votos
  const voteScores: Record<number, number> = {};
  const voterMap: Record<number, Set<string>> = {};

  const scored = allSignals.map(s => {
    const mw = weights[s.modelId]?.weight ?? 1.0;
    const boost = indicatorBoost[s.modelId] ?? 1.0;
    const score = s.confidence * mw * boost;
    
    // Accumulate votes per number
    for (const n of s.numbers) {
      voteScores[n] = (voteScores[n] || 0) + score / s.numbers.length;
      if (!voterMap[n]) voterMap[n] = new Set();
      voterMap[n].add(s.modelId);
    }
    if (s.predictedMain !== undefined) {
      voteScores[s.predictedMain] = (voteScores[s.predictedMain] || 0) + score * 0.5;
      if (!voterMap[s.predictedMain]) voterMap[s.predictedMain] = new Set();
      voterMap[s.predictedMain].add(s.modelId);
    }

    return { ...s, score };
  });
  scored.sort((a, b) => b.score - a.score);

  // RODADA 2 — Validação por consenso
  const consensusMap: Record<number, number> = {};
  const top15 = Object.entries(voteScores).sort(([,a],[,b]) => b - a).slice(0, 15);
  
  for (const [numStr] of top15) {
    const n = parseInt(numStr);
    const voterCount = voterMap[n]?.size ?? 0;
    consensusMap[n] = voterCount;
    
    let multiplier = 1.0;
    if (voterCount >= 4) multiplier = 1.5;
    else if (voterCount >= 3) multiplier = 1.25;
    else if (voterCount <= 1) multiplier = 0.6;
    
    voteScores[n] *= multiplier;
  }

  // RODADA 3 — Decisão final com kill switch
  const modelWRs = Object.values(weights).filter(w => w.total_predictions >= 3);
  const avgWR = modelWRs.length > 0
    ? modelWRs.reduce((a, w) => a + w.win_rate, 0) / modelWRs.length
    : 0.35;

  let killSwitch = false;
  let killReason: string | undefined;
  let temperatureFactor = 1.0;

  if (avgWR < 0.25) {
    killSwitch = true;
    killReason = '⚠️ Anomalia: todos os modelos < 25% WR nos últimos giros. Sinais suspensos.';
    temperatureFactor = 0;
  } else if (avgWR < 0.35) {
    temperatureFactor = 0.6;
  } else if (avgWR > 0.45) {
    temperatureFactor = 1.15;
  }

  // Final decision
  const finalSorted = Object.entries(voteScores).sort(([,a],[,b]) => b - a);
  const mainNum = parseInt(finalSorted[0]?.[0] ?? '0');
  const finalNumbers = finalSorted.slice(0, 8).map(([n]) => parseInt(n));
  const mainConsensus = consensusMap[mainNum] ?? 0;

  // Weighted average confidence
  const topSignals = scored.slice(0, 5);
  const totalW = topSignals.reduce((a, b) => a + (weights[b.modelId]?.weight ?? 1), 0);
  const avgConf = totalW > 0
    ? topSignals.reduce((a, b) => a + b.confidence * (weights[b.modelId]?.weight ?? 1), 0) / totalW
    : 50;
  const ensembleConfidence = Math.min(95, Math.round(avgConf * temperatureFactor));

  // Entry action
  let entryAction = 'AGUARDAR';
  if (!killSwitch) {
    if (mainConsensus >= 5 && ensembleConfidence >= 70) entryAction = 'ENTRAR_FORTE';
    else if (mainConsensus >= 3 && ensembleConfidence >= 55) entryAction = 'ENTRAR';
    else if (mainConsensus >= 2 && ensembleConfidence >= 45) entryAction = 'ENTRAR_LEVE';
  }

  // Build debate log (per-model summary)
  const debateLog = scored.slice(0, 12).map(s => ({
    modelId: s.modelId,
    modelName: s.modelName,
    numbers: s.numbers.slice(0, 6),
    confidence: s.confidence,
    reasoning: s.reasoning,
    score: Math.round(s.score * 10) / 10,
  }));

  // Create winner signal
  const winner: ModelSignal = scored[0] || {
    modelId: 'ensemble',
    modelName: 'Ensemble',
    betType: 'fusion',
    label: 'Sem sinal',
    numbers: [],
    confidence: 0,
    reasoning: 'Sem dados suficientes',
  };

  return {
    winner,
    consensus: mainConsensus,
    ensembleConfidence,
    scored,
    debateLog,
    consensusMap,
    killSwitch,
    killReason,
    temperatureFactor,
    entryAction,
  };
}

// ═══════════════════════════════════════════════════════════════════
// KELLY + TEMPERATURE
// ═══════════════════════════════════════════════════════════════════
function computeKelly(winRate: number, odds: number): { fraction: number; force: 'leve' | 'padrao' | 'forte' } {
  const p = Math.max(0.01, Math.min(0.99, winRate));
  const q = 1 - p;
  const b = Math.max(1, odds);
  const kelly = Math.max(0, (b * p - q) / b);
  const force = kelly >= 0.12 ? 'forte' : kelly >= 0.05 ? 'padrao' : 'leve';
  return { fraction: kelly, force };
}

function getTemperature(weights: Record<string, ModelWeight>): 'fria' | 'morna' | 'quente' | 'caotica' {
  const models = Object.values(weights).filter(w => w.total_predictions >= 3);
  if (models.length === 0) return 'morna';
  const avgRate = models.reduce((a, w) => a + w.win_rate, 0) / models.length;
  if (avgRate < 0.30) return 'caotica';
  if (avgRate < 0.40) return 'fria';
  if (avgRate > 0.55 || models.some(w => w.current_streak >= 4)) return 'quente';
  return 'morna';
}

// ═══════════════════════════════════════════════════════════════════
// FEEDBACK LOOP & RECALIBRATION
// ═══════════════════════════════════════════════════════════════════
async function recalibrateWeights(supabase: any) {
  const { data: predictions } = await supabase
    .from('model_predictions')
    .select('model_id, hit, created_at')
    .not('hit', 'is', null)
    .order('created_at', { ascending: false })
    .limit(200);

  if (!predictions || predictions.length < 5) return;

  const modelStats: Record<string, { hits: number; total: number; streak: number }> = {};
  const modelRecent: Record<string, boolean[]> = {};

  for (const pred of predictions) {
    if (!modelStats[pred.model_id]) modelStats[pred.model_id] = { hits: 0, total: 0, streak: 0 };
    modelStats[pred.model_id].total++;
    if (pred.hit) modelStats[pred.model_id].hits++;
    if (!modelRecent[pred.model_id]) modelRecent[pred.model_id] = [];
    if (modelRecent[pred.model_id].length < 30) modelRecent[pred.model_id].push(pred.hit);
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

  // UCB1 + performance weight (Melhoria 8A)
  const totalRounds = predictions.length;
  for (const [modelId, stats] of Object.entries(modelStats)) {
    const winRate = stats.total > 0 ? stats.hits / stats.total : 0.5;
    const ucbBonus = stats.total > 0 ? Math.sqrt(2 * Math.log(totalRounds) / stats.total) : 1;
    
    // Performance-based: hit → *1.08, miss → *0.93
    let perfWeight = winRate * 2; // Scale up
    if (stats.streak >= 3) perfWeight *= 1.08;
    if (stats.streak <= -2) perfWeight *= 0.93;
    
    const weight = Math.max(0.1, Math.min(3.0, perfWeight * 0.7 + ucbBonus * 0.3));

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

  // Melhoria 8C: Calibração automática de thresholds (stored in context_memory)
  try {
    const hitScores = predictions.filter((p: any) => p.hit).length;
    const optimalThreshold = predictions.length > 0 ? Math.round((hitScores / predictions.length) * 100 * 0.6) : 50;
    await supabase.from('context_memory').upsert({
      context_hash: 'global_threshold',
      context_description: `Optimal threshold: ${optimalThreshold}`,
      hit_count: hitScores,
      error_count: predictions.length - hitScores,
      confidence_penalty: 0,
      last_seen_at: new Date().toISOString(),
    }, { onConflict: 'context_hash' }).then(() => {});
  } catch { /* context_memory may not exist yet */ }
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

    if (recalibrate) await recalibrateWeights(supabase);

    // ── 1. Fetch ALL historical data from multiple tables ──
    const [numbersRes, historicoRes, resultadosRes, weightsRes, qTableRes] = await Promise.all([
      supabase.from('roulette_numbers').select('number, fetched_at')
        .order('fetched_at', { ascending: false }).limit(500),
      supabase.from('historico_roleta').select('numero, created_at')
        .order('created_at', { ascending: false }).limit(500)
        .then((r: any) => r).catch?.(() => ({ data: [] })) ?? supabase.from('historico_roleta').select('numero, created_at').order('created_at', { ascending: false }).limit(500),
      supabase.from('resultados_roleta').select('numero, created_at')
        .order('created_at', { ascending: false }).limit(500)
        .then((r: any) => r).catch?.(() => ({ data: [] })) ?? supabase.from('resultados_roleta').select('numero, created_at').order('created_at', { ascending: false }).limit(500),
      supabase.from('ensemble_weights').select('*'),
      supabase.from('rl_qtable').select('state, action, q_value, visits').limit(500)
        .then((r: any) => r).catch?.(() => ({ data: [] })) ?? supabase.from('rl_qtable').select('state, action, q_value, visits').limit(500),
    ]);

    // Merge all historical sources (DB is always the primary source)
    const dbNumbers = (numbersRes.data || []).map((r: any) => r.number as number);
    const historicoNumbers = (historicoRes.data || []).map((r: any) => r.numero as number).filter((n: any) => typeof n === 'number' && n >= 0 && n <= 36);
    const resultadosNumbers = (resultadosRes.data || []).map((r: any) => r.numero as number).filter((n: any) => typeof n === 'number' && n >= 0 && n <= 36);

    // Use the longest available history from DB
    let baseHistory = dbNumbers;
    if (historicoNumbers.length > baseHistory.length) baseHistory = historicoNumbers;
    if (resultadosNumbers.length > baseHistory.length) baseHistory = resultadosNumbers;

    // If client sends numbers, prepend new ones that aren't in DB yet, but always keep DB as base
    let spins: number[];
    if (clientNumbers && clientNumbers.length > 0) {
      // Merge: client numbers first (may have newer data), then fill with DB history
      const merged = [...clientNumbers];
      for (const n of baseHistory) {
        if (merged.length >= 500) break;
        merged.push(n);
      }
      spins = merged.slice(0, 500);
    } else {
      spins = baseHistory.slice(0, 500);
    }

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
    for (const w of weightRows) weights[w.model_id] = w;
    const allModelIds = ['markov', 'neural_pattern', 'gradient', 'bayesian', 'statistical', 'pattern_discovery', 'rl_optimizer', 'momentum', 'convergence'];
    for (const id of allModelIds) {
      if (!weights[id]) weights[id] = { model_id: id, weight: 1.0, win_rate: 0, total_predictions: 0, total_hits: 0, current_streak: 0 };
    }

    // Build Q-table
    const qTable: Record<string, Record<string, { q: number; visits: number }>> = {};
    for (const row of (qTableRes?.data || [])) {
      if (!qTable[row.state]) qTable[row.state] = {};
      qTable[row.state][row.action] = { q: Number(row.q_value), visits: Number(row.visits) };
    }

    const temperature = getTemperature(weights);

    // ── 2. Run all 9 Models ──────────────────────────────
    const allSignals = [
      ...modelMarkov(spins),
      ...modelNeuralPattern(spins),
      ...modelGradient(spins),
      ...modelBayesian(spins),
      ...modelStatistical(spins),
      ...modelPatternDiscovery(spins),
      ...modelRLOptimizer(spins, weights, qTable),
      ...modelMomentum(spins),
      ...modelConvergence(spins),
    ];

    if (allSignals.length === 0) {
      return new Response(JSON.stringify({
        mode: 'no_signal',
        message: '🔎 9 modelos analisando — nenhum padrão forte detectado.',
        killSwitch: false,
        temperature,
        modelPerformance: Object.fromEntries(Object.entries(weights).map(([id, w]) => [id, {
          winRate: w.win_rate, total: w.total_predictions, hits: w.total_hits,
          streak: w.current_streak, weight: w.weight,
        }])),
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── 3. Ensemble Voting (3 rodadas) ─────────────────
    const ensemble = ensembleVote3Rounds(allSignals, weights);

    if (ensemble.killSwitch) {
      return new Response(JSON.stringify({
        mode: 'kill_switch',
        message: ensemble.killReason,
        killSwitch: true,
        temperature,
        modelPerformance: Object.fromEntries(Object.entries(weights).map(([id, w]) => [id, {
          winRate: w.win_rate, total: w.total_predictions, hits: w.total_hits,
          streak: w.current_streak, weight: w.weight,
        }])),
        agents: ensemble.debateLog,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── 4. Fusão Top 5 ─────────────────────────────────
    const fusionScores: { num: number; score: number; voters: string[]; reasons: string[] }[] = [];
    for (let n = 0; n <= 36; n++) {
      let score = 0;
      const voters: string[] = [];
      const reasons: string[] = [];
      for (const signal of ensemble.scored) {
        const mw = weights[signal.modelId]?.weight ?? 1.0;
        const cf = signal.confidence / 100;
        if (signal.numbers.includes(n)) {
          let vote = cf * mw;
          if (signal.predictedMain === n) vote *= 2.5;
          const idx = signal.numbers.indexOf(n);
          if (idx < 3) vote *= 1.5;
          else if (idx < 6) vote *= 1.2;
          score += vote;
          if (!voters.includes(signal.modelName)) {
            voters.push(signal.modelName);
            reasons.push(`${signal.modelName}: ${signal.label}`);
          }
        }
      }
      if (score > 0) fusionScores.push({ num: n, score, voters, reasons });
    }
    fusionScores.sort((a, b) => b.score - a.score);
    const top5 = fusionScores.slice(0, 5);
    const top5Numbers = top5.map(t => t.num);
    const top5Score = top5.reduce((a, b) => a + b.score, 0);
    const totalFusionScore = fusionScores.reduce((a, b) => a + b.score, 0);
    const fusionConfidence = totalFusionScore > 0
      ? Math.min(95, Math.round((top5Score / totalFusionScore) * 100 + (top5[0]?.voters.length ?? 0) * 5))
      : 0;
    const fusionReasoning = top5.map((t, i) =>
      `#${i + 1} → ${t.num} (score: ${t.score.toFixed(1)}, ${t.voters.length} modelos)`
    ).join(' | ');

    // ── 5. Kelly ───────────────────────────────────────
    const modelWR = weights[ensemble.winner.modelId];
    const winRate = modelWR && modelWR.total_predictions > 0
      ? modelWR.total_hits / modelWR.total_predictions : 0.45;
    const kelly = computeKelly(winRate, 7);

    // ── 6. Store predictions ───────────────────────────
    const predInserts = [
      {
        model_id: 'fusion_top5',
        predicted_numbers: top5Numbers,
        predicted_main: top5Numbers[0],
        confidence: fusionConfidence,
        bet_type: 'fusion',
        reasoning: fusionReasoning,
        ensemble_weight: 1.0,
        spin_context: { temperature, consensus: ensemble.consensus, totalModels: 9, fusion: true, entryAction: ensemble.entryAction },
      },
      ...ensemble.scored.slice(0, 9).map(s => ({
        model_id: s.modelId,
        predicted_numbers: s.numbers.slice(0, 15),
        predicted_main: s.predictedMain ?? s.numbers[0],
        confidence: s.confidence,
        bet_type: s.betType,
        reasoning: s.reasoning,
        ensemble_weight: weights[s.modelId]?.weight ?? 1.0,
        spin_context: { temperature, consensus: ensemble.consensus, totalModels: 9 },
      })),
    ];
    supabase.from('model_predictions').insert(predInserts).then(() => {});

    // Recalibrate periodically
    if (Math.random() < 0.08) recalibrateWeights(supabase).catch(() => {});

    // ── 7. Build arbiter log ───────────────────────────
    const modelNames: Record<string, string> = {
      markov: 'Markov', neural_pattern: 'Neural', gradient: 'Gradient',
      bayesian: 'Bayesiano', statistical: 'Estatístico',
      pattern_discovery: 'PatternDisc', rl_optimizer: 'RL-Opt',
      momentum: 'Momentum', convergence: 'Convergência',
    };
    const arbiterLog: string[] = [];
    arbiterLog.push(`🌡️ Mesa ${temperature.toUpperCase()}`);
    arbiterLog.push(`🤖 9 modelos ativos — ${allSignals.length} sinais | Ação: ${ensemble.entryAction}`);
    for (const [id, w] of Object.entries(weights)) {
      const name = modelNames[id] || id;
      const wr = w.total_predictions > 0 ? `${(w.win_rate * 100).toFixed(0)}%` : 'N/A';
      arbiterLog.push(`${name}: WR ${wr} | peso ${w.weight.toFixed(2)} | streak ${w.current_streak}`);
    }
    arbiterLog.push(`🏆 Líder: ${ensemble.winner.modelName} → ${ensemble.winner.label}`);
    arbiterLog.push(`🎯 FUSÃO TOP 5: [${top5Numbers.join(', ')}] — confiança ${fusionConfidence}%`);
    arbiterLog.push(`📊 Consenso: ${ensemble.consensus}/9 modelos | ${ensemble.entryAction}`);
    arbiterLog.push(`💰 Kelly: ${(kelly.fraction * 100).toFixed(1)}% → ${kelly.force.toUpperCase()}`);

    // ── 8. Response ────────────────────────────────────
    return new Response(JSON.stringify({
      mode: 'signal',
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
      entryAction: ensemble.entryAction,
      kellyFraction: kelly.fraction,
      temperature,
      killSwitch: false,
      ensembleConsensus: ensemble.consensus,
      ensembleConfidence: ensemble.ensembleConfidence,
      totalModels: 9,
      arbiterLog,
      // Debate das IAs — per-model signals for frontend display
      agents: ensemble.debateLog,
      // Consensus map
      consensusMap: ensemble.consensusMap,
      modelPerformance: Object.fromEntries(Object.entries(weights).map(([id, w]) => [id, {
        winRate: w.win_rate,
        total: w.total_predictions,
        hits: w.total_hits,
        streak: w.current_streak,
        weight: w.weight,
      }])),
      modelSignals: ensemble.scored.slice(0, 12).map(s => ({
        modelId: s.modelId,
        modelName: s.modelName,
        label: s.label,
        confidence: s.confidence,
        score: s.score,
        betType: s.betType,
        reasoning: s.reasoning,
      })),
      aiReasoning: {
        betType: 'fusion_top5',
        betDescription: fusionReasoning,
        patternIdentified: `FUSÃO: ${top5.map(t => `${t.num}(${t.voters.length}v)`).join(' ')}`,
        suggestedBet: `TOP 5: [${top5Numbers.join(', ')}] — ${ensemble.entryAction} (${ensemble.consensus}/9)`,
        consensus: ensemble.consensus,
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
