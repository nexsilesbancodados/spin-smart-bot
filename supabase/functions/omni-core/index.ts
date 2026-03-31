import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ═══════════════════════════════════════════════════════════════════
// CONSTANTES DO CILINDRO EUROPEU
// ═══════════════════════════════════════════════════════════════════
const WHEEL = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
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
    result.push(WHEEL[((pos + i) % WHEEL.length + WHEEL.length) % WHEEL.length]);
  }
  return result;
};

// ═══════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════
interface AgentSignal {
  agentId: 'statistical' | 'ballistic' | 'reversion';
  agentName: string;
  betType: string;
  label: string;
  numbers: number[];
  confidence: number; // 0-100
  reasoning: string;
}

interface ArbiterDecision {
  winner: AgentSignal;
  weights: Record<string, number>;
  entryForce: 'leve' | 'padrao' | 'forte';
  kellyFraction: number;
  killSwitch: boolean;
  killReason?: string;
  agentSignals: AgentSignal[];
  arbiterLog: string[];
  temperature: 'fria' | 'morna' | 'quente' | 'caotica';
}

// ═══════════════════════════════════════════════════════════════════
// AGENTE 1: ESTATÍSTICO (Dúzias/Colunas/Cores — Desvio Padrão)
// ═══════════════════════════════════════════════════════════════════
function agentStatistical(spins: number[]): AgentSignal[] {
  const signals: AgentSignal[] = [];
  if (spins.length < 10) return signals;

  const window = spins.slice(0, 50);

  // Dozen absence
  for (let dz = 1; dz <= 3; dz++) {
    let absence = 0;
    for (const n of window) {
      if (n === 0) { absence++; continue; }
      if (getDozen(n) === dz) break;
      absence++;
    }
    if (absence >= 7) {
      const dzNums = Array.from({ length: 12 }, (_, i) => (dz - 1) * 12 + i + 1);
      const conf = Math.min(90, 60 + (absence - 7) * 4);
      signals.push({
        agentId: 'statistical',
        agentName: 'Agente Estatístico',
        betType: 'duzia',
        label: `${dz}ª Dúzia (ausente ${absence}g)`,
        numbers: dzNums,
        confidence: conf,
        reasoning: `${dz}ª Dúzia ausente há ${absence} giros — desvio de ${((absence / (window.length / 3)) * 100 - 100).toFixed(0)}% acima do esperado`,
      });
    }
  }

  // Column absence
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
      const conf = Math.min(85, 58 + (absence - 7) * 3);
      signals.push({
        agentId: 'statistical',
        agentName: 'Agente Estatístico',
        betType: 'coluna',
        label: `${col}ª Coluna (ausente ${absence}g)`,
        numbers: colNums,
        confidence: conf,
        reasoning: `${col}ª Coluna ausente há ${absence} giros`,
      });
    }
  }

  // Color absence
  const colors = window.map(getColor);
  const redCount = colors.filter(c => c === 'red').length;
  const blackCount = colors.filter(c => c === 'black').length;
  const total = redCount + blackCount;
  if (total >= 20) {
    const expected = total / 2;
    const redDev = (redCount - expected) / Math.sqrt(expected);
    const blackDev = (blackCount - expected) / Math.sqrt(expected);

    if (Math.abs(redDev) > 1.8) {
      const targetColor = redDev > 0 ? 'black' : 'red';
      const targetNums = Array.from({ length: 37 }, (_, i) => i).filter(n => getColor(n) === targetColor);
      signals.push({
        agentId: 'statistical',
        agentName: 'Agente Estatístico',
        betType: 'cor',
        label: targetColor === 'red' ? 'VERMELHO' : 'PRETO',
        numbers: targetNums,
        confidence: Math.min(85, 60 + Math.floor(Math.abs(redDev) * 8)),
        reasoning: `Desvio padrão de cor: ${Math.abs(redDev).toFixed(1)}σ — reversão para ${targetColor === 'red' ? 'vermelho' : 'preto'}`,
      });
    }
  }

  return signals;
}

