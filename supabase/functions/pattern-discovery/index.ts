import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ═══════════════════════════════════════════════════════════════════
// PATTERN DISCOVERY MODULE
// Statistical tests: Chi-squared, Runs Test, Autocorrelation,
// Cycle Detection, K-Means Clustering on wheel positions
// ═══════════════════════════════════════════════════════════════════

const WHEEL = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const WL = WHEEL.length;
const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

const wheelPos = (n: number) => WHEEL.indexOf(n);
const getColor = (n: number) => n === 0 ? 'green' : RED.has(n) ? 'red' : 'black';
const getDozen = (n: number) => n === 0 ? 0 : n <= 12 ? 1 : n <= 24 ? 2 : 3;

interface DiscoveredPattern {
  test_name: string;
  description: string;
  p_value: number;
  significant: boolean;
  details: Record<string, unknown>;
  recommendation: string | null;
  numbers_involved: number[];
  confidence: number;
}

// ── Chi-Squared Goodness of Fit ─────────────────────────────────
// Tests if number distribution deviates from uniform
function chiSquaredTest(spins: number[]): DiscoveredPattern {
  const observed = new Array(37).fill(0);
  spins.forEach(n => observed[n]++);
  const expected = spins.length / 37;
  let chiSq = 0;
  for (let i = 0; i <= 36; i++) {
    chiSq += Math.pow(observed[i] - expected, 2) / expected;
  }
  // df = 36, critical values: 0.05 → 50.998, 0.01 → 58.619
  const significant = chiSq > 50.998;
  const pApprox = chiSq > 58.619 ? 0.001 : chiSq > 50.998 ? 0.03 : chiSq > 43.77 ? 0.08 : 0.5;

  // Find most deviated numbers
  const deviations = observed.map((o: number, i: number) => ({ num: i, dev: (o - expected) / Math.sqrt(expected), count: o }));
  deviations.sort((a, b) => Math.abs(b.dev) - Math.abs(a.dev));
  const hotNums = deviations.filter(d => d.dev > 1.5).map(d => d.num);
  const coldNums = deviations.filter(d => d.dev < -1.5).map(d => d.num);

  return {
    test_name: 'chi_squared_uniformity',
    description: `Teste χ² de uniformidade: χ²=${chiSq.toFixed(2)} (df=36). ${significant ? 'Distribuição NÃO uniforme detectada!' : 'Distribuição dentro do esperado.'}`,
    p_value: pApprox,
    significant,
    details: { chi_squared: chiSq, df: 36, hot_numbers: hotNums, cold_numbers: coldNums, top_deviations: deviations.slice(0, 5) },
    recommendation: significant ? `Números quentes: [${hotNums.slice(0, 5).join(',')}] | Frios: [${coldNums.slice(0, 5).join(',')}]` : null,
    numbers_involved: [...hotNums.slice(0, 5), ...coldNums.slice(0, 5)],
    confidence: significant ? Math.min(85, 55 + Math.round((chiSq - 50) * 0.5)) : 30,
  };
}

// ── Chi-Squared for Colors ──────────────────────────────────────
function chiSquaredColorTest(spins: number[]): DiscoveredPattern {
  const nonZero = spins.filter(n => n > 0);
  const redCount = nonZero.filter(n => RED.has(n)).length;
  const blackCount = nonZero.length - redCount;
  const expected = nonZero.length / 2;
  const chiSq = Math.pow(redCount - expected, 2) / expected + Math.pow(blackCount - expected, 2) / expected;
  const significant = chiSq > 3.841; // df=1, p<0.05

  return {
    test_name: 'chi_squared_color',
    description: `Teste χ² de cores: Vermelho=${redCount}, Preto=${blackCount}. χ²=${chiSq.toFixed(2)}. ${significant ? 'Viés de cor detectado!' : 'Distribuição equilibrada.'}`,
    p_value: chiSq > 6.635 ? 0.005 : chiSq > 3.841 ? 0.03 : 0.5,
    significant,
    details: { red: redCount, black: blackCount, chi_squared: chiSq, bias: redCount > blackCount ? 'red' : 'black' },
    recommendation: significant ? `Viés para ${redCount > blackCount ? 'VERMELHO' : 'PRETO'} (${(Math.max(redCount, blackCount) / nonZero.length * 100).toFixed(1)}%)` : null,
    numbers_involved: [],
    confidence: significant ? Math.min(78, 50 + Math.round(chiSq * 3)) : 25,
  };
}

