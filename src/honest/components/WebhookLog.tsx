import { memo, useState } from "react";
import { useHonestStore } from "../lib/store";
import { useSignalAgent } from "../lib/signalAgent";
import { useMasterSignalState } from "../lib/masterSignalState";
import { computeMasterSignal } from "../lib/masterSignal";
import { useWebhook, forceFireMasterWebhook } from "../lib/webhook";
import { Card, SectionHeader, Pill, Button } from "./ui";

const channelEmoji = (channel: string): string => {
  if (channel === "discord") return "📡";
  if (channel === "telegram") return "✈";
  return "🔗";
};

const kindLabel = (kind: string): string => {
  if (kind === "signal") return "Sinal";
  if (kind === "resolution") return "Resolução";
  return "Teste";
};

const WebhookLog = memo(() => {
  const history = useWebhook((s) => s.history);
  const clearHistory = useWebhook((s) => s.clearHistory);
  const spins = useHonestStore((s) => s.spins);
  const latest = useSignalAgent((s) => s.latest);
  const recentWinners = useMasterSignalState((s) => s.recent);
  const [forcing, setForcing] = useState(false);
  const [forceResult, setForceResult] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const handleForceSend = async () => {
    setForcing(true);
    setForceResult(null);
    try {
      const historyNumbers = spins.map((s) => s.n);
      const { ranked, summary } = computeMasterSignal(historyNumbers, latest);
      if (ranked.length === 0) {
        setForceResult("⚠ Sem candidato para enviar");
        setTimeout(() => setForceResult(null), 5000);
        setForcing(false);
        return;
      }
      const top = ranked[0];
      const resolvedRecent = recentWinners.filter((w) => w.resolved);
      const sameTypeRecent = resolvedRecent.filter((w) => w.targetType === top.targetType);
      await forceFireMasterWebhook(top, {
        spinsSeen: historyNumbers.length,
        validatedCount: summary.validatedCount,
        lastSpin: spins[0]?.n ?? null,
        recentHits: sameTypeRecent.filter((w) => w.hit === true).length,
        recentMisses: sameTypeRecent.filter((w) => w.hit === false).length,
        recentTotal: sameTypeRecent.length,
      });
      setForceResult(`✓ Enviado: ${top.targetLabel} (${(top.prob * 100).toFixed(1)}%)`);
      setTimeout(() => setForceResult(null), 5000);
    } catch (e) {
      setForceResult(`✗ ${e instanceof Error ? e.message : String(e)}`);
      setTimeout(() => setForceResult(null), 5000);
    } finally {
      setForcing(false);
    }
  };

  const successCount = history.filter((h) => h.ok).length;
  const errorCount = history.filter((h) => !h.ok).length;

  return (
    <Card padding="sm">
      <SectionHeader
        title={
          <span className="flex items-center gap-2">
            📜 Log de envios
            {history.length > 0 && (
              <Pill accent={errorCount === 0 ? "good" : "warn"}>
                {successCount}✓ / {errorCount}✗
              </Pill>
            )}
          </span>
        }
        eyebrow="Últimos 30 envios pra Discord + Telegram"
        subtitle={
          <span className="text-[10px] text-neutral-500">
            Forçar envio bypassa o cooldown de 90s por tipo — usa o sinal atual do MasterSignal.
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button variant="primary" size="sm" onClick={handleForceSend} disabled={forcing}>
              {forcing ? "Enviando…" : "📤 Forçar envio"}
            </Button>
            {history.length > 0 && (
              <button
                onClick={() => {
                  if (confirmClear) {
                    clearHistory();
                    setConfirmClear(false);
                  } else {
                    setConfirmClear(true);
                    setTimeout(() => setConfirmClear(false), 3000);
                  }
                }}
                className="text-[10px] text-red-400 hover:text-red-300 font-bold"
              >
                {confirmClear ? "Confirmar?" : "Limpar"}
              </button>
            )}
          </div>
        }
      />

      {forceResult && (
        <div
          className={`text-[11px] mb-2 px-2 py-1 rounded ${
            forceResult.startsWith("✓")
              ? "bg-emerald-950/40 text-emerald-300 border border-emerald-700/50"
              : "bg-red-950/40 text-red-300 border border-red-700/50"
          }`}
        >
          {forceResult}
        </div>
      )}

      {history.length === 0 ? (
        <div className="text-[11px] text-neutral-500 italic py-3 text-center">
          Nenhum envio registrado ainda. Quando o bot emitir sinal validado vai aparecer aqui.
        </div>
      ) : (
        <div className="space-y-0.5 max-h-72 overflow-y-auto">
          {history.map((h) => (
            <div
              key={h.id}
              className={`flex items-center gap-2 px-2 py-1 rounded text-[10px] ${
                h.ok ? "bg-neutral-900/40" : "bg-red-950/30 border border-red-700/30"
              }`}
            >
              <span className="text-base shrink-0">{channelEmoji(h.channel)}</span>
              <span className="text-neutral-400 font-mono shrink-0">
                {new Date(h.t).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
              <span className="text-neutral-500 uppercase tracking-wider font-bold shrink-0 w-14 text-[9px]">
                {kindLabel(h.kind)}
              </span>
              <span className="flex-1 truncate text-neutral-200">
                {h.kind === "resolution" && h.hit !== null && (
                  <span className={h.hit ? "text-emerald-300" : "text-red-300"}>
                    {h.hit ? "✓ " : "✗ "}
                  </span>
                )}
                {h.targetLabel}
              </span>
              <span className="text-[9px] text-neutral-500 shrink-0 font-mono">
                {h.targetType}
              </span>
              {h.ok ? (
                <span className="text-emerald-400 shrink-0">✓</span>
              ) : (
                <span className="text-red-400 shrink-0" title={h.error}>
                  ✗
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="text-[9px] text-neutral-600 italic mt-2 text-center">
        Log fica em localStorage. Mostra os 2 canais (Discord + Telegram) separadamente — se um
        falha e o outro vai, fica claro qual está OK.
      </div>
    </Card>
  );
});
WebhookLog.displayName = "WebhookLog";

export default WebhookLog;
