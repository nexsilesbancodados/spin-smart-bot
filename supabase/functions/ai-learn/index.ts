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
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch last 24 hours of stored numbers
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

    // 2. Load previous learned knowledge for context
    const { data: prevKnowledge } = await supabase
      .from('ai_learned_patterns')
      .select('learning_type, title, knowledge, accuracy')
      .order('updated_at', { ascending: false })
      .limit(10);

    const prevKnowledgeStr = (prevKnowledge || [])
      .map((k: any) => `[${k.learning_type}] ${k.title}: ${k.knowledge} (precisão: ${k.accuracy}%)`)
      .join('\n');

    // 3. Build comprehensive stats
    const RED = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
    const CAVALOS = [2,5,8,12,15,18,22,25,28,32,35];
    
    const freqMap: Record<number, number> = {};
    const termMap: Record<number, number> = {};
    const colorMap = { red: 0, black: 0, green: 0 };
    const dozenMap = [0, 0, 0];
    const colMap = [0, 0, 0];
    let parCount = 0, imparCount = 0;
    const cavalosCount = numbers.filter(n => CAVALOS.includes(n)).length;
    
    numbers.forEach(n => {
      freqMap[n] = (freqMap[n] || 0) + 1;
      termMap[n % 10] = (termMap[n % 10] || 0) + 1;
      if (n === 0) colorMap.green++;
      else if (RED.includes(n)) colorMap.red++;
      else colorMap.black++;
      if (n >= 1 && n <= 12) dozenMap[0]++;
      else if (n >= 13 && n <= 24) dozenMap[1]++;
      else if (n >= 25 && n <= 36) dozenMap[2]++;
      if (n > 0) { if (n % 2 === 0) parCount++; else imparCount++; }
      if (n > 0 && n <= 36) colMap[(n - 1) % 3]++;
    });

    const sortedFreq = Object.entries(freqMap).sort(([,a],[,b]) => b - a);
    const top10 = sortedFreq.slice(0, 10).map(([n, f]) => `${n}(${f}x)`).join(', ');
    const bottom10 = sortedFreq.slice(-10).map(([n, f]) => `${n}(${f}x)`).join(', ');
    const termStr = Object.entries(termMap).sort(([,a],[,b]) => b - a).map(([t,f]) => `T${t}:${f}x`).join(', ');

    // Detect streaks
    let maxRedStreak = 0, maxBlackStreak = 0, curStreak = 0, curColor = '';
    numbers.forEach(n => {
      const c = n === 0 ? 'green' : RED.includes(n) ? 'red' : 'black';
      if (c === curColor) { curStreak++; }
      else { curStreak = 1; curColor = c; }
      if (c === 'red' && curStreak > maxRedStreak) maxRedStreak = curStreak;
      if (c === 'black' && curStreak > maxBlackStreak) maxBlackStreak = curStreak;
    });

    // Hourly distribution
    const hourMap: Record<number, number> = {};
    (recentData || []).forEach((r: any) => {
      const h = new Date(r.fetched_at).getHours();
      hourMap[h] = (hourMap[h] || 0) + 1;
    });

    const prompt = `Você é um sistema de IA especialista em análise estatística de roleta. Sua missão é APRENDER continuamente analisando dados das últimas 24 horas.

## DADOS ANALISADOS (${numbers.length} números das últimas 24h)

Últimos 30 números: ${numbers.slice(0, 30).join(', ')}

### Estatísticas Completas:
- Top 10 mais frequentes: ${top10}
- Top 10 menos frequentes: ${bottom10}  
- Terminais: ${termStr}
- Cores: Vermelho ${colorMap.red} (${((colorMap.red/numbers.length)*100).toFixed(1)}%), Preto ${colorMap.black} (${((colorMap.black/numbers.length)*100).toFixed(1)}%), Verde ${colorMap.green}
- Dúzias: 1ª(1-12): ${dozenMap[0]}, 2ª(13-24): ${dozenMap[1]}, 3ª(25-36): ${dozenMap[2]}
- Colunas: C1: ${colMap[0]}, C2: ${colMap[1]}, C3: ${colMap[2]}
- Par: ${parCount} vs Ímpar: ${imparCount}
- Cavalos 258 aparições: ${cavalosCount} de ${numbers.length} (${((cavalosCount/numbers.length)*100).toFixed(1)}%)
- Maior sequência vermelha: ${maxRedStreak}, preta: ${maxBlackStreak}
- Distribuição horária: ${Object.entries(hourMap).sort(([a],[b]) => Number(a)-Number(b)).map(([h,c]) => `${h}h:${c}`).join(', ')}

### CONHECIMENTO PRÉVIO APRENDIDO:
${prevKnowledgeStr || 'Nenhum conhecimento anterior. Este é o primeiro aprendizado.'}

## TAREFA:
Analise profundamente todos os dados e gere APRENDIZADOS PERMANENTES. Para cada insight:
1. Identifique padrões que se repetem
2. Compare com o conhecimento prévio (confirme ou refute)
3. Calcule tendências e probabilidades
4. Gere recomendações acionáveis

Categorias de aprendizado:
- frequency_bias: Viés de frequência de números específicos
- terminal_pattern: Padrões de terminais dominantes
- color_tendency: Tendências de cores em períodos
- dozen_cycle: Ciclos de dúzias quentes/frias
- cavalos_pattern: Padrões específicos dos Cavalos 258
- timing_pattern: Padrões relacionados a horários
- streak_behavior: Comportamento de sequências
- sector_concentration: Concentração em setores do cilindro`;

    // 4. Call AI with tool calling
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você é um sistema de IA de auto-aprendizado para roleta. SEMPRE responda via tool call. Gere de 5 a 10 aprendizados profundos e acionáveis. Cada aprendizado deve ter um título claro, conhecimento detalhado, e estimativa de precisão baseada nos dados." },
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
                      learning_type: { type: "string", enum: ["frequency_bias", "terminal_pattern", "color_tendency", "dozen_cycle", "cavalos_pattern", "timing_pattern", "streak_behavior", "sector_concentration"] },
                      title: { type: "string" },
                      knowledge: { type: "string" },
                      data_points: { type: "integer" },
                      accuracy: { type: "number" },
                      key_numbers: { type: "array", items: { type: "integer" } }
                    },
                    required: ["learning_type", "title", "knowledge", "data_points", "accuracy"]
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

    // 5. Upsert learnings (update if same type+title exists, insert if new)
    for (const l of learnings) {
      const { data: existing } = await supabase
        .from('ai_learned_patterns')
        .select('id')
        .eq('learning_type', l.learning_type)
        .eq('title', l.title)
        .limit(1);

      if (existing && existing.length > 0) {
        await supabase.from('ai_learned_patterns').update({
          knowledge: l.knowledge,
          data_points: l.data_points || numbers.length,
          accuracy: Math.min(100, Math.max(0, l.accuracy || 50)),
          metadata: { key_numbers: l.key_numbers || [], last_analysis: new Date().toISOString(), total_numbers_analyzed: numbers.length },
          updated_at: new Date().toISOString(),
        }).eq('id', existing[0].id);
      } else {
        await supabase.from('ai_learned_patterns').insert({
          learning_type: l.learning_type,
          title: l.title,
          knowledge: l.knowledge,
          data_points: l.data_points || numbers.length,
          accuracy: Math.min(100, Math.max(0, l.accuracy || 50)),
          metadata: { key_numbers: l.key_numbers || [], last_analysis: new Date().toISOString(), total_numbers_analyzed: numbers.length },
        });
      }
    }

    // 6. Also run quick pattern detection for pattern_insights
    const patternRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "Analise os números recentes e retorne padrões rápidos via tool call. Máximo 5 padrões." },
          { role: "user", content: `Últimos 50 números: ${numbers.slice(0, 50).join(', ')}. Terminais: ${termStr}. Cores: V${colorMap.red} P${colorMap.black}. Cavalos258: ${cavalosCount}/${numbers.length}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "store_patterns",
            description: "Store quick patterns",
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
                    required: ["pattern_type", "description", "confidence", "recommendation"]
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
      const pToolCall = pData.choices?.[0]?.message?.tool_calls?.[0];
      if (pToolCall?.function?.arguments) {
        const parsed = JSON.parse(pToolCall.function.arguments);
        const patterns = (parsed.patterns || []).map((p: any) => ({
          pattern_type: p.pattern_type,
          description: p.description,
          confidence: Math.min(100, Math.max(0, p.confidence)),
          numbers_involved: p.numbers_involved || [],
          recommendation: p.recommendation || "",
          source_data: { total_analyzed: numbers.length },
        }));
        if (patterns.length > 0) {
          await supabase.from('pattern_insights').insert(patterns);
        }
      }
    }

    // 7. Cleanup old pattern_insights (keep last 500)
    const { data: oldInsights } = await supabase
      .from('pattern_insights')
      .select('id')
      .order('created_at', { ascending: false })
      .range(500, 999);
    if (oldInsights && oldInsights.length > 0) {
      await supabase.from('pattern_insights').delete().in('id', oldInsights.map((r: any) => r.id));
    }

    return new Response(JSON.stringify({
      status: "success",
      learnings_stored: learnings.length,
      numbers_analyzed: numbers.length,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("ai-learn error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
