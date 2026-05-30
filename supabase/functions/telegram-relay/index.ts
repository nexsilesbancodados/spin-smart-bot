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
  task: "master-signal" | "master-resolution" | "test";
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
  resolution?: {
    targetLabel?: string;
    targetType?: string;
    actualNumber?: number;
    hit?: boolean;
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
const colorOfNum = (n: number): string => (n === 0 ? "🟢" : RED_SET.has(n) ? "🔴" : "⚫");

const ALLOWED_TYPES = new Set([
  "color",
  "dozen",
  "parity",
  "highlow",
  "column",
  "sector",
]);

const typeEmoji = (type: string, label: string): string => {
  if (type === "dozen") {
    if (label.includes("1ª")) return "1️⃣";
    if (label.includes("2ª")) return "2️⃣";
    if (label.includes("3ª")) return "3️⃣";
    return "🎲";
  }
  if (type === "column") {
    if (label.includes("1ª")) return "🟦";
    if (label.includes("2ª")) return "🟪";
    if (label.includes("3ª")) return "🟩";
    return "📊";
  }
  if (type === "color") {
    if (/vermelho/i.test(label)) return "🔴";
    if (/preto/i.test(label)) return "⚫";
    return "🎨";
  }
  if (type === "parity") {
    if (/par(?!c)/i.test(label) && !/ímpar/i.test(label)) return "♟";
    if (/ímpar|impar/i.test(label)) return "♙";
    return "⚖";
  }
  if (type === "highlow") {
    if (/baixo|1-18|1–18/i.test(label)) return "🔽";
    if (/alto|19-36|19–36/i.test(label)) return "🔼";
    return "↕";
  }
  if (type === "sector") {
    if (/voisins/i.test(label)) return "🟢";
    if (/tiers/i.test(label)) return "🟡";
    if (/orphelins/i.test(label)) return "🟠";
    if (/jeu zero|jeu zéro/i.test(label)) return "0️⃣";
    return "🌀";
  }
  return "🎯";
};

const probBar = (prob: number): string => {
  const filled = Math.round(prob * 10);
  return "█".repeat(filled) + "░".repeat(10 - filled);
};

const buildTelegramMessage = (req: RelayRequest): string | null => {
  if (req.task === "test") {
    return "🧪 Teste do Roleta Vision — webhook do Telegram funcionando.";
  }
  if (req.task === "master-resolution") {
    const r = req.resolution ?? {};
    const type = (r.targetType || "").toLowerCase();
    if (!ALLOWED_TYPES.has(type)) return null;
    const label = r.targetLabel || "Sinal";
    const actual = r.actualNumber ?? 0;
    const hit = !!r.hit;
    const ctx = req.context ?? {};
    const hits = ctx.recentHits ?? 0;
    const misses = ctx.recentMisses ?? 0;
    const total = ctx.recentTotal ?? hits + misses;
    const hitRate = total > 0 ? (hits / total) * 100 : 0;
    const placarLine =
      total > 0
        ? `\n📊 ${hits}✓ / ${misses}✗ · ${hitRate.toFixed(0)}% acerto`
        : "";
    const head = hit ? `✓ ACERTOU — ${label}` : `✗ ERROU — ${label}`;
    return `${head}\n${colorOfNum(actual)} Saiu: ${actual}${placarLine}`;
  }
  const c = req.candidate ?? {};
  const ctx = req.context ?? {};
  const type = (c.targetType || "").toLowerCase();
  if (!ALLOWED_TYPES.has(type)) return null;
  const label = c.targetLabel || "Sinal";
  const prob = c.prob ?? 0;
  const payout = c.payout ?? 0;
  const emoji = typeEmoji(type, label);
  const lastSpin = ctx.lastSpin;
  const lastSpinLine =
    typeof lastSpin === "number"
      ? `\n${colorOfNum(lastSpin)} Último: ${lastSpin}`
      : "";
  const hits = ctx.recentHits ?? 0;
  const misses = ctx.recentMisses ?? 0;
  const total = ctx.recentTotal ?? hits + misses;
  const hitRate = total > 0 ? (hits / total) * 100 : 0;
  const placarLine =
    total > 0
      ? `\n📊 ${hits}✓ / ${misses}✗ · ${hitRate.toFixed(0)}% acerto (últ. ${total})`
      : "";
  return (
    `${emoji} ${label}\n` +
    `${probBar(prob)} ${(prob * 100).toFixed(1)}%\n` +
    `Paga ${payout.toFixed(0)}:1` +
    lastSpinLine +
    placarLine
  );
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const chatId = Deno.env.get("TELEGRAM_CHAT_ID");
    if (!botToken || !chatId) {
      return new Response(
        JSON.stringify({
          error: "TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured in server secrets",
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

    const message = buildTelegramMessage(body);
    if (!message) {
      return new Response(
        JSON.stringify({ ok: true, skipped: "type-not-allowed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    let tgRes: Response | null = null;
    let lastError = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        tgRes = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: message,
            disable_web_page_preview: true,
          }),
        });
        if (tgRes.ok) break;
        if (tgRes.status < 500 && tgRes.status !== 429) break;
        lastError = `HTTP ${tgRes.status}`;
        if (attempt < 2) await new Promise((r) => setTimeout(r, 200 * (attempt + 1) * (attempt + 1)));
      } catch (err) {
        lastError = (err as Error).message;
        if (attempt < 2) await new Promise((r) => setTimeout(r, 200 * (attempt + 1) * (attempt + 1)));
      }
    }

    if (!tgRes || !tgRes.ok) {
      const text = tgRes ? await tgRes.text().catch(() => "") : "";
      return new Response(
        JSON.stringify({
          error: "telegram-error",
          status: tgRes?.status ?? 0,
          detail: (text || lastError).slice(0, 300),
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, sent_at: Date.now() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
