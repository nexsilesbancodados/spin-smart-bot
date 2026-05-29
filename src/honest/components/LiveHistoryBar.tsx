import { memo, useEffect, useRef, useState } from "react";
import { useHonestStore } from "../lib/store";
import { useFeedStatus } from "../lib/feedStatus";
import { colorOf } from "../lib/wheel";
import { ingestProxyNumbers } from "../lib/useLiveFeed";

const ballBg = (n: number) => {
  const c = colorOf(n);
  if (c === "green") return "bg-emerald-600 ring-emerald-400/50 shadow-emerald-500/30";
  if (c === "red") return "bg-gradient-to-br from-red-500 to-red-700 ring-red-400/40 shadow-red-500/30";
  return "bg-gradient-to-br from-neutral-700 to-neutral-900 ring-neutral-500/40 shadow-black/40";
};

const formatRelative = (ms: number): string => {
  if (ms < 1500) return "agora";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  return `${h}h`;
};

const LiveHistoryBar = memo(() => {
  const spins = useHonestStore((s) => s.spins);
  const mesa = useFeedStatus((s) => s.mesa);
  const totalPolls = useFeedStatus((s) => s.totalPolls);
  const lastPoll = useFeedStatus((s) => s.lastPoll);
  const pollInterval = useFeedStatus((s) => s.pollInterval);
  const [pulseKey, setPulseKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const prevHeadRef = useRef<number | undefined>(spins[0]?.n);
  const [, setTick] = useState(0);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await ingestProxyNumbers();
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const head = spins[0]?.n;
    if (head !== undefined && head !== prevHeadRef.current && prevHeadRef.current !== undefined) {
      setPulseKey((k) => k + 1);
    }
    prevHeadRef.current = head;
  }, [spins]);

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const recent = spins.slice(0, 30);
  const lastTs = spins[0]?.t;
  const nextPollIn = lastPoll
    ? Math.max(0, Math.ceil((pollInterval - (Date.now() - lastPoll)) / 1000))
    : null;

  return (
    <div className="sticky top-[57px] z-20 border-b border-neutral-800/70 bg-neutral-950/95 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-3">
        <div className="flex flex-col leading-none shrink-0 min-w-[80px]">
          <span className="text-[9px] uppercase tracking-[0.18em] text-amber-400 font-bold">
            {mesa ?? "AO VIVO"}
          </span>
          <span className="text-[10px] text-neutral-400 font-mono">
            {lastTs ? formatRelative(Date.now() - lastTs) : "—"}
            {nextPollIn !== null && (
              <span className="text-neutral-600"> · {nextPollIn}s</span>
            )}
          </span>
        </div>
        <div className="flex-1 min-w-0 overflow-x-auto scrollbar-none">
          {recent.length === 0 ? (
            <div className="text-[10px] text-neutral-500 italic">Aguardando giros do feed ao vivo…</div>
          ) : (
            <div className="flex items-center gap-1.5 py-1">
              {recent.map((s, i) => (
                <span
                  key={`${s.t}-${i}`}
                  data-fresh={i === 0 ? pulseKey : undefined}
                  className={`shrink-0 ${ballBg(s.n)} flex items-center justify-center font-bold text-white tabular-nums ${
                    i === 0
                      ? "w-9 h-9 rounded-full text-[14px] ring-2 ring-offset-2 ring-offset-neutral-950 [animation:pop_0.45s_ease-out] shadow-lg"
                      : "w-7 h-7 rounded-full text-[12px] ring-1 ring-offset-1 ring-offset-neutral-950/50 shadow-sm"
                  }`}
                  title={new Date(s.t).toLocaleTimeString("pt-BR") + ` · ${s.source}`}
                >
                  {s.n}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="hidden sm:flex flex-col leading-none shrink-0 text-right">
          <span className="text-[9px] uppercase tracking-[0.14em] text-neutral-500 font-bold">Total</span>
          <span className="text-[11px] text-neutral-300 font-mono">{spins.length}</span>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="shrink-0 px-2.5 py-1 rounded-md bg-amber-500/90 hover:bg-amber-400 text-black text-[11px] font-bold disabled:opacity-50"
          title="Atualizar agora"
        >
          {refreshing ? "…" : "↻ Agora"}
        </button>
        <span className="hidden md:inline text-[9px] text-neutral-600 font-mono shrink-0">
          #{totalPolls}
        </span>
      </div>
    </div>
  );
});
LiveHistoryBar.displayName = "LiveHistoryBar";
export default LiveHistoryBar;
