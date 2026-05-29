import { memo, useEffect, useMemo, useState } from "react";
import { useSignalAgent, computeAgentStats, runAgentTick, startAgentLoop } from "../lib/signalAgent";
import { colorOf } from "../lib/wheel";
import { useHonestStore } from "../lib/store";
import { useEntryFilter, evaluateFilter } from "../lib/entryFilter";
import { Card, SectionHeader, Stat, StatGrid, Pill, Button } from "./ui";

const ballBg = (n: number) => {
  const c = colorOf(n);
  if (c === "green") return "bg-emerald-600";
  if (c === "red") return "bg-red-600";
  return "bg-neutral-800";
};

const SignalPanel = memo(() => {
  const enabled = useSignalAgent((s) => s.config.enabled);
  const threshold = useSignalAgent((s) => s.config.threshold);
  const lstmEnabled = useSignalAgent((s) => s.config.lstmEnabled);
  const setConfig = useSignalAgent((s) => s.setConfig);
  const latest = useSignalAgent((s) => s.latest);
  const history = useSignalAgent((s) => s.history);
  const trainedSpins = useSignalAgent((s) => s.trainedSpins);
  const totalSpins = useHonestStore((s) => s.spins.length);
  const spins = useHonestStore((s) => s.spins);
  const filterEnabled = useEntryFilter((s) => s.enabled);
  const activeConditionsCount = useEntryFilter(
    (s) => s.conditions.filter((c) => c.enabled).length
  );
  const filterStats = useEntryFilter((s) => s.stats);
  const [computing, setComputing] = useState(false);

  useEffect(() => {
    startAgentLoop();
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (totalSpins < 10) return;
    setComputing(true);
    const t = setTimeout(() => {
      runAgentTick();
      setComputing(false);
    }, 50);
    return () => clearTimeout(t);
  }, [enabled, totalSpins]);

  const filterEval = useMemo(() => {
    if (!latest) return null;
    return evaluateFilter({
      spinsNewestFirst: spins.map((s) => s.n),
      candidateConfidence: latest.confidenceScore,
      candidateMainProb: latest.mainProb,
      candidateMainPick: latest.mainPick,
      candidateSector: latest.sector,
      candidateColor: latest.color,
      modelContributions: latest.modelContributions,
    });
  }, [latest, spins]);

  const stats = useMemo(() => computeAgentStats(history), [history]);
  const lastTen = useMemo(() => history.slice(0, 10), [history]);
  const recentHits = lastTen.filter((s) => s.hitTop5 === true).length;

  if (!enabled) {
    return (
      <Card>
        <SectionHeader
          title="Agente de Sinais"
          subtitle="Ensemble (Markov 1–4 + frequência + PageRank + setor/terminal) + LSTM. Emite quando confiança ≥ limiar e filtro passa."
          actions={<Button variant="primary" onClick={() => setConfig({ enabled: true })}>Ativar agente</Button>}
        />
      </Card>
    );
  }

  if (totalSpins < 10) {
    return (
      <Card>
        <SectionHeader title="Agente de Sinais" subtitle={`Aquecendo… ${totalSpins}/10 giros necessários.`} />
      </Card>
    );
  }

  const wouldEmit = latest && latest.mainProb >= threshold;
  const filterPass = !filterEnabled || (filterEval?.passed ?? true);

  return (
    <Card accent={wouldEmit && filterPass ? "warn" : "neutral"} className="" >
      <div data-tour="signal-panel">
      <SectionHeader
        title={`🎯 Agente de Sinais${computing ? " · processando…" : ""}`}
        subtitle={`Ensemble 6 modelos ${lstmEnabled ? "+ LSTM" : ""} · ${trainedSpins} steps treinados`}
        actions={
          <>
            <label className="text-[10px] text-neutral-400">Limiar</label>
            <select
              value={threshold}
              onChange={(e) => setConfig({ threshold: Number(e.target.value) })}
              className="bg-neutral-950 border border-neutral-700 rounded-md px-2 py-1 text-xs"
              aria-label="Limiar de probabilidade do agente"
            >
              <option value={0.03}>3%</option>
              <option value={0.04}>4%</option>
              <option value={0.045}>4,5%</option>
              <option value={0.05}>5%</option>
              <option value={0.06}>6%</option>
              <option value={0.08}>8%</option>
            </select>
            <Button size="sm" onClick={() => setConfig({ lstmEnabled: !lstmEnabled })}>
              LSTM {lstmEnabled ? "ON" : "OFF"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfig({ enabled: false })}>
              Pausar
            </Button>
          </>
        }
      />

      {latest && (
        <>
          <div className="flex items-center gap-4 mb-4">
            <div className="relative">
              <div
                className={`${ballBg(latest.mainPick)} text-white text-5xl font-black w-24 h-24 rounded-2xl flex items-center justify-center shadow-2xl shadow-black/50 ${
                  wouldEmit && filterPass ? "ring-4 ring-amber-400/70 [animation:pop_0.5s_ease-out]" : "ring-2 ring-neutral-700/60"
                }`}
              >
                {latest.mainPick}
              </div>
              {wouldEmit && filterPass && (
                <span className="absolute -top-1 -right-1 bg-amber-500 text-black text-[10px] font-black px-1.5 py-0.5 rounded-full shadow-lg">
                  EMITIR
                </span>
              )}
            </div>
            <div className="flex-1">
              <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500 font-bold">Pick principal</div>
              <div className="text-3xl font-black font-mono text-amber-300 leading-none mt-1">
                {(latest.mainProb * 100).toFixed(2)}%
              </div>
              <div className="text-[11px] text-neutral-500 mt-0.5">
                Baseline 2,7% · {latest.sector} · <span className="capitalize">{latest.color}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex flex-col items-end">
                <div className="text-[10px] uppercase tracking-wider text-neutral-500">Confiança</div>
                <div className="w-28 h-1.5 bg-neutral-800 rounded-full overflow-hidden mt-1">
                  <div
                    className={
                      latest.confidenceScore >= 0.6
                        ? "h-1.5 bg-emerald-500"
                        : latest.confidenceScore >= 0.3
                          ? "h-1.5 bg-amber-500"
                          : "h-1.5 bg-neutral-500"
                    }
                    style={{ width: `${latest.confidenceScore * 100}%` }}
                  />
                </div>
                <div className="text-[10px] font-mono mt-0.5">{(latest.confidenceScore * 100).toFixed(0)}/100</div>
              </div>
              {wouldEmit && filterPass ? (
                <Pill accent="warn">🚨 EMITIDO</Pill>
              ) : !wouldEmit ? (
                <Pill accent="neutral">aguardando confiança</Pill>
              ) : (
                <Pill accent="info">filtro bloqueou</Pill>
              )}
            </div>
          </div>

          <div className="mb-4">
            <div className="text-[10px] uppercase tracking-[0.14em] text-neutral-500 mb-2 font-bold">Top 5 candidatos</div>
            <div className="flex gap-2">
              {latest.topPicks.map((n, i) => (
                <div key={`${n}-${i}`} className="flex flex-col items-center gap-1 flex-1">
                  <div
                    className={`${ballBg(n)} text-white text-base font-bold w-12 h-12 rounded-full flex items-center justify-center shadow-md ${i === 0 ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-neutral-950" : "ring-1 ring-white/10"}`}
                  >
                    {n}
                  </div>
                  <span className="text-[10px] font-mono text-neutral-400 font-semibold">
                    {(latest.topProbs[i] * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {latest.explanation && latest.explanation.length > 0 && (
            <div className="mb-3 rounded-xl border border-sky-700/40 bg-sky-950/20 p-3">
              <div className="text-[10px] uppercase tracking-wider text-sky-400 font-bold mb-1.5">
                💭 Raciocínio do agente
              </div>
              <ul className="space-y-1">
                {latest.explanation.map((line, i) => (
                  <li key={i} className="text-[11px] text-sky-100/90 leading-snug">
                    · {line}
                  </li>
                ))}
              </ul>
              {latest.modelContributions && latest.modelContributions.length > 0 && (
                <div className="mt-2 pt-2 border-t border-sky-800/50 flex flex-wrap gap-1">
                  {latest.modelContributions.slice(0, 4).map((m) => (
                    <span
                      key={m.id}
                      className="text-[9px] font-mono bg-sky-900/40 text-sky-200 px-1.5 py-0.5 rounded border border-sky-700/40"
                    >
                      {m.name}: {(m.topPickProb * 100).toFixed(1)}% × peso {m.weight.toFixed(2)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {filterEnabled && filterEval && activeConditionsCount > 0 && (
            <div className="mb-4 rounded-xl border border-neutral-800 bg-neutral-950/50 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">
                  Filtro probabilístico
                </span>
                <Pill accent={filterEval.passed ? "good" : "bad"}>
                  {filterEval.passingConditions}/{filterEval.totalActiveConditions} condições
                </Pill>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {filterEval.perCondition.map((c) => (
                  <div
                    key={c.id}
                    className={`flex items-center gap-1.5 text-[11px] ${c.passed ? "text-emerald-300" : "text-red-300/70"}`}
                  >
                    <span className="font-mono text-[10px]">{c.passed ? "✓" : "✗"}</span>
                    <span className="truncate">{c.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <StatGrid cols={4}>
        <Stat label="Sinais emitidos" value={String(stats.totalSignals)} sub={`${stats.resolved} resolvidos`} />
        <Stat
          label="Hit top-1"
          value={`${(stats.mainHitRate * 100).toFixed(1)}%`}
          sub={`vs ${(stats.baselineMain * 100).toFixed(1)}% acaso`}
          accent={stats.mainHitRate > stats.baselineMain ? "good" : "neutral"}
        />
        <Stat
          label="Hit top-5"
          value={`${(stats.top5HitRate * 100).toFixed(1)}%`}
          sub={`vs ${(stats.baselineTop5 * 100).toFixed(1)}% acaso`}
          accent={stats.top5HitRate > stats.baselineTop5 ? "good" : "neutral"}
        />
        <Stat
          label="Últimos 10"
          value={`${recentHits}/${lastTen.length}`}
          sub="hits no top-5"
        />
      </StatGrid>

      {filterStats.candidates > 0 && (
        <div className="mt-3 text-[10px] text-neutral-500">
          Filtro: {filterStats.passes}/{filterStats.candidates} candidatos passaram (
          {(filterStats.passRate * 100).toFixed(0)}%) · hit rate dos passados:{" "}
          {(filterStats.hitRate * 100).toFixed(1)}%
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-4">
          <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1.5">
            Últimos sinais resolvidos
          </div>
          <div className="flex flex-wrap gap-1">
            {history.slice(0, 30).map((s) => (
              <div
                key={s.id}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border ${
                  s.hitMain
                    ? "bg-emerald-950/50 border-emerald-700/50 text-emerald-200"
                    : s.hitTop5
                      ? "bg-sky-950/50 border-sky-700/50 text-sky-200"
                      : "bg-red-950/30 border-red-900/40 text-red-300/70"
                }`}
                title={`Predito ${s.mainPick} · saiu ${s.actualNumber}`}
              >
                <span className="font-mono">{s.mainPick}</span>
                <span className="opacity-50">→</span>
                <span className="font-mono">{s.actualNumber}</span>
                {s.hitMain ? "✓✓" : s.hitTop5 ? "✓" : "✗"}
              </div>
            ))}
          </div>
        </div>
      )}
      </div>
    </Card>
  );
});
SignalPanel.displayName = "SignalPanel";

export default SignalPanel;
