import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SignalRecord } from "./signalAgent";

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
