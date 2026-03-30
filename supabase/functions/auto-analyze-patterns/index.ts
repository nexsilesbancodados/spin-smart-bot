import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Constantes ───────────────────────────────────────────────
const WHEEL = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const WL = WHEEL.length;
const RED_SET = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const VOISINS_SET = new Set([22,18,29,7,28,12,35,3,26,0,32,15,19,4,21,2,25]);
const TIERS_SET   = new Set([27,13,36,11,30,8,23,10,5,24,16,33]);
const ORPHS_SET   = new Set([1,20,14,31,9,17,34,6]);
const TERMINALS_MAP: Record<number,number[]> = {
  0:[0,10,20,30],1:[1,11,21,31],2:[2,12,22,32],3:[3,13,23,33],
  4:[4,14,24,34],5:[5,15,25,35],6:[6,16,26,36],7:[7,17,27],
  8:[8,18,28],9:[9,19,29]
};
const DUPLAS: Record<string,number[]> = {
  DG1:[1,11,21,31,6,16,26,36], DG2:[2,12,22,32,7,17,27],
  DG3:[3,13,23,33,8,18,28],    DG4:[4,14,24,34,9,19,29],
  DG5:[10,20,30,5,15,25,35]
};
const T_TO_DG: Record<number,string> = {
  1:'DG1',6:'DG1',2:'DG2',7:'DG2',3:'DG3',8:'DG3',4:'DG4',9:'DG4',0:'DG5',5:'DG5'
};
const PULL_MAP: Record<number,number[]> = {
  0:[10,20,30,32,15,26,3,33,31,35], 1:[11,35,16,4,18,28,27,29,33,14,31],
  2:[14,1,13,18,35,29,12,22],       3:[13,27,6,11,30,8,23,33],
  4:[26,15,18,32,33,16,8,24,14],    5:[3,33,16,24,10,18,15,25],
  6:[8,15,31,21,22,23,16,26],       7:[16,18,17,30,31,28,12],
  8:[11,9,10,18,28,23],             9:[34,35,36,3,16,26,23,24,32,31,29],
  10:[20,5,18,11,14,24,30],         11:[8,18,16,21,30,1],
  12:[21,7,28,35],                  13:[31,27,36,6],
  14:[24,21,18,31,9],               15:[4,19,21,32,0],
  16:[24,21,18,14,6,26],            17:[34,6,25,27,7],
  18:[8,18,28,7],                   19:[9,19,29,4,21],
  20:[4,14,10,30],                  21:[19,2,4,23],
  22:[33,2,32,12],                  23:[32,11,2,33,13],
  24:[21,18,14,34,4],               25:[2,4,17,28,29,12,7,18],
  26:[6,16,26,36,3,0],              27:[28,29,24,22,26,33,31,34,35,36],
  28:[13,14,15,16,17,18,7],         29:[35,28,22],
  30:[4,8,16,9,18,22,5,25,3],       31:[13,9,14],
  32:[2,12,22,32,0,15],             33:[16,3,23,13],
  34:[16,6,4,24],                   35:[0,3,7,12,26,28,29,35],
  36:[3,10,27,6]
};

function wIdx(n: number) { return WHEEL.indexOf(n); }
function wDist(a: number, b: number) {
  const ia = wIdx(a), ib = wIdx(b);
  if (ia < 0 || ib < 0) return 99;
  const d = Math.abs(ia - ib);
  return Math.min(d, WL - d);
}
function getDozen(n: number) { return n === 0 ? 0 : n <= 12 ? 1 : n <= 24 ? 2 : 3; }

// ─── Backtest real (array decrescente: index 0 = mais recente) ───
function backtest(nums: number[], predictFn: (win: number[]) => number[], winSz: number, maxT = 80): number {
  let h = 0, t = 0;
  const mx = Math.min(maxT, nums.length - winSz - 1);
  for (let i = 0; i < mx; i++) {
    const win  = nums.slice(i + 1, i + 1 + winSz);
    const next = nums[i];
    const pred = predictFn(win);
    t++;
    if (pred.includes(next)) h++;
  }
  return t > 0 ? h / t : 0;
}

// ─── Tipos ───────────────────────────────────────────────────
interface DetectorResult {
  type: string;
  label: string;
  numbers: number[];
  confidence: number;
  bt: number;
  recommendation: string;
}

interface Pattern {
  type: string;
  label: string;
  description: string;
  numbers: number[];
  confidence: number;
  bt: number;
  windows_found: number[];
  score: number;
  recommendation: string;
}

// ══════════════════════════════════════════════════════════════
// 22 DETECTORES
// ══════════════════════════════════════════════════════════════

function dAutoRepeticao(nums: number[], wSize: number): DetectorResult | null {
  const f: Record<number,number> = {};
  nums.slice(0,5).forEach(n => { f[n]=(f[n]||0)+1; });
  const best = Object.entries(f).sort(([,a],[,b])=>Number(b)-Number(a))[0];
  if (!best || Number(best[1]) < 2) return null;
  const n = Number(best[0]);
  const cnt = Number(best[1]);
  const neighbors = [-2,-1,0,1,2].map(d=>WHEEL[(wIdx(n)+d+WL)%WL]);
  const bt = backtest(nums, w => {
    const ff: Record<number,number>={};
    w.slice(0,5).forEach(x=>{ff[x]=(ff[x]||0)+1;});
    const bb=Object.entries(ff).sort(([,a],[,b])=>Number(b)-Number(a))[0];
    return bb && Number(bb[1])>=2 ? [-2,-1,0,1,2].map(d=>WHEEL[(wIdx(Number(bb[0]))+d+WL)%WL]) : [];
  }, 5, 60);
  return {
    type:'auto_repeticao', label:'🔁 Auto-Repetição',
    numbers:[...new Set(neighbors)],
    confidence: Math.min(92, 55 + cnt*15),
    bt, recommendation:`${n} repetiu ${cnt}x → apostar pleno+vizinhos [${neighbors.join(',')}]`
  };
}

