import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSignalAgent } from "../lib/signalAgent";
import { useFeedStatus } from "../lib/feedStatus";
import { useTheme } from "../lib/theme";
import { ingestProxyNumbers } from "../lib/useLiveFeed";
import { exportBackupJson } from "../lib/backup";

interface Action {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
  category: string;
}

const useActions = (): Action[] => {
  const navigate = useNavigate();
  const toggleTheme = useTheme((s) => s.toggle);
  const setAgentEnabled = useSignalAgent((s) => s.setConfig);
  const agentEnabled = useSignalAgent((s) => s.config.enabled);
  const pollEnabled = useFeedStatus((s) => s.pollEnabled);
  const setPollEnabled = useFeedStatus((s) => s.setPollEnabled);

  const routes = [
    ["/", "Dashboard"],
    ["/jogar", "Jogar"],
    ["/sinais", "Sinais"],
    ["/filtros", "Filtros"],
    ["/backtest", "Backtest"],
    ["/captura", "Captura OCR"],
    ["/roda", "Mapa da roda"],
    ["/analise", "Análise"],
    ["/padroes", "Padrões"],
    ["/regras", "Regras"],
    ["/estrategia", "Editor de estratégia"],
    ["/multi", "Multi-mesa"],
    ["/banca", "Banca"],
    ["/rede", "Rede de aprendizado"],
    ["/correlacoes", "Correlações"],
    ["/replay", "Replay"],
    ["/diario", "Diário"],
    ["/config", "Configuração"],
    ["/insights", "Insights"],
    ["/comparacao", "Comparação A vs B"],
  ];

  return useMemo<Action[]>(
    () => [
      ...routes.map(([path, label]) => ({
        id: `nav-${path}`,
        label: `Ir para ${label}`,
        category: "Navegação",
        run: () => navigate(path),
      })),
      {
        id: "toggle-agent",
        label: agentEnabled ? "Pausar agente" : "Ativar agente",
        category: "Agente",
        hint: "Espaço",
        run: () => setAgentEnabled({ enabled: !agentEnabled }),
      },
      {
        id: "toggle-poll",
        label: pollEnabled ? "Pausar polling" : "Ativar polling",
        category: "Feed",
        hint: "P",
        run: () => setPollEnabled(!pollEnabled),
      },
      {
        id: "refresh",
        label: "Forçar refresh agora",
        category: "Feed",
        hint: "R",
        run: () => ingestProxyNumbers(),
      },
      {
        id: "toggle-theme",
        label: "Alternar tema claro/escuro",
        category: "Aparência",
        run: toggleTheme,
      },
      {
        id: "export-backup",
        label: "Exportar backup JSON",
        category: "Dados",
        run: exportBackupJson,
      },
      {
        id: "show-shortcuts",
        label: "Ver atalhos de teclado",
        category: "Ajuda",
        hint: "?",
        run: () => alert("Ctrl+1..9 navega · R refresh · Espaço agente · P polling · Ctrl+K esta busca · ? ajuda"),
      },
    ],
    [agentEnabled, pollEnabled, navigate, setAgentEnabled, setPollEnabled, toggleTheme]
  );
};

const fuzzyScore = (text: string, query: string): number => {
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  if (!q) return 1;
  let qi = 0;
  let score = 0;
  let lastIdx = -1;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) {
      score += 1;
      if (lastIdx === i - 1) score += 1;
      lastIdx = i;
      qi += 1;
    }
  }
  if (qi < q.length) return 0;
  return score / (t.length + q.length);
};

const CommandPalette = memo(() => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const actions = useActions();

  const filtered = useMemo(() => {
    if (!query.trim()) return actions.slice(0, 20);
    return actions
      .map((a) => ({ a, score: fuzzyScore(`${a.category} ${a.label}`, query) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map((x) => x.a);
  }, [actions, query]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        setQuery("");
        setSelectedIdx(0);
      }
      if (open && e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  if (!open) return null;

  const runSelected = () => {
    const action = filtered[selectedIdx];
    if (!action) return;
    action.run();
    setOpen(false);
    setQuery("");
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl max-w-xl w-[calc(100%-2rem)] mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              runSelected();
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setSelectedIdx((i) => Math.min(filtered.length - 1, i + 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setSelectedIdx((i) => Math.max(0, i - 1));
            }
          }}
          placeholder="Digite para buscar comandos…"
          className="w-full bg-transparent px-4 py-3 text-base outline-none border-b border-neutral-800"
        />
        <div className="max-h-[60vh] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-neutral-500">Nenhum comando encontrado</div>
          ) : (
            filtered.map((a, i) => (
              <button
                key={a.id}
                onClick={() => {
                  setSelectedIdx(i);
                  setTimeout(runSelected, 10);
                }}
                onMouseEnter={() => setSelectedIdx(i)}
                className={`w-full text-left px-4 py-2.5 flex items-center gap-3 ${
                  i === selectedIdx ? "bg-amber-500/15" : "hover:bg-neutral-800/50"
                }`}
              >
                <span className="text-[10px] uppercase tracking-wider text-neutral-500 w-20 shrink-0">
                  {a.category}
                </span>
                <span className="text-sm flex-1">{a.label}</span>
                {a.hint && <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 font-mono">{a.hint}</kbd>}
              </button>
            ))
          )}
        </div>
        <div className="border-t border-neutral-800 px-4 py-2 flex items-center justify-between text-[10px] text-neutral-500">
          <span>↑↓ navegar · Enter executar · Esc fechar</span>
          <span>Ctrl+K abre/fecha</span>
        </div>
      </div>
    </div>
  );
});
CommandPalette.displayName = "CommandPalette";
export default CommandPalette;
