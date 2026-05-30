import { memo, useMemo, useState } from "react";
import { useHonestStore } from "../lib/store";
import {
  runPatternBank,
  summarizeLearning,
  usePatternLearning,
  ActivatedRule,
} from "../lib/patternLearning";
import { patternBankSize } from "../lib/patternBank";
import { colorOf } from "../lib/wheel";
import { Card, SectionHeader, Pill } from "./ui";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const ballBg = (n: number) => {
  const c = colorOf(n);
  if (c === "green") return "bg-emerald-600";
  if (c === "red") return "bg-gradient-to-br from-red-500 to-red-700";
  return "bg-gradient-to-br from-neutral-700 to-neutral-900";
};

const labelTag = (r: ActivatedRule): string => {
  if (r.attempts < 5) return "APRENDENDO";
  if (r.learnedAccuracy >= 0.45) return "ALTA CHANCE";
  if (r.learnedAccuracy >= 0.3) return "BOA CHANCE";
  if (r.learnedAccuracy >= 0.18) return "OPORTUNIDADE";
  return "BAIXA";
};

const tagAccent = (
  tag: string
): "good" | "warn" | "neutral" | "bad" => {
  if (tag === "ALTA CHANCE" || tag === "BOA CHANCE") return "good";
  if (tag === "OPORTUNIDADE") return "warn";
  if (tag === "APRENDENDO") return "neutral";
  return "bad";
};

