import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const deepseekKey = Deno.env.get("DEEPSEEK_API_KEY");
    
    if (!deepseekKey) throw new Error("DEEPSEEK_API_KEY not configured");

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch latest 100 numbers from the API
    const apiRes = await fetch("https://www.iamonstro.com.br/apicurso/roleta.php");
    const apiData = await apiRes.json();
    const numbers: number[] = (apiData.results || []).slice(0, 100).map(Number).filter((n: number) => !isNaN(n) && n >= 0 && n <= 36);

    if (numbers.length < 20) {
      return new Response(JSON.stringify({ status: "not_enough_data" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Build analysis prompt
    const RED = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
    const getColor = (n: number) => n === 0 ? "verde" : RED.includes(n) ? "vermelho" : "preto";
    
    const numbersStr = numbers.join(", ");
    const colorSeq = numbers.slice(0, 20).map(n => `${n}(${getColor(n)})`).join(", ");
    const terminalFreq: Record<number, number> = {};
    numbers.forEach(n => { const t = n % 10; terminalFreq[t] = (terminalFreq[t] || 0) + 1; });
    const terminalStr = Object.entries(terminalFreq).sort(([,a],[,b]) => b - a).map(([t, f]) => `T${t}:${f}x`).join(", ");

    const prompt = `Analise estes últimos 100 números de roleta e identifique TODOS os padrões estatísticos relevantes.

Números (mais recente primeiro): ${numbersStr}

Sequência de cores (últimos 20): ${colorSeq}

Frequência de terminais: ${terminalStr}

Identifique:
1. Sequências de cores (streaks de vermelho/preto)
2. Terminais dominantes e ausentes
3. Dúzias quentes/frias (1-12, 13-24, 25-36)
4. Colunas com tendência
5. Números que repetiram muito (hot numbers)
6. Números ausentes há muito tempo (cold numbers)
7. Padrões de alternância par/ímpar
8. Setores do cilindro com concentração

Para cada padrão encontrado, retorne um JSON array com objetos contendo:
- pattern_type: tipo do padrão (streak, terminal, dozen, column, hot, cold, parity, sector)
- description: descrição clara em português
- confidence: confiança de 0 a 100
- numbers_involved: array de números relevantes
- recommendation: sugestão de aposta baseada no padrão`;

    // 3. Call DeepSeek AI
    const aiRes = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${deepseekKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        max_tokens: 4000,
        messages: [
          { role: "system", content: `Você é o MOTOR DE CONVERGÊNCIA PENTACENTESIMAL para roleta europeia da Onabet.

CONHECIMENTO OBRIGATÓRIO:
- Cilindro: 0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26
- Voisins(17): 22,18,29,7,28,12,35,3,26,0,32,15,19,4,21,2,25
- Tiers(12): 27,13,36,11,30,8,23,10,5,24,16,33
- Orphelins(8): 1,20,14,31,9,17,34,6
- Cavalos 258: [2,5,8,12,15,18,22,25,28,32,35]
- Cavalos 147: [1,4,7,11,14,17,21,24,27,31,34]
- Cavalos 03: [0,3,10,13,20,23,30,33]
- Cavalos 69: [6,9,16,19,26,29,36]
- Colunas: C1[1,4,7,10,13,16,19,22,25,28,31,34] C2[2,5,8,11,14,17,20,23,26,29,32,35] C3[3,6,9,12,15,18,21,24,27,30,33,36]
- Lei do Terço: Em 37 giros ~24 únicos, ~13 ausentes (candidatos à reincidência)
- Assinatura Dealer: Arco de lançamento mecânico, variação < 3 casas = "mão viciada"

Para cada padrão, inclua JOGADAS ESPECÍFICAS na recommendation (ex: "Aposte Cavalos 258", "Cubra Coluna 2", "Terminais 5", "Setor Voisins", "Pleno no 17 + vizinhos"). Responda APENAS via tool call.` },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "store_patterns",
            description: "Store detected roulette patterns",
            parameters: {
              type: "object",
              properties: {
                patterns: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      pattern_type: { type: "string", enum: ["streak", "terminal", "dozen", "column", "hot", "cold", "parity", "sector"] },
                      description: { type: "string" },
                      confidence: { type: "number" },
                      numbers_involved: { type: "array", items: { type: "integer" } },
                      recommendation: { type: "string" }
                    },
                    required: ["pattern_type", "description", "confidence", "numbers_involved", "recommendation"]
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

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI error:", aiRes.status, errText);
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, try again later" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${aiRes.status}`);
    }

    const aiData = await aiRes.json();
    let patterns: any[] = [];

    // Extract from tool call response
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      patterns = parsed.patterns || [];
    }

    if (patterns.length === 0) {
      return new Response(JSON.stringify({ status: "no_patterns_found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Store patterns permanently in Supabase
    const rows = patterns.map((p: any) => ({
      pattern_type: p.pattern_type,
      description: p.description,
      confidence: Math.min(100, Math.max(0, p.confidence)),
      numbers_involved: p.numbers_involved || [],
      recommendation: p.recommendation || "",
      source_data: { analyzed_numbers: numbers.slice(0, 20), total_analyzed: numbers.length },
    }));

    const { error: insertError } = await supabase.from("pattern_insights").insert(rows);
    if (insertError) {
      console.error("Insert error:", insertError);
      throw new Error(`DB insert failed: ${insertError.message}`);
    }

    // 5. Cleanup: keep only last 500 insights
    const { data: oldData } = await supabase
      .from("pattern_insights")
      .select("id, created_at")
      .order("created_at", { ascending: false })
      .range(500, 999);
    
    if (oldData && oldData.length > 0) {
      const oldIds = oldData.map((r: any) => r.id);
      await supabase.from("pattern_insights").delete().in("id", oldIds);
    }

    return new Response(JSON.stringify({ 
      status: "success", 
      patterns_found: patterns.length,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("auto-analyze error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
