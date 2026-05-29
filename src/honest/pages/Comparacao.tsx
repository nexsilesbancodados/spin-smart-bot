import { memo, useMemo, useState } from "react";
import { useHonestStore } from "../lib/store";
import { VOISINS, TIERS, ORPHELINS, RED, BLACK, DOZEN_1, DOZEN_2, DOZEN_3 } from "../lib/wheel";
import { computeAutocorrelation, type FeatureSelector } from "../lib/autocorrelation";
import { findCycles } from "../lib/cycles";
import { chiSquareUniform } from "../lib/stats";
import { Card, PageContainer, PageHeader, SectionHeader, Stat, StatGrid, EmptyState, Pill } from "../components/ui";

const computeDist = (window: number[]) => {
  const total = window.length || 1;
  return {
    voisins: window.filter((n) => VOISINS.has(n)).length / total,
    tiers: window.filter((n) => TIERS.has(n)).length / total,
    orphelins: window.filter((n) => ORPHELINS.has(n)).length / total,
    red: window.filter((n) => RED.has(n)).length / total,
    black: window.filter((n) => BLACK.has(n)).length / total,
    zero: window.filter((n) => n === 0).length / total,
    d1: window.filter((n) => DOZEN_1.has(n)).length / total,
    d2: window.filter((n) => DOZEN_2.has(n)).length / total,
    d3: window.filter((n) => DOZEN_3.has(n)).length / total,
  };
};

const fmt = (v: number) => `${(v * 100).toFixed(1)}%`;

