import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ═══════════════════════════════════════════════════════════════════
// EUROPEAN ROULETTE CONSTANTS
// ═══════════════════════════════════════════════════════════════════
const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const WHEEL = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const WL = WHEEL.length;
const VOISINS = new Set([22,18,29,7,28,12,35,3,26,0,32,15,19,4,21,2,25]);
const TIERS = new Set([27,13,36,11,30,8,23,10,5,24,16,33]);
const ORPHELINS = new Set([1,20,14,31,9,17,34,6]);

const getColor = (n: number) => n === 0 ? 'G' : RED.has(n) ? 'R' : 'B';
const getDozen = (n: number) => n === 0 ? 0 : n <= 12 ? 1 : n <= 24 ? 2 : 3;
const getColumn = (n: number) => n === 0 ? 0 : ((n - 1) % 3) + 1;
const getSector = (n: number) => VOISINS.has(n) ? 'V' : TIERS.has(n) ? 'T' : ORPHELINS.has(n) ? 'O' : 'Z';
const wheelIdx = (n: number) => WHEEL.indexOf(n);
const getZone = (n: number) => {
  const idx = wheelIdx(n);
  if (idx === -1) return -1;
  return Math.floor(idx / (WL / 4)); // 4 zones
};

// ═══════════════════════════════════════════════════════════════════
// MARKOV CHAIN: Color Transitions (order 1-3)
// ═══════════════════════════════════════════════════════════════════
interface MarkovResult {
  state: string;
  nextProbs: Record<string, number>;
  sampleSize: number;
  bestNext: string;
  bestProb: number;
}

function buildColorMarkov(numbers: number[], order: number): MarkovResult | null {
  const colors = numbers.map(getColor);
  if (colors.length < order + 1) return null;

  const transitions: Record<string, Record<string, number>> = {};

  for (let i = 0; i < colors.length - order; i++) {
    const state = colors.slice(i, i + order).join('');
    const next = colors[i + order];
    if (!transitions[state]) transitions[state] = {};
    transitions[state][next] = (transitions[state][next] || 0) + 1;
  }

  // Current state
  const currentState = colors.slice(0, order).join('');
  const trans = transitions[currentState];
  if (!trans) return null;

  const total = Object.values(trans).reduce((a, b) => a + b, 0);
  const probs: Record<string, number> = {};
  for (const [k, v] of Object.entries(trans)) {
    probs[k] = Math.round((v / total) * 100);
  }

  const best = Object.entries(probs).sort(([,a], [,b]) => b - a)[0];
  return {
    state: currentState,
    nextProbs: probs,
    sampleSize: total,
    bestNext: best[0],
    bestProb: best[1],
  };
}

// ═══════════════════════════════════════════════════════════════════
// MARKOV CHAIN: Dozen Transitions
// ═══════════════════════════════════════════════════════════════════
function buildDozenMarkov(numbers: number[], order: number): MarkovResult | null {
  const dozens = numbers.map(n => String(getDozen(n)));
  if (dozens.length < order + 1) return null;

  const transitions: Record<string, Record<string, number>> = {};
  for (let i = 0; i < dozens.length - order; i++) {
    const state = dozens.slice(i, i + order).join('');
    const next = dozens[i + order];
    if (!transitions[state]) transitions[state] = {};
    transitions[state][next] = (transitions[state][next] || 0) + 1;
  }

  const currentState = dozens.slice(0, order).join('');
  const trans = transitions[currentState];
  if (!trans) return null;

  const total = Object.values(trans).reduce((a, b) => a + b, 0);
  const probs: Record<string, number> = {};
  for (const [k, v] of Object.entries(trans)) {
    probs[k] = Math.round((v / total) * 100);
  }
  const best = Object.entries(probs).sort(([,a], [,b]) => b - a)[0];
  return { state: currentState, nextProbs: probs, sampleSize: total, bestNext: best[0], bestProb: best[1] };
}

