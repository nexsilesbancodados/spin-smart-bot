import { memo, useMemo, useState } from "react";
import { colorOf } from "../lib/wheel";
import type { Spin } from "../lib/store";
import { useAnnotations } from "../lib/annotations";
import AnnotationDialog from "./AnnotationDialog";

const cellBg = (n: number) => {
  const c = colorOf(n);
  if (c === "green") return "bg-emerald-600";
  if (c === "red") return "bg-red-600";
  return "bg-neutral-900";
};

interface Props {
  spins: Spin[];
  limit?: number;
  columns?: number;
  cellSize?: "xs" | "sm" | "md";
}

const cellSizeClass: Record<NonNullable<Props["cellSize"]>, string> = {
  xs: "h-7 text-[11px]",
  sm: "h-9 text-[13px]",
  md: "h-11 text-base",
};

const SpinList = memo(({ spins, limit = 300, columns = 10, cellSize = "sm" }: Props) => {
  const items = useMemo(() => spins.slice(0, limit), [spins, limit]);
  const annotations = useAnnotations((s) => s.annotations);
  const [dialogSpin, setDialogSpin] = useState<Spin | null>(null);

  const annotationsByTimestamp = useMemo(() => {
    const map = new Map<number, number>();
    for (const a of annotations) map.set(a.spinTimestamp, (map.get(a.spinTimestamp) ?? 0) + 1);
    return map;
  }, [annotations]);

  if (items.length === 0) {
    return (
      <div className="text-center py-10 text-neutral-500 text-xs">
        Nenhum giro registrado ainda.
      </div>
    );
  }

  return (
    <>
      <div
        className="grid gap-1 p-1 bg-neutral-950 border border-neutral-800 rounded-md"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        role="grid"
        aria-label="Histórico de giros"
      >
        {items.map((s, i) => {
          const annCount = Array.from(annotationsByTimestamp.entries()).filter(
            ([t]) => Math.abs(t - s.t) < 30_000
          ).reduce((a, [, c]) => a + c, 0);
          return (
            <button
              key={`${s.t}-${i}`}
              onClick={() => setDialogSpin(s)}
              className={`${cellSizeClass[cellSize]} ${cellBg(s.n)} text-white font-bold font-mono tabular-nums flex items-center justify-center rounded relative hover:scale-105 transition ${
                i === 0 ? "ring-2 ring-amber-400 ring-offset-1 ring-offset-neutral-950" : "border border-black/30"
              }`}
              title={`${s.n} · ${new Date(s.t).toLocaleString("pt-BR")} · ${s.source}${annCount > 0 ? ` · ${annCount} anotação(ões)` : ""}`}
              role="gridcell"
            >
              {s.n}
              {annCount > 0 && (
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-400 text-black text-[8px] font-bold flex items-center justify-center border border-neutral-950">
                  {annCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <AnnotationDialog open={!!dialogSpin} onClose={() => setDialogSpin(null)} spin={dialogSpin} />
    </>
  );
});
SpinList.displayName = "SpinList";
export default SpinList;
