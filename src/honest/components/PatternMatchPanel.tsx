import { memo, useMemo } from "react";
import { useHonestStore } from "../lib/store";
import { findCurrentPattern, fingerprintLabel, type FingerprintType, type PatternMatch } from "../lib/patternMatcher";
import { colorOf, sectorOf } from "../lib/wheel";
import { Card, SectionHeader, Pill } from "./ui";

const ballBg = (n: number) => {
  const c = colorOf(n);
  if (c === "green") return "bg-emerald-600";
  if (c === "red") return "bg-red-600";
  return "bg-neutral-800";
};

const configs: Array<{ type: FingerprintType; length: number; label: string }> = [
  { type: "color", length: 5, label: "Cor (5)" },
  { type: "sector", length: 5, label: "Setor (5)" },
  { type: "dozen", length: 4, label: "Dúzia (4)" },
  { type: "parity", length: 4, label: "Par/Ímpar (4)" },
  { type: "exact", length: 3, label: "Sequência exata (3)" },
];

const PatternMatchPanel = memo(() => {
  const spins = useHonestStore((s) => s.spins);
  const allSpins = useMemo(() => spins.map((s) => s.n), [spins]);

  const matches = useMemo(() => {
    return configs
      .map((c) => ({ config: c, match: findCurrentPattern(allSpins, c.length, c.type) }))
      .filter((x): x is { config: typeof configs[0]; match: PatternMatch } => x.match !== null && x.match.totalMatches >= 2);
  }, [allSpins]);

  if (spins.length < 20) {
    return null;
  }

  return (
    <Card>
      <SectionHeader
        title="🔍 Padrões reconhecidos agora"
        subtitle="Procura padrões iguais aos últimos giros no histórico. Mostra o que veio depois nas vezes anteriores."
      />
      {matches.length === 0 ? (
        <p className="text-xs text-neutral-500">
          Nenhum padrão dos últimos giros se repetiu o suficiente no histórico para gerar leitura confiável. Aguarde
          mais dados.
        </p>
      ) : (
        <div className="space-y-3">
          {matches.map((m) => (
            <MatchCard key={`${m.config.type}-${m.config.length}`} config={m.config} match={m.match} />
          ))}
          <p className="text-[10px] text-neutral-500 leading-relaxed">
            <strong>Leitura honesta:</strong> repetição num histórico curto é variância — não garantia. Quanto mais
            matches (≥10) e maior concentração no top, mais peso a leitura ganha no ensemble. O agente JÁ usa essas
            distribuições como um dos modelos.
          </p>
        </div>
      )}
    </Card>
  );
});
PatternMatchPanel.displayName = "PatternMatchPanel";

const MatchCard = memo(({ config, match }: { config: typeof configs[0]; match: PatternMatch }) => {
  const baseline = 1 / 37;
  const topProb = match.topNextNumbers[0]?.prob ?? 0;
  const lift = topProb / baseline;

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-3">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-400 font-semibold">{fingerprintLabel[config.type]}</span>
          <code className="text-[11px] font-mono bg-neutral-900 px-2 py-0.5 rounded border border-neutral-700">
            {match.pattern}
          </code>
        </div>
        <Pill accent={match.totalMatches >= 10 ? "good" : match.totalMatches >= 5 ? "warn" : "info"}>
          {match.totalMatches} match(es) no histórico
        </Pill>
      </div>

      {match.topNextLabel && (
        <div className="mb-2 text-[11px]">
          <span className="text-neutral-500">Categoria dominante a seguir: </span>
          <span className="font-bold text-amber-300">{match.topNextLabel.label}</span>
          <span className="text-neutral-400">
            {" "}({match.topNextLabel.count}/{match.totalMatches} = {(match.topNextLabel.prob * 100).toFixed(0)}%)
          </span>
        </div>
      )}

      <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Top 5 que vieram a seguir</div>
      <div className="space-y-1">
        {match.topNextNumbers.map((it) => {
          const itLift = it.prob / baseline;
          return (
            <div key={it.n} className="flex items-center gap-2 text-xs">
              <div className={`${ballBg(it.n)} text-white text-[10px] font-bold w-6 h-6 rounded-md flex items-center justify-center`}>
                {it.n}
              </div>
              <span className="text-neutral-500 text-[10px] w-12">{sectorOf(it.n)}</span>
              <div className="flex-1 h-2 bg-neutral-800 rounded-full overflow-hidden">
                <div className={itLift > 1.3 ? "h-2 bg-amber-500" : "h-2 bg-neutral-600"} style={{ width: `${Math.min(100, it.prob * 100 * 3)}%` }} />
              </div>
              <span className="font-mono text-neutral-300 w-20 text-right">{it.count}× · {(it.prob * 100).toFixed(1)}%</span>
              <span className="font-mono text-[10px] text-neutral-500 w-12 text-right">{itLift.toFixed(1)}×</span>
            </div>
          );
        })}
      </div>

      <div className="mt-2 text-[10px] text-neutral-500">
        Top pick {(topProb * 100).toFixed(1)}% vs baseline {(baseline * 100).toFixed(1)}% · lift {lift.toFixed(2)}×
      </div>
    </div>
  );
});
MatchCard.displayName = "MatchCard";

export default PatternMatchPanel;
