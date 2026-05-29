import { memo, useMemo, useState } from "react";
import { useHonestStore } from "../lib/store";
import { colorOf, sectorOf, DOZEN_1, DOZEN_2, DOZEN_3, SLOTS } from "../lib/wheel";
import { Card, SectionHeader, Pill } from "./ui";

const LENS_BASELINES: Record<string, Record<string, number>> = {
  color: { red: 18 / 37, black: 18 / 37, green: 1 / 37 },
  sector: { Voisins: 17 / 37, Tiers: 12 / 37, Orphelins: 8 / 37 },
  dozen: { "1ª dúzia": 12 / 37, "2ª dúzia": 12 / 37, "3ª dúzia": 12 / 37, zero: 1 / 37 },
};

const binomialP = (k: number, n: number, p: number): number => {
  if (n === 0) return 1;
  const sigma = Math.sqrt(n * p * (1 - p));
  if (sigma < 1e-9) return 1;
  const z = Math.abs((k - n * p) / sigma);
  const erfc = (x: number) => {
    const t = 1 / (1 + 0.3275911 * x);
    const y =
      1 -
      (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
        t *
        Math.exp(-x * x);
    return 1 - y;
  };
  return Math.min(1, erfc(z / Math.SQRT2));
};

type Lens = "exact" | "color" | "sector" | "dozen";

const lensKey = (n: number, lens: Lens): string => {
  if (lens === "exact") return String(n);
  if (lens === "color") return colorOf(n);
  if (lens === "sector") return sectorOf(n);
  if (DOZEN_1.has(n)) return "1ª dúzia";
  if (DOZEN_2.has(n)) return "2ª dúzia";
  if (DOZEN_3.has(n)) return "3ª dúzia";
  return "zero";
};

interface Followup {
  key: string;
  count: number;
  pct: number;
  expected: number;
  pBinomial: number;
}

const RecurrenceFinder = memo(() => {
  const spins = useHonestStore((s) => s.spins);
  const numbers = useMemo(() => spins.map((s) => s.n), [spins]);
  const head = numbers[0];
  const [lens, setLens] = useState<Lens>("color");
  const [windowAfter, setWindowAfter] = useState(3);

  const analysis = useMemo(() => {
    if (head === undefined || numbers.length < 20) return null;
    const targetKey = lensKey(head, lens);
    const occurrences: number[] = [];
    for (let i = 1; i < numbers.length; i++) {
      if (lensKey(numbers[i], lens) === targetKey) occurrences.push(i);
    }

    const followCounts: Record<string, number> = {};
    let total = 0;
    for (const idx of occurrences) {
      for (let k = 1; k <= windowAfter; k++) {
        const j = idx - k;
        if (j < 0) continue;
        const key = lensKey(numbers[j], lens);
        followCounts[key] = (followCounts[key] || 0) + 1;
        total++;
      }
    }

    const baselineMap = LENS_BASELINES[lens] || {};
    const followups: Followup[] = Object.entries(followCounts)
      .map(([key, count]) => {
        const pExp = lens === "exact" ? 1 / SLOTS : baselineMap[key] ?? 1 / SLOTS;
        return {
          key,
          count,
          pct: total > 0 ? count / total : 0,
          expected: pExp * total,
          pBinomial: binomialP(count, total, pExp),
        };
      })
      .sort((a, b) => b.count - a.count);

    return { targetKey, occurrences: occurrences.length, total, followups };
  }, [numbers, head, lens, windowAfter]);

  if (head === undefined || numbers.length < 20) {
    return (
      <Card padding="sm">
        <SectionHeader title="Recorrências do último número" eyebrow="Ferramenta" />
        <div className="text-[11px] text-neutral-500 italic py-2 text-center">
          Aguardando ≥20 giros (atual: {numbers.length})
        </div>
      </Card>
    );
  }

  const lenses: Array<{ id: Lens; label: string }> = [
    { id: "exact", label: "Número exato" },
    { id: "color", label: "Cor" },
    { id: "sector", label: "Setor" },
    { id: "dozen", label: "Dúzia" },
  ];

  return (
    <Card padding="sm">
      <SectionHeader
        title="Recorrências do último número"
        eyebrow="Ferramenta"
        subtitle={
          <span className="text-[10px] text-neutral-500">
            Saiu <b className="text-amber-300">{head}</b> ({analysis?.targetKey}) — o que costuma vir depois?
          </span>
        }
      />

      <div className="flex flex-wrap gap-1 mb-2">
        {lenses.map((l) => (
          <button
            key={l.id}
            onClick={() => setLens(l.id)}
            className={`px-2 py-1 rounded-md text-[10px] font-bold transition ${
              l.id === lens ? "bg-amber-500 text-black" : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-2 text-[10px]">
        <span className="text-neutral-500 uppercase tracking-wider font-bold shrink-0">
          Janela
        </span>
        <input
          type="range"
          min={1}
          max={5}
          value={windowAfter}
          onChange={(e) => setWindowAfter(Number(e.target.value))}
          className="flex-1 accent-amber-500"
        />
        <span className="text-amber-300 font-mono font-bold w-12 text-right">
          próx. {windowAfter}
        </span>
      </div>

      {analysis && analysis.occurrences === 0 ? (
        <div className="text-[11px] text-neutral-500 italic py-2 text-center">
          Sem ocorrências anteriores de <b>{analysis.targetKey}</b> no histórico.
        </div>
      ) : analysis && (
        <>
          <div className="text-[10px] text-neutral-500 mb-1.5">
            {analysis.occurrences} ocorrências passadas · {analysis.total} amostras
            seguintes nos próximos {windowAfter} giros
          </div>
          <div className="space-y-1">
            {analysis.followups.slice(0, 6).map((f, i) => {
              const sig = f.pBinomial < 0.05 && f.count > f.expected;
              return (
                <div key={f.key} className="flex items-center gap-2 text-[11px]">
                  <span className={`w-20 truncate shrink-0 font-bold ${i === 0 ? "text-amber-300" : "text-neutral-300"}`}>
                    {f.key}
                  </span>
                  <div className="flex-1 h-3 bg-neutral-900 rounded overflow-hidden relative">
                    <div
                      className="absolute inset-y-0 left-0 w-px bg-neutral-500"
                      style={{ left: `${Math.min(100, (f.expected / Math.max(1, analysis.total)) * 100)}%` }}
                      title={`esperado ${f.expected.toFixed(1)}×`}
                    />
                    <div
                      className={`h-full ${sig ? "bg-amber-500" : i === 0 ? "bg-amber-700" : "bg-neutral-600"}`}
                      style={{ width: `${f.pct * 100}%` }}
                    />
                  </div>
                  <span className="font-mono shrink-0 text-neutral-400 w-12 text-right">
                    {(f.pct * 100).toFixed(1)}%
                  </span>
                  <span
                    className={`font-mono shrink-0 w-14 text-right ${
                      f.pBinomial < 0.01
                        ? "text-red-300 font-bold"
                        : f.pBinomial < 0.05
                        ? "text-amber-300 font-bold"
                        : "text-neutral-500"
                    }`}
                    title="p-valor binomial vs esperado"
                  >
                    p={f.pBinomial.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
          {analysis.followups.some((f) => f.pBinomial < 0.05 && f.count > f.expected) && (
            <div className="mt-2">
              <Pill accent="warn">⚠ desvio estatisticamente significativo na amostra (p &lt; 0,05)</Pill>
            </div>
          )}
          <div className="text-[9px] text-neutral-600 italic mt-2 text-center">
            Padrão histórico ≠ previsão. Casa retém ~2,7% sob distribuição justa.
          </div>
        </>
      )}
    </Card>
  );
});
RecurrenceFinder.displayName = "RecurrenceFinder";

export default RecurrenceFinder;
