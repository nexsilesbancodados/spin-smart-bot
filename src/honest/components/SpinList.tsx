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

type FilterKey =
  | `term:${number}`
  | `col:${number}`
  | `doz:${number}`
  | `cor:${"red" | "black" | "green"}`
  | `par:${"par" | "impar"}`
  | `hl:${"alto" | "baixo"}`;

const terminalOf = (n: number) => n % 10;
const columnOf = (n: number) => (n === 0 ? 0 : ((n - 1) % 3) + 1);
const dozenOf = (n: number) => (n === 0 ? 0 : Math.ceil(n / 12));

const matchesFilter = (n: number, f: FilterKey): boolean => {
  const [k, v] = f.split(":");
  switch (k) {
    case "term": return terminalOf(n) === Number(v);
    case "col": return columnOf(n) === Number(v);
    case "doz": return dozenOf(n) === Number(v);
    case "cor": return colorOf(n) === v;
    case "par": return n !== 0 && (v === "par" ? n % 2 === 0 : n % 2 === 1);
    case "hl": return n !== 0 && (v === "alto" ? n >= 19 : n <= 18);
  }
  return false;
};

const Chip = ({
  active,
  onClick,
  children,
  tone = "amber",
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  tone?: "amber" | "red" | "neutral" | "emerald";
}) => {
  const tones: Record<string, string> = {
    amber: active
      ? "bg-amber-500 text-black border-amber-400"
      : "bg-neutral-900 text-neutral-300 border-neutral-700 hover:border-amber-500/60",
    red: active
      ? "bg-red-600 text-white border-red-500"
      : "bg-neutral-900 text-neutral-300 border-neutral-700 hover:border-red-500/60",
    neutral: active
      ? "bg-neutral-200 text-black border-neutral-100"
      : "bg-neutral-900 text-neutral-300 border-neutral-700 hover:border-neutral-400",
    emerald: active
      ? "bg-emerald-600 text-white border-emerald-500"
      : "bg-neutral-900 text-neutral-300 border-neutral-700 hover:border-emerald-500/60",
  };
  return (
    <button
      onClick={onClick}
      className={`px-2 h-7 rounded text-[11px] font-mono font-bold border transition ${tones[tone]}`}
    >
      {children}
    </button>
  );
};

const SpinList = memo(({ spins, limit = 300, columns = 10, cellSize = "sm" }: Props) => {
  const items = useMemo(() => spins.slice(0, limit), [spins, limit]);
  const [hover, setHover] = useState<number | null>(null);
  const [filters, setFilters] = useState<Set<FilterKey>>(new Set());

  const toggle = (f: FilterKey) =>
    setFilters((cur) => {
      const next = new Set(cur);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });

  const hasFilters = filters.size > 0;

  const isHighlighted = (n: number): boolean => {
    if (hover !== null && n === hover) return true;
    if (hasFilters) {
      for (const f of filters) if (matchesFilter(n, f)) return true;
    }
    return false;
  };

  const anyActive = hasFilters || hover !== null;

  const matchCount = useMemo(() => {
    if (!anyActive) return 0;
    return items.filter((s) => isHighlighted(s.n)).length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, filters, hover]);

  if (items.length === 0) {
    return (
      <div className="text-center py-10 text-neutral-500 text-xs">
        Nenhum giro registrado ainda.
      </div>
    );
  }

  return (
    <>
      {/* Selector panel */}
      <div className="mb-3 p-2 bg-neutral-950 border border-neutral-800 rounded-md space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-neutral-400 uppercase tracking-wide">
            Destacar por categoria
          </span>
          {hasFilters && (
            <button
              onClick={() => setFilters(new Set())}
              className="text-[11px] text-amber-300 hover:text-amber-100 font-bold"
            >
              limpar filtros
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[10px] text-neutral-500 w-16 shrink-0">Terminais</span>
          {Array.from({ length: 10 }, (_, i) => (
            <Chip key={i} active={filters.has(`term:${i}`)} onClick={() => toggle(`term:${i}`)}>
              T{i}
            </Chip>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[10px] text-neutral-500 w-16 shrink-0">Colunas</span>
          {[1, 2, 3].map((c) => (
            <Chip key={c} active={filters.has(`col:${c}`)} onClick={() => toggle(`col:${c}`)}>
              C{c}
            </Chip>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[10px] text-neutral-500 w-16 shrink-0">Dúzias</span>
          {[1, 2, 3].map((d) => (
            <Chip key={d} active={filters.has(`doz:${d}`)} onClick={() => toggle(`doz:${d}`)}>
              {d === 1 ? "1-12" : d === 2 ? "13-24" : "25-36"}
            </Chip>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[10px] text-neutral-500 w-16 shrink-0">Cor</span>
          <Chip tone="red" active={filters.has("cor:red")} onClick={() => toggle("cor:red")}>
            Vermelho
          </Chip>
          <Chip tone="neutral" active={filters.has("cor:black")} onClick={() => toggle("cor:black")}>
            Preto
          </Chip>
          <Chip tone="emerald" active={filters.has("cor:green")} onClick={() => toggle("cor:green")}>
            Verde
          </Chip>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[10px] text-neutral-500 w-16 shrink-0">Paridade</span>
          <Chip active={filters.has("par:par")} onClick={() => toggle("par:par")}>Par</Chip>
          <Chip active={filters.has("par:impar")} onClick={() => toggle("par:impar")}>Ímpar</Chip>
          <span className="text-[10px] text-neutral-500 w-16 shrink-0 ml-3">Alto/Baixo</span>
          <Chip active={filters.has("hl:baixo")} onClick={() => toggle("hl:baixo")}>1-18</Chip>
          <Chip active={filters.has("hl:alto")} onClick={() => toggle("hl:alto")}>19-36</Chip>
        </div>

        {anyActive && (
          <div className="text-[11px] text-amber-200 pt-1 border-t border-neutral-800">
            <span className="font-mono">{matchCount}</span> ocorrência(s) destacada(s)
            {hover !== null && (
              <span className="ml-2 text-neutral-400">
                · hover: <strong className="font-mono text-amber-300">{hover}</strong>
              </span>
            )}
          </div>
        )}
      </div>

      <div
        className="grid gap-1 p-1 bg-neutral-950 border border-neutral-800 rounded-md"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        role="grid"
        aria-label="Histórico de giros"
        onMouseLeave={() => setHover(null)}
      >
        {items.map((s, i) => {
          const isMatch = isHighlighted(s.n);
          const dim = anyActive && !isMatch;
          return (
            <button
              key={`${s.t}-${i}`}
              onMouseEnter={() => setHover(s.n)}
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
