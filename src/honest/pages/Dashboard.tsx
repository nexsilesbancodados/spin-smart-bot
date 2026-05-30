import { lazy, memo, Suspense, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useHonestStore } from "../lib/store";
import { sessionPnL } from "../lib/bankroll";
import { useSignalAgent } from "../lib/signalAgent";
import { useUiPrefs } from "../lib/uiPrefs";
import MasterSignal from "../components/MasterSignal";
import { Card, PageContainer, Button } from "../components/ui";

const RealityCheckBanner = lazy(() => import("../components/RealityCheckBanner"));
const BetCalculator = lazy(() => import("../components/BetCalculator"));
const HotColdWheel = lazy(() => import("../components/HotColdWheel"));
const BetTracker = lazy(() => import("../components/BetTracker"));
const SectorHeatmap = lazy(() => import("../components/SectorHeatmap"));
const MonteCarloSim = lazy(() => import("../components/MonteCarloSim"));
const RecurrenceFinder = lazy(() => import("../components/RecurrenceFinder"));
const NumberFrequency = lazy(() => import("../components/NumberFrequency"));
const HourlyHeatmap = lazy(() => import("../components/HourlyHeatmap"));
const StrategyPresets = lazy(() => import("../components/StrategyPresets"));
const WheelBiasDetector = lazy(() => import("../components/WheelBiasDetector"));
const TransitionMatrix = lazy(() => import("../components/TransitionMatrix"));
const RunsTest = lazy(() => import("../components/RunsTest"));
const Autocorrelation = lazy(() => import("../components/Autocorrelation"));
const CalibrationCurve = lazy(() => import("../components/CalibrationCurve"));
const WheelDistanceAnalyzer = lazy(() => import("../components/WheelDistanceAnalyzer"));
const EntropyTracker = lazy(() => import("../components/EntropyTracker"));
const MetaIntelligence = lazy(() => import("../components/MetaIntelligence"));

const fmtMoney = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const Dashboard = memo(() => {
  const spins = useHonestStore((s) => s.spins);
  const session = useHonestStore((s) => s.session);
  const endSession = useHonestStore((s) => s.endSession);
  const agentEnabled = useSignalAgent((s) => s.config.enabled);
  const compact = useUiPrefs((s) => s.compact);
  const toggleCompact = useUiPrefs((s) => s.toggleCompact);
  const [elapsed, setElapsed] = useState("00:00");
  const [toolsOpen, setToolsOpen] = useState(false);
  const [realityOpen, setRealityOpen] = useState(false);

  useEffect(() => {
    if (!session.startedAt) return;
    const tick = () => {
      const diff = Math.floor((Date.now() - session.startedAt!) / 1000);
      const m = Math.floor(diff / 60);
      const s = diff % 60;
      setElapsed(`${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [session.startedAt]);

  const pnl = sessionPnL(session.initial, session.current);
  const sessionActive = !!session.startedAt;
  const stopAt = session.initial * (1 - session.stopLossPct / 100);
  const targetAt = session.initial * (1 + session.targetPct / 100);
  const hitStop = sessionActive && session.current <= stopAt;
  const hitTarget = sessionActive && session.current >= targetAt;
  const hitRounds = sessionActive && session.spinsThisSession >= session.maxRounds;

  return (
    <PageContainer>
      <MasterSignal />

      {sessionActive && (hitStop || hitTarget || hitRounds) && (
        <Card accent={hitStop ? "bad" : hitTarget ? "good" : "warn"} padding="sm">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-sm font-bold">
              {hitStop && "Stop loss atingido."}
              {hitTarget && "Meta atingida."}
              {hitRounds && "Limite de rodadas atingido."}
            </span>
            <Button variant="danger" size="sm" onClick={endSession}>
              Encerrar sessão
            </Button>
          </div>
        </Card>
      )}

      {sessionActive && (
        <div className="text-[10px] text-neutral-400 text-center font-mono">
          <span className="text-emerald-400 font-bold">● {elapsed}</span> ·{" "}
          <span className={pnl.abs >= 0 ? "text-emerald-300" : "text-red-300"}>
            {fmtMoney(session.current)} ({pnl.abs >= 0 ? "+" : ""}
            {pnl.pct.toFixed(1)}%)
          </span>{" "}
          · {session.spinsThisSession}/{session.maxRounds} rodadas
        </div>
      )}

      <div className="flex items-center justify-center gap-3 text-[10px] text-neutral-500">
        {!sessionActive && (
          <Link to="/banca" className="text-amber-300 hover:underline font-semibold">
            Iniciar sessão →
          </Link>
        )}
        <button
          onClick={() => setRealityOpen((v) => !v)}
          className="hover:text-amber-300"
        >
          {realityOpen ? "▲ ocultar" : "▼"} reality check
        </button>
        <span>·</span>
        <button
          onClick={() => setToolsOpen((v) => !v)}
          className="hover:text-amber-300"
        >
          {toolsOpen ? "▲ ocultar" : "▼"} ferramentas
        </button>
        <span>·</span>
        <button
          onClick={toggleCompact}
          className={compact ? "text-amber-300" : "hover:text-amber-300"}
        >
          {compact ? "▣" : "▢"}
        </button>
        <span>·</span>
        <span className="font-mono text-neutral-600">
          {spins.length}g · agente {agentEnabled ? "ON" : "OFF"}
        </span>
      </div>

      {realityOpen && (
        <Suspense fallback={null}>
          <RealityCheckBanner />
        </Suspense>
      )}

      {toolsOpen && (
        <Suspense
          fallback={
            <Card padding="sm">
              <div className="text-[11px] text-neutral-500 italic py-2 text-center">
                Carregando ferramentas…
              </div>
            </Card>
          }
        >
          <MetaIntelligence />
          <StrategyPresets />
          <CalibrationCurve />
          <BetCalculator />
          <HotColdWheel />
          <SectorHeatmap />
          <NumberFrequency />
          <WheelBiasDetector />
          <WheelDistanceAnalyzer />
          <EntropyTracker />
          <RunsTest />
          <Autocorrelation />
          <TransitionMatrix />
          <RecurrenceFinder />
          <HourlyHeatmap />
          <BetTracker />
          <MonteCarloSim />
        </Suspense>
      )}
    </PageContainer>
  );
});
Dashboard.displayName = "Dashboard";

export default Dashboard;