function dTerminalDom(nums: number[], wSize: number): DetectorResult | null {
  const last = nums.slice(0, Math.min(wSize, 15));
  const tf: Record<number,number>={};
  last.forEach(n=>{const t=n%10;tf[t]=(tf[t]||0)+1;});
  const sorted = Object.entries(tf).sort(([,a],[,b])=>Number(b)-Number(a));
  if (!sorted[0] || Number(sorted[0][1]) < 3) return null;
  const hotT = Number(sorted[0][0]);
  const cnt = Number(sorted[0][1]);
  const dgKey = T_TO_DG[hotT];
  const dgNums = DUPLAS[dgKey] || [];
  const bt = backtest(nums, w => {
    const tf2: Record<number,number>={};
    w.slice(0,15).forEach(n=>{const t=n%10;tf2[t]=(tf2[t]||0)+1;});
    const ht=Number(Object.entries(tf2).sort(([,a],[,b])=>Number(b)-Number(a))[0]?.[0]??0);
    return DUPLAS[T_TO_DG[ht]]||[];
  }, Math.min(wSize,15), 60);
  return {
    type:'terminal_dominante', label:`🎯 Terminal T${hotT} (${dgKey})`,
    numbers: dgNums,
    confidence: Math.min(90, 50 + cnt*8),
    bt, recommendation:`T${hotT} domina ${cnt}x → Dupla ${dgKey}: [${dgNums.join(',')}]`
  };
}

function dPuxadaConfirmada(nums: number[], wSize: number): DetectorResult | null {
  const last = nums[0];
  const targets = PULL_MAP[last] || [];
  if (targets.length === 0) return null;
  let h=0, t=0;
  for (let i=1; i<Math.min(wSize, nums.length)-4; i++) {
    if (nums[i]===last) {
      t++;
      const next4 = nums.slice(Math.max(0,i-4),i);
      if (next4.some(n=>targets.includes(n))) h++;
    }
  }
  if (t < 3) return null;
  const rate = h/t;
  if (rate < 0.30) return null;
  const bt = backtest(nums, w => PULL_MAP[w[0]]||[], 1, 80);
  return {
    type:'puxada_confirmada', label:`🧲 Puxada ${last}→[${targets.slice(0,4).join(',')}]`,
    numbers: targets.slice(0,8),
    confidence: Math.min(90, 40 + rate*120),
    bt, recommendation:`${last} puxou ${(rate*100).toFixed(0)}% (${h}/${t}) → apostar [${targets.slice(0,5).join(',')}]`
  };
}

function dMatrizNumerica(nums: number[], wSize: number): DetectorResult | null {
  const last = nums[0];
  const freq: Record<number,number>={};
  let total=0;
  for (let i=1;i<Math.min(wSize,nums.length)-1;i++) {
    if (nums[i]===last) {
      const next=nums[i-1];
      if(next>=0&&next<=36){freq[next]=(freq[next]||0)+1;total++;}
    }
  }
  if (total<5) return null;
  const topNums = Object.entries(freq).sort(([,a],[,b])=>Number(b)-Number(a)).slice(0,5)
    .filter(([,c])=>Number(c)/total>0.12).map(([n])=>Number(n));
  if (topNums.length===0) return null;
  const topProb = Number(freq[topNums[0]]||0)/total;
  const bt = backtest(nums, w => {
    const f2: Record<number,number>={};
    let t2=0;
    for(let i=1;i<w.length;i++){if(w[i]===w[0]){f2[w[i-1]]=(f2[w[i-1]]||0)+1;t2++;}}
    if(t2<3) return [last];
    return Object.entries(f2).sort(([,a],[,b])=>Number(b)-Number(a)).slice(0,3).map(([n])=>Number(n));
  }, Math.min(wSize,30), 50);
  return {
    type:'matriz_numerica', label:`🔢 Matriz ${last}→[${topNums.join(',')}]`,
    numbers: topNums,
    confidence: Math.min(90, 40+topProb*150+(total>20?10:0)),
    bt, recommendation:`Após ${last}: [${topNums.join(',')}] confirmados (${(topProb*100).toFixed(0)}%, ${total}obs)`
  };
}

function dZeroPressao(nums: number[], wSize: number): DetectorResult | null {
  const idx = nums.indexOf(0);
  const delay = idx<0 ? Math.min(wSize, nums.length) : idx;
  if (delay<15) return null;
  const JEU_ZERO=[12,35,3,26,0,32,15];
  const VIZ_ZERO=[22,18,29,7,28,12,35,3,26,0,32,15,19,4,21,2,25];
  const level = delay>40?'CRÍTICA':delay>25?'ALTA':'MÉDIA';
  const ns = delay>40?VIZ_ZERO:JEU_ZERO;
  const bt = backtest(nums, w => {
    const d=w.indexOf(0); const dl=d<0?wSize:d;
    return dl>20?VIZ_ZERO:dl>12?JEU_ZERO:[];
  }, Math.min(wSize,20), 50);
  return {
    type:'pressao_zero', label:`🟢 Pressão Zero ${level}`,
    numbers: ns,
    confidence: Math.min(90, 35+delay*1.2),
    bt, recommendation:`Zero ausente ${delay} giros (${level}) → ${delay>40?'Vizinhos Zero 9 fichas':'Jeu Zero 4 fichas'}`
  };
}

