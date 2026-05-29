import {
  WHEEL,
  VOISINS,
  TIERS,
  ORPHELINS,
  JEU_ZERO,
  COLUMN_1,
  COLUMN_2,
  COLUMN_3,
  DOZEN_1,
  DOZEN_2,
  DOZEN_3,
  RED,
  BLACK,
  colorOf,
  sectorOf,
  terminalOf,
  TERMINAL_SIZE,
} from "./wheel";

export type NodeKind =
  | "number"
  | "sector"
  | "terminal"
  | "color"
  | "dozen"
  | "column"
  | "neighbor-group";

export interface GraphNode {
  id: string;
  label: string;
  kind: NodeKind;
  size: number;
  meta?: Record<string, unknown>;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  pinned?: boolean;
}

export interface GraphEdge {
  source: string;
  target: string;
  kind:
    | "membership"
    | "physical-neighbor"
    | "same-terminal"
    | "co-occurrence"
    | "transition";
  weight: number;
}

export interface RouletteGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const numberNode = (n: number): GraphNode => ({
  id: `n:${n}`,
  label: String(n),
  kind: "number",
  size: 12,
  meta: { color: colorOf(n), sector: sectorOf(n), terminal: terminalOf(n) },
});

const groupNode = (kind: NodeKind, id: string, label: string, size = 22): GraphNode => ({
  id: `${kind}:${id}`,
  label,
  kind,
  size,
});

export const buildStaticGraph = (): RouletteGraph => {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  for (let n = 0; n <= 36; n++) nodes.push(numberNode(n));

  nodes.push(groupNode("sector", "voisins", "Voisins"));
  nodes.push(groupNode("sector", "tiers", "Tiers"));
  nodes.push(groupNode("sector", "orphelins", "Orphelins"));
  nodes.push(groupNode("sector", "jeu-zero", "Jeu Zéro", 18));

  nodes.push(groupNode("color", "red", "Vermelho", 20));
  nodes.push(groupNode("color", "black", "Preto", 20));
  nodes.push(groupNode("color", "green", "Verde (0)", 14));

  nodes.push(groupNode("dozen", "d1", "1ª Dúzia"));
  nodes.push(groupNode("dozen", "d2", "2ª Dúzia"));
  nodes.push(groupNode("dozen", "d3", "3ª Dúzia"));

  nodes.push(groupNode("column", "c1", "Coluna 1"));
  nodes.push(groupNode("column", "c2", "Coluna 2"));
  nodes.push(groupNode("column", "c3", "Coluna 3"));

  for (let t = 0; t <= 9; t++) {
    nodes.push(groupNode("terminal", `t${t}`, `T${t}`, 14 + (TERMINAL_SIZE[t] ?? 4)));
  }

  const link = (groupId: string, members: Iterable<number>, kind: GraphEdge["kind"] = "membership", w = 1) => {
    for (const n of members) edges.push({ source: groupId, target: `n:${n}`, kind, weight: w });
  };

  link("sector:voisins", VOISINS);
  link("sector:tiers", TIERS);
  link("sector:orphelins", ORPHELINS);
  link("sector:jeu-zero", JEU_ZERO);
  link("color:red", RED);
  link("color:black", BLACK);
  link("color:green", new Set([0]));
  link("dozen:d1", DOZEN_1);
  link("dozen:d2", DOZEN_2);
  link("dozen:d3", DOZEN_3);
  link("column:c1", COLUMN_1);
  link("column:c2", COLUMN_2);
  link("column:c3", COLUMN_3);

  for (let t = 0; t <= 9; t++) {
    const members: number[] = [];
    for (let n = 0; n <= 36; n++) if (n % 10 === t) members.push(n);
    link(`terminal:t${t}`, members, "same-terminal", 0.6);
  }

  for (let i = 0; i < WHEEL.length; i++) {
    const a = WHEEL[i];
    const b = WHEEL[(i + 1) % WHEEL.length];
    edges.push({ source: `n:${a}`, target: `n:${b}`, kind: "physical-neighbor", weight: 0.4 });
  }

  return { nodes, edges };
};

export interface DynamicGraphOptions {
  spins: number[];
  cooccurrenceWindow?: number;
  minTransitionCount?: number;
  topCooccurrencePairs?: number;
}

