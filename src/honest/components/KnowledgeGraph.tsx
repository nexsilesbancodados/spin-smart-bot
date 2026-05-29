import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  buildStaticGraph,
  augmentGraphWithSpins,
  runForceLayout,
  colorForKind,
  colorForEdge,
  type GraphNode,
  type RouletteGraph,
  type GraphEdge,
} from "../lib/graph";

interface Props {
  spins: number[];
  width?: number;
  height?: number;
  showCooccurrence?: boolean;
  showTransitions?: boolean;
}

const KnowledgeGraph = memo(
  ({ spins, width = 720, height = 520, showCooccurrence = true, showTransitions = true }: Props) => {
    const [selected, setSelected] = useState<GraphNode | null>(null);
    const [hover, setHover] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const dragging = useRef<{ start: { x: number; y: number }; pan: { x: number; y: number } } | null>(null);

    const graph: RouletteGraph = useMemo(() => {
      const base = buildStaticGraph();
      const augmented = augmentGraphWithSpins(base, { spins });
      const filtered: RouletteGraph = {
        nodes: augmented.nodes,
        edges: augmented.edges.filter((e) => {
          if (e.kind === "co-occurrence" && !showCooccurrence) return false;
          if (e.kind === "transition" && !showTransitions) return false;
          return true;
        }),
      };
      return runForceLayout(filtered, { width, height });
    }, [spins, width, height, showCooccurrence, showTransitions]);

    const adjIds = useMemo(() => {
      if (!selected) return new Set<string>();
      const set = new Set<string>([selected.id]);
      for (const e of graph.edges) {
        if (e.source === selected.id) set.add(e.target);
        if (e.target === selected.id) set.add(e.source);
      }
      return set;
    }, [selected, graph.edges]);

    const isVisible = (id: string) => !selected || adjIds.has(id);
    const isEdgeVisible = (e: GraphEdge) =>
      !selected || (adjIds.has(e.source) && adjIds.has(e.target));

    const onWheel = (e: React.WheelEvent<SVGSVGElement>) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom((z) => Math.max(0.4, Math.min(3, z * factor)));
    };

    const onMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
      dragging.current = { start: { x: e.clientX, y: e.clientY }, pan };
    };
    const onMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
      if (!dragging.current) return;
      const dx = e.clientX - dragging.current.start.x;
      const dy = e.clientY - dragging.current.start.y;
      setPan({ x: dragging.current.pan.x + dx, y: dragging.current.pan.y + dy });
    };
    const onMouseUp = () => {
      dragging.current = null;
    };

    useEffect(() => {
      const up = () => (dragging.current = null);
      window.addEventListener("mouseup", up);
      return () => window.removeEventListener("mouseup", up);
    }, []);

    return (
      <div className="relative w-full">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto bg-neutral-950 rounded-xl border border-neutral-800 cursor-grab active:cursor-grabbing select-none"
          onWheel={onWheel}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
        >
          <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
            {graph.edges.map((e, i) => {
              const a = graph.nodes.find((n) => n.id === e.source);
              const b = graph.nodes.find((n) => n.id === e.target);
              if (!a || !b) return null;
              const visible = isEdgeVisible(e);
              return (
                <line
                  key={i}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={colorForEdge[e.kind]}
                  strokeWidth={Math.max(0.4, e.weight * (visible ? 1.4 : 0.4))}
                  opacity={visible ? 0.85 : 0.05}
                />
              );
            })}
            {graph.nodes.map((n) => {
              const visible = isVisible(n.id);
              const isHover = hover === n.id;
              const isSelected = selected?.id === n.id;
              const fill =
                n.kind === "number"
                  ? n.meta?.color === "red"
                    ? "#dc2626"
                    : n.meta?.color === "black"
                      ? "#27272a"
                      : "#16a34a"
                  : colorForKind[n.kind];
              return (
                <g
                  key={n.id}
                  transform={`translate(${n.x},${n.y})`}
                  opacity={visible ? 1 : 0.18}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() => setHover(n.id)}
                  onMouseLeave={() => setHover(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelected((cur) => (cur?.id === n.id ? null : n));
                  }}
                >
                  {(isSelected || isHover) && (
                    <circle
                      r={n.size + 6}
                      fill="none"
                      stroke={isSelected ? "#fbbf24" : "#a3a3a3"}
                      strokeWidth={isSelected ? 2.5 : 1.5}
                      opacity={0.7}
                    />
                  )}
                  <circle r={n.size} fill={fill} stroke="#0a0a0a" strokeWidth={1} />
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="white"
                    fontSize={Math.max(8, Math.min(11, n.size - 2))}
                    fontWeight="700"
                    fontFamily="ui-monospace, monospace"
                    style={{ pointerEvents: "none" }}
                  >
                    {n.label}
                  </text>
                </g>
              );
            })}
          </g>
          {selected && (
            <g
              transform={`translate(10,10)`}
              style={{ cursor: "default" }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <rect width={210} height={70} rx={8} fill="#0a0a0acc" stroke="#404040" />
              <text x={10} y={20} fill="#fbbf24" fontSize="11" fontWeight="700">
                {selected.label} · {selected.kind}
              </text>
              <text x={10} y={36} fill="#d4d4d4" fontSize="10">
                Conexões: {Math.max(0, adjIds.size - 1)}
              </text>
              <text x={10} y={52} fill="#a3a3a3" fontSize="9">
                Clique no nó novamente para limpar
              </text>
            </g>
          )}
          <g transform={`translate(${width - 100},${height - 30})`}>
            <text fill="#525252" fontSize="9" textAnchor="end">
              roda: scroll = zoom · arrastar = pan
            </text>
          </g>
        </svg>
        <div className="flex items-center justify-center gap-3 mt-2 flex-wrap text-[10px] text-neutral-400">
          <Legend color={colorForKind.number} label="Número (cor real)" />
          <Legend color={colorForKind.sector} label="Setor físico" />
          <Legend color={colorForKind.terminal} label="Terminal" />
          <Legend color={colorForKind.dozen} label="Dúzia" />
          <Legend color={colorForKind.column} label="Coluna" />
          <Legend color={colorForKind.color} label="Cor" />
          <Legend edge color="#fbbf24" label="Co-ocorrência observada" />
          <Legend edge color="#22d3ee" label="Transição A→B observada" />
        </div>
      </div>
    );
  }
);
KnowledgeGraph.displayName = "KnowledgeGraph";

const Legend = memo(
  ({ color, label, edge = false }: { color: string; label: string; edge?: boolean }) => (
    <span className="inline-flex items-center gap-1.5">
      {edge ? (
        <span className="w-5 h-0.5 rounded-full" style={{ background: color }} />
      ) : (
        <span className="w-3 h-3 rounded-full" style={{ background: color }} />
      )}
      <span>{label}</span>
    </span>
  )
);
Legend.displayName = "GraphLegend";

export default KnowledgeGraph;
