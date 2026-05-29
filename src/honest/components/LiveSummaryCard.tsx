import { memo, useMemo, useState } from "react";
import { useHonestStore } from "../lib/store";
import { useFeedStatus } from "../lib/feedStatus";
import { colorOf, VOISINS, TIERS, ORPHELINS, RED, BLACK, DOZEN_1, DOZEN_2, DOZEN_3 } from "../lib/wheel";

const ballBg = (n: number) => {
  const c = colorOf(n);
  if (c === "green") return "bg-emerald-600";
  if (c === "red") return "bg-red-600";
  return "bg-neutral-900";
};

const fmtAgo = (ms: number): string => {
  if (ms < 1500) return "agora";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min`;
  return `${Math.floor(m / 60)}h`;
};

const LiveSummaryCard = memo(() => {
  const spins = useHonestStore((s) => s.spins);
  const mesa = useFeedStatus((s) => s.mesa);
  const lastPoll = useFeedStatus((s) => s.lastPoll);

  const stats = useMemo(() => {
    const w50 = spins.slice(0, 50).map((s) => s.n);
    const total = w50.length || 1;
    const count = (set: Set<number>) => w50.filter((n) => set.has(n)).length;
    return {
      voisins: count(VOISINS) / total,
      tiers: count(TIERS) / total,
      orphelins: count(ORPHELINS) / total,
      red: count(RED) / total,
      black: count(BLACK) / total,
      zero: count(new Set([0])) / total,
      d1: count(DOZEN_1) / total,
      d2: count(DOZEN_2) / total,
      d3: count(DOZEN_3) / total,
      w50count: w50.length,
    };
  }, [spins]);

  const recent = spins.slice(0, 20);
  const [expanded, setExpanded] = useState(false);

  return (
    <section data-tour="live-summary" className="rounded-2xl border border-emerald-700/30 bg-gradient-to-br from-neutral-900 to-neutral-950 p-4 shadow-xl shadow-emerald-900/10">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${lastPoll && Date.now() - lastPoll < 10000 ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
          <h2 className="text-base font-bold tracking-tight">{mesa ?? "Roleta Brasileira"}</h2>
          <span className="text-[10px] text-neutral-500 font-mono">
            {lastPoll ? `${fmtAgo(Date.now() - lastPoll)} atrás` : "—"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-neutral-500 font-mono">{spins.length} giros</span>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-[10px] text-amber-300 hover:underline"
          >
            {expanded ? "− detalhes" : "+ detalhes"}
          </button>
        </div>
      </div>

      {recent.length === 0 ? (
        <div className="text-center text-sm text-neutral-500 py-6">Aguardando feed ao vivo…</div>
      ) : (
        <>
          <div className="grid grid-cols-10 gap-1 mb-3">
            {recent.map((s, i) => (
              <div
                key={`${s.t}-${i}`}
                className={`${ballBg(s.n)} text-white text-[12px] font-bold h-8 rounded-md flex items-center justify-center ${
                  i === 0 ? "ring-2 ring-amber-400" : ""
                }`}
                title={new Date(s.t).toLocaleTimeString("pt-BR")}
              >
                {s.n}
              </div>
            ))}
          </div>

          {expanded ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <DistBar label="Voisins" pct={stats.voisins * 100} expected={(17 / 37) * 100} />
              <DistBar label="Tiers" pct={stats.tiers * 100} expected={(12 / 37) * 100} />
              <DistBar label="Orphelins" pct={stats.orphelins * 100} expected={(8 / 37) * 100} />
              <DistBar label="Vermelho" pct={stats.red * 100} expected={(18 / 37) * 100} />
              <DistBar label="Preto" pct={stats.black * 100} expected={(18 / 37) * 100} />
              <DistBar label="Zero" pct={stats.zero * 100} expected={(1 / 37) * 100} />
              <DistBar label="1ª Dúzia" pct={stats.d1 * 100} expected={(12 / 37) * 100} />
              <DistBar label="2ª Dúzia" pct={stats.d2 * 100} expected={(12 / 37) * 100} />
              <DistBar label="3ª Dúzia" pct={stats.d3 * 100} expected={(12 / 37) * 100} />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <DistBar label="Voisins" pct={stats.voisins * 100} expected={(17 / 37) * 100} />
              <DistBar label="Tiers" pct={stats.tiers * 100} expected={(12 / 37) * 100} />
              <DistBar label="Orphelins" pct={stats.orphelins * 100} expected={(8 / 37) * 100} />
            </div>
          )}
        </>
      )}
    </section>
  );
});
LiveSummaryCard.displayName = "LiveSummaryCard";

const DistBar = memo(({ label, pct, expected }: { label: string; pct: number; expected: number }) => {
  const ratio = expected > 0 ? pct / expected : 1;
  const accent = ratio > 1.3 ? "bg-amber-500" : ratio < 0.7 ? "bg-sky-500" : "bg-emerald-500";
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-2">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">{label}</span>
        <span className={`text-[10px] font-mono ${ratio > 1.3 ? "text-amber-300" : ratio < 0.7 ? "text-sky-300" : "text-neutral-400"}`}>
          {pct.toFixed(0)}%
        </span>
      </div>
      <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
        <div className={`h-1.5 ${accent}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <div className="text-[9px] font-mono mt-1 text-neutral-500">esp {expected.toFixed(0)}%</div>
    </div>
  );
});
DistBar.displayName = "LiveSummaryDistBar";

export default LiveSummaryCard;
