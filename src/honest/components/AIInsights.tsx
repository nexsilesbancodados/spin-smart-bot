import { memo, useState } from "react";
import { useHonestStore } from "../lib/store";
import { useSignalAgent } from "../lib/signalAgent";
import { useBetTracker, computeTrackerStats } from "../lib/betTracker";
import { useAutoBet } from "../lib/autoBet";
import { summarizeLearning } from "../lib/patternLearning";
import { summarizeEngines } from "../lib/engineWeights";
import { analyzeWithClaude, ClaudeTask } from "../lib/claudeAnalyze";
import { Card, SectionHeader, Pill, Button } from "./ui";

interface TaskState {
  loading: boolean;
  text: string | null;
  error: string | null;
  tokens: { in: number; out: number } | null;
  cached: boolean;
}

const blankState: TaskState = {
  loading: false,
  text: null,
  error: null,
  tokens: null,
  cached: false,
};

const TASK_LABELS: Record<ClaudeTask, { icon: string; title: string; description: string }> = {
  "session-report": {
    icon: "📋",
    title: "Relatório da sessão",
    description: "Analisa a sessão atual: PnL real vs esperado, padrões dominantes, sugestão honesta",
  },
  "family-meta": {
    icon: "🧠",
    title: "Meta-análise de famílias",
    description: "Identifica quais famílias de padrões estão funcionando vs ruído branco",
  },
  critic: {
    icon: "🛡",
    title: "Crítico do sinal atual",
    description: "Joga adversário: encontra 2-3 razões pra NÃO apostar no sinal atual",
  },
  "tilt-detect": {
    icon: "⚠",
    title: "Detector de tilt",
    description: "Analisa suas últimas apostas em busca de escalada/recuperação/tilt",
  },
  "pattern-explain": {
    icon: "💡",
    title: "Explicar padrão atual",
    description: "Tradução clara do que a regra ativada faz e se vale dar peso",
  },
};

