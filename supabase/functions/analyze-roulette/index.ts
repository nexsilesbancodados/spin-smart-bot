import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ═══════════════════════════════════════════════════════
// ROLETA EUROPEIA — BASE DE CONHECIMENTO COMPLETA
// ═══════════════════════════════════════════════════════
const WHEEL = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const VOISINS = [22,18,29,7,28,12,35,3,26,0,32,15,19,4,21,2,25];
const TIERS = [27,13,36,11,30,8,23,10,5,24,16,33];
const ORPHELINS = [1,20,14,31,9,17,34,6];
const JEU_ZERO = [12,35,3,26,0,32,15];

const PULL_MAP: Record<number, number[]> = {
  0:[10,20,30,32,15,26,3,33,31,35], 1:[11,35,16,4,18,28,27,29,33,14,31],
  2:[14,1,13,18,35,29,12,22], 3:[13,27,6,11,30,8,23,33],
  4:[26,15,18,32,33,16,8,24,14], 5:[3,33,16,24,10,18,15,25],
  6:[8,15,31,21,22,23,16,26], 7:[16,18,17,30,31,28,12],
  8:[11,9,10,18,28,23], 9:[34,35,36,3,16,26,23,24,32,31,29],
  10:[20,5,18,11,14,24,30], 11:[8,18,16,21,30,1],
  12:[21,7,28,35], 13:[31,27,36,6], 14:[24,21,18,31,9],
  15:[4,19,21,32,0], 16:[24,21,18,14,6,26], 17:[34,6,25,27,7],
  18:[8,18,28,7], 19:[9,19,29,4,21], 20:[4,14,10,30],
  21:[19,2,4,23], 22:[33,2,32,12], 23:[32,11,2,33,13],
  24:[21,18,14,34,4], 25:[2,4,17,28,29,12,7,18], 26:[6,16,26,36,3,0],
  27:[28,29,24,22,26,33,31,34,35,36], 28:[13,14,15,16,17,18,7],
  29:[35,28,22], 30:[4,8,16,9,18,22,5,25,3], 31:[13,9,14],
  32:[2,12,22,32,0,15], 33:[16,3,23,13], 34:[16,6,4,24],
  35:[0,3,7,12,26,28,29,35], 36:[3,10,27,6],
};

const COL1 = [1,4,7,10,13,16,19,22,25,28,31,34];
const COL2 = [2,5,8,11,14,17,20,23,26,29,32,35];
const COL3 = [3,6,9,12,15,18,21,24,27,30,33,36];