export const augmentGraphWithSpins = (
  base: RouletteGraph,
  opts: DynamicGraphOptions
): RouletteGraph => {
  const { spins, cooccurrenceWindow = 5, minTransitionCount = 2, topCooccurrencePairs = 40 } = opts;
  const nodes = base.nodes.slice();
  const edges = base.edges.slice();

  const transitionCounts = new Map<string, number>();
  const seqOld = spins.slice().reverse();
  for (let i = 1; i < seqOld.length; i++) {
    const k = `${seqOld[i - 1]}->${seqOld[i]}`;
    transitionCounts.set(k, (transitionCounts.get(k) ?? 0) + 1);
  }
  for (const [k, c] of transitionCounts) {
    if (c < minTransitionCount) continue;
    const [a, b] = k.split("->").map(Number);
    edges.push({ source: `n:${a}`, target: `n:${b}`, kind: "transition", weight: Math.min(2, c * 0.2) });
  }

  const coCounts = new Map<string, number>();
  for (let i = 0; i < spins.length; i++) {
    for (let j = i + 1; j < Math.min(spins.length, i + cooccurrenceWindow); j++) {
      const a = Math.min(spins[i], spins[j]);
      const b = Math.max(spins[i], spins[j]);
      if (a === b) continue;
      const k = `${a}|${b}`;
      coCounts.set(k, (coCounts.get(k) ?? 0) + 1);
    }
  }
  const topPairs = [...coCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, topCooccurrencePairs);
  for (const [k, c] of topPairs) {
    const [a, b] = k.split("|").map(Number);
    edges.push({ source: `n:${a}`, target: `n:${b}`, kind: "co-occurrence", weight: Math.min(2.5, c * 0.15) });
  }

  const freq = new Array(37).fill(0);
  for (const n of spins) if (n >= 0 && n <= 36) freq[n]++;
  const max = Math.max(1, ...freq);
  return {
    edges,
    nodes: nodes.map((nd) =>
      nd.kind === "number"
        ? { ...nd, size: 10 + (freq[Number(nd.label)] / max) * 14 }
        : nd
    ),
  };
};

export interface SimOptions {
  width: number;
  height: number;
  iterations?: number;
  linkDistance?: number;
  charge?: number;
  centerStrength?: number;
}

const seededRng = (seed: number) => {
  let s = seed | 0;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
};

export const runForceLayout = (graph: RouletteGraph, opts: SimOptions): RouletteGraph => {
  const rng = seededRng(42);
  const { width, height, iterations = 240, linkDistance = 55, charge = -240, centerStrength = 0.04 } = opts;
  const nodes = graph.nodes.map((n) => ({
    ...n,
    x: n.x ?? width / 2 + (rng() - 0.5) * width * 0.8,
    y: n.y ?? height / 2 + (rng() - 0.5) * height * 0.8,
    vx: 0,
    vy: 0,
  }));
  const idIdx = new Map(nodes.map((n, i) => [n.id, i]));
  const adj: Array<[number, number, number]> = [];
  for (const e of graph.edges) {
    const a = idIdx.get(e.source);
    const b = idIdx.get(e.target);
    if (a === undefined || b === undefined) continue;
    adj.push([a, b, e.weight]);
  }

  for (let it = 0; it < iterations; it++) {
    const alpha = 1 - it / iterations;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const ni = nodes[i];
        const nj = nodes[j];
        const dx = nj.x! - ni.x!;
        const dy = nj.y! - ni.y!;
        const dist2 = dx * dx + dy * dy || 0.01;
        const dist = Math.sqrt(dist2);
        const force = (charge / dist2) * alpha;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        ni.vx! -= fx;
        ni.vy! -= fy;
        nj.vx! += fx;
        nj.vy! += fy;
      }
    }
    for (const [a, b, w] of adj) {
      const na = nodes[a];
      const nb = nodes[b];
      const dx = nb.x! - na.x!;
      const dy = nb.y! - na.y!;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const desired = linkDistance / Math.max(0.5, w);
      const diff = ((dist - desired) / dist) * 0.4 * alpha;
      const fx = dx * diff;
      const fy = dy * diff;
      na.vx! += fx;
      na.vy! += fy;
      nb.vx! -= fx;
      nb.vy! -= fy;
    }
    for (const n of nodes) {
      n.vx! += (width / 2 - n.x!) * centerStrength * alpha;
      n.vy! += (height / 2 - n.y!) * centerStrength * alpha;
      const damping = 0.6;
      n.vx! *= damping;
      n.vy! *= damping;
      n.x! += n.vx!;
      n.y! += n.vy!;
      n.x! = Math.max(20, Math.min(width - 20, n.x!));
      n.y! = Math.max(20, Math.min(height - 20, n.y!));
    }
  }
  return { nodes, edges: graph.edges };
};

export const colorForKind: Record<NodeKind, string> = {
  number: "#fbbf24",
  sector: "#22d3ee",
  terminal: "#a855f7",
  color: "#f43f5e",
  dozen: "#10b981",
  column: "#f97316",
  "neighbor-group": "#6366f1",
};

export const colorForEdge: Record<GraphEdge["kind"], string> = {
  membership: "#52525b",
  "physical-neighbor": "#3f3f46",
  "same-terminal": "#7c3aed55",
  "co-occurrence": "#fbbf24aa",
  transition: "#22d3eeaa",
};