const AIInsights = memo(() => {
  const spins = useHonestStore((s) => s.spins);
  const latest = useSignalAgent((s) => s.latest);
  const signalHistory = useSignalAgent((s) => s.history);
  const entries = useBetTracker((s) => s.entries);
  const autoBetHistory = useAutoBet((s) => s.history);
  const autoBetConfig = useAutoBet((s) => s.config);

  const [states, setStates] = useState<Record<ClaudeTask, TaskState>>({
    "session-report": blankState,
    "family-meta": blankState,
    critic: blankState,
    "tilt-detect": blankState,
    "pattern-explain": blankState,
  });

  const buildContext = (task: ClaudeTask): Record<string, unknown> => {
    const learning = summarizeLearning();
    const engines = summarizeEngines();
    const tracker = computeTrackerStats(entries);
    const lastSpins = spins.slice(0, 50).map((s) => s.n);
    const lastResolved = signalHistory.filter((s) => s.actualNumber !== null).slice(0, 50);

    if (task === "session-report") {
      return {
        spinsCount: spins.length,
        lastSpins,
        agent: {
          resolved: lastResolved.length,
          hits_main: lastResolved.filter((s) => s.hitMain).length,
          hits_top5: lastResolved.filter((s) => s.hitTop5).length,
        },
        tracker: {
          pnl: tracker.pnl,
          roi: tracker.roi,
          winRate: tracker.winRate,
          wins: tracker.wins,
          losses: tracker.losses,
          staked: tracker.staked,
        },
        autoBet: {
          enabled: autoBetConfig.enabled,
          currentBank: autoBetConfig.currentBank,
          startingBank: autoBetConfig.startingBank,
          recentBets: autoBetHistory.slice(0, 20).map((b) => ({
            target: b.targetLabel,
            payout: b.payout,
            stake: b.stake,
            hit: b.hit,
            delta: b.delta,
          })),
        },
        learning: {
          bankSize: learning.bank,
          tracked: learning.tracked,
          overallAccuracy: learning.overallAccuracy,
        },
        engines: engines.map((e) => ({ engine: e.engine, hits: e.hits, attempts: e.attempts, weight: e.weight })),
      };
    }

    if (task === "family-meta") {
      const groups = learning.byGroup ?? {};
      const sortedGroups = Object.entries(groups)
        .map(([group, stats]) => ({ group, ...stats, rate: stats.attempts > 0 ? stats.hits / stats.attempts : 0 }))
        .sort((a, b) => b.attempts - a.attempts)
        .slice(0, 40);
      return {
        bankSize: learning.bank,
        tracked: learning.tracked,
        overallAccuracy: learning.overallAccuracy,
        groups: sortedGroups,
      };
    }

    if (task === "critic") {
      return {
        currentTopSignal: latest
          ? {
              mainPick: latest.mainPick,
              mainProb: latest.mainProb,
              topPicks: latest.topPicks,
              topProbs: latest.topProbs,
              sector: latest.sector,
              confidenceScore: latest.confidenceScore,
              explanation: latest.explanation,
            }
          : null,
        recentResolved: lastResolved.slice(0, 20).map((s) => ({
          mainPick: s.mainPick,
          actual: s.actualNumber,
          hitMain: s.hitMain,
          hitTop5: s.hitTop5,
        })),
        sampleSize: lastResolved.length,
      };
    }

    if (task === "tilt-detect") {
      const recent = entries.slice(0, 30).map((e) => ({
        t: e.t,
        betType: e.betType,
        stake: e.stake,
        outcome: e.outcome,
        delta: e.delta,
      }));
      return {
        recentBets: recent,
        totalStaked: tracker.staked,
        pnl: tracker.pnl,
      };
    }

    return {
      latestSignal: latest,
      lastSpins,
    };
  };

  const run = async (task: ClaudeTask) => {
    setStates((s) => ({ ...s, [task]: { ...blankState, loading: true } }));
    const context = buildContext(task);
    const { result, error } = await analyzeWithClaude(task, context);
    if (error || !result) {
      setStates((s) => ({
        ...s,
        [task]: { loading: false, text: null, error, tokens: null, cached: false },
      }));
      return;
    }
    setStates((s) => ({
      ...s,
      [task]: {
        loading: false,
        text: result.text,
        error: null,
        tokens: { in: result.input_tokens, out: result.output_tokens },
        cached: !!result.cached,
      },
    }));
  };

  return (
    <Card padding="sm">
      <SectionHeader
        title={
          <span className="flex items-center gap-2">
            🤖 Análises com IA
            <Pill accent="warn">Claude Haiku · sob demanda</Pill>
          </span>
        }
        eyebrow="Chave protegida server-side · ~R$0,02–0,10 por análise"
        subtitle={
          <span className="text-[10px] text-neutral-500">
            Cada botão dispara uma análise descritiva única. Cache 10min pra evitar repetir.
            Limite 30 chamadas/hora por IP.
          </span>
        }
      />

      <div className="space-y-2">
        {(Object.keys(TASK_LABELS) as ClaudeTask[]).map((task) => {
          const meta = TASK_LABELS[task];
          const state = states[task];
          return (
            <div
              key={task}
              className="bg-neutral-900/50 rounded-lg p-2 border border-neutral-800"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg shrink-0">{meta.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-bold text-neutral-200">{meta.title}</div>
                  <div className="text-[9px] text-neutral-500">{meta.description}</div>
                </div>
                <Button
                  size="sm"
                  variant={state.text ? "secondary" : "primary"}
                  onClick={() => run(task)}
                  disabled={state.loading}
                >
                  {state.loading ? "…" : state.text ? "Rodar de novo" : "Rodar"}
                </Button>
              </div>

              {state.error && (
                <div className="text-[10px] text-red-300 mt-1 italic">⚠ {state.error}</div>
              )}

              {state.text && (
                <div className="mt-1.5 bg-neutral-950 rounded p-2 border border-neutral-800">
                  <div className="text-[11px] text-neutral-200 whitespace-pre-wrap leading-snug">
                    {state.text}
                  </div>
                  {state.tokens && (
                    <div className="text-[9px] text-neutral-600 mt-1 font-mono">
                      {state.cached ? "✓ cache · " : ""}
                      tokens: {state.tokens.in} in · {state.tokens.out} out · ~R${" "}
                      {((state.tokens.in * 0.001 + state.tokens.out * 0.005) / 1000).toFixed(4)}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="text-[9px] text-neutral-600 italic mt-2 text-center leading-snug">
        Requer deploy da edge function <code>claude-analyze</code> no Supabase com{" "}
        <code>ANTHROPIC_API_KEY</code> nos secrets. Se não estiver deployada, todos os botões
        retornarão erro 404. Ver instruções no commit message.
      </div>
    </Card>
  );
});
AIInsights.displayName = "AIInsights";

export default AIInsights;