function dColorStreak(nums: number[], wSize: number): DetectorResult | null {
  const last = nums.slice(0, Math.min(wSize, 8));
  const colors = last.filter(n=>n>0).map(n=>RED_SET.has(n)?'R':'P');
  if (colors.length<5) return null;
  let s=1; const c=colors[0];
  for(let i=1;i<colors.length;i++){if(colors[i]===c)s++;else break;}
  if (s<4) return null;
  const isRed = c==='R';
  const reverseNums = isRed
    ? Array.from({length:36},(_,i)=>i+1).filter(n=>!RED_SET.has(n))
    : Array.from({length:36},(_,i)=>i+1).filter(n=>RED_SET.has(n));
  const bt = backtest(nums, w => {
    const cs=w.filter(n=>n>0).map(n=>RED_SET.has(n)?'R':'P');
    let ss=1; const cc=cs[0];for(let i=1;i<cs.length;i++){if(cs[i]===cc)ss++;else break;}
    return ss>=4?(cc==='R'?Array.from({length:36},(_,i)=>i+1).filter(n=>!RED_SET.has(n)):Array.from({length:36},(_,i)=>i+1).filter(n=>RED_SET.has(n))):[];
  }, Math.min(wSize,8), 60);
  return {
    type:'color_streak', label:`${isRed?'🔴':'⚫'} Streak ${s}x → reversão`,
    numbers: reverseNums,
    confidence: Math.min(82, 45+s*7),
    bt, recommendation:`${s}x ${isRed?'Vermelho':'Preto'} → apostar ${isRed?'Preto':'Vermelho'} reversão`
  };
}

function dColorTendencia(nums: number[], wSize: number): DetectorResult | null {
  const sl = nums.slice(0, Math.min(wSize, 30)).filter(n=>n>0);
  const reds = sl.filter(n=>RED_SET.has(n)).length;
  const ratio = reds/sl.length;
  if (ratio > 0.42 && ratio < 0.58) return null;
  const isRedDom = ratio >= 0.58;
  const domNums = isRedDom
    ? Array.from({length:36},(_,i)=>i+1).filter(n=>RED_SET.has(n))
    : Array.from({length:36},(_,i)=>i+1).filter(n=>!RED_SET.has(n));
  const bt = backtest(nums, w => {
    const s=w.slice(0,Math.min(wSize,30)).filter(n=>n>0);
    const r=s.filter(n=>RED_SET.has(n)).length/s.length;
    return r>=0.58?Array.from({length:36},(_,i)=>i+1).filter(n=>RED_SET.has(n))
          :r<=0.42?Array.from({length:36},(_,i)=>i+1).filter(n=>!RED_SET.has(n)):[];
  }, Math.min(wSize,30), 60);
  return {
    type:'color_tendencia', label:`${isRedDom?'🔴':'⚫'} Tendência ${isRedDom?'Vermelho':'Preto'}`,
    numbers: domNums,
    confidence: Math.min(80, 45 + Math.abs(ratio-0.5)*200),
    bt, recommendation:`${isRedDom?'Vermelho':'Preto'} domina (${(ratio*100).toFixed(0)}% em ${sl.length}) → seguir tendência`
  };
}

function dParidadeStreak(nums: number[], wSize: number): DetectorResult | null {
  const last = nums.slice(0, Math.min(wSize, 8)).filter(n=>n>0);
  const par = last.map(n=>n%2===0?'P':'I');
  let s=1; const c=par[0];
  for(let i=1;i<par.length;i++){if(par[i]===c)s++;else break;}
  if (s<4) return null;
  const nextPar = c==='P';
  const ns = Array.from({length:36},(_,i)=>i+1).filter(n=>nextPar?n%2!==0:n%2===0);
  const bt = backtest(nums, w => {
    const p=w.filter(n=>n>0).map(n=>n%2===0?'P':'I');
    let ss=1; const cc=p[0];for(let i=1;i<p.length;i++){if(p[i]===cc)ss++;else break;}
    return ss>=4?(cc==='P'?Array.from({length:36},(_,i)=>i+1).filter(n=>n%2!==0):Array.from({length:36},(_,i)=>i+1).filter(n=>n%2===0)):[];
  }, Math.min(wSize,8), 60);
  return {
    type:'paridade_streak', label:`${c==='P'?'🔵':'🟠'} Streak ${s}x ${c==='P'?'Par':'Ímpar'} → inversão`,
    numbers: ns,
    confidence: Math.min(80, 42+s*8),
    bt, recommendation:`${s}x ${c==='P'?'Par':'Ímpar'} → apostar ${c==='P'?'Ímpar':'Par'}`
  };
}

