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
    lastSpin?: number | null;
    recentHits?: number;
    recentMisses?: number;
    recentTotal?: number;
  };
}

const RED_SET = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const colorOfNum = (n: number): "🔴" | "⚫" | "🟢" =>
  n === 0 ? "🟢" : RED_SET.has(n) ? "🔴" : "⚫";

const ALLOWED_TYPES = new Set(["color", "dozen", "parity"]);

const buildDiscordPayload = (req: RelayRequest): unknown | null => {
  if (req.task === "test") {
    return {
      content: "🧪 Teste do Roleta Vision — webhook OK.",
    };
  }
  const c = req.candidate ?? {};
  const ctx = req.context ?? {};
  const type = (c.targetType || "").toLowerCase();
  if (!ALLOWED_TYPES.has(type)) return null;
  const label = c.targetLabel || "Sinal";
  const prob = c.prob ?? 0;
  const payout = c.payout ?? 0;
  const lastSpin = ctx.lastSpin;
  const lastSpinLine =
    typeof lastSpin === "number"
      ? `\n${colorOfNum(lastSpin)} Último: **${lastSpin}**`
      : "";
  const hits = ctx.recentHits ?? 0;
  const misses = ctx.recentMisses ?? 0;
  const total = ctx.recentTotal ?? hits + misses;
  const hitRate = total > 0 ? (hits / total) * 100 : 0;
  const placarLine =
    total > 0
      ? `\n📊 Placar: **${hits}✓ / ${misses}✗** (${hitRate.toFixed(0)}% acerto · últimos ${total})`
      : "";
  return {
    embeds: [
      {
        title: `🎯 ${label}`,
        description:
          `**${(prob * 100).toFixed(1)}%** de chance · paga **${payout.toFixed(0)}:1**` +
          lastSpinLine +
          placarLine,
        color: c.strictValid ? 5763719 : 15844367,
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
    if (!payload) {
      return new Response(
        JSON.stringify({ ok: true, skipped: "type-not-allowed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
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