// ═══════════════════════════════════════════════════════════════════
// AGENTE 2: BALÍSTICO (Zonas do Cilindro / Dealer Signature)
// ═══════════════════════════════════════════════════════════════════
function agentBallistic(spins: number[]): AgentSignal[] {
  const signals: AgentSignal[] = [];
  if (spins.length < 15) return signals;

  const recent = spins.slice(0, 30);

  // Sector frequency analysis
  const sectorCounts: Record<string, number> = { voisins: 0, tiers: 0, orphelins: 0, zero: 0 };
  recent.forEach(n => { sectorCounts[getSector(n)]++; });
  const totalNonZero = recent.filter(n => n > 0).length || 1;

  // Expected sector proportions (European wheel)
  const expected: Record<string, number> = {
    voisins: 17 / 37 * recent.length,
    tiers: 12 / 37 * recent.length,
    orphelins: 8 / 37 * recent.length,
    zero: 1 / 37 * recent.length,
  };

  // Find hot sector (over-represented = dealer signature)
  const sectorNames: Record<string, string> = {
    voisins: 'Voisins du Zéro', tiers: 'Tiers du Cylindre', orphelins: 'Orphelins', zero: 'Jeu Zéro',
  };
  const sectorSets: Record<string, Set<number>> = {
    voisins: VOISINS, tiers: TIERS, orphelins: ORPHELINS, zero: new Set([0, 3, 12, 15, 26, 32, 35]),
  };

  for (const [sector, count] of Object.entries(sectorCounts)) {
    if (sector === 'zero') continue; // too small sample
    const exp = expected[sector];
    const ratio = count / exp;
    if (ratio > 1.35 && count >= 5) {
      const sectorNums = Array.from(sectorSets[sector]);
      const conf = Math.min(88, 55 + Math.floor((ratio - 1) * 40));
      signals.push({
        agentId: 'ballistic',
        agentName: 'Agente Balístico',
        betType: 'setor',
        label: `${sectorNames[sector]} (HOT)`,
        numbers: sectorNums,
        confidence: conf,
        reasoning: `Setor ${sectorNames[sector]} com ${count}/${recent.length} hits (${(ratio * 100 - 100).toFixed(0)}% acima do esperado) — possível dealer signature`,
      });
    }
  }

  // Neighbor cluster: check if last 5 numbers cluster on the wheel
  const last5Positions = spins.slice(0, 5).map(wheelPos).filter(p => p >= 0);
  if (last5Positions.length >= 4) {
    // Compute circular spread
    const sorted = [...last5Positions].sort((a, b) => a - b);
    let minArc = WHEEL.length;
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const arc = Math.min(sorted[j] - sorted[i], WHEEL.length - (sorted[j] - sorted[i]));
        if (arc < minArc) minArc = arc;
      }
    }
    // If 4+ of last 5 fit in a 10-slot arc
    const center = spins[0];
    const clusterNums = wheelNeighbors(center, 5);
    const inCluster = last5Positions.filter(p => {
      const cp = wheelPos(center);
      const dist = Math.min(Math.abs(p - cp), WHEEL.length - Math.abs(p - cp));
      return dist <= 6;
    });
    if (inCluster.length >= 3) {
      signals.push({
        agentId: 'ballistic',
        agentName: 'Agente Balístico',
        betType: 'vizinhos',
        label: `Vizinhos de ${center}`,
        numbers: clusterNums,
        confidence: Math.min(85, 55 + inCluster.length * 8),
        reasoning: `${inCluster.length}/5 últimos giros caíram no arco de ${center} — padrão de lançamento detectado`,
      });
    }
  }

  return signals;
}

