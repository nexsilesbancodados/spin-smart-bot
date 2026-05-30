import { memo, useState } from "react";
import { useWebhook, testWebhook } from "../lib/webhook";
import { Card, SectionHeader, Pill, Button } from "./ui";

const DiscordWebhookConfig = memo(() => {
  const config = useWebhook((s) => s.config);
  const setConfig = useWebhook((s) => s.setConfig);
  const [showUrl, setShowUrl] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const result = await testWebhook();
    setTestResult(result);
    setTesting(false);
    setTimeout(() => setTestResult(null), 5000);
  };

  const isDiscordUrl =
    config.url.includes("discord.com/api/webhooks") ||
    config.url.includes("discordapp.com/api/webhooks");

  return (
    <Card padding="sm" accent={config.enabled ? "good" : "neutral"}>
      <SectionHeader
        title={
          <span className="flex items-center gap-2">
            📡 Discord / Slack / Webhook
            <Pill accent={config.enabled ? "good" : "neutral"}>
              {config.enabled ? "ATIVO" : "DESLIGADO"}
            </Pill>
            {config.totalSent > 0 && (
              <span className="text-[9px] text-neutral-500 font-mono">
                {config.totalSent} enviados
                {config.totalErrors > 0 && ` · ${config.totalErrors} erros`}
              </span>
            )}
          </span>
        }
        eyebrow="Envia sinais validados pra um canal externo"
        subtitle={
          <span className="text-[10px] text-neutral-500">
            Dispara automaticamente quando aparece sinal estrito-validado. URL fica só no seu
            browser (localStorage) — nunca sai daqui.
          </span>
        }
        actions={
          <Button
            variant={config.enabled ? "danger" : "success"}
            size="sm"
            onClick={() => setConfig({ enabled: !config.enabled })}
          >
            {config.enabled ? "Desligar" : "Ligar"}
          </Button>
        }
      />

      <div className="space-y-2">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold mb-1 block">
            URL do webhook
          </label>
          <div className="flex gap-1">
            <input
              type={showUrl ? "text" : "password"}
              value={config.url}
              onChange={(e) => setConfig({ url: e.target.value })}
              placeholder="https://discord.com/api/webhooks/..."
              className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs font-mono"
            />
            <button
              onClick={() => setShowUrl((v) => !v)}
              className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-xs"
              title={showUrl ? "Ocultar" : "Mostrar"}
            >
              {showUrl ? "🙈" : "👁"}
            </button>
          </div>
          {config.url && !isDiscordUrl && config.format === "discord" && (
            <div className="text-[10px] text-amber-300 mt-1">
              ⚠ Essa URL não parece Discord. Verifique ou mude o formato abaixo.
            </div>
          )}
          {isDiscordUrl && config.format !== "discord" && (
            <div className="text-[10px] text-cyan-300 mt-1">
              💡 Detectei URL do Discord. Talvez queira mudar o formato pra "discord" abaixo.
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold">
              Formato
            </span>
            <select
              value={config.format}
              onChange={(e) => setConfig({ format: e.target.value as "json" | "discord" | "slack" })}
              className="w-full mt-0.5 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs"
            >
              <option value="discord">Discord (embed bonito)</option>
              <option value="slack">Slack (texto)</option>
              <option value="json">JSON cru (genérico)</option>
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold">
              Confiança mín
            </span>
            <input
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={config.minConfidence}
              onChange={(e) =>
                setConfig({
                  minConfidence: Math.max(0, Math.min(1, Number(e.target.value) || 0)),
                })
              }
              className="w-full mt-0.5 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs font-mono"
            />
          </label>
        </div>

        <details className="bg-neutral-900/40 rounded">
          <summary className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold cursor-pointer px-2 py-1">
            ⚙ Bearer token (opcional, pra endpoints custom)
          </summary>
          <input
            type="password"
            value={config.bearerToken ?? ""}
            onChange={(e) => setConfig({ bearerToken: e.target.value || undefined })}
            placeholder="só pra webhooks privados com auth"
            className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs font-mono m-2"
          />
        </details>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleTest}
            disabled={testing || !config.url}
          >
            {testing ? "Testando…" : "🧪 Enviar mensagem de teste"}
          </Button>
          {testResult && (
            <span
              className={`text-[10px] font-bold ${
                testResult.ok ? "text-emerald-300" : "text-red-300"
              }`}
            >
              {testResult.ok ? "✓ Enviado" : `✗ ${testResult.error}`}
            </span>
          )}
        </div>

        {config.lastFiredAt && (
          <div className="text-[10px] text-neutral-500">
            Último disparo:{" "}
            {new Date(config.lastFiredAt).toLocaleString("pt-BR")}
            {config.lastError && (
              <span className="text-red-300 ml-2">⚠ {config.lastError}</span>
            )}
          </div>
        )}
      </div>

      <details className="bg-neutral-900/40 rounded mt-2">
        <summary className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold cursor-pointer px-2 py-1">
          📖 Como pegar URL do webhook no Discord
        </summary>
        <ol className="text-[11px] text-neutral-300 list-decimal list-inside p-2 space-y-1">
          <li>Abra o servidor do Discord → clique no canal desejado</li>
          <li>Engrenagem do canal → <b>Integrações</b></li>
          <li><b>Webhooks</b> → <b>Novo webhook</b></li>
          <li>Dê um nome (ex: "Roleta Vision Bot"), escolha o canal</li>
          <li><b>Copiar URL do Webhook</b> → colar acima</li>
          <li>Clique em "Ligar" e "Testar"</li>
        </ol>
      </details>

      <div className="text-[9px] text-neutral-600 italic mt-2 text-center leading-snug">
        ⚠ A URL é só pra você. Não compartilhe — qualquer pessoa com ela pode mandar mensagens no
        seu canal. Se vazar, no Discord clique em "Excluir" no webhook e crie outro.
      </div>
    </Card>
  );
});
DiscordWebhookConfig.displayName = "DiscordWebhookConfig";

export default DiscordWebhookConfig;
