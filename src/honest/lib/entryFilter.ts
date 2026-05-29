import { create } from "zustand";
import { persist } from "zustand/middleware";
import { SLOTS, sectorOf, colorOf, VOISINS, TIERS, ORPHELINS } from "./wheel";
import { useHonestStore } from "./store";
import { useSignalAgent } from "./signalAgent";
import { detectDealerChange } from "./dealerChange";

export interface FilterContext {
  spinsNewestFirst: number[];
  candidateConfidence: number;
  candidateMainProb: number;
  candidateMainPick: number;
  candidateSector: string;
  candidateColor: string;
  modelContributions?: Array<{ id: string; name: string; weight: number; topPickProb: number }>;
}

export interface ConditionDefinition {
  id: string;
  label: string;
  description: string;
  category: "agente" | "estatistica" | "mesa" | "sessao";
  paramLabel: string;
  paramMin: number;
  paramMax: number;
  paramStep: number;
  paramDefault: number;
  paramSuffix?: string;
  evaluate: (ctx: FilterContext, param: number) => boolean;
}

const ratioInGroup = (spins: number[], members: Set<number>) => {
  if (spins.length === 0) return 0;
  let c = 0;
  for (const n of spins) if (members.has(n)) c += 1;
  return c / spins.length;
};

const sdInGroup = (n: number, p: number) => Math.sqrt(Math.max(1e-9, (p * (1 - p)) / Math.max(1, n)));

const recentStreak = (spins: number[], pred: (n: number) => boolean): number => {
  let s = 0;
  for (const n of spins) {
    if (pred(n)) s += 1;
    else break;
  }
  return s;
};

const recentMaxFreq = (spins: number[], window: number) => {
  const recent = spins.slice(0, window);
  const counts: Record<string, number> = { Voisins: 0, Tiers: 0, Orphelins: 0 };
  for (const n of recent) counts[sectorOf(n)] += 1;
  return Math.max(...Object.values(counts));
};

const sectorZ = (spins: number[], members: Set<number>, expectedP: number, window: number) => {
  const recent = spins.slice(0, window);
  const r = ratioInGroup(recent, members);
  const sd = sdInGroup(recent.length, expectedP);
  return sd > 0 ? (r - expectedP) / sd : 0;
};