const LearnedSignal = memo(() => {
  const spins = useHonestStore((s) => s.spins);
  useHonestStore((s) => s.spins.length);
  usePatternLearning((s) => s.totalLearned);
  const [stake, setStake] = useState(50);
  const [expanded, setExpanded] = useState(false);

  const history = useMemo(() => spins.map((s) => s.n), [spins]);
  const activated = useMemo(() => runPatternBank(history), [history]);
  const summary = useMemo(() => summarizeLearning(), [history]);
  const bankTotal = patternBankSize();

  if (history.length < 6) {
    return (
      <Card padding="md">
        <SectionHeader
          title="🧠 Sinal Aprendido (única jogada mais provável)"
          eyebrow={`Aprendizado contínuo · banco de ${bankTotal} padrões`}
        />
        <div className="text-[11px] text-neutral-500 italic py-2 text-center">
          Aguardando histórico mínimo. Quanto mais giros, mais inteligente fica.
        </div>
      </Card>
    );
  }

  if (activated.length === 0) {
    return (
      <Card padding="md">
        <SectionHeader
          title="🧠 Sinal Aprendido"
          eyebrow={`${bankTotal} padrões monitorados · ${summary.tracked} já com histórico`}
        />
        <div className="text-[11px] text-neutral-500 italic py-2 text-center">
          Nenhum padrão ativado neste momento. Aguarde próximo giro.
        </div>
      </Card>
    );
  }

  const winner = activated[0];
  const top5 = activated.slice(1, 6);
  const tag = labelTag(winner);
  const accent = tagAccent(tag);

  const ev = winner.learnedAccuracy * winner.payout - (1 - winner.learnedAccuracy);
  const potentialReturn = stake * winner.payout;
  const evReais = ev * stake;
  const kelly = Math.max(
    0,
    Math.min(0.5, (winner.learnedAccuracy * (winner.payout + 1) - 1) / winner.payout)
  );

  const probDisplay = winner.attempts > 0 ? winner.learnedAccuracy : winner.baseline;

  const numbersPreview = Array.from(winner.numbers).slice(0, 12);

  return (
    <Card
      padding="md"
      accent={accent === "good" ? "good" : accent === "bad" ? "bad" : "warn"}
    >
      <SectionHeader
        title={
          <span className="flex items-center gap-2">
            🧠 Sinal Aprendido pelo Histórico
            <Pill accent={accent}>{tag}</Pill>
          </span>
        }
        eyebrow="100% padrões aprendidos: alternâncias · regiões · terminais · puxadas"
        subtitle={
          <span className="text-[10px] text-neutral-500">
            {bankTotal} padrões observados · {summary.tracked} treinados ·{" "}
            {summary.totalLearned} aprendizagens · acerto global{" "}
            {(summary.overallAccuracy * 100).toFixed(1)}%
          </span>
        }
      />

      <div
        className={`rounded-2xl border-2 p-4 mb-3 ${
          accent === "good"
            ? "border-emerald-500 bg-gradient-to-br from-emerald-950/70 to-neutral-950 shadow-lg shadow-emerald-500/20"
            : accent === "warn"
            ? "border-amber-500 bg-gradient-to-br from-amber-950/70 to-neutral-950 shadow-lg shadow-amber-500/20"
            : accent === "bad"
            ? "border-red-500/60 bg-gradient-to-br from-red-950/40 to-neutral-950"
            : "border-neutral-700 bg-neutral-900/60"
        }`}
      >
        <div className="text-center mb-2">
          <div className="text-[10px] uppercase tracking-[0.22em] text-neutral-400 font-bold mb-1">
            {winner.targetType}
          </div>
          <div className="text-4xl sm:text-5xl font-black text-white leading-tight">
            {winner.targetLabel}
          </div>
          <div className="text-amber-300 font-mono text-sm font-bold mt-1">
            paga {winner.payout.toFixed(1)}:1 · cobre {winner.numbers.size} nº
          </div>
        </div>

        <div
          className={`mx-auto max-w-md rounded-xl border p-2.5 my-2 text-center ${
            accent === "good"
              ? "border-emerald-600/50 bg-emerald-950/40"
              : accent === "warn"
              ? "border-amber-600/50 bg-amber-950/40"
              : "border-neutral-700 bg-neutral-900/60"
          }`}
        >
          <div className="text-[9px] uppercase tracking-[0.18em] text-neutral-400 font-bold">
            Chance aprendida de acertar
          </div>
          <div
            className={`text-5xl font-black font-mono leading-none my-1 ${
              probDisplay >= 0.45
                ? "text-emerald-300"
                : probDisplay >= 0.25
                ? "text-amber-300"
                : "text-neutral-200"
            }`}
          >
            {(probDisplay * 100).toFixed(1)}%
          </div>
          <div className="text-[10px] text-neutral-400 font-mono">
            {winner.attempts > 0
              ? `${winner.hits}/${winner.attempts} acertos histórico · ${(probDisplay / winner.baseline).toFixed(2)}× acaso`
              : `${winner.attempts} amostras — usando baseline ${(winner.baseline * 100).toFixed(1)}%`}
          </div>
        </div>

        <div className="flex items-center gap-2 mt-2 text-[10px] flex-wrap justify-center">
          <span className="text-neutral-500 uppercase tracking-wider font-bold shrink-0">
            Aposta R$
          </span>
          <input
            type="number"
            min={1}
            value={stake}
            onChange={(e) => setStake(Math.max(0, Number(e.target.value) || 0))}
            className="w-20 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm font-mono"
          />
          <span className="text-neutral-500">→</span>
          <span className="font-mono text-emerald-300 font-bold">
            +{fmt(potentialReturn)} se acertar
          </span>
          <span className="text-neutral-500">·</span>
          <span
            className={`font-mono ${evReais >= 0 ? "text-emerald-300" : "text-red-300"}`}
          >
            EV {evReais >= 0 ? "+" : ""}
            {fmt(evReais)}
          </span>
        </div>

        {kelly > 0 && (
          <div className="text-[10px] text-amber-300/80 mt-1 font-mono text-center">
            💰 Kelly: {(kelly * 100).toFixed(1)}% da banca
          </div>
        )}

        <div className="text-[10px] text-neutral-300 mt-2 leading-snug text-center">
          <span className="text-neutral-500 uppercase tracking-wider font-bold">
            padrão:
          </span>{" "}
          {winner.description}
        </div>
        <div className="text-[9px] text-neutral-500 mt-1 text-center">
          família: {winner.group} · força {(winner.baseConfidence * 100).toFixed(0)}%
        </div>

        {numbersPreview.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2 justify-center">
            {numbersPreview.map((n) => (
              <div
                key={n}
                className={`${ballBg(n)} text-white text-xs font-black w-8 h-8 rounded-full flex items-center justify-center ring-1 ring-white/30`}
              >
                {n}
              </div>
            ))}
            {winner.numbers.size > 12 && (
              <div className="text-neutral-500 text-[10px] self-center ml-1">
                +{winner.numbers.size - 12} nº
              </div>
            )}
          </div>
        )}
      </div>

      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-[10px] text-neutral-400 hover:text-amber-300 text-center py-1"
      >
        {expanded
          ? "▲ ocultar próximos padrões ativos"
          : `▼ ${activated.length} padrões ativos agora (${activated
              .map((a) => a.group)
              .filter((v, i, arr) => arr.indexOf(v) === i)
              .length} famílias)`}
      </button>

      {expanded && (
        <div className="space-y-1 mt-1">
          {top5.map((r, i) => {
            const t = labelTag(r);
            const ta = tagAccent(t);
            return (
              <div
                key={r.ruleId}
                className="flex items-center gap-2 bg-neutral-900/50 rounded px-2 py-1.5 text-[11px]"
              >
                <div className="w-5 text-neutral-500 font-bold text-center shrink-0">
                  {i + 2}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-neutral-200 truncate">
                    <span className="text-[9px] uppercase tracking-wider text-neutral-500 mr-1">
                      {r.targetType}
                    </span>
                    {r.targetLabel}
                  </div>
                  <div className="text-[9px] text-neutral-500 truncate">
                    {r.description}
                  </div>
                </div>
                <div className="text-right shrink-0 font-mono">
                  <div className="font-bold text-emerald-300">
                    {(r.learnedAccuracy * 100).toFixed(1)}%
                  </div>
                  <div className="text-[9px] text-neutral-500">
                    {r.hits}/{r.attempts} · {r.payout.toFixed(1)}:1
                  </div>
                </div>
                <Pill accent={ta}>{t}</Pill>
              </div>
            );
          })}
        </div>
      )}

      <div className="text-[9px] text-neutral-600 italic mt-2 text-center">
        Cada padrão usa Wilson 95% lower-bound como confiança · evita
        "sorte" de poucas amostras. Casa retém 2,7%.
      </div>
    </Card>
  );
});
LearnedSignal.displayName = "LearnedSignal";

export default LearnedSignal;
