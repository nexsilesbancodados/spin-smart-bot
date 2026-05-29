import type { BetResult, SessionRecord, SessionState } from "./store";

export interface TiltSignal {
  id:
    | "chasing-stake"
    | "ignoring-stop-loss"
    | "session-too-long"
    | "late-night"
    | "stake-too-large"
    | "consecutive-losing-sessions";
  severity: "info" | "warning" | "critical";
  title: string;
  detail: string;
}

const STAKE_ESCALATION_FACTOR = 1.5;
const STAKE_ESCALATION_COUNT = 3;
const LATE_NIGHT_HOURS = new Set([0, 1, 2, 3, 4, 5]);

export const detectTilt = (params: {
  session: SessionState;
  sessionBets: BetResult[];
  history: SessionRecord[];
  now?: number;
}): TiltSignal[] => {
  const { session, sessionBets, history, now = Date.now() } = params;
  const out: TiltSignal[] = [];

  let escalations = 0;
  for (let i = 1; i < sessionBets.length; i++) {
    const prev = sessionBets[i - 1];
    const cur = sessionBets[i];
    if (prev.delta < 0 && cur.stake > prev.stake * STAKE_ESCALATION_FACTOR) escalations += 1;
  }
  if (escalations >= STAKE_ESCALATION_COUNT) {
    out.push({
      id: "chasing-stake",
      severity: "critical",
      title: "Padrão de chasing detectado",
      detail: `Você aumentou o stake após perda ${escalations} vezes nesta sessão. Esse é o caminho clássico do Martingale — a casa ainda tem 2,70% de vantagem matemática a cada giro. Reduza o stake ao plano original.`,
    });
  }

  if (session.startedAt) {
    const stopAt = session.initial * (1 - session.stopLossPct / 100);
    if (session.current <= stopAt) {
      out.push({
        id: "ignoring-stop-loss",
        severity: "critical",
        title: "Você passou do seu stop loss",
        detail: `Saldo atual abaixo do limite que você mesmo configurou. Continuar agora é tilt. Encerre a sessão.`,
      });
    }
  }

  if (session.startedAt) {
    const minutes = (now - session.startedAt) / 60000;
    if (minutes > session.maxMinutes) {
      out.push({
        id: "session-too-long",
        severity: "warning",
        title: "Sessão extrapolou o tempo máximo",
        detail: `Você está há ${Math.round(minutes)} minutos numa sessão configurada para ${session.maxMinutes} minutos. Cansaço e tempo prolongado são gatilhos de tilt.`,
      });
    }
  }

  const hour = new Date(now).getHours();
  if (LATE_NIGHT_HOURS.has(hour) && session.startedAt) {
    out.push({
      id: "late-night",
      severity: "warning",
      title: "Jogando de madrugada",
      detail: `Horário de risco aumentado (${hour}h). Sessões de madrugada têm taxa de tilt e perdas significativamente maiores em estudos de comportamento de jogo.`,
    });
  }

  if (session.startedAt && session.stake > session.initial * 0.05) {
    out.push({
      id: "stake-too-large",
      severity: "warning",
      title: "Stake muito alto vs. banca",
      detail: `Seu stake (${session.stake}) é maior que 5% da banca inicial. Recomendado: 1–2% por aposta para minimizar risco de ruína.`,
    });
  }

  if (history.length >= 3) {
    const last3 = history.slice(0, 3);
    const allLosses = last3.every((h) => h.pnl < 0);
    if (allLosses) {
      out.push({
        id: "consecutive-losing-sessions",
        severity: "info",
        title: "Três sessões consecutivas no negativo",
        detail: `Você perdeu nas últimas 3 sessões (total: ${last3.reduce((a, b) => a + b.pnl, 0).toFixed(2)}). Considere uma pausa — o resultado esperado de longo prazo é negativo, e tentar "recuperar" é o gatilho clássico do prejuízo maior.`,
      });
    }
  }

  return out;
};

export const aggregateHistory = (history: SessionRecord[]) => {
  if (history.length === 0) {
    return {
      sessions: 0,
      totalPnL: 0,
      totalWagered: 0,
      avgPnL: 0,
      respectedRatio: 0,
      worstLoss: 0,
      bestGain: 0,
    };
  }
  const totalPnL = history.reduce((a, b) => a + b.pnl, 0);
  const totalWagered = history.reduce((a, b) => a + b.rounds * b.stakeAvg, 0);
  const respected = history.filter((h) => h.respectedLimits).length;
  const worstLoss = Math.min(...history.map((h) => h.pnl));
  const bestGain = Math.max(...history.map((h) => h.pnl));
  return {
    sessions: history.length,
    totalPnL,
    totalWagered,
    avgPnL: totalPnL / history.length,
    respectedRatio: respected / history.length,
    worstLoss,
    bestGain,
  };
};
