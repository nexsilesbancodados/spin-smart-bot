import type { Spin, SessionRecord } from "./store";

const downloadFile = (filename: string, content: string, mime = "text/csv;charset=utf-8") => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const csvEscape = (v: unknown): string => {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

const toCsv = <T,>(rows: T[], columns: Array<{ key: keyof T | string; label: string }>): string => {
  const header = columns.map((c) => csvEscape(c.label)).join(",");
  const lines = rows.map((r) =>
    columns
      .map((c) => {
        const value = (r as Record<string, unknown>)[c.key as string];
        return csvEscape(value);
      })
      .join(",")
  );
  return [header, ...lines].join("\n");
};

export const exportSpinsCsv = (spins: Spin[], filename = "roleta-vision-giros.csv") => {
  const rows = spins.map((s) => ({
    number: s.n,
    timestamp_iso: new Date(s.t).toISOString(),
    source: s.source,
  }));
  const csv = toCsv(rows, [
    { key: "number", label: "Número" },
    { key: "timestamp_iso", label: "Timestamp ISO" },
    { key: "source", label: "Origem" },
  ]);
  downloadFile(filename, csv);
};

export const exportHistoryCsv = (history: SessionRecord[], filename = "roleta-vision-sessoes.csv") => {
  const rows = history.map((h) => ({
    id: h.id,
    started: new Date(h.startedAt).toISOString(),
    ended: new Date(h.endedAt).toISOString(),
    initial: h.initial.toFixed(2),
    final: h.final.toFixed(2),
    pnl: h.pnl.toFixed(2),
    pnl_pct: h.pnlPct.toFixed(2),
    rounds: h.rounds,
    stake_avg: h.stakeAvg.toFixed(2),
    stop_loss_pct: h.stopLossPct,
    target_pct: h.targetPct,
    reached_stop: h.reachedStop ? "1" : "0",
    reached_target: h.reachedTarget ? "1" : "0",
    bet_type: h.betType,
    worst_streak: h.worstStreak,
    respected_limits: h.respectedLimits ? "1" : "0",
  }));
  const csv = toCsv(rows, [
    { key: "id", label: "ID" },
    { key: "started", label: "Iniciada" },
    { key: "ended", label: "Encerrada" },
    { key: "initial", label: "Banca inicial" },
    { key: "final", label: "Banca final" },
    { key: "pnl", label: "PnL" },
    { key: "pnl_pct", label: "PnL %" },
    { key: "rounds", label: "Rodadas" },
    { key: "stake_avg", label: "Stake médio" },
    { key: "stop_loss_pct", label: "Stop loss %" },
    { key: "target_pct", label: "Meta %" },
    { key: "reached_stop", label: "Bateu stop loss" },
    { key: "reached_target", label: "Bateu meta" },
    { key: "bet_type", label: "Tipo aposta" },
    { key: "worst_streak", label: "Pior sequência de perdas" },
    { key: "respected_limits", label: "Respeitou limites" },
  ]);
  downloadFile(filename, csv);
};
