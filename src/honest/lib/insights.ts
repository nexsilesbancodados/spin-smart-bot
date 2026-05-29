import { SLOTS, sectorOf, colorOf, VOISINS, TIERS, ORPHELINS, RED, BLACK } from "./wheel";
import { chiSquareUniform, concentrationIndex } from "./stats";
import { detectDealerChange } from "./dealerChange";

export type InsightSeverity = "neutral" | "info" | "warn" | "good";

export interface Insight {
  id: string;
  severity: InsightSeverity;
  emoji: string;
  title: string;
  body: string;
  metric?: string;
}

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

const computeRatio = (spins: number[], members: Set<number>) =>
  spins.length === 0 ? 0 : spins.filter((n) => members.has(n)).length / spins.length;

export const generateInsights = (spinsNewestFirst: number[]): Insight[] => {
  const out: Insight[] = [];
  if (spinsNewestFirst.length < 30) {
    out.push({
      id: "warm-up",
      severity: "neutral",
      emoji: "⏳",
      title: "Aquecendo a coleta",
      body: `Apenas ${spinsNewestFirst.length} giros. As primeiras insights aparecem a partir de 30+.`,
    });
    return out;
  }

  const last50 = spinsNewestFirst.slice(0, 50);
  const last100 = spinsNewestFirst.slice(0, 100);
  const prev50 = spinsNewestFirst.slice(50, 100);

  const chi = chiSquareUniform(last50);
  if (chi.uniformCompatible) {
    out.push({
      id: "chi-uniform",
      severity: "info",
      emoji: "📊",
      title: "Distribuição compatível com o acaso",
      body: `Qui-quadrado nas últimas 50 rodadas reporta p ≈ ${chi.pApprox.toFixed(2)}. Nada estatisticamente fora do uniforme.`,
      metric: `χ²=${chi.chi2.toFixed(1)} · p=${chi.pApprox.toFixed(2)}`,
    });
  } else {
    out.push({
      id: "chi-divergent",
      severity: "warn",
      emoji: "⚠",
      title: "Distribuição com desvio recente",
      body: `p ≈ ${chi.pApprox.toFixed(3)} — algum padrão está acima do ruído normal. Cheque /analise pra ver onde.`,
      metric: `χ²=${chi.chi2.toFixed(1)}`,
    });
  }

  const sectors = [
    { name: "Voisins", set: VOISINS, expected: 17 / 37 },
    { name: "Tiers", set: TIERS, expected: 12 / 37 },
    { name: "Orphelins", set: ORPHELINS, expected: 8 / 37 },
  ];
  for (const s of sectors) {
    if (prev50.length < 20) continue;
    const recent = computeRatio(last50, s.set);
    const earlier = computeRatio(prev50, s.set);
    const delta = recent - earlier;
    if (Math.abs(delta) > 0.12) {
      out.push({
        id: `sector-shift-${s.name}`,
        severity: Math.abs(delta) > 0.2 ? "warn" : "info",
        emoji: delta > 0 ? "📈" : "📉",
        title: `${s.name} ${delta > 0 ? "subiu" : "caiu"} ${pct(Math.abs(delta))}`,
        body: `Setor passou de ${pct(earlier)} para ${pct(recent)} entre as duas janelas (esperado ${pct(s.expected)}). Pode ser variância ou drift.`,
        metric: `${pct(earlier)} → ${pct(recent)}`,
      });
    }
  }

  const recentRed = computeRatio(last50, RED);
  const recentBlack = computeRatio(last50, BLACK);
  if (Math.abs(recentRed - recentBlack) > 0.18 && last50.length >= 30) {
    out.push({
      id: "color-imbalance",
      severity: "info",
      emoji: "🎨",
      title: `Cor desequilibrada nas últimas ${last50.length}`,
      body: `Vermelho ${pct(recentRed)} vs Preto ${pct(recentBlack)} · esperado ~49% cada. Pode ser variância de janela curta.`,
    });
  }

  const ci = concentrationIndex(last50);
  if (ci >= 25) {
    out.push({
      id: "concentration-high",
      severity: "warn",
      emoji: "🎯",
      title: "Concentração alta na janela",
      body: `Índice ${ci}/100 indica que a distribuição recente está bem longe do uniforme. Esperado em janela curta, mas vale observar.`,
      metric: `CI=${ci}/100`,
    });
  }

  const counts = new Array<number>(SLOTS).fill(0);
  for (const n of last100) counts[n]++;
  const expectedCount = last100.length / SLOTS;
  const hottest = counts
    .map((c, n) => ({ c, n }))
    .sort((a, b) => b.c - a.c)
    .slice(0, 3);
  const coldest = counts
    .map((c, n) => ({ c, n }))
    .filter((x) => x.c === 0).length;

  if (hottest[0].c >= expectedCount * 2.5) {
    out.push({
      id: `hot-${hottest[0].n}`,
      severity: "info",
      emoji: "🔥",
      title: `Número ${hottest[0].n} muito quente`,
      body: `Saiu ${hottest[0].c} vezes nas últimas ${last100.length} rodadas — esperado seria ~${expectedCount.toFixed(1)}. ${pct(hottest[0].c / expectedCount - 1)} acima.`,
      metric: `${hottest[0].c}× · ${pct(hottest[0].c / last100.length)}`,
    });
  }

  if (coldest >= 8 && last100.length >= 80) {
    out.push({
      id: "many-cold",
      severity: "info",
      emoji: "❄",
      title: `${coldest} números ausentes`,
      body: `Não saíram nas últimas ${last100.length} rodadas. Em janela curta isso é normal — não significa que vão sair "para compensar".`,
    });
  }

  const dealer = detectDealerChange(spinsNewestFirst, 30);
  if (dealer.alertLevel !== "ok") {
    out.push({
      id: "dealer-drift",
      severity: dealer.alertLevel === "alert" ? "warn" : "info",
      emoji: dealer.alertLevel === "alert" ? "🎭" : "👀",
      title: dealer.alertLevel === "alert" ? "Drift de dealer/mesa detectado" : "Pequeno drift observado",
      body: dealer.message,
    });
  }

  let streak = 1;
  for (let i = 1; i < spinsNewestFirst.length && colorOf(spinsNewestFirst[i]) === colorOf(spinsNewestFirst[0]); i++) streak++;
  if (streak >= 5) {
    out.push({
      id: `color-streak-${streak}`,
      severity: "info",
      emoji: "🔗",
      title: `Streak de cor: ${streak} ${colorOf(spinsNewestFirst[0])} seguidos`,
      body: "Em roleta justa, streaks de cor 5+ acontecem regularmente por acaso (prob teórica ~3% para qualquer cor numa janela de 5).",
    });
  }

  let secStreak = 1;
  for (let i = 1; i < spinsNewestFirst.length && sectorOf(spinsNewestFirst[i]) === sectorOf(spinsNewestFirst[0]); i++) secStreak++;
  if (secStreak >= 4) {
    out.push({
      id: `sector-streak-${secStreak}`,
      severity: "info",
      emoji: "🌀",
      title: `${secStreak} giros consecutivos no ${sectorOf(spinsNewestFirst[0])}`,
      body: "Concentração temporal pode parecer 'mesa quente' mas é variância de short window.",
    });
  }

  if (out.length === 0) {
    out.push({
      id: "all-clean",
      severity: "good",
      emoji: "✓",
      title: "Tudo dentro da variação normal",
      body: "Nenhuma anomalia, drift ou padrão fora do esperado. Mesa estável.",
    });
  }

  return out;
};
