import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useHonestStore, selectWindowSpins } from "../lib/store";
import { useFeedStatus } from "../lib/feedStatus";
import {
  VOISINS,
  TIERS,
  ORPHELINS,
  RED,
  BLACK,
  DOZEN_1,
  DOZEN_2,
  DOZEN_3,
  colorOf,
} from "../lib/wheel";
import { analyzeGroup, chiSquareUniform } from "../lib/stats";
import { sessionPnL } from "../lib/bankroll";
import { HOUSE_EDGE } from "../lib/wheel";
import VerdictBadge from "../components/VerdictBadge";

const DEFAULT_URL = "https://ona.bet.br/live-casino/game/3782786?provider=Playtech&from=%2Flive-casino";
const URL_STORAGE_KEY = "rv-jogar-url";
const SIDEBAR_STORAGE_KEY = "rv-jogar-sidebar";

const fmtMoney = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const cellBg = (n: number) => {
  const c = colorOf(n);
  if (c === "green") return "bg-emerald-600";
  if (c === "red") return "bg-red-600";
  return "bg-neutral-900";
};

const Jogar = memo(() => {
  const spins = useHonestStore(selectWindowSpins);
  const allSpins = useHonestStore((s) => s.spins);
  const session = useHonestStore((s) => s.session);
  const mesa = useFeedStatus((s) => s.mesa);
  const [url, setUrl] = useState(() => localStorage.getItem(URL_STORAGE_KEY) || DEFAULT_URL);
  const [editing, setEditing] = useState(false);
  const [draftUrl, setDraftUrl] = useState(url);
  const [sidebarOpen, setSidebarOpen] = useState(() => localStorage.getItem(SIDEBAR_STORAGE_KEY) !== "0");
  const [iframeBlocked, setIframeBlocked] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    localStorage.setItem(URL_STORAGE_KEY, url);
    setIframeBlocked(false);
  }, [url]);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, sidebarOpen ? "1" : "0");
  }, [sidebarOpen]);

  const sectors = useMemo(
    () => [
      analyzeGroup("Voisins", VOISINS, spins),
      analyzeGroup("Tiers", TIERS, spins),
      analyzeGroup("Orphelins", ORPHELINS, spins),
    ],
    [spins]
  );
  const dozens = useMemo(
    () => [
      analyzeGroup("1ª", DOZEN_1, spins),
      analyzeGroup("2ª", DOZEN_2, spins),
      analyzeGroup("3ª", DOZEN_3, spins),
    ],
    [spins]
  );
  const colors = useMemo(
    () => [
      analyzeGroup("Vermelho", RED, spins),
      analyzeGroup("Preto", BLACK, spins),
      analyzeGroup("Zero", new Set([0]), spins),
    ],
    [spins]
  );
  const chi = useMemo(() => chiSquareUniform(spins), [spins]);
  const pnl = session.startedAt ? sessionPnL(session.initial, session.current) : null;
  const lastSpin = allSpins[0];

  const openExternal = () => window.open(url, "_blank", "noopener,noreferrer");

  return (
    <div className="fixed inset-x-0 bottom-0 top-[105px] flex flex-col bg-neutral-950 z-10">
      <div className="shrink-0 px-3 py-1.5 border-b border-neutral-800 bg-neutral-900/80 flex items-center gap-2 text-xs">
        {editing ? (
          <>
            <input
              value={draftUrl}
              onChange={(e) => setDraftUrl(e.target.value)}
              className="bg-neutral-950 border border-neutral-700 rounded-md px-2 py-1 text-xs flex-1 font-mono"
              placeholder="URL da mesa"
            />
            <button
              onClick={() => {
                setUrl(draftUrl.trim() || DEFAULT_URL);
                setEditing(false);
              }}
              className="px-2 py-1 rounded bg-amber-500 hover:bg-amber-400 text-black font-bold"
            >
              Carregar
            </button>
            <button
              onClick={() => {
                setDraftUrl(url);
                setEditing(false);
              }}
              className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700"
            >
              ✕
            </button>
          </>
        ) : (
          <>
            <span className="text-emerald-400 font-bold tracking-wider text-[10px] shrink-0">
              {mesa ?? "MESA"}
            </span>
            <span className="text-neutral-400 font-mono truncate flex-1" title={url}>
              {url}
            </span>
            <button
              onClick={() => setEditing(true)}
              className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 shrink-0"
            >
              Trocar URL
            </button>
            <button
              onClick={openExternal}
              className="px-2 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-bold shrink-0"
            >
              Nova aba ↗
            </button>
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 shrink-0"
              title={sidebarOpen ? "Esconder painel" : "Mostrar painel"}
            >
              {sidebarOpen ? "Esconder painel →" : "← Mostrar painel"}
            </button>
          </>
        )}
      </div>

      <div className="flex-1 flex min-h-0">
        <div className="flex-1 relative bg-black">
          <iframe
            ref={iframeRef}
            src={url}
            title="Casa de apostas"
            className="absolute inset-0 w-full h-full border-0"
            referrerPolicy="no-referrer-when-downgrade"
            allow="autoplay; encrypted-media; fullscreen; clipboard-read; clipboard-write"
            onError={() => setIframeBlocked(true)}
          />
          {iframeBlocked && (
            <div className="absolute inset-0 flex items-center justify-center bg-neutral-950/95">
              <div className="text-center max-w-md px-6">
                <div className="text-4xl mb-3">🔒</div>
                <p className="font-bold mb-2">A casa bloqueou o embed</p>
                <p className="text-xs text-neutral-400 mb-4">
                  Sites de aposta normalmente proíbem ser carregados dentro de outros sites (X-Frame-Options /
                  CSP). Abra em janela paralela; o painel continua atualizando.
                </p>
                <button
                  onClick={openExternal}
                  className="px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold"
                >
                  Abrir em nova aba
                </button>
              </div>
            </div>
          )}
        </div>

        {sidebarOpen && (
          <aside className="w-72 shrink-0 border-l border-neutral-800 bg-neutral-950 overflow-y-auto p-2 space-y-2">
            <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <h2 className="text-[9px] font-bold uppercase tracking-wider text-neutral-400">Último giro</h2>
                <span className="text-[9px] text-neutral-500 font-mono">{allSpins.length} total</span>
              </div>
              {lastSpin ? (
                <div className="flex items-center gap-2">
                  <div
                    className={`${cellBg(lastSpin.n)} text-white text-lg font-bold w-11 h-11 rounded-md flex items-center justify-center ring-2 ring-amber-400/60`}
                  >
                    {lastSpin.n}
                  </div>
                  <div className="text-[10px] text-neutral-400 leading-snug">
                    <div className="text-neutral-200 font-mono">
                      {new Date(lastSpin.t).toLocaleTimeString("pt-BR")}
                    </div>
                    <div>{lastSpin.source}</div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-neutral-500">Aguardando…</div>
              )}
            </div>

            <Panel title="Setores" badge={`χ² p=${chi.pApprox.toFixed(2)}`} badgeOk={chi.uniformCompatible}>
              {sectors.map((s) => (
                <Row key={s.name} {...s} />
              ))}
            </Panel>

            <Panel title="Dúzias">
              {dozens.map((d) => (
                <Row key={d.name} {...d} />
              ))}
            </Panel>

            <Panel title="Cores">
              {colors.map((c) => (
                <Row key={c.name} {...c} />
              ))}
            </Panel>

            {pnl && (
              <Panel title="Sessão">
                <Line label="Saldo" value={fmtMoney(session.current)} accent={pnl.abs >= 0 ? "good" : "bad"} />
                <Line
                  label="PnL"
                  value={`${pnl.abs >= 0 ? "+" : ""}${pnl.pct.toFixed(1)}%`}
                  accent={pnl.abs >= 0 ? "good" : "bad"}
                />
                <Line
                  label="Perda esperada"
                  value={`−${fmtMoney(session.spinsThisSession * session.stake * HOUSE_EDGE)}`}
                  accent="warn"
                />
              </Panel>
            )}

          </aside>
        )}
      </div>
    </div>
  );
});
Jogar.displayName = "Jogar";

