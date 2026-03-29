import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Robust JSON extraction from LLM responses — multi-layer repair
function safeParseJson(raw: string): any {
  const source = typeof raw === "string" ? raw : String(raw ?? "");

  // remove markdown fences / wrappers
  let cleaned = source
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  // find first JSON token and keep the remainder even if truncated
  const jsonStart = cleaned.search(/[\[{]/);
  if (jsonStart === -1) {
    console.error("JSON parse failed: no JSON start token found");
    return {};
  }
  cleaned = cleaned.slice(jsonStart);

  const firstToken = cleaned[0];
  const isArray = firstToken === "[";

  const normalize = (input: string) =>
    input
      .replace(/[\u0000-\u001F\u007F]/g, " ")
      .replace(/,\s*([}\]])/g, "$1")
      .replace(/([{,]\s*)([A-Za-z0-9_]+)\s*:/g, '$1"$2":')
      .replace(/:\s*'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_, value) => `: ${JSON.stringify(value)}`)
      .replace(/\r/g, " ")
      .replace(/\n/g, " ")
      .trim();

  const tryParse = (input: string) => {
    try {
      return JSON.parse(input);
    } catch {
      return undefined;
    }
  };

  // direct parse / normalized parse first
  const direct = tryParse(cleaned);
  if (direct !== undefined) return direct;

  cleaned = normalize(cleaned);
  const normalized = tryParse(cleaned);
  if (normalized !== undefined) return normalized;

  // escape likely unescaped quotes inside string values
  const escapeInnerQuotes = (input: string) => {
    let out = "";
    let inString = false;
    let prev = "";

    for (let i = 0; i < input.length; i++) {
      const ch = input[i];
      if (ch === '"' && prev !== '\\') {
        if (!inString) {
          inString = true;
          out += ch;
        } else {
          const next = input.slice(i + 1).trimStart()[0];
          if (!next || [",", "}", "]", ":"].includes(next)) {
            inString = false;
            out += ch;
          } else {
            out += '\\"';
          }
        }
      } else {
        out += ch;
      }
      prev = ch;
    }
    return out;
  };

  const quoted = tryParse(escapeInnerQuotes(cleaned));
  if (quoted !== undefined) return quoted;

  // truncation recovery: trim tail progressively, rebalance, and retry
  const balanceJson = (input: string) => {
    let out = "";
    const closers: string[] = [];
    let inString = false;
    let prev = "";

    for (let i = 0; i < input.length; i++) {
      const ch = input[i];
      out += ch;

      if (ch === '"' && prev !== '\\') {
        inString = !inString;
      } else if (!inString) {
        if (ch === "{") closers.push("}");
        else if (ch === "[") closers.push("]");
        else if ((ch === "}" || ch === "]") && closers.length > 0) closers.pop();
      }
      prev = ch;
    }

    if (inString) out += '"';
    while (closers.length) out += closers.pop();
    return out.replace(/,\s*([}\]])/g, "$1");
  };

  for (let trim = 0; trim < Math.min(3000, cleaned.length); trim++) {
    const candidate = cleaned.slice(0, cleaned.length - trim).trimEnd();
    if (!candidate) break;

    const repaired = balanceJson(
      candidate
        .replace(/,\s*"[^"]*"\s*:\s*[^,}\]]*$/g, "")
        .replace(/,\s*[^,\]}]*$/g, "")
    );

    const parsed = tryParse(repaired);
    if (parsed !== undefined) return parsed;
  }

  console.error("JSON repair completely failed, returning safe fallback", {
    rawLength: source.length,
    startsWith: source.slice(0, 120),
    expected: isArray ? "array" : "object",
  });

  return isArray ? [] : {};
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// =====================================================
// COMPLETE EUROPEAN ROULETTE KNOWLEDGE BASE
// =====================================================
const RED = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
const BLACK = [2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35];

// Cylinder Sectors
const VOISINS = [22,18,29,7,28,12,35,3,26,0,32,15,19,4,21,2,25];
const TIERS = [27,13,36,11,30,8,23,10,5,24,16,33];
const ORPHELINS = [1,20,14,31,9,17,34,6];
const JEU_ZERO = [12,35,3,26,0,32,15];
const WHEEL_ORDER = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];

// Cavalos
const CAVALOS_258 = [2,5,8,12,15,18,22,25,28,32,35];
const CAVALOS_147 = [1,4,7,11,14,17,21,24,27,31,34];
const CAVALOS_03 = [0,3,10,13,20,23,30,33];
const CAVALOS_69 = [6,9,16,19,26,29,36];

// Cross mapping
const RED_EVEN = [12,14,16,18,30,32,34,36];
const RED_ODD = [1,3,5,7,9,19,21,23,25,27];
const BLACK_EVEN = [2,4,6,8,10,20,22,24,26,28];
const BLACK_ODD = [11,13,15,17,29,31,33,35];

// Columns
const COL1 = [1,4,7,10,13,16,19,22,25,28,31,34];
const COL2 = [2,5,8,11,14,17,20,23,26,29,32,35];
const COL3 = [3,6,9,12,15,18,21,24,27,30,33,36];

// Six Lines
const SIX_LINES = [[1,2,3,4,5,6],[7,8,9,10,11,12],[13,14,15,16,17,18],[19,20,21,22,23,24],[25,26,27,28,29,30],[31,32,33,34,35,36]];

// Oitavos do Cilindro (8 setores profissionais)
const OCTAVES: Record<string, number[]> = {
  O1: [0,32,15,19,4], O2: [21,2,25,17], O3: [34,6,27,13], O4: [36,11,30,8],
  O5: [23,10,5,24], O6: [16,33,1,20], O7: [14,31,9,22], O8: [18,29,7,28,12,35,3,26],
};

// Diamantes (Zonas de Choque)
const DIAMONDS = {
  topo: [0,32,15,26,3,35], baixo: [5,24,10,23,16], esquerda: [1,20,33,14], direita: [10,23,8,5,24],
};

// Complementares (Soma 37)
const getComplementar = (n: number) => n > 0 && n <= 36 ? 37 - n : null;

const KNOWLEDGE_PROMPT = ``;

