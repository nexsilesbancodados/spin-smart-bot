import { memo, useMemo } from "react";
import { useHonestStore } from "../lib/store";
import { WHEEL, wheelIndex } from "../lib/wheel";
import { Card, SectionHeader, Pill } from "./ui";

const distance = (a: number, b: number): number => {
  const i = wheelIndex(a);
  const j = wheelIndex(b);
  if (i < 0 || j < 0) return -1;
  const d = Math.abs(i - j);
  return Math.min(d, WHEEL.length - d);
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

const WheelDistanceAnalyzer = memo(() => {
  const spins = useHonestStore((s) => s.spins);

  const result = useMemo(() => {
    const nums = spins.slice(0, 200).map((s) => s.n);
    if (nums.length < 20) return null;
    const distances: number[] = [];
    for (let i = 0; i < nums.length - 1; i++) {
      const d = distance(nums[i], nums[i + 1]);
      if (d >= 0) distances.push(d);
    }
    if (distances.length === 0) return null;

    const maxDist = Math.floor(WHEEL.length / 2);
    const counts = new Array(maxDist + 1).fill(0);
    distances.forEach((d) => counts[d]++);

    const expected = distances.length / (maxDist + 1);
    const mean = distances.reduce((a, b) => a + b, 0) / distances.length;
    const variance =
      distances.reduce((a, b) => a + (b - mean) ** 2, 0) / distances.length;
    const stddev = Math.sqrt(variance);
    const expectedMean = maxDist / 2;
    const z = stddev > 0 ? ((mean - expectedMean) / (stddev / Math.sqrt(distances.length))) : 0;
    const p = Math.min(1, erfc(Math.abs(z) / Math.SQRT2));

    const shortDistance = distances.filter((d) => d <= 3).length / distances.length;
    const expectedShort = 7 / 37;
    const cluster = shortDistance / expectedShort;

    return {
      distances,
      counts,
      maxDist,
      mean,
      expected,
      expectedMean,
      z,
      p,
      cluster,
      shortDistance,
      expectedShort,
    };
  }, [spins]);

  if (!result) {
    return (
      <Card padding="sm">
        <SectionHeader title="Assinatura de dealer" eyebrow="Análise" />
        <div className="text-[11px] text-neutral-500 italic py-2 text-center">
          Aguardando ≥20 giros (atual: {spins.length})
        </div>
      </Card>
    );
  }

  const maxCount = Math.max(...result.counts);

  return (
    <Card padding="sm">
      <SectionHeader
        title="Assinatura de dealer (distância na roleta)"
        eyebrow="Análise"
        subtitle={
          <span className="text-[10px] text-neutral-500">
            Distância física entre giros consecutivos · {result.distances.length} amostras
          </span>
        }
      />

      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <Pill accent={result.cluster > 1.4 ? "warn" : result.cluster < 0.7 ? "info" : "neutral"}>
          Clustering ≤3: {(result.shortDistance * 100).toFixed(1)}% ({result.cluster.toFixed(2)}×)
        </Pill>
        <Pill accent={result.p < 0.05 ? "bad" : "good"}>
          média {result.mean.toFixed(1)} (esp. {result.expectedMean.toFixed(1)})
        </Pill>
        <Pill accent="neutral">p = {result.p.toFixed(3)}</Pill>
      </div>

      <div className="bg-neutral-950 rounded border border-neutral-800 p-2 mb-2">
        <svg viewBox="0 0 320 80" className="w-full h-20" preserveAspectRatio="none">
          <line
            x1={0}
            y1={80 - (result.expected / maxCount) * 70}
            x2={320}
            y2={80 - (result.expected / maxCount) * 70}
            stroke="#525252"
            strokeDasharray="3 3"
            strokeWidth={0.5}
          />
          {result.counts.map((c, i) => {
            const x = 10 + i * (300 / result.counts.length);
            const w = 300 / result.counts.length - 1;
            const h = (c / maxCount) * 70;
            const lift = c / Math.max(0.01, result.expected);
            const fill = lift > 1.3 ? "#f59e0b" : lift < 0.7 ? "#0ea5e9" : "#737373";
            return (
              <g key={i}>
                <rect x={x} y={80 - h} width={w} height={h} fill={fill} />
                {i % 3 === 0 && (
                  <text x={x + w / 2} y={78} fontSize="8" fill="#a3a3a3" textAnchor="middle">
                    {i}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        <div className="text-[9px] text-neutral-500 text-center mt-1">
          distância (slots) →
        </div>
      </div>

      <div className="text-[10px] text-neutral-400 leading-snug">
        {result.cluster > 1.4 ? (
          <span className="text-amber-300">
            🎯 <b>Clustering forte:</b> giros consecutivos tendem a cair perto na roleta física.
            Pode indicar viés de lançamento do crupiê.
          </span>
        ) : result.cluster < 0.7 ? (
          <span className="text-sky-300">
            🌀 <b>Dispersão alta:</b> giros tendem a cair longe entre si — distribuição muito espalhada.
          </span>
        ) : (
          <span className="text-neutral-500">
            Distribuição de distâncias dentro do esperado pra mesa imparcial.
          </span>
        )}
      </div>

      <div className="text-[9px] text-neutral-600 italic mt-2 text-center">
        Mesa real, mesmo crupiê → padrões mais estáveis. Troca de crupiê reseta a assinatura.
      </div>
    </Card>
  );
});
WheelDistanceAnalyzer.displayName = "WheelDistanceAnalyzer";

export default WheelDistanceAnalyzer;
