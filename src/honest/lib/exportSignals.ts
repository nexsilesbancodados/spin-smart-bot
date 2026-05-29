import type { SignalRecord } from "./signalAgent";

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

export const exportSignalsCsv = (signals: SignalRecord[]) => {
  const header = [
    "id",
    "timestamp_iso",
    "main_pick",
    "main_prob",
    "confidence",
    "sector",
    "color",
    "top_picks",
    "context_len",
    "actual",
    "resolved_at",
    "hit_main",
    "hit_top5",
    "top_model",
    "top_model_weight",
    "explanation",
  ];
  const lines = [header.join(",")];
  for (const s of signals) {
    const row = [
      s.id,
      new Date(s.t).toISOString(),
      s.mainPick,
      s.mainProb.toFixed(4),
      s.confidenceScore.toFixed(3),
      s.sector,
      s.color,
      s.topPicks.join("|"),
      s.contextLen,
      s.actualNumber ?? "",
      s.resolvedAt ? new Date(s.resolvedAt).toISOString() : "",
      s.hitMain === null ? "" : s.hitMain ? "1" : "0",
      s.hitTop5 === null ? "" : s.hitTop5 ? "1" : "0",
      s.modelContributions?.[0]?.name ?? "",
      s.modelContributions?.[0]?.weight.toFixed(2) ?? "",
      s.explanation?.join(" · ") ?? "",
    ].map(csvEscape);
    lines.push(row.join(","));
  }
  downloadFile(`sinais-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`, lines.join("\n"));
};
