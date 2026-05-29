import { useSignalAgent } from "./signalAgent";
import { useEntryFilter } from "./entryFilter";
import { useHonestStore } from "./store";
import { SLOTS } from "./wheel";

export interface Suggestion {
  id: string;
  priority: "low" | "medium" | "high";
  emoji: string;
  title: string;
  detail: string;
  action?: { label: string; route?: string; apply?: () => void };
}

export const generateSuggestions = (): Suggestion[] => {
  const out: Suggestion[] = [];
  const agent = useSignalAgent.getState();
  const filter = useEntryFilter.getState();
  const spins = useHonestStore.getState().spins;

  const resolvedSignals = agent.history.filter((s) => s.actualNumber !== null);
  const top5HitRate = resolvedSignals.length > 0 ? resolvedSignals.filter((s) => s.hitTop5).length / resolvedSignals.length : 0;
  const baseline = 5 / SLOTS;

  if (resolvedSignals.length >= 20 && top5HitRate < baseline * 0.8) {
    out.push({
      id: "low-hit-suggest-filter",
      priority: "high",
      emoji: "🎯",
      title: "Hit rate baixo — ative mais filtros",
      detail: `Top-5 em ${(top5HitRate * 100).toFixed(1)}% vs baseline ${(baseline * 100).toFixed(1)}%. Bots sérios entram menos: ative mais condições em /filtros pra elevar a barra.`,
      action: { label: "Ir para Filtros", route: "/filtros" },
    });
  }

  const activeConditions = filter.conditions.filter((c) => c.enabled).length;
  if (activeConditions === 0 && resolvedSignals.length >= 10) {
    out.push({
      id: "no-filter-conditions",
      priority: "medium",
      emoji: "🚪",
      title: "Filtro probabilístico desligado",
      detail: "Nenhuma condição ativa — todo sinal do agente passa. Considere ativar pelo menos 'confiança ≥ 45%' e 'sem drift de dealer'.",
      action: { label: "Configurar filtros", route: "/filtros" },
    });
  }

  if (!agent.config.dynamicThreshold && resolvedSignals.length >= 30) {
    out.push({
      id: "enable-dynamic-threshold",
      priority: "medium",
      emoji: "📈",
      title: "Considere o limiar dinâmico",
      detail: "Você tem 30+ sinais resolvidos. O limiar dinâmico se auto-ajusta com base no hit rate recente.",
      action: {
        label: "Ativar agora",
        apply: () => useSignalAgent.getState().setConfig({ dynamicThreshold: true }),
      },
    });
  }

  if (spins.length > 1000 && !agent.config.useWorker) {
    out.push({
      id: "enable-worker",
      priority: "low",
      emoji: "🧵",
      title: "Ative Web Worker para mais performance",
      detail: `Você tem ${spins.length} giros. Mover ensemble + LSTM pro worker libera a UI.`,
      action: {
        label: "Ativar worker",
        apply: () => useSignalAgent.getState().setConfig({ useWorker: true }),
      },
    });
  }

  const session = useHonestStore.getState().session;
  if (session.startedAt) {
    const elapsed = Date.now() - session.startedAt;
    if (elapsed > 90 * 60_000) {
      out.push({
        id: "session-too-long",
        priority: "high",
        emoji: "⏰",
        title: "Sessão longa demais",
        detail: `Você está há ${Math.floor(elapsed / 60_000)}min nessa sessão. Cansaço é gatilho de tilt.`,
        action: {
          label: "Encerrar sessão",
          apply: () => useHonestStore.getState().endSession(),
        },
      });
    }
  }

  if (spins.length < 100) {
    out.push({
      id: "collect-more-data",
      priority: "low",
      emoji: "📊",
      title: "Colete mais dados antes de tirar conclusões",
      detail: `Apenas ${spins.length} giros. Análises ficam confiáveis após 200+.`,
    });
  }

  return out.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.priority] - order[b.priority];
  });
};
