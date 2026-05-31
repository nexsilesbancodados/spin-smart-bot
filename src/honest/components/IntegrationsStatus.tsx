import { memo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, SectionHeader, Pill, Button } from "./ui";

type Integration = "discord-relay" | "telegram-relay" | "claude-analyze";

interface IntegrationMeta {
  id: Integration;
  icon: string;
  name: string;
  description: string;
  testBody: Record<string, unknown>;
  envHint: string;
}

const INTEGRATIONS: IntegrationMeta[] = [
  {
    id: "discord-relay",
    icon: "📡",
    name: "Discord",
    description: "Envia sinais e resoluções pro canal do Discord",
    testBody: { task: "test" },
    envHint: "DISCORD_WEBHOOK_URL",
  },
  {
    id: "telegram-relay",
    icon: "✈",
    name: "Telegram",
    description: "Envia sinais e resoluções pro chat do Telegram",
    testBody: { task: "test" },
    envHint: "TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID",
  },
  {
    id: "claude-analyze",
    icon: "🤖",
    name: "Claude IA",
    description: "Análises sob demanda (botões em ⚙ avançado → 🤖 IA)",
    testBody: { task: "session-report", context: { test: true } },
    envHint: "ANTHROPIC_API_KEY",
  },
];

type Status = "unknown" | "checking" | "ok" | "not-deployed" | "config-missing" | "error";

interface IntegrationState {
  status: Status;
  message?: string;
  testedAt?: number;
}

const blank: IntegrationState = { status: "unknown" };

const statusAccent = (s: Status): "good" | "warn" | "bad" | "neutral" => {
  if (s === "ok") return "good";
  if (s === "checking" || s === "unknown") return "neutral";
  if (s === "config-missing") return "warn";
  return "bad";
};

const statusLabel = (s: Status): string => {
  if (s === "ok") return "✓ FUNCIONANDO";
  if (s === "checking") return "TESTANDO…";
  if (s === "unknown") return "NÃO TESTADO";
  if (s === "config-missing") return "FALTA SECRET";
  if (s === "not-deployed") return "NÃO DEPLOYADO";
  return "ERRO";
};

const IntegrationsStatus = memo(() => {
  const [states, setStates] = useState<Record<Integration, IntegrationState>>({
    "discord-relay": blank,
    "telegram-relay": blank,
    "claude-analyze": blank,
  });

  const testOne = async (id: Integration, body: Record<string, unknown>) => {
    setStates((s) => ({ ...s, [id]: { status: "checking" } }));
    try {
      const res = await supabase.functions.invoke<{
        ok?: boolean;
        error?: string;
        detail?: string;
        text?: string;
      }>(id, { body });

      if (res.error) {
        const msg = res.error.message ?? "";
        if (msg.includes("NOT_FOUND") || msg.includes("404")) {
          setStates((s) => ({
            ...s,
            [id]: {
              status: "not-deployed",
              message: "Function não foi deployada. Rode: supabase functions deploy " + id,
              testedAt: Date.now(),
            },
          }));
          return;
        }
        setStates((s) => ({
          ...s,
          [id]: { status: "error", message: msg.slice(0, 200), testedAt: Date.now() },
        }));
        return;
      }

      const data = res.data;
      if (data?.error?.includes?.("not configured") || data?.error?.includes?.("configurado")) {
        setStates((s) => ({
          ...s,
          [id]: { status: "config-missing", message: data.error, testedAt: Date.now() },
        }));
        return;
      }

      if (data?.ok === true || data?.text) {
        setStates((s) => ({
          ...s,
          [id]: { status: "ok", message: "Resposta recebida", testedAt: Date.now() },
        }));
        return;
      }

      if (data?.error) {
        setStates((s) => ({
          ...s,
          [id]: {
            status: "error",
            message: (data.error + (data.detail ? " · " + data.detail : "")).slice(0, 200),
            testedAt: Date.now(),
          },
        }));
        return;
      }

      setStates((s) => ({
        ...s,
        [id]: { status: "ok", message: "Resposta recebida sem erro", testedAt: Date.now() },
      }));
    } catch (err) {
      setStates((s) => ({
        ...s,
        [id]: {
          status: "error",
          message: (err instanceof Error ? err.message : String(err)).slice(0, 200),
          testedAt: Date.now(),
        },
      }));
    }
  };

  const testAll = async () => {
    await Promise.all(INTEGRATIONS.map((i) => testOne(i.id, i.testBody)));
  };

  return (
    <Card padding="sm">
      <SectionHeader
        title="🔌 Status das Integrações"
        eyebrow="Verifica se Discord / Telegram / Claude estão deployados"
        subtitle={
          <span className="text-[10px] text-neutral-500">
            Dispara teste real em cada edge function. Mensagens aparecem nos canais ao vivo.
          </span>
        }
        actions={
          <Button variant="primary" size="sm" onClick={testAll}>
            ▶ Testar todas
          </Button>
        }
      />

      <div className="space-y-2">
        {INTEGRATIONS.map((meta) => {
          const state = states[meta.id];
          const accent = statusAccent(state.status);
          return (
            <div
              key={meta.id}
              className={`rounded-lg border p-2 ${
                accent === "good"
                  ? "border-emerald-600/50 bg-emerald-950/30"
                  : accent === "warn"
                  ? "border-amber-600/50 bg-amber-950/30"
                  : accent === "bad"
                  ? "border-red-600/40 bg-red-950/30"
                  : "border-neutral-800 bg-neutral-900/40"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg shrink-0">{meta.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-bold text-neutral-200">{meta.name}</div>
                  <div className="text-[9px] text-neutral-500 truncate">{meta.description}</div>
                </div>
                <Pill accent={accent}>{statusLabel(state.status)}</Pill>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => testOne(meta.id, meta.testBody)}
                  disabled={state.status === "checking"}
                >
                  Testar
                </Button>
              </div>
              {state.message && (
                <div className="text-[10px] text-neutral-400 leading-snug mt-1 font-mono">
                  {state.message}
                </div>
              )}
              {state.status === "config-missing" && (
                <div className="text-[10px] text-amber-300 mt-1 font-mono">
                  Falta setar no Supabase: <code>{meta.envHint}</code>
                </div>
              )}
              {state.status === "not-deployed" && (
                <div className="text-[10px] text-neutral-400 mt-1 font-mono">
                  Deploy: <code>supabase functions deploy {meta.id}</code>
                </div>
              )}
              {state.testedAt && (
                <div className="text-[9px] text-neutral-600 mt-1">
                  testado em {new Date(state.testedAt).toLocaleTimeString("pt-BR")}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="text-[9px] text-neutral-600 italic mt-2 leading-snug">
        ✓ Funcionando = function respondeu OK · ⚠ Falta secret = function deployada mas env
        var não setada · ✗ Não deployada = rode <code>supabase functions deploy &lt;nome&gt;</code>
      </div>
    </Card>
  );
});
IntegrationsStatus.displayName = "IntegrationsStatus";

export default IntegrationsStatus;
