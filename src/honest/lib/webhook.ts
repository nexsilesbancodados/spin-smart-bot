import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SignalRecord } from "./signalAgent";
import type { MasterCandidate } from "./masterSignal";

export interface WebhookConfig {
  enabled: boolean;
  url: string;
  format: "json" | "discord" | "slack";
  minConfidence: number;
  bearerToken?: string;
  lastFiredAt: number | null;
  lastError: string | null;
  totalSent: number;
  totalErrors: number;
}

interface WebhookStore {
  config: WebhookConfig;
  setConfig: (patch: Partial<WebhookConfig>) => void;
  recordFired: (error?: string) => void;
}

const defaults: WebhookConfig = {
  enabled: false,
  url: "",
  format: "json",
  minConfidence: 0.5,
  lastFiredAt: null,
  lastError: null,
  totalSent: 0,
  totalErrors: 0,
};

export const useWebhook = create<WebhookStore>()(
  persist(
    (set) => ({
      config: defaults,
      setConfig: (patch) => set((s) => ({ config: { ...s.config, ...patch } })),
      recordFired: (error) =>
        set((s) => ({
          config: {
            ...s.config,
            lastFiredAt: Date.now(),
            lastError: error ?? null,
            totalSent: error ? s.config.totalSent : s.config.totalSent + 1,
            totalErrors: error ? s.config.totalErrors + 1 : s.config.totalErrors,
          },
        })),
    }),
    { name: "rv-webhook-v1" }
  )
);

const formatPayload = (sig: SignalRecord, format: WebhookConfig["format"]) => {
  if (format === "discord") {
    return {
      content: null,
      embeds: [
        {
          title: `🎯 Sinal: ${sig.mainPick}`,
          description: `**Top 5:** ${sig.topPicks.join(", ")}\n**Probabilidade:** ${(sig.mainProb * 100).toFixed(2)}%\n**Setor:** ${sig.sector}\n**Cor:** ${sig.color}`,
          color: 16753920,
          timestamp: new Date(sig.t).toISOString(),
        },
      ],
    };
  }
  if (format === "slack") {
    return {
      text: `🎯 Sinal: *${sig.mainPick}* (${(sig.mainProb * 100).toFixed(1)}%) · Top 5: ${sig.topPicks.join(", ")} · ${sig.sector}`,
    };
  }
  return {
    type: "signal",
    timestamp: sig.t,
    mainPick: sig.mainPick,
    mainProb: sig.mainProb,
    confidence: sig.confidenceScore,
    topPicks: sig.topPicks,
    topProbs: sig.topProbs,
    sector: sig.sector,
    color: sig.color,
  };
};

const formatMasterPayload = (
  c: MasterCandidate,
  ctx: { spinsSeen: number; validatedCount: number },
  format: WebhookConfig["format"]
) => {
  const headBalls = c.numbers.slice(0, 10).join(", ") + (c.numbers.length > 10 ? "…" : "");
  if (format === "discord") {
    return {
      content: null,
      embeds: [
        {
          title: `🎯 ${c.targetLabel}`,
          description:
            `**Chance combinada:** ${(c.prob * 100).toFixed(1)}%\n` +
            `**Paga:** ${c.payout.toFixed(1)}:1 · cobre ${c.coverage} nº\n` +
            `**Lift:** ${c.lift.toFixed(2)}× o acaso (${(c.baseline * 100).toFixed(1)}%)\n` +
            `**Confiança:** ${(c.confidence * 100).toFixed(0)}%`,
          color: c.strictValid ? 5763719 : 15844367,
          fields: [
            { name: "Tipo", value: c.targetType, inline: true },
            {
              name: "Validação",
              value: c.strictValid ? "✓ Estrito" : "○ Parcial",
              inline: true,
            },
            { name: "Cobertura", value: `${headBalls}`, inline: false },
            {
              name: "Contexto",
              value: `${ctx.spinsSeen} giros · ${ctx.validatedCount} sinais validados no banco`,
              inline: false,
            },
          ],
          timestamp: new Date().toISOString(),
          footer: { text: "Roleta Vision · sinal automático · casa retém 2,7%" },
        },
      ],
    };
  }
  if (format === "slack") {
    return {
      text: `🎯 *${c.targetLabel}* · chance ${(c.prob * 100).toFixed(1)}% · paga ${c.payout.toFixed(1)}:1 · cobre ${c.coverage}nº${c.strictValid ? " ✓ validado" : ""}`,
    };
  }
  return {
    type: "master-signal",
    timestamp: Date.now(),
    target: c.targetLabel,
    targetType: c.targetType,
    prob: c.prob,
    payout: c.payout,
    coverage: c.coverage,
    lift: c.lift,
    confidence: c.confidence,
    strictValid: c.strictValid,
    numbers: c.numbers,
    spinsSeen: ctx.spinsSeen,
    validatedCount: ctx.validatedCount,
  };
};

export const fireMasterWebhook = async (
  candidate: MasterCandidate,
  context: { spinsSeen: number; validatedCount: number }
): Promise<void> => {
  const { config, recordFired } = useWebhook.getState();
  if (!config.enabled || !config.url) return;
  if (candidate.confidence < config.minConfidence) return;

  try {
    const body = formatMasterPayload(candidate, context, config.format);
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (config.bearerToken) headers["Authorization"] = `Bearer ${config.bearerToken}`;
    const res = await fetch(config.url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      mode: "no-cors",
    });
    if (!res.ok && res.type !== "opaque") {
      recordFired(`HTTP ${res.status}`);
      return;
    }
    recordFired();
  } catch (e) {
    recordFired(e instanceof Error ? e.message : String(e));
  }
};

export const testWebhook = async (): Promise<{ ok: boolean; error?: string }> => {
  const { config, recordFired } = useWebhook.getState();
  if (!config.url) return { ok: false, error: "URL vazia" };
  try {
    const testPayload =
      config.format === "discord"
        ? {
            content: null,
            embeds: [
              {
                title: "🧪 Teste de webhook",
                description: "Mensagem de teste do Roleta Vision. Se você está vendo isso no Discord, está tudo configurado.",
                color: 5763719,
                timestamp: new Date().toISOString(),
                footer: { text: "Roleta Vision · teste" },
              },
            ],
          }
        : config.format === "slack"
        ? { text: "🧪 Teste do Roleta Vision — webhook funcionando." }
        : { type: "test", timestamp: Date.now() };
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (config.bearerToken) headers["Authorization"] = `Bearer ${config.bearerToken}`;
    await fetch(config.url, {
      method: "POST",
      headers,
      body: JSON.stringify(testPayload),
      mode: "no-cors",
    });
    recordFired();
    return { ok: true };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    recordFired(error);
    return { ok: false, error };
  }
};

export const fireWebhook = async (sig: SignalRecord): Promise<void> => {
  const { config, recordFired } = useWebhook.getState();
  if (!config.enabled || !config.url) return;
  if (sig.confidenceScore < config.minConfidence) return;

  try {
    const body = formatPayload(sig, config.format);
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (config.bearerToken) headers["Authorization"] = `Bearer ${config.bearerToken}`;
    const res = await fetch(config.url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      mode: "no-cors",
    });
    if (!res.ok && res.type !== "opaque") {
      recordFired(`HTTP ${res.status}`);
      return;
    }
    recordFired();
  } catch (e) {
    recordFired(e instanceof Error ? e.message : String(e));
  }
};
