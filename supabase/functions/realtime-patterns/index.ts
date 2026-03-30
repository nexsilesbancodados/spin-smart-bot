// ============================================================
// REALTIME PATTERNS — Captura padrões DO MOMENTO a cada giro
// Roda em <500ms, salva no banco, sniper usa imediatamente
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WHEEL = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const WL = 37;
const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const VOISINS = new Set([22,18,29,7,28,12,35,3,26,0,32,15,19,4,21,2,25]);
const TIERS   = new Set([27,13,36,11,30,8,23,10,5,24,16,33]);
const DG: Record<string,number[]> = {
  DG1:[1,11,21,31,6,16,26,36], DG2:[2,12,22,32,7,17,27],
  DG3:[3,13,23,33,8,18,28],    DG4:[4,14,24,34,9,19,29],
  DG5:[10,20,30,5,15,25,35],
};
const TDG: Record<number,string> = {1:'DG1',6:'DG1',2:'DG2',7:'DG2',3:'DG3',8:'DG3',4:'DG4',9:'DG4',0:'DG5',5:'DG5'};
const PULL: Record<number,number[]> = {
  0:[10,20,30,32,15,26,3,33,31,35],1:[11,35,16,4,18,28,27,29,33,14,31],
  2:[14,1,13,18,35,29,12,22],3:[13,27,6,11,30,8,23,33],
  4:[26,15,18,32,33,16,8,24,14],5:[3,33,16,24,10,18,15,25],
  6:[8,15,31,21,22,23,16,26],7:[16,18,17,30,31,28,12],
  8:[11,9,10,18,28,23],9:[34,35,36,3,16,26,23,24,32,31,29],
  10:[20,5,18,11,14,24,30],11:[8,18,16,21,30,1],
  12:[21,7,28,35],13:[31,27,36,6],14:[24,21,18,31,9],
  15:[4,19,21,32,0],16:[24,21,18,14,6,26],17:[34,6,25,27,7],
  18:[8,18,28,7],19:[9,19,29,4,21],20:[4,14,10,30],
  21:[19,2,4,23],22:[33,2,32,12],23:[32,11,2,33,13],
  24:[21,18,14,34,4],25:[2,4,17,28,29,12,7,18],
  26:[6,16,26,36,3,0],27:[28,29,24,22,26,33,31,34,35,36],
  28:[13,14,15,16,17,18,7],29:[35,28,22],
  30:[4,8,16,9,18,22,5,25,3],31:[13,9,14],32:[2,12,22,32,0,15],
  33:[16,3,23,13],34:[16,6,4,24],35:[0,3,7,12,26,28,29,35],36:[3,10,27,6],
};