function dAltosBaixos(nums: number[], wSize: number): DetectorResult | null {
  const sl = nums.slice(0,Math.min(wSize,20)).filter(n=>n>0);
  const altos = sl.filter(n=>n>=19).length;
  const ratio = altos/sl.length;
  if (ratio>0.42&&ratio<0.58) return null;
  const isAltoDom = ratio>=0.58;
  const ns = isAltoDom?Array.from({length:18},(_,i)=>i+19):Array.from({length:18},(_,i)=>i+1);
  const bt = backtest(nums, w=>{
    const s=w.slice(0,Math.min(wSize,20)).filter(n=>n>0);
    const r=s.filter(n=>n>=19).length/s.length;
    return r>=0.58?Array.from({length:18},(_,i)=>i+19):r<=0.42?Array.from({length:18},(_,i)=>i+1):[];
  }, Math.min(wSize,20), 60);
  return {
    type:'alto_baixo_bias', label:`${isAltoDom?'⬆️':'⬇️'} ${isAltoDom?'Altos':'Baixos'} dominando`,
    numbers: ns,
    confidence: Math.min(78, 42+Math.abs(ratio-0.5)*180),
    bt, recommendation:`${isAltoDom?'19-36':'1-18'} domina ${(ratio*100).toFixed(0)}% → seguir`
  };
}

function dSetorDom(nums: number[], wSize: number): DetectorResult | null {
  const sl = nums.slice(0, Math.min(wSize, 20));
  const vc=sl.filter(n=>VOISINS_SET.has(n)).length;
  const tc=sl.filter(n=>TIERS_SET.has(n)).length;
  const oc=sl.filter(n=>ORPHS_SET.has(n)).length;
  const total=vc+tc+oc||1;
  const max=Math.max(vc,tc,oc);
  if (max/total<0.40) return null;
  const isV=vc===max, isT=tc===max;
  const ns=isV?[...VOISINS_SET]:isT?[...TIERS_SET]:[...ORPHS_SET];
  const nome=isV?'Voisins':isT?'Tiers':'Orphelins';
  const cnt=isV?vc:isT?tc:oc;
  const bt = backtest(nums, w=>{
    const vv=w.slice(0,Math.min(wSize,20)).filter(n=>VOISINS_SET.has(n)).length;
    const tt=w.slice(0,Math.min(wSize,20)).filter(n=>TIERS_SET.has(n)).length;
    const oo=w.slice(0,Math.min(wSize,20)).filter(n=>ORPHS_SET.has(n)).length;
    const mm=Math.max(vv,tt,oo);
    return vv===mm?[...VOISINS_SET]:tt===mm?[...TIERS_SET]:[...ORPHS_SET];
  }, Math.min(wSize,20), 50);
  return {
    type:'setor_dominante', label:`🗺️ ${nome} Dominante`,
    numbers: ns,
    confidence: Math.min(85, 45+(cnt/sl.length)*150),
    bt, recommendation:`${nome} domina: ${cnt}/${sl.length} (${(cnt/sl.length*100).toFixed(0)}%) → apostar setor`
  };
}

function dDuziaDom(nums: number[], wSize: number): DetectorResult | null {
  const sl = nums.slice(0, Math.min(wSize,20)).filter(n=>n>0);
  const d=[0,0,0];
  sl.forEach(n=>{const dz=getDozen(n);if(dz>0)d[dz-1]++;});
  const mx=Math.max(...d); const di=d.indexOf(mx);
  if (mx/sl.length<0.40) return null;
  const ns=Array.from({length:12},(_,i)=>i+(di)*12+1);
  const bt = backtest(nums, w=>{
    const s=w.slice(0,Math.min(wSize,20)).filter(n=>n>0);
    const dd=[0,0,0];s.forEach(n=>{const dz=getDozen(n);if(dz>0)dd[dz-1]++;});
    const mx2=Math.max(...dd);const di2=dd.indexOf(mx2);
    return Array.from({length:12},(_,i)=>i+di2*12+1);
  }, Math.min(wSize,20), 60);
  return {
    type:'duzia_dominante', label:`🎲 Dúzia ${di+1} Dominante`,
    numbers: ns,
    confidence: Math.min(82, 42+(mx/sl.length)*140),
    bt, recommendation:`D${di+1} (${(di)*12+1}-${(di+1)*12}) domina ${mx}/${sl.length} → apostar dúzia`
  };
}

function dDuziaCiclo(nums: number[], wSize: number): DetectorResult | null {
  const sl = nums.slice(0,Math.min(wSize,10)).filter(n=>n>0);
  if (sl.length<6) return null;
  const dz=sl.map(n=>getDozen(n)).filter(d=>d>0);
  let asc=0,desc=0;
  const aSeq=[1,2,3,1,2,3],dSeq=[3,2,1,3,2,1];
  for(let i=0;i<Math.min(dz.length,4);i++){if(dz[i]===aSeq[i])asc++;if(dz[i]===dSeq[i])desc++;}
  if (asc<3&&desc<3) return null;
  const isAsc=asc>=desc; const last=dz[dz.length-1];
  const next=isAsc?(last%3)+1:last===1?3:last-1;
  const ns=Array.from({length:12},(_,i)=>i+(next-1)*12+1);
  const bt = backtest(nums, w=>{
    const dd=w.slice(0,Math.min(wSize,10)).filter(n=>n>0).map(n=>getDozen(n)).filter(d=>d>0);
    let aa=0,bb=0;for(let i=0;i<Math.min(dd.length,4);i++){if(dd[i]===aSeq[i])aa++;if(dd[i]===dSeq[i])bb++;}
    if(aa<3&&bb<3) return [];
    const ia=aa>=bb; const ll=dd[dd.length-1];
    const nn=ia?(ll%3)+1:ll===1?3:ll-1;
    return Array.from({length:12},(_,i)=>i+(nn-1)*12+1);
  }, Math.min(wSize,10), 50);
  return {
    type:'duzia_ciclo', label:`🔄 Ciclo Dúzia → D${next}`,
    numbers: ns,
    confidence: Math.min(80, 50+Math.max(asc,desc)*8),
    bt, recommendation:`Ciclo ${isAsc?'ascendente':'descendente'} → próxima D${next}`
  };
}

