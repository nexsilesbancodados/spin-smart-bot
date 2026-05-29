import { memo, useMemo, useState } from "react";
import { SLOTS, HOUSE_EDGE, colorOf } from "../lib/wheel";
import { Card, PageContainer, PageHeader, SectionHeader, Stat, StatGrid, Pill } from "../components/ui";

const ballBg = (n: number) => {
  const c = colorOf(n);
  if (c === "green") return "bg-emerald-600";
  if (c === "red") return "bg-red-600";
  return "bg-neutral-800";
};

const Cobertura = memo(() => {
  const [selected, setSelected] = useState<Set<number>>(new Set([0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8]));
  const [rounds, setRounds] = useState(50);
  const [stakePerUnit, setStakePerUnit] = useState(1);

  const toggle = (n: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  };

  const stats = useMemo(() => {
    const coverage = selected.size;
    const hitProb = coverage / SLOTS;
    const wager = coverage * stakePerUnit;
    const payoutOnHit = 36 * stakePerUnit;
    const netOnHit = payoutOnHit - wager;
    const netOnMiss = -wager;
    const evPerRound = hitProb * netOnHit + (1 - hitProb) * netOnMiss;
    const evRatioPerUnit = wager > 0 ? evPerRound / wager : 0;
    const probAtLeastOneHitInN = 1 - Math.pow(1 - hitProb, rounds);
    const expectedNetN = evPerRound * rounds;
    const totalWageredN = wager * rounds;
    return {
      coverage,
      hitProb,
      wager,
      payoutOnHit,
      netOnHit,
      netOnMiss,
      evPerRound,
      evRatioPerUnit,
      probAtLeastOneHitInN,
      expectedNetN,
      totalWageredN,
    };
  }, [selected, rounds, stakePerUnit]);

  return (
    <PageContainer>
      <PageHeader
        title="Coverage Calculator"
        subtitle="Escolha quais números cobrir. Veja matemática real: hit rate, payout, EV por rodada, chance de hit em N rodadas. Tudo transparente — vantagem da casa fixa em −2,7% sempre."
      />

      <Card>
        <SectionHeader title="Seleção de números" subtitle={`${stats.coverage} de 37 selecionados`} />
        <div className="grid grid-cols-10 gap-1 mb-3">
          {Array.from({ length: 37 }, (_, n) => (
            <button
              key={n}
              onClick={() => toggle(n)}
              className={`${ballBg(n)} text-white text-sm font-bold h-9 rounded-md flex items-center justify-center transition ${
                selected.has(n) ? "ring-2 ring-amber-400 scale-105" : "opacity-40 hover:opacity-70"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setSelected(new Set())} className="text-xs px-2.5 py-1 rounded-md bg-neutral-800 hover:bg-neutral-700">
            Limpar
          </button>
          <button onClick={() => setSelected(new Set(Array.from({ length: 37 }, (_, n) => n)))} className="text-xs px-2.5 py-1 rounded-md bg-neutral-800 hover:bg-neutral-700">
            Todos (37)
          </button>
          <button onClick={() => setSelected(new Set([22, 18, 29, 7, 28, 12, 35, 3, 26, 0, 32, 15, 19, 4, 21, 2, 25]))} className="text-xs px-2.5 py-1 rounded-md bg-neutral-800 hover:bg-neutral-700">
            Voisins (17)
          </button>
          <button onClick={() => setSelected(new Set([27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33]))} className="text-xs px-2.5 py-1 rounded-md bg-neutral-800 hover:bg-neutral-700">
            Tiers (12)
          </button>
          <button onClick={() => setSelected(new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]))} className="text-xs px-2.5 py-1 rounded-md bg-neutral-800 hover:bg-neutral-700">
            Vermelho (18)
          </button>
          <button onClick={() => setSelected(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]))} className="text-xs px-2.5 py-1 rounded-md bg-neutral-800 hover:bg-neutral-700">
            1ª Dúzia (12)
          </button>
        </div>
      </Card>

      <Card>
        <SectionHeader title="Configuração" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-neutral-500">Stake por unidade (R$)</span>
            <input
              type="number"
              value={stakePerUnit}
              onChange={(e) => setStakePerUnit(Math.max(0.5, Number(e.target.value) || 1))}
              step={0.5}
              min={0.5}
              className="bg-neutral-950 border border-neutral-700 rounded-md px-2 py-1.5 font-mono"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-neutral-500">Rodadas simuladas</span>
            <input
              type="number"
              value={rounds}
              onChange={(e) => setRounds(Math.max(1, Number(e.target.value) || 50))}
              min={1}
              className="bg-neutral-950 border border-neutral-700 rounded-md px-2 py-1.5 font-mono"
            />
          </label>
        </div>
      </Card>

      <StatGrid cols={4}>
        <Stat
          label="Hit rate teórico"
          value={`${(stats.hitProb * 100).toFixed(2)}%`}
          sub={`${stats.coverage}/37 números`}
        />
        <Stat
          label="Stake total/rodada"
          value={`R$ ${stats.wager.toFixed(2)}`}
          sub={`${stats.coverage} × R$ ${stakePerUnit}`}
        />
        <Stat
          label="Ganho líquido por hit"
          value={`+R$ ${stats.netOnHit.toFixed(2)}`}
          sub={`Recebe R$ ${stats.payoutOnHit.toFixed(2)} − stake`}
          accent={stats.netOnHit > 0 ? "good" : "bad"}
        />
        <Stat
          label="EV por rodada"
          value={`R$ ${stats.evPerRound.toFixed(2)}`}
          sub={`${(stats.evRatioPerUnit * 100).toFixed(2)}% sobre stake`}
          accent={stats.evPerRound >= 0 ? "good" : "bad"}
        />
      </StatGrid>

      <Card accent={stats.evPerRound < 0 ? "bad" : "good"}>
        <SectionHeader title={`Projeção em ${rounds} rodadas`} />
        <StatGrid cols={3}>
          <Stat
            label="Total apostado"
            value={`R$ ${stats.totalWageredN.toFixed(2)}`}
          />
          <Stat
            label="Resultado esperado"
            value={`R$ ${stats.expectedNetN.toFixed(2)}`}
            sub={`Convergência a −2,7% sobre apostado: R$ ${(stats.totalWageredN * -HOUSE_EDGE).toFixed(2)}`}
            accent={stats.expectedNetN >= 0 ? "good" : "bad"}
          />
          <Stat
            label="Chance de ≥1 hit"
            value={`${(stats.probAtLeastOneHitInN * 100).toFixed(1)}%`}
            sub={`em ${rounds} rodadas`}
          />
        </StatGrid>
      </Card>

      <Card accent="warn">
        <div className="text-sm space-y-2">
          <p className="font-bold">📐 Como ler isto</p>
          <p className="text-xs text-neutral-300 leading-relaxed">
            <strong>Cobertura alta ≠ lucro.</strong> Apostar em 30 números dá 81% de hit, mas você ganha apenas R$ 6 e
            arrisca R$ 30 — perde R$ 24 quando erra (19% das vezes). EV líquido = <strong>−2,7%</strong> sempre,
            independente da estratégia.
          </p>
          <p className="text-xs text-neutral-300 leading-relaxed">
            <strong>Cobertura baixa ≠ ruim.</strong> Apostar 1 pleno paga 35:1, EV = −2,7%. Mesma matemática, mas
            variância MUITO maior — pode lucrar muito ou perder tudo rapidamente.
          </p>
          <p className="text-xs text-neutral-300 leading-relaxed">
            Use isto pra calibrar o quanto de variância você aceita. Não pra "encontrar a estratégia que ganha".
          </p>
        </div>
      </Card>
    </PageContainer>
  );
});
Cobertura.displayName = "Cobertura";

export default Cobertura;