function wdist(a: number, b: number): number {
  const ia = WHEEL.indexOf(a), ib = WHEEL.indexOf(b);
  if (ia<0||ib<0) return 99;
  const d = Math.abs(ia-ib); return Math.min(d, WL-d);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Buscar últimos 200 números
    const { data: dbData } = await supabase
      .from('roulette_numbers')
      .select('number, fetched_at')
      .order('fetched_at', { ascending: false })
      .limit(200);

    const nums: number[] = (dbData || []).map((r: any) => r.number);
    if (nums.length < 10) {
      return new Response(JSON.stringify({ status: 'not_enough_data' }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const last    = nums[0];
    const last5   = nums.slice(0, 5);
    const last10  = nums.slice(0, 10);
    const last15  = nums.slice(0, 15);
    const last30  = nums.slice(0, 30);
    const last100 = nums.slice(0, 100);

    const insights: {
      type: string;
      numbers: number[];
      score: number;
      reason: string;
      confidence: number;
    }[] = [];

    // ── 1. AUTO-REPETIÇÃO (padrão mais forte desta mesa) ──────
    const rep5: Record<number,number> = {};
    last5.forEach(n => { rep5[n] = (rep5[n]||0)+1; });
    const hotRep = Object.entries(rep5).sort(([,a],[,b])=>b-a)[0];
    if (hotRep && Number(hotRep[1]) >= 2) {
      const rn = Number(hotRep[0]), rc = Number(hotRep[1]);
      const wi = WHEEL.indexOf(rn);
      const viz = wi>=0 ? [-2,-1,0,1,2].map(d=>WHEEL[(wi+d+WL)%WL]) : [rn];
      const conf = Math.min(95, 50 + rc*15);
      insights.push({
        type: 'auto_repeticao_rt',
        numbers: [...new Set(viz)],
        score: rc >= 4 ? 18 : rc >= 3 ? 12 : 7,
        reason: `${rn} saiu ${rc}x nas últimas 5 — AUTO-REPETIÇÃO ${rc>=4?'EXTREMA':'FORTE'}`,
        confidence: conf,
      });
    }

    // ── 2. STREAK CONSECUTIVO ─────────────────────────────────
    let streakN = nums[0], streakC = 1;
    for (let i=1; i<nums.length; i++) {
      if (nums[i]===streakN) streakC++;
      else break;
    }
    if (streakC >= 2) {
      const wi = WHEEL.indexOf(streakN);
      const viz = wi>=0 ? [-1,0,1].map(d=>WHEEL[(wi+d+WL)%WL]) : [streakN];
      insights.push({
        type: 'streak_consecutivo',
        numbers: [...new Set([streakN, ...viz])],
        score: streakC >= 4 ? 20 : streakC >= 3 ? 14 : 8,
        reason: `${streakN} CONSECUTIVO ${streakC}x — Streak ativo agora`,
        confidence: Math.min(92, 45 + streakC*15),
      });
    }

    // ── 3. PUXADA DO ÚLTIMO (validada historicamente) ─────────
    const puxados = PULL[last] || [];
    if (puxados.length > 0) {
      // Verificar taxa real de acerto nesta sessão
      let hits=0, total=0;
      for (let i=0; i<Math.min(50, nums.length)-4; i++) {
        if (nums[i]===last) {
          total++;
          const next4=nums.slice(Math.max(0,i-4),i);
          if (next4.some(n=>puxados.includes(n))) hits++;
        }
      }
      const rate = total>0 ? hits/total : 0.45;
      insights.push({
        type: 'puxada_momento',
        numbers: puxados.slice(0, 8),
        score: 8 + Math.round(rate*8),
        reason: `${last}→puxados[${puxados.slice(0,4).join(',')}] ${total>0?`(${Math.round(rate*100)}% em ${total}obs)`:'(tabela mestra)'}`,
        confidence: Math.min(90, 40 + rate*80),
      });
    }

    // ── 4. PULL CHAIN — Double e Triple pull ─────────────────
    const p0=new Set(PULL[nums[0]]||[]);
    const p1=new Set(PULL[nums[1]]||[]);
    const p2=new Set(PULL[nums[2]]||[]);
    const double=[...p0].filter(n=>p1.has(n));
    const triple=[...p0].filter(n=>p1.has(n)&&p2.has(n));
    if (triple.length>0) {
      insights.push({
        type: 'triple_pull',
        numbers: triple,
        score: 18,
        reason: `🔱 TRIPLE PULL: ${nums[2]}→${nums[1]}→${nums[0]} convergem em [${triple.join(',')}]`,
        confidence: 88,
      });
    } else if (double.length>0) {
      insights.push({
        type: 'double_pull',
        numbers: double,
        score: 10,
        reason: `🔗 DOUBLE PULL: ${nums[1]}→${nums[0]} convergem em [${double.slice(0,5).join(',')}]`,
        confidence: 78,
      });
    }

    // ── 5. MATRIZ 37×37 DO MOMENTO ───────────────────────────
    const mat: Record<number,Record<number,number>> = {};
    for (let i=0;i<nums.length-1;i++) {
      const src=nums[i+1], tgt=nums[i];
      if (!mat[src]) mat[src]={};
      mat[src][tgt]=(mat[src][tgt]||0)+1;
    }
    const row=mat[last]||{};
    const rowTot=Object.values(row).reduce((a,b)=>a+b,0);
    if (rowTot>=8) {
      const topMat=Object.entries(row).sort(([,a],[,b])=>b-a).slice(0,4)
        .filter(([,c])=>c/rowTot>0.12).map(([n])=>Number(n));
      if (topMat.length>0) {
        const topProb=row[topMat[0]]/rowTot;
        insights.push({
          type: 'matriz_momento',
          numbers: topMat,
          score: Math.round(topProb*14),
          reason: `Após ${last}: [${topMat.join(',')}] = ${Math.round(topProb*100)}% histórico (${rowTot} obs)`,
          confidence: Math.min(88, 38 + topProb*140),
        });
      }
    }

    // ── 6. TERMINAL DOMINANTE DO MOMENTO ─────────────────────
    const tf: Record<number,number>={};
    last15.forEach(n=>{const t=n%10; tf[t]=(tf[t]||0)+1;});
    const hotT=Object.entries(tf).sort(([,a],[,b])=>b-a)[0];
    if (hotT && Number(hotT[1])>=3) {
      const t=Number(hotT[0]), cnt=Number(hotT[1]);
      const dgKey=TDG[t], dgNums=DG[dgKey]||[];
      const distintos=new Set(last15.map(n=>n%10)).size;
      insights.push({
        type: 'terminal_dominante_rt',
        numbers: dgNums,
        score: Math.min(12, cnt*2 + (distintos<=4?4:0)),
        reason: `T${t} domina ${cnt}x/15 → ${dgKey}:[${dgNums.join(',')}]${distintos<=4?' (ENTROPIA BAIXA!)':''}`,
        confidence: Math.min(90, 45+cnt*8+(distintos<=4?15:0)),
      });
    }

    // ── 7. ZERO PRESSÃO DO MOMENTO ───────────────────────────
    const zeroIdx=nums.indexOf(0);
    const zeroDelay=zeroIdx<0?nums.length:zeroIdx;
    if (zeroDelay>=20) {
      const JEU=[12,35,3,26,0,32,15];
      const VIZ=[22,18,29,7,28,12,35,3,26,0,32,15,19,4,21,2,25];
      const level=zeroDelay>50?'ANOMALIA':zeroDelay>40?'CRÍTICO':zeroDelay>25?'ALTA':'MÉDIA';
      const ns=zeroDelay>40?VIZ:JEU;
      insights.push({
        type: 'zero_pressao_rt',
        numbers: ns,
        score: zeroDelay>50?12:zeroDelay>40?9:zeroDelay>25?6:3,
        reason: `Zero ausente ${zeroDelay} giros — Pressão ${level}`,
        confidence: Math.min(90, 35+zeroDelay*1.1),
      });
    }

    // ── 8. SETOR DOMINANTE DO MOMENTO ────────────────────────
    const vC=last10.filter(n=>VOISINS.has(n)).length;
    const tC=last10.filter(n=>TIERS.has(n)).length;
    const maxSec=Math.max(vC,tC);
    if (maxSec>=4) {
      const isV=vC>=tC;
      const ns=isV?[...VOISINS]:[...TIERS];
      insights.push({
        type: 'setor_dominante_rt',
        numbers: ns,
        score: Math.round(maxSec*1.2),
        reason: `${isV?'Voisins':'Tiers'} domina ${maxSec}/10 rodadas recentes`,
        confidence: Math.min(85, 40+maxSec*8),
      });
    }

    // ── 9. NEAR-MISS NA RODA ─────────────────────────────────
    let nearMiss=0;
    for (let i=0;i<last10.length-1;i++) {
      if (wdist(last10[i],last10[i+1])<=3) nearMiss++;
    }
    if (nearMiss>=4) {
      const wi=WHEEL.indexOf(last);
      const viz=wi>=0?[-3,-2,-1,0,1,2,3].map(d=>WHEEL[(wi+d+WL)%WL]):[];
      insights.push({
        type: 'near_miss_rt',
        numbers: [...new Set(viz)],
        score: nearMiss,
        reason: `${nearMiss} near-misses na roda — clustering físico detectado`,
        confidence: Math.min(82, 40+nearMiss*6),
      });
    }

    // ── 10. FREQUÊNCIA QUENTE DO MOMENTO (últimas 20) ────────
    const f20: Record<number,number>={};
    last30.forEach(n=>{f20[n]=(f20[n]||0)+1;});
    const hot20=Object.entries(f20).filter(([,c])=>c>=4).sort(([,a],[,b])=>b-a).slice(0,5).map(([n])=>Number(n));
    if (hot20.length>=2) {
      insights.push({
        type: 'hot_momento',
        numbers: hot20,
        score: Math.min(10, hot20.length*2),
        reason: `Hot nas últimas 30: [${hot20.map(n=>`${n}(${f20[n]}x)`).join(',')}]`,
        confidence: Math.min(82, 48+hot20.length*6),
      });
    }

    // ── 11. NÚMEROS AUSENTES COM DÍVIDA (últimas 100) ────────
    const f100: Record<number,number>={};
    for(let n=0;n<=36;n++) f100[n]=0;
    last100.forEach(n=>{f100[n]++;});
    const ausentes=Object.entries(f100).filter(([,c])=>c<=2).map(([n])=>Number(n));
    if (ausentes.length>=3) {
      insights.push({
        type: 'divida_estatistica',
        numbers: ausentes.slice(0,8),
        score: Math.min(8, ausentes.length),
        reason: `${ausentes.length} números ausentes em 100 giros: [${ausentes.slice(0,5).join(',')}]`,
        confidence: Math.min(75, 35+ausentes.length*3),
      });
    }

    // ── 12. DUPLA DANI GREEN + COMBO ─────────────────────────
    // Se puxados e terminal dominante apontam para mesma dupla
    if (puxados.length>0 && hotT) {
      const t=Number(hotT[0]);
      const dgKey=TDG[t];
      const dgNums=DG[dgKey]||[];
      const puxadoNaDupla=puxados.some(p=>dgNums.includes(p));
      if (puxadoNaDupla && Number(hotT[1])>=3) {
        insights.push({
          type: 'combo_ouro_rt',
          numbers: dgNums,
          score: 16,
          reason: `👑 COMBO OURO REAL: T${t}(${hotT[1]}x) + puxados de ${last} confirmam ${dgKey}`,
          confidence: Math.min(93, 70+Number(hotT[1])*3),
        });
      }
    }

    // ── SALVAR INSIGHTS NO BANCO ──────────────────────────────
    // Usar upsert por tipo — manter apenas o mais recente de cada tipo
    // ── APRENDIZADO POR REFORÇO ──────────────────────────────
    // Verificar previsões anteriores e reforçar padrões que acertaram
    const { data: recentPreds } = await supabase
      .from('prediction_history')
      .select('predicted_numbers, actual_number, hit, strategy_type, created_at')
      .order('created_at', { ascending: false })
      .limit(20);

    // Mapa de números que saíram recentemente quando erramos (anti-padrão)
    const recentMisses: Record<number, number> = {};
    const recentHits: number[] = [];
    for (const pred of (recentPreds || [])) {
      if (pred.hit === false && pred.actual_number != null) {
        recentMisses[pred.actual_number] = (recentMisses[pred.actual_number] || 0) + 1;
      }
      if (pred.hit === true && pred.actual_number != null) {
        recentHits.push(pred.actual_number);
      }
    }

    // Reforçar insights que apontam para números que ACERTAMOS recentemente
    for (const ins of insights) {
      const hitOverlap = ins.numbers.filter(n => recentHits.includes(n)).length;
      if (hitOverlap > 0) {
        ins.confidence = Math.min(95, ins.confidence + hitOverlap * 5);
        ins.score += hitOverlap * 3;
        ins.reason += ` [+${hitOverlap} acertos recentes]`;
      }
      // Penalizar insights que apontam para números que saíram quando erramos
      const missOverlap = ins.numbers.filter(n => (recentMisses[n] || 0) >= 2).length;
      if (missOverlap > 0) {
        ins.confidence = Math.max(20, ins.confidence - missOverlap * 8);
        ins.score = Math.max(1, ins.score - missOverlap * 2);
      }
    }

    const toSave = insights.filter(i => i.confidence >= 35).sort((a,b)=>b.score-a.score);

    for (const ins of toSave) {
      // Verificar se já existe registro recente desse tipo (últimos 5 min)
      const fiveMinAgo = new Date(Date.now()-5*60*1000).toISOString();
      const { data: existing } = await supabase
        .from('pattern_insights')
        .select('id, confidence')
        .eq('pattern_type', ins.type)
        .gte('created_at', fiveMinAgo)
        .limit(1);

      const row = {
        pattern_type: ins.type,
        description: ins.reason,
        confidence: ins.confidence,
        numbers_involved: ins.numbers.slice(0, 20),
        recommendation: `[RT] ${ins.reason} — Score: ${ins.score}pts`,
        source_data: {
          realtime: true,
          last_number: last,
          score: ins.score,
          analyzed: nums.length,
          timestamp: Date.now(),
          backtest_rate: ins.confidence / 100,
          windows_confirmed: [200],
        },
      };

      if (existing && existing.length > 0) {
        // Atualizar se confiança melhorou
        if (ins.confidence > (existing[0].confidence || 0)) {
          await supabase.from('pattern_insights').update(row).eq('id', existing[0].id);
        }
      } else {
        await supabase.from('pattern_insights').insert(row);
      }
    }

    // ── SALVAR EM AI_LEARNED_PATTERNS PARA O SNIPER ──────────
    // Salvar os top 3 insights como learnings de alta prioridade
    const allBetNums = [...new Set(toSave.slice(0,4).flatMap(i=>i.numbers))].slice(0,10);

    for (const topInsight of toSave.slice(0, 3)) {
      const titulo = `RT_${topInsight.type}_${last}`;

      const { data: exRT } = await supabase
        .from('ai_learned_patterns')
        .select('id, accuracy')
        .eq('learning_type', 'session_spin')
        .eq('title', titulo)
        .maybeSingle();

      const rowRT = {
        knowledge: `[REALTIME] ${topInsight.reason}. Números: [${topInsight.numbers.join(',')}]. Score: ${topInsight.score}. Todos padrões momento: [${allBetNums.join(',')}].`,
        data_points: nums.length,
        accuracy: topInsight.confidence,
        metadata: {
          hotNumbers: topInsight.numbers,
          key_numbers: topInsight.numbers,
          realtimeType: topInsight.type,
          lastNumber: last,
          score: topInsight.score,
          lastSeen: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      };

      if (exRT?.id) {
        // Só atualizar se a accuracy melhorou
        if (topInsight.confidence > (exRT.accuracy || 0)) {
          await supabase.from('ai_learned_patterns').update(rowRT).eq('id', exRT.id).catch(()=>{});
        }
      } else {
        await supabase.from('ai_learned_patterns').insert({
          learning_type: 'session_spin',
          title: titulo,
          ...rowRT,
        }).catch(()=>{});
      }
    } // fim for toSave

    // ── RETORNAR PARA O APP ───────────────────────────────────
    return new Response(JSON.stringify({
      status: 'ok',
      last_number: last,
      streak: { number: streakN, count: streakC },
      insights_found: toSave.length,
      top_insight: toSave[0] || null,
      all_insights: toSave.map(i => ({
        type: i.type,
        numbers: i.numbers,
        score: i.score,
        reason: i.reason,
        confidence: i.confidence,
      })),
      recommended_bet: toSave.length > 0 ? {
        main: toSave[0].numbers[0],
        all: [...new Set(toSave.slice(0,3).flatMap(i=>i.numbers))].slice(0,10),
        confidence: Math.round(toSave.slice(0,3).reduce((a,i)=>a+i.confidence,0)/Math.min(3,toSave.length)),
        reasons: toSave.slice(0,3).map(i=>i.reason),
      } : null,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("realtime-patterns error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
