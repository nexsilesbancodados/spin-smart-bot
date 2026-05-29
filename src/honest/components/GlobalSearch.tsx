import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSignalAgent } from "../lib/signalAgent";
import { useAnnotations } from "../lib/annotations";
import { useHonestStore } from "../lib/store";
import { colorOf } from "../lib/wheel";

const ballBg = (n: number) => {
  const c = colorOf(n);
  if (c === "green") return "bg-emerald-600";
  if (c === "red") return "bg-red-600";
  return "bg-neutral-800";
};

type ResultKind = "signal" | "annotation" | "session" | "spin";
interface SearchResult {
  kind: ResultKind;
  title: string;
  detail: string;
  timestamp: number;
  emoji: string;
  onClick: () => void;
}

const GlobalSearch = memo(() => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const signals = useSignalAgent((s) => s.history);
  const annotations = useAnnotations((s) => s.annotations);
  const sessions = useHonestStore((s) => s.history);
  const spins = useHonestStore((s) => s.spins);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f" && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        setOpen(true);
      }
      if (open && e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const results = useMemo<SearchResult[]>(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    const matchesNumber = /^\d{1,2}$/.test(q) ? Number(q) : null;

    const sigResults: SearchResult[] = signals.slice(0, 200).filter((s) => {
      if (matchesNumber !== null && (s.mainPick === matchesNumber || s.actualNumber === matchesNumber)) return true;
      if (s.sector.toLowerCase().includes(q)) return true;
      if (s.explanation?.some((e) => e.toLowerCase().includes(q))) return true;
      return false;
    }).map((s) => ({
      kind: "signal" as const,
      title: `Sinal ${s.mainPick} (${(s.mainProb * 100).toFixed(1)}%)`,
      detail: `${s.sector} · ${s.actualNumber !== null ? `saiu ${s.actualNumber} · ${s.hitMain ? "EXATO" : s.hitTop5 ? "Top 5" : "Errou"}` : "pendente"}`,
      timestamp: s.t,
      emoji: "🎯",
      onClick: () => navigate("/sinais"),
    }));

    const annResults: SearchResult[] = annotations.filter((a) => {
      if (a.text.toLowerCase().includes(q)) return true;
      if (a.tag?.toLowerCase().includes(q)) return true;
      return false;
    }).map((a) => ({
      kind: "annotation" as const,
      title: `Nota: ${a.text.slice(0, 60)}${a.text.length > 60 ? "…" : ""}`,
      detail: a.tag ?? "nota geral",
      timestamp: a.spinTimestamp,
      emoji: "📝",
      onClick: () => navigate("/"),
    }));

    const sessionResults: SearchResult[] = sessions.slice(0, 50).filter((s) => {
      if (matchesNumber !== null) return false;
      const dateStr = new Date(s.startedAt).toLocaleString("pt-BR").toLowerCase();
      if (dateStr.includes(q)) return true;
      return false;
    }).map((s) => ({
      kind: "session" as const,
      title: `Sessão ${new Date(s.startedAt).toLocaleString("pt-BR")}`,
      detail: `${s.rounds} rodadas · PnL ${s.pnl.toFixed(2)} · ${s.respectedLimits ? "respeitou limites" : "ultrapassou"}`,
      timestamp: s.startedAt,
      emoji: "📔",
      onClick: () => navigate("/diario"),
    }));

    let spinResults: SearchResult[] = [];
    if (matchesNumber !== null && matchesNumber >= 0 && matchesNumber <= 36) {
      const recent = spins.slice(0, 500).filter((s) => s.n === matchesNumber).slice(0, 20);
      spinResults = recent.map((s) => ({
        kind: "spin" as const,
        title: `Giro ${s.n}`,
        detail: `${new Date(s.t).toLocaleString("pt-BR")} · origem ${s.source}`,
        timestamp: s.t,
        emoji: "🎲",
        onClick: () => navigate("/"),
      }));
    }

    return [...sigResults, ...annResults, ...sessionResults, ...spinResults]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 30);
  }, [query, signals, annotations, sessions, spins, navigate]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl max-w-2xl w-[calc(100%-2rem)] mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar sinais, anotações, sessões, número específico (0–36)…"
          className="w-full bg-transparent px-4 py-3 text-base outline-none border-b border-neutral-800"
        />
        <div className="max-h-[60vh] overflow-y-auto">
          {query && results.length === 0 ? (
            <div className="p-6 text-center text-sm text-neutral-500">Nada encontrado</div>
          ) : query === "" ? (
            <div className="p-6 text-center text-xs text-neutral-500">
              Digite um número (0-36) para encontrar giros específicos, ou texto para procurar em sinais, anotações e sessões.
            </div>
          ) : (
            results.map((r, i) => (
              <button
                key={i}
                onClick={() => {
                  r.onClick();
                  setOpen(false);
                  setQuery("");
                }}
                className="w-full text-left px-4 py-2.5 flex items-start gap-3 hover:bg-neutral-800/50 border-b border-neutral-800"
              >
                <span className="text-lg shrink-0">{r.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{r.title}</div>
                  <div className="text-[11px] text-neutral-500 truncate">{r.detail}</div>
                </div>
                {r.kind === "spin" && (
                  <div className={`${ballBg(spins.find((s) => s.t === r.timestamp)?.n ?? 0)} text-white text-[10px] font-bold w-6 h-6 rounded flex items-center justify-center shrink-0`}>
                    {spins.find((s) => s.t === r.timestamp)?.n ?? "?"}
                  </div>
                )}
              </button>
            ))
          )}
        </div>
        <div className="border-t border-neutral-800 px-4 py-2 flex items-center justify-between text-[10px] text-neutral-500">
          <span>{results.length} resultado(s)</span>
          <span>Ctrl+F · Esc fecha</span>
        </div>
      </div>
    </div>
  );
});
GlobalSearch.displayName = "GlobalSearch";
export default GlobalSearch;