export const conditions: ConditionDefinition[] = [
  {
    id: "agent-confidence-min",
    label: "Confiança do agente ≥ X",
    description: "Só passa se a confiança do top-1 do agente estiver acima do limiar.",
    category: "agente",
    paramLabel: "Confiança mínima",
    paramMin: 0.0,
    paramMax: 1.0,
    paramStep: 0.05,
    paramDefault: 0.45,
    paramSuffix: "%",
    evaluate: (ctx, p) => ctx.candidateConfidence >= p,
  },
  {
    id: "agent-mainprob-min",
    label: "Probabilidade top-1 ≥ X",
    description: "Probabilidade absoluta do número mais provável (baseline 2,7%).",
    category: "agente",
    paramLabel: "Probabilidade mínima",
    paramMin: 0.027,
    paramMax: 0.2,
    paramStep: 0.005,
    paramDefault: 0.055,
    paramSuffix: "%",
    evaluate: (ctx, p) => ctx.candidateMainProb >= p,
  },
  {
    id: "sector-dominance",
    label: "Setor do candidato dominante",
    description: "Setor do pick principal deve ter contado X giros nos últimos 20.",
    category: "estatistica",
    paramLabel: "Mín. ocorrências do setor",
    paramMin: 5,
    paramMax: 20,
    paramStep: 1,
    paramDefault: 10,
    evaluate: (ctx, p) => {
      const sectorMembers =
        ctx.candidateSector === "Voisins" ? VOISINS : ctx.candidateSector === "Tiers" ? TIERS : ORPHELINS;
      const recent = ctx.spinsNewestFirst.slice(0, 20);
      let c = 0;
      for (const n of recent) if (sectorMembers.has(n)) c += 1;
      return c >= p;
    },
  },
  {
    id: "color-streak",
    label: "Streak de cor recente ≥ X",
    description: "Sequência da cor do pick principal nos giros mais recentes.",
    category: "estatistica",
    paramLabel: "Streak mínima",
    paramMin: 1,
    paramMax: 8,
    paramStep: 1,
    paramDefault: 2,
    evaluate: (ctx, p) =>
      recentStreak(ctx.spinsNewestFirst, (n) => colorOf(n) === ctx.candidateColor) >= p,
  },
  {
    id: "no-color-streak-too-long",
    label: "Streak de cor NÃO maior que X",
    description: "Evita entrar depois de streak exagerada (reversão estatística).",
    category: "estatistica",
    paramLabel: "Streak máxima tolerada",
    paramMin: 3,
    paramMax: 12,
    paramStep: 1,
    paramDefault: 6,
    evaluate: (ctx, p) => {
      let maxStreak = 0;
      let cur = 0;
      let prevColor = "";
      for (const n of ctx.spinsNewestFirst.slice(0, 25)) {
        const c = colorOf(n);
        if (c === prevColor) cur += 1;
        else {
          cur = 1;
          prevColor = c;
        }
        if (cur > maxStreak) maxStreak = cur;
      }
      return maxStreak <= p;
    },
  },
  {
    id: "sector-zscore-min",
    label: "z-score do setor do candidato ≥ X",
    description: "Setor do pick precisa estar acima do esperado (janela 50).",
    category: "estatistica",
    paramLabel: "z-score mínimo",
    paramMin: -3,
    paramMax: 3,
    paramStep: 0.1,
    paramDefault: 0.5,
    evaluate: (ctx, p) => {
      const members =
        ctx.candidateSector === "Voisins" ? VOISINS : ctx.candidateSector === "Tiers" ? TIERS : ORPHELINS;
      const expected =
        ctx.candidateSector === "Voisins" ? 17 / 37 : ctx.candidateSector === "Tiers" ? 12 / 37 : 8 / 37;
      const z = sectorZ(ctx.spinsNewestFirst, members, expected, 50);
      return z >= p;
    },
  },
  {
    id: "candidate-gap-min",
    label: "Gap do candidato ≥ X giros",
    description: "Quantos giros o número principal está sem sair.",
    category: "estatistica",
    paramLabel: "Gap mínimo",
    paramMin: 0,
    paramMax: 100,
    paramStep: 1,
    paramDefault: 15,
    evaluate: (ctx, p) => {
      const idx = ctx.spinsNewestFirst.indexOf(ctx.candidateMainPick);
      const gap = idx === -1 ? ctx.spinsNewestFirst.length : idx;
      return gap >= p;
    },
  },
  {
    id: "candidate-gap-max",
    label: "Gap do candidato ≤ X giros",
    description: "Evita pegar números muito frios (variância alta).",
    category: "estatistica",
    paramLabel: "Gap máximo",
    paramMin: 5,
    paramMax: 200,
    paramStep: 1,
    paramDefault: 80,
    evaluate: (ctx, p) => {
      const idx = ctx.spinsNewestFirst.indexOf(ctx.candidateMainPick);
      const gap = idx === -1 ? ctx.spinsNewestFirst.length : idx;
      return gap <= p;
    },
  },
  {
    id: "no-zero-recent",
    label: "Sem zero nos últimos X giros",
    description: "Evita entrar logo após o zero (variância elevada local).",
    category: "estatistica",
    paramLabel: "Janela sem zero",
    paramMin: 1,
    paramMax: 30,
    paramStep: 1,
    paramDefault: 3,
    evaluate: (ctx, p) => !ctx.spinsNewestFirst.slice(0, p).includes(0),
  },
  {
    id: "no-dealer-drift",
    label: "Sem drift de dealer detectado",
    description: "Bloqueia entrada quando o detector marca alerta nível 'alert'.",
    category: "mesa",
    paramLabel: "Janela",
    paramMin: 20,
    paramMax: 100,
    paramStep: 10,
    paramDefault: 30,
    evaluate: (ctx, p) => detectDealerChange(ctx.spinsNewestFirst, p).alertLevel !== "alert",
  },
  {
    id: "sector-concentration",
    label: "Concentração de setor ≥ X",
    description: "Algum setor tem ≥ X giros nos últimos 20 (mesa com momentum).",
    category: "mesa",
    paramLabel: "Mín. dominância (20)",
    paramMin: 8,
    paramMax: 18,
    paramStep: 1,
    paramDefault: 11,
    evaluate: (ctx, p) => recentMaxFreq(ctx.spinsNewestFirst, 20) >= p,
  },
  {
    id: "min-history",
    label: "Histórico mínimo do app ≥ X",
    description: "Não emite sinal com pouco contexto coletado.",
    category: "estatistica",
    paramLabel: "Mín. giros",
    paramMin: 10,
    paramMax: 500,
    paramStep: 10,
    paramDefault: 60,
    evaluate: (ctx, p) => ctx.spinsNewestFirst.length >= p,
  },
  {
    id: "session-rounds-max",
    label: "Rodadas da sessão ≤ X",
    description: "Evita continuar entrando depois de muitas rodadas (cansaço/tilt).",
    category: "sessao",
    paramLabel: "Máx. rodadas",
    paramMin: 10,
    paramMax: 300,
    paramStep: 10,
    paramDefault: 60,
    evaluate: () => {
      const s = useHonestStore.getState().session;
      if (!s.startedAt) return true;
      return s.spinsThisSession <= s.maxRounds;
    },
  },
  {
    id: "model-min-contributors",
    label: "Mínimo de modelos concordando",
    description: "Pelo menos X modelos do ensemble devem dar prob acima do baseline (1/37) ao top-1.",
    category: "agente",
    paramLabel: "Mín. modelos",
    paramMin: 1,
    paramMax: 8,
    paramStep: 1,
    paramDefault: 3,
    evaluate: (ctx, p) => {
      if (!ctx.modelContributions) return true;
      const baseline = 1 / 37;
      const concordando = ctx.modelContributions.filter((m) => m.topPickProb > baseline).length;
      return concordando >= p;
    },
  },
  {
    id: "model-dominant-weight",
    label: "Modelo dominante com peso ≥ X",
    description: "O modelo top precisa ter peso mínimo (pesos vão de 0.2 a 1.0 conforme performance).",
    category: "agente",
    paramLabel: "Peso mínimo",
    paramMin: 0.2,
    paramMax: 1.0,
    paramStep: 0.05,
    paramDefault: 0.4,
    evaluate: (ctx, p) => {
      if (!ctx.modelContributions || ctx.modelContributions.length === 0) return true;
      return ctx.modelContributions[0].weight >= p;
    },
  },
  {
    id: "lstm-agrees",
    label: "LSTM concorda (prob > baseline)",
    description: "LSTM precisa dar probabilidade acima do baseline ao top-1 do ensemble.",
    category: "agente",
    paramLabel: "(sem parâmetro)",
    paramMin: 0,
    paramMax: 1,
    paramStep: 1,
    paramDefault: 0,
    evaluate: (ctx) => {
      if (!ctx.modelContributions) return true;
      const lstm = ctx.modelContributions.find((m) => m.id.includes("lstm") || m.name.toLowerCase().includes("lstm"));
      if (!lstm) return true;
      return lstm.topPickProb > 1 / 37;
    },
  },
];