// ── Runs Test (Wald-Wolfowitz) ──────────────────────────────────
// Tests for non-randomness in sequences
function runsTest(spins: number[]): DiscoveredPattern {
  // Binary: above/below median
  const median = [...spins].sort((a, b) => a - b)[Math.floor(spins.length / 2)];
  const binary = spins.map(n => n >= median ? 1 : 0);

  let runs = 1;
  for (let i = 1; i < binary.length; i++) {
    if (binary[i] !== binary[i - 1]) runs++;
  }

  const n1 = binary.filter(b => b === 1).length;
  const n0 = binary.length - n1;
  const n = binary.length;

  // Expected runs and variance
  const expectedRuns = (2 * n1 * n0) / n + 1;
  const variance = (2 * n1 * n0 * (2 * n1 * n0 - n)) / (n * n * (n - 1));
  const z = variance > 0 ? (runs - expectedRuns) / Math.sqrt(variance) : 0;

  // z > 1.96 or z < -1.96 → significant at 0.05
  const significant = Math.abs(z) > 1.96;
  const tooFewRuns = z < -1.96; // clustering
  const tooManyRuns = z > 1.96; // alternating

  return {
    test_name: 'runs_test',
    description: `Teste de Sequências: ${runs} runs (esperado: ${expectedRuns.toFixed(1)}), Z=${z.toFixed(2)}. ${tooFewRuns ? 'CLUSTERING detectado — números tendem a se agrupar!' : tooManyRuns ? 'ALTERNÂNCIA excessiva detectada!' : 'Sequência aleatória.'}`,
    p_value: Math.abs(z) > 2.576 ? 0.005 : Math.abs(z) > 1.96 ? 0.03 : 0.5,
    significant,
    details: { runs, expected_runs: expectedRuns, z_score: z, pattern: tooFewRuns ? 'clustering' : tooManyRuns ? 'alternating' : 'random' },
    recommendation: tooFewRuns ? 'Números estão clusterizando — apostar no grupo recente' : tooManyRuns ? 'Alternância alta — apostar contra o último resultado' : null,
    numbers_involved: [],
    confidence: significant ? Math.min(80, 55 + Math.round(Math.abs(z) * 5)) : 20,
  };
}

// ── Autocorrelation (Ljung-Box) ─────────────────────────────────
function autocorrelationTest(spins: number[], maxLag = 10): DiscoveredPattern {
  const n = spins.length;
  const mean = spins.reduce((a, b) => a + b, 0) / n;
  const variance = spins.reduce((a, b) => a + (b - mean) ** 2, 0) / n;

  const acfs: number[] = [];
  let ljungBox = 0;

  for (let lag = 1; lag <= Math.min(maxLag, Math.floor(n / 4)); lag++) {
    let sum = 0;
    for (let i = 0; i < n - lag; i++) {
      sum += (spins[i] - mean) * (spins[i + lag] - mean);
    }
    const acf = variance > 0 ? sum / ((n - lag) * variance) : 0;
    acfs.push(acf);
    ljungBox += (acf * acf) / (n - lag);
  }
  ljungBox *= n * (n + 2);

  // Critical value for df=maxLag at 0.05: ~18.31 for lag=10
  const significant = ljungBox > 18.31;
  const significantLags = acfs.map((a, i) => ({ lag: i + 1, acf: a, significant: Math.abs(a) > 1.96 / Math.sqrt(n) }))
    .filter(l => l.significant);

  return {
    test_name: 'autocorrelation_ljungbox',
    description: `Autocorrelação (Ljung-Box): Q=${ljungBox.toFixed(2)}. ${significant ? `Correlação temporal detectada nos lags [${significantLags.map(l => l.lag).join(',')}]!` : 'Sem correlação temporal significativa.'}`,
    p_value: ljungBox > 23.21 ? 0.005 : ljungBox > 18.31 ? 0.03 : 0.5,
    significant,
    details: { ljung_box: ljungBox, acfs: acfs.slice(0, 5), significant_lags: significantLags },
    recommendation: significantLags.length > 0 ? `Lag ${significantLags[0].lag} tem correlação ${significantLags[0].acf.toFixed(3)} — padrão periódico` : null,
    numbers_involved: [],
    confidence: significant ? Math.min(82, 55 + Math.round(ljungBox * 0.5)) : 20,
  };
}

