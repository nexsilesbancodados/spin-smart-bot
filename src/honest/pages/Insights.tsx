import { memo, useMemo } from "react";
import { useHonestStore } from "../lib/store";
import { generateInsights } from "../lib/insights";
import { Card, PageContainer, PageHeader, EmptyState, Button } from "../components/ui";
import ActivityFeedPanel from "../components/ActivityFeedPanel";
import SmartSuggestions from "../components/SmartSuggestions";

const severityClass = {
  neutral: "bg-neutral-900/50 border-neutral-800 text-neutral-200",
  info: "bg-sky-950/30 border-sky-700/40 text-sky-100",
  warn: "bg-amber-950/30 border-amber-700/40 text-amber-100",
  good: "bg-emerald-950/30 border-emerald-700/40 text-emerald-100",
};

const Insights = memo(() => {
  const spins = useHonestStore((s) => s.spins.map((x) => x.n));
  const insights = useMemo(() => generateInsights(spins), [spins]);

  const printReport = () => {
    window.print();
  };

  return (
    <PageContainer>
      <PageHeader
        title="Insights"
        subtitle="O que está acontecendo na mesa, em linguagem natural. Gerado automaticamente a cada giro."
        actions={<Button onClick={printReport}>🖨 Imprimir relatório</Button>}
      />

      {spins.length === 0 ? (
        <EmptyState icon="📭" title="Sem dados" description="Aguarde o feed populir." />
      ) : (
        <>
          <SmartSuggestions />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" id="insights-print">
            {insights.map((ins) => (
              <div key={ins.id} className={`rounded-2xl border p-4 ${severityClass[ins.severity]}`}>
                <div className="flex items-start gap-3">
                  <span className="text-2xl shrink-0">{ins.emoji}</span>
                  <div className="flex-1">
                    <h3 className="font-bold text-sm">{ins.title}</h3>
                    <p className="text-xs mt-1 opacity-90 leading-relaxed">{ins.body}</p>
                    {ins.metric && (
                      <div className="text-[10px] font-mono mt-2 opacity-70">{ins.metric}</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Card>
            <ActivityFeedPanel limit={30} />
          </Card>
        </>
      )}
    </PageContainer>
  );
});
Insights.displayName = "Insights";

export default Insights;