export interface ActiveCondition {
  id: string;
  enabled: boolean;
  param: number;
}

export interface FilterStats {
  candidates: number;
  passes: number;
  passRate: number;
  hits: number;
  hitRate: number;
}

interface EntryFilterStore {
  enabled: boolean;
  combinator: "AND" | "OR";
  conditions: ActiveCondition[];
  stats: FilterStats;
  setEnabled: (v: boolean) => void;
  setCombinator: (v: "AND" | "OR") => void;
  toggle: (id: string) => void;
  setParam: (id: string, p: number) => void;
  resetStats: () => void;
  pushCandidate: (passed: boolean) => void;
  pushResult: (hit: boolean) => void;
}

const initialConditions: ActiveCondition[] = conditions.map((c) => ({
  id: c.id,
  enabled: ["agent-confidence-min", "min-history", "no-dealer-drift"].includes(c.id),
  param: c.paramDefault,
}));

export const useEntryFilter = create<EntryFilterStore>()(
  persist(
    (set) => ({
      enabled: true,
      combinator: "AND",
      conditions: initialConditions,
      stats: { candidates: 0, passes: 0, passRate: 0, hits: 0, hitRate: 0 },
      setEnabled: (v) => set({ enabled: v }),
      setCombinator: (v) => set({ combinator: v }),
      toggle: (id) =>
        set((s) => ({
          conditions: s.conditions.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c)),
        })),
      setParam: (id, p) =>
        set((s) => ({
          conditions: s.conditions.map((c) => (c.id === id ? { ...c, param: p } : c)),
        })),
      resetStats: () =>
        set({ stats: { candidates: 0, passes: 0, passRate: 0, hits: 0, hitRate: 0 } }),
      pushCandidate: (passed) =>
        set((s) => {
          const candidates = s.stats.candidates + 1;
          const passes = s.stats.passes + (passed ? 1 : 0);
          return {
            stats: {
              candidates,
              passes,
              passRate: candidates > 0 ? passes / candidates : 0,
              hits: s.stats.hits,
              hitRate: passes > 0 ? s.stats.hits / passes : 0,
            },
          };
        }),
      pushResult: (hit) =>
        set((s) => {
          const hits = s.stats.hits + (hit ? 1 : 0);
          return {
            stats: {
              ...s.stats,
              hits,
              hitRate: s.stats.passes > 0 ? hits / s.stats.passes : 0,
            },
          };
        }),
    }),
    {
      name: "rv-entry-filter-v1",
      partialize: (s) => ({ enabled: s.enabled, combinator: s.combinator, conditions: s.conditions }),
    }
  )
);

export interface FilterEvaluation {
  passed: boolean;
  passingConditions: number;
  totalActiveConditions: number;
  perCondition: Array<{ id: string; label: string; passed: boolean; param: number }>;
}

export const evaluateFilter = (ctx: FilterContext): FilterEvaluation => {
  const f = useEntryFilter.getState();
  const activeConditions = f.conditions.filter((c) => c.enabled);
  if (!f.enabled || activeConditions.length === 0) {
    return { passed: true, passingConditions: 0, totalActiveConditions: 0, perCondition: [] };
  }

  const perCondition = activeConditions.map((cond) => {
    const def = conditions.find((d) => d.id === cond.id);
    if (!def) return { id: cond.id, label: cond.id, passed: false, param: cond.param };
    let passed = false;
    try {
      passed = def.evaluate(ctx, cond.param);
    } catch {
      passed = false;
    }
    return { id: cond.id, label: def.label, passed, param: cond.param };
  });

  const passing = perCondition.filter((c) => c.passed).length;
  const passed = f.combinator === "AND" ? passing === perCondition.length : passing > 0;
  return { passed, passingConditions: passing, totalActiveConditions: perCondition.length, perCondition };
};

export const getConditionDef = (id: string) => conditions.find((c) => c.id === id);
