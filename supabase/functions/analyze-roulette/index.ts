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

    const systemPrompt = `Você é um analista profissional de roleta ao vivo. Analise os dados fornecidos e retorne EXCLUSIVAMENTE um JSON válido (sem markdown, sem texto extra) com esta estrutura:
{
  "patterns": [
    { "name": "nome do padrão", "description": "descrição curta", "confidence": 0.0-1.0 }
  ],
  "suggestions": [
    { "bet": "tipo de aposta (ex: Dúzia 2, Vermelho, Número 17)", "reason": "motivo baseado nos dados", "risk": "baixo|médio|alto" }
  ],
  "alerts": [
    { "message": "alerta importante", "severity": "info|warning|critical" }
  ],
  "summary": "resumo estratégico da sessão em 2-3 frases"
}

Regras:
- Baseie-se APENAS nos dados fornecidos, não invente tendências
- Identifique: streaks de cor, ausências de dúzias/colunas, terminais repetidos, setores quentes/frios
- Sugira no máximo 3 apostas com justificativa estatística
- Sempre inclua o nível de risco
- Responda APENAS com JSON, sem explicações adicionais`;

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