function dTerminalAscDesc(nums: number[], wSize: number): DetectorResult | null {
  const sl=nums.slice(0,Math.min(wSize,10));
  const terms=sl.map(n=>n%10);
  let asc=0,desc=0;
  for(let i=0;i<terms.length-1;i++){if(terms[i+1]<terms[i])asc++;else if(terms[i+1]>terms[i])desc++;}
  const total=asc+desc||1;
  if (asc/total<0.65&&desc/total<0.65) return null;
  const isAsc=asc>desc;
  const lastT=terms[0];
  const nextT=isAsc?Math.min(9,lastT+1):(lastT>0?lastT-1:9);
  const ns=TERMINALS_MAP[nextT]||[];
  const bt = backtest(nums, w=>{
    const t=w.slice(0,Math.min(wSize,10)).map(n=>n%10);
    let aa=0,bb=0;for(let i=0;i<t.length-1;i++){if(t[i+1]<t[i])aa++;else if(t[i+1]>t[i])bb++;}
    const tot=aa+bb||1;if(aa/tot<0.65&&bb/tot<0.65)return[];
    const ia=aa>bb;const lt=t[0];const nt=ia?Math.min(9,lt+1):(lt>0?lt-1:9);
    return TERMINALS_MAP[nt]||[];
  }, Math.min(wSize,10), 60);
  return {
    type:`terminal_${isAsc?'asc':'desc'}`, label:`📈 Terminal ${isAsc?'Crescente':'Decrescente'} → T${nextT}`,
    numbers: ns,
    confidence: Math.min(80, 45+(isAsc?asc:desc)/total*100),
    bt, recommendation:`Sequência ${isAsc?'ascendente':'descendente'} → T${nextT}: [${ns.join(',')}]`
  };
}

function dVizinhosRoda(nums: number[], wSize: number): DetectorResult | null {
  const sl=nums.slice(0,Math.min(wSize,10));
  let nearMiss=0;
  for(let i=0;i<sl.length-1;i++){if(wDist(sl[i],sl[i+1])<=3)nearMiss++;}
  if (nearMiss<4) return null;
  const last=sl[0]; const li=wIdx(last);
  const viz=li>=0?[-3,-2,-1,0,1,2,3].map(d=>WHEEL[(li+d+WL)%WL]):[];
  const bt = backtest(nums, w=>{
    let nm=0;const s=w.slice(0,Math.min(wSize,10));
    for(let i=0;i<s.length-1;i++){if(wDist(s[i],s[i+1])<=3)nm++;}
    if(nm<4)return[];const ll=s[0];const lli=wIdx(ll);
    return lli>=0?[-3,-2,-1,0,1,2,3].map(d=>WHEEL[(lli+d+WL)%WL]):[];
  }, Math.min(wSize,10), 60);
  return {
    type:'vizinhos_roda', label:`🔵 Clustering na Roda`,
    numbers:[...new Set(viz)],
    confidence:Math.min(82,45+nearMiss*6),
    bt, recommendation:`${nearMiss} near-misses → clustering físico → vizinhos do ${last}`
  };
}

function dNumerosQuentes(nums: number[], wSize: number): DetectorResult | null {
  const sl=nums.slice(0,Math.min(wSize,nums.length));
  const f: Record<number,number>={};
  sl.forEach(n=>{f[n]=(f[n]||0)+1;});
  const hot=Object.entries(f).sort(([,a],[,b])=>Number(b)-Number(a))
    .filter(([,c])=>Number(c)>=Math.ceil(wSize/20)).slice(0,6).map(([n])=>Number(n));
  if (hot.length<3) return null;
  const threshold=wSize/37;
  const hotBig=hot.filter(n=>Number(f[n])>=threshold*2);
  if (hotBig.length<2) return null;
  const bt = backtest(nums, w=>{
    const ff: Record<number,number>={};
    w.slice(0,Math.min(wSize,w.length)).forEach(n=>{ff[n]=(ff[n]||0)+1;});
    return Object.entries(ff).sort(([,a],[,b])=>Number(b)-Number(a)).slice(0,6).map(([n])=>Number(n));
  }, Math.min(wSize,20), 50);
  return {
    type:'numeros_quentes', label:`🔥 Hot Numbers [${hotBig.slice(0,4).join(',')}]`,
    numbers: hot,
    confidence:Math.min(85,48+hotBig.length*8),
    bt, recommendation:`Quentes: [${hot.join(',')}] — persistência histórica`
  };
}