// ── Sector Bias Test ────────────────────────────────────────────
function sectorBiasTest(spins: number[]): DiscoveredPattern {
  const VOISINS = new Set([22,18,29,7,28,12,35,3,26,0,32,15,19,4,21,2,25]);
  const TIERS = new Set([27,13,36,11,30,8,23,10,5,24,16,33]);
  const ORPHELINS = new Set([1,20,14,31,9,17,34,6]);

  const counts = { voisins: 0, tiers: 0, orphelins: 0 };
  spins.forEach(n => {
    if (VOISINS.has(n)) counts.voisins++;
    else if (TIERS.has(n)) counts.tiers++;
    else if (ORPHELINS.has(n)) counts.orphelins++;
  });

  const expected = { voisins: spins.length * 17 / 37, tiers: spins.length * 12 / 37, orphelins: spins.length * 8 / 37 };
  let chiSq = 0;
  for (const sector of ['voisins', 'tiers', 'orphelins'] as const) {
    chiSq += Math.pow(counts[sector] - expected[sector], 2) / expected[sector];
  }

  const significant = chiSq > 5.991; // df=2, p<0.05
  const hotSector = counts.voisins / expected.voisins > counts.tiers / expected.tiers && counts.voisins / expected.voisins > counts.orphelins / expected.orphelins
    ? 'voisins' : counts.tiers / expected.tiers > counts.orphelins / expected.orphelins ? 'tiers' : 'orphelins';

  const sectorSets: Record<string, Set<number>> = { voisins: VOISINS, tiers: TIERS, orphelins: ORPHELINS };

  return {
    test_name: 'sector_bias',
    description: `Viés setorial: Voisins=${counts.voisins}, Tiers=${counts.tiers}, Orphelins=${counts.orphelins}. χ²=${chiSq.toFixed(2)}. ${significant ? `Setor ${hotSector.toUpperCase()} com viés!` : 'Setores equilibrados.'}`,
    p_value: chiSq > 9.21 ? 0.005 : chiSq > 5.991 ? 0.03 : 0.5,
    significant,
    details: { counts, expected, chi_squared: chiSq, hot_sector: hotSector },
    recommendation: significant ? `Setor ${hotSector} quente — apostar no setor` : null,
    numbers_involved: significant ? Array.from(sectorSets[hotSector]) : [],
    confidence: significant ? Math.min(83, 55 + Math.round(chiSq * 2)) : 25,
  };
}

// ── Wheel Position Clustering (K-Means inspired) ────────────────
function wheelClusteringTest(spins: number[]): DiscoveredPattern {
  const positions = spins.map(wheelPos).filter(p => p >= 0);
  if (positions.length < 20) {
    return { test_name: 'wheel_clustering', description: 'Dados insuficientes', p_value: 1, significant: false, details: {}, recommendation: null, numbers_involved: [], confidence: 0 };
  }

  // Simple 3-cluster approach on circular positions
  const k = 3;
  // Initialize centroids evenly spaced
  let centroids = [0, Math.floor(WL / 3), Math.floor(2 * WL / 3)];

  for (let iter = 0; iter < 20; iter++) {
    const clusters: number[][] = [[], [], []];
    for (const p of positions) {
      let minDist = Infinity, bestC = 0;
      for (let c = 0; c < k; c++) {
        const d = Math.min(Math.abs(p - centroids[c]), WL - Math.abs(p - centroids[c]));
        if (d < minDist) { minDist = d; bestC = c; }
      }
      clusters[bestC].push(p);
    }
    // Update centroids (circular mean)
    centroids = clusters.map(cl => {
      if (cl.length === 0) return 0;
      // Circular mean via atan2
      const sinSum = cl.reduce((a, p) => a + Math.sin(2 * Math.PI * p / WL), 0);
      const cosSum = cl.reduce((a, p) => a + Math.cos(2 * Math.PI * p / WL), 0);
      const meanAngle = Math.atan2(sinSum, cosSum);
      return Math.round(((meanAngle / (2 * Math.PI)) * WL + WL) % WL);
    });
  }

  // Find dominant cluster
  const clusterSizes: number[] = [0, 0, 0];
  for (const p of positions) {
    let minDist = Infinity, bestC = 0;
    for (let c = 0; c < k; c++) {
      const d = Math.min(Math.abs(p - centroids[c]), WL - Math.abs(p - centroids[c]));
      if (d < minDist) { minDist = d; bestC = c; }
    }
    clusterSizes[bestC]++;
  }

  const maxCluster = clusterSizes.indexOf(Math.max(...clusterSizes));
  const ratio = clusterSizes[maxCluster] / positions.length;
  const significant = ratio > 0.50; // If one cluster has >50% of spins

  // Get numbers in dominant cluster
  const centerPos = centroids[maxCluster];
  const radius = 5;
  const clusterNums: number[] = [];
  for (let d = -radius; d <= radius; d++) {
    clusterNums.push(WHEEL[((centerPos + d) % WL + WL) % WL]);
  }

  return {
    test_name: 'wheel_clustering',
    description: `Clusterização no cilindro: Cluster dominante em posição ${centerPos} com ${(ratio * 100).toFixed(1)}% dos giros. ${significant ? 'CLUSTER SIGNIFICATIVO — possível dealer signature!' : 'Sem cluster dominante.'}`,
    p_value: ratio > 0.60 ? 0.005 : ratio > 0.50 ? 0.03 : 0.5,
    significant,
    details: { centroids, cluster_sizes: clusterSizes, dominant_cluster: maxCluster, ratio, center_number: WHEEL[centerPos] },
    recommendation: significant ? `Dealer signature detectada — cluster [${clusterNums.join(',')}]` : null,
    numbers_involved: significant ? clusterNums : [],
    confidence: significant ? Math.min(85, 55 + Math.round((ratio - 0.5) * 200)) : 20,
  };
}