// ═══════════════════════════════════════════════════════════════════
// AGENTE 3: REVERSÃO À MÉDIA (Anomalias extremas)
// ═══════════════════════════════════════════════════════════════════
function agentReversion(spins: number[]): AgentSignal[] {
  const signals: AgentSignal[] = [];
  if (spins.length < 8) return signals;

  // Color streak
  const colors = spins.map(getColor);
  let colorStreak = 1;
  for (let i = 1; i < colors.length; i++) {
    if (colors[i] === colors[0] && colors[0] !== 'green') colorStreak++;
    else break;
  }
  if (colorStreak >= 5) {
    const opposite = colors[0] === 'red' ? 'black' : 'red';
    const oppositeNums = Array.from({ length: 37 }, (_, i) => i).filter(n => getColor(n) === opposite);
    const conf = Math.min(92, 70 + (colorStreak - 5) * 5);
    signals.push({
      agentId: 'reversion',
      agentName: 'Agente Reversão',
      betType: 'cor',
      label: `${opposite === 'red' ? 'VERMELHO' : 'PRETO'} (quebra de ${colorStreak}x)`,
      numbers: oppositeNums,
      confidence: conf,
      reasoning: `${colorStreak} ${colors[0] === 'red' ? 'vermelhos' : 'pretos'} seguidos — anomalia extrema, probabilidade cumulativa de continuação: ${(Math.pow(18/37, colorStreak) * 100).toFixed(1)}%`,
    });
  }

  // Dozen streak
  const dozens = spins.filter(n => n > 0).map(getDozen);
  if (dozens.length >= 5) {
    let dzStreak = 1;
    for (let i = 1; i < dozens.length; i++) {
      if (dozens[i] === dozens[0]) dzStreak++;
      else break;
    }
    if (dzStreak >= 5) {
      const missing = [1, 2, 3].filter(d => d !== dozens[0]);
      const bestDz = missing[0];
      const dzNums = Array.from({ length: 12 }, (_, i) => (bestDz - 1) * 12 + i + 1);
      const conf = Math.min(90, 72 + (dzStreak - 5) * 4);
      signals.push({
        agentId: 'reversion',
        agentName: 'Agente Reversão',
        betType: 'duzia',
        label: `${bestDz}ª Dúzia (reversão de ${dzStreak}x)`,
        numbers: dzNums,
        confidence: conf,
        reasoning: `${dozens[0]}ª Dúzia saiu ${dzStreak}x seguidas — limite matemático, reversão iminente`,
      });
    }
  }

  // Parity streak
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
        agentId: 'reversion',
        agentName: 'Agente Reversão',
        betType: 'paridade',
        label: `${target.toUpperCase()} (reversão de ${pStreak}x)`,
        numbers: targetNums,
        confidence: Math.min(88, 65 + (pStreak - 6) * 5),
        reasoning: `${pStreak} ${parities[0] === 0 ? 'pares' : 'ímpares'} seguidos — anomalia extrema`,
      });
    }
  }

  // High/Low streak
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
        agentId: 'reversion',
        agentName: 'Agente Reversão',
        betType: 'alto_baixo',
        label: `${target === 'high' ? 'ALTO' : 'BAIXO'} (reversão de ${hlStreak}x)`,
        numbers: targetNums,
        confidence: Math.min(86, 63 + (hlStreak - 6) * 5),
        reasoning: `${hlStreak} ${hiLo[0] === 'high' ? 'altos' : 'baixos'} seguidos`,
      });
    }
  }

  return signals;
}

// ═══════════════════════════════════════════════════════════════════
// MÓDULO 2: ÁRBITRO DINÂMICO (Multi-Armed Bandit)
// ═══════════════════════════════════════════════════════════════════
interface AgentPerformance {
  hits: number;
  total: number;
  recentStreak: number; // positive = consecutive hits, negative = consecutive misses
  weight: number;
}

function computeArbiterWeights(
  predictionHistory: Array<{ strategy_type: string; hit: boolean | null; created_at: string }>,
): Record<string, AgentPerformance> {
  const agentMap: Record<string, AgentPerformance> = {
    statistical: { hits: 0, total: 0, recentStreak: 0, weight: 1.0 },
    ballistic:   { hits: 0, total: 0, recentStreak: 0, weight: 1.0 },
    reversion:   { hits: 0, total: 0, recentStreak: 0, weight: 1.0 },
  };

  // Map strategy_type to agent — heuristic mapping
  const typeToAgent = (st: string): string | null => {
    if (/duzia|coluna|cor|statistical/i.test(st)) return 'statistical';
    if (/setor|vizinho|ballistic|puxada/i.test(st)) return 'ballistic';
    if (/revers|streak|paridade|alto_baixo/i.test(st)) return 'reversion';
    return null;
  };

  // Last 30 resolved predictions per agent
  const recentByAgent: Record<string, boolean[]> = { statistical: [], ballistic: [], reversion: [] };

  for (const pred of predictionHistory) {
    if (pred.hit === null) continue;
    const agent = typeToAgent(pred.strategy_type);
    if (!agent || !recentByAgent[agent]) continue;
    if (recentByAgent[agent].length < 30) {
      recentByAgent[agent].push(pred.hit);
    }
  }

  for (const [agentId, results] of Object.entries(recentByAgent)) {
    const perf = agentMap[agentId];
    perf.total = results.length;
    perf.hits = results.filter(Boolean).length;

    // Compute recent streak (from most recent)
    if (results.length > 0) {
      let streak = results[0] ? 1 : -1;
      for (let i = 1; i < results.length; i++) {
        if (results[i] === results[0]) streak += results[0] ? 1 : -1;
        else break;
      }
      perf.recentStreak = streak;
    }

    // Multi-Armed Bandit weight: UCB1-inspired
    if (perf.total > 0) {
      const winRate = perf.hits / perf.total;
      const exploration = Math.sqrt(2 * Math.log(30) / perf.total);
      perf.weight = winRate + exploration * 0.3;
      // Boost for hot streak, penalize cold streak
      if (perf.recentStreak >= 3) perf.weight *= 1.3;
      if (perf.recentStreak <= -2) perf.weight *= 0.5;
    }
  }

  return agentMap;
}