// ═══════════════════════════════════════════════════════════════════
// ZONE CLUSTERING: Physical wheel bias detection
// ═══════════════════════════════════════════════════════════════════
interface ZoneAnalysis {
  zones: { id: number; count: number; expected: number; bias: number; numbers: number[] }[];
  hotZone: { id: number; bias: number; numbers: number[] } | null;
  coldZone: { id: number; bias: number; numbers: number[] } | null;
  sectorConcentration: Record<string, { count: number; pct: number }>;
}

function analyzeZones(numbers: number[], window = 100): ZoneAnalysis {
  const slice = numbers.slice(0, window);
  const zoneSize = Math.ceil(WL / 4);
  const zoneCounts = [0, 0, 0, 0];
  const zoneNums: number[][] = [[], [], [], []];

  slice.forEach(n => {
    const z = getZone(n);
    if (z >= 0 && z < 4) {
      zoneCounts[z]++;
      zoneNums[z].push(n);
    }
  });

  const expected = slice.length / 4;
  const zones = zoneCounts.map((c, i) => ({
    id: i,
    count: c,
    expected: Math.round(expected),
    bias: Math.round(((c - expected) / expected) * 100),
    numbers: [...new Set(zoneNums[i])].slice(0, 10),
  }));

  const sorted = [...zones].sort((a, b) => b.bias - a.bias);
  const hotZone = sorted[0].bias > 20 ? sorted[0] : null;
  const coldZone = sorted[sorted.length - 1].bias < -20 ? sorted[sorted.length - 1] : null;

  // Sector concentration
  const sectorCounts: Record<string, number> = { V: 0, T: 0, O: 0, Z: 0 };
  slice.forEach(n => { sectorCounts[getSector(n)]++; });
  const sectorConcentration: Record<string, { count: number; pct: number }> = {};
  for (const [k, v] of Object.entries(sectorCounts)) {
    sectorConcentration[k] = { count: v, pct: Math.round((v / slice.length) * 100) };
  }

  return { zones, hotZone, coldZone, sectorConcentration };
}

// ═══════════════════════════════════════════════════════════════════
// REINFORCEMENT: Strategy weight adjustment
// ═══════════════════════════════════════════════════════════════════
interface StrategyWeight {
  type: string;
  label: string;
  winRate: number;
  total: number;
  recentTrend: 'improving' | 'declining' | 'stable';
  weight: number;        // 0-100 dynamic weight
  shouldEmit: boolean;   // false if weight too low
}

function evaluateStrategyWeights(
  predictions: { strategy_type: string; strategy_label: string; hit: boolean; created_at: string }[]
): StrategyWeight[] {
  const grouped: Record<string, { hits: number; total: number; recent: boolean[] }> = {};

  predictions.forEach((p, i) => {
    if (!grouped[p.strategy_type]) grouped[p.strategy_type] = { hits: 0, total: 0, recent: [] };
    grouped[p.strategy_type].total++;
    if (p.hit) grouped[p.strategy_type].hits++;
    if (i < 10) grouped[p.strategy_type].recent.push(p.hit);
  });

  return Object.entries(grouped).map(([type, data]) => {
    const winRate = data.total > 0 ? Math.round((data.hits / data.total) * 100) : 0;
    const recentHits = data.recent.filter(Boolean).length;
    const recentTotal = data.recent.length;
    const recentWR = recentTotal > 0 ? recentHits / recentTotal : 0;
    const overallWR = data.total > 0 ? data.hits / data.total : 0;

    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (recentTotal >= 3) {
      if (recentWR > overallWR + 0.1) trend = 'improving';
      else if (recentWR < overallWR - 0.15) trend = 'declining';
    }

    // Dynamic weight: base on win rate, penalize declining trends
    let weight = winRate;
    if (trend === 'declining') weight = Math.max(0, weight - 20);
    if (trend === 'improving') weight = Math.min(100, weight + 10);

    // Check for consecutive failures (last 5)
    const lastFive = data.recent.slice(0, 5);
    const consecutiveFails = lastFive.length >= 5 && lastFive.every(h => !h);
    if (consecutiveFails) weight = Math.max(0, weight - 40);

    return {
      type,
      label: type,
      winRate,
      total: data.total,
      recentTrend: trend,
      weight,
      shouldEmit: weight >= 25, // Don't emit signals if weight is too low
    };
  }).sort((a, b) => b.weight - a.weight);
}

