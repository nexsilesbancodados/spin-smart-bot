import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WHEEL_ORDER = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];

const OCTAVES: Record<string, number[]> = {
  O1: [0,32,15,19,4], O2: [21,2,25,17], O3: [34,6,27,13], O4: [36,11,30,8],
  O5: [23,10,5,24], O6: [16,33,1,20], O7: [14,31,9,22], O8: [18,29,7,28,12,35,3,26],
};

const CAVALOS_258 = [2,5,8,12,15,18,22,25,28,32,35];
const CAVALOS_147 = [1,4,7,11,14,17,21,24,27,31,34];
const CAVALOS_03 = [0,3,10,13,20,23,30,33];
const CAVALOS_69 = [6,9,16,19,26,29,36];

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

const getNeighbors = (n: number, count = 2) => {
  const idx = WHEEL_ORDER.indexOf(n);
  if (idx === -1) return [];
  const r: number[] = [];
  for (let i = 1; i <= count; i++) {
    r.push(WHEEL_ORDER[(idx - i + WHEEL_ORDER.length) % WHEEL_ORDER.length]);
    r.push(WHEEL_ORDER[(idx + i) % WHEEL_ORDER.length]);
  }
  return r;
};

const getCavaloGroup = (n: number) => CAVALOS_258.includes(n) ? '258' : CAVALOS_147.includes(n) ? '147' : CAVALOS_03.includes(n) ? '03' : CAVALOS_69.includes(n) ? '69' : null;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch last 200 numbers
    const { data } = await supabase
      .from('roulette_numbers')
      .select('number, fetched_at')
      .order('fetched_at', { ascending: false })
      .limit(200);

    const numbers = (data || []).map((r: any) => r.number as number);
    if (numbers.length < 15) {
      return new Response(JSON.stringify({ signal: null, mode: 'waiting', message: 'Aguardando dados suficientes...' }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === CONVERGENCE ANALYSIS ===

    const last15 = numbers.slice(0, 15);
    const last50 = numbers.slice(0, 50);

    // 1. Criterion A: Sector/Octave bias (last 2-3 numbers same octave)
    const oct0 = getOctave(numbers[0]);
    const oct1 = getOctave(numbers[1]);
    const oct2 = getOctave(numbers[2]);
    const sectorBias = oct0 === oct1 || oct0 === oct2 || oct1 === oct2;
    const biasedOctave = oct0 === oct1 ? oct0 : oct0 === oct2 ? oct0 : oct1 === oct2 ? oct1 : null;

    // 2. Criterion B: Cavalos delay > 8
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

    // 3. Criterion C: Arc consistency (dealer signature)
    const arcs: number[] = [];
    for (let i = 0; i < Math.min(15, numbers.length - 1); i++) {
      arcs.push(wheelDist(numbers[i], numbers[i + 1]));
    }
    const arcMean = arcs.reduce((a, b) => a + b, 0) / arcs.length;
    const lastArc = arcs[0];
    const prevArc = arcs[1];
    const arcConsistent = Math.abs(lastArc - prevArc) <= 1;

    // 4. Entropy
    let colorChanges = 0, colorTotal = 0;
    for (let i = 1; i < last15.length; i++) {
      const p = getColor(last15[i - 1]), c = getColor(last15[i]);
      if (p !== 'green' && c !== 'green') { colorTotal++; if (p !== c) colorChanges++; }
    }
    const entropy = colorTotal > 0 ? colorChanges / colorTotal : 0.5;
    const highEntropy = entropy > 0.7;

    // 5. Moment Learning: terminal transitions in last 15
    const termTransitions: Record<string, number> = {};
    for (let i = 0; i < last15.length - 1; i++) {
      const key = `${last15[i] % 10}->${last15[i + 1] % 10}`;
      termTransitions[key] = (termTransitions[key] || 0) + 1;
    }
    const momentLaw = Object.entries(termTransitions).filter(([, c]) => c >= 2).map(([k]) => k);

    // 6. Dealer tendency: short vs long
    const shortArcs = arcs.filter(a => a < 5).length;
    const longArcs = arcs.filter(a => a > 15).length;
    const dealerMode = shortArcs > longArcs * 1.5 ? 'curto' : longArcs > shortArcs * 1.5 ? 'longo' : 'misto';

    // === CONVERGENCE SCORING ===
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

    if (arcConsistent) {
      convergenceScore++;
      reasons.push(`Assinatura do Dealer: arco ${lastArc} casas (consistente)`);
    }

    if (momentLaw.length > 0) {
      convergenceScore += 0.5;
      reasons.push(`Lei do Momento: ${momentLaw.join(', ')}`);
    }

    // === DETERMINE SIGNAL ===

    if (highEntropy && convergenceScore < 3) {
      return new Response(JSON.stringify({
        signal: null,
        mode: 'observing',
        message: '🔍 IA EM MODO DE OBSERVAÇÃO — AGUARDANDO ESTABILIZAÇÃO DO DEALER',
        entropy: entropy.toFixed(3),
        dealerMode,
        convergenceScore,
        reasons,
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
        reasons,
        delayedTerminals,
        cavaloDelays,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // === FIND TARGET NUMBER ===

    // Score each number 0-36
    const numScores: { num: number; score: number; reasons: string[] }[] = [];

    for (let n = 0; n <= 36; n++) {
      let s = 0;
      const r: string[] = [];

      // Bonus if in biased octave
      if (biasedOctave && OCTAVES[biasedOctave]?.includes(n)) { s += 2; r.push(`Oitavo ${biasedOctave}`); }

      // Bonus if terminal is delayed
      if (delayedTerminals.includes(n % 10)) { s += 2; r.push(`Terminal ${n % 10} atrasado`); }

      // Bonus if in delayed cavalo group
      const cg = getCavaloGroup(n);
      if (cg && cavaloDelays[cg] > 8) { s += 1.5; r.push(`Cavalos ${cg} atrasado`); }

      // Bonus if arc prediction points here
      if (arcConsistent && arcs.length > 0) {
        const predicted = WHEEL_ORDER[(WHEEL_ORDER.indexOf(numbers[0]) + lastArc) % WHEEL_ORDER.length];
        const predicted2 = WHEEL_ORDER[(WHEEL_ORDER.indexOf(numbers[0]) - lastArc + WHEEL_ORDER.length) % WHEEL_ORDER.length];
        if (n === predicted || n === predicted2) { s += 3; r.push('Previsão por arco'); }
        if (wheelDist(n, predicted) <= 2 || wheelDist(n, predicted2) <= 2) { s += 1; r.push('Próximo ao arco'); }
      }

      // Bonus if moment law suggests this terminal
      const terminal = n % 10;
      const lastTerminal = numbers[0] % 10;
      if (momentLaw.includes(`${lastTerminal}->${terminal}`)) { s += 1.5; r.push('Lei do Momento'); }

      // Penalty if number came out recently (last 5)
      if (numbers.slice(0, 5).includes(n)) { s -= 2; }

      // Bonus for absence (last 37 - Lei do Terço)
      const last37 = numbers.slice(0, 37);
      const freq37 = last37.filter(x => x === n).length;
      if (freq37 === 0) { s += 1; r.push('Ausente (Lei do Terço)'); }
      if (freq37 >= 2) { s += 0.5; r.push('Zona de repetição'); }

      if (s > 0) numScores.push({ num: n, score: s, reasons: r });
    }

    numScores.sort((a, b) => b.score - a.score);
    const target = numScores[0];

    if (!target || target.score < 3) {
      return new Response(JSON.stringify({
        signal: null,
        mode: 'monitoring',
        message: '👁️ Convergência parcial, aguardando mais dados...',
        convergenceScore,
        reasons,
        topCandidates: numScores.slice(0, 5).map(s => ({ num: s.num, score: s.score.toFixed(1) })),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const probability = Math.min(95, Math.round(55 + target.score * 4.5 + convergenceScore * 3));
    const neighbors = getNeighbors(target.num, 2);

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
      topCandidates: numScores.slice(0, 5).map(s => ({ num: s.num, score: s.score.toFixed(1), reasons: s.reasons })),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("sniper error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
