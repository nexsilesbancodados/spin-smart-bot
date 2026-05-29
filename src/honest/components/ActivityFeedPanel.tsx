import { memo } from "react";
import { useActivityFeed, ACTIVITY_LABELS } from "../lib/activityFeed";
import { Card, SectionHeader, Button, EmptyState } from "./ui";

const fmtAgo = (ms: number): string => {
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s`;
  if (ms < 3600_000) return `${Math.floor(ms / 60_000)}min`;
  if (ms < 86400_000) return `${Math.floor(ms / 3600_000)}h`;
  return `${Math.floor(ms / 86400_000)}d`;
};

const ActivityFeedPanel = memo(({ limit = 50 }: { limit?: number }) => {
  const events = useActivityFeed((s) => s.events);
  const clear = useActivityFeed((s) => s.clear);
  const visible = events.slice(0, limit);

  return (
    <Card padding="sm">
      <SectionHeader
        title={`Activity Feed (${events.length})`}
        subtitle="Log cronológico das decisões do agente, ticks, sinais, ajustes auto, anomalias."
        actions={
          events.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => confirm("Limpar feed?") && clear()}>
              limpar
            </Button>
          )
        }
      />
      {visible.length === 0 ? (
        <EmptyState
          icon="📜"
          title="Sem atividade ainda"
          description="Ative o agente, deixe o feed rodar. Eventos aparecem aqui em tempo real."
        />
      ) : (
        <div className="space-y-1 max-h-[600px] overflow-y-auto">
          {visible.map((e) => {
            const meta = ACTIVITY_LABELS[e.kind];
            return (
              <div key={e.id} className="flex items-start gap-2 py-1.5 px-2 rounded hover:bg-neutral-800/40 text-xs">
                <span className="text-base shrink-0 mt-0.5">{meta.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold ${meta.color}`}>{e.title}</span>
                    <span className="text-[10px] text-neutral-500 font-mono shrink-0">{fmtAgo(Date.now() - e.t)}</span>
                  </div>
                  {e.detail && <p className="text-[11px] text-neutral-400 mt-0.5 leading-snug">{e.detail}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
});
ActivityFeedPanel.displayName = "ActivityFeedPanel";
export default ActivityFeedPanel;
