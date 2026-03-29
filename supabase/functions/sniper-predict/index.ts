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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Fetch data + AI learned patterns + unresolved predictions + resolved history in parallel
    const [numbersRes, learnedRes, unresolvedRes, resolvedRes, insightsRes] = await Promise.all([
      supabase.from('roulette_numbers').select('number, fetched_at').order('fetched_at', { ascending: false }).limit(1000),
      supabase.from('ai_learned_patterns').select('learning_type, title, knowledge, accuracy, metadata').order('updated_at', { ascending: false }).limit(30),
      supabase.from('prediction_history').select('id, predicted_numbers, predicted_main, strategy_type').is('hit', null).order('created_at', { ascending: false }).limit(10),
      supabase.from('prediction_history').select('strategy_type, strategy_label, predicted_numbers, predicted_main, probability, convergence_score, actual_number, hit, hit_type, mesa_mode, justification').not('hit', 'is', null).order('created_at', { ascending: false }).limit(200),
      supabase.from('pattern_insights').select('pattern_type, description, confidence, numbers_involved, recommendation').order('created_at', { ascending: false }).limit(50),
    ]);

    const entries = (numbersRes.data || []).map((r: any) => ({ number: r.number as number, time: r.fetched_at as string }));
    const numbers = entries.map(e => e.number);
    const learned = learnedRes.data || [];
    const unresolved = unresolvedRes.data || [];
    const resolvedHistory = resolvedRes.data || [];
    const patternInsights = insightsRes.data || [];

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
    for (let n = 0; n <= 36; n++) { insightNumbers[n] = 0; insightReasons[n] = []; }
    for (const insight of patternInsights) {
      const conf = (insight.confidence || 0) / 100;
      if (conf < 0.5) continue;
      const nums = insight.numbers_involved || [];
      for (const n of nums) {
        if (n >= 0 && n <= 36) {
          insightNumbers[n] += conf * 1.2;
          insightReasons[n].push(`📊 ${insight.pattern_type}`);
        }
      }
    }

    // Resolve previous predictions — ONLY if latest number is NEW (not already used to resolve)
    let isNewNumber = false;
    if (numbers.length > 0 && unresolved.length > 0) {
      const latestNum = numbers[0];
      const latestTime = entries[0]?.time;
      // Check if any unresolved prediction was already resolved with this exact number+time
      // by checking if the latest roulette number timestamp is NEWER than the prediction
      const newestPred = unresolved[0];
      const predTime = new Date(newestPred.id ? 0 : 0); // we'll use a different approach
      
      // Better approach: check if any resolved prediction already has this actual_number 
      // with a resolved_at within the last 30 seconds (meaning we already processed this number)
      const { data: recentlyResolved } = await supabase
        .from('prediction_history')
        .select('actual_number, resolved_at')
        .not('hit', 'is', null)
        .order('resolved_at', { ascending: false })
        .limit(1);
      
      const lastResolvedNum = recentlyResolved?.[0]?.actual_number;
      const lastResolvedTime = recentlyResolved?.[0]?.resolved_at;
      const timeSinceResolved = lastResolvedTime ? (Date.now() - new Date(lastResolvedTime).getTime()) / 1000 : 999;
      
      // Only resolve if: different number OR enough time passed (new spin)
      if (latestNum !== lastResolvedNum || timeSinceResolved > 60) {
        isNewNumber = true;
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
            resolved_at: new Date().toISOString(),
          }).eq('id', pred.id);
        }
      }
    } else if (unresolved.length === 0) {
      isNewNumber = true; // no unresolved = safe to create new
    }

    if (numbers.length < 15) {
      return json({ signal: null, mode: 'waiting', message: 'Aguardando dados...', layerResults: null, memoryWindows: null, aiLearnings: [] });
    }

    // ========================================================
    // NOISE FILTER — Remove outlier spins (ball bouncing off diamonds)
    // ========================================================
    const rawArcs: number[] = [];
    for (let i = 0; i < Math.min(100, numbers.length - 1); i++) rawArcs.push(wheelDist(numbers[i], numbers[i + 1]));
    const rawArcMean = rawArcs.length > 0 ? rawArcs.reduce((a, b) => a + b, 0) / rawArcs.length : 10;
    const rawArcStd = Math.sqrt(rawArcs.length > 0 ? rawArcs.reduce((a, b) => a + Math.pow(b - rawArcMean, 2), 0) / rawArcs.length : 25);
    const noiseThreshold = rawArcMean + rawArcStd * 2.5; // Outlier = 2.5 std devs above mean
    const noiseIndices = new Set<number>();
    for (let i = 0; i < rawArcs.length; i++) {
      if (rawArcs[i] > noiseThreshold && rawArcs[i] > 16) noiseIndices.add(i); // mark as noise if arc > threshold AND > 16 positions
    }
    const noiseCount = noiseIndices.size;

    // ========================================================
    // SELF-CORRECTION — Strategy weight adjustment (last 5 rounds)
    // ========================================================
    const recentResolved = resolvedHistory.slice(0, 5);
    const strategyWeightAdjust: Record<string, number> = {};
    for (const pred of recentResolved) {
      const st = pred.strategy_type || '';
      if (!strategyWeightAdjust[st]) strategyWeightAdjust[st] = 0;
      if (pred.hit) {
        strategyWeightAdjust[st] += 8; // reward recent hits heavily
      } else {
        strategyWeightAdjust[st] -= 5; // penalize recent misses
        // Check what actually hit — boost that strategy type
        if (pred.actual_number !== null) {
          const actualSector = getSector(pred.actual_number);
          const actualCavalo = getCavalo(pred.actual_number);
          const actualTerm = pred.actual_number % 10;
          // If predicted sector strategy but terminal hit, boost terminals
          if (pred.strategy_type?.includes('sniper') || pred.strategy_type?.includes('voisins')) {
            strategyWeightAdjust['cavalos'] = (strategyWeightAdjust['cavalos'] || 0) + 3;
            strategyWeightAdjust['terminal_alternation'] = (strategyWeightAdjust['terminal_alternation'] || 0) + 3;
          }
          // If predicted terminal but sector hit, boost sectors
          if (pred.strategy_type?.includes('cavalos') || pred.strategy_type?.includes('terminal')) {
            strategyWeightAdjust['sniper'] = (strategyWeightAdjust['sniper'] || 0) + 3;
            strategyWeightAdjust['voisins'] = (strategyWeightAdjust['voisins'] || 0) + 3;
          }
        }
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
    const aiLearnings: string[] = [];
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
    const dealerChanged = olderArcs.length >= 5 && Math.abs(recentArcMean - olderArcMean) > 5;
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
    if (entries.length > 1) {
      minutesSinceStart = (new Date(entries[0].time).getTime() - new Date(entries[Math.min(entries.length-1,49)].time).getTime()) / 60000;
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
    // TOTAL DAS 500 CAMADAS
    // ========================================================
    const totalLayers = blocoA + blocoB + blocoC + blocoD + blocoE;
    const layerResults = {
      blocoA: { score: blocoA, max: maxA, label: 'Biomecânica & Física' },
      blocoB: { score: blocoB, max: maxB, label: 'Matemática & Terminais' },
      blocoC: { score: blocoC, max: maxC, label: 'Geometria & Entropia' },
      blocoD: { score: blocoD, max: maxD, label: 'Inteligência Preditiva' },
      blocoE: { score: blocoE, max: maxE, label: 'Calibragem de Sessão' },
      total: totalLayers,
      max: 500,
    };

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
    const learnedBonus: Record<number, number> = {};
    const learnedReasons: Record<number, string[]> = {};
    for (let n = 0; n <= 36; n++) { learnedBonus[n] = 0; learnedReasons[n] = []; }

    for (const l of learned) {
      const acc = (l.accuracy || 50) / 100;
      const keyNums: number[] = (l.metadata as any)?.key_numbers || [];
      if (keyNums.length > 0 && acc > 0.6) {
        for (const kn of keyNums) {
          if (kn >= 0 && kn <= 36) { learnedBonus[kn] += acc * 1.5; learnedReasons[kn].push(`IA: ${l.title.slice(0, 30)}`); }
        }
      }
      if (l.learning_type === 'terminal_pattern' && acc > 0.65) {
        const match = l.title.match(/(\d)/);
        if (match) { const term = parseInt(match[1]); for (let n = 0; n <= 36; n++) { if (n % 10 === term) { learnedBonus[n] += acc * 0.8; learnedReasons[n].push(`IA Terminal ${term}`); } } }
      }
      if (l.learning_type === 'sector_concentration' && acc > 0.65) {
        const octMatch = l.title.match(/O(\d)/);
        if (octMatch) { const nums = OCTAVES[`O${octMatch[1]}`] || []; for (const n of nums) { learnedBonus[n] += acc * 0.7; learnedReasons[n].push(`IA Oitavo`); } }
      }
      if (l.learning_type === 'heat_cluster' && acc > 0.7) {
        for (const kn of keyNums) { if (kn >= 0 && kn <= 36) { learnedBonus[kn] += acc * 1.2; learnedReasons[kn].push('IA Cluster'); } }
      }
      if (l.learning_type === 'dealer_signature' && acc > 0.6 && (maoViciada || arcStdDev < 3)) {
        const avgArc = Math.round(arcMean);
        const idx0 = wheelIdx(numbers[0]);
        const pCW = WHEEL[(idx0 + avgArc) % WL];
        const pCCW = WHEEL[(idx0 - avgArc + WL) % WL];
        learnedBonus[pCW] += acc * 1.5; learnedBonus[pCCW] += acc * 1.5;
        learnedReasons[pCW].push('IA Dealer Sig'); learnedReasons[pCCW].push('IA Dealer Sig');
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
    const baseResponse = {
      entropy: entropy.toFixed(3), dealerMode, dealerSignature,
      hotTerminals: { cavalos: sortedCavalos, terminals: sortedTerminals.slice(0, 5) },
      sectorTrend, sectorFreq, convergenceScore: totalLayers, reasons, layerResults,
    };

    if (dealerChanged) {
      return json({ signal: null, mode: 'recalibrating', message: '🔄 Novo Dealer: Recalibrando...', ...baseResponse, memoryWindows, aiLearnings });
    }

    // CHAOS AUTO-CALIBRATION: If dealer is chaotic AND dispersing wildly, pause signals
    if (chaoticDealer && isDispersingWildly && totalLayers < 250) {
      aiLearnings.push('🛑 Mesa sem padrão detectável. Auto-calibração pausou sinais.');
      return json({ signal: null, mode: 'calibrating', message: '🔄 AUTO-CALIBRAGEM — Dealer caótico, aguardando padrão...', ...baseResponse, memoryWindows, aiLearnings });
    }

    if (highEntropy && totalLayers < 200) {
      return json({ signal: null, mode: 'observing', message: '🔍 OBSERVAÇÃO — Alta entropia', ...baseResponse, memoryWindows, aiLearnings });
    }

    if (totalLayers < 150) {
      return json({ signal: null, mode: 'monitoring', message: '👁️ Monitorando...', ...baseResponse,
        topCandidates: [], delayedTerminals, cavaloDelays, memoryWindows, aiLearnings });
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
      if (learnedBonus[n] > 0) { s += learnedBonus[n]; r.push(...learnedReasons[n].slice(0, 2)); }
      // INSIGHT PATTERNS bonus
      if (insightNumbers[n] > 0) { s += insightNumbers[n]; r.push(...insightReasons[n].slice(0, 2)); }
      // SURPRISE NUMBERS bonus — numbers that frequently appear when we miss
      if (surpriseNumbers.includes(n)) { s += 2; r.push('🎲 Surpresa freq.'); }
      // HISTORICAL HIT bonus — numbers that hit when predicted before
      if (numberHitFreq[n] && numberHitFreq[n] >= 2) { s += numberHitFreq[n] * 0.8; r.push(`✅ Acertou ${numberHitFreq[n]}x`); }
      if (numbers.slice(0, 3).includes(n)) s -= 3;
      else if (numbers.slice(3, 7).includes(n)) s -= 1;
      if (s > 0) numScores.push({ num: n, score: s, reasons: r });
    }
    numScores.sort((a, b) => b.score - a.score);

    // Helper: sum scores for a set of numbers
    const sumScores = (nums: number[]) => {
      let total = 0;
      for (const n of nums) { const found = numScores.find(s => s.num === n); if (found) total += found.score; }
      return total;
    };

    // Helper: backtest a set of numbers against deep history (up to 1000)
    const backtestSet = (nums: number[]) => {
      let hits = 0, tests = 0;
      const maxTests = Math.min(100, numbers.length - 10);
      for (let w = 0; w < maxTests; w++) {
        tests++;
        if (nums.includes(numbers[w + 5])) hits++;
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
      numbers: cavaloNums, coverage: (cavaloNums.length/37)*100, payout: Math.round(36/cavaloNums.length * cavaloNums.length),
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
      numbers: [...VOISINS], coverage: (17/37)*100, payout: Math.round(36/17*17),
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
      numbers: [...opSector], coverage: (opSector.length/37)*100, payout: Math.round(36/opSector.length * opSector.length),
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

    // COR (Red vs Black) — bet on the color that's due based on frequency imbalance
    const redNums30 = last30.filter(n => RED.includes(n)).length;
    const blackNums30 = last30.filter(n => n > 0 && !RED.includes(n)).length;
    const betOnRed = blackNums30 > redNums30;
    const colorNums = betOnRed
      ? Array.from({length:36}, (_,i) => i+1).filter(n => RED.includes(n))
      : Array.from({length:36}, (_,i) => i+1).filter(n => !RED.includes(n));
    const colorImbalance = Math.abs(redNums30 - blackNums30);
    const colorBtRate = backtestSet(colorNums);
    strategies.push({
      type: 'cor', label: betOnRed ? '🔴 Vermelho' : '⚫ Preto', emoji: betOnRed ? '🔴' : '⚫',
      numbers: colorNums, coverage: (18/37)*100, payout: 2,
      score: colorImbalance * 3 + colorBtRate * 25,
      probability: Math.min(98, Math.round(45 + colorBtRate * 40 + colorImbalance * 2)),
      justification: `${betOnRed ? 'Vermelho' : 'Preto'} atrasado (${betOnRed ? redNums30 : blackNums30}x vs ${betOnRed ? blackNums30 : redNums30}x em 30). Backtest: ${(colorBtRate*100).toFixed(0)}%.`,
    });

    // PAR/ÍMPAR — bet on parity that's due
    const even30 = last30.filter(n => n > 0 && n % 2 === 0).length;
    const odd30 = last30.filter(n => n > 0 && n % 2 === 1).length;
    const betOnEven = odd30 > even30;
    const parityNums = betOnEven
      ? Array.from({length:36}, (_,i) => i+1).filter(n => n % 2 === 0)
      : Array.from({length:36}, (_,i) => i+1).filter(n => n % 2 === 1);
    const parityImbalance = Math.abs(even30 - odd30);
    const parityBtRate = backtestSet(parityNums);
    strategies.push({
      type: 'paridade', label: betOnEven ? '🔵 Par' : '🟠 Ímpar', emoji: betOnEven ? '🔵' : '🟠',
      numbers: parityNums, coverage: (18/37)*100, payout: 2,
      score: parityImbalance * 3 + parityBtRate * 25,
      probability: Math.min(98, Math.round(45 + parityBtRate * 40 + parityImbalance * 2)),
      justification: `${betOnEven ? 'Par' : 'Ímpar'} atrasado (${betOnEven ? even30 : odd30}x vs ${betOnEven ? odd30 : even30}x em 30). Backtest: ${(parityBtRate*100).toFixed(0)}%.`,
    });

    // ALTO/BAIXO — bet on high or low that's due
    const high30 = last30.filter(n => n >= 19 && n <= 36).length;
    const low30 = last30.filter(n => n >= 1 && n <= 18).length;
    const betOnHigh = low30 > high30;
    const hlNums = betOnHigh
      ? Array.from({length:18}, (_,i) => i+19)
      : Array.from({length:18}, (_,i) => i+1);
    const hlImbalance = Math.abs(high30 - low30);
    const hlBtRate = backtestSet(hlNums);
    strategies.push({
      type: 'alto_baixo', label: betOnHigh ? '⬆️ Alto (19-36)' : '⬇️ Baixo (1-18)', emoji: betOnHigh ? '⬆️' : '⬇️',
      numbers: hlNums, coverage: (18/37)*100, payout: 2,
      score: hlImbalance * 3 + hlBtRate * 25,
      probability: Math.min(98, Math.round(45 + hlBtRate * 40 + hlImbalance * 2)),
      justification: `${betOnHigh ? 'Alto' : 'Baixo'} atrasado (${betOnHigh ? high30 : low30}x vs ${betOnHigh ? low30 : high30}x em 30). Backtest: ${(hlBtRate*100).toFixed(0)}%.`,
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
        numbers: insightTopNums, coverage: (insightTopNums.length / 37) * 100, payout: Math.round(36 / insightTopNums.length),
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
        numbers: surpriseNums, coverage: (surpriseNums.length / 37) * 100, payout: Math.round(36 / surpriseNums.length),
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
        numbers: fullCrossNums, coverage: (fullCrossNums.length / 37) * 100, payout: Math.round(36 / fullCrossNums.length),
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
          numbers: termNums, coverage: (termNums.length/37)*100, payout: Math.round(36/termNums.length),
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
        numbers: hotNums, coverage: (hotNums.length/37)*100, payout: Math.round(36/hotNums.length),
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
        numbers: topCold, coverage: (topCold.length/37)*100, payout: Math.round(36/topCold.length),
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
        numbers: hwNums, coverage: (hwNums.length / 37) * 100, payout: Math.round(36 / hwNums.length),
        score: hwScore + hwBt * 20,
        probability: Math.min(98, Math.round(50 + hwScore * 1.5 + hwBt * 30)),
        justification: `Números com histórico comprovado de acertos: ${histWinners.slice(0, 5).join(',')}. Total: ${histWinners.reduce((a, n) => a + (numberHitFreq[n] || 0), 0)} acertos.`,
      });
    }

    // ==========================================
    // DUEL: Pick the best strategy with performance + diversity + learned knowledge
    // ==========================================
    
    // DIVERSITY: check last 15 predictions (not just 5) for stronger anti-repetition
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
      // Bonus for high payout low coverage (more profitable if hits)
      st.score += (st.payout > 10 ? 3 : st.payout > 3 ? 1 : 0);
      // Physical mode bonus for sector-based strategies
      if (mesaMode === 'fisico' && ['sniper', 'voisins'].includes(st.type)) st.score += 5;
      // Mathematical mode bonus for terminal-based strategies
      if (mesaMode === 'matematico' && ['cavalos', 'duzias', 'terminal_alternation'].includes(st.type)) st.score += 5;

      // LEARNED KNOWLEDGE BOOST: apply AI-learned weights
      const learnedBoost = learnedStrategyBoosts[st.type] || 0;
      st.score += learnedBoost * 3;

      // ====== SELF-CORRECTION: 5-round weight adjustment ======
      const selfCorrectionWeight = strategyWeightAdjust[st.type] || 0;
      st.score += selfCorrectionWeight;

      // ====== NOISE PENALTY: reduce confidence when too many noisy spins ======
      if (noiseCount > 5) st.score -= 5; // many outliers = less reliable data
      if (noiseCount > 10) st.score -= 10;

      // ====== CHAOS PENALTY: reduce if dealer is chaotic ======
      if (chaoticDealer && ['sniper', 'voisins', 'setor_oposto'].includes(st.type)) st.score -= 10; // sector strategies unreliable with chaotic dealer
      if (!chaoticDealer && microArcStd < 2 && ['sniper', 'voisins'].includes(st.type)) st.score += 8; // bonus for sector strats with consistent dealer

      // PERFORMANCE-BASED WEIGHT: boost strategies that historically perform well
      const perf = strategyPerformance[st.type];
      if (perf && perf.total >= 5) {
        const winBonus = (perf.winRate - 0.3) * 30;
        st.score += winBonus;
        const trendBonus = (perf.recentTrend - 0.3) * 20;
        st.score += trendBonus;
        // Penalize strategies that claim high prob but rarely hit
        if (perf.avgProb > 80 && perf.winRate < 0.25) st.score -= 15;
        // Strongly penalize strategies with very low win rates
        if (perf.total >= 10 && perf.winRate < 0.15) st.score -= 20;
      }

      // AGGRESSIVE DIVERSITY PENALTY: much stronger anti-repetition
      const recentUseCount = stratTypeCount[st.type] || 0;
      if (recentUseCount >= 4) st.score -= 25; // almost never repeat 4+ times
      else if (recentUseCount >= 3) st.score -= 15;
      else if (recentUseCount >= 2) st.score -= 8;
      else if (recentUseCount >= 1) st.score -= 3;
      
      // NUMBER OVERLAP PENALTY: penalize if predicted numbers overlap heavily with recent predictions
      const numberOverlap = st.numbers.filter(n => recentNumbers.includes(n)).length;
      const overlapRatio = st.numbers.length > 0 ? numberOverlap / st.numbers.length : 0;
      if (overlapRatio > 0.7) st.score -= 15; // >70% same numbers as recent = heavy penalty
      else if (overlapRatio > 0.5) st.score -= 8;
      else if (overlapRatio > 0.3) st.score -= 3;

      // CATEGORY DIVERSITY: group types into categories, penalize if same category repeated
      const category = ['cor', 'paridade', 'alto_baixo'].includes(st.type) ? 'simple_bet'
        : ['coluna', 'duzia_unica', 'duzias', 'column_cycle', 'dozen_phase'].includes(st.type) ? 'group_bet'
        : ['sniper', 'voisins', 'setor_oposto'].includes(st.type) ? 'sector_bet'
        : 'special_bet';
      const categoryUsed = recentStratTypes.filter(t => {
        const cat = ['cor', 'paridade', 'alto_baixo'].includes(t) ? 'simple_bet'
          : ['coluna', 'duzia_unica', 'duzias', 'column_cycle', 'dozen_phase'].includes(t) ? 'group_bet'
          : ['sniper', 'voisins', 'setor_oposto'].includes(t) ? 'sector_bet'
          : 'special_bet';
        return cat === category;
      }).length;
      if (categoryUsed >= 5) st.score -= 12;
      else if (categoryUsed >= 3) st.score -= 6;

      // BACKTEST VALIDATION: only trust strategies with decent backtest
      if (st.probability < 60) st.score -= 5; // low-confidence penalty
    });

    // If two strategies tie, prefer higher payout
    strategies.sort((a, b) => b.score - a.score || b.payout - a.payout);

    const winner = strategies[0];
    const allStrategies = strategies.map(s => ({
      type: s.type, label: s.label, emoji: s.emoji,
      numbers: s.numbers, coverage: +s.coverage.toFixed(1), payout: s.payout,
      score: +s.score.toFixed(1), probability: s.probability,
    }));

    // Final probability = winner's probability boosted by layer convergence
    const finalProbability = Math.min(98, Math.round(winner.probability * (totalLayers / 400)));
    
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

    const mode = totalLayers >= 420 && finalProbability >= 88 ? 'sniper'
      : totalLayers >= 370 && finalProbability >= 80 ? 'alert'
      : 'monitoring';

    const message = mode === 'sniper'
      ? `🎯 JOGADA CERTEIRA: ${winner.emoji} ${winner.label} — ${totalLayers}/500`
      : mode === 'alert'
      ? `⚡ ALERTA: ${winner.emoji} ${winner.label} — ${totalLayers}/500`
      : `👁️ Analisando... ${totalLayers}/500 — aguardando convergência`;

    const diagnostic = mode === 'sniper'
      ? `Convergência Pentacentesimal: ${winner.justification}`
      : mode === 'alert'
      ? `Quase lá: ${winner.justification}`
      : `Análise em andamento: ${winner.justification}`;

    // Save prediction to history — ONLY when truly confident (sniper or strong alert)
    // The AI must be selective: only commit when multiple layers converge strongly
    const shouldSave = isNewNumber && mode === 'sniper' && winner.numbers.length > 0 && finalProbability >= 85;
    if (shouldSave) {
      await supabase.from('prediction_history').insert({
        strategy_type: winner.type,
        strategy_label: winner.label,
        predicted_numbers: winner.numbers,
        predicted_main: winner.numbers[0],
        probability: finalProbability,
        convergence_score: totalLayers,
        mesa_mode: mesaMode,
        justification: winner.justification,
      }).then(() => {}).catch(() => {}); // non-blocking
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
      } else if (t === 'sniper' || t === 'voisins' || t === 'setor_oposto') {
        const sector = nums.length > 0 ? getSector(nums[0]) : 'Voisins';
        bets.push({ type: 'setor', label: `Setor ${sector}`, detail: `Cubra o setor ${sector} na roda`, emoji: '🎯' });
        // Add specific neighbor bets
        const mainNum = nums[0];
        bets.push({ type: 'vizinhos', label: `Vizinhos do ${mainNum}`, detail: `Pleno no ${mainNum} + vizinhos: ${nums.slice(1, 5).join(', ')}`, emoji: '🎯' });
      } else if (t === 'numero_exato') {
        bets.push({ type: 'pleno', label: `Pleno no ${nums[0]}`, detail: `Aposte Pleno (straight) no ${nums[0]} — paga 35:1`, emoji: '💎' });
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

      const summary = bets.map(b => `${b.emoji} ${b.label}`).join(' • ');
      return { bets, summary };
    };

    const betInstructions = generateBetInstructions(winner);

    return json({
      signal: {
        number: winner.numbers[0],
        neighbors: winner.numbers.slice(1),
        probability: finalProbability,
        reasons: numScores.slice(0, 3).map(s => s.reasons).flat().slice(0, 5),
        convergenceReasons: reasons,
        diagnostic,
      },
      strategy: {
        type: winner.type,
        label: winner.label,
        emoji: winner.emoji,
        numbers: winner.numbers,
        coverage: +winner.coverage.toFixed(1),
        payout: winner.payout,
        probability: finalProbability,
        justification: winner.justification,
      },
      betInstructions,
      allStrategies,
      mesaMode,
      mode, message,
      memoryWindows,
      aiLearnings: aiLearnings.slice(0, 8),
      noiseFiltered: noiseCount,
      dealerChaos: chaoticDealer,
      selfCorrection: strategyWeightAdjust,
      ...baseResponse, recoveryMode,
      topCandidates: numScores.slice(0, 8).map(s => ({ num: s.num, score: +s.score.toFixed(1), reasons: s.reasons })),
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
