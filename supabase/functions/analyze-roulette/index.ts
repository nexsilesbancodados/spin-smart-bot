import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
    if (!DEEPSEEK_API_KEY) {
      return new Response(JSON.stringify({ error: "DEEPSEEK_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { numbers, hotNumbers, coldNumbers, colorStats } = await req.json();

    if (!numbers || !Array.isArray(numbers) || numbers.length < 5) {
      return new Response(JSON.stringify({ error: "Mínimo de 5 números necessários para análise" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Você é o MOTOR DE CONVERGÊNCIA PENTACENTESIMAL para roleta europeia.

CONHECIMENTO OBRIGATÓRIO:
- Cilindro: 0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26
- Voisins(17): 22,18,29,7,28,12,35,3,26,0,32,15,19,4,21,2,25
- Tiers(12): 27,13,36,11,30,8,23,10,5,24,16,33
- Orphelins(8): 1,20,14,31,9,17,34,6
- Cavalos 258: [2,5,8,12,15,18,22,25,28,32,35] — maior frequência em repetição
- Cavalos 147: [1,4,7,11,14,17,21,24,27,31,34]
- Cavalos 03: [0,3,10,13,20,23,30,33]
- Cavalos 69: [6,9,16,19,26,29,36]
- Colunas: C1[1,4,7,10,13,16,19,22,25,28,31,34] C2[2,5,8,11,14,17,20,23,26,29,32,35] C3[3,6,9,12,15,18,21,24,27,30,33,36]
- Lei do Terço: 24/37 únicos em 37 giros, 13 ausentes = candidatos reincidência
- Assinatura Dealer: Arco mecânico, variação < 3 casas = "mão viciada"

Retorne EXCLUSIVAMENTE JSON válido:
{
  "patterns": [{ "name": "...", "description": "...", "confidence": 0.0-1.0 }],
  "suggestions": [{ "bet": "tipo ESPECÍFICO (ex: Cavalos 258, Coluna 2, Terminais 5, Setor Voisins, Pleno 17)", "reason": "motivo", "risk": "baixo|médio|alto" }],
  "alerts": [{ "message": "...", "severity": "info|warning|critical" }],
  "summary": "resumo em 2-3 frases"
}
Sugira jogadas ESPECÍFICAS: Cavalos, Colunas, Terminais, Setores, Dúzias. Não apostas genéricas.`;

    const userPrompt = `Dados da sessão de roleta:

Últimos ${numbers.length} números (mais recente primeiro): ${numbers.join(', ')}

Números quentes (mais frequentes): ${hotNumbers?.map((h: any) => `${h.number}(${h.freq}x)`).join(', ') || 'N/A'}
Números frios (menos frequentes): ${coldNumbers?.map((h: any) => `${h.number}(${h.freq}x)`).join(', ') || 'N/A'}

Distribuição de cores: Vermelho ${colorStats?.red || 0} | Preto ${colorStats?.black || 0} | Verde ${colorStats?.green || 0}

Analise os padrões e forneça insights estratégicos.`;

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
        temperature: 0.3,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("DeepSeek API error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit atingido. Aguarde alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Saldo insuficiente na conta DeepSeek." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: `Erro na API DeepSeek: ${response.status}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(JSON.stringify({ error: "Resposta vazia da IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse the JSON response from DeepSeek
    let analysis;
    try {
      // Remove potential markdown code blocks
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

    return new Response(JSON.stringify({ analysis, model: "deepseek-chat" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("analyze-roulette error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