const getColor = (n: number) => n === 0 ? 'green' : RED.has(n) ? 'red' : 'black';
const getSector = (n: number) => VOISINS.includes(n)?'Voisins':TIERS.includes(n)?'Tiers':ORPHELINS.includes(n)?'Orphelins':'Zero';
const wheelDist = (a: number, b: number) => {
  const ia = WHEEL.indexOf(a), ib = WHEEL.indexOf(b);
  if (ia < 0 || ib < 0) return 99;
  const d = Math.abs(ia - ib); return Math.min(d, 37 - d);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
    if (!DEEPSEEK_API_KEY) {
      return new Response(JSON.stringify({ error: "DEEPSEEK_API_KEY não configurada" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { numbers, hotNumbers, coldNumbers, colorStats } = await req.json();

    if (!numbers || !Array.isArray(numbers) || numbers.length < 5) {
      return new Response(JSON.stringify({ error: "Mínimo de 5 números necessários" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══════════════════════════════════════════════════
    // ANÁLISE ESTATÍSTICA LOCAL (pré-processada para a IA)
    // ═══════════════════════════════════════════════════
    const last10 = numbers.slice(0, 10);
    const last30 = numbers.slice(0, 30);
    const last50 = numbers.slice(0, Math.min(50, numbers.length));

    // Frequências
    const freq: Record<number, number> = {};
    numbers.forEach((n: number) => { freq[n] = (freq[n] || 0) + 1; });

    // Terminais
    const termFreq: Record<number, number> = {};
    numbers.forEach((n: number) => { const t = n % 10; termFreq[t] = (termFreq[t] || 0) + 1; });
    const hotTerminals = Object.entries(termFreq).sort(([,a],[,b]) => b - a).slice(0, 3);

    // Setores
    const sectorFreq: Record<string, number> = { Voisins: 0, Tiers: 0, Orphelins: 0, Zero: 0 };
    numbers.forEach((n: number) => { sectorFreq[getSector(n)]++; });

    // Puxadas do último número
    const lastNum = numbers[0];
    const pulled = PULL_MAP[lastNum] || [];
    
    // Validar puxadas no histórico
    let pullHits = 0, pullTotal = 0;
    for (let i = 0; i < Math.min(80, numbers.length) - 4; i++) {
      const src = numbers[i + 1];
      const puxados = PULL_MAP[src] || [];
      if (puxados.length > 0) {
        pullTotal++;
        const next4 = numbers.slice(Math.max(0, i - 3), i + 1);
        if (next4.some((n: number) => puxados.includes(n))) pullHits++;
      }
    }
    const pullRate = pullTotal > 0 ? Math.round((pullHits / pullTotal) * 100) : 0;

    // Cadeia de puxadas (3 últimos números)
    const chain0 = new Set(PULL_MAP[numbers[0]] || []);
    const chain1 = new Set(PULL_MAP[numbers[1]] || []);
    const chain2 = new Set(PULL_MAP[numbers[2]] || []);
    const doubleIntersect = [...chain0].filter(n => chain1.has(n));
    const tripleIntersect = [...chain0].filter(n => chain1.has(n) && chain2.has(n));

    // Arco do dealer (distância no cilindro entre consecutivos)
    const arcs: number[] = [];
    for (let i = 0; i < Math.min(20, numbers.length - 1); i++) {
      arcs.push(wheelDist(numbers[i], numbers[i + 1]));
    }
    const avgArc = arcs.length > 0 ? (arcs.reduce((a, b) => a + b, 0) / arcs.length).toFixed(1) : 'N/A';
    const arcStd = arcs.length > 2 ? Math.sqrt(arcs.map(a => Math.pow(a - parseFloat(avgArc), 2)).reduce((a, b) => a + b) / arcs.length).toFixed(1) : 'N/A';
    const dealerType = parseFloat(arcStd as string) < 3 ? 'MECÂNICO (previsível)' : parseFloat(arcStd as string) < 6 ? 'SEMI-REGULAR' : 'CAÓTICO';

    // Streaks
    let colorStreak = 1;
    for (let i = 1; i < numbers.length; i++) {
      if (getColor(numbers[i]) === getColor(numbers[0]) && getColor(numbers[0]) !== 'green') colorStreak++;
      else break;
    }

    // Lei do Terço (37 giros)
    const last37 = numbers.slice(0, Math.min(37, numbers.length));
    const freq37: Record<number, number> = {};
    last37.forEach((n: number) => { freq37[n] = (freq37[n] || 0) + 1; });
    const absent37 = Array.from({ length: 37 }, (_, i) => i).filter(n => !freq37[n]);
    const repeated37 = Array.from({ length: 37 }, (_, i) => i).filter(n => (freq37[n] || 0) >= 2);

    // Dúzias e Colunas
    const dozenFreq = [0, 0, 0];
    const colFreq = [0, 0, 0];
    last30.forEach((n: number) => {
      if (n >= 1 && n <= 12) dozenFreq[0]++;
      else if (n >= 13 && n <= 24) dozenFreq[1]++;
      else if (n >= 25 && n <= 36) dozenFreq[2]++;
      if (COL1.includes(n)) colFreq[0]++;
      else if (COL2.includes(n)) colFreq[1]++;
      else if (COL3.includes(n)) colFreq[2]++;
    });

    // Auto-repetição
    let autoRepCount = 0;
    for (let i = 0; i < Math.min(5, numbers.length - 1); i++) {
      if (numbers[i] === numbers[i + 1]) autoRepCount++;
    }

    // Matriz de transição simplificada para os últimos 100
    const transMatrix: Record<number, Record<number, number>> = {};
    for (let i = 0; i < Math.min(100, numbers.length) - 1; i++) {
      const src = numbers[i + 1], tgt = numbers[i];
      if (!transMatrix[src]) transMatrix[src] = {};
      transMatrix[src][tgt] = (transMatrix[src][tgt] || 0) + 1;
    }
    const matRow = transMatrix[lastNum] || {};
    const matTotal = Object.values(matRow).reduce((a, b) => a + b, 0);
    const topTransitions = Object.entries(matRow)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([n, c]) => `${n}(${Math.round((c / Math.max(1, matTotal)) * 100)}%)`)
      .join(', ');

    // Fetch prediction history for feedback
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: predHistory } = await supabase
      .from('prediction_history')
      .select('strategy_type, predicted_numbers, hit, hit_type, actual_number')
      .not('hit', 'is', null)
      .order('created_at', { ascending: false })
      .limit(25);

    const recentPreds = (predHistory || []).slice(0, 15);
    const feedbackStr = recentPreds.length > 0
      ? recentPreds.map((p: any) => 
          `${p.hit ? '✅' : '❌'} ${p.strategy_type}: previu [${(p.predicted_numbers||[]).slice(0,3).join(',')}] → saiu ${p.actual_number} ${p.hit_type === 'exact' ? '(EXATO!)' : ''}`
        ).join('\n')
      : 'Sem histórico de previsões ainda';

    const totalPreds = recentPreds.length;
    const totalHits = recentPreds.filter((p: any) => p.hit).length;
    const winRate = totalPreds > 0 ? Math.round((totalHits / totalPreds) * 100) : 0;

    // ═══════════════════════════════════════════════════
    // SYSTEM PROMPT — MOTOR DE ANÁLISE PROFUNDA
    // ═══════════════════════════════════════════════════
    const systemPrompt = `Você é o MOTOR DE CONVERGÊNCIA PENTACENTESIMAL para roleta europeia.
Você analisa dados REAIS da mesa e retorna JOGADAS ESPECÍFICAS com raciocínio profundo.

═══ CONHECIMENTO OBRIGATÓRIO ═══

CILINDRO EUROPEU (sequência física):
0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26

SETORES:
- Voisins du Zéro (17 números): 22,18,29,7,28,12,35,3,26,0,32,15,19,4,21,2,25
- Tiers du Cylindre (12 números): 27,13,36,11,30,8,23,10,5,24,16,33  
- Orphelins (8 números): 1,20,14,31,9,17,34,6
- Jeu Zéro (7 números): 12,35,3,26,0,32,15

CAVALOS (Método Dani Green):
- Cavalos 258: [2,5,8,12,15,18,22,25,28,32,35] — maior frequência em repetição
- Cavalos 147: [1,4,7,11,14,17,21,24,27,31,34]
- Cavalos 03: [0,3,10,13,20,23,30,33]
- Cavalos 69: [6,9,16,19,26,29,36]

TERMINAIS (agrupamento por último dígito):
T0:[0,10,20,30] T1:[1,11,21,31] T2:[2,12,22,32] T3:[3,13,23,33]
T4:[4,14,24,34] T5:[5,15,25,35] T6:[6,16,26,36] T7:[7,17,27]
T8:[8,18,28] T9:[9,19,29]

LEIS FUNDAMENTAIS:
1. Lei do Terço: Em 37 giros, ~24 números únicos aparecem e ~13 ficam ausentes. Os ausentes são candidatos.
2. Auto-Repetição: Número que acabou de sair tem chance elevada de repetir em 1-3 giros (fenômeno mecânico).
3. Puxadas: Cada número tem correlação empírica com outros (tabela mestra da comunidade brasileira).
4. Assinatura do Dealer: Arco mecânico com desvio < 3 casas = dealer previsível → confiar em setores.
5. Complementar: N + (37-N) = 37. Quando N sai, 37-N frequentemente aparece em até 5 giros.
6. Espelho: Inversão de dígitos (ex: 13→31, 24→42 se existisse, 12→21).

TABELA DE PUXADAS (Mesa Brasileira Playtech):
${Object.entries(PULL_MAP).map(([k, v]) => `${k}→[${v.join(',')}]`).join('\n')}

═══ METODOLOGIA DE ANÁLISE ═══

1. ANALISAR o histórico completo (frequências, terminais, setores, arco do dealer)
2. VERIFICAR o feedback das previsões anteriores (se acertou, reforçar; se errou, mudar)
3. CRUZAR múltiplas dimensões: puxada + terminal + setor + dívida + dealer + matriz
4. ATRIBUIR confiança proporcional ao número de indicadores convergentes
5. EVIDENCIAR cada sugestão com dados concretos (não intuição)
6. DECIDIR a jogada mais segura com base no cruzamento

═══ FORMATO DE RESPOSTA ═══
Retorne EXCLUSIVAMENTE JSON válido:
{
  "patterns": [{ "name": "...", "description": "...", "confidence": 0.0-1.0 }],
  "suggestions": [{ "bet": "tipo ESPECÍFICO (ex: Cavalos 258, Coluna 2, Terminal 5, Setor Voisins, Pleno 17)", "reason": "motivo com dados", "risk": "baixo|médio|alto", "numbers": [lista de números da aposta] }],
  "alerts": [{ "message": "...", "severity": "info|warning|critical" }],
  "summary": "resumo em 2-3 frases com a jogada principal"
}

REGRAS:
- Sugira jogadas ESPECÍFICAS com números concretos
- NUNCA sugira "apostar em vermelho" sem explicar por que e quais números
- Se o dealer é mecânico, priorize vizinhos no cilindro
- Se há terminal dominante, sugira o grupo DG correspondente
- Se há puxada tripla, ela é o sinal mais forte
- Se o win rate está abaixo de 25%, mude completamente a abordagem
- Máximo 3 sugestões, ordenadas por confiança`;

    // ═══════════════════════════════════════════════════
    // USER PROMPT — DADOS DA SESSÃO
    // ═══════════════════════════════════════════════════
    const userPrompt = `═══ DADOS DA SESSÃO (${numbers.length} giros) ═══

ÚLTIMOS 50 NÚMEROS (mais recente primeiro):
${last50.join(', ')}

ÚLTIMO NÚMERO: ${lastNum} (${getColor(lastNum)}) — Setor: ${getSector(lastNum)}

═══ ANÁLISE ESTATÍSTICA ═══

FREQUÊNCIAS TOP 10: ${hotNumbers?.map((h: any) => `${h.number}(${h.freq}x)`).join(', ') || 'N/A'}
NÚMEROS FRIOS: ${coldNumbers?.map((h: any) => `${h.number}(${h.freq}x)`).join(', ') || 'N/A'}

TERMINAIS (últimos ${numbers.length} giros): ${hotTerminals.map(([t, c]) => `T${t}:${c}x`).join(', ')}

SETORES: ${Object.entries(sectorFreq).map(([s, c]) => `${s}:${c}`).join(', ')}

CORES: Vermelho ${colorStats?.red || 0} | Preto ${colorStats?.black || 0} | Verde ${colorStats?.green || 0}
${colorStreak >= 3 ? `⚠️ STREAK: ${colorStreak}x ${getColor(numbers[0])} consecutivos` : ''}

DÚZIAS (30 giros): D1=${dozenFreq[0]} D2=${dozenFreq[1]} D3=${dozenFreq[2]}
COLUNAS (30 giros): C1=${colFreq[0]} C2=${colFreq[1]} C3=${colFreq[2]}

═══ FÍSICA DO CILINDRO ═══

ARCO MÉDIO: ${avgArc} casas | Desvio: ${arcStd} | Tipo: ${dealerType}
${autoRepCount > 0 ? `🔁 AUTO-REPETIÇÃO: ${autoRepCount}x nos últimos 5 giros` : ''}

═══ PUXADAS ═══

ÚLTIMO (${lastNum}) PUXA: [${pulled.slice(0, 8).join(', ')}]
TAXA DE ACERTO DAS PUXADAS: ${pullRate}% (${pullTotal} observações)
${doubleIntersect.length > 0 ? `🔗 DOUBLE PULL (${numbers[1]}→${numbers[0]}): [${doubleIntersect.join(',')}]` : ''}
${tripleIntersect.length > 0 ? `🔱 TRIPLE PULL (${numbers[2]}→${numbers[1]}→${numbers[0]}): [${tripleIntersect.join(',')}]` : ''}

═══ MATRIZ DE TRANSIÇÃO ═══

Após ${lastNum}, historicamente: ${topTransitions || 'dados insuficientes'}

═══ LEI DO TERÇO (últimos 37 giros) ═══

Ausentes (${absent37.length}): [${absent37.slice(0, 15).join(',')}]
Repetidos (${repeated37.length}): [${repeated37.slice(0, 10).join(',')}]

═══ FEEDBACK DAS PREVISÕES ═══

Win Rate Atual: ${winRate}% (${totalHits}/${totalPreds})
${feedbackStr}

${winRate < 25 && totalPreds > 5 ? '⚠️ WIN RATE BAIXO — mude completamente a abordagem. Descarte padrões antigos.' : ''}
${winRate > 40 && totalPreds > 5 ? '✅ WIN RATE BOM — reforce os padrões que estão acertando.' : ''}

Analise TODOS os dados acima e forneça a MELHOR jogada possível para o próximo giro.`;

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("DeepSeek API error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit. Aguarde alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Saldo insuficiente na conta DeepSeek." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: `Erro na API DeepSeek: ${response.status}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(JSON.stringify({ error: "Resposta vazia da IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let analysis;
    try {
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      analysis = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse DeepSeek response:", content);
      analysis = {
        patterns: [],
        suggestions: [],
        alerts: [],
        summary: content,
      };
    }

    return new Response(JSON.stringify({ 
      analysis, 
      model: "deepseek-chat",
      context: {
        dealerType,
        avgArc,
        pullRate,
        winRate,
        hotTerminals: hotTerminals.map(([t]) => `T${t}`),
        dominantSector: Object.entries(sectorFreq).sort(([,a],[,b]) => b - a)[0]?.[0],
      }
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("analyze-roulette error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
