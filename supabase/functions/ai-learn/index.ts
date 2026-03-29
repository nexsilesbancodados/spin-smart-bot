import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

const KNOWLEDGE_PROMPT = `
## CONHECIMENTO COMPLETO DE ROLETA EUROPEIA (MEMORIZADO)

### Classificação por Unidade
- Vermelhos (18): ${RED.join(', ')}
- Pretos (18): ${BLACK.join(', ')}
- Zero: 0 (Verde)

### Setores do Cilindro (Física do Disco)
- Vizinhos do Zero (17): ${VOISINS.join(', ')}
- Terço do Cilindro (12): ${TIERS.join(', ')}
- Órfãos (8): ${ORPHELINS.join(', ')}
- Jogo do Zero (7): ${JEU_ZERO.join(', ')}
- Ordem física do cilindro (horária): ${WHEEL_ORDER.join(', ')}

### Terminais (Finais)
- T0: 0,10,20,30 | T1: 1,11,21,31 | T2: 2,12,22,32 | T3: 3,13,23,33
- T4: 4,14,24,34 | T5: 5,15,25,35 | T6: 6,16,26,36
- T7: 7,17,27 | T8: 8,18,28 | T9: 9,19,29

### Finais em Pleno (Finales en Plein)
- Finais 0-6: 4 números cada (~10.8% prob) — 33% mais prováveis que finais 7-9
- Finais 7-9: 3 números cada (~8.1% prob)
- REGRA: ao calcular probabilidades, diferencie sempre finais de 4 vs 3 números

### Cavalos (Splits por Terminal)
- Cavalos 2/5/8: ${CAVALOS_258.join(', ')}
- Cavalos 1/4/7: ${CAVALOS_147.join(', ')}
- Cavalos 0/3: ${CAVALOS_03.join(', ')}
- Cavalos 6/9: ${CAVALOS_69.join(', ')}

### Mesa
- 1ª Dúzia: 1-12 | 2ª Dúzia: 13-24 | 3ª Dúzia: 25-36
- Coluna 1: ${COL1.join(', ')}
- Coluna 2: ${COL2.join(', ')}
- Coluna 3: ${COL3.join(', ')}
- Seisenas: S1(1-6) S2(7-12) S3(13-18) S4(19-24) S5(25-30) S6(31-36)

### Dominância de Coluna por Cor
- Coluna 1: 6 pretos, 6 vermelhos (Equilibrada)
- Coluna 2: 8 pretos, 4 vermelhos (Dominante Preta)
- Coluna 3: 4 pretos, 8 vermelhos (Dominante Vermelha)
- REGRA: quando C2 sai acima da média, espere mais pretos; quando C3 sai acima, espere mais vermelhos

### Mapeamento Cruzado
- Vermelhos Pares (8): ${RED_EVEN.join(', ')}
- Vermelhos Ímpares (10): ${RED_ODD.join(', ')}
- Pretos Pares (10): ${BLACK_EVEN.join(', ')}
- Pretos Ímpares (8): ${BLACK_ODD.join(', ')}

### Espelhos Visuais (mesma posição em dúzias)
- Ex: 1,13,25 | 2,14,26 | ... | 12,24,36

### Diamantes (Zonas de Choque - Defletores Físicos)
- Diamante Topo: setor 0,32,15,26,3,35
- Diamante Baixo: setor 5,24,10,23,16
- Diamante Esquerda: setor 1,20,33,14
- Diamante Direita: setor 10,23,8,5,24
- REGRA: identifique concentrações em diamantes para detectar viés físico

### Oitavos do Cilindro (Divisão Profissional em 8)
- O1: 0,32,15,19,4 | O2: 21,2,25,17 | O3: 34,6,27,13 | O4: 36,11,30,8
- O5: 23,10,5,24 | O6: 16,33,1,20 | O7: 14,31,9,22 | O8: 18,29,7,28,12,35,3,26
- REGRA: precisão cirúrgica, identifique qual oitavo está quente/frio

### Lei do Terço
Em 37 rodadas: ~12 números não saem (ausentes), ~12 saem 1x, ~12 se repetem (2x+).
- REGRA: rastreie zona de repetição para identificar números com maior probabilidade

### Padrões de Salto (Skips)
- Salto Curto: <5 posições no cilindro entre rodadas consecutivas
- Salto Longo: >18 posições (~180° do cilindro)
- REGRA: calcule distância no cilindro entre cada resultado consecutivo

### Complementares (Soma 37)
- Pares: (1,36)(2,35)(3,34)...(18,19)
- REGRA: quando um número sai, seu complementar tende a aparecer em breve

### Vizinhos no Cilindro
Cada número tem vizinhos à esquerda e direita no cilindro físico.
Se receber 17 → vizinhos imediatos: 25 (esq) e 34 (dir).
`;