const Comparacao = memo(() => {
  const spins = useHonestStore((s) => s.spins.map((x) => x.n));
  const [size, setSize] = useState(100);
  const [feature, setFeature] = useState<FeatureSelector>("color-red");

  const a = useMemo(() => spins.slice(0, size), [spins, size]);
  const b = useMemo(() => spins.slice(size, size * 2), [spins, size]);

  const distA = useMemo(() => computeDist(a), [a]);
  const distB = useMemo(() => computeDist(b), [b]);
  const chiA = useMemo(() => chiSquareUniform(a), [a]);
  const chiB = useMemo(() => chiSquareUniform(b), [b]);

  const autocorr = useMemo(() => {
    if (spins.length < 30) return [];
    return computeAutocorrelation(spins.slice().reverse(), feature, 25);
  }, [spins, feature]);

  const cycles = useMemo(() => findCycles(spins.slice().reverse(), "color"), [spins]);

  if (spins.length < size * 2) {
    return (
      <PageContainer>
        <PageHeader title="Comparação A vs B" subtitle="Compara duas janelas consecutivas do histórico" />
        <EmptyState
          icon="📊"
          title={`Histórico insuficiente (${spins.length}/${size * 2})`}
          description="Para comparar duas janelas, precisa ter pelo menos o dobro do tamanho da janela."
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Comparação A vs B"
        subtitle="Compara janela mais recente (A) vs anterior (B) lado a lado. Mostra autocorrelação e detecção de ciclos."
        actions={
          <select
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            className="bg-neutral-950 border border-neutral-700 rounded-md px-3 py-1.5 text-sm"
          >
            <option value={50}>50 vs 50</option>
            <option value={100}>100 vs 100</option>
            <option value={200}>200 vs 200</option>
            <option value={500}>500 vs 500</option>
          </select>
        }
      />

      <Card>
        <SectionHeader title="Distribuição em cada janela" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-neutral-500 text-xs">
                <th className="p-2">Categoria</th>
                <th className="p-2">A (recente)</th>
                <th className="p-2">B (anterior)</th>
                <th className="p-2">Δ</th>
                <th className="p-2">Esperado</th>
              </tr>
            </thead>
            <tbody>
              <Row label="Voisins" a={distA.voisins} b={distB.voisins} exp={17 / 37} />
              <Row label="Tiers" a={distA.tiers} b={distB.tiers} exp={12 / 37} />
              <Row label="Orphelins" a={distA.orphelins} b={distB.orphelins} exp={8 / 37} />
              <Row label="Vermelho" a={distA.red} b={distB.red} exp={18 / 37} />
              <Row label="Preto" a={distA.black} b={distB.black} exp={18 / 37} />
              <Row label="Zero" a={distA.zero} b={distB.zero} exp={1 / 37} />
              <Row label="1ª Dúzia" a={distA.d1} b={distB.d1} exp={12 / 37} />
              <Row label="2ª Dúzia" a={distA.d2} b={distB.d2} exp={12 / 37} />
              <Row label="3ª Dúzia" a={distA.d3} b={distB.d3} exp={12 / 37} />
            </tbody>
          </table>
        </div>
      </Card>

      <StatGrid cols={4}>
        <Stat label="χ² janela A" value={chiA.chi2.toFixed(1)} sub={`p ≈ ${chiA.pApprox.toFixed(2)}`} />
        <Stat label="χ² janela B" value={chiB.chi2.toFixed(1)} sub={`p ≈ ${chiB.pApprox.toFixed(2)}`} />
        <Stat label="Tamanho janela A" value={String(a.length)} />
        <Stat label="Tamanho janela B" value={String(b.length)} />
      </StatGrid>

      <Card>
        <SectionHeader
          title="Autocorrelação"
          subtitle="Mede se há dependência entre giros separados por lag-k. Em roleta justa, todos os lags > 0 devem ficar próximos de zero."
          actions={
            <select
              value={feature}
              onChange={(e) => setFeature(e.target.value as FeatureSelector)}
              className="bg-neutral-950 border border-neutral-700 rounded-md px-2 py-1 text-xs"
            >
              <option value="color-red">Vermelho</option>
              <option value="color-black">Preto</option>
              <option value="sector-voisins">Voisins</option>
              <option value="sector-tiers">Tiers</option>
              <option value="sector-orphelins">Orphelins</option>
              <option value="parity-odd">Ímpar</option>
              <option value="number">Número exato</option>
            </select>
          }
        />
        <AutocorrChart data={autocorr} />
      </Card>

      <Card>
        <SectionHeader title="Detecção de ciclos" subtitle="Períodos com autocorrelação acima de 0.1 — em roleta justa, nenhum período deveria se destacar." />
        {cycles.length === 0 ? (
          <p className="text-xs text-neutral-500">Nenhum período significativo detectado. Compatível com aleatoriedade.</p>
        ) : (
          <div className="space-y-1.5">
            {cycles.map((c) => (
              <div key={c.period} className="flex items-center gap-3 text-xs">
                <span className="font-mono font-bold w-16">P = {c.period}</span>
                <div className="flex-1 h-2 bg-neutral-800 rounded-full overflow-hidden">
                  <div className="h-2 bg-amber-500" style={{ width: `${c.strength * 200}%` }} />
                </div>
                <span className="font-mono text-neutral-400 w-16 text-right">r = {c.strength.toFixed(3)}</span>
                <Pill accent={c.strength > 0.2 ? "warn" : "neutral"}>
                  {c.strength > 0.2 ? "notável" : "fraco"}
                </Pill>
              </div>
            ))}
          </div>
        )}
      </Card>
    </PageContainer>
  );
});
Comparacao.displayName = "Comparacao";

const Row = memo(({ label, a, b, exp }: { label: string; a: number; b: number; exp: number }) => {
  const delta = a - b;
  return (
    <tr className="border-t border-neutral-800">
      <td className="p-2 text-neutral-200 font-medium">{label}</td>
      <td className="p-2 font-mono">{fmt(a)}</td>
      <td className="p-2 font-mono">{fmt(b)}</td>
      <td className={`p-2 font-mono ${Math.abs(delta) > 0.1 ? "text-amber-300" : "text-neutral-400"}`}>
        {delta >= 0 ? "+" : ""}
        {fmt(delta)}
      </td>
      <td className="p-2 font-mono text-neutral-500">{fmt(exp)}</td>
    </tr>
  );
});
Row.displayName = "CompRow";

const AutocorrChart = memo(({ data }: { data: Array<{ lag: number; r: number }> }) => {
  if (data.length === 0) return <p className="text-xs text-neutral-500">Dados insuficientes.</p>;
  const W = 700;
  const H = 200;
  const margin = 30;
  const maxAbs = Math.max(0.3, ...data.map((d) => Math.abs(d.r)));
  const x = (i: number) => margin + (i / (data.length - 1)) * (W - margin * 2);
  const y = (v: number) => H / 2 - (v / maxAbs) * (H / 2 - margin);
  const sd = 1.96 / Math.sqrt(data.length);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-neutral-950 rounded-lg border border-neutral-800">
        <line x1={margin} x2={W - margin} y1={H / 2} y2={H / 2} stroke="#525252" />
        <line x1={margin} x2={W - margin} y1={y(sd)} y2={y(sd)} stroke="#f59e0b" strokeDasharray="3 3" strokeWidth={0.5} opacity={0.6} />
        <line x1={margin} x2={W - margin} y1={y(-sd)} y2={y(-sd)} stroke="#f59e0b" strokeDasharray="3 3" strokeWidth={0.5} opacity={0.6} />
        {data.slice(1).map((d, i) => (
          <line
            key={d.lag}
            x1={x(i + 1)}
            x2={x(i + 1)}
            y1={H / 2}
            y2={y(d.r)}
            stroke={Math.abs(d.r) > sd ? "#fbbf24" : "#737373"}
            strokeWidth={3}
          />
        ))}
        <text x={4} y={H / 2 + 4} fontSize="9" fill="#737373">0</text>
        <text x={W - 20} y={H - 4} fontSize="9" fill="#737373">lag</text>
      </svg>
      <p className="text-[10px] text-neutral-500 mt-2">
        Linhas tracejadas amarelas = ±1.96/√N (intervalo de confiança 95% para a hipótese nula de independência).
        Barras dentro desse intervalo confirmam aleatoriedade.
      </p>
    </div>
  );
});
AutocorrChart.displayName = "AutocorrChart";

export default Comparacao;
