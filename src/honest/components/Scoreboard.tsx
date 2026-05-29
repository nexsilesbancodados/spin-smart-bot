import { memo, useMemo } from "react";
import { useSignalAgent } from "../lib/signalAgent";
import { Card, SectionHeader } from "./ui";
import { SLOTS } from "../lib/wheel";

const Scoreboard = memo(() => {
  const history = useSignalAgent((s) => s.history);

  const stats = useMemo(() => {
    const resolved = history.filter((s) => s.actualNumber !== null);
    const hitMain = resolved.filter((s) => s.hitMain === true).length;
    const hitTop5 = resolved.filter((s) => s.hitTop5 === true).length;
    const hitTop5OnlyNotMain = resolved.filter((s) => s.hitTop5 === true && s.hitMain !== true).length;
    const miss = resolved.filter((s) => s.hitTop5 === false).length;

    let currentStreak = 0;
    let streakKind: "hit" | "miss" | null = null;
    for (const s of resolved) {
      const isHit = s.hitTop5 === true;
      if (streakKind === null) {
        streakKind = isHit ? "hit" : "miss";
        currentStreak = 1;
      } else if (isHit === (streakKind === "hit")) {
        currentStreak += 1;
      } else {
        break;
      }
    }

    let bestHitStreak = 0;
    let bestMissStreak = 0;
    let curStreak = 0;
    let curKind: boolean | null = null;
    for (const s of [...resolved].reverse()) {
      const isHit = s.hitTop5 === true;
      if (curKind === null || curKind !== isHit) {
        curKind = isHit;
        curStreak = 1;
      } else {
        curStreak++;
      }
      if (isHit && curStreak > bestHitStreak) bestHitStreak = curStreak;
      if (!isHit && curStreak > bestMissStreak) bestMissStreak = curStreak;
    }

    const baseline1 = 1 / SLOTS;
    const baseline5 = 5 / SLOTS;

    return {
      total: resolved.length,
      pending: history.length - resolved.length,
      hitMain,
      hitTop5,
      hitTop5OnlyNotMain,
      miss,
      hitRateMain: resolved.length > 0 ? hitMain / resolved.length : 0,
      hitRateTop5: resolved.length > 0 ? hitTop5 / resolved.length : 0,
      currentStreak,
      streakKind,
      bestHitStreak,
      bestMissStreak,
      baseline1,
      baseline5,
      lift1: resolved.length > 0 ? hitMain / resolved.length / baseline1 : 0,
      lift5: resolved.length > 0 ? hitTop5 / resolved.length / baseline5 : 0,
    };
  }, [history]);

  const last30 = useMemo(() => {
    const resolved = history.filter((s) => s.actualNumber !== null).slice(0, 30);
    return resolved.reverse();
  }, [history]);

  return (
    <Card padding="md">
      <SectionHeader
        title="📊 Placar do Agente"
        subtitle={`${stats.total} sinais resolvidos · ${stats.pending} aguardando próximo giro`}
      />

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
        <ScoreCell
          label="Acertos exatos"
          big={String(stats.hitMain)}
          sub={`${(stats.hitRateMain * 100).toFixed(1)}%`}
          accent="good-strong"
        />
        <ScoreCell
          label="Acertos top-5"
          big={String(stats.hitTop5)}
          sub={`${(stats.hitRateTop5 * 100).toFixed(1)}%`}
          accent="good"
        />
        <ScoreCell
          label="Erros"
          big={String(stats.miss)}
          sub={stats.total > 0 ? `${((stats.miss / stats.total) * 100).toFixed(1)}%` : "—"}
          accent="bad"
        />
        <ScoreCell
          label="Streak atual"
          big={stats.currentStreak > 0 ? `${stats.currentStreak}${stats.streakKind === "hit" ? "✓" : "✗"}` : "—"}
          sub={stats.streakKind === "hit" ? "seguidos acerto" : stats.streakKind === "miss" ? "seguidos erro" : ""}
          accent={stats.streakKind === "hit" ? "good" : stats.streakKind === "miss" ? "bad" : "neutral"}
        />
        <ScoreCell
          label="Melhor série"
          big={`${stats.bestHitStreak}↑`}
          sub={`pior: ${stats.bestMissStreak}↓`}
          accent="info"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold">Últimos {last30.length} sinais</span>
          <span className="text-[10px] text-neutral-500">
            Lift exato {stats.lift1.toFixed(2)}× · top-5 {stats.lift5.toFixed(2)}× vs baseline
          </span>
        </div>
        <div className="flex gap-0.5 flex-wrap">
          {last30.length === 0 ? (
            <div className="text-xs text-neutral-500 py-4 w-full text-center">Aguardando primeiros sinais resolverem…</div>
          ) : (
            last30.map((s) => (
              <div
                key={s.id}
                className={`w-6 h-6 rounded text-[10px] font-bold text-white flex items-center justify-center ${
                  s.hitMain ? "bg-emerald-500" : s.hitTop5 ? "bg-sky-500" : "bg-red-700/70"
                }`}
                title={`Predito ${s.mainPick} · saiu ${s.actualNumber} · ${s.hitMain ? "EXATO" : s.hitTop5 ? "Top 5" : "Erro"}`}
              >
                {s.hitMain ? "✓✓" : s.hitTop5 ? "✓" : "✗"}
              </div>
            ))
          )}
        </div>
        {stats.total > 0 && (
          <div className="flex items-center gap-3 mt-3 text-[10px] text-neutral-400 flex-wrap">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-emerald-500" /> Acerto exato
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-sky-500" /> Top-5
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-red-700/70" /> Errou
            </span>
            <span className="ml-auto text-neutral-500">
              Baseline acaso: exato 2,7% · top-5 13,5%
            </span>
          </div>
        )}
      </div>
    </Card>
  );
});
Scoreboard.displayName = "Scoreboard";

interface ScoreCellProps {
  label: string;
  big: string;
  sub?: string;
  accent: "good-strong" | "good" | "bad" | "neutral" | "info";
}

const ScoreCell = memo(({ label, big, sub, accent }: ScoreCellProps) => {
  const accentColors = {
    "good-strong": "text-emerald-300 border-emerald-700/50 bg-emerald-950/40",
    good: "text-sky-300 border-sky-700/50 bg-sky-950/40",
    bad: "text-red-300 border-red-700/50 bg-red-950/40",
    neutral: "text-neutral-200 border-neutral-700 bg-neutral-900/40",
    info: "text-amber-300 border-amber-700/50 bg-amber-950/30",
  } as const;
  return (
    <div className={`rounded-xl border p-2.5 ${accentColors[accent]}`}>
      <div className="text-[10px] uppercase tracking-wider opacity-70 font-bold">{label}</div>
      <div className="text-2xl font-bold font-mono mt-0.5 leading-none">{big}</div>
      {sub && <div className="text-[10px] opacity-70 mt-1 font-mono">{sub}</div>}
    </div>
  );
});
ScoreCell.displayName = "ScoreCell";

export default Scoreboard;
