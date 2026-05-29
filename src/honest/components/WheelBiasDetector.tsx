import { memo, useMemo } from "react";
import { useHonestStore } from "../lib/store";
import { colorOf, SLOTS } from "../lib/wheel";
import { chiSquareUniform } from "../lib/stats";
import { Card, SectionHeader, Pill } from "./ui";

const binomialP2sided = (k: number, n: number, p: number): number => {
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

const WheelBiasDetector = memo(() => {
  const spins = useHonestStore((s) => s.spins);
  const numbers = useMemo(() => spins.map((s) => s.n), [spins]);

  const result = useMemo(() => {
    if (numbers.length < 50) return null;
    const window = numbers.slice(0, 300);
    const chi = chiSquareUniform(window);
    const expected = window.length / SLOTS;
    const counts = new Array<number>(SLOTS).fill(0);
    for (const n of window) counts[n]++;
    const p = 1 / SLOTS;

    const flagged: Array<{ n: number; count: number; z: number; pBinomial: number }> = [];
    for (let i = 0; i < SLOTS; i++) {
      const sigma = Math.sqrt(window.length * p * (1 - p));
      const z = sigma > 0 ? (counts[i] - expected) / sigma : 0;
      const pVal = binomialP2sided(counts[i], window.length, p);
      if (Math.abs(z) >= 2.0 || pVal < 0.05) {
        flagged.push({ n: i, count: counts[i], z, pBinomial: pVal });
      }
    }
    flagged.sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
    return { chi, window: window.length, flagged };
  }, [numbers]);

  if (!result) {
    return (
      <Card padding="sm">
        <SectionHeader title="Detector de viés de mesa" eyebrow="Análise" />
        <div className="text-[11px] text-neutral-500 italic py-2 text-center">
          Aguardando ≥50 giros para teste de χ² (atual: {numbers.length})
        </div>
      </Card>
    );
  }

  const { chi, window, flagged } = result;
  const verdict = chi.uniformCompatible ? "good" : chi.pApprox < 0.01 ? "bad" : "warn";

  return (
    <Card padding="sm">
      <SectionHeader
        title="Detector de viés de mesa"
        eyebrow="Análise"
        subtitle={
          <span className="text-[10px] text-neutral-500">
            Teste χ² em {window} giros recentes vs distribuição uniforme
          </span>
        }
      />

      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <Pill accent={verdict === "good" ? "good" : verdict === "bad" ? "bad" : "warn"}>
          χ² = {chi.chi2.toFixed(1)} · gl {chi.df}
        </Pill>
        <Pill accent={chi.pApprox > 0.05 ? "good" : "bad"}>p ≈ {chi.pApprox.toFixed(3)}</Pill>
        <span className="text-[10px] text-neutral-500 italic flex-1 min-w-[120px]">
          {chi.uniformCompatible ? "compatível com acaso" : "desvio relevante"}
        </span>
      </div>

      {flagged.length === 0 ? (
        <div className="text-[11px] text-neutral-500 italic py-2 text-center">
          Nenhum número desvia significativamente do esperado ({(window / SLOTS).toFixed(1)}× cada).
        </div>
      ) : (
        <>
          <div className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold mb-1.5">
            {flagged.length} números com desvio (|z| ≥ 2 ou p &lt; 0.05)
          </div>
          <div className="space-y-1">
            {flagged.slice(0, 8).map((f) => {
              const isHot = f.z > 0;
              const color = colorOf(f.n);
              return (
                <div
                  key={f.n}
                  className="flex items-center gap-2 text-[11px] bg-neutral-900/50 rounded px-1.5 py-1"
                >
                  <span
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-white font-black text-sm ${
                      color === "green"
                        ? "bg-emerald-600"
                        : color === "red"
                        ? "bg-red-600"
                        : "bg-neutral-800"
                    }`}
                  >
                    {f.n}
                  </span>
                  <span className="font-mono text-neutral-300">
                    {f.count}× <span className="text-neutral-500">(esp. {(window / SLOTS).toFixed(1)})</span>
                  </span>
                  <span className="flex-1" />
                  <span className={`font-mono font-bold ${isHot ? "text-amber-300" : "text-sky-300"}`}>
                    z = {f.z >= 0 ? "+" : ""}
                    {f.z.toFixed(2)}
                  </span>
                  <span
                    className={`font-mono font-bold ${
                      f.pBinomial < 0.01 ? "text-red-300" : f.pBinomial < 0.05 ? "text-amber-300" : "text-neutral-500"
                    }`}
                  >
                    p = {f.pBinomial.toFixed(3)}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="text-[9px] text-neutral-600 italic mt-2 text-center">
        Desvio amostral ≠ viés físico. Sugere coletar mais dados da MESMA mesa antes de concluir.
      </div>
    </Card>
  );
});
WheelBiasDetector.displayName = "WheelBiasDetector";

export default WheelBiasDetector;