// ── Dozen Cycle Detection ───────────────────────────────────────
function dozenCycleTest(spins: number[]): DiscoveredPattern {
  const dozens = spins.filter(n => n > 0).map(n => getDozen(n));
  if (dozens.length < 30) {
    return { test_name: 'dozen_cycle', description: 'Dados insuficientes', p_value: 1, significant: false, details: {}, recommendation: null, numbers_involved: [], confidence: 0 };
  }

  // Check for periodic patterns in dozens
  const patterns: Record<string, number> = {};
  for (let i = 0; i < dozens.length - 2; i++) {
    const key = `${dozens[i]}-${dozens[i + 1]}-${dozens[i + 2]}`;
    patterns[key] = (patterns[key] || 0) + 1;
  }

  const sorted = Object.entries(patterns).sort(([, a], [, b]) => b - a);
  const topPattern = sorted[0];
  const expectedFreq = dozens.length / 27; // 3^3 possible patterns
  const topFreq = topPattern ? topPattern[1] : 0;
  const ratio = topFreq / expectedFreq;
  const significant = ratio > 2.0 && topFreq >= 4;

  const nextDozen = significant ? parseInt(topPattern[0].split('-')[2]) : 0;
  const nextNums = nextDozen > 0 ? Array.from({ length: 12 }, (_, i) => (nextDozen - 1) * 12 + i + 1) : [];

  return {
    test_name: 'dozen_cycle',
    description: `Ciclo de dúzias: Padrão ${topPattern?.[0] || 'N/A'} repetiu ${topFreq}x (esperado: ${expectedFreq.toFixed(1)}). ${significant ? 'CICLO DETECTADO!' : 'Sem ciclo significativo.'}`,
    p_value: ratio > 3 ? 0.005 : ratio > 2 ? 0.03 : 0.5,
    significant,
    details: { top_patterns: sorted.slice(0, 5), ratio, top_frequency: topFreq },
    recommendation: significant ? `Ciclo D${topPattern[0].replace(/-/g, '→D')} repetindo — próxima: D${nextDozen}` : null,
    numbers_involved: nextNums,
    confidence: significant ? Math.min(80, 50 + Math.round(ratio * 10)) : 20,
  };
}