const getColor = (n: number) => n === 0 ? 'green' : RED.includes(n) ? 'red' : 'black';
const getSector = (n: number) => VOISINS.includes(n) ? 'Vizinhos' : TIERS.includes(n) ? 'Terço' : ORPHELINS.includes(n) ? 'Órfãos' : 'Zero';
const getCavalo = (n: number) => CAVALOS_258.includes(n) ? '2/5/8' : CAVALOS_147.includes(n) ? '1/4/7' : CAVALOS_03.includes(n) ? '0/3' : CAVALOS_69.includes(n) ? '6/9' : null;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch last 24 hours
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentData } = await supabase
      .from('roulette_numbers')
      .select('number, color, fetched_at')
      .gte('fetched_at', since)
      .order('fetched_at', { ascending: false })
      .limit(1000);

    const numbers = (recentData || []).map((r: any) => r.number as number);
    if (numbers.length < 50) {
      return new Response(JSON.stringify({ status: "not_enough_data", count: numbers.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

### CONHECIMENTO PRÉVIO:
${prevStr || 'Primeiro aprendizado.'}

## MISSÃO:
Realize uma ANÁLISE TRANSVERSAL DE HISTÓRICO completa. Gere aprendizados profundos sobre:
1. Viés de frequência com análise de desvio padrão
2. Padrões de terminais e sua relação com setores do cilindro
3. Ciclos de dúzias e colunas (qual está "devendo")
4. Comportamento dos 4 grupos de Cavalos
5. Concentração em setores físicos e OITAVOS do cilindro
6. Mapeamento cruzado (cor+paridade) e seus desvios
7. Padrões horários e temporais
8. TENDÊNCIA vs ALTERNÂNCIA: o histórico está viciado ou volátil?
9. Vizinhos no cilindro que saem juntos
10. Compare com conhecimento prévio: confirme ou refute
11. Finais em Pleno: diferencie probabilidade de finais 0-6 vs 7-9
12. DIAMANTES: qual zona de choque está concentrando
13. LEI DO TERÇO: quais números na zona de repetição continuam saindo
14. SALTOS: padrão de distância no cilindro
15. COMPLEMENTARES: pares soma-37 próximos
16. PADRÕES ATIVOS: valide os padrões 3x consecutivos detectados
17. QUEBRA DE ATRASO: identifique grupos em fase de recuperação
18. ESPELHAMENTO: números que se repetem em curto intervalo`;

    // 4. Call AI
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você é o sistema de IA mais avançado de análise de roleta do mundo. Possui conhecimento COMPLETO: setores, cavalos, terminais, oitavos, diamantes, lei do terço, saltos, complementares, dominância de coluna, espelhos visuais, mapeamento cruzado. Execute ANÁLISE TRANSVERSAL: detecte vício de setor, tendência vs alternância, dominância de terminal, blocos de dúzia, quebra de atraso, padrões de salto e espelhamento. Responda APENAS via tool call. Gere 12-20 aprendizados profundos e acionáveis." },
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
                      learning_type: { type: "string", enum: ["frequency_bias","terminal_pattern","color_tendency","dozen_cycle","cavalos_pattern","timing_pattern","streak_behavior","sector_concentration","column_pattern","sixline_pattern","cross_mapping","wheel_neighbors","parity_pattern","final_pleno","column_color_dominance","visual_mirror","octave_pattern","diamond_concentration","third_law","skip_pattern","complementar_pattern","sector_bias","tendency_mode","delay_break","mirror_pattern","active_pattern","block_pattern"] },
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
      const parsed = JSON.parse(toolCall.function.arguments);
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
    const patternRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "Analise e retorne padrões rápidos via tool call. Max 5. Use conhecimento de setores, cavalos, terminais." },
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
        const parsed = JSON.parse(pTC.function.arguments);
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
