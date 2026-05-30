import { memo, useMemo, useState } from "react";
import { useHonestStore } from "../lib/store";
import { runPatternBank, summarizeLearning, ActivatedRule } from "../lib/patternLearning";
import { activateDiscovered, useAutoDiscovery } from "../lib/autoDiscovery";
import { colorOf } from "../lib/wheel";
import { Card, PageContainer, SectionHeader, Pill } from "../components/ui";

interface FamilySignal {
  group: string;
  description: string;
  predicted: string;
  predictedType: string;
  numbers: number[];
  payout: number;
  baseline: number;
  hits: number;
  attempts: number;
  accuracy: number;
  wilsonLower: number;
  validated: boolean;
  liveAccuracyAboveBaseline: boolean;
  isAuto: boolean;
}

const ballBg = (n: number) => {
  const c = colorOf(n);
  if (c === "green") return "bg-emerald-600";
  if (c === "red") return "bg-gradient-to-br from-red-500 to-red-700";
  return "bg-gradient-to-br from-neutral-700 to-neutral-900";
};

const SinaisPadroes = memo(() => {
  const spins = useHonestStore((s) => s.spins);
  const autoRules = useAutoDiscovery((s) => s.rules);
  const totalDiscovered = useAutoDiscovery((s) => s.totalDiscovered);
  const [filter, setFilter] = useState<"all" | "validated" | "auto">("all");

  const history = useMemo(() => spins.map((s) => s.n), [spins]);

  const familySignals = useMemo<FamilySignal[]>(() => {
    if (history.length < 4) return [];
    const activated = runPatternBank(history);
    const discovered = activateDiscovered(history);
    const familyBest = new Map<string, FamilySignal>();

    const tryAdd = (
      group: string,
      rule: ActivatedRule | null,
      isAuto: boolean,
      autoHits = 0,
      autoAttempts = 0,
      autoAccuracy = 0,
      autoWilson = 0,
      desc?: string,
      numbers?: Set<number>,
      payout?: number,
      baseline?: number,
      label?: string,
      type?: string
    ) => {
      const hits = rule ? rule.hits : autoHits;
      const attempts = rule ? rule.attempts : autoAttempts;
      const accuracy = rule ? rule.learnedAccuracy : autoAccuracy;
      const wilsonLower = rule ? rule.learnedAccuracy : autoWilson;
      const baseProb = rule ? rule.baseline : baseline ?? 0;
      const validated = attempts >= 8 && wilsonLower > baseProb;
      const liveAccAboveBaseline = attempts >= 3 && (hits / Math.max(1, attempts)) > baseProb;
      const signal: FamilySignal = {
        group,
        description: rule ? rule.description : desc ?? "",
        predicted: rule ? rule.targetLabel : label ?? "",
        predictedType: rule ? rule.targetType : type ?? "",
        numbers: rule ? Array.from(rule.numbers) : Array.from(numbers ?? []),
        payout: rule ? rule.payout : payout ?? 1,
        baseline: baseProb,
        hits,
        attempts,
        accuracy,
        wilsonLower,
        validated,
        liveAccuracyAboveBaseline: liveAccAboveBaseline,
        isAuto,
      };
      const existing = familyBest.get(group);
      if (!existing || wilsonLower > existing.wilsonLower) {
        familyBest.set(group, signal);
      }
    };

    for (const rule of activated) {
      tryAdd(rule.group, rule, false);
    }
    for (const d of discovered) {
      tryAdd(
        d.group,
        null,
        true,
        d.hits,
        d.attempts,
        d.learnedAccuracy,
        d.learnedAccuracy,
        d.description,
        d.numbers,
        d.payout,
        d.baseline,
        d.targetLabel,
        d.targetType
      );
    }

    let arr = Array.from(familyBest.values());
    arr.sort((a, b) => b.wilsonLower - a.wilsonLower);
    return arr;
  }, [history, autoRules]);

  const filtered = familySignals.filter((s) => {
    if (filter === "validated") return s.validated;
    if (filter === "auto") return s.isAuto;
    return true;
  });

  const summary = summarizeLearning();
  const validatedCount = familySignals.filter((s) => s.validated).length;
  const autoCount = familySignals.filter((s) => s.isAuto).length;

  return (
    <PageContainer>
      <Card padding="md">
        <SectionHeader
          title="🎯 Sinais por Família de Padrão"
          eyebrow="Cada tipo tem seu sinal próprio"
          subtitle={
            <span className="text-[10px] text-neutral-500">
              {familySignals.length} famílias ativas · {validatedCount} validadas ·{" "}
              {autoCount} auto-descobertas · {summary.bank} regras no banco ·{" "}
              {totalDiscovered} dinâmicas aprendidas
            </span>
          }
        />

        <div className="flex items-center gap-1 mb-3 text-[10px]">
          {(
            [
              { id: "all" as const, label: `Todas (${familySignals.length})` },
              { id: "validated" as const, label: `Validadas (${validatedCount})` },
              { id: "auto" as const, label: `Auto-aprendidas (${autoCount})` },
            ]
          ).map((opt) => (
            <button
              key={opt.id}
              onClick={() => setFilter(opt.id)}
              className={`px-2 py-1 rounded font-bold ${
                filter === opt.id ? "bg-amber-500 text-black" : "bg-neutral-800 text-neutral-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="text-[11px] text-neutral-500 italic py-3 text-center">
            {history.length < 4
              ? "Aguardando histórico mínimo para ativar padrões"
              : "Nenhuma família ativa neste momento — aguarde próximo giro"}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((sig) => {
              const accent: "good" | "warn" | "neutral" | "bad" = sig.validated
                ? "good"
                : sig.liveAccuracyAboveBaseline
                ? "warn"
                : sig.attempts >= 5
                ? "bad"
                : "neutral";
              return (
                <div
                  key={sig.group}
                  className={`rounded-xl border p-2.5 ${
                    accent === "good"
                      ? "border-emerald-600/50 bg-emerald-950/30"
                      : accent === "warn"
                      ? "border-amber-600/50 bg-amber-950/30"
                      : accent === "bad"
                      ? "border-red-600/40 bg-red-950/20"
                      : "border-neutral-700 bg-neutral-900/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                        <span className="text-[9px] uppercase tracking-wider text-neutral-500 font-bold">
                          {sig.group}
                        </span>
                        {sig.isAuto && (
                          <Pill accent="warn">auto-aprendido</Pill>
                        )}
                        {sig.validated && <Pill accent="good">VALIDADO</Pill>}
                        {!sig.validated && sig.liveAccuracyAboveBaseline && (
                          <Pill accent="warn">acima do acaso</Pill>
                        )}
                      </div>
                      <div className="text-sm font-bold text-white truncate">
                        → {sig.predicted}
                      </div>
                      <div className="text-[10px] text-neutral-400 truncate">
                        {sig.description}
                      </div>
                    </div>
                    <div className="text-right shrink-0 font-mono">
                      <div
                        className={`text-base font-black ${
                          sig.wilsonLower > sig.baseline
                            ? "text-emerald-300"
                            : "text-neutral-400"
                        }`}
                      >
                        {(sig.accuracy * 100).toFixed(1)}%
                      </div>
                      <div className="text-[9px] text-neutral-500">
                        {sig.hits}/{sig.attempts} · base {(sig.baseline * 100).toFixed(0)}%
                      </div>
                    </div>
                  </div>

                  {sig.numbers.length > 0 && sig.numbers.length <= 12 && (
                    <div className="flex flex-wrap gap-0.5 mt-1.5">
                      {sig.numbers.slice(0, 12).map((n) => (
                        <div
                          key={n}
                          className={`${ballBg(n)} text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center ring-1 ring-white/20`}
                        >
                          {n}
                        </div>
                      ))}
                    </div>
                  )}

                  {sig.numbers.length > 12 && (
                    <div className="text-[10px] text-neutral-500 mt-1">
                      {sig.numbers.length} números no alvo · paga {sig.payout.toFixed(1)}:1
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card padding="sm" accent="warn">
        <div className="text-[10px] text-amber-200 leading-snug">
          ⚠ Cada família dispara seu próprio sinal. "Validado" = ≥ 8 amostras +
          Wilson lower bound acima da baseline aleatória. Auto-aprendidos vêm da
          mineração de padrões repetidos no histórico ao vivo. <b>Nenhuma família
          derrota a vantagem de 2,7% da casa</b> — isso é leitura descritiva, não
          previsão garantida.
        </div>
      </Card>
    </PageContainer>
  );
});
SinaisPadroes.displayName = "SinaisPadroes";

export default SinaisPadroes;
