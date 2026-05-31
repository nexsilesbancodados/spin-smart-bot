import { memo, useEffect, useState } from "react";
import { useSync, forceSyncPush, forceSyncPull } from "../lib/sync";

const formatAgo = (ts: number | null, now: number): string => {
  if (!ts) return "—";
  const s = Math.floor((now - ts) / 1000);
  if (s < 5) return "agora";
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min`;
  return `${Math.floor(m / 60)}h`;
};

const SyncIndicator = memo(() => {
  const status = useSync((s) => s.status);
  const lastPushAt = useSync((s) => s.lastPushAt);
  const lastPullAt = useSync((s) => s.lastPullAt);
  const errorMessage = useSync((s) => s.errorMessage);
  const pendingKeys = useSync((s) => s.pendingKeys);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  if (status === "idle") return null;

  const dotColor =
    status === "synced"
      ? "bg-emerald-400"
      : status === "pulling" || status === "pushing"
      ? "bg-amber-400 animate-pulse"
      : status === "error"
      ? "bg-red-500"
      : "bg-neutral-500";

  const label =
    status === "synced"
      ? "Sync OK"
      : status === "pulling"
      ? "Baixando…"
      : status === "pushing"
      ? "Enviando…"
      : status === "error"
      ? "Sync erro"
      : status;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 px-1.5 py-1 rounded-md bg-neutral-800 hover:bg-neutral-700 text-[10px]"
        title="Status de sincronização"
      >
        <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
        <span className="hidden sm:inline text-neutral-400">{label}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 min-w-[220px] bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl p-2 z-50 text-[10px]">
          <div className="text-neutral-500 uppercase tracking-wider font-bold mb-1">
            Sincronização
          </div>
          <div className="space-y-0.5 mb-2 font-mono">
            <div className="text-neutral-400">
              Status: <span className="text-neutral-200">{label}</span>
            </div>
            <div className="text-neutral-400">
              Último pull: <span className="text-neutral-200">{formatAgo(lastPullAt, now)}</span>
            </div>
            <div className="text-neutral-400">
              Último push: <span className="text-neutral-200">{formatAgo(lastPushAt, now)}</span>
            </div>
            {pendingKeys > 0 && (
              <div className="text-amber-300">
                {pendingKeys} chave(s) pendente(s)
              </div>
            )}
            {errorMessage && (
              <div className="text-red-300 break-words mt-1">
                ⚠ {errorMessage}
              </div>
            )}
          </div>
          <div className="flex gap-1 mt-1">
            <button
              onClick={() => {
                void forceSyncPull();
                setOpen(false);
              }}
              className="flex-1 px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold"
            >
              ↓ Baixar
            </button>
            <button
              onClick={() => {
                void forceSyncPush();
                setOpen(false);
              }}
              className="flex-1 px-2 py-1 rounded bg-amber-700 hover:bg-amber-600 text-white font-bold"
            >
              ↑ Enviar
            </button>
          </div>
          <div className="text-[9px] text-neutral-600 italic mt-2 leading-snug">
            Sincroniza histórico, padrões aprendidos, configs e logs entre seus devices via
            Supabase. Push automático a cada 6s se houver mudança.
          </div>
        </div>
      )}
    </div>
  );
});
SyncIndicator.displayName = "SyncIndicator";

export default SyncIndicator;