// ═══════════════════════════════════════════════════════════════════
// MÓDULO 3: GESTÃO DE RISCO (Kelly + Kill Switch)
// ═══════════════════════════════════════════════════════════════════
function computeKelly(winRate: number, odds: number): { fraction: number; force: 'leve' | 'padrao' | 'forte' } {
  // Simplified Kelly: f = (bp - q) / b where b = odds, p = win probability, q = 1-p
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

function checkKillSwitch(agentPerf: Record<string, AgentPerformance>): { active: boolean; reason?: string } {
  const allBelow40 = Object.values(agentPerf).every(p =>
    p.total >= 5 && (p.hits / p.total) < 0.40
  );
  if (allBelow40) {
    return { active: true, reason: '⚠️ Anomalia detectada na roleta. Sinais suspensos por 5 giros para proteção de banca.' };
  }
  return { active: false };
}

function getTemperature(agentPerf: Record<string, AgentPerformance>): 'fria' | 'morna' | 'quente' | 'caotica' {
  const rates = Object.values(agentPerf).filter(p => p.total >= 3).map(p => p.hits / p.total);
  if (rates.length === 0) return 'morna';
  const avgRate = rates.reduce((a, b) => a + b, 0) / rates.length;
  const anyHotStreak = Object.values(agentPerf).some(p => p.recentStreak >= 4);
  if (avgRate < 0.30) return 'caotica';
  if (avgRate < 0.40) return 'fria';
  if (anyHotStreak || avgRate > 0.55) return 'quente';
  return 'morna';
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
    try {
      const body = await req.json();
      clientNumbers = body?.numbers;
    } catch { /* no body */ }

    // ── 1. Fetch data in parallel ──────────────────────────
    const [numbersRes, predRes] = await Promise.all([
      supabase.from('roulette_numbers').select('number, fetched_at')
        .order('fetched_at', { ascending: false }).limit(500),
      supabase.from('prediction_history').select('strategy_type, hit, created_at')
        .not('hit', 'is', null)
        .order('created_at', { ascending: false }).limit(100),
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

    // ── 2. Run all 3 Agents in parallel ────────────────────
    const [statsSignals, ballisticSignals, reversionSignals] = [
      agentStatistical(spins),
      agentBallistic(spins),
      agentReversion(spins),
    ];

    const allSignals = [...statsSignals, ...ballisticSignals, ...reversionSignals];

    // ── 3. Arbiter: compute dynamic weights ────────────────
    const predHistory = (predRes.data || []) as Array<{ strategy_type: string; hit: boolean | null; created_at: string }>;
    const agentPerf = computeArbiterWeights(predHistory);

    // ── 4. Kill Switch check ───────────────────────────────
    const killCheck = checkKillSwitch(agentPerf);
    const temperature = getTemperature(agentPerf);

    if (killCheck.active || allSignals.length === 0) {
      return new Response(JSON.stringify({
        mode: killCheck.active ? 'kill_switch' : 'no_signal',
        message: killCheck.active
          ? killCheck.reason
          : '🔎 Analisando a mesa em tempo real... Aguardando o padrão perfeito.',
        killSwitch: killCheck.active,
        temperature,
        agents: {
          statistical: { weight: agentPerf.statistical.weight, winRate: agentPerf.statistical.total > 0 ? (agentPerf.statistical.hits / agentPerf.statistical.total * 100).toFixed(0) + '%' : 'N/A', streak: agentPerf.statistical.recentStreak },
          ballistic: { weight: agentPerf.ballistic.weight, winRate: agentPerf.ballistic.total > 0 ? (agentPerf.ballistic.hits / agentPerf.ballistic.total * 100).toFixed(0) + '%' : 'N/A', streak: agentPerf.ballistic.recentStreak },
          reversion: { weight: agentPerf.reversion.weight, winRate: agentPerf.reversion.total > 0 ? (agentPerf.reversion.hits / agentPerf.reversion.total * 100).toFixed(0) + '%' : 'N/A', streak: agentPerf.reversion.recentStreak },
        },
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── 5. Score each signal: confidence × agent weight ────
    const scored = allSignals.map(s => ({
      ...s,
      score: s.confidence * (agentPerf[s.agentId]?.weight ?? 1.0),
    }));
    scored.sort((a, b) => b.score - a.score);
    const winner = scored[0];

    // ── 6. Kelly criterion for entry force ─────────────────
    const agentWR = agentPerf[winner.agentId];
    const winRate = agentWR && agentWR.total > 0 ? agentWR.hits / agentWR.total : 0.45;
    const payout = Math.max(1, Math.round(35 / winner.numbers.length));
    const kelly = computeKelly(winRate, payout);

    // ── 7. Build arbiter log ───────────────────────────────
    const arbiterLog: string[] = [];
    arbiterLog.push(`🌡️ Mesa ${temperature.toUpperCase()}`);
    for (const [id, perf] of Object.entries(agentPerf)) {
      const name = id === 'statistical' ? 'Estatístico' : id === 'ballistic' ? 'Balístico' : 'Reversão';
      const wr = perf.total > 0 ? (perf.hits / perf.total * 100).toFixed(0) : '—';
      const streakStr = perf.recentStreak > 0 ? `+${perf.recentStreak}` : `${perf.recentStreak}`;
      arbiterLog.push(`${name}: ${wr}% WR | streak ${streakStr} | peso ${perf.weight.toFixed(2)}`);
    }
    arbiterLog.push(`🏆 Vencedor: ${winner.agentName} → ${winner.label} (${winner.confidence}% × ${(agentPerf[winner.agentId]?.weight ?? 1).toFixed(2)} = ${scored[0].score.toFixed(1)})`);
    arbiterLog.push(`💰 Kelly: ${(kelly.fraction * 100).toFixed(1)}% → Entrada ${kelly.force.toUpperCase()}`);

    // ── 8. Ensure protection numbers (0, 26, 32) ──────────
    const protectionNums = [0, 26, 32];
    const finalNumbers = [...new Set([...winner.numbers, ...protectionNums])].slice(0, 15);

    const decision: ArbiterDecision = {
      winner: { ...winner, numbers: finalNumbers },
      weights: {
        statistical: agentPerf.statistical.weight,
        ballistic: agentPerf.ballistic.weight,
        reversion: agentPerf.reversion.weight,
      },
      entryForce: kelly.force,
      kellyFraction: kelly.fraction,
      killSwitch: false,
      agentSignals: scored.slice(0, 5),
      arbiterLog,
      temperature,
    };

    return new Response(JSON.stringify({
      mode: 'signal',
      signal: {
        number: finalNumbers[0],
        numbers: finalNumbers,
        probability: winner.confidence,
      },
      strategy: {
        type: winner.betType,
        label: winner.label,
        numbers: finalNumbers,
      },
      entryForce: kelly.force,
      kellyFraction: kelly.fraction,
      temperature,
      killSwitch: false,
      arbiterLog,
      agents: {
        statistical: { weight: agentPerf.statistical.weight, winRate: agentPerf.statistical.total > 0 ? `${(agentPerf.statistical.hits / agentPerf.statistical.total * 100).toFixed(0)}%` : 'N/A', streak: agentPerf.statistical.recentStreak },
        ballistic: { weight: agentPerf.ballistic.weight, winRate: agentPerf.ballistic.total > 0 ? `${(agentPerf.ballistic.hits / agentPerf.ballistic.total * 100).toFixed(0)}%` : 'N/A', streak: agentPerf.ballistic.recentStreak },
        reversion: { weight: agentPerf.reversion.weight, winRate: agentPerf.reversion.total > 0 ? `${(agentPerf.reversion.hits / agentPerf.reversion.total * 100).toFixed(0)}%` : 'N/A', streak: agentPerf.reversion.recentStreak },
      },
      agentSignals: scored.slice(0, 5).map(s => ({
        agent: s.agentName,
        label: s.label,
        confidence: s.confidence,
        score: s.score,
        betType: s.betType,
      })),
      aiReasoning: {
        betType: winner.betType,
        betDescription: winner.reasoning,
        patternIdentified: winner.label,
        suggestedBet: `${winner.label} — Entrada ${kelly.force.toUpperCase()}`,
        consensus: scored.filter(s => s.score >= scored[0].score * 0.7).length,
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