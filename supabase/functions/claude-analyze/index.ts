// @ts-nocheck — Deno edge function
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MAX_OUTPUT_TOKENS = 600;
const MAX_INPUT_CHARS = 16000;
const RATE_LIMIT_PER_IP_PER_HOUR = 30;
const CLAUDE_MODEL = "claude-haiku-4-5-20251001";

const rateBuckets = new Map<string, { count: number; windowStart: number }>();
const responseCache = new Map<string, { result: any; t: number }>();
const CACHE_TTL_MS = 1000 * 60 * 10;

interface AnalyzeRequest {
  task:
    | "session-report"
    | "family-meta"
    | "critic"
    | "tilt-detect"
    | "pattern-explain";
  context: Record<string, unknown>;
}

const buildPrompt = (req: AnalyzeRequest): { system: string; user: string } => {
  const ctxJson = JSON.stringify(req.context).slice(0, MAX_INPUT_CHARS);
  const baseSystem =
    "Você é um analista honesto de roleta. A casa retém 2,7% por giro — você sabe que nenhum padrão derrota isso a longo prazo. Sua função é descrever, contextualizar, alertar sobre vieses cognitivos e enquadrar resultados em termos estatísticos. NUNCA prometa acertos, nunca diga 'esse padrão tem 80% de chance', nunca incentive apostar mais. Responda em português brasileiro, máximo 4 parágrafos curtos, tom direto e técnico.";

  switch (req.task) {
    case "session-report":
      return {
        system: baseSystem,
        user: `Analise esta sessão de roleta e escreva um relatório curto (3-4 parágrafos) cobrindo: 1) PnL observado vs PnL esperado pela edge da casa, 2) padrões que dominaram, 3) qualidade da calibração, 4) sugestão honesta pra próxima sessão. Dados:\n\n${ctxJson}`,
      };
    case "family-meta":
      return {
        system: baseSystem,
        user: `Esta é a tabela de famílias de padrões com suas estatísticas (hits, attempts, baseline). Identifique: 1) famílias com Wilson > baseline + ≥30 amostras (manter), 2) famílias no ruído branco (desligar), 3) famílias ainda imaturas. Seja específico nos nomes das famílias. Dados:\n\n${ctxJson}`,
      };
    case "critic":
      return {
        system: baseSystem,
        user: `Adote papel de crítico adversarial. Esse sinal está prestes a ser emitido. Encontre 2-3 razões pra NÃO apostar (sample size, cooldown, viés de recência, etc). Se realmente não houver razão pra evitar, diga. Dados:\n\n${ctxJson}`,
      };
    case "tilt-detect":
      return {
        system: baseSystem,
        user: `Analise as últimas N apostas reais do usuário. Detecte sinais de tilt (escalada de stake após perdas, aposta-recuperação, frequência crescente). Se houver tilt, sugira pausa concreta. Se não, confirme que o ritmo está sob controle. Dados:\n\n${ctxJson}`,
      };
    case "pattern-explain":
      return {
        system: baseSystem,
        user: `Explique em linguagem clara o que essa regra de padrão faz, qual a baseline aleatória, qual o sample size atual, e se vale ou não dar peso ao Wilson lower bound dela. Dados:\n\n${ctxJson}`,
      };
    default:
      return {
        system: baseSystem,
        user: `Analise os dados a seguir e devolva um sumário curto. Dados:\n\n${ctxJson}`,
      };
  }
};

const hashKey = async (s: string): Promise<string> => {
  const buf = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const checkRateLimit = (ip: string): boolean => {
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || now - bucket.windowStart > 3600 * 1000) {
    rateBuckets.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (bucket.count >= RATE_LIMIT_PER_IP_PER_HOUR) return false;
  bucket.count += 1;
  return true;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY not configured in server secrets" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ip =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";

    if (!checkRateLimit(ip)) {
      return new Response(
        JSON.stringify({ error: "rate-limit", message: "Limite por hora atingido" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = (await req.json()) as AnalyzeRequest;
    if (!body || !body.task) {
      return new Response(JSON.stringify({ error: "missing-task" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = buildPrompt(body);
    const cacheKey = await hashKey(prompt.system + "|" + prompt.user);
    const cached = responseCache.get(cacheKey);
    if (cached && Date.now() - cached.t < CACHE_TTL_MS) {
      return new Response(
        JSON.stringify({ ...cached.result, cached: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: prompt.system,
        messages: [{ role: "user", content: prompt.user }],
      }),
    });

    if (!claudeResponse.ok) {
      const errText = await claudeResponse.text();
      return new Response(
        JSON.stringify({ error: "claude-error", status: claudeResponse.status, detail: errText.slice(0, 500) }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await claudeResponse.json();
    const text =
      data?.content?.find?.((b: any) => b.type === "text")?.text ??
      data?.content?.[0]?.text ??
      "";

    const result = {
      text,
      model: CLAUDE_MODEL,
      task: body.task,
      input_tokens: data?.usage?.input_tokens ?? 0,
      output_tokens: data?.usage?.output_tokens ?? 0,
    };

    responseCache.set(cacheKey, { result, t: Date.now() });
    if (responseCache.size > 200) {
      const oldest = Array.from(responseCache.entries()).sort((a, b) => a[1].t - b[1].t)[0];
      if (oldest) responseCache.delete(oldest[0]);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "server-error", message: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
