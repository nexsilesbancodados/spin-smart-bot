import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WHEEL_ORDER = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const VOISINS = [22,18,29,7,28,12,35,3,26,0,32,15,19,4,21,2,25];
const TIERS = [27,13,36,11,30,8,23,10,5,24,16,33];
const ORPHELINS = [1,20,14,31,9,17,34,6];

const OCTAVES: Record<string, number[]> = {
  O1: [0,32,15,19,4], O2: [21,2,25,17], O3: [34,6,27,13], O4: [36,11,30,8],
  O5: [23,10,5,24], O6: [16,33,1,20], O7: [14,31,9,22], O8: [18,29,7,28,12,35,3,26],
};

const CAVALOS: Record<string, number[]> = {
  '258': [2,5,8,12,15,18,22,25,28,32,35],
  '147': [1,4,7,11,14,17,21,24,27,31,34],
  '03':  [0,3,10,13,20,23,30,33],
  '69':  [6,9,16,19,26,29,36],
};

const RED = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
const getColor = (n: number) => n === 0 ? 'green' : RED.includes(n) ? 'red' : 'black';

const wheelDist = (a: number, b: number) => {
  const ia = WHEEL_ORDER.indexOf(a), ib = WHEEL_ORDER.indexOf(b);
  if (ia === -1 || ib === -1) return 99;
  const d = Math.abs(ia - ib);
  return Math.min(d, WHEEL_ORDER.length - d);
};

const getOctave = (n: number) => {
  for (const [k, nums] of Object.entries(OCTAVES)) if (nums.includes(n)) return k;
  return null;
};

const getSector = (n: number) => VOISINS.includes(n) ? 'Voisins' : TIERS.includes(n) ? 'Tiers' : ORPHELINS.includes(n) ? 'Orphelins' : 'Zero';

// 9 neighbors (4 each side) for Brazilian Roulette (less bounce)
const getNeighbors = (n: number, count = 4) => {
  const idx = WHEEL_ORDER.indexOf(n);
  if (idx === -1) return [];
  const r: number[] = [];
  for (let i = 1; i <= count; i++) {
    r.push(WHEEL_ORDER[(idx - i + WHEEL_ORDER.length) % WHEEL_ORDER.length]);
    r.push(WHEEL_ORDER[(idx + i) % WHEEL_ORDER.length]);
  }
  return r;
};

