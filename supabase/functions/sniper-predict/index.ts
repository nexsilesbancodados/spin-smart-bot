import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WHEEL = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const WL = WHEEL.length; // 37
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Fetch data + AI learned patterns in parallel
    const [numbersRes, learnedRes] = await Promise.all([
      supabase.from('roulette_numbers').select('number, fetched_at').order('fetched_at', { ascending: false }).limit(200),
      supabase.from('ai_learned_patterns').select('learning_type, title, knowledge, accuracy, metadata').order('updated_at', { ascending: false }).limit(30),
    ]);

    const entries = (numbersRes.data || []).map((r: any) => ({ number: r.number as number, time: r.fetched_at as string }));
    const numbers = entries.map(e => e.number);
    const learned = learnedRes.data || [];

    if (numbers.length < 15) {
      return new Response(JSON.stringify({ signal: null, mode: 'waiting', message: 'Aguardando dados...' }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const last10 = numbers.slice(0, 10);
    const last15 = numbers.slice(0, 15);
    const last30 = numbers.slice(0, 30);
    const last50 = numbers.slice(0, 50);
    const last100 = numbers.slice(0, 100);

    // =============================================
    // LAYER 1: DEALER BIOMECHANICS
    // =============================================
    const arcs: number[] = [];
    for (let i = 0; i < Math.min(30, numbers.length - 1); i++) arcs.push(wheelDist(numbers[i], numbers[i + 1]));
    const arcMean = arcs.length > 0 ? arcs.reduce((a, b) => a + b, 0) / arcs.length : 0;
    const arcStdDev = Math.sqrt(arcs.length > 0 ? arcs.reduce((a, b) => a + Math.pow(b - arcMean, 2), 0) / arcs.length : 99);
    const last3Arcs = arcs.slice(0, 3);
    const last5Arcs = arcs.slice(0, 5);
    const arcRange3 = last3Arcs.length === 3 ? Math.max(...last3Arcs) - Math.min(...last3Arcs) : 99;
    const arcRange5 = last5Arcs.length === 5 ? Math.max(...last5Arcs) - Math.min(...last5Arcs) : 99;
    const maoViciada = arcRange3 <= 2;
    const maoViciada5 = arcRange5 <= 3; // 5 arcs within 3 = strong signature

    // Dealer change detection
    const recentArcs = arcs.slice(0, 10);
    const olderArcs = arcs.slice(10, 20);
    const recentArcMean = recentArcs.length > 0 ? recentArcs.reduce((a, b) => a + b, 0) / recentArcs.length : 0;
    const olderArcMean = olderArcs.length > 0 ? olderArcs.reduce((a, b) => a + b, 0) / olderArcs.length : 0;
    const dealerChanged = olderArcs.length >= 5 && Math.abs(recentArcMean - olderArcMean) > 5;
    const shortArcs = recentArcs.filter(a => a < 6).length;
    const longArcs = recentArcs.filter(a => a > 14).length;
    const dealerMode = shortArcs > longArcs * 1.5 ? 'curto' : longArcs > shortArcs * 1.5 ? 'longo' : 'misto';

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

    // =============================================
    // LAYER 2: FREQUENCY ANALYSIS (MULTI-SCALE)
    // =============================================
    const freq10: Record<number, number> = {}, freq30: Record<number, number> = {}, freq100: Record<number, number> = {};
    for (let n = 0; n <= 36; n++) { freq10[n] = 0; freq30[n] = 0; freq100[n] = 0; }
    last10.forEach(n => freq10[n]++);
    last30.forEach(n => freq30[n]++);
    last100.forEach(n => freq100[n]++);

    // Terminal freq
    const termFreq30: Record<number, number> = {};
    for (let t = 0; t <= 9; t++) termFreq30[t] = 0;
    last30.forEach(n => termFreq30[n % 10]++);
    const sortedTerminals = Object.entries(termFreq30).sort(([,a],[,b]) => b - a);

    // Cavalo freq
    const cavaloFreq: Record<string, number> = { '258':0, '147':0, '03':0, '69':0 };
    last30.forEach(n => { const g = getCavalo(n); if (g) cavaloFreq[g]++; });
    const sortedCavalos = Object.entries(cavaloFreq).sort(([,a],[,b]) => b - a);
    const hotCavaloGroup = sortedCavalos[0][0];

    // Delays
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

    // =============================================
    // LAYER 3: SECTOR & OCTAVE ANALYSIS
    // =============================================
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

    // Octave concentration in last 10
    const octFreq10: Record<string, number> = {};
    last10.forEach(n => { const o = getOctave(n); if (o) octFreq10[o] = (octFreq10[o]||0) + 1; });
    const biasedOctaves = Object.entries(octFreq10).filter(([,c]) => c >= 3).map(([o]) => o);

    const oct0 = getOctave(numbers[0]), oct1 = getOctave(numbers[1]), oct2 = getOctave(numbers[2]);
    const sectorBias = oct0===oct1 || oct0===oct2 || oct1===oct2;
    const biasedOctave = oct0===oct1?oct0 : oct0===oct2?oct0 : oct1===oct2?oct1 : biasedOctaves[0] || null;

    // =============================================
    // LAYER 4: ENTROPY & PATTERN DETECTION
    // =============================================
    let colorChanges = 0, colorTotal = 0;
    for (let i = 1; i < last15.length; i++) {
      const p = getColor(last15[i-1]), c = getColor(last15[i]);
      if (p !== 'green' && c !== 'green') { colorTotal++; if (p !== c) colorChanges++; }
    }
    const entropy = colorTotal > 0 ? colorChanges / colorTotal : 0.5;
    const highEntropy = entropy > 0.75;

    // Color tendency
    let redCount = 0, blackCount = 0;
    last15.forEach(n => { if (RED.includes(n)) redCount++; else if (n !== 0) blackCount++; });
    const colorBias = redCount > blackCount * 1.5 ? 'red' : blackCount > redCount * 1.5 ? 'black' : null;

    // Dozen tendency
    const dozenCount = [0, 0, 0];
    last15.forEach(n => { const d = getDozen(n); if (d > 0) dozenCount[d-1]++; });
    const hotDozen = dozenCount.indexOf(Math.max(...dozenCount)) + 1;

    // Parity tendency
    let evenCount = 0, oddCount = 0;
    last15.forEach(n => { if (n > 0) { if (n % 2 === 0) evenCount++; else oddCount++; } });
    const parityBias = evenCount > oddCount * 1.5 ? 'even' : oddCount > evenCount * 1.5 ? 'odd' : null;

    // =============================================
    // LAYER 5: MOMENT LAW + COMPLEMENTAR
    // =============================================
    const termTransitions: Record<string, number> = {};
    for (let i = 0; i < last15.length - 1; i++) {
      const key = `${last15[i]%10}->${last15[i+1]%10}`;
      termTransitions[key] = (termTransitions[key]||0) + 1;
    }
    const momentLaw = Object.entries(termTransitions).filter(([,c]) => c >= 2).map(([k]) => k);

    // Complementar patterns
    const compDue: number[] = [];
    for (let i = 0; i < Math.min(10, numbers.length); i++) {
      const comp = getComplementar(numbers[i]);
      if (comp !== null && !last10.includes(comp)) compDue.push(comp);
    }

    // =============================================
    // LAYER 6: SEESAW EFFECT (Zero Attraction)
    // =============================================
    const semiZero = WHEEL.slice(0, 19); // first half
    const semiOpp = WHEEL.slice(19); // second half
    const zeroSide = last50.filter(n => semiZero.includes(n)).length;
    const oppSide = last50.filter(n => semiOpp.includes(n)).length;
    const seesawRatio = zeroSide / (oppSide || 1);
    const seesawBias = seesawRatio > 1.5 ? 'opposite' : seesawRatio < 0.67 ? 'zero' : null;

    // =============================================
    // LAYER 7: CROSS-DELAY TARGETS (Residual Probability)
    // =============================================
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

    // =============================================
    // LAYER 8: AI LEARNED PATTERNS INTEGRATION
    // =============================================
    const learnedBonus: Record<number, number> = {};
    const learnedReasons: Record<number, string[]> = {};
    for (let n = 0; n <= 36; n++) { learnedBonus[n] = 0; learnedReasons[n] = []; }

    for (const l of learned) {
      const acc = (l.accuracy || 50) / 100;
      const keyNums: number[] = (l.metadata as any)?.key_numbers || [];

      if (keyNums.length > 0 && acc > 0.6) {
        for (const kn of keyNums) {
          if (kn >= 0 && kn <= 36) {
            learnedBonus[kn] += acc * 1.5;
            learnedReasons[kn].push(`IA: ${l.title.slice(0, 30)}`);
          }
        }
      }

      // Boost numbers matching learned terminal/sector patterns
      if (l.learning_type === 'terminal_pattern' && acc > 0.65) {
        const match = l.title.match(/(\d)/);
        if (match) {
          const term = parseInt(match[1]);
          for (let n = 0; n <= 36; n++) {
            if (n % 10 === term) { learnedBonus[n] += acc * 0.8; learnedReasons[n].push(`IA Terminal ${term}`); }
          }
        }
      }

      if (l.learning_type === 'sector_concentration' && acc > 0.65) {
        const octMatch = l.title.match(/O(\d)/);
        if (octMatch) {
          const octKey = `O${octMatch[1]}`;
          const nums = OCTAVES[octKey] || [];
          for (const n of nums) { learnedBonus[n] += acc * 0.7; learnedReasons[n].push(`IA Oitavo ${octKey}`); }
        }
      }

      if (l.learning_type === 'heat_cluster' && acc > 0.7) {
        for (const kn of keyNums) {
          if (kn >= 0 && kn <= 36) { learnedBonus[kn] += acc * 1.2; learnedReasons[kn].push('IA Cluster'); }
        }
      }

      if (l.learning_type === 'dealer_signature' && acc > 0.6) {
        // Boost arc-predicted numbers
        if (maoViciada || arcStdDev < 3) {
          const avgArc = Math.round(arcMean);
          const idx0 = wheelIdx(numbers[0]);
          const pCW = WHEEL[(idx0 + avgArc) % WL];
          const pCCW = WHEEL[(idx0 - avgArc + WL) % WL];
          learnedBonus[pCW] += acc * 1.5;
          learnedBonus[pCCW] += acc * 1.5;
          learnedReasons[pCW].push('IA Dealer Sig');
          learnedReasons[pCCW].push('IA Dealer Sig');
        }
      }
    }

    // =============================================
    // LAYER 9: HEAT MAP (Wheel Concentration)
    // =============================================
    const heatMap: number[] = new Array(WL).fill(0);
    last30.forEach((n, i) => {
      const idx = wheelIdx(n);
      if (idx === -1) return;
      const weight = 1 + (30 - i) / 30; // recent = more weight
      for (let offset = -2; offset <= 2; offset++) {
        const tIdx = (idx + offset + WL) % WL;
        heatMap[tIdx] += weight * (1 - Math.abs(offset) * 0.3);
      }
    });
    const maxHeat = Math.max(...heatMap);
    const hotZones: { num: number; heat: number }[] = [];
    for (let i = 0; i < WL; i++) {
      if (heatMap[i] > maxHeat * 0.7) hotZones.push({ num: WHEEL[i], heat: +heatMap[i].toFixed(1) });
    }

    // =============================================
    // CONVERGENCE SCORING
    // =============================================
    let convergenceScore = 0;
    const reasons: string[] = [];

    if (sectorBias && biasedOctave) { convergenceScore += 1.2; reasons.push(`Viciação Setor: ${biasedOctave}`); }
    if (biasedOctaves.length > 0) { convergenceScore += 0.5; reasons.push(`Oitavos quentes: ${biasedOctaves.join(',')}`); }
    if (delayedCavalos.length > 0) { convergenceScore += 1; reasons.push(`Atraso Cavalos: ${delayedCavalos.map(([g,d])=>`C${g}(${d}r)`).join(',')}`); }
    if (delayedTerminals.length > 0) { convergenceScore += 1; reasons.push(`Terminais atrasados: T${delayedTerminals.join(',T')}`); }
    if (maoViciada) { convergenceScore += 2; reasons.push(`🎯 MÃO VICIADA: arco ${last3Arcs.join(',')} (±${arcRange3})`); }
    else if (maoViciada5) { convergenceScore += 1.5; reasons.push(`Assinatura forte: 5 arcos ±${arcRange5}`); }
    else if (arcStdDev < 3) { convergenceScore += 1; reasons.push(`Dealer consistente: ±${arcStdDev.toFixed(1)}`); }
    if (momentLaw.length > 0) { convergenceScore += 0.8; reasons.push(`Momento: ${momentLaw.join(',')}`); }
    if (crossDelayTargets.length > 0) { convergenceScore += 0.8; reasons.push(`Alvos cruzados: ${crossDelayTargets.slice(0,3).map(t=>`${t.num}`).join(',')}`); }
    if (seesawBias) { convergenceScore += 0.5; reasons.push(`Gangorra → ${seesawBias === 'zero' ? 'Jeu Zéro' : 'Tiers'}`); }
    if (colorBias) { convergenceScore += 0.3; reasons.push(`Tendência cor: ${colorBias}`); }
    if (compDue.length > 3) { convergenceScore += 0.4; reasons.push(`Complementares devidos: ${compDue.slice(0,4).join(',')}`); }
    if (learned.length > 0) { convergenceScore += 0.5; reasons.push(`IA aprendeu ${learned.length} padrões`); }

    if (dealerChanged) reasons.push('⚠️ Novo Dealer detectado');
    if (dealerSignature.possibleRotation) reasons.push('⏰ Rotação ~30min');

    // =============================================
    // OBSERVING / MONITORING
    // =============================================
    const baseResponse = {
      entropy: entropy.toFixed(3), dealerMode, dealerSignature,
      hotTerminals: { cavalos: sortedCavalos, terminals: sortedTerminals.slice(0, 5) },
      sectorTrend, sectorFreq, convergenceScore, reasons,
    };

    if (dealerChanged) {
      return json({ signal: null, mode: 'recalibrating', message: '🔄 Novo Dealer: Recalibrando...', ...baseResponse });
    }

    if (highEntropy && convergenceScore < 3) {
      return json({ signal: null, mode: 'observing', message: '🔍 OBSERVAÇÃO — Alta entropia', ...baseResponse });
    }

    if (convergenceScore < 2) {
      return json({ signal: null, mode: 'monitoring', message: '👁️ Monitorando...', ...baseResponse,
        topCandidates: [], delayedTerminals, cavaloDelays });
    }

    // =============================================
    // MAXIMUM PRECISION TARGET SELECTION
    // =============================================
    const numScores: { num: number; score: number; reasons: string[] }[] = [];

    for (let n = 0; n <= 36; n++) {
      let s = 0;
      const r: string[] = [];

      // A. Octave bias (+2.5)
      if (biasedOctave && OCTAVES[biasedOctave]?.includes(n)) { s += 2.5; r.push(`Oitavo ${biasedOctave}`); }

      // B. Terminal delay (+2.5)
      if (delayedTerminals.includes(n % 10)) { s += 2.5; r.push(`T${n%10} atrasado (${termDelays[n%10]}r)`); }

      // C. Cavalo delay (+2)
      const cg = getCavalo(n);
      if (cg && cavaloDelays[cg] > 8) { s += 2; r.push(`C${cg} atrasado`); }

      // D. Hot cavalo filter (+1.5)
      if (cg === hotCavaloGroup) { s += 1.5; r.push(`C${hotCavaloGroup} quente`); }

      // E. Arc prediction - MAXIMUM WEIGHT for Brazilian Roulette (+5 for exact, +2 for near)
      const avgArc = maoViciada ? Math.round(last3Arcs.reduce((a,b)=>a+b,0)/3) : Math.round(arcMean);
      const idx0 = wheelIdx(numbers[0]);
      if (idx0 !== -1 && (maoViciada || maoViciada5 || arcStdDev < 4)) {
        const pCW = WHEEL[(idx0 + avgArc) % WL];
        const pCCW = WHEEL[(idx0 - avgArc + WL) % WL];
        const arcWeight = maoViciada ? 5 : maoViciada5 ? 4 : 3;
        if (n === pCW || n === pCCW) { s += arcWeight; r.push(`🎯 Arco exato (${avgArc})`); }
        else if (wheelDist(n, pCW) <= 1 || wheelDist(n, pCCW) <= 1) { s += arcWeight * 0.6; r.push(`Arco ±1`); }
        else if (wheelDist(n, pCW) <= 2 || wheelDist(n, pCCW) <= 2) { s += arcWeight * 0.3; r.push(`Arco ±2`); }
      }

      // F. Moment law (+2)
      const term = n % 10, lastTerm = numbers[0] % 10;
      if (momentLaw.includes(`${lastTerm}->${term}`)) { s += 2; r.push('Momento'); }

      // G. Cross-delay target (+3)
      const crossTarget = crossDelayTargets.find(t => t.num === n);
      if (crossTarget) { s += 3; r.push(`Cruzado (${crossTarget.total})`); }

      // H. Complementar due (+1.5)
      if (compDue.includes(n)) { s += 1.5; r.push('Complementar'); }

      // I. Seesaw bonus (+1.5)
      if (seesawBias === 'zero' && JEU_ZERO.includes(n)) { s += 1.5; r.push('Gangorra→Zero'); }
      if (seesawBias === 'opposite' && TIERS.includes(n)) { s += 1.5; r.push('Gangorra→Tiers'); }

      // J. Heat map (+1)
      const hIdx = wheelIdx(n);
      if (hIdx !== -1 && heatMap[hIdx] > maxHeat * 0.7) { s += 1; r.push('Zona quente'); }

      // K. Color/parity bias (+0.5)
      if (colorBias === 'red' && RED.includes(n)) { s += 0.5; r.push('Tendência verm'); }
      if (colorBias === 'black' && !RED.includes(n) && n !== 0) { s += 0.5; r.push('Tendência preto'); }
      if (parityBias === 'even' && n > 0 && n % 2 === 0) { s += 0.3; }
      if (parityBias === 'odd' && n % 2 === 1) { s += 0.3; }

      // L. Hot dozen/sector (+0.5)
      if (getDozen(n) === hotDozen) s += 0.3;
      if (hotSector && getSector(n) === hotSector[0]) { s += 0.5; r.push(`Setor ${hotSector[0]}`); }

      // M. Lei do Terço (+1 absent, +0.5 repeated)
      const freq37 = numbers.slice(0, 37).filter(x => x === n).length;
      if (freq37 === 0) { s += 1; r.push('Ausente (Terço)'); }
      if (freq37 >= 2) { s += 0.5; r.push('Repetição'); }

      // N. AI Learned patterns bonus
      if (learnedBonus[n] > 0) { s += learnedBonus[n]; r.push(...learnedReasons[n].slice(0, 2)); }

      // Recency penalty
      if (numbers.slice(0, 3).includes(n)) s -= 3;
      else if (numbers.slice(3, 7).includes(n)) s -= 1;

      if (s > 0) numScores.push({ num: n, score: s, reasons: r });
    }

    numScores.sort((a, b) => b.score - a.score);
    const target = numScores[0];

    if (!target || target.score < 2.5) {
      return json({ signal: null, mode: 'monitoring', message: '👁️ Convergência parcial...',
        ...baseResponse,
        topCandidates: numScores.slice(0, 8).map(s => ({ num: s.num, score: +s.score.toFixed(1), reasons: s.reasons })),
      });
    }

    const probability = Math.min(95, Math.round(50 + target.score * 3.5 + convergenceScore * 2.5));
    const neighbors = getNeighbors(target.num, 4);
    const recoveryMode = delayedCavalos.length >= 2 && delayedTerminals.length >= 2;

    return json({
      signal: { number: target.num, neighbors, probability, reasons: target.reasons, convergenceReasons: reasons },
      mode: probability >= 85 ? 'sniper' : 'alert',
      message: probability >= 85 ? `🎯 JOGADA DE ALTA PRECISÃO: ${target.num}` : `⚡ ALERTA: Convergência em ${target.num}`,
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
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
  return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