const Panel = memo(
  ({
    title,
    badge,
    badgeOk,
    children,
  }: {
    title: string;
    badge?: string;
    badgeOk?: boolean;
    children: React.ReactNode;
  }) => (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-2.5">
      <div className="flex items-center justify-between mb-1.5">
        <h2 className="text-[9px] font-bold uppercase tracking-wider text-neutral-400">{title}</h2>
        {badge && (
          <span
            className={`text-[8px] px-1.5 py-0.5 rounded border ${
              badgeOk
                ? "bg-emerald-950/40 text-emerald-300 border-emerald-700/40"
                : "bg-orange-950/40 text-orange-300 border-orange-700/40"
            }`}
          >
            {badge}
          </span>
        )}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  )
);
Panel.displayName = "JogarPanel";

interface RowProps {
  name: string;
  observed: number;
  expected: number;
  z: number;
  verdict: ReturnType<typeof analyzeGroup>["verdict"];
}
const Row = memo(({ name, observed, expected, z, verdict }: RowProps) => (
  <div className="flex items-center justify-between text-[10px]">
    <span className="text-neutral-300 truncate">{name}</span>
    <div className="flex items-center gap-1.5 shrink-0">
      <span className="font-mono text-neutral-400">
        {observed}/{expected.toFixed(0)}
      </span>
      <span className={`font-mono ${Math.abs(z) >= 2 ? "text-amber-300" : "text-neutral-500"}`}>
        z={z.toFixed(1)}
      </span>
      <VerdictBadge verdict={verdict} />
    </div>
  </div>
));
Row.displayName = "JogarRow";

const Line = memo(
  ({ label, value, accent }: { label: string; value: string; accent?: "good" | "bad" | "warn" }) => (
    <div className="flex items-center justify-between text-[11px]">
      <span className="text-neutral-400">{label}</span>
      <span
        className={`font-mono font-bold ${
          accent === "good"
            ? "text-emerald-300"
            : accent === "bad"
              ? "text-red-300"
              : accent === "warn"
                ? "text-amber-300"
                : "text-neutral-200"
        }`}
      >
        {value}
      </span>
    </div>
  )
);
Line.displayName = "JogarLine";

export default Jogar;
