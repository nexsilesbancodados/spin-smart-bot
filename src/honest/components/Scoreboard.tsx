import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useSignalAgent } from "../lib/signalAgent";
import { useHonestStore } from "../lib/store";
import { Card, SectionHeader, Pill } from "./ui";
import { SLOTS, colorOf } from "../lib/wheel";

const ballBg = (n: number) => {
  const c = colorOf(n);
  if (c === "green") return "bg-emerald-600";
  if (c === "red") return "bg-red-600";
  return "bg-neutral-800";
};

const fmtAgo = (ms: number): string => {
  if (ms < 1000) return "agora";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min`;
  return `${Math.floor(m / 60)}h`;
};

const Scoreboard = memo(() => {
  const history = useSignalAgent((s) => s.history);
  const pending = useSignalAgent((s) => s.pending);
  const latest = useSignalAgent((s) => s.latest);
  const agentEnabled = useSignalAgent((s) => s.config.enabled);
  const lastSpin = useHonestStore((s) => s.spins[0]);
  const [, setNow] = useState(Date.now());
  const prevCountRef = useRef({ exact: 0, top5: 0, miss: 0 });
  const [flash, setFlash] = useState<"hit" | "miss" | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  const stats = useMemo(() => {
    const resolved = history.filter((s) => s.actualNumber !== null);
    const hitMain = resolved.filter((s) => s.hitMain === true).length;
    const hitTop5 = resolved.filter((s) => s.hitTop5 === true).length;
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

    const wilsonInterval = (hits: number, n: number, z = 1.96): [number, number] => {
      if (n === 0) return [0, 0];
      const p = hits / n;
      const denom = 1 + (z * z) / n;
      const center = (p + (z * z) / (2 * n)) / denom;
      const margin = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
      return [Math.max(0, center - margin), Math.min(1, center + margin)];
    };
    const ciMain = wilsonInterval(hitMain, resolved.length);
    const ciTop5 = wilsonInterval(hitTop5, resolved.length);

    const lastResolved = resolved[0];
    const timeSinceLastResolution = lastResolved ? Date.now() - (lastResolved.resolvedAt ?? lastResolved.t) : null;

    const rollingHitRate: number[] = [];
    const windowSize = 20;
    for (let i = resolved.length - 1; i >= 0; i -= 1) {
      const window = resolved.slice(Math.max(0, i - windowSize + 1), i + 1);
      if (window.length >= 3) {
        rollingHitRate.push(window.filter((s) => s.hitTop5).length / window.length);
      }
    }

    let brierMain = 0;
    let brierTop = 0;
    for (const s of resolved) {
      const pMain = Math.max(0, Math.min(1, s.mainProb));
      const yMain = s.hitMain ? 1 : 0;
      brierMain += (pMain - yMain) ** 2;
      const pTop = Math.max(0, Math.min(1, (s.topProbs || []).slice(0, 5).reduce((a, b) => a + b, 0)));
      const yTop = s.hitTop5 ? 1 : 0;
      brierTop += (pTop - yTop) ** 2;
    }
    brierMain = resolved.length > 0 ? brierMain / resolved.length : 0;
    brierTop = resolved.length > 0 ? brierTop / resolved.length : 0;
    const naiveBrierMain = baseline1 * (1 - baseline1);
    const naiveBrierTop = baseline5 * (1 - baseline5);
    const skillMain = naiveBrierMain > 0 ? 1 - brierMain / naiveBrierMain : 0;
    const skillTop = naiveBrierTop > 0 ? 1 - brierTop / naiveBrierTop : 0;

    return {
      total: resolved.length,
      pending: pending.length,
      hitMain,
      hitTop5,
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
      timeSinceLastResolution,
      rollingHitRate,
      lastResolved,
      ciMain,
      ciTop5,
      brierMain,
      brierTop,
      skillMain,
      skillTop,
    };
  }, [history, pending]);

  useEffect(() => {
    const prev = prevCountRef.current;
    const next = { exact: stats.hitMain, top5: stats.hitTop5, miss: stats.miss };
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (stats.hitMain > prev.exact || stats.hitTop5 > prev.top5) {
      setFlash("hit");
      timer = setTimeout(() => setFlash(null), 1200);
    } else if (stats.miss > prev.miss) {
      setFlash("miss");
      timer = setTimeout(() => setFlash(null), 1200);
    }
    prevCountRef.current = next;
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [stats.hitMain, stats.hitTop5, stats.miss]);

  const last30 = useMemo(() => {
    const resolved = history.filter((s) => s.actualNumber !== null).slice(0, 30);
    return resolved.reverse();
  }, [history]);

  const currentPending = pending[pending.length - 1];

  return (
    <Card
      padding="md"
      accent={flash === "hit" ? "good" : flash === "miss" ? "bad" : "neutral"}
      className={flash ? "[animation:pop_0.6s_ease-out]" : ""}
    >
      <SectionHeader
        title={
          <span className="flex items-center gap-2">
            📊 Placar do Agente
            <span className={`w-2 h-2 rounded-full ${agentEnabled ? "bg-emerald-400 animate-pulse" : "bg-neutral-600"}`} />
            <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold">
              {agentEnabled ? "AO VIVO" : "PAUSADO"}
            </span>
          </span>
        }
        subtitle={
          <span>
            {stats.total} sinais resolvidos · {stats.pending} aguardando · última resolução{" "}
            {stats.timeSinceLastResolution !== null ? fmtAgo(stats.timeSinceLastResolution) + " atrás" : "—"}
          </span>
        }
        actions={
          stats.streakKind === "hit" && stats.currentStreak >= 2 ? (
            <Pill accent="good">🔥 {stats.currentStreak} seguidos</Pill>
          ) : stats.streakKind === "miss" && stats.currentStreak >= 3 ? (
            <Pill accent="bad">❄ {stats.currentStreak} erros</Pill>
          ) : null
        }
      />

      {currentPending && (
        <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-950/20 p-3 flex items-center gap-3">
          <div
            className={`${ballBg(currentPending.mainPick)} text-white text-xl font-bold w-14 h-14 rounded-xl flex items-center justify-center ring-2 ring-amber-400 animate-pulse shadow-lg shadow-amber-500/30`}
          >
            {currentPending.mainPick}
          </div>
          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-wider text-amber-400 font-bold">🎯 Sinal pendente</div>
            <div className="text-sm font-bold text-amber-100">
              Aposta no {currentPending.mainPick} · {(currentPending.mainProb * 100).toFixed(1)}%
            </div>
            <div className="text-[10px] text-amber-100/70 mt-0.5">
              {currentPending.sector} · {currentPending.color} · top-5: {currentPending.topPicks.join(", ")}
            </div>
          </div>
          {lastSpin && (
            <div className="text-right text-[10px] text-neutral-400">
              <div>Aguardando próximo</div>
              <div className="font-mono">após {fmtAgo(Date.now() - lastSpin.t)}</div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
        <ScoreCell
          label="Acertos exatos"
          big={String(stats.hitMain)}
          sub={
            stats.total >= 10
              ? `${(stats.hitRateMain * 100).toFixed(1)}% · CI95 [${(stats.ciMain[0] * 100).toFixed(1)}–${(stats.ciMain[1] * 100).toFixed(1)}]`
              : `${(stats.hitRateMain * 100).toFixed(1)}% · lift ${stats.lift1.toFixed(2)}×`
          }
          accent="good-strong"
          flashKind={flash}
        />
        <ScoreCell
          label="Acertos top-5"
          big={String(stats.hitTop5)}
          sub={
            stats.total >= 10
              ? `${(stats.hitRateTop5 * 100).toFixed(1)}% · CI95 [${(stats.ciTop5[0] * 100).toFixed(1)}–${(stats.ciTop5[1] * 100).toFixed(1)}]`
              : `${(stats.hitRateTop5 * 100).toFixed(1)}% · lift ${stats.lift5.toFixed(2)}×`
          }
          accent="good"
          flashKind={flash}
        />
        <ScoreCell
          label="Erros"
          big={String(stats.miss)}
          sub={stats.total > 0 ? `${((stats.miss / stats.total) * 100).toFixed(1)}%` : "—"}
          accent="bad"
          flashKind={flash === "miss" ? "miss" : null}
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

      {stats.total >= 10 && (
        <div className="mb-3 flex items-center gap-2 flex-wrap text-[10px]">
          <span className="uppercase tracking-wider text-neutral-500 font-bold">Calibração</span>
          <Pill accent={stats.skillTop > 0.05 ? "good" : stats.skillTop > -0.05 ? "neutral" : "bad"}>
            Skill top-5: {(stats.skillTop * 100).toFixed(1)}%
          </Pill>
          <span className="text-neutral-500 font-mono">
            Brier {stats.brierTop.toFixed(3)} (acaso {((stats.baseline5 * (1 - stats.baseline5))).toFixed(3)})
          </span>
          <span className="text-neutral-600 italic">
            {stats.skillTop > 0.05 ? "modelo vence o acaso" : stats.skillTop > -0.05 ? "equivalente ao acaso" : "abaixo do acaso"}
          </span>
        </div>
      )}

      {stats.rollingHitRate.length >= 3 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold">Taxa top-5 rolante (20 sinais)</span>
            <span className="text-[10px] text-neutral-500 font-mono">
              último: {(stats.rollingHitRate[stats.rollingHitRate.length - 1] * 100).toFixed(0)}%
            </span>
          </div>
          <Sparkline data={stats.rollingHitRate} baseline={stats.baseline5} />
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold">
            Últimos {last30.length} sinais
          </span>
        </div>
        <div className="flex gap-0.5 flex-wrap">
          {last30.length === 0 ? (
            <div className="text-xs text-neutral-500 py-4 w-full text-center">
              Aguardando primeiros sinais resolverem…
            </div>
          ) : (
            last30.map((s, i) => (
              <div
                key={s.id}
                className={`w-6 h-6 rounded text-[10px] font-bold text-white flex items-center justify-center ${
                  s.hitMain ? "bg-emerald-500" : s.hitTop5 ? "bg-sky-500" : "bg-red-700/70"
                } ${i === last30.length - 1 && flash ? "ring-2 ring-amber-400 scale-110 transition" : ""}`}
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
            <span className="ml-auto text-neutral-500">Baseline acaso: exato 2,7% · top-5 13,5%</span>
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
  flashKind?: "hit" | "miss" | null;
}

const ScoreCell = memo(({ label, big, sub, accent, flashKind }: ScoreCellProps) => {
  const accentColors = {
    "good-strong": "text-emerald-300 border-emerald-700/50 bg-emerald-950/40",
    good: "text-sky-300 border-sky-700/50 bg-sky-950/40",
    bad: "text-red-300 border-red-700/50 bg-red-950/40",
    neutral: "text-neutral-200 border-neutral-700 bg-neutral-900/40",
    info: "text-amber-300 border-amber-700/50 bg-amber-950/30",
  } as const;
  const flashCls =
    flashKind === "hit" && (accent === "good-strong" || accent === "good")
      ? "[animation:pop_0.6s_ease-out] ring-2 ring-emerald-400"
      : flashKind === "miss" && accent === "bad"
        ? "[animation:pop_0.6s_ease-out] ring-2 ring-red-400"
        : "";
  return (
    <div className={`rounded-xl border p-2.5 transition ${accentColors[accent]} ${flashCls}`}>
      <div className="text-[10px] uppercase tracking-wider opacity-70 font-bold">{label}</div>
      <div className="text-2xl font-bold font-mono mt-0.5 leading-none">{big}</div>
      {sub && <div className="text-[10px] opacity-70 mt-1 font-mono">{sub}</div>}
    </div>
  );
});
ScoreCell.displayName = "ScoreCell";

const Sparkline = memo(({ data, baseline }: { data: number[]; baseline: number }) => {
  if (data.length < 2) return null;
  const W = 600;
  const H = 50;
  const maxY = Math.max(0.4, ...data);
  const minY = 0;
  const range = Math.max(0.001, maxY - minY);
  const x = (i: number) => (i / (data.length - 1)) * W;
  const y = (v: number) => H - ((v - minY) / range) * (H - 8) - 4;
  const path = data.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ");
  const baselineY = y(baseline);
  const lastV = data[data.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-12 bg-neutral-950 rounded-md border border-neutral-800">
      <line x1={0} y1={baselineY} x2={W} y2={baselineY} stroke="#525252" strokeDasharray="3 3" strokeWidth={0.5} />
      <path d={path} fill="none" stroke={lastV >= baseline ? "#10b981" : "#f43f5e"} strokeWidth={1.5} />
      <circle cx={x(data.length - 1)} cy={y(lastV)} r={3} fill={lastV >= baseline ? "#10b981" : "#f43f5e"} />
    </svg>
  );
});
Sparkline.displayName = "ScoreboardSparkline";

export default Scoreboard;