function dNumerosFrios(nums: number[], wSize: number): DetectorResult | null {
  const sl=nums.slice(0,Math.min(wSize,nums.length));
  const f: Record<number,number>={};
  for(let n=0;n<=36;n++) f[n]=0;
  sl.forEach(n=>{f[n]++;});
  const expected=wSize/37;
  const cold=Object.entries(f).filter(([,c])=>Number(c)<=expected*0.5)
    .sort(([,a],[,b])=>Number(a)-Number(b)).slice(0,8).map(([n])=>Number(n));
  if (cold.length<4) return null;
  const bt = backtest(nums, w=>{
    const ff: Record<number,number>={};
    for(let n=0;n<=36;n++) ff[n]=0;
    w.slice(0,Math.min(wSize,w.length)).forEach(n=>{ff[n]++;});
    const exp=wSize/37;
    return Object.entries(ff).filter(([,c])=>Number(c)<=exp*0.5).map(([n])=>Number(n));
  }, Math.min(wSize,20), 50);
  return {
    type:'numeros_frios', label:`❄️ Cold Numbers Dívida`,
    numbers: cold,
    confidence:Math.min(78,42+cold.length*4),
    bt, recommendation:`Ausentes em ${wSize}: [${cold.slice(0,6).join(',')}] — dívida estatística`
  };
}

function dCavaloHot(nums: number[], wSize: number): DetectorResult | null {
  const CAVALOS: Record<string,number[]>={
    '258':[2,5,8,12,15,18,22,25,28,32,35],
    '147':[1,4,7,11,14,17,21,24,27,31,34],
    '03':[0,3,10,13,20,23,30,33],
    '69':[6,9,16,19,26,29,36],
  };
  const sl=nums.slice(0,Math.min(wSize,30));
  const scores: Record<string,number>={};
  Object.entries(CAVALOS).forEach(([k,v])=>{scores[k]=sl.filter(n=>v.includes(n)).length;});
  const best=Object.entries(scores).sort(([,a],[,b])=>Number(b)-Number(a))[0];
  if (!best||Number(best[1])/sl.length<0.32) return null;
  const ns=CAVALOS[best[0]];
  const bt = backtest(nums, w=>{
    const sc: Record<string,number>={};
    Object.entries(CAVALOS).forEach(([k,v])=>{sc[k]=w.slice(0,Math.min(wSize,30)).filter(n=>v.includes(n)).length;});
    const bb=Object.entries(sc).sort(([,a],[,b])=>Number(b)-Number(a))[0];
    return bb?CAVALOS[bb[0]]:[];
  }, Math.min(wSize,30), 50);
  return {
    type:'cavalo_hot', label:`🐴 Cavalos ${best[0]} Quente`,
    numbers: ns,
    confidence:Math.min(84,46+Number(best[1])/sl.length*120),
    bt, recommendation:`Grupo C${best[0]} quente: ${Number(best[1])}/${sl.length} → apostar cavalos`
  };
}

function dEntropiaSetor(nums: number[], wSize: number): DetectorResult | null {
  const sl=nums.slice(0,Math.min(wSize,15));
  const distintos=new Set(sl.map(n=>n%10)).size;
  if (distintos>5) return null;
  const tf: Record<number,number>={};
  sl.forEach(n=>{const t=n%10;tf[t]=(tf[t]||0)+1;});
  const hotT=Number(Object.entries(tf).sort(([,a],[,b])=>Number(b)-Number(a))[0]?.[0]??0);
  const dgKey=T_TO_DG[hotT];
  const ns=DUPLAS[dgKey]||[];
  const bt = backtest(nums, w=>{
    const s=w.slice(0,Math.min(wSize,15));
    const dist=new Set(s.map(n=>n%10)).size;
    if(dist>5) return [];
    const tff: Record<number,number>={};
    s.forEach(n=>{const t=n%10;tff[t]=(tff[t]||0)+1;});
    const ht=Number(Object.entries(tff).sort(([,a],[,b])=>Number(b)-Number(a))[0]?.[0]??0);
    return DUPLAS[T_TO_DG[ht]]||[];
  }, Math.min(wSize,15), 60);
  return {
    type:'entropia_baixa', label:`🎯 Entropia Baixa (${distintos} T)`,
    numbers: ns,
    confidence:Math.min(88,42+(6-distintos)*12),
    bt, recommendation:`Sessão concentrada (${distintos}/10 terminais) → ${dgKey}: [${ns.join(',')}]`
  };
}

function dMirrorNumbers(nums: number[], wSize: number): DetectorResult | null {
  const sl=nums.slice(0,Math.min(wSize,20));
  const pairs: {a:number;b:number;score:number}[]=[];
  for(let n=1;n<=18;n++){
    const m=37-n;if(m>36)continue;
    const ca=sl.filter(x=>x===n).length;const cb=sl.filter(x=>x===m).length;
    if(ca>=1&&cb>=1) pairs.push({a:n,b:m,score:ca+cb});
  }
  if(pairs.length<2) return null;
  const topP=pairs.sort((a,b)=>b.score-a.score).slice(0,3);
  const ns=[...new Set(topP.flatMap(p=>[p.a,p.b]))];
  const bt = backtest(nums, w=>{
    const s=w.slice(0,Math.min(wSize,20));
    const pp: number[]=[];
    for(let n=1;n<=18;n++){const m=37-n;if(s.includes(n)&&s.includes(m)){pp.push(n,m);}}
    return pp;
  }, Math.min(wSize,20), 50);
  return {
    type:'mirror_pattern', label:`🪞 Complementares Ativos`,
    numbers: ns,
    confidence:Math.min(78,44+topP.length*8),
    bt, recommendation:`Pares complementares: ${topP.map(p=>`${p.a}+${p.b}`).join(', ')} → apostar ambos`
  };
}

