import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SignalRecord } from "./signalAgent";
import type { MasterCandidate } from "./masterSignal";
import { supabase } from "@/integrations/supabase/client";
import { useUiPrefs } from "./uiPrefs";
import { useMasterSignalState } from "./masterSignalState";

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

export interface WebhookFireRecord {
  id: string;
  t: number;
  channel: "discord" | "telegram" | "legacy";
  kind: "signal" | "resolution" | "test";
  targetLabel: string;
  targetType: string;
  hit: boolean | null;
  ok: boolean;
  error?: string;
}

interface WebhookStore {
  config: WebhookConfig;
  history: WebhookFireRecord[];
  setConfig: (patch: Partial<WebhookConfig>) => void;
  recordFired: (error?: string) => void;
  recordFireDetail: (record: Omit<WebhookFireRecord, "id" | "t">) => void;
  clearHistory: () => void;
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

let fireSeq = 0;

export const useWebhook = create<WebhookStore>()(
  persist(
    (set) => ({
      config: defaults,
      history: [],
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
      recordFireDetail: (rec) =>
        set((s) => {
          const entry: WebhookFireRecord = {
            ...rec,
            id: `wh-${Date.now()}-${fireSeq++}`,
            t: Date.now(),
          };
          return { history: [entry, ...s.history].slice(0, 30) };
        }),
      clearHistory: () => set({ history: [] }),
    }),
    {
      name: "rv-webhook-v1",
      partialize: (s) => ({ config: s.config, history: s.history }),
    }
  )
);

const formatPayload = (sig: SignalRecord, format: WebhookConfig["format"]) => {
  if (format === "discord") {
    return {
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
  const safeLabel = c.targetLabel || "Sinal";
  const safeType = c.targetType || "geral";
  if (format === "discord") {
    return {
      embeds: [
        {
          title: `🎯 ${safeLabel}`,
          description:
            `**Chance combinada:** ${(c.prob * 100).toFixed(1)}%\n` +
            `**Paga:** ${c.payout.toFixed(1)}:1 · cobre ${c.coverage} nº\n` +
            `**Lift:** ${c.lift.toFixed(2)}× o acaso (${(c.baseline * 100).toFixed(1)}%)\n` +
            `**Confiança:** ${(c.confidence * 100).toFixed(0)}%`,
          color: c.strictValid ? 5763719 : 15844367,
          fields: [
            { name: "Tipo", value: safeType, inline: true },
            {
              name: "Validação",
              value: c.strictValid ? "✓ Estrito" : "○ Parcial",
              inline: true,
            },
            { name: "Cobertura", value: headBalls || "—", inline: false },
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

let relayAvailable: boolean | null = null;
let telegramRelayAvailable: boolean | null = null;
const lastSentByType = new Map<string, number>();
const COOLDOWN_HOT_MS = 50_000;
const COOLDOWN_NEUTRAL_MS = 90_000;
const COOLDOWN_COLD_MS = 130_000;

const computeCooldownForType = (type: string): number => {
  const recent = useMasterSignalState.getState().recent;
  const sameType = recent.filter((w) => w.resolved && w.targetType === type);
  if (sameType.length < 5) return COOLDOWN_NEUTRAL_MS;
  const hits = sameType.filter((w) => w.hit === true).length;
  const rate = hits / sameType.length;
  if (rate >= 0.5) return COOLDOWN_HOT_MS;
  if (rate <= 0.25) return COOLDOWN_COLD_MS;
  return COOLDOWN_NEUTRAL_MS;
};
let fireMasterWebhookForceFlag = false;

export const forceFireMasterWebhook = async (
  candidate: MasterCandidate,
  context: {
    spinsSeen: number;
    validatedCount: number;
    lastSpin?: number | null;
    recentHits?: number;
    recentMisses?: number;
    recentTotal?: number;
  }
): Promise<void> => {
  fireMasterWebhookForceFlag = true;
  try {
    await fireMasterWebhook(candidate, context);
  } finally {
    fireMasterWebhookForceFlag = false;
  }
};

export interface ResolutionContext {
  recentHits?: number;
  recentMisses?: number;
  recentTotal?: number;
}

export const fireMasterResolution = async (
  resolution: {
    targetLabel: string;
    targetType: string;
    actualNumber: number;
    hit: boolean;
  },
  context: ResolutionContext = {}
): Promise<void> => {
  const type = resolution.targetType.toLowerCase();
  if (!isTypeAllowedForWebhook(type)) return;
  const payload = {
    task: "master-resolution" as const,
    resolution: {
      targetLabel: resolution.targetLabel,
      targetType: resolution.targetType,
      actualNumber: resolution.actualNumber,
      hit: resolution.hit,
    },
    context,
  };
  const sendDiscord = async () => {
    if (relayAvailable === false) return;
    try {
      const res = await supabase.functions.invoke<{ ok?: boolean; error?: string }>(
        "discord-relay",
        { body: payload }
      );
      if (res.error) {
        const msg = res.error.message ?? "";
        if (msg.includes("NOT_FOUND") || msg.includes("404")) {
          relayAvailable = false;
        }
      }
    } catch {
      /* noop */
    }
  };
  const sendTelegram = async () => {
    if (telegramRelayAvailable === false) return;
    try {
      const res = await supabase.functions.invoke<{ ok?: boolean; error?: string }>(
        "telegram-relay",
        { body: payload }
      );
      if (res.error) {
        const msg = res.error.message ?? "";
        if (msg.includes("NOT_FOUND") || msg.includes("404")) {
          telegramRelayAvailable = false;
        }
      }
    } catch {
      /* noop */
    }
  };
  await Promise.all([sendDiscord(), sendTelegram()]);
  const { recordFireDetail } = useWebhook.getState();
  recordFireDetail({
    channel: "discord",
    kind: "resolution",
    targetLabel: resolution.targetLabel,
    targetType: resolution.targetType,
    hit: resolution.hit,
    ok: relayAvailable !== false,
  });
  recordFireDetail({
    channel: "telegram",
    kind: "resolution",
    targetLabel: resolution.targetLabel,
    targetType: resolution.targetType,
    hit: resolution.hit,
    ok: telegramRelayAvailable !== false,
  });
};

const tryTelegramRelay = async (
  payload: Record<string, unknown>
): Promise<{ ok: boolean; error?: string }> => {
  if (telegramRelayAvailable === false) return { ok: false, error: "telegram-relay-disabled" };
  try {
    const res = await supabase.functions.invoke<{ ok?: boolean; error?: string }>(
      "telegram-relay",
      { body: payload }
    );
    if (res.error) {
      const msg = res.error.message ?? "";
      if (msg.includes("NOT_FOUND") || msg.includes("404")) {
        telegramRelayAvailable = false;
        return { ok: false, error: "telegram-relay-not-deployed" };
      }
      return { ok: false, error: msg };
    }
    if (!res.data || res.data.ok !== true) {
      return { ok: false, error: res.data?.error ?? "telegram-unknown" };
    }
    telegramRelayAvailable = true;
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
};

const tryRelay = async (
  candidate: MasterCandidate,
  context: {
    spinsSeen: number;
    validatedCount: number;
    lastSpin?: number | null;
    recentHits?: number;
    recentMisses?: number;
    recentTotal?: number;
  }
): Promise<{ ok: boolean; error?: string }> => {
  if (relayAvailable === false) return { ok: false, error: "relay-disabled" };
  try {
    const res = await supabase.functions.invoke<{ ok?: boolean; error?: string; detail?: string }>(
      "discord-relay",
      {
        body: {
          task: "master-signal",
          candidate: {
            targetLabel: candidate.targetLabel,
            targetType: candidate.targetType,
            prob: candidate.prob,
            payout: candidate.payout,
            coverage: candidate.coverage,
            lift: candidate.lift,
            baseline: candidate.baseline,
            confidence: candidate.confidence,
            strictValid: candidate.strictValid,
            numbers: candidate.numbers,
          },
          context,
        },
      }
    );
    if (res.error) {
      const msg = res.error.message ?? "";
      if (msg.includes("NOT_FOUND") || msg.includes("404")) {
        relayAvailable = false;
        return { ok: false, error: "relay-not-deployed" };
      }
      return { ok: false, error: msg };
    }
    if (!res.data || res.data.ok !== true) {
      return {
        ok: false,
        error: res.data?.error ?? res.data?.detail ?? "relay-unknown-error",
      };
    }
    relayAvailable = true;
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
};

const isTypeAllowedForWebhook = (type: string): boolean => {
  const scope = useUiPrefs.getState().focusedScope;
  if (scope.length === 0) return false;
  return scope.includes(type as never);
};

export const fireMasterWebhook = async (
  candidate: MasterCandidate,
  context: {
    spinsSeen: number;
    validatedCount: number;
    lastSpin?: number | null;
    recentHits?: number;
    recentMisses?: number;
    recentTotal?: number;
  }
): Promise<void> => {
  const { config, recordFired } = useWebhook.getState();
  if (candidate.confidence < config.minConfidence) return;
  const type = candidate.targetType.toLowerCase();
  if (!isTypeAllowedForWebhook(type)) return;

  // Per-type adaptive cooldown:
  //   hot type (hit rate ≥ 50% recente) → 50s entre sinais
  //   neutro → 90s
  //   frio (≤25%) → 130s
  // Tipo quente abre janela mais rápido, tipo frio se contém.
  const now = Date.now();
  if (!fireMasterWebhookForceFlag) {
    const cooldownMs = computeCooldownForType(type);
    const lastForType = lastSentByType.get(type) ?? 0;
    if (now - lastForType < cooldownMs) return;
  }
  lastSentByType.set(type, now);

  // Try Discord and Telegram relays in parallel
  const sharedPayload = {
    task: "master-signal" as const,
    candidate: {
      targetLabel: candidate.targetLabel,
      targetType: candidate.targetType,
      prob: candidate.prob,
      payout: candidate.payout,
      coverage: candidate.coverage,
      lift: candidate.lift,
      baseline: candidate.baseline,
      confidence: candidate.confidence,
      strictValid: candidate.strictValid,
      numbers: candidate.numbers,
    },
    context,
  };
  const [relayResult, telegramResult] = await Promise.all([
    tryRelay(candidate, context),
    tryTelegramRelay(sharedPayload as Record<string, unknown>),
  ]);
  const { recordFireDetail } = useWebhook.getState();
  recordFireDetail({
    channel: "discord",
    kind: "signal",
    targetLabel: candidate.targetLabel,
    targetType: candidate.targetType,
    hit: null,
    ok: relayResult.ok,
    error: relayResult.ok ? undefined : relayResult.error,
  });
  recordFireDetail({
    channel: "telegram",
    kind: "signal",
    targetLabel: candidate.targetLabel,
    targetType: candidate.targetType,
    hit: null,
    ok: telegramResult.ok,
    error: telegramResult.ok ? undefined : telegramResult.error,
  });
  if (relayResult.ok || telegramResult.ok) {
    recordFired();
    return;
  }

  // Fallback: direct POST if user has configured a URL in localStorage
  if (!config.enabled || !config.url) {
    if (relayResult.error && relayResult.error !== "relay-not-deployed") {
      recordFired(`relay: ${relayResult.error}`);
    }
    return;
  }

  try {
    const body = formatMasterPayload(candidate, context, config.format);
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (config.bearerToken) headers["Authorization"] = `Bearer ${config.bearerToken}`;
    const res = await fetch(config.url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      recordFired(`HTTP ${res.status}${text ? ` · ${text.slice(0, 120)}` : ""}`);
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
            content: "🧪 Teste do Roleta Vision — se você está vendo isso, o webhook está funcionando.",
          }
        : config.format === "slack"
        ? { text: "🧪 Teste do Roleta Vision — webhook funcionando." }
        : { type: "test", timestamp: Date.now() };
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (config.bearerToken) headers["Authorization"] = `Bearer ${config.bearerToken}`;
    const res = await fetch(config.url, {
      method: "POST",
      headers,
      body: JSON.stringify(testPayload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const err = `HTTP ${res.status}${text ? ` · ${text.slice(0, 200)}` : ""}`;
      recordFired(err);
      return { ok: false, error: err };
    }
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
    });
    if (!res.ok) {
      recordFired(`HTTP ${res.status}`);
      return;
    }
    recordFired();
  } catch (e) {
    recordFired(e instanceof Error ? e.message : String(e));
  }
};
