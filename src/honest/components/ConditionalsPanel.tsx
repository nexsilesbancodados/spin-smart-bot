import { memo, useMemo, useState } from "react";
import { useHonestStore } from "../lib/store";
import { computeConditional, type Conditioner } from "../lib/conditionalProbs";
import { Card, SectionHeader } from "./ui";

const categoryLabels: Record<Conditioner, string> = {
  color: "Cor",
  sector: "Setor",
  parity: "Par/Ímpar",
  "high-low": "Alto/Baixo",
};

const ConditionalsPanel = memo(() => {
  const spins = useHonestStore((s) => s.spins);
  const [type, setType] = useState<Conditioner>("color");

  const spinsKey = useMemo(() => spins.slice(0, 500).map((s) => s.n).join(","), [spins]);

  const data = useMemo(() => {
    if (spinsKey.length === 0) return [];
    return computeConditional(spinsKey.split(",").map(Number), type);
  }, [spinsKey, type]);

  if (spins.length < 30) return null;

  return (
    <Card>
      <SectionHeader
        title="🔀 Probabilidades Condicionais"
        subtitle="Distribuição observada do PRÓXIMO giro dado o atual. Em RNG justo, deve ficar perto do baseline."
        actions={
          <div className="flex gap-1 rounded-lg border border-neutral-700 overflow-hidden">
            {(Object.keys(categoryLabels) as Conditioner[]).map((c) => (
              <button
                key={c}
                onClick={() => setType(c)}
                className={`px-3 py-1 text-xs font-semibold ${
                  type === c ? "bg-amber-500 text-black" : "bg-neutral-900 text-neutral-300 hover:bg-neutral-800"
                }`}
              >
                {categoryLabels[c]}
              </button>
            ))}
          </div>
        }
      />

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-neutral-500">
              <th className="p-2 font-medium">Atual</th>
              <th className="p-2 font-medium">N</th>
              {data.length > 0 &&
                Object.keys(data[0].nextDist).map((k) => (
                  <th key={k} className="p-2 font-medium text-center">
                    → {k}
                  </th>
                ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.conditionValue} className="border-t border-neutral-800 hover:bg-neutral-900/40">
                <td className="p-2 font-bold text-neutral-200">{row.conditionValue}</td>
                <td className="p-2 font-mono text-neutral-500">{row.matches}</td>
                {Object.entries(row.nextDist).map(([k, p]) => {
                  const baseline = row.baselineDist[k];
                  const lift = baseline > 0 ? p / baseline : 1;
                  const diff = p - baseline;
                  return (
                    <td key={k} className="p-2 text-center">
                      <div className="flex flex-col items-center">
                        <span
                          className={`font-mono font-bold ${
                            Math.abs(lift - 1) > 0.15 ? (lift > 1 ? "text-emerald-300" : "text-red-300") : "text-neutral-300"
                          }`}
                        >
                          {(p * 100).toFixed(0)}%
                        </span>
                        <span className="text-[9px] text-neutral-500">
                          esp {(baseline * 100).toFixed(0)}% · {diff >= 0 ? "+" : ""}
                          {(diff * 100).toFixed(0)}pp
                        </span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[10px] text-neutral-500 leading-relaxed">
        <strong>Como ler:</strong> "Vermelho → Preto: 50% (esp 49%, +1pp)" significa que após sair Vermelho, o próximo
        foi Preto em 50% das vezes — quase igual ao esperado por acaso. Lifts ±15% destacados em verde/vermelho
        sugerem desvio (variância em janela curta ou possível viés físico).
      </p>
    </Card>
  );
});
ConditionalsPanel.displayName = "ConditionalsPanel";
export default ConditionalsPanel;
