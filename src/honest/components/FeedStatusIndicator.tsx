import { memo, useEffect, useState } from "react";
import { useFeedStatus } from "../lib/feedStatus";

const labelMap: Record<string, string> = {
  connecting: "CONECTANDO",
  connected: "AO VIVO",
  "polling-only": "POLL",
  disconnected: "ERRO",
};

const dotClassMap: Record<string, string> = {
  connecting: "bg-amber-400 animate-pulse",
  connected: "bg-emerald-400 animate-pulse",
  "polling-only": "bg-sky-400",
  disconnected: "bg-red-500",
};

const formatAgo = (ms: number): string => {
  if (ms < 1000) return "agora";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  return `${h}h`;
};

const FeedStatusIndicator = memo(() => {
  const status = useFeedStatus((s) => s.status);
  const lastUpdate = useFeedStatus((s) => s.lastUpdate);
  const lastPoll = useFeedStatus((s) => s.lastPoll);
  const lastSource = useFeedStatus((s) => s.lastSource);
  const errorMessage = useFeedStatus((s) => s.errorMessage);
  const pollEnabled = useFeedStatus((s) => s.pollEnabled);
  const setPollEnabled = useFeedStatus((s) => s.setPollEnabled);
  const totalPolls = useFeedStatus((s) => s.totalPolls);
  const totalErrors = useFeedStatus((s) => s.totalErrors);
  const totalInjected = useFeedStatus((s) => s.totalInjected);
  const [, setTick] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const agoPoll = lastPoll ? formatAgo(Date.now() - lastPoll) : "—";
  const agoUpdate = lastUpdate ? formatAgo(Date.now() - lastUpdate) : "—";
  const effective = status;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-2 py-1 rounded-md border border-neutral-700 bg-neutral-900/70 hover:bg-neutral-800 transition"
        title={errorMessage ?? "Clique para detalhes"}
      >
        <span className={`w-2 h-2 rounded-full ${dotClassMap[effective]}`} />
        <span className="text-[10px] font-bold tracking-wider text-neutral-300">{labelMap[effective]}</span>
        <span className="text-[9px] text-neutral-500 font-mono hidden sm:inline">poll {agoPoll}</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setPollEnabled(!pollEnabled);
          }}
          className={`text-[9px] px-1.5 py-0.5 rounded border transition ${
            pollEnabled
              ? "border-emerald-600/40 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/40"
              : "border-neutral-600 bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
          }`}
        >
          {pollEnabled ? "POLL ON" : "POLL OFF"}
        </button>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-72 rounded-lg border border-neutral-700 bg-neutral-900 shadow-2xl p-3 text-xs z-50"
          onMouseLeave={() => setOpen(false)}
        >
          <div className="font-bold mb-2 flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${dotClassMap[effective]}`} />
            <span>{labelMap[effective]}</span>
            <span className="text-[10px] text-neutral-500 ml-auto">{lastSource ?? "—"}</span>
          </div>
          <dl className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
            <dt className="text-neutral-500">Último poll</dt>
            <dd className="text-neutral-200 font-mono text-right">{agoPoll} atrás</dd>
            <dt className="text-neutral-500">Último número novo</dt>
            <dd className="text-neutral-200 font-mono text-right">{agoUpdate} atrás</dd>
            <dt className="text-neutral-500">Polls totais</dt>
            <dd className="text-neutral-200 font-mono text-right">{totalPolls}</dd>
            <dt className="text-neutral-500">Giros injetados</dt>
            <dd className="text-emerald-300 font-mono text-right">{totalInjected}</dd>
            <dt className="text-neutral-500">Erros</dt>
            <dd className={`font-mono text-right ${totalErrors > 0 ? "text-red-300" : "text-neutral-500"}`}>
              {totalErrors}
            </dd>
          </dl>
          {errorMessage && (
            <div className="mt-2 p-2 rounded bg-red-950/40 border border-red-700/40 text-[10px] text-red-200 font-mono break-words">
              {errorMessage}
            </div>
          )}
          {status === "connected" && totalInjected === 0 && totalPolls > 0 && (
            <div className="mt-2 p-2 rounded bg-amber-950/40 border border-amber-700/40 text-[10px] text-amber-200 leading-relaxed">
              Conectado, mas a fonte não trouxe giros novos. Possíveis causas: (1) mesa Playtech sem rodadas
              recentes, (2) cache da fonte, (3) seu buffer já está em dia. Aguarde alguns segundos.
            </div>
          )}
        </div>
      )}
    </div>
  );
});
FeedStatusIndicator.displayName = "FeedStatusIndicator";
export default FeedStatusIndicator;