const getCavaloGroup = (n: number) => {
  for (const [k, nums] of Object.entries(CAVALOS)) if (nums.includes(n)) return k;
  return null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data } = await supabase
      .from('roulette_numbers')
      .select('number, fetched_at')
      .order('fetched_at', { ascending: false })
      .limit(200);

    const entries = (data || []).map((r: any) => ({ number: r.number as number, time: r.fetched_at as string }));
    const numbers = entries.map(e => e.number);

    if (numbers.length < 15) {
      return new Response(JSON.stringify({ signal: null, mode: 'waiting', message: 'Aguardando dados...' }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const last15 = numbers.slice(0, 15);
    const last30 = numbers.slice(0, 30);
    const last50 = numbers.slice(0, 50);

    // =============================================
    // 1. DEALER SIGNATURE TRACKER (Biomecânica)
    // =============================================
    const arcs: number[] = [];
    for (let i = 0; i < Math.min(30, numbers.length - 1); i++) {
      arcs.push(wheelDist(numbers[i], numbers[i + 1]));
    }
    const arcMean = arcs.length > 0 ? arcs.reduce((a, b) => a + b, 0) / arcs.length : 0;
    const arcVariance = arcs.length > 0 ? arcs.reduce((a, b) => a + Math.pow(b - arcMean, 2), 0) / arcs.length : 99;
    const arcStdDev = Math.sqrt(arcVariance);

    // Check last 3 arcs for "Mão Viciada"
    const last3Arcs = arcs.slice(0, 3);
    const arcRange3 = last3Arcs.length === 3 ? Math.max(...last3Arcs) - Math.min(...last3Arcs) : 99;
    const maoViciada = arcRange3 <= 2; // 3 arcs within 2 houses = viciação

    // Dealer change detection: check if arc pattern changed dramatically
    const recentArcs = arcs.slice(0, 10);
    const olderArcs = arcs.slice(10, 20);
    const recentArcMean = recentArcs.length > 0 ? recentArcs.reduce((a, b) => a + b, 0) / recentArcs.length : 0;
    const olderArcMean = olderArcs.length > 0 ? olderArcs.reduce((a, b) => a + b, 0) / olderArcs.length : 0;
    const dealerChanged = olderArcs.length >= 5 && Math.abs(recentArcMean - olderArcMean) > 5;

    // Dealer mode
    const shortArcs = recentArcs.filter(a => a < 6).length;
    const longArcs = recentArcs.filter(a => a > 14).length;
    const dealerMode = shortArcs > longArcs * 1.5 ? 'curto' : longArcs > shortArcs * 1.5 ? 'longo' : 'misto';

    // Time-based dealer rotation check (30min intervals)
    let minutesSinceStart = 0;
    if (entries.length > 1) {
      const newest = new Date(entries[0].time).getTime();
      const oldest = new Date(entries[Math.min(entries.length - 1, 49)].time).getTime();
      minutesSinceStart = (newest - oldest) / 60000;
    }
    const possibleDealerRotation = minutesSinceStart > 28;

    const dealerSignature = {
      arcMean: Number(arcMean.toFixed(1)),
      arcStdDev: Number(arcStdDev.toFixed(1)),
      maoViciada,
      dealerChanged,
      dealerMode,
      last3Arcs,
      possibleRotation: possibleDealerRotation,
      consistency: arcStdDev < 3 ? 'alta' : arcStdDev < 5 ? 'média' : 'baixa',
    };

    // =============================================
    // 2. HOT TERMINALS (Cavalos do Momento)
    // =============================================
    const cavaloFreq: Record<string, number> = { '258': 0, '147': 0, '03': 0, '69': 0 };
    const termFreq: Record<number, number> = {};
    for (let t = 0; t <= 9; t++) termFreq[t] = 0;

    last30.forEach(n => {
      const g = getCavaloGroup(n);
      if (g) cavaloFreq[g]++;
      termFreq[n % 10]++;
    });

    const sortedCavalos = Object.entries(cavaloFreq).sort(([, a], [, b]) => b - a);
    const hotCavalo = sortedCavalos[0];
    const sortedTerminals = Object.entries(termFreq).sort(([, a], [, b]) => b - a);

    // Cavalo delays
    const cavaloDelays: Record<string, number> = { '258': 999, '147': 999, '03': 999, '69': 999 };
    for (let i = 0; i < last50.length; i++) {
      const g = getCavaloGroup(last50[i]);
      if (g && cavaloDelays[g] === 999) cavaloDelays[g] = i;
    }
    const delayedCavalos = Object.entries(cavaloDelays).filter(([, d]) => d > 8);

    // Terminal delays
    const termDelays: Record<number, number> = {};
    for (let t = 0; t <= 9; t++) termDelays[t] = 999;
    for (let i = 0; i < last50.length; i++) {
      const t = last50[i] % 10;
      if (termDelays[t] === 999) termDelays[t] = i;
    }
    const delayedTerminals = Object.entries(termDelays).filter(([, d]) => d > 8).map(([t]) => Number(t));

    // =============================================
    // 3. SECTOR TREND (últimos 15 min / 30 números)
    // =============================================
    const sectorFreq: Record<string, number> = { Voisins: 0, Tiers: 0, Orphelins: 0 };
    last30.forEach(n => {
      const s = getSector(n);
      if (sectorFreq[s] !== undefined) sectorFreq[s]++;
    });
    const hotSector = Object.entries(sectorFreq).sort(([, a], [, b]) => b - a)[0];

    // Sector trend over time (split into 3 chunks of 10)
    const sectorTrend: Record<string, number[]> = { Voisins: [], Tiers: [], Orphelins: [] };
    for (let chunk = 0; chunk < 3; chunk++) {
      const slice = last30.slice(chunk * 10, (chunk + 1) * 10);
      const counts: Record<string, number> = { Voisins: 0, Tiers: 0, Orphelins: 0 };
      slice.forEach(n => { const s = getSector(n); if (counts[s] !== undefined) counts[s]++; });
      for (const s of Object.keys(sectorTrend)) sectorTrend[s].push(counts[s]);
    }

    // =============================================
    // 4. CONVERGENCE ANALYSIS
    // =============================================
    const oct0 = getOctave(numbers[0]);
    const oct1 = getOctave(numbers[1]);
    const oct2 = getOctave(numbers[2]);
    const sectorBias = oct0 === oct1 || oct0 === oct2 || oct1 === oct2;
    const biasedOctave = oct0 === oct1 ? oct0 : oct0 === oct2 ? oct0 : oct1 === oct2 ? oct1 : null;

    // Entropy
    let colorChanges = 0, colorTotal = 0;
    for (let i = 1; i < last15.length; i++) {
      const p = getColor(last15[i - 1]), c = getColor(last15[i]);
      if (p !== 'green' && c !== 'green') { colorTotal++; if (p !== c) colorChanges++; }
    }
    const entropy = colorTotal > 0 ? colorChanges / colorTotal : 0.5;
    const highEntropy = entropy > 0.7;

    // Moment Law
    const termTransitions: Record<string, number> = {};
    for (let i = 0; i < last15.length - 1; i++) {
      const key = `${last15[i] % 10}->${last15[i + 1] % 10}`;
      termTransitions[key] = (termTransitions[key] || 0) + 1;
    }
    const momentLaw = Object.entries(termTransitions).filter(([, c]) => c >= 2).map(([k]) => k);

    // =============================================
    // 5. CONVERGENCE SCORING
    // =============================================
    let convergenceScore = 0;
    const reasons: string[] = [];

    if (sectorBias && biasedOctave) {
      convergenceScore++;
      reasons.push(`Viciação de Setor: ${biasedOctave} ativo`);
    }

    if (delayedCavalos.length > 0) {
      convergenceScore++;
      reasons.push(`Atraso de Cavalos: ${delayedCavalos.map(([g, d]) => `C${g}(${d}r)`).join(', ')}`);
    }

    if (delayedTerminals.length > 0) {
      convergenceScore++;
      reasons.push(`Terminais atrasados: T${delayedTerminals.join(',T')}`);
    }

    // Dealer signature bonus (Roleta Brasileira focus)
    if (maoViciada) {
      convergenceScore += 1.5;
      reasons.push(`🎯 Mão Viciada: arco ${last3Arcs.join(',')} (±${arcRange3} casas)`);
    } else if (arcStdDev < 3) {
      convergenceScore++;
      reasons.push(`Assinatura Dealer: arco médio ${arcMean.toFixed(1)}±${arcStdDev.toFixed(1)}`);
    }

    if (momentLaw.length > 0) {
      convergenceScore += 0.5;
      reasons.push(`Lei do Momento: ${momentLaw.join(', ')}`);
    }

    // Hot cavalo bonus: signal only fires if target belongs to hot group
    const hotCavaloGroup = hotCavalo[0];

    // Dealer change alert
    if (dealerChanged) {
      reasons.push('⚠️ Novo Dealer detectado: padrão de arco mudou');
    }
    if (possibleDealerRotation) {
      reasons.push('⏰ Possível rotação de dealer (~30min)');
    }

    // =============================================
    // 6. OBSERVING MODE
    // =============================================
    if ((highEntropy && convergenceScore < 3) || dealerChanged) {
      return new Response(JSON.stringify({
        signal: null,
        mode: dealerChanged ? 'recalibrating' : 'observing',
        message: dealerChanged
          ? '🔄 Novo Dealer detectado: Reiniciando calibração de força'
          : '🔍 IA EM MODO DE OBSERVAÇÃO — AGUARDANDO ESTABILIZAÇÃO',
        entropy: entropy.toFixed(3),
        dealerMode,
        dealerSignature,
        convergenceScore,
        reasons,
        hotTerminals: { cavalos: sortedCavalos, terminals: sortedTerminals.slice(0, 5) },
        sectorTrend,
        sectorFreq,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (convergenceScore < 2.5) {
      return new Response(JSON.stringify({
        signal: null,
        mode: 'monitoring',
        message: '👁️ Monitorando convergência...',
        convergenceScore,
        entropy: entropy.toFixed(3),
        dealerMode,
        dealerSignature,
        reasons,
        hotTerminals: { cavalos: sortedCavalos, terminals: sortedTerminals.slice(0, 5) },
        sectorTrend,
        sectorFreq,
        delayedTerminals,
        cavaloDelays,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // =============================================
    // 7. TARGET SELECTION (Brazilian Roulette optimized)
    // =============================================
    const numScores: { num: number; score: number; reasons: string[] }[] = [];

    for (let n = 0; n <= 36; n++) {
      let s = 0;
      const r: string[] = [];

      // Octave bias
      if (biasedOctave && OCTAVES[biasedOctave]?.includes(n)) { s += 2; r.push(`Oitavo ${biasedOctave}`); }

      // Terminal delay
      if (delayedTerminals.includes(n % 10)) { s += 2; r.push(`Terminal ${n % 10} atrasado`); }

      // Cavalo delay
      const cg = getCavaloGroup(n);
      if (cg && cavaloDelays[cg] > 8) { s += 1.5; r.push(`Cavalos ${cg} atrasado`); }

      // HOT CAVALO FILTER: Brazilian Roulette prioritizes hot group
      if (cg === hotCavaloGroup) { s += 1; r.push(`Cavalo quente: C${hotCavaloGroup}`); }

      // Arc prediction (dealer signature)
      if (maoViciada && last3Arcs.length >= 2) {
        const avgArc3 = Math.round(last3Arcs.reduce((a, b) => a + b, 0) / last3Arcs.length);
        const idx0 = WHEEL_ORDER.indexOf(numbers[0]);
        const predictedCW = WHEEL_ORDER[(idx0 + avgArc3) % WHEEL_ORDER.length];
        const predictedCCW = WHEEL_ORDER[(idx0 - avgArc3 + WHEEL_ORDER.length) % WHEEL_ORDER.length];
        if (n === predictedCW || n === predictedCCW) { s += 4; r.push('🎯 Previsão Mão Viciada'); }
        if (wheelDist(n, predictedCW) <= 2 || wheelDist(n, predictedCCW) <= 2) { s += 1.5; r.push('Próximo ao arco viciado'); }
      } else if (arcStdDev < 4 && arcs.length > 0) {
        const lastArc = arcs[0];
        const idx0 = WHEEL_ORDER.indexOf(numbers[0]);
        const predicted = WHEEL_ORDER[(idx0 + lastArc) % WHEEL_ORDER.length];
        const predicted2 = WHEEL_ORDER[(idx0 - lastArc + WHEEL_ORDER.length) % WHEEL_ORDER.length];
        if (n === predicted || n === predicted2) { s += 3; r.push('Previsão por arco'); }
        if (wheelDist(n, predicted) <= 2 || wheelDist(n, predicted2) <= 2) { s += 1; r.push('Próximo ao arco'); }
      }

      // Moment law
      const terminal = n % 10;
      const lastTerminal = numbers[0] % 10;
      if (momentLaw.includes(`${lastTerminal}->${terminal}`)) { s += 1.5; r.push('Lei do Momento'); }

      // Recency penalty
      if (numbers.slice(0, 5).includes(n)) s -= 2;

      // Lei do Terço
      const last37 = numbers.slice(0, 37);
      const freq37 = last37.filter(x => x === n).length;
      if (freq37 === 0) { s += 1; r.push('Ausente (Terço)'); }
      if (freq37 >= 2) { s += 0.5; r.push('Zona repetição'); }

      // Hot sector bonus
      if (hotSector && getSector(n) === hotSector[0]) { s += 0.5; r.push(`Setor quente: ${hotSector[0]}`); }

      if (s > 0) numScores.push({ num: n, score: s, reasons: r });
    }

    numScores.sort((a, b) => b.score - a.score);
    const target = numScores[0];

    if (!target || target.score < 3) {
      return new Response(JSON.stringify({
        signal: null,
        mode: 'monitoring',
        message: '👁️ Convergência parcial...',
        convergenceScore,
        reasons,
        dealerSignature,
        hotTerminals: { cavalos: sortedCavalos, terminals: sortedTerminals.slice(0, 5) },
        sectorTrend,
        sectorFreq,
        topCandidates: numScores.slice(0, 5).map(s => ({ num: s.num, score: s.score.toFixed(1) })),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Brazilian Roulette: 9 numbers coverage (4 each side)
    const probability = Math.min(95, Math.round(55 + target.score * 4 + convergenceScore * 3));
    const neighbors = getNeighbors(target.num, 4);

    // Recuperação Brasileira: if previous signals missed, tag recovery mode
    const recoveryMode = delayedCavalos.length >= 2 && delayedTerminals.length >= 2;

    return new Response(JSON.stringify({
      signal: {
        number: target.num,
        neighbors,
        probability,
        reasons: target.reasons,
        convergenceReasons: reasons,
      },
      mode: probability >= 85 ? 'sniper' : 'alert',
      message: probability >= 85
        ? `🎯 JOGADA DE ALTA PRECISÃO: ${target.num}`
        : `⚡ ALERTA: Convergência em ${target.num}`,
      convergenceScore,
      entropy: entropy.toFixed(3),
      dealerMode,
      dealerSignature,
      hotTerminals: { cavalos: sortedCavalos, terminals: sortedTerminals.slice(0, 5) },
      sectorTrend,
      sectorFreq,
      recoveryMode,
      topCandidates: numScores.slice(0, 5).map(s => ({ num: s.num, score: s.score.toFixed(1), reasons: s.reasons })),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("sniper error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
