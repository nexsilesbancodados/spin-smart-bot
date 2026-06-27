import { memo, useMemo, useState } from "react";
import { colorOf } from "../lib/wheel";
import type { Spin } from "../lib/store";

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
  const [selected, setSelected] = useState<number | null>(null);

  const matchCount = useMemo(
    () => (selected === null ? 0 : items.filter((s) => s.n === selected).length),
    [items, selected]
  );

  if (items.length === 0) {
    return (
      <div className="text-center py-10 text-neutral-500 text-xs">
        Nenhum giro registrado ainda.
      </div>
    );
  }

  return (
    <>
      {selected !== null && (
        <div className="flex items-center justify-between mb-2 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-[11px]">
          <span className="text-amber-200">
            Destacando número <strong className="font-mono">{selected}</strong> ·{" "}
            <span className="font-mono">{matchCount}</span> ocorrência(s)
          </span>
          <button
            onClick={() => setSelected(null)}
            className="text-amber-300 hover:text-amber-100 font-bold"
          >
            limpar
          </button>
        </div>
      )}
      <div
        className="grid gap-1 p-1 bg-neutral-950 border border-neutral-800 rounded-md"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        role="grid"
        aria-label="Histórico de giros"
      >
        {items.map((s, i) => {
          const isMatch = selected !== null && s.n === selected;
          const dim = selected !== null && !isMatch;
          return (
            <button
              key={`${s.t}-${i}`}
              onClick={() => setSelected((cur) => (cur === s.n ? null : s.n))}
              className={`${cellSizeClass[cellSize]} ${cellBg(s.n)} text-white font-bold font-mono tabular-nums flex items-center justify-center rounded relative hover:scale-105 transition ${
                isMatch
                  ? "ring-2 ring-amber-400 ring-offset-1 ring-offset-neutral-950 shadow-lg shadow-amber-500/30"
                  : i === 0
                  ? "ring-2 ring-amber-400/60 ring-offset-1 ring-offset-neutral-950"
                  : "border border-black/30"
              } ${dim ? "opacity-25" : ""}`}
              title={`${s.n} · ${new Date(s.t).toLocaleString("pt-BR")}`}
              role="gridcell"
            >
              {s.n}
            </button>
          );
        })}
      </div>
    </>
  );
});
SpinList.displayName = "SpinList";
export default SpinList;