function dComboOuro(nums: number[], wSize: number): DetectorResult | null {
  const sl=nums.slice(0,Math.min(wSize,15));
  const tf: Record<number,number>={};
  sl.forEach(n=>{const t=n%10;tf[t]=(tf[t]||0)+1;});
  const sorted=Object.entries(tf).sort(([,a],[,b])=>Number(b)-Number(a));
  const hotT=Number(sorted[0]?.[0]??-1),hotC=Number(sorted[0]?.[1]??0);
  if(hotT<0||hotC<3) return null;
  const distintos=new Set(sl.map(n=>n%10)).size;
  const puxados=PULL_MAP[nums[0]]||[];
  const dgKey=T_TO_DG[hotT];
  const dgNums=DUPLAS[dgKey]||[];
  const puxConfirm=puxados.some(p=>dgNums.includes(p));
  if(distintos>5||!puxConfirm) return null;
  const bt = backtest(nums, w=>{
    const s=w.slice(0,Math.min(wSize,15));
    const tff: Record<number,number>={};
    s.forEach(n=>{const t=n%10;tff[t]=(tff[t]||0)+1;});
    const ht=Number(Object.entries(tff).sort(([,a],[,b])=>Number(b)-Number(a))[0]?.[0]??0);
    return DUPLAS[T_TO_DG[ht]]||[];
  }, Math.min(wSize,15), 40);
  return {
    type:'combo_ouro', label:`👑 COMBO OURO`,
    numbers: dgNums,
    confidence:Math.min(95,78+hotC*3),
    bt, recommendation:`COMBO OURO: T${hotT}(${hotC}x)+puxados+entropia(${distintos}) → ${dgKey}: [${dgNums.join(',')}]`
  };
}

function dRepetindo3x(nums: number[], wSize: number): DetectorResult | null {
  const sl=nums.slice(0,Math.min(wSize,nums.length));
  const f: Record<number,number>={};
  sl.forEach(n=>{f[n]=(f[n]||0)+1;});
  const rep3=Object.entries(f).filter(([,c])=>Number(c)>=3).sort(([,a],[,b])=>Number(b)-Number(a));
  if(rep3.length===0) return null;
  const top=rep3.slice(0,4).map(([n,c])=>({n:Number(n),c:Number(c)}));
  const ns=top.map(x=>x.n);
  const bt = backtest(nums, w=>{
    const ff: Record<number,number>={};
    w.slice(0,Math.min(wSize,w.length)).forEach(n=>{ff[n]=(ff[n]||0)+1;});
    return Object.entries(ff).filter(([,c])=>Number(c)>=3).map(([n])=>Number(n));
  }, Math.min(wSize,20), 50);
  return {
    type:'repeticao_3x', label:`⚡ Repetição 3x+ [${ns.join(',')}]`,
    numbers: ns,
    confidence:Math.min(88,50+top[0].c*6),
    bt, recommendation:`Em ${wSize} giros: ${top.map(x=>`${x.n}(${x.c}x)`).join(', ')} → jogar persistência`
  };
}

function dSequenciaPull2(nums: number[], wSize: number): DetectorResult | null {
  if(nums.length<3) return null;
  const n0=nums[0],n1=nums[1];
  const pull0=PULL_MAP[n0]||[];
  const pull1=PULL_MAP[n1]||[];
  const commonPull=[...pull0].filter(n=>pull1.includes(n));
  if(commonPull.length===0) return null;
  const bt = backtest(nums, w=>{
    const p0=PULL_MAP[w[0]]||[];const p1=PULL_MAP[w[1]]||[];
    return p0.filter(n=>p1.includes(n));
  }, 2, 80);
  if(bt<0.15) return null;
  return {
    type:'pull_duplo', label:`🔗 Pull Duplo [${commonPull.slice(0,4).join(',')}]`,
    numbers: commonPull.slice(0,8),
    confidence:Math.min(88,55+commonPull.length*5),
    bt, recommendation:`${n1}→${n0} ambos puxam [${commonPull.slice(0,4).join(',')}] — Double Pull confirmado`
  };
}

// ──────────────────────────────────────────────────────────────
// ANÁLISE MULTI-JANELA: 6 janelas independentes
// ──────────────────────────────────────────────────────────────
const WINDOW_SIZES = [500, 400, 300, 200, 100, 50] as const;