// ── Hourly Bias Detection ───────────────────────────────────────
function hourlyBiasTest(spins: number[]): DiscoveredPattern {
  const now = new Date();
  const hour = now.getHours();
  const isNight = hour >= 22 || hour < 6;
  const isMorning = hour >= 6 && hour < 12;

  // Simple heuristic: check if recent distribution differs significantly
  const recent50 = spins.slice(0, 50);
  const older50 = spins.slice(50, 100);
  if (older50.length < 30) {
    return { test_name: 'hourly_bias', description: 'Dados insuficientes para comparação temporal', p_value: 1, significant: false, details: {}, recommendation: null, numbers_involved: [], confidence: 0 };
  }

  // Compare distributions
  let chiSq = 0;
  for (let n = 0; n <= 36; n++) {
    const o1 = recent50.filter(x => x === n).length;
    const o2 = older50.filter(x => x === n).length;
    const e = (o1 + o2) / 2;
    if (e > 0) chiSq += Math.pow(o1 - e, 2) / e;
  }

  const significant = chiSq > 50.998;

  return {
    test_name: 'hourly_bias',
    description: `Análise temporal (${hour}h): χ² entre últimos 50 e anteriores = ${chiSq.toFixed(2)}. ${significant ? 'Mudança de comportamento da mesa detectada!' : 'Mesa estável.'} ${isNight ? '🌙 Período noturno' : isMorning ? '☀️ Período matutino' : '🕐 Período vespertino'}`,
    p_value: significant ? 0.03 : 0.5,
    significant,
    details: { hour, period: isNight ? 'night' : isMorning ? 'morning' : 'afternoon', chi_squared: chiSq },
    recommendation: significant ? 'Mesa mudou comportamento — recalibrar modelos' : null,
    numbers_involved: [],
    confidence: significant ? 60 : 20,
  };
}

// ═══════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    let clientNumbers: number[] | undefined;
    try {
      const body = await req.json();
      clientNumbers = body?.numbers;
    } catch { /* no body */ }

    // Fetch data
    const { data: numbersData } = await supabase
      .from('roulette_numbers')
      .select('number')
      .order('fetched_at', { ascending: false })
      .limit(500);

    const spins = clientNumbers && clientNumbers.length > 0
      ? clientNumbers.slice(0, 500)
      : (numbersData || []).map((r: any) => r.number as number);

    if (spins.length < 30) {
      return new Response(JSON.stringify({
        status: 'insufficient_data',
        message: 'Mínimo de 30 giros necessários para análise estatística.',
        patterns: [],
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Run all statistical tests
    const patterns: DiscoveredPattern[] = [
      chiSquaredTest(spins),
      chiSquaredColorTest(spins),
      runsTest(spins),
      autocorrelationTest(spins),
      sectorBiasTest(spins),
      wheelClusteringTest(spins),
      dozenCycleTest(spins),
      hourlyBiasTest(spins),
    ];

    const significantPatterns = patterns.filter(p => p.significant);

    // Store significant patterns with Bonferroni correction
    const bonferroniThreshold = 0.05 / patterns.length;
    const bonferroniSignificant = patterns.filter(p => p.p_value < bonferroniThreshold);

    // Save to pattern_insights
    if (significantPatterns.length > 0) {
      const inserts = significantPatterns.map(p => ({
        pattern_type: `discovery_${p.test_name}`,
        description: p.description,
        recommendation: p.recommendation,
        confidence: p.confidence,
        numbers_involved: p.numbers_involved.slice(0, 20),
        source_data: { test: p.test_name, details: p.details, p_value: p.p_value, bonferroni: p.p_value < bonferroniThreshold },
      }));

      await supabase.from('pattern_insights').insert(inserts);
    }

    // Save learning
    if (bonferroniSignificant.length > 0) {
      await supabase.from('ai_learned_patterns').upsert({
        learning_type: 'pattern_discovery',
        title: `Descoberta: ${bonferroniSignificant.length} padrões significativos`,
        knowledge: bonferroniSignificant.map(p => `${p.test_name}: ${p.description}`).join(' | '),
        accuracy: bonferroniSignificant.reduce((a, b) => a + b.confidence, 0) / bonferroniSignificant.length / 100,
        data_points: spins.length,
        metadata: { patterns_found: bonferroniSignificant.length, timestamp: new Date().toISOString() },
      }, { onConflict: 'learning_type' });
    }

    return new Response(JSON.stringify({
      status: 'complete',
      total_tests: patterns.length,
      significant_count: significantPatterns.length,
      bonferroni_significant: bonferroniSignificant.length,
      patterns,
      significant_patterns: significantPatterns,
      summary: significantPatterns.length > 0
        ? `${significantPatterns.length} padrões detectados: ${significantPatterns.map(p => p.test_name).join(', ')}`
        : 'Nenhum padrão estatisticamente significativo encontrado.',
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[pattern-discovery] Error:', error);
    return new Response(JSON.stringify({
      status: 'error',
      message: (error as Error).message,
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
