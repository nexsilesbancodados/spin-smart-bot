import { memo, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useHonestStore } from "../lib/store";
import { sessionPnL } from "../lib/bankroll";
import { HOUSE_EDGE, colorOf } from "../lib/wheel";
import { useSignalAgent } from "../lib/signalAgent";
import SignalPanel from "../components/SignalPanel";
import BestBetRecommendation from "../components/BestBetRecommendation";
import PatternMatchPanel from "../components/PatternMatchPanel";
import AnomalyBanner from "../components/AnomalyBanner";
import TiltAlerts from "../components/TiltAlerts";
import Scoreboard from "../components/Scoreboard";
import { useFeedStatus } from "../lib/feedStatus";
import { ingestProxyNumbers } from "../lib/useLiveFeed";
import { Card, PageContainer, Stat, StatGrid, Button } from "../components/ui";

const fmtMoney = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const ballBg = (n: number) => {
  const c = colorOf(n);
  if (c === "green") return "bg-emerald-600";
  if (c === "red") return "bg-red-600";
  return "bg-neutral-900";
};

const Dashboard = memo(() => {
  const spins = useHonestStore((s) => s.spins);
  const session = useHonestStore((s) => s.session);
  const endSession = useHonestStore((s) => s.endSession);
  const lastPoll = useFeedStatus((s) => s.lastPoll);
  const mesa = useFeedStatus((s) => s.mesa);
  const errorMessage = useFeedStatus((s) => s.errorMessage);
  const agentEnabled = useSignalAgent((s) => s.config.enabled);
  const [elapsed, setElapsed] = useState("00:00");
  const [fetching, setFetching] = useState(false);

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

  const refresh = async () => {
    setFetching(true);
    try {
      await ingestProxyNumbers();
    } finally {
      setFetching(false);
    }
  };

  const pnl = sessionPnL(session.initial, session.current);
  const sessionActive = !!session.startedAt;
  const stopAt = session.initial * (1 - session.stopLossPct / 100);
  const targetAt = session.initial * (1 + session.targetPct / 100);
  const hitStop = sessionActive && session.current <= stopAt;
  const hitTarget = sessionActive && session.current >= targetAt;
  const hitRounds = sessionActive && session.spinsThisSession >= session.maxRounds;
  const totalWagered = session.spinsThisSession * session.stake;
  const expectedLossNow = totalWagered * HOUSE_EDGE;
  const recent = spins.slice(0, 20);
  const fmtAgo = lastPoll ? Math.floor((Date.now() - lastPoll) / 1000) : null;

  return (
    <PageContainer>
      <Card padding="sm">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <span className={`w-2 h-2 rounded-full ${lastPoll && Date.now() - lastPoll < 10000 ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
            <div>
              <h2 className="text-base font-bold tracking-tight">{mesa ?? "Roleta Brasileira"}</h2>
              <p className="text-[10px] text-neutral-500 font-mono">
                {fmtAgo !== null ? `${fmtAgo}s atrás` : "—"} · {spins.length} giros · agente {agentEnabled ? "ON" : "OFF"}
              </p>
            </div>
          </div>
          <Button size="sm" variant="primary" onClick={refresh} disabled={fetching}>
            {fetching ? "…" : "↻ Atualizar"}
          </Button>
        </div>

        {recent.length > 0 && (
          <div className="grid grid-cols-10 gap-1 mt-3">
            {recent.map((s, i) => (
              <div
                key={`${s.t}-${i}`}
                className={`${ballBg(s.n)} text-white text-[12px] font-bold h-8 rounded-md flex items-center justify-center ${
                  i === 0 ? "ring-2 ring-amber-400" : ""
                }`}
                title={new Date(s.t).toLocaleTimeString("pt-BR")}
              >
                {s.n}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Scoreboard />

      <AnomalyBanner />
      <TiltAlerts />

      <BestBetRecommendation />

      <SignalPanel />

      <PatternMatchPanel />

      {sessionActive && (hitStop || hitTarget || hitRounds) && (
        <Card accent={hitStop ? "bad" : hitTarget ? "good" : "warn"}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="font-bold text-base">
                {hitStop && "Stop loss atingido."}
                {hitTarget && "Meta atingida."}
                {hitRounds && "Limite de rodadas atingido."}
              </p>
              <p className="text-xs text-neutral-400 mt-1">Encerrar agora preserva os limites configurados.</p>
            </div>
            <Button variant="danger" onClick={endSession}>Encerrar sessão</Button>
          </div>
        </Card>
      )}

      {sessionActive && (
        <StatGrid cols={3}>
          <Stat label="Sessão" value={<span className="text-emerald-400">● {elapsed}</span>} sub={`Iniciada com ${fmtMoney(session.initial)}`} />
          <Stat
            label="Saldo"
            value={fmtMoney(session.current)}
            sub={`${pnl.abs >= 0 ? "+" : ""}${pnl.pct.toFixed(1)}%`}
            accent={pnl.abs >= 0 ? "good" : "bad"}
          />
          <Stat label="Perda esperada" value={`−${fmtMoney(expectedLossNow)}`} sub={`${session.spinsThisSession} rodadas × 2,7%`} accent="warn" />
        </StatGrid>
      )}

      {!sessionActive && (
        <Card padding="sm">
          <Link to="/banca" className="text-amber-300 hover:underline font-semibold text-sm">
            Iniciar sessão →
          </Link>
          <span className="text-xs text-neutral-500 ml-2">para ativar gestão de banca e diário</span>
        </Card>
      )}

      {errorMessage && (
        <Card accent="bad" padding="sm">
          <p className="text-xs text-red-300 font-mono">⚠ {errorMessage}</p>
        </Card>
      )}
    </PageContainer>
  );
});
Dashboard.displayName = "Dashboard";

export default Dashboard;
