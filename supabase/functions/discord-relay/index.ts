// @ts-nocheck — Deno edge function
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RATE_LIMIT_PER_IP_PER_HOUR = 60;
const rateBuckets = new Map<string, { count: number; windowStart: number }>();

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

interface RelayRequest {
  task: "master-signal" | "test";
  candidate?: {
    targetLabel?: string;
    targetType?: string;
    prob?: number;
    payout?: number;
    coverage?: number;
    lift?: number;
    baseline?: number;
    confidence?: number;
    strictValid?: boolean;
    numbers?: number[];
  };
  context?: {
    spinsSeen?: number;
    validatedCount?: number;
  };
}

const buildDiscordPayload = (req: RelayRequest) => {
  if (req.task === "test") {
    return {
      content:
        "🧪 Teste do Roleta Vision via Supabase relay — webhook funcionando.",
    };
  }
  const c = req.candidate ?? {};
  const ctx = req.context ?? {};
  const label = c.targetLabel || "Sinal";
  const type = c.targetType || "geral";
  const prob = c.prob ?? 0;
  const payout = c.payout ?? 0;
  const coverage = c.coverage ?? 0;
  const lift = c.lift ?? 0;
  const baseline = c.baseline ?? 0;
  const confidence = c.confidence ?? 0;
  const numbers = c.numbers ?? [];
  const headBalls =
    numbers.slice(0, 10).join(", ") + (numbers.length > 10 ? "…" : "");
  return {
    embeds: [
      {
        title: `🎯 ${label}`,
        description:
          `**Chance combinada:** ${(prob * 100).toFixed(1)}%\n` +
          `**Paga:** ${payout.toFixed(1)}:1 · cobre ${coverage} nº\n` +
          `**Lift:** ${lift.toFixed(2)}× o acaso (${(baseline * 100).toFixed(1)}%)\n` +
          `**Confiança:** ${(confidence * 100).toFixed(0)}%`,
        color: c.strictValid ? 5763719 : 15844367,
        fields: [
          { name: "Tipo", value: type, inline: true },
          {
            name: "Validação",
            value: c.strictValid ? "✓ Estrito" : "○ Parcial",
            inline: true,
          },
          { name: "Cobertura", value: headBalls || "—", inline: false },
          {
            name: "Contexto",
            value: `${ctx.spinsSeen ?? 0} giros · ${ctx.validatedCount ?? 0} sinais validados no banco`,
            inline: false,
          },
        ],
        timestamp: new Date().toISOString(),
        footer: { text: "Roleta Vision · sinal automático · casa retém 2,7%" },
      },
    ],
  };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const discordUrl = Deno.env.get("DISCORD_WEBHOOK_URL");
    if (!discordUrl) {
      return new Response(
        JSON.stringify({
          error: "DISCORD_WEBHOOK_URL not configured in server secrets",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const ip =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";

    if (!checkRateLimit(ip)) {
      return new Response(
        JSON.stringify({ error: "rate-limit" }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const body = (await req.json()) as RelayRequest;
    if (!body || !body.task) {
      return new Response(JSON.stringify({ error: "missing-task" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = buildDiscordPayload(body);
    const discordRes = await fetch(discordUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!discordRes.ok) {
      const text = await discordRes.text().catch(() => "");
      return new Response(
        JSON.stringify({
          error: "discord-error",
          status: discordRes.status,
          detail: text.slice(0, 300),
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, sent_at: Date.now() }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: "server-error",
        message: (err as Error).message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
