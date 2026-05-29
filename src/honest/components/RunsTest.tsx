import { memo, useMemo, useState } from "react";
import { useHonestStore } from "../lib/store";
import { colorOf } from "../lib/wheel";
import { Card, SectionHeader, Pill } from "./ui";

type Mode = "color" | "parity" | "highlow";

const dichotomize = (n: number, mode: Mode): 1 | 0 | null => {
  if (n === 0) return null;
  if (mode === "color") return colorOf(n) === "red" ? 1 : 0;
  if (mode === "parity") return n % 2 === 0 ? 1 : 0;
  return n > 18 ? 1 : 0;
};

const erfc = (x: number): number => {
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x);
  return 1 - y;
};
const normalP2sided = (z: number): number => Math.min(1, erfc(Math.abs(z) / Math.SQRT2));

const runsTest = (seq: (0 | 1)[]) => {
  const n = seq.length;
  const n1 = seq.filter((x) => x === 1).length;
  const n0 = n - n1;
  if (n1 === 0 || n0 === 0 || n < 10) return null;
  let runs = 1;
  for (let i = 1; i < n; i++) if (seq[i] !== seq[i - 1]) runs++;
  const mu = (2 * n0 * n1) / n + 1;
  const variance = (2 * n0 * n1 * (2 * n0 * n1 - n)) / (n * n * (n - 1));
  const sigma = Math.sqrt(Math.max(1e-9, variance));
  const z = (runs - mu) / sigma;
  const p = normalP2sided(z);
  return { n, n0, n1, runs, expected: mu, sigma, z, p };
};

const longestRun = (seq: (0 | 1)[]): { length: number; value: 0 | 1 | null } => {
  let best = 0;
  let bestVal: 0 | 1 | null = null;
  let cur = 0;
  let curVal: 0 | 1 | null = null;
  for (const v of seq) {
    if (v === curVal) cur++;
    else {
      cur = 1;
      curVal = v;
    }
    if (cur > best) {
      best = cur;
      bestVal = curVal;
    }
  }
  return { length: best, value: bestVal };
};

const RunsTest = memo(() => {
  const spins = useHonestStore((s) => s.spins);
  const [mode, setMode] = useState<Mode>("color");

  const result = useMemo(() => {
    const seq = spins
      .map((s) => dichotomize(s.n, mode))
      .filter((x): x is 0 | 1 => x !== null);
    const r = runsTest(seq);
    if (!r) return null;
    const lr = longestRun(seq);
    return { ...r, longest: lr };
  }, [spins, mode]);

  const modes: Array<{ id: Mode; label: string }> = [
    { id: "color", label: "Vermelho/Preto" },
    { id: "parity", label: "Par/Ímpar" },
    { id: "highlow", label: "Alto/Baixo" },
  ];

  if (!result) {
    return (
      <Card padding="sm">
        <SectionHeader title="Teste de Runs" eyebrow="Análise" />
        <div className="text-[11px] text-neutral-500 italic py-2 text-center">
          Aguardando ≥10 giros válidos
        </div>
      </Card>
    );
  }

  const verdict =
    result.p > 0.1
      ? { label: "aleatório", accent: "good" as const }
      : result.p > 0.05
      ? { label: "borderline", accent: "warn" as const }
      : { label: "não-aleatório", accent: "bad" as const };
  const direction =
    result.z < -1.5
      ? "clustering (runs longos)"
      : result.z > 1.5
      ? "alternância exagerada"
      : "padrão dentro do esperado";

  return (
    <Card padding="sm">
      <SectionHeader
        title="Teste de Runs (Wald-Wolfowitz)"
        eyebrow="Análise"
        subtitle={
          <span className="text-[10px] text-neutral-500">
            Detecta clustering ou alternância anormal na sequência
          </span>
        }
        actions={
          <div className="flex gap-1">
            {modes.map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  m.id === mode ? "bg-amber-500 text-black" : "bg-neutral-800 text-neutral-300"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <Pill accent={verdict.accent}>{verdict.label}</Pill>
        <Pill accent="neutral">z = {result.z >= 0 ? "+" : ""}{result.z.toFixed(2)}</Pill>
        <Pill accent={result.p < 0.05 ? "bad" : "good"}>p = {result.p.toFixed(3)}</Pill>
      </div>

      <div className="grid grid-cols-2 gap-1 text-[10px] mb-2">
        <div className="bg-neutral-900/50 rounded p-1.5">
          <div className="text-neutral-500 uppercase tracking-wider font-bold text-[9px]">Runs observados</div>
          <div className="font-mono font-bold text-neutral-200 text-sm">
            {result.runs} <span className="text-neutral-500 text-[10px]">(esp. {result.expected.toFixed(1)})</span>
          </div>
        </div>
        <div className="bg-neutral-900/50 rounded p-1.5">
          <div className="text-neutral-500 uppercase tracking-wider font-bold text-[9px]">Maior sequência</div>
          <div className="font-mono font-bold text-amber-300 text-sm">
            {result.longest.length}× seguidos
          </div>
        </div>
        <div className="bg-neutral-900/50 rounded p-1.5">
          <div className="text-neutral-500 uppercase tracking-wider font-bold text-[9px]">Amostra válida</div>
          <div className="font-mono font-bold text-neutral-300 text-sm">
            {result.n} <span className="text-neutral-500 text-[10px]">({result.n1}/{result.n0})</span>
          </div>
        </div>
        <div className="bg-neutral-900/50 rounded p-1.5">
          <div className="text-neutral-500 uppercase tracking-wider font-bold text-[9px]">Direção</div>
          <div className="font-bold text-neutral-200 text-[11px]">{direction}</div>
        </div>
      </div>

      <div className="text-[9px] text-neutral-600 italic text-center">
        H₀: a sequência é aleatória · p &lt; 0.05 rejeita aleatoriedade
      </div>
    </Card>
  );
});
RunsTest.displayName = "RunsTest";

export default RunsTest;