// ═══════════════════════════════════════════════════════════════════
// TRANSITION MATRIX: Number-to-Number (37x37)
// ═══════════════════════════════════════════════════════════════════
interface TransitionInsight {
  from: number;
  topNext: { number: number; prob: number; count: number }[];
  totalTransitions: number;
}

function buildTransitionMatrix(numbers: number[]): TransitionInsight | null {
  if (numbers.length < 10) return null;
  const from = numbers[0];

  // Count transitions FROM this number in the entire history
  const nextCounts: Record<number, number> = {};
  let total = 0;
  for (let i = 0; i < numbers.length - 1; i++) {
    if (numbers[i] === from) {
      const next = numbers[i + 1];
      nextCounts[next] = (nextCounts[next] || 0) + 1;
      total++;
    }
  }

  if (total < 3) return null;

  const topNext = Object.entries(nextCounts)
    .map(([n, c]) => ({ number: parseInt(n), prob: Math.round((c / total) * 100), count: c }))
    .sort((a, b) => b.prob - a.prob)
    .slice(0, 10);

  return { from, topNext, totalTransitions: total };
}

// ═══════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Load up to 5000 spins for deep baseline
    const [numbersRes, predRes] = await Promise.all([
      supabase.from('roulette_numbers').select('number, fetched_at')
        .order('fetched_at', { ascending: false }).limit(5000),
      supabase.from('prediction_history')
        .select('strategy_type, strategy_label, hit, created_at')
        .not('hit', 'is', null)
        .order('created_at', { ascending: false }).limit(200),
    ]);

    const numbers = (numbersRes.data || []).map((r: any) => r.number as number);
    const predictions = (predRes.data || []).map((r: any) => ({
      strategy_type: r.strategy_type,
      strategy_label: r.strategy_label,
      hit: r.hit === true,
      created_at: r.created_at,
    }));

    if (numbers.length < 50) {
      return new Response(JSON.stringify({ status: 'insufficient_data', count: numbers.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const analysisStart = Date.now();

    // ── 2. MARKOV CHAINS ──────────────────────────────
    const colorMarkov1 = buildColorMarkov(numbers, 1);
    const colorMarkov2 = buildColorMarkov(numbers, 2);
    const colorMarkov3 = buildColorMarkov(numbers, 3);
    const dozenMarkov1 = buildDozenMarkov(numbers, 1);
    const dozenMarkov2 = buildDozenMarkov(numbers, 2);

    // ── 3. ZONE CLUSTERING ────────────────────────────
    const zoneAnalysis50 = analyzeZones(numbers, 50);
    const zoneAnalysis200 = analyzeZones(numbers, 200);

    // ── 4. TRANSITION MATRIX ──────────────────────────
    const transitionInsight = buildTransitionMatrix(numbers);

    // ── 5. STRATEGY WEIGHTS (Reinforcement) ───────────
    const strategyWeights = evaluateStrategyWeights(predictions);
    const suppressedStrategies = strategyWeights.filter(s => !s.shouldEmit);
    const activeStrategies = strategyWeights.filter(s => s.shouldEmit);

    // ── 6. GENERATE INSIGHTS ──────────────────────────
    const insights: string[] = [];
    const logEntries: { step: string; detail: string; confidence: number }[] = [];

    logEntries.push({
      step: 'Carregamento',
      detail: `Analisando ${numbers.length} rodadas da base de dados`,
      confidence: 100,
    });

    // Markov insights
    if (colorMarkov3 && colorMarkov3.sampleSize >= 5) {
      logEntries.push({
        step: 'Markov Cor (Ordem 3)',
        detail: `Após [${colorMarkov3.state}], próximo mais provável: ${colorMarkov3.bestNext === 'R' ? 'Vermelho' : colorMarkov3.bestNext === 'B' ? 'Preto' : 'Verde'} (${colorMarkov3.bestProb}%) baseado em ${colorMarkov3.sampleSize} ocorrências`,
        confidence: Math.min(95, colorMarkov3.bestProb),
      });
      insights.push(`Cadeia Markov 3ª ordem: após ${colorMarkov3.state} → ${colorMarkov3.bestNext} ${colorMarkov3.bestProb}%`);
    } else if (colorMarkov2 && colorMarkov2.sampleSize >= 5) {
      logEntries.push({
        step: 'Markov Cor (Ordem 2)',
        detail: `Após [${colorMarkov2.state}], próximo: ${colorMarkov2.bestNext === 'R' ? 'Vermelho' : 'Preto'} (${colorMarkov2.bestProb}%) em ${colorMarkov2.sampleSize} amostras`,
        confidence: Math.min(90, colorMarkov2.bestProb),
      });
    }

    if (dozenMarkov2 && dozenMarkov2.sampleSize >= 5) {
      const dzLabels: Record<string, string> = { '0': 'Zero', '1': '1ª Dúzia', '2': '2ª Dúzia', '3': '3ª Dúzia' };
      logEntries.push({
        step: 'Markov Dúzia (Ordem 2)',
        detail: `Após dúzias [${dozenMarkov2.state}], próxima: ${dzLabels[dozenMarkov2.bestNext] || dozenMarkov2.bestNext} (${dozenMarkov2.bestProb}%) em ${dozenMarkov2.sampleSize} amostras`,
        confidence: Math.min(88, dozenMarkov2.bestProb),
      });
    }

    // Zone insights
    if (zoneAnalysis50.hotZone) {
      const hz = zoneAnalysis50.hotZone;
      logEntries.push({
        step: 'Zona Quente Detectada',
        detail: `Zona ${hz.id} do cilindro com +${hz.bias}% acima do esperado (últimos 50 giros). Números: [${hz.numbers.join(',')}]. Possível viés físico.`,
        confidence: Math.min(85, 60 + hz.bias / 2),
      });
      insights.push(`Zona quente #${hz.id}: +${hz.bias}% bias → [${hz.numbers.slice(0, 5).join(',')}]`);
    }

    if (zoneAnalysis50.coldZone) {
      const cz = zoneAnalysis50.coldZone;
      logEntries.push({
        step: 'Zona Fria',
        detail: `Zona ${cz.id} com ${cz.bias}% abaixo do esperado. Retorno estatístico provável.`,
        confidence: Math.min(75, 50 + Math.abs(cz.bias) / 3),
      });
    }

    // Sector concentration
    const sectors = zoneAnalysis50.sectorConcentration;
    const dominantSector = Object.entries(sectors).sort(([,a], [,b]) => b.pct - a.pct)[0];
    if (dominantSector && dominantSector[1].pct > 35) {
      const sectorNames: Record<string, string> = { V: 'Voisins du Zéro', T: 'Tiers du Cylindre', O: 'Orphelins', Z: 'Jeu Zéro' };
      logEntries.push({
        step: 'Concentração de Setor',
        detail: `${sectorNames[dominantSector[0]]} dominando com ${dominantSector[1].pct}% dos últimos 50 giros`,
        confidence: Math.min(82, dominantSector[1].pct + 10),
      });
    }

    // Transition matrix
    if (transitionInsight && transitionInsight.totalTransitions >= 5) {
      const top3 = transitionInsight.topNext.slice(0, 3);
      logEntries.push({
        step: 'Matriz de Transição',
        detail: `Após o ${transitionInsight.from}, os mais prováveis são: ${top3.map(t => `${t.number}(${t.prob}%)`).join(', ')} em ${transitionInsight.totalTransitions} transições`,
        confidence: Math.min(80, top3[0]?.prob || 0),
      });
    }

    // Reinforcement feedback
    if (suppressedStrategies.length > 0) {
      logEntries.push({
        step: 'Autoajuste de Estratégias',
        detail: `${suppressedStrategies.length} estratégia(s) suprimida(s) por baixo desempenho: ${suppressedStrategies.map(s => `${s.type}(${s.winRate}%)`).join(', ')}. Sinais dessas fontes foram desativados.`,
        confidence: 90,
      });
    }

    if (activeStrategies.length > 0) {
      const best = activeStrategies[0];
      logEntries.push({
        step: 'Estratégia Líder',
        detail: `${best.type} liderando com ${best.winRate}% WR (${best.total} previsões). Tendência: ${best.recentTrend === 'improving' ? '📈 melhorando' : best.recentTrend === 'declining' ? '📉 caindo' : '➡️ estável'}`,
        confidence: best.weight,
      });
    }

    const analysisMs = Date.now() - analysisStart;

    logEntries.push({
      step: 'Conclusão',
      detail: `Análise completa em ${analysisMs}ms. ${logEntries.length} padrões processados. Motor Markov + Reforço + Zonas ativo.`,
      confidence: 100,
    });

    // ── 7. PERSIST LEARNED PATTERNS ───────────────────
    const patternsToSave = [];

    if (colorMarkov3 && colorMarkov3.sampleSize >= 5) {
      patternsToSave.push({
        learning_type: 'markov_color',
        title: `Markov Cor 3ª: ${colorMarkov3.state} → ${colorMarkov3.bestNext}`,
        knowledge: JSON.stringify(colorMarkov3),
        accuracy: colorMarkov3.bestProb,
        data_points: colorMarkov3.sampleSize,
        metadata: { order: 3, type: 'color' },
      });
    }

    if (zoneAnalysis50.hotZone) {
      patternsToSave.push({
        learning_type: 'zone_bias',
        title: `Zona Quente ${zoneAnalysis50.hotZone.id}: +${zoneAnalysis50.hotZone.bias}%`,
        knowledge: JSON.stringify(zoneAnalysis50),
        accuracy: Math.min(85, 60 + zoneAnalysis50.hotZone.bias / 2),
        data_points: 50,
        metadata: { zoneId: zoneAnalysis50.hotZone.id },
      });
    }

    if (transitionInsight && transitionInsight.totalTransitions >= 5) {
      patternsToSave.push({
        learning_type: 'transition_matrix',
        title: `Transição ${transitionInsight.from} → ${transitionInsight.topNext[0]?.number}`,
        knowledge: JSON.stringify(transitionInsight),
        accuracy: transitionInsight.topNext[0]?.prob || 0,
        data_points: transitionInsight.totalTransitions,
        metadata: { from: transitionInsight.from },
      });
    }

    // Save patterns (upsert by learning_type + title)
    for (const p of patternsToSave) {
      await supabase.from('ai_learned_patterns').upsert(p, { onConflict: 'learning_type,title' }).select();
    }

    return new Response(JSON.stringify({
      status: 'ok',
      dataPoints: numbers.length,
      analysisMs,
      markov: {
        color: { order1: colorMarkov1, order2: colorMarkov2, order3: colorMarkov3 },
        dozen: { order1: dozenMarkov1, order2: dozenMarkov2 },
      },
      zones: {
        short: zoneAnalysis50,
        long: zoneAnalysis200,
      },
      transition: transitionInsight,
      reinforcement: {
        strategies: strategyWeights,
        suppressed: suppressedStrategies.map(s => s.type),
        active: activeStrategies.map(s => s.type),
      },
      insights,
      log: logEntries,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("markov-engine error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
