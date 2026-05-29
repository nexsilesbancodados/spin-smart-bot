import { memo, useMemo, useState } from "react";
import { useHonestStore, selectWindowSpins } from "../lib/store";
import WindowPicker from "../components/WindowPicker";
import VerdictBadge from "../components/VerdictBadge";
import { colorOf, SLOTS } from "../lib/wheel";
import {
  groupsBasic,
  terminalsBasic,
  terminalsAltoBaixo,
  terminalsCamuflados,
  terminalsWithNeighbors,
  duziasAB,
  neighborsCentered,
  ladoRace,
  lado0a10,
  vizinhos7a27,
  juntoSeparado,
  hotColdNumbers,
  computeStreaks,
  type PatternGroup,
} from "../lib/patterns";
import { Card, PageContainer, PageHeader, SectionHeader, Stat, StatGrid, EmptyState } from "../components/ui";

const ballBg = (n: number) => {
  const c = colorOf(n);
  if (c === "green") return "bg-emerald-600";
  if (c === "red") return "bg-red-600";
  return "bg-neutral-800";
};

const Padroes = memo(() => {
  const spins = useHonestStore(selectWindowSpins);
  const totalSpins = useHonestStore((s) => s.spins.length);
  const [neighborsRadius, setNeighborsRadius] = useState(2);
  const [neighborsCenter, setNeighborsCenter] = useState(7);
  const [termNeighbors, setTermNeighbors] = useState<1 | 2>(1);
  const [highThreshold, setHighThreshold] = useState(5);
  const [arcRadius, setArcRadius] = useState(4);

  const basic = useMemo(() => groupsBasic(spins), [spins]);
  const termsBasic = useMemo(() => terminalsBasic(spins), [spins]);
  const termsHL = useMemo(() => terminalsAltoBaixo(spins, highThreshold), [spins, highThreshold]);
  const termsCamuf = useMemo(() => terminalsCamuflados(spins), [spins]);
  const termsNeigh = useMemo(() => terminalsWithNeighbors(spins, termNeighbors), [spins, termNeighbors]);
  const dAB = useMemo(() => duziasAB(spins), [spins]);
  const neighGroup = useMemo(
    () => neighborsCentered(spins, neighborsCenter, neighborsRadius),
    [spins, neighborsCenter, neighborsRadius]
  );
  const lRace = useMemo(() => ladoRace(spins), [spins]);
  const l0a10 = useMemo(() => lado0a10(spins), [spins]);
  const v7a27 = useMemo(() => vizinhos7a27(spins), [spins]);
  const js = useMemo(() => juntoSeparado(spins, arcRadius), [spins, arcRadius]);
  const hc = useMemo(() => hotColdNumbers(spins), [spins]);
  const streaks = useMemo(() => computeStreaks(spins), [spins]);

  if (totalSpins < 10) {
    return (
      <PageContainer>
        <PageHeader title="Padrões" subtitle="Agrupamentos clássicos com z-score e veredito por categoria." />
        <EmptyState
          icon="📐"
          title={`Aguardando giros (${totalSpins}/10)`}
          description="Os painéis ficam disponíveis assim que o feed acumular giros suficientes."
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Padrões"
        subtitle="Todos os agrupamentos clássicos com observado vs. esperado, z-score e veredito de variância."
        actions={<WindowPicker />}
      />

      <Card>
        <SectionHeader title="Setores físicos" subtitle="Voisins / Tiers / Orphelins (partição completa)" />
        <GroupRows groups={basic.setores} />
      </Card>

      <Card>
        <SectionHeader title="Dúzias" subtitle="3 grupos de 12 + zero" />
        <GroupRows groups={basic.duzias} />
      </Card>

      <Card>
        <SectionHeader title="Dúzias agrupadas (AB)" subtitle="Cada par de dúzias combinadas vs a terceira" />
        <GroupRows groups={dAB} />
      </Card>

      <Card>
        <SectionHeader title="Colunas" subtitle="3 colunas de 12 do tabuleiro" />
        <GroupRows groups={basic.colunas} />
      </Card>

      <Card>
        <SectionHeader title="Cor / Paridade / Alto-Baixo" subtitle="Apostas de dinheiro igualado" />
        <GroupRows groups={[...basic.cores, ...basic.paridade, ...basic.altoBaixo]} />
      </Card>

      <Card>
        <SectionHeader title="Terminais (último dígito)" subtitle="T0–T6 = 4/37, T7–T9 = 3/37" />
        <GroupRows groups={termsBasic} cols={5} />
      </Card>

      <Card>
        <SectionHeader title="Terminais Camuflados (soma 9)" subtitle="T0+T9, T1+T8, T2+T7, T3+T6, T4+T5" />
        <GroupRows groups={termsCamuf} cols={5} />
      </Card>

      <Card>
        <SectionHeader
          title={`Terminais com vizinhos físicos (${termNeighbors}V)`}
          subtitle="Terminal + N vizinhos de cada lado na roda física"
          actions={
            <div className="inline-flex rounded-lg border border-neutral-700 overflow-hidden">
              {[1, 2].map((v) => (
                <button
                  key={v}
                  onClick={() => setTermNeighbors(v as 1 | 2)}
                  className={`px-2.5 py-1 text-xs font-semibold ${
                    termNeighbors === v ? "bg-amber-500 text-black" : "bg-neutral-900 text-neutral-300"
                  }`}
                >
                  {v}V
                </button>
              ))}
            </div>
          }
        />
        <GroupRows groups={termsNeigh} cols={5} />
      </Card>

      <Card>
        <SectionHeader
          title="Terminais Alto vs Baixo"
          subtitle={`Limiar atual = ${highThreshold}`}
          actions={
            <select
              value={highThreshold}
              onChange={(e) => setHighThreshold(Number(e.target.value))}
              className="bg-neutral-950 border border-neutral-700 rounded-md px-2 py-1 text-xs"
            >
              {[3, 4, 5, 6, 7].map((v) => (
                <option key={v} value={v}>
                  Limiar {v}
                </option>
              ))}
            </select>
          }
        />
        <GroupRows groups={termsHL} />
      </Card>

      <Card>
        <SectionHeader
          title="Vizinhos centrados"
          subtitle="Aposta de vizinhos em qualquer número da roda física"
          actions={
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-neutral-400">Centro</label>
              <select
                value={neighborsCenter}
                onChange={(e) => setNeighborsCenter(Number(e.target.value))}
                className="bg-neutral-950 border border-neutral-700 rounded-md px-2 py-1 text-xs"
              >
                {Array.from({ length: SLOTS }, (_, n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <label className="text-[10px] text-neutral-400">±</label>
              <select
                value={neighborsRadius}
                onChange={(e) => setNeighborsRadius(Number(e.target.value))}
                className="bg-neutral-950 border border-neutral-700 rounded-md px-2 py-1 text-xs"
              >
                {[1, 2, 3, 4, 5].map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          }
        />
        <SingleGroupRow group={neighGroup} />
      </Card>

      <Card>
        <SectionHeader title="Lado Race (esquerdo vs direito)" subtitle="Divide o cilindro em duas metades a partir do 0" />
        <GroupRows groups={lRace} />
      </Card>

      <Card>
        <SectionHeader title="Arco 0 → 10 vs oposto" subtitle="Metade curta da roda contendo o caminho do 0 ao 10" />
        <GroupRows groups={l0a10} />
      </Card>

      <Card>
        <SectionHeader title="Vizinhos 7 ↔ 27 vs resto" subtitle="Arco curto entre 7 e 27 na roda física" />
        <GroupRows groups={v7a27} />
      </Card>

      <Card>
        <SectionHeader
          title="Junto vs Separado"
          subtitle="Mede agrupamento temporal: rodadas consecutivas em arcos próximos ou opostos?"
          actions={
            <select
              value={arcRadius}
              onChange={(e) => setArcRadius(Number(e.target.value))}
              className="bg-neutral-950 border border-neutral-700 rounded-md px-2 py-1 text-xs"
            >
              {[2, 3, 4, 5, 6].map((v) => (
                <option key={v} value={v}>
                  Raio ±{v}
                </option>
              ))}
            </select>
          }
        />
        <StatGrid cols={3}>
          <Stat label="Junto (arcos próximos)" value={String(js.junto)} sub={`${(js.juntoPct * 100).toFixed(1)}%`} />
          <Stat label="Separado" value={String(js.separado)} sub={`${((1 - js.juntoPct) * 100).toFixed(1)}%`} />
          <Stat label="z-score" value={js.z.toFixed(2)} accent={Math.abs(js.z) >= 2 ? "warn" : "neutral"} />
        </StatGrid>
        <div className="mt-3">
          <VerdictBadge verdict={js.verdict} />
        </div>
      </Card>

      <Card>
        <SectionHeader title="Quente / Frio (descritivo)" subtitle="Números mais e menos vistos na janela atual" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h3 className="text-[10px] uppercase tracking-wider text-neutral-500 mb-2">Mais frequentes</h3>
            <div className="space-y-1.5">
              {hc.hot.map((it) => (
                <HotRow key={`hot-${it.n}`} item={it} kind="hot" />
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-[10px] uppercase tracking-wider text-neutral-500 mb-2">Maior gap (ausência)</h3>
            <div className="space-y-1.5">
              {hc.cold.map((it) => (
                <HotRow key={`cold-${it.n}`} item={it} kind="cold" />
              ))}
            </div>
          </div>
        </div>
        {hc.absent.length > 0 && (
          <p className="mt-3 text-[11px] text-neutral-400">
            <strong>{hc.absent.length}</strong> número(s) ainda não apareceram:{" "}
            <span className="font-mono">{hc.absent.map((a) => a.n).sort((a, b) => a - b).join(", ")}</span>
          </p>
        )}
      </Card>

      <Card>
        <SectionHeader title="Auto-padrões / sequências" subtitle="Maior repetição e maior seca por categoria" />
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-left text-neutral-500">
                <th className="p-1.5 font-medium">Categoria</th>
                <th className="p-1.5 font-medium">Atual</th>
                <th className="p-1.5 font-medium">×</th>
                <th className="p-1.5 font-medium">Maior repetição</th>
                <th className="p-1.5 font-medium">×</th>
                <th className="p-1.5 font-medium">Maior seca</th>
                <th className="p-1.5 font-medium">×</th>
              </tr>
            </thead>
            <tbody>
              {streaks.map((s) => (
                <tr key={s.category} className="border-t border-neutral-800">
                  <td className="p-1.5 text-neutral-300 font-medium">{s.category}</td>
                  <td className="p-1.5 text-neutral-200">{s.currentValue}</td>
                  <td className="p-1.5 font-mono text-amber-300">{s.currentLength}</td>
                  <td className="p-1.5 text-neutral-200">{s.longestValue}</td>
                  <td className="p-1.5 font-mono text-emerald-300">{s.longestLength}</td>
                  <td className="p-1.5 text-neutral-200">{s.longestDryValue}</td>
                  <td className="p-1.5 font-mono text-orange-300">{s.longestDryLength}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </PageContainer>
  );
});
Padroes.displayName = "Padroes";

const GroupRows = memo(({ groups, cols = 3 }: { groups: PatternGroup[]; cols?: number }) => {
  const colsClass = cols === 5 ? "lg:grid-cols-5" : cols === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3";
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 ${colsClass} gap-2`}>
      {groups.map((g) => (
        <SingleGroupRow key={g.name} group={g} />
      ))}
    </div>
  );
});
GroupRows.displayName = "GroupRows";

const SingleGroupRow = memo(({ group }: { group: PatternGroup }) => (
  <div className="rounded-lg border border-neutral-700 bg-neutral-950/60 p-2.5">
    <div className="flex items-center justify-between mb-1">
      <span className="text-[11px] font-semibold text-neutral-300 truncate" title={group.name}>
        {group.name}
      </span>
      <VerdictBadge verdict={group.verdict} />
    </div>
    <div className="text-[10px] text-neutral-400 font-mono mb-1.5">
      obs <span className="text-neutral-100">{group.observed}</span> · esp{" "}
      <span className="text-neutral-100">{group.expected.toFixed(1)}</span> · z{" "}
      <span className={Math.abs(group.z) >= 2 ? "text-amber-300" : "text-neutral-300"}>{group.z.toFixed(2)}</span>
    </div>
    <div className="flex flex-wrap gap-0.5">
      {group.members.slice(0, 24).map((n) => (
        <span
          key={n}
          className={`${ballBg(n)} text-white text-[9px] font-bold w-4 h-4 rounded-sm flex items-center justify-center`}
        >
          {n}
        </span>
      ))}
      {group.members.length > 24 && (
        <span className="text-[9px] text-neutral-500 ml-1 self-center">+{group.members.length - 24}</span>
      )}
    </div>
  </div>
));
SingleGroupRow.displayName = "SingleGroupRow";

interface HotRowProps {
  item: ReturnType<typeof hotColdNumbers>["hot"][number];
  kind: "hot" | "cold";
}
const HotRow = memo(({ item, kind }: HotRowProps) => (
  <div className="flex items-center gap-2 text-[11px]">
    <div className={`${ballBg(item.n)} text-white text-[10px] font-bold w-6 h-6 rounded-md flex items-center justify-center`}>
      {item.n}
    </div>
    <div className="flex-1">
      <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
        <div
          className={kind === "hot" ? "h-1.5 bg-amber-500" : "h-1.5 bg-sky-500"}
          style={{ width: `${Math.min(100, kind === "hot" ? item.count * 8 : item.gap * 1.2)}%` }}
        />
      </div>
    </div>
    <span className="font-mono text-neutral-300 w-12 text-right">
      {kind === "hot" ? `${item.count}×` : `${item.gap}g`}
    </span>
  </div>
));
HotRow.displayName = "HotRow";

export default Padroes;
