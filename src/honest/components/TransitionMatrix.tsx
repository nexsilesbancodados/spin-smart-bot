import { memo, useMemo, useState } from "react";
import { useHonestStore } from "../lib/store";
import { colorOf, sectorOf, SLOTS } from "../lib/wheel";
import { Card, SectionHeader } from "./ui";

type Lens = "color" | "sector" | "parity";

const lensKey = (n: number, lens: Lens): string => {
  if (lens === "color") return colorOf(n);
  if (lens === "sector") return sectorOf(n);
  return n === 0 ? "zero" : n % 2 === 0 ? "par" : "ímpar";
};

const LENS_KEYS: Record<Lens, string[]> = {
  color: ["red", "black", "green"],
  sector: ["Voisins", "Tiers", "Orphelins"],
  parity: ["par", "ímpar", "zero"],
};

const LENS_LABELS: Record<Lens, Record<string, string>> = {
  color: { red: "🔴 Vermelho", black: "⚫ Preto", green: "🟢 Zero" },
  sector: { Voisins: "Voisins", Tiers: "Tiers", Orphelins: "Orphelins" },
  parity: { par: "Par", "ímpar": "Ímpar", zero: "Zero" },
};

const LENS_BASELINES: Record<Lens, Record<string, number>> = {
  color: { red: 18 / 37, black: 18 / 37, green: 1 / 37 },
  sector: { Voisins: 17 / 37, Tiers: 12 / 37, Orphelins: 8 / 37 },
  parity: { par: 18 / 37, "ímpar": 18 / 37, zero: 1 / 37 },
};

const TransitionMatrix = memo(() => {
  const spins = useHonestStore((s) => s.spins);
  const [lens, setLens] = useState<Lens>("color");

  const matrix = useMemo(() => {
    const keys = LENS_KEYS[lens];
    const counts: Record<string, Record<string, number>> = {};
    const rowTotals: Record<string, number> = {};
    keys.forEach((k) => {
      counts[k] = {};
      rowTotals[k] = 0;
      keys.forEach((k2) => (counts[k][k2] = 0));
    });
    const numbers = spins.map((s) => s.n);
    for (let i = 0; i < numbers.length - 1; i++) {
      const curr = lensKey(numbers[i + 1], lens);
      const next = lensKey(numbers[i], lens);
      counts[curr][next]++;
      rowTotals[curr]++;
    }
    return { counts, rowTotals, keys, total: numbers.length - 1 };
  }, [spins, lens]);

  const lenses: Array<{ id: Lens; label: string }> = [
    { id: "color", label: "Cor" },
    { id: "sector", label: "Setor" },
    { id: "parity", label: "Paridade" },
  ];

  if (spins.length < 20) {
    return (
      <Card padding="sm">
        <SectionHeader title="Matriz de transição" eyebrow="Análise" />
        <div className="text-[11px] text-neutral-500 italic py-2 text-center">
          Aguardando ≥20 giros (atual: {spins.length})
        </div>
      </Card>
    );
  }

  const cellColor = (observed: number, expected: number) => {
    if (expected < 0.001) return "bg-neutral-900";
    const lift = observed / expected;
    if (lift > 1.3) return "bg-amber-600 text-black";
    if (lift > 1.1) return "bg-amber-800/70 text-amber-100";
    if (lift < 0.7) return "bg-sky-800/70 text-sky-100";
    return "bg-neutral-800 text-neutral-200";
  };

  return (
    <Card padding="sm">
      <SectionHeader
        title="Matriz de transição"
        eyebrow="Análise"
        subtitle={
          <span className="text-[10px] text-neutral-500">
            P(próximo | atual) sobre {matrix.total} transições
          </span>
        }
        actions={
          <div className="flex gap-1">
            {lenses.map((l) => (
              <button
                key={l.id}
                onClick={() => setLens(l.id)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  l.id === lens ? "bg-amber-500 text-black" : "bg-neutral-800 text-neutral-300"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="overflow-x-auto">
        <table className="w-full text-[10px] border-collapse">
          <thead>
            <tr>
              <th className="text-left text-neutral-500 uppercase tracking-wider font-bold p-1">
                atual ↓ / próx →
              </th>
              {matrix.keys.map((k) => (
                <th key={k} className="text-neutral-300 font-bold p-1 text-center">
                  {LENS_LABELS[lens][k]}
                </th>
              ))}
              <th className="text-neutral-500 uppercase tracking-wider font-bold p-1 text-right">n</th>
            </tr>
          </thead>
          <tbody>
            {matrix.keys.map((curr) => {
              const total = matrix.rowTotals[curr];
              return (
                <tr key={curr}>
                  <td className="text-neutral-300 font-bold p-1">{LENS_LABELS[lens][curr]}</td>
                  {matrix.keys.map((next) => {
                    const obs = matrix.counts[curr][next];
                    const pObs = total > 0 ? obs / total : 0;
                    const pExp = LENS_BASELINES[lens][next];
                    return (
                      <td key={next} className="p-0.5">
                        <div
                          className={`rounded p-1 text-center transition ${cellColor(pObs, pExp)}`}
                          title={`${(pObs * 100).toFixed(1)}% (esperado ${(pExp * 100).toFixed(1)}%, ${obs}/${total})`}
                        >
                          <div className="font-bold font-mono text-[11px]">
                            {(pObs * 100).toFixed(0)}%
                          </div>
                          <div className="text-[8px] opacity-70 font-mono">
                            {obs}/{total}
                          </div>
                        </div>
                      </td>
                    );
                  })}
                  <td className="text-neutral-500 font-mono p-1 text-right">{total}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="text-[9px] text-neutral-600 italic mt-2 text-center">
        Âmbar = transição mais frequente que o esperado · azul = menos frequente
      </div>
    </Card>
  );
});
TransitionMatrix.displayName = "TransitionMatrix";

export default TransitionMatrix;
