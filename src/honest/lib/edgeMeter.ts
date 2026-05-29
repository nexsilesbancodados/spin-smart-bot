import { HOUSE_EDGE } from "./wheel";
import type { SessionRecord } from "./store";

export interface EdgePoint {
  sessionIndex: number;
  cumulativeWagered: number;
  cumulativePnL: number;
  realizedEdge: number;
  expectedEdge: number;
  endedAt: number;
}

export const buildEdgeSeries = (history: SessionRecord[]): EdgePoint[] => {
  if (history.length === 0) return [];
  const chronological = history.slice().reverse();
  let cumWager = 0;
  let cumPnL = 0;
  const out: EdgePoint[] = [];
  chronological.forEach((s, i) => {
    const wagered = s.rounds * s.stakeAvg;
    cumWager += wagered;
    cumPnL += s.pnl;
    const realized = cumWager > 0 ? cumPnL / cumWager : 0;
    out.push({
      sessionIndex: i + 1,
      cumulativeWagered: cumWager,
      cumulativePnL: cumPnL,
      realizedEdge: realized,
      expectedEdge: -HOUSE_EDGE,
      endedAt: s.endedAt,
    });
  });
  return out;
};

export const computeOverallEdge = (history: SessionRecord[]) => {
  const totalWager = history.reduce((a, b) => a + b.rounds * b.stakeAvg, 0);
  const totalPnL = history.reduce((a, b) => a + b.pnl, 0);
  return {
    totalWager,
    totalPnL,
    realizedEdge: totalWager > 0 ? totalPnL / totalWager : 0,
    expectedEdge: -HOUSE_EDGE,
    convergedSessions: history.length,
  };
};
