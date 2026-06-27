import { memo } from "react";
import { useHonestStore } from "../lib/store";
import SpinList from "../components/SpinList";
import { Card, PageContainer } from "../components/ui";

const Dashboard = memo(() => {
  const spins = useHonestStore((s) => s.spins);
  return (
    <PageContainer>
      <Card padding="sm">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-sm font-bold tracking-tight">Histórico</h1>
          <span className="text-[10px] text-neutral-500 font-mono">{spins.length} giros</span>
        </div>
        <SpinList spins={spins} limit={500} columns={10} cellSize="sm" />
      </Card>
    </PageContainer>
  );
});
Dashboard.displayName = "Dashboard";
export default Dashboard;
