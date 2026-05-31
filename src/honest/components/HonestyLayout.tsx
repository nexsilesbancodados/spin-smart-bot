import { memo, useState, useRef, useEffect, type ReactNode } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useLiveFeed } from "../lib/useLiveFeed";
import FeedStatusIndicator from "./FeedStatusIndicator";
import LiveHistoryBar from "./LiveHistoryBar";
import OnboardingTour from "./OnboardingTourV2";
import SignalFAB from "./SignalFAB";
import QuickBetFAB from "./QuickBetFAB";
import Toaster from "./Toaster";
import PwaInstall from "./PwaInstall";
import UserMenu from "./UserMenu";
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

  void groupRef;
  void openGroup;
  void groups;
  void isGroupActive;

  return (
    <div className="min-h-screen flex flex-col bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-800/80 bg-neutral-950/85 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-3">
          <NavLink to="/" className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-neutral-950 text-xs font-black shadow-md shadow-amber-500/30">
              R
            </div>
            <div className="leading-none hidden sm:block">
              <div className="text-[11px] font-bold tracking-tight">Roleta Vision</div>
              <div className="text-[9px] text-neutral-500 mt-0.5">tela única · sinal mestre</div>
            </div>
          </NavLink>
          <div className="ml-auto shrink-0 flex items-center gap-2">
            <PwaInstall />
            <GameTimer />
            <button
              onClick={toggleTheme}
              title={`Tema ${theme === "dark" ? "claro" : "escuro"}`}
              className="px-2 py-1 rounded-md bg-neutral-800 hover:bg-neutral-700 text-xs"
            >
              {theme === "dark" ? "☀" : "🌙"}
            </button>
            <FeedStatusIndicator />
            <UserMenu />
          </div>
        </div>
      </header>
      <LiveHistoryBar />
      <main className="flex-1 max-w-7xl mx-auto w-full px-3 sm:px-5 py-4 sm:py-6 pb-16">
        <ErrorBoundary>{children ?? <Outlet />}</ErrorBoundary>
      </main>
      <QuickBetFAB />
      <Toaster />
    </div>
  );
});
HonestyLayout.displayName = "HonestyLayout";
export default HonestyLayout;
