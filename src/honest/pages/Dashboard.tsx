import { memo, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useHonestStore } from "../lib/store";
import { sessionPnL } from "../lib/bankroll";
import { colorOf } from "../lib/wheel";
import { useSignalAgent } from "../lib/signalAgent";
import SignalPanel from "../components/SignalPanel";
import BestBetRecommendation from "../components/BestBetRecommendation";
import AnomalyBanner from "../components/AnomalyBanner";
import TiltAlerts from "../components/TiltAlerts";
import Scoreboard from "../components/Scoreboard";
import { Card, PageContainer, Button } from "../components/ui";

const fmtMoney = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const ballBg = (n: number) => {
  const c = colorOf(n);
  if (c === "green") return "bg-emerald-600";
  if (c === "red") return "bg-gradient-to-br from-red-500 to-red-700";
  return "bg-gradient-to-br from-neutral-700 to-neutral-900";
};

const Dashboard = memo(() => {
  const spins = useHonestStore((s) => s.spins);
  const session = useHonestStore((s) => s.session);
  const endSession = useHonestStore((s) => s.endSession);
  const agentEnabled = useSignalAgent((s) => s.config.enabled);
  const [elapsed, setElapsed] = useState("00:00");

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
  const last8 = spins.slice(0, 8);

  return (
    <PageContainer>
      <BestBetRecommendation />

      <SignalPanel />

      <Scoreboard />

      <AnomalyBanner />
      <TiltAlerts />

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
        <Card padding="sm">
          <div className="flex items-center justify-between gap-3 text-xs flex-wrap">
            <span className="flex items-center gap-2">
              <span className="text-emerald-400 font-bold">● {elapsed}</span>
              <span className="text-neutral-400">·</span>
              <span className={pnl.abs >= 0 ? "text-emerald-300" : "text-red-300"}>
                {fmtMoney(session.current)} ({pnl.abs >= 0 ? "+" : ""}
                {pnl.pct.toFixed(1)}%)
              </span>
            </span>
            <span className="text-neutral-500 font-mono">
              {session.spinsThisSession}/{session.maxRounds} rodadas
            </span>
          </div>
        </Card>
      )}

      {!sessionActive && (
        <div className="flex items-center justify-between gap-2 text-[11px] text-neutral-500 px-2">
          <span>
            <Link to="/banca" className="text-amber-300 hover:underline font-semibold">
              Iniciar sessão →
            </Link>{" "}
            para gestão de banca
          </span>
          <span className="font-mono">
            {spins.length} giros · agente {agentEnabled ? "ON" : "OFF"}
          </span>
        </div>
      )}

      {last8.length > 0 && (
        <Card padding="sm">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] uppercase tracking-[0.18em] font-black text-amber-400/80">
              Últimos giros
            </span>
            <Link to="/analise" className="text-[10px] text-neutral-500 hover:text-amber-300">
              ver mais →
            </Link>
          </div>
          <div className="flex gap-1.5">
            {last8.map((s, i) => (
              <div
                key={`${s.t}-${i}`}
                className={`${ballBg(s.n)} text-white text-[13px] font-bold w-9 h-9 rounded-full flex items-center justify-center shadow-md ${
                  i === 0 ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-neutral-950" : "ring-1 ring-white/10"
                }`}
                title={new Date(s.t).toLocaleTimeString("pt-BR")}
              >
                {s.n}
              </div>
            ))}
          </div>
        </Card>
      )}
    </PageContainer>
  );
});
Dashboard.displayName = "Dashboard";

export default Dashboard;
