import { memo, useEffect, useMemo, useState } from "react";
import { useHonestStore } from "../lib/store";
import { useReplay } from "../lib/replay";
import { useFeedStatus } from "../lib/feedStatus";
import { colorOf } from "../lib/wheel";
import { Card, PageContainer, PageHeader, SectionHeader, Button, EmptyState, Pill } from "../components/ui";

const ballBg = (n: number) => {
  const c = colorOf(n);
  if (c === "green") return "bg-emerald-600";
  if (c === "red") return "bg-red-600";
  return "bg-neutral-800";
};

const Replay = memo(() => {
  const allSpins = useHonestStore((s) => s.spins);
  const sessionHistory = useHonestStore((s) => s.history);
  const setLiveSpins = useHonestStore((s) => s.setLiveSpins);
  const setPollEnabled = useFeedStatus((s) => s.setPollEnabled);
  const replay = useReplay();
  const [sourceSize, setSourceSize] = useState(100);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);

  useEffect(() => {
    if (!replay.active) return;
    const ms = 1000 / replay.speed;
    const id = setInterval(() => {
      replay.next();
    }, ms);
    return () => clearInterval(id);
  }, [replay.active, replay.speed]);

  useEffect(() => {
    if (replay.source.length === 0) return;
    const slice = replay.source.slice(0, replay.index + 1).reverse();
    setLiveSpins(slice);
  }, [replay.index, replay.source, setLiveSpins]);

  const beginReplay = () => {
    if (!confirm("Iniciar replay vai sobrescrever o feed ao vivo. Polling será pausado. Continuar?")) return;
    setPollEnabled(false);
    const slice = allSpins.slice(0, sourceSize).map((s) => s.n).reverse();
    replay.start(slice, replay.speed);
  };

  const stopReplay = () => {
    replay.stop();
    setPollEnabled(true);
  };

  const recent = useMemo(() => {
    if (!replay.active && replay.source.length === 0) return [];
    return replay.source.slice(Math.max(0, replay.index - 10), replay.index + 1).reverse();
  }, [replay.source, replay.index, replay.active]);

  const progress = replay.source.length > 0 ? replay.index / replay.source.length : 0;

  return (
    <PageContainer>
      <PageHeader
        title="Modo Replay"
        subtitle="Roda um histórico passado giro a giro em velocidade controlada. Útil pra praticar estratégias, ver o agente reagir, ou auditar uma sessão antiga."
      />

      <Card>
        <SectionHeader
          title="Iniciar novo replay"
          actions={
            replay.source.length === 0 ? (
              <Button variant="primary" onClick={beginReplay} disabled={allSpins.length < 30}>
                ▶ Iniciar
              </Button>
            ) : (
              <Button variant="danger" onClick={stopReplay}>
                ◼ Parar
              </Button>
            )
          }
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-neutral-500">Tamanho da fonte</span>
            <select
              value={sourceSize}
              onChange={(e) => setSourceSize(Number(e.target.value))}
              className="bg-neutral-950 border border-neutral-700 rounded-md px-2 py-1.5 text-sm"
              disabled={replay.active}
            >
              <option value={50}>50 últimos</option>
              <option value={100}>100 últimos</option>
              <option value={200}>200 últimos</option>
              <option value={500}>500 últimos</option>
              <option value={1000}>1000 últimos</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-neutral-500">Velocidade</span>
            <select
              value={replay.speed}
              onChange={(e) => replay.setSpeed(Number(e.target.value))}
              className="bg-neutral-950 border border-neutral-700 rounded-md px-2 py-1.5 text-sm"
            >
              <option value={0.5}>0,5× (lento)</option>
              <option value={1}>1× (real)</option>
              <option value={2}>2×</option>
              <option value={5}>5×</option>
              <option value={10}>10×</option>
              <option value={20}>20× (turbo)</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-neutral-500">Sessão do diário</span>
            <select
              value={selectedSession ?? ""}
              onChange={(e) => setSelectedSession(e.target.value || null)}
              className="bg-neutral-950 border border-neutral-700 rounded-md px-2 py-1.5 text-sm"
            >
              <option value="">(usar histórico atual)</option>
              {sessionHistory.slice(0, 20).map((h) => (
                <option key={h.id} value={h.id}>
                  {new Date(h.startedAt).toLocaleString("pt-BR")} · {h.rounds} rodadas · {h.pnl >= 0 ? "+" : ""}
                  {h.pnl.toFixed(0)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Card>

      {replay.source.length > 0 && (
        <Card accent={replay.active ? "warn" : "neutral"}>
          <SectionHeader
            title="Reprodução em andamento"
            actions={
              <>
                <Pill accent={replay.active ? "good" : "neutral"}>
                  {replay.active ? "PLAY" : "PAUSED"}
                </Pill>
                {replay.active ? (
                  <Button size="sm" onClick={replay.pause}>
                    ⏸ Pausar
                  </Button>
                ) : (
                  <Button size="sm" variant="primary" onClick={replay.resume}>
                    ▶ Retomar
                  </Button>
                )}
                <Button size="sm" onClick={replay.next} disabled={replay.active}>
                  → Próximo
                </Button>
              </>
            }
          />
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-mono text-neutral-400">
              {replay.index + 1} / {replay.source.length}
            </span>
            <div className="flex-1 h-2 bg-neutral-800 rounded-full overflow-hidden">
              <div className="h-2 bg-amber-500" style={{ width: `${progress * 100}%` }} />
            </div>
            <span className="text-xs font-mono text-neutral-400">{(progress * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={replay.source.length - 1}
            value={replay.index}
            onChange={(e) => replay.jumpTo(Number(e.target.value))}
            className="w-full accent-amber-500"
          />
          <div className="flex flex-wrap gap-1 mt-3">
            {recent.map((n, i) => (
              <div
                key={i}
                className={`${ballBg(n)} text-white text-sm font-bold w-9 h-9 rounded-md flex items-center justify-center ${
                  i === 0 ? "ring-2 ring-amber-400" : ""
                }`}
              >
                {n}
              </div>
            ))}
          </div>
        </Card>
      )}

      {replay.source.length === 0 && allSpins.length < 30 && (
        <EmptyState
          icon="⏮"
          title={`Histórico insuficiente (${allSpins.length}/30)`}
          description="O replay precisa de pelo menos 30 giros no histórico."
        />
      )}
    </PageContainer>
  );
});
Replay.displayName = "Replay";

export default Replay;
