import { memo, useState, useRef, useEffect, type ReactNode } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useLiveFeed } from "../lib/useLiveFeed";
import FeedStatusIndicator from "./FeedStatusIndicator";
import LiveHistoryBar from "./LiveHistoryBar";
import OnboardingTour from "./OnboardingTourV2";
import SignalFAB from "./SignalFAB";
import QuickBetFAB from "./QuickBetFAB";
import Toaster from "./Toaster";
import CommandPalette from "./CommandPalette";
import GlobalSearch from "./GlobalSearch";
import DigestPopup from "./DigestPopup";
import GameTimer from "./GameTimer";
import { ErrorBoundary } from "./ErrorBoundary";
import { useShortcuts } from "../lib/shortcuts";
import { useApplyTheme, useTheme } from "../lib/theme";

interface NavGroup {
  label: string;
  emoji?: string;
  primary: string;
  routes: Array<{ to: string; label: string; end?: boolean }>;
}

const groups: NavGroup[] = [
  {
    label: "Painel",
    emoji: "🏠",
    primary: "/",
    routes: [
      { to: "/", label: "Dashboard", end: true },
      { to: "/insights", label: "Insights" },
    ],
  },
  {
    label: "Sinais",
    emoji: "🎯",
    primary: "/sinais",
    routes: [
      { to: "/sinais", label: "Sinais ao vivo" },
      { to: "/filtros", label: "Filtros" },
      { to: "/estrategia", label: "Editor estratégia" },
      { to: "/backtest", label: "Backtest" },
      { to: "/cobertura", label: "Coverage Calc" },
    ],
  },
  {
    label: "Mesa",
    emoji: "🎰",
    primary: "/jogar",
    routes: [
      { to: "/jogar", label: "Jogar ao vivo" },
      { to: "/captura", label: "Captura OCR" },
      { to: "/multi", label: "Multi-mesa" },
      { to: "/roda", label: "Mapa da roda" },
    ],
  },
  {
    label: "Análise",
    emoji: "📊",
    primary: "/analise",
    routes: [
      { to: "/analise", label: "Análise" },
      { to: "/duzias", label: "🎯 Dúzias (deep)" },
      { to: "/sinais-padroes", label: "🎯 Sinais por padrão" },
      { to: "/padroes", label: "Padrões" },
      { to: "/correlacoes", label: "Correlações" },
      { to: "/comparacao", label: "Comparação A vs B" },
      { to: "/regras", label: "Regras customizadas" },
    ],
  },
  {
    label: "IA",
    emoji: "🧠",
    primary: "/rede",
    routes: [
      { to: "/rede", label: "Rede neural" },
      { to: "/replay", label: "Replay" },
    ],
  },
  {
    label: "Banca",
    emoji: "💰",
    primary: "/banca",
    routes: [
      { to: "/banca", label: "Gestão de banca" },
      { to: "/diario", label: "Diário de sessões" },
    ],
  },
  {
    label: "Config",
    emoji: "⚙",
    primary: "/config",
    routes: [{ to: "/config", label: "Configuração" }],
  },
];

const HonestyLayout = memo(({ children }: { children?: ReactNode }) => {
  useLiveFeed(true);
  useShortcuts();
  useApplyTheme();
  const theme = useTheme((s) => s.theme);
  const toggleTheme = useTheme((s) => s.toggle);
  const location = useLocation();
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const groupRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setOpenGroup(null);
  }, [location.pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (groupRef.current && !groupRef.current.contains(e.target as Node)) setOpenGroup(null);
    };
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, []);

  const isGroupActive = (g: NavGroup) =>
    g.routes.some((r) => (r.end ? location.pathname === r.to : location.pathname.startsWith(r.to) && r.to !== "/"));

  return (
    <div className="min-h-screen flex flex-col bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-800/80 bg-neutral-950/85 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center gap-4">
          <NavLink to="/" className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-neutral-950 text-sm font-black shadow-md shadow-amber-500/30">
              R
            </div>
            <div className="leading-none hidden sm:block">
              <div className="text-sm font-bold tracking-tight">Roleta Vision</div>
            </div>
          </NavLink>
          <nav className="hidden md:flex items-center gap-1 ml-2 relative" ref={groupRef}>
            {groups.map((g) => {
              const active = isGroupActive(g);
              const isOpen = openGroup === g.label;
              const hasMultiple = g.routes.length > 1;
              return (
                <div key={g.label} className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (hasMultiple) setOpenGroup(isOpen ? null : g.label);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                      active ? "bg-neutral-800 text-neutral-50" : "text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/50"
                    }`}
                  >
                    {g.emoji && <span>{g.emoji}</span>}
                    <span>{g.label}</span>
                    {hasMultiple && (
                      <svg className={`w-3 h-3 transition ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    )}
                  </button>
                  {isOpen && hasMultiple && (
                    <div className="absolute top-full left-0 mt-1 min-w-[220px] bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl py-1 z-50">
                      {g.routes.map((r) => (
                        <NavLink
                          key={r.to}
                          to={r.to}
                          end={r.end}
                          onClick={() => setOpenGroup(null)}
                          className={({ isActive }) =>
                            `block px-3 py-2 text-sm transition ${
                              isActive ? "bg-amber-500/15 text-amber-300" : "text-neutral-300 hover:bg-neutral-800"
                            }`
                          }
                        >
                          {r.label}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
          <div className="ml-auto shrink-0 flex items-center gap-2">
            <GameTimer />
            <button
              onClick={toggleTheme}
              title={`Tema ${theme === "dark" ? "claro" : "escuro"}`}
              className="px-2 py-1 rounded-md bg-neutral-800 hover:bg-neutral-700 text-xs"
            >
              {theme === "dark" ? "☀" : "🌙"}
            </button>
            <FeedStatusIndicator />
          </div>
        </div>
        <div className="md:hidden border-t border-neutral-800/60 overflow-x-auto">
          <div className="flex gap-1 px-3 py-1.5 min-w-min">
            {groups.flatMap((g) =>
              g.routes.map((r) => (
                <NavLink
                  key={r.to}
                  to={r.to}
                  end={r.end}
                  className={({ isActive }) =>
                    `px-2.5 py-1 rounded-md text-[12px] font-medium whitespace-nowrap transition shrink-0 ${
                      isActive ? "bg-amber-500/20 text-amber-300" : "text-neutral-400 hover:bg-neutral-800/50"
                    }`
                  }
                >
                  {r.label}
                </NavLink>
              ))
            )}
          </div>
        </div>
      </header>
      <LiveHistoryBar />
      <main className="flex-1 max-w-7xl mx-auto w-full px-3 sm:px-5 py-4 sm:py-6 pb-16">
        <ErrorBoundary>{children ?? <Outlet />}</ErrorBoundary>
      </main>
      <SignalFAB />
      <QuickBetFAB />
      <Toaster />
      <CommandPalette />
      <GlobalSearch />
      <DigestPopup />
      <OnboardingTour />
    </div>
  );
});
HonestyLayout.displayName = "HonestyLayout";
export default HonestyLayout;
