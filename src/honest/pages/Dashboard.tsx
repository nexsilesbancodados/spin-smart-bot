import { lazy, memo, Suspense, useState } from "react";
import MasterSignal from "../components/MasterSignal";
import { Card, PageContainer } from "../components/ui";

const RealityCheckBanner = lazy(() => import("../components/RealityCheckBanner"));
const AutoBetPanel = lazy(() => import("../components/AutoBetPanel"));
const DiscordWebhookConfig = lazy(() => import("../components/DiscordWebhookConfig"));
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
const AIInsights = lazy(() => import("../components/AIInsights"));
const BotEnsembleStatus = lazy(() => import("../components/BotEnsembleStatus"));
const MasterBacktest = lazy(() => import("../components/MasterBacktest"));

const Dashboard = memo(() => {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  return (
    <PageContainer>
      <MasterSignal />

      <button
        onClick={() => setAdvancedOpen((v) => !v)}
        className="text-[10px] text-neutral-600 hover:text-amber-300 text-center w-full py-1"
      >
        {advancedOpen ? "▲ ocultar avançado" : "⚙ avançado"}
      </button>

      {advancedOpen && (
        <Suspense
          fallback={
            <Card padding="sm">
              <div className="text-[11px] text-neutral-500 italic py-2 text-center">
                Carregando…
              </div>
            </Card>
          }
        >
          <RealityCheckBanner />
          <DiscordWebhookConfig />
          <AutoBetPanel />
          <MasterBacktest />
          <BotEnsembleStatus />
          <AIInsights />
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