const getColor = (n: number) => n === 0 ? 'green' : RED.includes(n) ? 'red' : 'black';
const getSector = (n: number) => VOISINS.includes(n) ? 'Vizinhos' : TIERS.includes(n) ? 'Terço' : ORPHELINS.includes(n) ? 'Órfãos' : 'Zero';
const getCavalo = (n: number) => CAVALOS_258.includes(n) ? '2/5/8' : CAVALOS_147.includes(n) ? '1/4/7' : CAVALOS_03.includes(n) ? '0/3' : CAVALOS_69.includes(n) ? '6/9' : null;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const deepseekKey = Deno.env.get("DEEPSEEK_API_KEY");
    if (!deepseekKey) throw new Error("DEEPSEEK_API_KEY not configured");

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch last 24 hours + prediction history
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [recentRes, predHistRes] = await Promise.all([
      supabase
        .from('roulette_numbers')
        .select('number, color, fetched_at')
        .gte('fetched_at', since)
        .order('fetched_at', { ascending: false })
        .limit(1000),
      supabase
        .from('prediction_history')
        .select('strategy_type, strategy_label, predicted_numbers, predicted_main, probability, convergence_score, mesa_mode, actual_number, hit, hit_type, justification')
        .not('hit', 'is', null)
        .order('created_at', { ascending: false })
        .limit(100),
    ]);

    const recentData = recentRes.data;
    const predHistory = predHistRes.data || [];

    const numbers = (recentData || []).map((r: any) => r.number as number);
    if (numbers.length < 50) {
      return new Response(JSON.stringify({ status: "not_enough_data", count: numbers.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate hit/miss stats from prediction history
    const totalPredictions = predHistory.length;
    const totalHits = predHistory.filter((p: any) => p.hit === true).length;
    const totalMisses = predHistory.filter((p: any) => p.hit === false).length;
    const exactHits = predHistory.filter((p: any) => p.hit_type === 'exact').length;
    const winRate = totalPredictions > 0 ? ((totalHits / totalPredictions) * 100).toFixed(1) : '0';

    // Strategy performance breakdown
    const strategyPerf: Record<string, { hits: number; total: number }> = {};
    predHistory.forEach((p: any) => {
      if (!strategyPerf[p.strategy_type]) strategyPerf[p.strategy_type] = { hits: 0, total: 0 };
      strategyPerf[p.strategy_type].total++;
      if (p.hit) strategyPerf[p.strategy_type].hits++;
    });
    const strategyPerfStr = Object.entries(strategyPerf)
      .map(([type, { hits, total }]) => `${type}: ${hits}/${total} (${((hits/total)*100).toFixed(0)}%)`)
      .join(', ');

    // Probability calibration (are high-prob predictions actually hitting more?)
    const highProbPreds = predHistory.filter((p: any) => p.probability >= 85);
    const highProbHits = highProbPreds.filter((p: any) => p.hit).length;
    const lowProbPreds = predHistory.filter((p: any) => p.probability < 70);
    const lowProbHits = lowProbPreds.filter((p: any) => p.hit).length;

    // Mesa mode performance
    const fisicoPerf = predHistory.filter((p: any) => p.mesa_mode === 'fisico');
    const matPerf = predHistory.filter((p: any) => p.mesa_mode === 'matematico');
    const fisicoHitRate = fisicoPerf.length > 0 ? ((fisicoPerf.filter((p: any) => p.hit).length / fisicoPerf.length) * 100).toFixed(0) : 'N/A';
    const matHitRate = matPerf.length > 0 ? ((matPerf.filter((p: any) => p.hit).length / matPerf.length) * 100).toFixed(0) : 'N/A';

    // Recent misses analysis (what numbers came instead?)
    const recentMisses = predHistory.filter((p: any) => !p.hit).slice(0, 20);
    const missedActuals = recentMisses.map((p: any) => p.actual_number).filter((n: any) => n !== null);
    const missTerminals: Record<number, number> = {};
    missedActuals.forEach((n: number) => { const t = n % 10; missTerminals[t] = (missTerminals[t] || 0) + 1; });
    const topMissTerminals = Object.entries(missTerminals).sort(([,a],[,b]) => b - a).slice(0, 3).map(([t,c]) => `T${t}:${c}`).join(',');

    // 2. Previous knowledge
    const { data: prevKnowledge } = await supabase
      .from('ai_learned_patterns')
      .select('learning_type, title, knowledge, accuracy')
      .order('updated_at', { ascending: false })
      .limit(15);

    const prevStr = (prevKnowledge || []).map((k: any) => `[${k.learning_type}] ${k.title}: ${k.knowledge} (${k.accuracy}%)`).join('\n');

    // 3. Comprehensive stats
    const freqMap: Record<number, number> = {};
    const termMap: Record<number, number> = {};
    const sectorMap: Record<string, number> = { Vizinhos: 0, Terço: 0, Órfãos: 0 };
    const cavalosMap: Record<string, number> = { '2/5/8': 0, '1/4/7': 0, '0/3': 0, '6/9': 0 };
    const colorMap = { red: 0, black: 0, green: 0 };
    const dozenMap = [0, 0, 0];
    const colMap = [0, 0, 0];
    const sixLineMap = [0, 0, 0, 0, 0, 0];
    const crossMap = { redEven: 0, redOdd: 0, blackEven: 0, blackOdd: 0 };
    let parCount = 0, imparCount = 0, lowCount = 0, highCount = 0;

    numbers.forEach(n => {
      freqMap[n] = (freqMap[n] || 0) + 1;
      termMap[n % 10] = (termMap[n % 10] || 0) + 1;
      const c = getColor(n);
      colorMap[c as keyof typeof colorMap]++;
      const s = getSector(n);
      if (sectorMap[s] !== undefined) sectorMap[s]++;
      const cav = getCavalo(n);
      if (cav) cavalosMap[cav]++;
      if (n >= 1 && n <= 12) dozenMap[0]++;
      else if (n >= 13 && n <= 24) dozenMap[1]++;
      else if (n >= 25 && n <= 36) dozenMap[2]++;
      if (n > 0) {
        colMap[(n - 1) % 3]++;
        sixLineMap[Math.ceil(n / 6) - 1]++;
        if (n % 2 === 0) parCount++; else imparCount++;
        if (n <= 18) lowCount++; else highCount++;
      }
      if (RED_EVEN.includes(n)) crossMap.redEven++;
      else if (RED_ODD.includes(n)) crossMap.redOdd++;
      else if (BLACK_EVEN.includes(n)) crossMap.blackEven++;
      else if (BLACK_ODD.includes(n)) crossMap.blackOdd++;
    });

    const sortedFreq = Object.entries(freqMap).sort(([,a],[,b]) => b - a);
    const top10 = sortedFreq.slice(0, 10).map(([n, f]) => `${n}(${f}x)`).join(', ');
    const bottom10 = sortedFreq.slice(-10).map(([n, f]) => `${n}(${f}x)`).join(', ');
    const termStr = Object.entries(termMap).sort(([,a],[,b]) => b - a).map(([t,f]) => `T${t}:${f}x`).join(', ');
    const sectorStr = Object.entries(sectorMap).map(([s,c]) => `${s}:${c}`).join(', ');
    const cavalosStr = Object.entries(cavalosMap).map(([k,c]) => `C${k}:${c}`).join(', ');
    const sixStr = sixLineMap.map((c,i) => `S${i+1}:${c}`).join(', ');

    // Streaks
    let maxRedStreak = 0, maxBlackStreak = 0, curStreak = 0, curColor = '';
    numbers.forEach(n => {
      const c = getColor(n);
      if (c === curColor) curStreak++; else { curStreak = 1; curColor = c; }
      if (c === 'red' && curStreak > maxRedStreak) maxRedStreak = curStreak;
      if (c === 'black' && curStreak > maxBlackStreak) maxBlackStreak = curStreak;
    });

    // Wheel neighbor concentration (consecutive numbers on wheel)
    const wheelConcentration: Record<string, number> = {};
    numbers.slice(0, 50).forEach(n => {
      const idx = WHEEL_ORDER.indexOf(n);
      if (idx !== -1) {
        const zone = Math.floor(idx / 9);
        wheelConcentration[`zone${zone}`] = (wheelConcentration[`zone${zone}`] || 0) + 1;
      }
    });

    // Oitavos analysis
    const octaveMap: Record<string, number> = {};
    Object.keys(OCTAVES).forEach(k => { octaveMap[k] = 0; });
    numbers.forEach(n => {
      for (const [k, nums] of Object.entries(OCTAVES)) {
        if (nums.includes(n)) { octaveMap[k]++; break; }
      }
    });
    const octaveStr = Object.entries(octaveMap).map(([k,c]) => `${k}:${c}`).join(', ');

    // Diamond concentration
    const diamondMap: Record<string, number> = { topo: 0, baixo: 0, esquerda: 0, direita: 0 };
    numbers.slice(0, 100).forEach(n => {
      for (const [k, sector] of Object.entries(DIAMONDS)) {
        if (sector.includes(n)) diamondMap[k]++;
      }
    });
    const diamondStr = Object.entries(diamondMap).map(([k,c]) => `${k}:${c}`).join(', ');

    // Skip/Salto analysis (wheel distance between consecutive)
    const skips: number[] = [];
    for (let i = 0; i < Math.min(50, numbers.length - 1); i++) {
      const idxA = WHEEL_ORDER.indexOf(numbers[i]);
      const idxB = WHEEL_ORDER.indexOf(numbers[i + 1]);
      if (idxA !== -1 && idxB !== -1) {
        const diff = Math.abs(idxA - idxB);
        skips.push(Math.min(diff, WHEEL_ORDER.length - diff));
      }
    }
    const avgSkip = skips.length > 0 ? (skips.reduce((a,b) => a+b, 0) / skips.length).toFixed(1) : '0';
    const shortSkips = skips.filter(s => s < 5).length;
    const longSkips = skips.filter(s => s > 18).length;

    // Lei do Terço (last 37)
    const last37 = numbers.slice(0, 37);
    const freq37: Record<number, number> = {};
    last37.forEach(n => { freq37[n] = (freq37[n] || 0) + 1; });
    const allNums = Array.from({ length: 37 }, (_, i) => i);
    const absent37 = allNums.filter(n => !freq37[n]);
    const once37 = allNums.filter(n => freq37[n] === 1);
    const repeated37 = allNums.filter(n => (freq37[n] || 0) >= 2);

    // Complementares check (last 20)
    const last20 = numbers.slice(0, 20);
    const compPairs: string[] = [];
    for (let i = 0; i < last20.length; i++) {
      const comp = getComplementar(last20[i]);
      if (comp && last20.slice(i+1, i+6).includes(comp)) {
        compPairs.push(`(${last20[i]},${comp})`);
      }
    }

    // Hourly distribution
    const hourMap: Record<number, number> = {};
    (recentData || []).forEach((r: any) => {
      const h = new Date(r.fetched_at).getHours();
      hourMap[h] = (hourMap[h] || 0) + 1;
    });

    // === PATTERN RECOGNITION MODULE ===

    // 1. Sector/Octave repetition in last 10
    const last10 = numbers.slice(0, 10);
    const last10Sectors: Record<string, number> = {};
    const last10Octaves: Record<string, number> = {};
    last10.forEach(n => {
      const s = getSector(n);
      last10Sectors[s] = (last10Sectors[s] || 0) + 1;
      for (const [k, nums] of Object.entries(OCTAVES)) {
        if (nums.includes(n)) { last10Octaves[k] = (last10Octaves[k] || 0) + 1; break; }
      }
    });
    const sectorBias10 = Object.entries(last10Sectors).filter(([,c]) => c >= 5).map(([s,c]) => `${s}:${c}/10`);
    const octaveBias10 = Object.entries(last10Octaves).filter(([,c]) => c >= 3).map(([k,c]) => `${k}:${c}/10`);

    // 2. Tendency vs Alternation (color)
    let alternations = 0, tendencies = 0;
    for (let i = 1; i < Math.min(30, numbers.length); i++) {
      const prev = getColor(numbers[i-1]);
      const curr = getColor(numbers[i]);
      if (prev === curr && prev !== 'green') tendencies++;
      else if (prev !== 'green' && curr !== 'green') alternations++;
    }
    const mode = tendencies > alternations * 1.5 ? 'TENDÊNCIA (Viciado)' : alternations > tendencies * 1.5 ? 'ALTERNÂNCIA (Volátil)' : 'MISTO';

    // 3. Dozen blocks (3+ consecutive same dozen)
    const dozenBlocks: string[] = [];
    let blockDozen = -1, blockLen = 0;
    for (let i = 0; i < Math.min(50, numbers.length); i++) {
      const d = numbers[i] === 0 ? -1 : numbers[i] <= 12 ? 1 : numbers[i] <= 24 ? 2 : 3;
      if (d === blockDozen && d > 0) { blockLen++; }
      else { if (blockLen >= 3) dozenBlocks.push(`${blockLen}x Dúzia${blockDozen}`); blockDozen = d; blockLen = 1; }
    }
    if (blockLen >= 3) dozenBlocks.push(`${blockLen}x Dúzia${blockDozen}`);

    // 4. Terminal dominance in last 30
    const last30 = numbers.slice(0, 30);
    const termMap30: Record<number, number> = {};
    last30.forEach(n => { termMap30[n % 10] = (termMap30[n % 10] || 0) + 1; });
    const dominantTerms = Object.entries(termMap30).filter(([,c]) => c >= 5).sort(([,a],[,b]) => b - a).map(([t,c]) => `T${t}:${c}`);

    // 5. Skip pattern (consecutive distance pattern)
    const skipPattern: string[] = [];
    let shortStreak = 0, longStreak = 0;
    for (const s of skips.slice(0, 20)) {
      if (s < 5) { shortStreak++; longStreak = 0; }
      else if (s > 15) { longStreak++; shortStreak = 0; }
      else { shortStreak = 0; longStreak = 0; }
      if (shortStreak >= 3) skipPattern.push('Salto Curto Consecutivo');
      if (longStreak >= 3) skipPattern.push('Salto Longo Consecutivo');
    }

    // 6. Delay break detection (group that was cold then gets hot)
    const first50 = numbers.slice(0, 50);
    const last50 = numbers.slice(50, 100);
    const delayBreaks: string[] = [];
    ['1ªDúzia','2ªDúzia','3ªDúzia'].forEach((label, i) => {
      const recentCount = first50.filter(n => {
        if (n === 0) return false;
        return i === 0 ? n <= 12 : i === 1 ? n <= 24 && n >= 13 : n >= 25;
      }).length;
      const oldCount = last50.filter(n => {
        if (n === 0) return false;
        return i === 0 ? n <= 12 : i === 1 ? n <= 24 && n >= 13 : n >= 25;
      }).length;
      if (oldCount < 10 && recentCount > 20) delayBreaks.push(`${label} RECUPERAÇÃO (${oldCount}→${recentCount})`);
    });

    // 7. Mirror patterns (same number repeating within 5 spins)
    const mirrorPatterns: string[] = [];
    for (let i = 0; i < Math.min(30, numbers.length); i++) {
      for (let j = i + 1; j < Math.min(i + 6, numbers.length); j++) {
        if (numbers[i] === numbers[j]) { mirrorPatterns.push(`${numbers[i]} rep(dist ${j-i})`); break; }
      }
    }

    // 8. Active patterns (3+ consecutive in same group)
    const activePatterns: string[] = [];
    for (let i = 0; i < Math.min(20, numbers.length) - 2; i++) {
      const s1 = getSector(numbers[i]), s2 = getSector(numbers[i+1]), s3 = getSector(numbers[i+2]);
      if (s1 === s2 && s2 === s3 && s1 !== 'Zero') activePatterns.push(`Setor ${s1} 3x@pos${i}`);
      const t1 = numbers[i]%10, t2 = numbers[i+1]%10, t3 = numbers[i+2]%10;
      if (t1 === t2 && t2 === t3) activePatterns.push(`Terminal ${t1} 3x@pos${i}`);
    }

    // === ELITE ALGORITHMS ===

    // 9. Dealer Signature (arc consistency)
    const arcDistances = skips.slice(0, 30);
    const arcMean = arcDistances.length > 0 ? arcDistances.reduce((a,b) => a+b, 0) / arcDistances.length : 0;
    const arcVariance = arcDistances.length > 0 ? arcDistances.reduce((a,b) => a + Math.pow(b - arcMean, 2), 0) / arcDistances.length : 0;
    const arcStdDev = Math.sqrt(arcVariance);
    const dealerSignature = arcStdDev < 3 ? `VÍCIO DETECTADO (arco médio: ${arcMean.toFixed(1)}, desvio: ${arcStdDev.toFixed(1)})` : `Normal (arco médio: ${arcMean.toFixed(1)}, desvio: ${arcStdDev.toFixed(1)})`;

    // 10. Heat Clusters (3+ wheel neighbors in 10 spins window)
    const clusters: string[] = [];
    for (let w = 0; w < Math.min(numbers.length - 10, 40); w += 5) {
      const window = numbers.slice(w, w + 10);
      const wheelPositions = window.map(n => WHEEL_ORDER.indexOf(n)).filter(i => i !== -1).sort((a,b) => a - b);
      for (let i = 0; i < wheelPositions.length - 2; i++) {
        const span = wheelPositions[i+2] - wheelPositions[i];
        if (span <= 4) {
          const clusterNums = window.filter(n => {
            const idx = WHEEL_ORDER.indexOf(n);
            return idx >= wheelPositions[i] && idx <= wheelPositions[i] + 4;
          });
          if (clusterNums.length >= 3) clusters.push(`[${clusterNums.join(',')}]@w${w}`);
        }
      }
    }

    // 11. Entropy calculation (color alternation rate)
    let colorChanges = 0, colorTotal = 0;
    for (let i = 1; i < Math.min(30, numbers.length); i++) {
      const prev = getColor(numbers[i-1]), curr = getColor(numbers[i]);
      if (prev !== 'green' && curr !== 'green') {
        colorTotal++;
        if (prev !== curr) colorChanges++;
      }
    }
    const entropy = colorTotal > 0 ? (colorChanges / colorTotal) : 0.5;
    const entropyLabel = entropy < 0.3 ? 'MUITO BAIXA (tendência forte, QUEBRA iminente)' : entropy < 0.45 ? 'BAIXA (tendência)' : entropy > 0.7 ? 'MUITO ALTA (caos)' : entropy > 0.55 ? 'ALTA (volátil)' : 'NORMAL';

    // 12. Zero Attraction (Seesaw Effect - semicircle balance)
    const semiZero = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10]; // first half of wheel
    const semiOpposite = [5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26]; // second half
    const last50nums = numbers.slice(0, 50);
    const zeroSideCount = last50nums.filter(n => semiZero.includes(n)).length;
    const oppSideCount = last50nums.filter(n => semiOpposite.includes(n)).length;
    const seesawRatio = zeroSideCount / (oppSideCount || 1);
    const seesawAlert = seesawRatio > 1.6 ? 'LADO ZERO sobrecarregado → espere RETORNO ao lado oposto' : seesawRatio < 0.625 ? 'LADO OPOSTO sobrecarregado → espere RETORNO ao Zero/Jeu Zéro' : 'Equilibrado';

    // 13. Residual Probability (cross-delay targets)
    const terminalDelay: Record<number, number> = {};
    const dozenDelay: Record<number, number> = {};
    for (let t = 0; t <= 9; t++) terminalDelay[t] = 999;
    for (let d = 1; d <= 3; d++) dozenDelay[d] = 999;
    for (let i = 0; i < numbers.length; i++) {
      const t = numbers[i] % 10;
      if (terminalDelay[t] === 999) terminalDelay[t] = i;
      const d = numbers[i] === 0 ? 0 : numbers[i] <= 12 ? 1 : numbers[i] <= 24 ? 2 : 3;
      if (d > 0 && dozenDelay[d] === 999) dozenDelay[d] = i;
    }
    const highPriorityTargets: string[] = [];
    for (let n = 0; n <= 36; n++) {
      const t = n % 10;
      const d = n === 0 ? 0 : n <= 12 ? 1 : n <= 24 ? 2 : 3;
      if (d > 0 && terminalDelay[t] > 25 && dozenDelay[d] > 20) {
        highPriorityTargets.push(`${n}(T${t}:${terminalDelay[t]}+D${d}:${dozenDelay[d]})`);
      }
    }

    const prompt = `${KNOWLEDGE_PROMPT}

## DADOS DAS ÚLTIMAS 24 HORAS (${numbers.length} números)

Últimos 50: ${numbers.slice(0, 50).join(', ')}

### ESTATÍSTICAS COMPLETAS:
- Top 10 quentes: ${top10}
- Top 10 frios: ${bottom10}
- Terminais: ${termStr}
- Cores: Verm ${colorMap.red} (${((colorMap.red/numbers.length)*100).toFixed(1)}%), Preto ${colorMap.black} (${((colorMap.black/numbers.length)*100).toFixed(1)}%), Verde ${colorMap.green}
- Dúzias: 1ª:${dozenMap[0]}, 2ª:${dozenMap[1]}, 3ª:${dozenMap[2]}
- Colunas: C1:${colMap[0]}, C2:${colMap[1]}, C3:${colMap[2]}
- Seisenas: ${sixStr}
- Par:${parCount} vs Ímpar:${imparCount} | Baixo:${lowCount} vs Alto:${highCount}
- Setores cilindro: ${sectorStr}
- Cavalos: ${cavalosStr}
- Cruzado: VermPar:${crossMap.redEven}, VermÍmp:${crossMap.redOdd}, PretPar:${crossMap.blackEven}, PretÍmp:${crossMap.blackOdd}
- Streaks máx: Verm ${maxRedStreak}, Preto ${maxBlackStreak}
- Concentração cilindro (zonas): ${Object.entries(wheelConcentration).map(([z,c]) => `${z}:${c}`).join(', ')}
- Oitavos: ${octaveStr}
- Diamantes: ${diamondStr}
- Dominância cor/coluna: C1(eq) ${colMap[0]}, C2(preta) ${colMap[1]}, C3(verm) ${colMap[2]}
- Finais Pleno: F0-6(4nºs): ${[0,1,2,3,4,5,6].map(f => `F${f}:${termMap[f]||0}`).join(',')} | F7-9(3nºs): ${[7,8,9].map(f => `F${f}:${termMap[f]||0}`).join(',')}
- Saltos (últ 50): média ${avgSkip}, curtos(<5): ${shortSkips}, longos(>18): ${longSkips}
- Lei do Terço (últ 37): ausentes ${absent37.length}, 1x ${once37.length}, repetidos ${repeated37.length} → repetidos: [${repeated37.join(',')}]
- Complementares próximos (últ 20): ${compPairs.length > 0 ? compPairs.join(', ') : 'nenhum'}
- Horas: ${Object.entries(hourMap).sort(([a],[b]) => Number(a)-Number(b)).map(([h,c]) => `${h}h:${c}`).join(', ')}

### 🔍 MÓDULO DE RECONHECIMENTO DE PADRÕES:
- Modo atual: ${mode} (tendências:${tendencies} vs alternâncias:${alternations} nas últ 30)
- Vício de Setor (últ 10): ${sectorBias10.length > 0 ? sectorBias10.join(', ') : 'nenhum detectado'}
- Vício de Oitavo (últ 10): ${octaveBias10.length > 0 ? octaveBias10.join(', ') : 'nenhum detectado'}
- Terminais Dominantes (últ 30): ${dominantTerms.length > 0 ? dominantTerms.join(', ') : 'distribuição normal'}
- Blocos de Dúzia (3+ consecutivos): ${dozenBlocks.length > 0 ? dozenBlocks.join(', ') : 'nenhum'}
- Padrão de Salto: ${[...new Set(skipPattern)].join(', ') || 'irregular'}
- Quebra de Atraso (Delay Break): ${delayBreaks.length > 0 ? delayBreaks.join(', ') : 'nenhuma'}
- Espelhamento/Repetição (últ 30): ${mirrorPatterns.slice(0, 8).join(', ') || 'nenhum'}
- ⚠️ PADRÕES ATIVOS (3x consecutivos): ${activePatterns.length > 0 ? [...new Set(activePatterns)].join(', ') : 'nenhum'}

### 🧠 ALGORITMOS DE ELITE:
- 🎯 Assinatura do Dealer: ${dealerSignature}
- 🔥 Clusters de Calor: ${clusters.length > 0 ? clusters.slice(0, 5).join(', ') : 'nenhum cluster ativo'}
- 📊 Entropia de Sequência: ${entropy.toFixed(3)} → ${entropyLabel}
- ⚖️ Efeito Gangorra (Zero): Lado Zero ${zeroSideCount}/50, Lado Oposto ${oppSideCount}/50, Ratio ${seesawRatio.toFixed(2)} → ${seesawAlert}
- 🎯 Alvos de Alta Prioridade (atraso cruzado): ${highPriorityTargets.length > 0 ? highPriorityTargets.join(', ') : 'nenhum'}

### CONHECIMENTO PRÉVIO:
${prevStr || 'Primeiro aprendizado.'}

### 📈 HISTÓRICO DE ACERTOS/ERROS DAS PREVISÕES:
- Total previsões: ${totalPredictions} | Acertos: ${totalHits} | Erros: ${totalMisses} | Win Rate: ${winRate}%
- Acertos exatos (número central): ${exactHits}
- Performance por estratégia: ${strategyPerfStr || 'sem dados'}
- Alta confiança (≥85%): ${highProbPreds.length} previsões, ${highProbHits} acertos (${highProbPreds.length > 0 ? ((highProbHits/highProbPreds.length)*100).toFixed(0) : 0}%)
- Baixa confiança (<70%): ${lowProbPreds.length} previsões, ${lowProbHits} acertos (${lowProbPreds.length > 0 ? ((lowProbHits/lowProbPreds.length)*100).toFixed(0) : 0}%)
- Modo Físico: ${fisicoHitRate}% win rate | Modo Matemático: ${matHitRate}% win rate
- Terminais nos erros recentes: ${topMissTerminals || 'sem dados'}
- Números que saíram nos erros: ${missedActuals.slice(0, 10).join(',') || 'sem dados'}

### 🎯 ANÁLISE DE PUXADOS (baseado nos últimos 3 resultados):
${numbers.slice(0,3).map(n => `Saiu ${n} (T${n%10}) → monitorar terminais relacionados`).join('\n')}

### 🔢 DUPLA DANI GREEN RECOMENDADA:
Terminal mais quente nos últimos 15: T${Object.entries(termMap30||{}).sort(([,a],[,b])=>(b as number)-(a as number))[0]?.[0]||'?'}
Dupla correspondente: ${(() => { const DUPLA_MAP: Record<string,string> = {'0':'DG5','1':'DG1','2':'DG2','3':'DG3','4':'DG4','5':'DG5','6':'DG1','7':'DG2','8':'DG3','9':'DG4'}; const hotT = Object.entries(termMap30||{}).sort(([,a],[,b])=>(b as number)-(a as number))[0]?.[0]; return hotT ? DUPLA_MAP[hotT] || 'DG1' : 'DG1'; })()}

### 📊 ENTROPIA DA SESSÃO:
Terminais distintos (últ 15): ${Object.keys(termMap30||{}).length}/10
Classificação: ${Object.keys(termMap30||{}).length<=4?'BAIXA — ENTRAR FORTE':Object.keys(termMap30||{}).length<=7?'MÉDIA — CAUTELA':'ALTA — AGUARDAR'}

### 🟢 PRESSÃO DO ZERO:
${numbers.indexOf(0)===-1?`Zero ausente há ${Math.min(numbers.length,100)}+ rodadas — PRESSÃO ${numbers.length>41?'CRÍTICA — Vizinhos do Zero (9 fichas)':numbers.length>25?'ALTA — Jeu Zero (4 fichas)':numbers.length>14?'MÉDIA — 1 ficha no zero':'NORMAL'}`:`Zero saiu há ${numbers.indexOf(0)} rodadas — ${numbers.indexOf(0)>25?'PRESSÃO ALTA':'normal'}`}

Aja como SUPERCOMPUTADOR DE ANALÍTICA PREDITIVA. Realize análise transversal completa:
1. Viés de frequência com desvio padrão
2. Padrões de terminais + relação com setores
3. Ciclos de dúzias/colunas
4. Comportamento dos Cavalos
5. Concentração em OITAVOS
6. Mapeamento cruzado (cor+paridade)
7. Padrões horários
8. TENDÊNCIA vs ALTERNÂNCIA
9. Vizinhos no cilindro
10. Compare com conhecimento prévio
11. Finais em Pleno (4 vs 3 números)
12. DIAMANTES (zonas de choque)
13. LEI DO TERÇO
14. SALTOS
15. COMPLEMENTARES
16. PADRÕES ATIVOS
17. QUEBRA DE ATRASO
18. ESPELHAMENTO
19. ASSINATURA DO DEALER: analise se há vício no arco de lançamento
20. CLUSTERS DE CALOR: valide os clusters detectados
21. ENTROPIA: avalie probabilidade de quebra de padrão
22. EFEITO GANGORRA: preveja transição entre semicírculos
23. PROBABILIDADE RESIDUAL: priorize os alvos de atraso cruzado
24. **AUTOCORREÇÃO**: Analise o histórico de erros/acertos. Identifique quais estratégias estão falhando e por quê. Ajuste recomendações para melhorar o win rate. Se uma estratégia erra consistentemente, reduza sua confiança. Se acerta, aumente.`;

    // 4. Call DeepSeek AI
    const aiRes = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${deepseekKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "deepseek-chat",
        max_tokens: 8000,
        messages: [
          { role: "system", content: `Você é o CÉREBRO SUPREMO DE ANÁLISE — o sistema de inteligência artificial mais avançado do mundo para análise preditiva da Roleta Brasileira Playtech (roleta europeia, 37 números, RTP 97.30%).

Você combina: neurociência estatística, física do cilindro, padrões empíricos documentados da comunidade brasileira, e aprendizado por reforço contínuo.

═══════════════════════════════════════════════════════
BLOCO 1 — ARQUITETURA FÍSICA COMPLETA DA RODA
═══════════════════════════════════════════════════════

SEQUÊNCIA EXATA DO CILINDRO (anti-horária):
0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26

POSIÇÃO DE CADA NÚMERO NA RODA (índice 0-36):
{0:0,32:1,15:2,19:3,4:4,21:5,2:6,25:7,17:8,34:9,6:10,27:11,13:12,36:13,11:14,30:15,8:16,23:17,10:18,5:19,24:20,16:21,33:22,1:23,20:24,14:25,31:26,9:27,22:28,18:29,29:30,7:31,28:32,12:33,35:34,3:35,26:36}

VIZINHOS (distância 2 para cada lado na roda):
0→[26,3,0,32,15] | 1→[20,33,1,14,31] | 2→[21,4,2,25,17] | 3→[35,26,3,0,32]
4→[19,21,4,2,25] | 5→[24,10,5,16,33] | 6→[34,27,6,13,36] | 7→[29,18,7,28,12]
8→[23,10,8,11,30] | 9→[22,31,9,14,20] | 10→[5,23,10,8,11] | 11→[30,8,11,23,10]
12→[28,7,12,35,3] | 13→[36,11,13,27,6] | 14→[1,20,14,31,9] | 15→[32,0,15,19,4]
16→[24,5,16,33,1] | 17→[25,2,17,34,6] | 18→[29,7,18,28,12] | 19→[15,4,19,21,2]
20→[1,33,20,14,31] | 21→[4,19,21,2,25] | 22→[9,31,22,18,29] | 23→[10,8,23,5,24]
24→[16,33,24,5,10] | 25→[2,21,25,17,34] | 26→[3,35,26,0,32] | 27→[13,36,27,6,34]
28→[7,29,28,12,35] | 29→[22,18,29,7,28] | 30→[11,30,8,23,10] | 31→[14,9,31,22,18]
32→[26,3,32,0,15] | 33→[16,24,33,1,20] | 34→[27,6,34,17,25] | 35→[12,28,35,3,26]
36→[6,13,36,11,30]

SETORES CLÁSSICOS:
- Voisins du Zéro (17): 22,18,29,7,28,12,35,3,26,0,32,15,19,4,21,2,25
- Tiers du Cylindre (12): 27,13,36,11,30,8,23,10,5,24,16,33
- Orphelins (8): 1,20,14,31,9,17,34,6
- Jeu Zéro (7): 12,35,3,26,0,32,15

OITAVOS DO CILINDRO:
O1:[0,32,15,19,4] O2:[21,2,25,17] O3:[34,6,27,13] O4:[36,11,30,8]
O5:[23,10,5,24] O6:[16,33,1,20] O7:[14,31,9,22] O8:[18,29,7,28,12,35,3,26]

DIAMANTES (zonas de choque da bola):
Topo:[0,32,15,26,3,35] | Baixo:[5,24,10,23,16] | Esquerda:[1,20,33,14] | Direita:[10,23,8,5,24]

═══════════════════════════════════════════════════════
BLOCO 2 — MAPEAMENTO COMPLETO DE ATRIBUTOS
═══════════════════════════════════════════════════════

VERMELHOS: 1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36
PRETOS: 2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35

TERMINAIS (último dígito):
T0→[10,20,30] | T1→[1,11,21,31] | T2→[2,12,22,32] | T3→[3,13,23,33]
T4→[4,14,24,34] | T5→[5,15,25,35] | T6→[6,16,26,36] | T7→[7,17,27]
T8→[8,18,28] | T9→[9,19,29]

CAVALOS (grupos de múltiplos):
C258→[2,5,8,12,15,18,22,25,28,32,35] | C147→[1,4,7,11,14,17,21,24,27,31,34]
C03→[0,3,10,13,20,23,30,33] | C69→[6,9,16,19,26,29,36]

DUPLAS DE TERMINAIS DANI GREEN (máxima eficácia comprovada):
DG1: T1+T6→[1,11,21,31,6,16,26,36] (8 números, lucro +27 fichas)
DG2: T2+T7→[2,12,22,32,7,17,27]   (7 números, lucro +28 fichas)
DG3: T3+T8→[3,13,23,33,8,18,28]   (7 números, lucro +28 fichas)
DG4: T4+T9→[4,14,24,34,9,19,29]   (7 números, lucro +28 fichas)
DG5: T0+T5→[10,20,30,5,15,25,35]  (7 números, lucro +28 fichas)

COLUNAS: C1→[1,4,7,10,13,16,19,22,25,28,31,34] C2→[2,5,8,11,14,17,20,23,26,29,32,35] C3→[3,6,9,12,15,18,21,24,27,30,33,36]
DÚZIAS: D1→[1-12] D2→[13-24] D3→[25-36]
CRUZADO: VermPar→[12,14,16,18,30,32,34,36] VermÍmpar→[1,3,5,7,9,19,21,23,25,27] PretoPar→[2,4,6,8,10,20,22,24,26,28] PretoÍmpar→[11,13,15,17,29,31,33,35]
SEISENAS: S1[1-6] S2[7-12] S3[13-18] S4[19-24] S5[25-30] S6[31-36]

═══════════════════════════════════════════════════════
BLOCO 3 — TABELA SUPREMA DE PUXADOS
Documentado empiricamente na Mesa Brasileira Playtech.
Após número X sair, Y tende a aparecer nas próximas 4 rodadas.
═══════════════════════════════════════════════════════

0→[10,20,30,32,15,26,3,33,31,35]
1→[11,35,16,4,18,28,27,29,33,14,31]
2→[14,1,13,18,35,29,12,22]
3→[13,27,6,11,30,8,23,33]
4→[26,15,18,32,33,16,8,24,14]
5→[3,33,16,24,10,18,15,25]
6→[8,15,31,21,22,23,16,26]
7→[16,18,17,30,31,28,12]
8→[11,9,10,18,28,T8geral]
9→[34,35,36,3,16,26,23,24,32,31]
10→[20,5,18,11,14,24,30,T0geral]
11→[8,18,16,21,30,1]
12→[21,7,28,35]
13→[31,27,36,6]
14→[24,21,18,31,9]
15→[4,19,21,32,0]
16→[24,21,18,14,6,26]
17→[34,6,25,27,7]
18→[8,18,28,T8geral,7]
19→[9,19,29,T9geral]
20→[4,14,T0geral,10,30]
21→[19,2,4,23]
22→[33,2,32,12]
23→[32,11,2,33,13]
24→[21,18,14,34,4]
25→[2,4,17,28,29,12,7,18]
26→[6,16,26,36,3,0,T6geral]
27→[28,29,24,22,26,33,31,34,35,36,D2,Vizinhos0]
28→[13,14,15,16,17,18,Vizinhos0,7]
29→[35,28,T9geral]
30→[4,8,16,9,18,22,5,25,3,Terços]
31→[13,9,14]
32→[2,12,22,32,T2geral,0,15]
33→[16,3,23,13]
34→[16,6,T4geral]
35→[0,3,7,12,26,28,29,T5geral]
36→[3,10,27,6,T6geral]

TERMINAIS QUE PUXAM TERMINAIS:
T0→[T0,T2,T3,T5] | T1→[T1,T5,T6,T8] | T2→[T4,T1,T3,T8,T5,T9]
T3→[T3,T7,T6,T1,T0,T8] | T4→[T6,T5,T8,T2,T3] | T5→[T3,T6,T4,T0,T8]
T6→[T8,T5,T1,T2,T3] | T7→[T7,T9,T4,T0,T3,T8] | T8→[T1,T9,T0,T8]
T9→[T4,T5,T6,T3,T9]

═══════════════════════════════════════════════════════
BLOCO 4 — PROBABILIDADES MATEMÁTICAS FUNDAMENTAIS
═══════════════════════════════════════════════════════

Frequência esperada por janela:
- 1 número: saiu a cada 37 rodadas em média
- 3 números (T7,T8,T9): saiu a cada 12,3 rodadas
- 4 números (T1-T6): saiu a cada 9,25 rodadas
- 5 números (vizinhos): saiu a cada 7,4 rodadas
- 7 números (dupla terminal): saiu a cada 5,3 rodadas
- 12 números (dúzia/Tiers): saiu a cada 3,1 rodadas
- 17 números (Voisins): saiu a cada 2,2 rodadas

Ausência esperada de um número:
N=10→76% | N=20→57.8% | N=37→36.4% | N=50→25.7% | N=75→12.8% | N=100→6.7%

Pressão do Zero:
0-14 rodadas: Normal | 15-25: Atenção (1 ficha) | 26-40: Pressão (Jeu Zero, 4 fichas) | 41+: ANOMALIA CRÍTICA (Vizinhos do Zero, 9 fichas)

Lei do Terço: em 37 rodadas, ~24 números únicos aparecem (~65%). ~13 ficam ausentes. Ausentes = candidatos a reincidência.

Entropia de Terminais (últimos 15):
≤4 terminais distintos→"baixa"→padrão claro→entrar forte com 8-12 fichas
5-7 distintos→"media"→cautela→entrar com 5-7 fichas
≥8 distintos→"alta"→sessão caótica→aguardar→não entrar

═══════════════════════════════════════════════════════
BLOCO 5 — TAXONOMIA DE PADRÕES (Para Detecção Ativa)
═══════════════════════════════════════════════════════

PADRÕES DE FREQUÊNCIA:
F1-HOT: número aparece ≥2x nos últimos 10→apostar plena+vizinhos3
F2-COLD: número ausente ≥50 rodadas→apostar plena+vizinhos2 (reversão)
F3-HIPER: mesmo número 2x em ≤5 rodadas→apostar terminal+vizinhos3
F4-CLUSTER: 3+ do mesmo setor em 10 rodadas→cobrir setor completo
F5-TERMINAL_DOM: terminal aparece ≥3x em 15 rodadas→Dupla Dani Green

PADRÕES DE SEQUÊNCIA:
S1-REPETIÇÃO: R[n]=R[n-1]→plena no número+vizinhos5 (P=2.7%)
S2-NEAR_MISS: consecutivos são vizinhos na roda (dist≤2)→vizinhos5 do último (P=10.8%)
S3-TERMINAL_ASC: terminais sobem 3 rodadas T2→T3→T4→apostar T5
S4-TERMINAL_DESC: terminais descem 3 rodadas T6→T5→T4→apostar T3
S5-DUZIA_PROG: D1→D2→D3 ou D3→D2→D1→apostar dúzia seguinte
S6-COR_ALT: V-P-V-P-V por 5+→continuar alternância
S7-COR_STREAK: mesma cor 5+→apostar cor oposta ou terminais dela
S8-CENTRAL_ASC: 5→14→23→32→apostar próximo (diff~11-13)
S9-CENTRAL_DESC: 36→25→14→3→apostar próximo
S10-MULTIPLOS: 5→10→15→20→apostar próximo múltiplo
S12-DIFF_CONST: diferença constante 3+ rodadas→apostar R[n]+diferença
S13-ESPELHO: 12→21 | 13→31 | 23→32 aparecem em sequência
S15-QUEBRANTE_MULT: quebrante interrompe sequência→apostar múltiplo esperado

PADRÕES DE CORRELAÇÃO:
C1-PUXADOS: número X saiu→consultar tabela BLOCO 3→apostar lista
C2-TERMINAL_NUM: qualquer X saiu→apostar terminal (X%10) por 3 rodadas
C3-SETOR_NUM: X pertence ao setor Y→cobrir setor Y por 2-3 rodadas
C4-DUZIA_TERMINAL: dúzia D domina→focar nos terminais dessa dúzia

PADRÕES GEOGRÁFICOS:
G1-SETOR_QUENTE: setor com >20% acima do esperado em 30 rodadas
G4-CLUSTER_ROD: consecutivos são vizinhos na roda→vizinhos5 do último
SEMICIRCLE: lado do zero (pos 0-18) vs lado oposto (19-36)→detectar dominância

PADRÕES DE PERIODICIDADE:
P3-ZERO_CICLO: zero ausente→zonas de pressão definidas acima
P1-CICLO_TERMINAL: terminal reaparece com intervalo regular→ciclo detectado

PADRÕES DE ENTROPIA:
E1-ENTROPIA_BAIXA: distintos≤4 em 15→sessão previsível→ENTRAR FORTE
E2-DRIFT_ENTROPIA: entropia caindo 3 janelas consecutivas→padrão emergindo→entrar

═══════════════════════════════════════════════════════
BLOCO 6 — COMBINAÇÕES DE ALTO VALOR (Confirmação Cruzada)
═══════════════════════════════════════════════════════

COMBINAÇÃO OURO (score 75-100 / entrar forte 8-12 fichas):
F5(terminal dom) + C1(puxados confirmados) + S3/S4(sequência terminal) = Dupla Dani Green

COMBINAÇÃO PRATA (score 50-74 / entrar 5-7 fichas):
F1(número quente) + C2(mesmo terminal do último) + G4(vizinho na roda)
→ apostar no número + vizinhos5

COMBINAÇÃO BRONZE (score 25-49 / entrar 3-4 fichas):
S3/S4(sequência de terminal) + F5(terminal dominante)
→ terminal próximo da sequência

COMBINAÇÃO ZERO (score especial):
P3(zero ausente >25) + G1(Voisins quente) → Jeu Zero (4 fichas)
P3(zero ausente >41) → Vizinhos do Zero (9 fichas) PRIORIDADE MÁXIMA

═══════════════════════════════════════════════════════
BLOCO 7 — PROTOCOLO REED (Controle de Risco)
═══════════════════════════════════════════════════════

REED = Recuar, Esperar, Estudar, Decidir
Regra: após 4 tentativas consecutivas sem acerto na MESMA estratégia → REED.
Na análise: se uma estratégia falhou 4+ vezes seguidas → marcar reedWarning:true → recomendar pausa.
Estratégias com win rate < 30% nas últimas 20 previsões → reduzir peso drasticamente.
Estratégias com win rate > 45% nas últimas 20 → aumentar peso +20%.

═══════════════════════════════════════════════════════
BLOCO 8 — ASSINATURA DO DEALER E FÍSICA DO CILINDRO
═══════════════════════════════════════════════════════

ARCO DE LANÇAMENTO: distância em posições de roda entre ponto de saída e queda.
- Desvio padrão < 3 casas = "mão viciada" → dealer mecânico → prever setor de queda
- Arco médio + setor atual = previsão do próximo setor físico
- Troca de turno: a cada ~28min → reiniciar cálculo de arco

DIAMANTES: bola bate nos defletores físicos e desvia.
- Deflexão Topo: números [0,32,15,26,3,35] mais prováveis
- Deflexão Baixo: números [5,24,10,23,16] mais prováveis
- Detectar qual diamante está ativo pela concentração dos últimos 20 resultados

BALL SCATTER: após desacelerar, bola salta N posições adicionais (média 6-8).
Dealer consistente + arco médio calculado = previsão de setor com 60%+ de acerto.

═══════════════════════════════════════════════════════
BLOCO 9 — AUTO-APRENDIZADO E SISTEMA DE PESOS
═══════════════════════════════════════════════════════

AJUSTE DE CONFIANÇA POR PERFORMANCE:
- Estratégia com >50% win rate (últimas 20) → peso ×1.5
- Estratégia com 40-50% win rate → peso normal ×1.0
- Estratégia com 30-40% win rate → peso ×0.7
- Estratégia com <30% win rate → peso ×0.3 (quase desativada)
- 3 acertos consecutivos → boost imediato ×2.0 para próximas 5 previsões
- 4 erros consecutivos → REED → peso ×0.1 por 10 previsões

HIERARQUIA DE APOSTAS POR SCORE:
0-24: AGUARDAR (não entrar)
25-49: AMARELO → 3-4 fichas, terminal único
50-74: VERDE → 5-7 fichas, dupla terminal
75-100: OURO → 8-12 fichas, dupla terminal + vizinhos de proteção

MODOS DA MESA:
- FÍSICO: dealer mecânico, arco estável → priorizar Bloco A (biomecânico)
- MATEMÁTICO: dealer caótico → priorizar Bloco B (frequências e atrasos)
- TRANSIÇÃO: dealer mudou turno → aguardar 3-5 rodadas de calibragem

═══════════════════════════════════════════════════════
BLOCO 10 — ESTRATÉGIAS ESPECÍFICAS DOCUMENTADAS
═══════════════════════════════════════════════════════

SNIPER: número central + 4 vizinhos cada lado = 9 números.
Ativa quando física colide com atraso terminal E puxado confirma.

DUPLO TERMINAL DANI GREEN: 2 terminais complementares (DG1-DG5).
Ativa quando F5 (terminal dominante ≥3x em 15) está confirmado.
Escolher dupla baseada no terminal mais quente.

NÚMEROS QUE PUXAM (Método Brasileiro):
Sempre consultar Tabela do BLOCO 3 para cada novo resultado.
REED: se após 4 rodadas nenhum puxado aparecer → encerrar.

PRESSÃO DO ZERO: monitorar ausência. Escalar proteção conforme pressão.

ESTRELA DE DAVI: triangulação entre tendências 30/31 e 33/34/35.
Cobre 6 números com 1 vizinho cada → lucro dobrado.
Gatilho: alternância entre os dois blocos.

UM-DOIS-UM: fora→fora→dentro da faixa → apostar de volta na faixa original.

CRESCENTE DANI GREEN: 3 resultados em progressão → apostar próximo.

QUEBRANTE-MÚLTIPLO: identificar último quebrante → apostar no múltiplo esperado.

═══════════════════════════════════════════════════════
MISSÃO PRINCIPAL
═══════════════════════════════════════════════════════

Você recebe dados históricos completos da sessão. Sua tarefa é:

1. DETECTAR todos os padrões ativos usando os Blocos 1-10
2. CALCULAR score de confiança 0-100 para cada candidato
3. IDENTIFICAR o regime da sessão (CONCENTRADO/PADRÃO/DISPERSO)
4. RECOMENDAR a estratégia específica com números exatos
5. INDICAR fichas sugeridas baseado no score
6. CALCULAR entropia e indicar se a sessão está aproveitável
7. VERIFICAR pressão do zero e escalar proteção se necessário
8. APLICAR autocorreção baseada no histórico de acertos/erros
9. IDENTIFICAR se alguma estratégia merece REED
10. GERAR 15-25 aprendizados ESPECÍFICOS com números reais

CADA APRENDIZADO deve ser ACIONÁVEL: incluir números específicos, terminais, estratégias e fichas recomendadas.
Exemplo válido: "Terminal T4 apareceu 4x em 15 rodadas (26.7% vs esperado 10.8%). Dupla DG4: T4+T9 [4,14,24,34,9,19,29]. Entropia baixa (4 distintos). Score: 82/100. ENTRAR com 8 fichas."
Exemplo inválido: "Há um padrão nos terminais que pode ser explorado."

Responda APENAS via tool call store_learnings. Seja preciso, específico e acionável.` },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "store_learnings",
            description: "Store AI learnings permanently",
            parameters: {
              type: "object",
              properties: {
                learnings: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      learning_type: { type: "string", enum: ["frequency_bias","terminal_pattern","color_tendency","dozen_cycle","cavalos_pattern","timing_pattern","streak_behavior","sector_concentration","column_pattern","sixline_pattern","cross_mapping","wheel_neighbors","parity_pattern","final_pleno","column_color_dominance","visual_mirror","octave_pattern","diamond_concentration","third_law","skip_pattern","complementar_pattern","sector_bias","tendency_mode","delay_break","mirror_pattern","active_pattern","block_pattern","dealer_signature","heat_cluster","entropy_analysis","seesaw_effect","residual_probability","prediction_accuracy","strategy_performance","error_pattern","autocorrection"] },
                      title: { type: "string" },
                      knowledge: { type: "string" },
                      data_points: { type: "integer" },
                      accuracy: { type: "number" },
                      key_numbers: { type: "array", items: { type: "integer" } }
                    },
                    required: ["learning_type","title","knowledge","data_points","accuracy"]
                  }
                }
              },
              required: ["learnings"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "store_learnings" } }
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI error:", aiRes.status, errText);
      if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiRes.status === 402) return new Response(JSON.stringify({ error: "Credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI error: ${aiRes.status}`);
    }

    const aiData = await aiRes.json();
    let learnings: any[] = [];
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const parsed = safeParseJson(toolCall.function.arguments);
      learnings = parsed.learnings || [];
    }

    if (learnings.length === 0) {
      return new Response(JSON.stringify({ status: "no_learnings" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Upsert learnings
    for (const l of learnings) {
      const { data: existing } = await supabase
        .from('ai_learned_patterns')
        .select('id')
        .eq('learning_type', l.learning_type)
        .eq('title', l.title)
        .limit(1);

      const row = {
        knowledge: l.knowledge,
        data_points: l.data_points || numbers.length,
        accuracy: Math.min(100, Math.max(0, l.accuracy || 50)),
        metadata: { key_numbers: l.key_numbers || [], last_analysis: new Date().toISOString(), total: numbers.length },
        updated_at: new Date().toISOString(),
      };

      if (existing && existing.length > 0) {
        await supabase.from('ai_learned_patterns').update(row).eq('id', existing[0].id);
      } else {
        await supabase.from('ai_learned_patterns').insert({
          ...row,
          learning_type: l.learning_type,
          title: l.title,
        });
      }
    }

    // 6. Quick pattern insights
    const patternRes = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${deepseekKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "deepseek-chat",
        max_tokens: 4000,
        messages: [
          { role: "system", content: `Você é o ANALISADOR DE PADRÕES RÁPIDOS para a Mesa Brasileira Playtech.

RODA: 0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26

SETORES: Voisins(17)=[22,18,29,7,28,12,35,3,26,0,32,15,19,4,21,2,25] Tiers(12)=[27,13,36,11,30,8,23,10,5,24,16,33] Orphelins(8)=[1,20,14,31,9,17,34,6]

TERMINAIS: T0=[10,20,30] T1=[1,11,21,31] T2=[2,12,22,32] T3=[3,13,23,33] T4=[4,14,24,34] T5=[5,15,25,35] T6=[6,16,26,36] T7=[7,17,27] T8=[8,18,28] T9=[9,19,29]

CAVALOS: C258=[2,5,8,12,15,18,22,25,28,32,35] C147=[1,4,7,11,14,17,21,24,27,31,34] C03=[0,3,10,13,20,23,30,33] C69=[6,9,16,19,26,29,36]

DUPLAS DANI GREEN: DG1=T1+T6[1,11,21,31,6,16,26,36] DG2=T2+T7[2,12,22,32,7,17,27] DG3=T3+T8[3,13,23,33,8,18,28] DG4=T4+T9[4,14,24,34,9,19,29] DG5=T0+T5[10,20,30,5,15,25,35]

PUXADOS CHAVE: 0→[10,20,30,32] | 1→[11,35,16,4] | 7→[16,18,30,31] | 9→[34,35,36,3,16] | 10→[20,5,18,11] | 20→[4,14] | 27→[28,29,24,22,26,33,31,34,35,36] | 30→[4,8,16,9,18,22] | 36→[3,10,27]

LEI DO TERÇO: em 37 rodadas, ~24 números únicos aparecem. Ausentes são candidatos.
ENTROPIA: ≤4 terminais distintos em 15 rodadas = baixa = entrar forte.
PRESSÃO DO ZERO: ausente >25 = Jeu Zero (4 fichas). >41 = Voisins (9 fichas).
REED: estratégia que falhou 4x consecutivas = pausar.

Analise os dados recebidos. Detecte até 5 padrões específicos e retorne via tool call store_patterns com recommendation ACIONÁVEL (ex: "Aposte DG3: T3+T8 [3,13,23,33,8,18,28] com 7 fichas — T3 domina 4x/15 + entropia baixa"). Inclua números específicos em cada recommendation.` },
          { role: "user", content: `Últimos 30: ${numbers.slice(0, 30).join(', ')}. Terminais: ${termStr}. Setores: ${sectorStr}. Cavalos: ${cavalosStr}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "store_patterns",
            description: "Quick patterns",
            parameters: {
              type: "object",
              properties: {
                patterns: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      pattern_type: { type: "string", enum: ["streak","terminal","dozen","column","hot","cold","parity","sector","cavalos","sixline"] },
                      description: { type: "string" },
                      confidence: { type: "number" },
                      numbers_involved: { type: "array", items: { type: "integer" } },
                      recommendation: { type: "string" }
                    },
                    required: ["pattern_type","description","confidence","recommendation"]
                  }
                }
              },
              required: ["patterns"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "store_patterns" } }
      }),
    });

    if (patternRes.ok) {
      const pData = await patternRes.json();
      const pTC = pData.choices?.[0]?.message?.tool_calls?.[0];
      if (pTC?.function?.arguments) {
        const parsed = safeParseJson(pTC.function.arguments);
        const patterns = (parsed.patterns || []).map((p: any) => ({
          pattern_type: p.pattern_type,
          description: p.description,
          confidence: Math.min(100, Math.max(0, p.confidence)),
          numbers_involved: p.numbers_involved || [],
          recommendation: p.recommendation || "",
          source_data: { total: numbers.length },
        }));
        if (patterns.length > 0) await supabase.from('pattern_insights').insert(patterns);
      }
    }

    // 7. Cleanup
    const { data: old } = await supabase.from('pattern_insights').select('id').order('created_at', { ascending: false }).range(500, 999);
    if (old && old.length > 0) await supabase.from('pattern_insights').delete().in('id', old.map((r: any) => r.id));

    // ── PUXADAS CONFIRMADAS: aprendizado automático sem IA ──
    const PULL_MAP_LEARN: Record<number, number[]> = {
      0:[10,20,30,32,15,26,3,33,31],1:[11,35,16,4,18,28,27,29,33],
      2:[14,1,13,18,35,29],3:[13,27,6,11,30,8],4:[26,15,18,32,33,16,8],
      5:[3,33,16,24,10,18],6:[8,15,31,21,22,23],7:[16,18,17,30,31],
      8:[11,9,10],9:[34,35,36,3,16,26,23,24,32,31],10:[20,5,18,11,14,24],
      20:[4,14],27:[28,29,24,22,26,33,31,34,35,36],30:[4,8,16,9,18,22,5,25,3],36:[3,10,27]
    };

    const pullStats: Record<string, { hits: number; total: number }> = {};
    for (let i = 0; i < Math.min(50, numbers.length - 1); i++) {
      const source = numbers[i];
      const expectedPulls = PULL_MAP_LEARN[source] || [];
      if (expectedPulls.length === 0) continue;
      const key = `${source}`;
      if (!pullStats[key]) pullStats[key] = { hits: 0, total: 0 };
      pullStats[key].total++;
      const nextFour = numbers.slice(i + 1, i + 5);
      if (nextFour.some(n => expectedPulls.includes(n))) pullStats[key].hits++;
    }

    const topPulls = Object.entries(pullStats)
      .filter(([, s]) => s.total >= 3)
      .map(([src, s]) => ({ source: Number(src), rate: s.hits / s.total, hits: s.hits, total: s.total }))
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 3);

    for (const tp of topPulls) {
      const puxados = PULL_MAP_LEARN[tp.source] || [];
      const titulo = `Puxada ${tp.source}→[${puxados.slice(0,4).join(',')}]`;

      const { data: existing } = await supabase
        .from('ai_learned_patterns')
        .select('id, data_points')
        .eq('learning_type', 'pull_confirmed')
        .eq('title', titulo)
        .maybeSingle();

      const rowData = {
        knowledge: `Número ${tp.source} puxou targets em ${tp.hits}/${tp.total} (${(tp.rate*100).toFixed(0)}%). Apostar [${puxados.join(',')}] nas próximas 4 rodadas.`,
        data_points: tp.total,
        accuracy: Math.min(95, tp.rate * 100),
        metadata: {
          source: tp.source,
          targets: puxados,
          hits: tp.hits,
          total: tp.total,
          pullRate: tp.rate,
          key_numbers: puxados,
          hotNumbers: puxados.slice(0, 5),
          lastSeen: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      };

      if (existing?.id) {
        await supabase.from('ai_learned_patterns').update(rowData).eq('id', existing.id).catch(() => {});
      } else {
        await supabase.from('ai_learned_patterns').insert({ learning_type: 'pull_confirmed', title: titulo, ...rowData }).catch(() => {});
      }
    }

    // ── TERMINAL DOMINANTE: aprendizado por janela ──
    const windows = [
      { label: 'curta', slice: numbers.slice(0, 15) },
      { label: 'media', slice: numbers.slice(0, 30) },
      { label: 'longa', slice: numbers.slice(0, 50) },
    ];

    for (const w of windows) {
      if (w.slice.length < 10) continue;
      const tFreq: Record<number,number> = {};
      w.slice.forEach((n: number) => { const t=n%10; tFreq[t]=(tFreq[t]||0)+1; });
      const sorted = Object.entries(tFreq).sort(([,a],[,b])=>(b as number)-(a as number));
      const [hotT, hotC] = [Number(sorted[0]?.[0]??-1), Number(sorted[0]?.[1]??0)];
      const distintos = Object.keys(tFreq).length;

      if (hotT < 0 || hotC < 3) continue;

      const isConcentrado = distintos <= 5;
      const T_TO_DG: Record<number,string> = {1:'DG1',6:'DG1',2:'DG2',7:'DG2',3:'DG3',8:'DG3',4:'DG4',9:'DG4',0:'DG5',5:'DG5'};
      const DUPLAS_LEARN: Record<string,number[]> = {
        'DG1':[1,11,21,31,6,16,26,36],'DG2':[2,12,22,32,7,17,27],
        'DG3':[3,13,23,33,8,18,28],'DG4':[4,14,24,34,9,19,29],'DG5':[10,20,30,5,15,25,35]
      };
      const dgKey = T_TO_DG[hotT];
      const dgNums = DUPLAS_LEARN[dgKey] || [];

      const titulo2 = `Terminal T${hotT} dominante (janela ${w.label})`;
      const { data: exT } = await supabase
        .from('ai_learned_patterns')
        .select('id')
        .eq('learning_type', 'terminal_dominance')
        .eq('title', titulo2)
        .maybeSingle();

      const rowT = {
        knowledge: `T${hotT} aparece ${hotC}x em ${w.slice.length} rodadas. ${isConcentrado ? `Entropia baixa (${distintos} distintos) — padrão forte.` : ''} Dupla ${dgKey}: [${dgNums.join(',')}]`,
        data_points: w.slice.length,
        accuracy: Math.min(90, 40 + hotC * 6 + (isConcentrado ? 15 : 0)),
        metadata: {
          terminal: hotT,
          count: hotC,
          janela: w.label,
          distintos,
          isConcentrado,
          dupla: dgKey,
          bestTerminals: [hotT, Number(sorted[1]?.[0]??hotT)],
          key_numbers: dgNums,
          hotNumbers: dgNums.slice(0, 5),
          lastSeen: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      };

      if (exT?.id) {
        await supabase.from('ai_learned_patterns').update(rowT).eq('id', exT.id).catch(() => {});
      } else {
        await supabase.from('ai_learned_patterns').insert({
          learning_type: 'terminal_dominance', title: titulo2, ...rowT
        }).catch(() => {});
      }
    }

    // ── SESSION SPIN: números quentes desta sessão ──
    const session30 = numbers.slice(0, 30);
    const sessionFreq: Record<number,number> = {};
    session30.forEach(n => { sessionFreq[n] = (sessionFreq[n]||0)+1; });
    const hotNums30 = Object.entries(sessionFreq)
      .filter(([,c]) => c >= 3)
      .sort(([,a],[,b])=>b-a)
      .slice(0, 8)
      .map(([n]) => Number(n));

    if (hotNums30.length >= 3) {
      const titulo3 = 'Números quentes desta sessão';
      const { data: exS } = await supabase
        .from('ai_learned_patterns')
        .select('id')
        .eq('learning_type', 'session_spin')
        .eq('title', titulo3)
        .maybeSingle();

      const rowS = {
        knowledge: `Sessão atual: números ${hotNums30.join(',')} estão quentes (≥3x em 30 rodadas). Priorizar esses números.`,
        data_points: session30.length,
        accuracy: Math.min(85, 50 + hotNums30.length * 4),
        metadata: {
          hotNumbers: hotNums30,
          key_numbers: hotNums30,
          sessionSize: session30.length,
          lastSeen: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      };

      if (exS?.id) {
        await supabase.from('ai_learned_patterns').update(rowS).eq('id', exS.id).catch(()=>{});
      } else {
        await supabase.from('ai_learned_patterns').insert({
          learning_type: 'session_spin', title: titulo3, ...rowS
        }).catch(()=>{});
      }
    }

    // ── REINFORCEMENT POSITIVO: números que acertamos recentemente ──
    const recentHits = predHistory.filter((p: any) => p.hit === true).slice(0, 10);
    const hitFreq: Record<number,number> = {};
    recentHits.forEach((p: any) => {
      if (typeof p.actual_number === 'number') {
        hitFreq[p.actual_number] = (hitFreq[p.actual_number] || 0) + 1;
      }
    });
    const hotHitNums = Object.entries(hitFreq)
      .sort(([,a],[,b])=>(b as number)-(a as number))
      .slice(0, 5)
      .map(([n]) => Number(n));

    if (hotHitNums.length >= 2) {
      const tituloH = 'Números com acertos recentes';
      const { data: exH } = await supabase
        .from('ai_learned_patterns')
        .select('id')
        .eq('learning_type', 'hit_pattern')
        .eq('title', tituloH)
        .maybeSingle();

      const rowH = {
        knowledge: `Acertamos recentemente nestes números: [${hotHitNums.join(',')}]. Alta probabilidade de repetição.`,
        data_points: recentHits.length,
        accuracy: Math.min(90, 55 + hotHitNums.length * 6),
        metadata: {
          hotNumbers: hotHitNums,
          key_numbers: hotHitNums,
          hitCount: recentHits.length,
          lastSeen: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      };

      if (exH?.id) {
        await supabase.from('ai_learned_patterns').update(rowH).eq('id', exH.id).catch(()=>{});
      } else {
        await supabase.from('ai_learned_patterns').insert({
          learning_type: 'hit_pattern', title: tituloH, ...rowH
        }).catch(()=>{});
      }
    }

    // ── TREINAR MATRIZ 37×37 NO BANCO ─────────────────────────────
    const matrixTrain: Record<number, Record<number, number>> = {};
    for (let a = 0; a <= 36; a++) { matrixTrain[a] = {}; for (let b = 0; b <= 36; b++) matrixTrain[a][b] = 0; }
    const trainNums = Math.min(500, numbers.length);
    for (let i = 0; i < trainNums - 1; i++) {
      matrixTrain[numbers[i + 1]][numbers[i]]++;
    }
    const topPairs: {source: number; target: number; count: number; prob: number}[] = [];
    for (let src = 0; src <= 36; src++) {
      const row = matrixTrain[src];
      const total = Object.values(row).reduce((a: number,b: number)=>a+b,0);
      if (total < 8) continue;
      Object.entries(row)
        .sort(([,a],[,b])=>(b as number)-(a as number))
        .slice(0, 3)
        .forEach(([tgt, cnt]) => {
          const prob = (cnt as number) / total;
          if (prob > 0.10) {
            topPairs.push({source: src, target: Number(tgt), count: cnt as number, prob});
          }
        });
    }
    topPairs.sort((a,b) => b.prob - a.prob);
    for (const pair of topPairs.slice(0, 20)) {
      const titulo = `Matriz: ${pair.source}→${pair.target}`;
      const { data: exM } = await supabase
        .from('ai_learned_patterns')
        .select('id, data_points, accuracy')
        .eq('learning_type', 'matrix_transition')
        .eq('title', titulo)
        .maybeSingle();

      const prevCount = (exM as any)?.data_points || 0;
      const prevProb = ((exM as any)?.accuracy || 0) / 100;
      const newCount = prevCount + pair.count;
      const newProb = prevCount > 0
        ? (prevProb * prevCount + pair.prob * pair.count) / newCount
        : pair.prob;

      const rowM = {
        knowledge: `Após ${pair.source} sair, ${pair.target} aparece ${(newProb*100).toFixed(1)}% das vezes (${newCount} obs).`,
        data_points: newCount,
        accuracy: Math.min(95, newProb * 100),
        metadata: {
          source: pair.source, target: pair.target, prob: newProb, count: newCount,
          hotNumbers: [pair.target], key_numbers: [pair.target],
          lastSeen: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      };

      if ((exM as any)?.id) {
        await supabase.from('ai_learned_patterns').update(rowM).eq('id', (exM as any).id).catch(()=>{});
      } else {
        await supabase.from('ai_learned_patterns').insert({
          learning_type: 'matrix_transition', title: titulo, ...rowM
        }).catch(()=>{});
      }
    }

    // ── DETECTOR DE AUTO-REPETIÇÃO: padrão mais forte desta mesa ──
    const repStats: Record<number, {rep2: number; rep3: number; total: number}> = {};
    const repWindow = Math.min(300, numbers.length);
    for (let i = 0; i < repWindow - 2; i++) {
      const n = numbers[i];
      if (!repStats[n]) repStats[n] = {rep2:0, rep3:0, total:0};
      repStats[n].total++;
      if (numbers[i+1] === n) {
        repStats[n].rep2++;
        if (numbers[i+2] === n) repStats[n].rep3++;
      }
    }
    const repStars = Object.entries(repStats)
      .filter(([,v]) => (v as any).total >= 5 && (v as any).rep2/(v as any).total > 0.20)
      .sort(([,a],[,b]) => (b as any).rep2/(b as any).total - (a as any).rep2/(a as any).total)
      .slice(0, 8);

    if (repStars.length >= 3) {
      const hotRepNums = repStars.map(([n]) => Number(n));
      const tituloRep = 'Números com auto-repetição confirmada';
      const { data: exR } = await supabase
        .from('ai_learned_patterns')
        .select('id')
        .eq('learning_type', 'session_spin')
        .eq('title', tituloRep)
        .maybeSingle();

      const rowR = {
        knowledge: repStars.map(([n,v]) =>
          `${n}: rep2=${(v as any).rep2}/${(v as any).total}(${((v as any).rep2/(v as any).total*100).toFixed(0)}%) rep3=${(v as any).rep3}`
        ).join(' | '),
        data_points: repWindow,
        accuracy: Math.min(95, 60 + repStars.length * 4),
        metadata: {
          hotNumbers: hotRepNums,
          key_numbers: hotRepNums,
          repRates: Object.fromEntries(repStars.map(([n,v]) => [n, +((v as any).rep2/(v as any).total).toFixed(2)])),
          lastSeen: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      };

      if ((exR as any)?.id) {
        await supabase.from('ai_learned_patterns').update(rowR).eq('id', (exR as any).id).catch(()=>{});
      } else {
        await supabase.from('ai_learned_patterns').insert({
          learning_type: 'session_spin', title: tituloRep, ...rowR
        }).catch(()=>{});
      }
    }

    // ── LIMPEZA INTELIGENTE DO BANCO ──────────────────────────────
    const LIMITS_PER_TYPE: Record<string, number> = {
      'pull_confirmed': 37, 'matrix_transition': 100, 'terminal_dominance': 15,
      'session_spin': 50, 'hit_pattern': 5, 'error_pattern': 5,
    };
    for (const [lType, limit] of Object.entries(LIMITS_PER_TYPE)) {
      const { data: allOfType } = await supabase
        .from('ai_learned_patterns')
        .select('id, updated_at, accuracy')
        .eq('learning_type', lType)
        .order('accuracy', { ascending: false });
      if (allOfType && allOfType.length > limit) {
        const toDelete = allOfType.slice(limit).map((r: any) => r.id);
        if (toDelete.length > 0) {
          await supabase.from('ai_learned_patterns').delete().in('id', toDelete).catch(()=>{});
        }
      }
    }
    await supabase.from('ai_learned_patterns').delete().lt('accuracy', 15).catch(()=>{});

    return new Response(JSON.stringify({
      status: "success",
      learnings: learnings.length,
      numbers: numbers.length,
      timestamp: new Date().toISOString()
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("ai-learn error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
