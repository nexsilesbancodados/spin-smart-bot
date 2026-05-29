import { memo, useMemo, useState } from "react";
import { useHonestStore, selectAllSpinNumbers, selectWindowSpins } from "../lib/store";
import KnowledgeGraph from "../components/KnowledgeGraph";
import VerdictBadge from "../components/VerdictBadge";
import {
  buildMemory,
  createMarkov,
  trainMarkov,
  predictMarkov,
  topK,
  runFalsifier,
  type FalsifierReport,
} from "../lib/learning";
import { sectorOf, colorOf } from "../lib/wheel";
import { Card, PageContainer, PageHeader, SectionHeader, Button, EmptyState, Pill } from "../components/ui";

const RedeNeural = memo(() => {
  const allSpins = useHonestStore(selectAllSpinNumbers);
  const windowSpins = useHonestStore(selectWindowSpins);
  const setWindow = useHonestStore((s) => s.setWindow);
  const windowSize = useHonestStore((s) => s.windowSize);

  const [order, setOrder] = useState<1 | 2 | 3>(2);
  const [showCoocc, setShowCoocc] = useState(true);
  const [showTransitions, setShowTransitions] = useState(true);
  const [falsifierReport, setFalsifierReport] = useState<FalsifierReport | null>(null);
  const [running, setRunning] = useState(false);

  const memory = useMemo(() => buildMemory(allSpins), [allSpins]);

  const prediction = useMemo(() => {
    if (allSpins.length < order + 3) return null;
    const model = createMarkov(order);
    trainMarkov(model, allSpins);
    const probs = predictMarkov(model, allSpins.slice(0, order));
    return topK(probs, 6);
  }, [allSpins, order]);

  const runFalsifierAsync = () => {
    setRunning(true);
    setTimeout(() => {
      try {
        const report = runFalsifier(allSpins, order);
        setFalsifierReport(report);
      } finally {
        setRunning(false);
      }
    }, 30);
  };

  if (allSpins.length < 10) {
    return (
      <PageContainer>
        <PageHeader title="Rede de Aprendizado" subtitle="Grafo + Markov + falsificador." />
        <EmptyState
          icon="🧠"
          title={`Aguardando giros (${allSpins.length}/10)`}
          description="A rede precisa de pelo menos 10 giros para começar a aprender. Idealmente 100+."
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Rede de Aprendizado"
        subtitle="Grafo de conhecimento da roleta, memória Markov ordem 1–3 e falsificador estatístico."
      />

      <Card>
        <SectionHeader
          title="Grafo de conhecimento"
          subtitle="Nós: números, setores, terminais, cores, dúzias, colunas. Arestas: co-ocorrências e transições observadas."
          actions={
            <>
              <label className="flex items-center gap-1.5 cursor-pointer text-[11px]">
                <input
                  type="checkbox"
                  checked={showCoocc}
                  onChange={(e) => setShowCoocc(e.target.checked)}
                  className="accent-amber-500"
                />
                Co-ocorrências
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-[11px]">
                <input
                  type="checkbox"
                  checked={showTransitions}
                  onChange={(e) => setShowTransitions(e.target.checked)}
                  className="accent-amber-500"
                />
                Transições
              </label>
            </>
          }
        />
        <KnowledgeGraph spins={allSpins} showCooccurrence={showCoocc} showTransitions={showTransitions} />
        <p className="text-[10px] text-neutral-500 mt-2 leading-relaxed">
          Clique num nó para isolar conexões. Roda = zoom · arrastar = pan.
        </p>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <SectionHeader title="Memória de padrões" actions={<Pill>{memory.totalSpins} giros</Pill>} />
          <SectorMatrix matrix={memory.sectorTransitions.matrix} totals={memory.sectorTransitions.totals} labels={memory.sectorTransitions.labels} />
          <NGramSection title="Bigramas mais frequentes (par A → B)" items={memory.bigrams} />
          <NGramSection title="Trigramas mais frequentes" items={memory.trigrams} />
        </Card>

        <Card>
          <SectionHeader
            title="Preditor Markov"
            subtitle={`Baseline 1/37 = ${(100 / 37).toFixed(2)}%`}
            actions={
              <div className="inline-flex rounded-lg border border-neutral-700 overflow-hidden">
                {[1, 2, 3].map((o) => (
                  <button
                    key={o}
                    onClick={() => setOrder(o as 1 | 2 | 3)}
                    className={`px-2.5 py-1 text-xs font-semibold ${
                      order === o ? "bg-amber-500 text-black" : "bg-neutral-900 text-neutral-300"
                    }`}
                  >
                    O{o}
                  </button>
                ))}
              </div>
            }
          />
          {prediction ? (
            <div className="space-y-1.5">
              {prediction.map((p) => {
                const aboveBaseline = p.p > 1 / 37;
                return (
                  <div key={p.n} className="flex items-center gap-2">
                    <div
                      className={`w-7 h-7 rounded-md flex items-center justify-center text-white text-[11px] font-bold ${
                        colorOf(p.n) === "green"
                          ? "bg-emerald-700"
                          : colorOf(p.n) === "red"
                            ? "bg-red-700"
                            : "bg-neutral-800"
                      }`}
                    >
                      {p.n}
                    </div>
                    <div className="flex-1">
                      <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                        <div
                          className={aboveBaseline ? "bg-amber-500 h-2" : "bg-neutral-600 h-2"}
                          style={{ width: `${Math.min(100, p.p * 100 * 6)}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-neutral-300 w-14 text-right">
                      {(p.p * 100).toFixed(2)}%
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-xs text-neutral-500">Coletando giros suficientes...</div>
          )}
        </Card>
      </div>

      <Card>
        <SectionHeader
          title="Validação (falsificador)"
          subtitle="Compara o modelo no histórico real vs embaralhado vs ruído puro."
          actions={
            <Button variant="primary" onClick={runFalsifierAsync} disabled={running || allSpins.length < 30}>
              {running ? "Rodando…" : `Rodar (ordem ${order})`}
            </Button>
          }
        />
        {falsifierReport ? (
          <FalsifierResult report={falsifierReport} />
        ) : (
          <div className="text-xs text-neutral-500">
            {allSpins.length < 30
              ? `Precisa de pelo menos 30 giros (você tem ${allSpins.length}).`
              : "Clique em rodar. Pode demorar alguns segundos."}
          </div>
        )}
      </Card>

      <div className="text-center text-[11px] text-neutral-500">
        Janela para o grafo dinâmico:
        <span className="ml-2 inline-flex rounded-md border border-neutral-700 overflow-hidden">
          {[20, 50, 100, 500].map((w) => (
            <button
              key={w}
              onClick={() => setWindow(w as 20 | 50 | 100 | 500)}
              className={`px-2 py-0.5 ${
                windowSize === w ? "bg-amber-500 text-black" : "bg-neutral-900 text-neutral-300"
              }`}
            >
              {w}
            </button>
          ))}
        </span>
        <span className="ml-2">({windowSpins.length} giros)</span>
      </div>
    </PageContainer>
  );
});
RedeNeural.displayName = "RedeNeural";

const SectorMatrix = memo(
  ({ matrix, totals, labels }: { matrix: number[][]; totals: number[]; labels: string[] }) => (
    <div className="overflow-x-auto">
      <table className="text-[11px] border-collapse">
        <thead>
          <tr>
            <th className="p-1 text-neutral-500 font-normal">de \ para</th>
            {labels.map((l) => (
              <th key={l} className="p-1 text-neutral-300 font-semibold">
                {l}
              </th>
            ))}
            <th className="p-1 text-neutral-500 font-normal">total</th>
          </tr>
        </thead>
        <tbody>
          {labels.map((row, i) => (
            <tr key={row}>
              <th className="p-1 text-neutral-300 font-semibold text-left">{row}</th>
              {labels.map((_, j) => {
                const v = matrix[i][j];
                const pct = totals[i] > 0 ? (v / totals[i]) * 100 : 0;
                const intensity = Math.min(0.7, pct / 100);
                return (
                  <td key={j} className="p-1">
                    <div
                      className="rounded px-2 py-1 text-center font-mono"
                      style={{ background: `rgba(245, 158, 11, ${intensity})`, color: intensity > 0.3 ? "#0a0a0a" : "#e5e5e5" }}
                    >
                      {v}
                      <div className="text-[9px] opacity-70">{pct.toFixed(0)}%</div>
                    </div>
                  </td>
                );
              })}
              <td className="p-1 text-neutral-400 font-mono">{totals[i]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[10px] text-neutral-500 mt-1.5">
        Frequência observada de transição entre setores. Esperado: ~17/37 para Voisins, 12/37 para Tiers, 8/37 para
        Orphelins. Desvios pequenos são variância pura.
      </p>
    </div>
  )
);
SectorMatrix.displayName = "SectorMatrix";

const NGramSection = memo(({ title, items }: { title: string; items: Array<{ pattern: number[]; count: number; lift: number }> }) => (
  <div className="mt-3">
    <div className="text-[11px] font-semibold text-neutral-300 mb-1">{title}</div>
    {items.length === 0 ? (
      <div className="text-[10px] text-neutral-500">Nenhum padrão repetido ainda.</div>
    ) : (
      <div className="space-y-1">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-1 text-[11px]">
            <div className="flex gap-0.5 mr-2">
              {it.pattern.map((n, j) => (
                <span
                  key={j}
                  className={`w-5 h-5 rounded text-[9px] font-bold flex items-center justify-center text-white ${
                    colorOf(n) === "green" ? "bg-emerald-700" : colorOf(n) === "red" ? "bg-red-700" : "bg-neutral-800"
                  }`}
                >
                  {n}
                </span>
              ))}
            </div>
            <span className="font-mono text-neutral-300">{it.count}×</span>
            <span className="text-neutral-500 text-[10px]">· lift ≈ {it.lift.toFixed(1)}×</span>
            <VerdictBadge verdict={it.lift > 5 ? "leve" : "aleatorio"} />
          </div>
        ))}
      </div>
    )}
  </div>
));
NGramSection.displayName = "NGramSection";

const FalsifierResult = memo(({ report }: { report: FalsifierReport }) => {
  const v = report.verdict;
  const accent =
    v === "no_edge"
      ? "text-emerald-300 border-emerald-700/50 bg-emerald-950/40"
      : v === "marginal"
        ? "text-amber-300 border-amber-700/50 bg-amber-950/40"
        : "text-orange-300 border-orange-700/50 bg-orange-950/40";
  const label = v === "no_edge" ? "Sem borda detectável" : v === "marginal" ? "Diferença marginal" : "Possível anomalia";

  const rows: Array<{ name: string; logLoss: number; accuracy: number; samples?: number }> = [
    { name: "Real (seu histórico)", ...report.real },
    { name: "Embaralhado", ...report.shuffled },
    { name: "Ruído puro", ...report.synthetic },
    { name: "Baseline uniforme (1/37)", logLoss: report.uniformBaseline.logLoss, accuracy: report.uniformBaseline.accuracy },
  ];

  return (
    <div className="space-y-3">
      <div className={`rounded-md border px-3 py-2 text-sm font-semibold ${accent}`}>
        Veredito: {label}
      </div>
      <table className="w-full text-[11px] border-collapse">
        <thead>
          <tr className="text-neutral-500">
            <th className="text-left p-1 font-normal">Cenário</th>
            <th className="p-1 font-normal">Log-loss</th>
            <th className="p-1 font-normal">Acurácia</th>
            <th className="p-1 font-normal">Amostras</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-t border-neutral-800">
              <td className="p-1.5 text-neutral-300">{r.name}</td>
              <td className="p-1.5 font-mono text-neutral-200">{r.logLoss.toFixed(3)}</td>
              <td className="p-1.5 font-mono text-neutral-200">{(r.accuracy * 100).toFixed(2)}%</td>
              <td className="p-1.5 font-mono text-neutral-500">{r.samples ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[11px] text-neutral-300 leading-relaxed">{report.message}</p>
      <p className="text-[10px] text-neutral-500">
        Treino: {report.trainSize} giros · Teste: {report.testSize} giros · Acurácia esperada por acaso: ~{(100 / 37).toFixed(2)}%.
        Se as três primeiras linhas estão próximas entre si, o modelo NÃO aprendeu nada útil — está só ecoando ruído.
      </p>
    </div>
  );
});
FalsifierResult.displayName = "FalsifierResult";

export default RedeNeural;
