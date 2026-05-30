import { lazy, memo, Suspense, useState } from "react";
import MasterSignal from "../components/MasterSignal";
import { Card, PageContainer } from "../components/ui";

const RealityCheckBanner = lazy(() => import("../components/RealityCheckBanner"));
const AutoBetPanel = lazy(() => import("../components/AutoBetPanel"));
const MasterBacktest = lazy(() => import("../components/MasterBacktest"));
const BotEnsembleStatus = lazy(() => import("../components/BotEnsembleStatus"));
const AIInsights = lazy(() => import("../components/AIInsights"));
const IntegrationsStatus = lazy(() => import("../components/IntegrationsStatus"));
const StrategyPresets = lazy(() => import("../components/StrategyPresets"));
const BetTracker = lazy(() => import("../components/BetTracker"));

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
          <IntegrationsStatus />
          <StrategyPresets />
          <BotEnsembleStatus />
          <MasterBacktest />
          <AutoBetPanel />
          <BetTracker />
          <AIInsights />
        </Suspense>
      )}
    </PageContainer>
  );
});
Dashboard.displayName = "Dashboard";

export default Dashboard;
