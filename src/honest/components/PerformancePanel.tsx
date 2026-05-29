import { memo, useEffect, useState } from "react";
import { usePerf, getCurrentFps, getMemoryMb } from "../lib/perf";
import { useHonestStore } from "../lib/store";
import { useSignalAgent } from "../lib/signalAgent";
import { Card, SectionHeader, Stat, StatGrid } from "./ui";

const PerformancePanel = memo(() => {
  const agentHistory = usePerf((s) => s.agentTickHistory);
  const totalSpins = useHonestStore((s) => s.spins.length);
  const totalSignals = useSignalAgent((s) => s.history.length);
  const [fps, setFps] = useState(0);
  const [memMb, setMemMb] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => {
      setFps(getCurrentFps());
      setMemMb(getMemoryMb());
    };
    tick();
    const t = setInterval(tick, 1500);
    return () => clearInterval(t);
  }, []);

  const avgTick =
    agentHistory.length > 0 ? agentHistory.reduce((a, b) => a + b, 0) / agentHistory.length : 0;
  const maxTick = agentHistory.length > 0 ? Math.max(...agentHistory) : 0;

  return (
    <Card>
      <SectionHeader title="Performance" subtitle="Métricas do navegador e do agente" />
      <StatGrid cols={4}>
        <Stat
          label="FPS"
          value={fps > 0 ? fps.toFixed(0) : "—"}
          sub="frames por segundo"
          accent={fps >= 50 ? "good" : fps >= 30 ? "warn" : "bad"}
        />
        <Stat
          label="Memória JS"
          value={memMb !== null ? `${memMb.toFixed(1)} MB` : "—"}
          sub={memMb !== null ? "heap usado" : "indisponível neste navegador"}
        />
        <Stat
          label="Tick do agente (méd)"
          value={`${avgTick.toFixed(1)} ms`}
          sub={`máx ${maxTick.toFixed(1)} ms · ${agentHistory.length} amostras`}
          accent={avgTick < 50 ? "good" : avgTick < 150 ? "warn" : "bad"}
        />
        <Stat label="Carga" value={`${totalSpins} giros`} sub={`${totalSignals} sinais`} />
      </StatGrid>
    </Card>
  );
});
PerformancePanel.displayName = "PerformancePanel";
export default PerformancePanel;