const ALL_DETECTORS: Array<(nums: number[], wSize: number) => DetectorResult | null> = [
  dAutoRepeticao, dTerminalDom, dPuxadaConfirmada, dMatrizNumerica,
  dZeroPressao, dColorStreak, dColorTendencia, dParidadeStreak,
  dAltosBaixos, dSetorDom, dDuziaDom, dDuziaCiclo, dTerminalAscDesc,
  dVizinhosRoda, dNumerosQuentes, dNumerosFrios, dCavaloHot,
  dEntropiaSetor, dMirrorNumbers, dComboOuro, dRepetindo3x, dSequenciaPull2,
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: dbData } = await supabase
      .from('roulette_numbers')
      .select('number')
      .order('fetched_at', { ascending: false })
      .limit(500);

    const allNums: number[] = (dbData || []).map((r: any) => r.number as number);

    if (allNums.length < 30) {
      return new Response(JSON.stringify({ status: "not_enough_data" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Rodar detectores em cada janela ─────────────────────
    const accumulator: Record<string, {
      pattern: DetectorResult;
      windows: number[];
      totalBt: number;
      totalConf: number;
    }> = {};

    for (const wSize of WINDOW_SIZES) {
      const slice = allNums.slice(0, Math.min(wSize, allNums.length));
      if (slice.length < 20) continue;

      for (const detector of ALL_DETECTORS) {
        const result = detector(slice, wSize);
        if (!result || result.confidence < 40 || result.bt < 0.08) continue;

        const key = `${result.type}_${result.numbers.slice(0,3).join('_')}`;
        if (!accumulator[key]) {
          accumulator[key] = { pattern: result, windows: [], totalBt: 0, totalConf: 0 };
        }
        accumulator[key].windows.push(wSize);
        accumulator[key].totalBt += result.bt;
        accumulator[key].totalConf += result.confidence;
      }
    }

    // ─── Score composto ──────────────────────────────────────
    const rankedPatterns: Pattern[] = Object.values(accumulator)
      .map(({ pattern, windows, totalBt, totalConf }) => {
        const wCount = windows.length;
        const avgConf = totalConf / wCount;
        const avgBt = totalBt / wCount;
        const windowBonus = 1 + wCount * 0.25;
        const score = Math.round(avgConf * windowBonus * (0.5 + avgBt * 0.5));
        return {
          type: pattern.type,
          label: pattern.label,
          description: pattern.recommendation,
          numbers: pattern.numbers,
          confidence: Math.round(avgConf),
          bt: +avgBt.toFixed(2),
          windows_found: windows,
          score,
          recommendation: pattern.recommendation,
        };
      })
      .filter(p => p.score >= 40)
      .sort((a, b) => b.score - a.score);

    if (rankedPatterns.length === 0) {
      return new Response(JSON.stringify({
        status: "no_patterns", analyzed: allNums.length
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── Top por categoria ────────────────────────────────────
    const seenTypes = new Set<string>();
    const topPatterns = rankedPatterns.filter(p => {
      if (seenTypes.has(p.type)) return false;
      seenTypes.add(p.type);
      return true;
    }).slice(0, 15);

    // ─── Salvar no banco ──────────────────────────────────────
    const rows = topPatterns.map(p => {
      // Confidence real = backtest × 60 + janelas_bonus × 5
      const windowBonus = Math.min(5, p.windows_found.length) * 5;
      const btBonus = Math.round(p.bt * 60);
      const realConfidence = Math.min(90, Math.max(20, btBonus + windowBonus));
      return {
        pattern_type: p.type,
        description: `[${p.windows_found.length}W BT:${(p.bt*100).toFixed(0)}%] ${p.description}`,
        confidence: realConfidence,
        numbers_involved: p.numbers.slice(0, 20),
        recommendation: p.recommendation,
        source_data: {
          analyzed_numbers: allNums.slice(0, 10),
          total_analyzed: allNums.length,
          backtest_rate: p.bt,
          windows_confirmed: p.windows_found,
          score: p.score,
          validated: true,
        },
      };
    });

    await supabase.from("pattern_insights").insert(rows);

    // ─── Limpeza: manter últimos 500 insights ─────────────────
    const { data: oldData } = await supabase
      .from("pattern_insights")
      .select("id")
      .order("created_at", { ascending: false })
      .range(500, 9999);

    if (oldData && oldData.length > 0) {
      await supabase.from("pattern_insights").delete()
        .in("id", oldData.map((r: any) => r.id));
    }

    // ─── Memória Evolutiva ────────────────────────────────────
    const { data: memoria } = await supabase
      .from('pattern_insights')
      .select('id, pattern_type, confidence')
      .gt('confidence', 25)
      .order('created_at', { ascending: false })
      .limit(100);

    for (const mem of (memoria || []) as any[]) {
      const redetected = topPatterns.find(p => p.type === mem.pattern_type);
      if (redetected) {
        // Reforço proporcional ao backtest real (2 a 6 pts)
        const btRate = redetected.bt || 0;
        const reinforcement = Math.max(2, Math.round(btRate * 6));
        await supabase.from('pattern_insights')
          .update({ confidence: Math.min(88, (mem.confidence || 50) + reinforcement) })
          .eq('id', mem.id);
      }
    }

    // Penalizar padrões velhos
    const staleTime = new Date(Date.now() - 12 * 60 * 1000).toISOString();
    const { data: stale } = await supabase
      .from('pattern_insights').select('id, confidence')
      .lt('created_at', staleTime).gt('confidence', 12);

    for (const s of ((stale || []) as any[]).slice(0, 40)) {
      await supabase.from('pattern_insights')
        .update({ confidence: Math.max(10, (s.confidence || 30) - 2) })
        .eq('id', s.id);
    }
    await supabase.from('pattern_insights').delete().lt('confidence', 10);

    // ─── Retorno detalhado ────────────────────────────────────
    return new Response(JSON.stringify({
      status: "success",
      analyzed: allNums.length,
      windows_used: WINDOW_SIZES.filter(w => w <= allNums.length),
      patterns_found: rankedPatterns.length,
      patterns_saved: topPatterns.length,
      top_patterns: topPatterns.slice(0, 8).map(p => ({
        type: p.type,
        label: p.label,
        score: p.score,
        confidence: p.confidence,
        backtest: `${(p.bt*100).toFixed(0)}%`,
        windows: p.windows_found,
        numbers: p.numbers,
        recommendation: p.recommendation,
      })),
      timestamp: new Date().toISOString(),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("auto-analyze error:", e);
    return new Response(JSON.stringify({
      error: e instanceof Error ? e.message : "Unknown error"
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
