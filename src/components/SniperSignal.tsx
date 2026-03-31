import { useState, useEffect, useRef, memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Crosshair, AlertTriangle, Clock, ShieldCheck, Brain, TrendingUp } from 'lucide-react';

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

const numColor = (n: number) =>
  n === 0 ? 'bg-emerald-600 text-white' : RED_NUMBERS.has(n) ? 'bg-red-600 text-white' : 'bg-zinc-800 text-white';

const numGradient = (n: number) =>
  n === 0 ? 'from-emerald-500 to-emerald-700' : RED_NUMBERS.has(n) ? 'from-red-500 to-red-700' : 'from-zinc-600 to-zinc-900';

const getActionLevel = (prob: number) => {
  if (prob >= 85) return { label: 'ENTRAR FORTE', emoji: '🔥', color: 'text-green-400', borderClass: 'border-green-500/40', bgClass: 'bg-green-500/10' };
  if (prob >= 65) return { label: 'ENTRAR', emoji: '✅', color: 'text-primary', borderClass: 'border-primary/40', bgClass: 'bg-primary/10' };
  if (prob >= 45) return { label: 'ENTRAR LEVE', emoji: '⚡', color: 'text-yellow-400', borderClass: 'border-yellow-500/30', bgClass: 'bg-yellow-500/10' };
  return { label: 'OBSERVAR', emoji: '👁️', color: 'text-muted-foreground', borderClass: 'border-border', bgClass: 'bg-secondary/20' };
};

const BET_TYPE_LABELS: Record<string, { emoji: string; label: string; desc: string }> = {
  terminal: { emoji: '🔢', label: 'Terminal', desc: 'Aposte nos números com mesmo final' },
  vizinhos: { emoji: '🎯', label: 'Vizinhos', desc: 'Aposte nos vizinhos do cilindro' },
  setor: { emoji: '🌍', label: 'Setor', desc: 'Aposte no setor indicado' },
  duzia: { emoji: '📊', label: 'Dúzia', desc: 'Aposte na dúzia indicada' },
  coluna: { emoji: '📐', label: 'Coluna', desc: 'Aposte na coluna indicada' },
  pleno: { emoji: '💎', label: 'Pleno', desc: 'Aposte direto no número' },
  cavalos: { emoji: '🐴', label: 'Cavalos', desc: 'Aposte no grupo de cavalos' },
  cor: { emoji: '🎨', label: 'Cor', desc: 'Aposte na cor indicada' },
  paridade: { emoji: '⚖️', label: 'Par/Ímpar', desc: 'Aposte par ou ímpar' },
  alto_baixo: { emoji: '📏', label: 'Alto/Baixo', desc: 'Aposte alto ou baixo' },
  rua: { emoji: '🛤️', label: 'Rua', desc: 'Aposte na rua indicada' },
  linha: { emoji: '📋', label: 'Linha', desc: 'Aposte na linha' },
  carre: { emoji: '🔲', label: 'Quadra', desc: 'Aposte na quadra' },
  sixline: { emoji: '6️⃣', label: 'Sixline', desc: 'Aposte na sixline' },
  split: { emoji: '✂️', label: 'Split', desc: 'Aposte no split' },
  orphelins: { emoji: '🌀', label: 'Orphelins', desc: 'Aposte nos Orphelins' },
  tiers: { emoji: '🎪', label: 'Tiers', desc: 'Aposte nos Tiers' },
  voisins: { emoji: '🎡', label: 'Voisins', desc: 'Aposte nos Voisins' },
  jeu_zero: { emoji: '🟢', label: 'Jeu Zéro', desc: 'Aposte no Jeu Zéro' },
  final: { emoji: '🔚', label: 'Final', desc: 'Aposte nos finais' },
  combinado: { emoji: '🧬', label: 'Combinado', desc: 'Aposta combinada' },
  fusion_top5: { emoji: '🎯', label: 'Fusão Top 5', desc: 'Convergência máxima de 7 modelos' },
  grupo: { emoji: '🔢', label: 'Grupo', desc: 'Grupo de números convergentes' },
};

interface Props {
  sniperData: any;
  sniperCountdown: number;
  sniperStale: boolean;
  lastPredResult: { hit: boolean | null; hitType: string | null; predicted: number | null; actual: number | null; label: string } | null;
  confidenceFilter: boolean;
  rtInsights?: any[];
  allNumbers?: number[];
  autoLearnStatus?: 'idle' | 'learning' | 'analyzing' | 'backtesting';
  strategyFilter?: string;
  setStrategyFilter?: (s: string) => void;
  spinTimestamp?: number;
}

const ANALYSIS_TYPES = [
  { value: 'all', emoji: '🧠', label: 'Auto' },
  { value: 'terminal', emoji: '🔢', label: 'Terminal' },
  { value: 'cavalos', emoji: '🐴', label: 'Cavalos' },
  { value: 'setor', emoji: '🌍', label: 'Setor' },
  { value: 'duzia', emoji: '📊', label: 'Dúzia' },
  { value: 'coluna', emoji: '📐', label: 'Coluna' },
  { value: 'cor', emoji: '🎨', label: 'Cor' },
  { value: 'paridade', emoji: '⚖️', label: 'Par/Ímpar' },
  { value: 'rua', emoji: '🛤️', label: 'Rua' },
  { value: 'pleno', emoji: '💎', label: 'Pleno' },
  { value: 'puxada', emoji: '🧲', label: 'Puxadas' },
  { value: 'fusao', emoji: '🧬', label: 'Fusão' },
];

const SniperSignal = memo(({ sniperData, sniperCountdown, sniperStale, lastPredResult, allNumbers = [], autoLearnStatus, strategyFilter = 'all' }: Props) => {
  const [reedCount, setReedCount] = useState(0);
  const prevHitRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (!lastPredResult || lastPredResult.hit === null) return;
    if (lastPredResult.hit === prevHitRef.current) return;
    prevHitRef.current = lastPredResult.hit;
    if (lastPredResult.hit) setReedCount(0);
    else setReedCount(prev => Math.min(prev + 1, 4));
  }, [lastPredResult?.hit]);

  const reedStopped = reedCount >= 4;

  const { ensTop1, finalNumbers, displayProb, analysisDetail, streakInfo, recentWR, fusionTop5 } = useMemo(() => {
    if (!sniperData?.signal || !sniperData?.strategy) {
      return { ensTop1: 0, finalNumbers: [], displayProb: 0, analysisDetail: null, fusionTop5: [] };
    }
    const top1 = sniperData.fusionTop5?.[0]?.number ?? sniperData.ensemble?.top1 ?? sniperData.topCandidates?.[0]?.num ?? sniperData.strategy.numbers[0];
    const nums: number[] = sniperData.fusionTop5 ? sniperData.fusionTop5.map((t: any) => t.number) : (sniperData.strategy.numbers || []);
    const rawProb = sniperData.fusionConfidence ?? sniperData.signal.probability ?? 0;
    const ft5 = sniperData.fusionTop5 || [];

    const bt = sniperData.aiReasoning?.betType || sniperData.strategy?.type || '';
    let detail: { type: string; label: string; visual: string; colorClass: string } | null = null;

    if (bt === 'cor' || strategyFilter === 'cor') {
      const redCount = nums.filter((n: number) => RED_NUMBERS.has(n)).length;
      const blackCount = nums.filter((n: number) => n > 0 && !RED_NUMBERS.has(n)).length;
      const isRed = redCount > blackCount;
      detail = { type: 'cor', label: isRed ? 'VERMELHO' : 'PRETO', visual: isRed ? '🔴' : '⚫', colorClass: isRed ? 'bg-red-600/20 text-red-400 border-red-500/40' : 'bg-zinc-700/30 text-zinc-300 border-zinc-500/40' };
    } else if (bt === 'duzia' || strategyFilter === 'duzia') {
      const dzCounts = [0, 0, 0, 0];
      nums.forEach((n: number) => { if (n === 0) dzCounts[0]++; else if (n <= 12) dzCounts[1]++; else if (n <= 24) dzCounts[2]++; else dzCounts[3]++; });
      const bestDz = dzCounts.indexOf(Math.max(dzCounts[1], dzCounts[2], dzCounts[3]), 1);
      const dzLabels = ['', '1ª (1-12)', '2ª (13-24)', '3ª (25-36)'];
      detail = { type: 'duzia', label: `Dúzia ${dzLabels[bestDz]}`, visual: '📊', colorClass: 'bg-blue-600/20 text-blue-400 border-blue-500/40' };
    } else if (bt === 'coluna' || strategyFilter === 'coluna') {
      const COL1 = [1,4,7,10,13,16,19,22,25,28,31,34];
      const COL2 = [2,5,8,11,14,17,20,23,26,29,32,35];
      const COL3 = [3,6,9,12,15,18,21,24,27,30,33,36];
      const c1 = nums.filter((n: number) => COL1.includes(n)).length;
      const c2 = nums.filter((n: number) => COL2.includes(n)).length;
      const c3 = nums.filter((n: number) => COL3.includes(n)).length;
      const bestCol = c1 >= c2 && c1 >= c3 ? 1 : c2 >= c3 ? 2 : 3;
      detail = { type: 'coluna', label: `Coluna ${bestCol}`, visual: '📐', colorClass: 'bg-purple-600/20 text-purple-400 border-purple-500/40' };
    } else if (bt === 'paridade' || strategyFilter === 'paridade') {
      const parCount = nums.filter((n: number) => n > 0 && n % 2 === 0).length;
      const imparCount = nums.filter((n: number) => n > 0 && n % 2 === 1).length;
      const isPar = parCount > imparCount;
      detail = { type: 'paridade', label: isPar ? 'PAR' : 'ÍMPAR', visual: '⚖️', colorClass: 'bg-amber-600/20 text-amber-400 border-amber-500/40' };
    } else if (bt === 'alto_baixo' || strategyFilter === 'alto_baixo') {
      const altoCount = nums.filter((n: number) => n >= 19).length;
      const baixoCount = nums.filter((n: number) => n >= 1 && n <= 18).length;
      const isAlto = altoCount > baixoCount;
      detail = { type: 'alto_baixo', label: isAlto ? 'ALTO (19-36)' : 'BAIXO (1-18)', visual: '📏', colorClass: 'bg-teal-600/20 text-teal-400 border-teal-500/40' };
    } else if (bt === 'terminal' || strategyFilter === 'terminal') {
      const term = top1 % 10;
      detail = { type: 'terminal', label: `Terminal ${term}`, visual: '🔢', colorClass: 'bg-cyan-600/20 text-cyan-400 border-cyan-500/40' };
    } else if (bt === 'setor' || strategyFilter === 'setor') {
      const VOISINS_SET = new Set([22,18,29,7,28,12,35,3,26,0,32,15,19,4,21,2,25]);
      const TIERS_SET = new Set([27,13,36,11,30,8,23,10,5,24,16,33]);
      const vCount = nums.filter((n: number) => VOISINS_SET.has(n)).length;
      const tCount = nums.filter((n: number) => TIERS_SET.has(n)).length;
      const sectorName = vCount >= tCount ? 'Voisins du Zéro' : 'Tiers du Cylindre';
      detail = { type: 'setor', label: sectorName, visual: '🌍', colorClass: 'bg-emerald-600/20 text-emerald-400 border-emerald-500/40' };
    } else if (bt === 'cavalos' || strategyFilter === 'cavalos') {
      detail = { type: 'cavalos', label: 'Cavalos', visual: '🐴', colorClass: 'bg-orange-600/20 text-orange-400 border-orange-500/40' };
    } else if (bt === 'rua' || strategyFilter === 'rua') {
      const street = Math.ceil(top1 / 3);
      detail = { type: 'rua', label: `Rua ${street}`, visual: '🛤️', colorClass: 'bg-indigo-600/20 text-indigo-400 border-indigo-500/40' };
    } else if (bt === 'pleno' || strategyFilter === 'pleno') {
      detail = { type: 'pleno', label: `Pleno ${top1}`, visual: '💎', colorClass: 'bg-yellow-600/20 text-yellow-400 border-yellow-500/40' };
    } else if (bt === 'vizinhos' || strategyFilter === 'vizinhos' || bt === 'puxada' || strategyFilter === 'puxada') {
      detail = { type: bt || strategyFilter, label: bt === 'puxada' || strategyFilter === 'puxada' ? 'Puxadas' : 'Vizinhos', visual: bt === 'puxada' || strategyFilter === 'puxada' ? '🧲' : '🎯', colorClass: 'bg-pink-600/20 text-pink-400 border-pink-500/40' };
    } else if (bt === 'fusao' || bt === 'fusion_top5' || strategyFilter === 'fusao') {
      detail = { type: 'fusao', label: 'Fusão Top 5 — 7 Modelos', visual: '🎯', colorClass: 'bg-violet-600/20 text-violet-400 border-violet-500/40' };
    }

    const streakInfo = (() => {
      if (!allNumbers || allNumbers.length < 2) return null;
      const n = top1;
      let count = 0;
      for (const x of allNumbers) { if (x === n) count++; else break; }
      if (count < 2) return null;
      const prob = Math.min(95, 50 + count * 12);
      return { num: n, count, prob, isExtreme: count >= 4 };
    })();

    const recentWR = typeof sniperData?.recentWinRate === 'number' ? Math.round(sniperData.recentWinRate * 100) : null;
    return { ensTop1: top1, finalNumbers: nums, displayProb: rawProb, analysisDetail: detail, streakInfo, recentWR };
  }, [sniperData, strategyFilter, allNumbers]);

  // ── KILL SWITCH from Omni-Core (after all hooks) ───
  if (sniperData?.killSwitch) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
        <div className="bg-destructive/10 border-2 border-destructive/40 rounded-2xl p-6 text-center">
          <div className="text-4xl mb-3">🛡️</div>
          <p className="text-sm font-black text-destructive mb-2">PROTEÇÃO DE BANCA ATIVADA</p>
          <p className="text-xs text-muted-foreground">{sniperData.killReason || 'Anomalia detectada — sinais suspensos por 5 giros'}</p>
          {sniperData.temperature && (
            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary border border-border text-[10px] font-bold text-muted-foreground">
              🌡️ Mesa {sniperData.temperature.toUpperCase()}
            </div>
          )}
        </div>
        {sniperData.agents && (
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(sniperData.agents as Record<string, any>).map(([id, agent]: [string, any]) => (
              <div key={id} className="bg-card rounded-xl border border-border/50 p-2.5 text-center">
                <div className="text-[8px] font-black text-muted-foreground uppercase tracking-wider mb-1">
                  {id === 'statistical' ? '📊 Estatístico' : id === 'ballistic' ? '🎯 Balístico' : '🔄 Reversão'}
                </div>
                <div className="text-[11px] font-black text-destructive">{agent.winRate}</div>
                <div className="text-[7px] text-muted-foreground">streak: {agent.streak > 0 ? `+${agent.streak}` : agent.streak}</div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    );
  }

  // Loading state
  if (!sniperData) {
    return (
      <div className="bg-card rounded-2xl border border-border p-10 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="relative mx-auto w-12 h-12">
            <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-pulse" />
            <Crosshair className="w-6 h-6 text-primary/40 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-spin" style={{ animationDuration: '3s' }} />
          </div>
          <p className="text-sm text-muted-foreground font-medium">Carregando IA...</p>
          {autoLearnStatus && autoLearnStatus !== 'idle' && (
            <p className="text-[10px] text-primary/60 animate-pulse">
              {autoLearnStatus === 'learning' ? '🧠 Aprendendo...' : autoLearnStatus === 'analyzing' ? '🔍 Analisando...' : '📊 Backtesting...'}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Stale — show last result
  if (sniperStale && lastPredResult && !sniperData?.signal) {
    const isHit = lastPredResult.hit;
    return (
      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
        className={`rounded-2xl border-2 overflow-hidden ${isHit ? 'border-green-500/40 bg-green-500/5' : 'border-destructive/30 bg-destructive/5'}`}>
        <div className="p-5 flex items-center gap-4">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}
            className={`w-14 h-14 rounded-full flex items-center justify-center ${isHit ? 'bg-green-500/20 ring-2 ring-green-500/40' : 'bg-destructive/15 ring-2 ring-destructive/30'}`}>
            {isHit ? <ShieldCheck className="w-7 h-7 text-green-400" /> : <AlertTriangle className="w-7 h-7 text-destructive" />}
          </motion.div>
          <div className="flex-1">
            <span className={`text-lg font-black ${isHit ? 'text-green-400' : 'text-destructive'}`}>
              {isHit ? (lastPredResult.hitType === 'exact' ? '🎯 ACERTO EXATO!' : '✅ ACERTO!') : '❌ ERRO'}
            </span>
            <div className="flex gap-4 text-xs text-muted-foreground mt-1">
              <span>Previsto: <strong className="text-foreground">{lastPredResult.predicted}</strong></span>
              <span>Saiu: <strong className="text-foreground">{lastPredResult.actual}</strong></span>
            </div>
          </div>
        </div>
        <div className="border-t border-border/20 px-5 py-2 bg-secondary/10">
          <p className="text-[10px] text-muted-foreground/60 text-center">⏳ Analisando próximo giro...</p>
        </div>
      </motion.div>
    );
  }

  // No signal
  if (!sniperData?.signal || !sniperData?.strategy) {
    const waitingMessage = sniperCountdown === 0
      ? '🔎 Analisando... aguardando próxima rodada'
      : sniperData?.message || 'Aguardando dados...';

    return (
      <div className="bg-card rounded-2xl border border-border p-8 text-center">
        <Clock className="w-7 h-7 text-muted-foreground/40 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">{waitingMessage}</p>
      </div>
    );
  }

  const action = getActionLevel(displayProb);
  const ai = sniperData?.aiReasoning;
  const betTypeInfo = ai?.betType ? BET_TYPE_LABELS[ai.betType] || { emoji: '🎯', label: ai.betType, desc: '' } : null;
  const aiLearnings: string[] = sniperData?.aiLearnings || [];
  const topCandidates = sniperData?.topCandidates || [];
  const payout = Math.max(1, Math.round(35 / finalNumbers.length));

  const aiSourceMatch = aiLearnings.find(l => l.includes('MEGA-IA') || l.includes('MULTI-IA'));
  const aiCountMatch = aiSourceMatch?.match(/(\d+)\/(\d+)/);
  const aiSuccessCount = aiCountMatch ? aiCountMatch[1] : null;

  const conciseReason = ai?.suggestedBet || ai?.betDescription || ai?.patternIdentified || betTypeInfo?.desc || 'Jogada pronta para o próximo giro';
  const compactNumbers = finalNumbers.slice(0, 6);
  const remainingCount = Math.max(0, finalNumbers.length - compactNumbers.length);
  const isSimpleMarket = Boolean(analysisDetail && ['cor', 'paridade', 'alto_baixo', 'duzia', 'coluna'].includes(analysisDetail.type));
  const primaryCall = analysisDetail?.label || betTypeInfo?.label || sniperData?.strategy?.label || 'Jogada principal';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      {/* REED STOP */}
      {reedStopped && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-2.5 text-center">
          <span className="text-xs font-black text-destructive">⛔ PAUSE — 4 erros seguidos • Aguarde nova tendência</span>
        </div>
      )}

      <div className={reedStopped ? 'opacity-30 pointer-events-none space-y-3' : 'space-y-3'}>
        {/* ── HEADER: Juiz Supremo ─────────────────────────── */}
        <div className={`rounded-xl border ${action.borderClass} ${action.bgClass} p-3.5`}>
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-primary">
              <Brain className="w-3.5 h-3.5" />
              Juiz Supremo · {displayProb}%
            </span>
            {ai?.consensus > 0 && (
              <span className="text-[9px] px-2.5 py-0.5 rounded-full bg-primary/15 text-primary font-bold border border-primary/25">
                {ai.consensus} consensos
              </span>
            )}
            {aiSuccessCount && (
              <span className="text-[9px] px-2.5 py-0.5 rounded-full bg-secondary text-muted-foreground font-bold border border-border/50">
                {aiSuccessCount} IAs
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
            {conciseReason}
          </p>
        </div>

        {/* ── SIGNAL CARD: Próximo Giro ────────────────────── */}
        <div className="rounded-xl border-2 border-primary/30 bg-card overflow-hidden">
          {/* Header bar */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/30 bg-primary/5">
            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-primary flex items-center gap-1.5">
              🎯 Próximo giro — Aposte agora
            </span>
            <span className={`text-[11px] font-black ${action.color} flex items-center gap-1`}>
              {action.emoji} {action.label}
            </span>
          </div>

          <div className="p-4">
            {isSimpleMarket ? (
              <div className="flex items-center gap-4">
                <span className="text-4xl">{analysisDetail?.visual}</span>
                <div>
                  <p className="text-2xl font-black text-foreground leading-none">{primaryCall}</p>
                  <p className="text-[11px] text-muted-foreground mt-1.5">Aposte nesses para a próxima rodada</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Main number + label */}
                <div className="flex items-center gap-3">
                  <motion.div
                    initial={{ scale: 0, rotateY: 180 }}
                    animate={{ scale: 1, rotateY: 0 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                    className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black text-white bg-gradient-to-br ${numGradient(ensTop1)} ring-2 ring-primary/50 shadow-lg shadow-primary/20`}
                  >
                    {ensTop1}
                  </motion.div>
                  <div>
                    <p className="text-xl font-black text-foreground leading-none">{primaryCall}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">Aposte nesses para a próxima rodada</p>
                  </div>
                </div>

                {/* Number pills */}
                <div className="flex flex-wrap gap-2">
                  {compactNumbers.map((n: number, i: number) => (
                    <motion.div
                      key={n}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: i * 0.05 }}
                      className={`h-11 min-w-11 px-3 rounded-xl flex items-center justify-center text-[15px] font-black text-white bg-gradient-to-br ${numGradient(n)} ${
                        i === 0 ? 'ring-2 ring-primary/50 shadow-md shadow-primary/15' : 'ring-1 ring-white/10'
                      }`}
                    >
                      {n}
                    </motion.div>
                  ))}
                  {remainingCount > 0 && (
                    <div className="h-11 px-4 rounded-xl flex items-center justify-center text-sm font-bold bg-secondary/50 text-muted-foreground border border-border/40">
                      +{remainingCount}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Stats bar */}
          <div className="flex items-center gap-3 px-4 py-2.5 border-t border-border/20 bg-secondary/10 flex-wrap">
            <span className="text-[11px] font-bold text-foreground/70">
              Cobertura: <b className="text-foreground">{finalNumbers.length} números</b>
            </span>
            <span className="text-border/60">·</span>
            <span className="text-[11px] font-bold text-foreground/70">
              Paga: <b className="text-foreground">{payout}x</b>
            </span>
        {sniperData?.entryForce && (
          <>
            <span className="text-border/60">·</span>
            <span className={`text-[11px] font-bold inline-flex items-center gap-1 ${
              sniperData.entryForce === 'forte' ? 'text-green-400' :
              sniperData.entryForce === 'padrao' ? 'text-primary' : 'text-muted-foreground'
            }`}>
              {sniperData.entryForce === 'forte' ? '🔥' : sniperData.entryForce === 'padrao' ? '✅' : '👁️'}
              {' '}Entrada {sniperData.entryForce.charAt(0).toUpperCase() + sniperData.entryForce.slice(1)}
            </span>
          </>
        )}
            {recentWR !== null && (
              <>
                <span className="text-border/60">·</span>
                <span className="text-[11px] font-bold text-foreground/70 inline-flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 text-primary" /> WR: <b className="text-foreground">{recentWR}%</b>
                </span>
              </>
            )}
            {streakInfo && (
              <>
                <span className="text-border/60">·</span>
                <span className="text-[11px] font-bold text-foreground/70">
                  Streak #{streakInfo.num}: <b className="text-foreground">{streakInfo.count}x</b>
                </span>
              </>
            )}
          </div>
        </div>

    {/* ── OMNI-CORE: Agentes + Temperatura ─────────────── */}
    {sniperData?.agents && sniperData?.omniCore && (
      <div className="rounded-xl border border-border/40 bg-card/50 overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border/20 bg-secondary/10">
          <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">⚙️ OMNI-CORE</span>
          {sniperData.temperature && (
            <span className={`ml-auto text-[9px] font-bold px-2 py-0.5 rounded-full border ${
              sniperData.temperature === 'quente' ? 'bg-green-500/10 text-green-400 border-green-500/30' :
              sniperData.temperature === 'morna' ? 'bg-primary/10 text-primary border-primary/30' :
              sniperData.temperature === 'fria' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
              'bg-destructive/10 text-destructive border-destructive/30'
            }`}>
              🌡️ {sniperData.temperature.toUpperCase()}
            </span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-px bg-border/20">
          {Object.entries(sniperData.agents as Record<string, any>).map(([id, agent]: [string, any]) => {
            const isWinner = sniperData.strategy?.type && (
              (id === 'statistical' && /duzia|coluna|cor/.test(sniperData.strategy.type)) ||
              (id === 'ballistic' && /setor|vizinho/.test(sniperData.strategy.type)) ||
              (id === 'reversion' && /revers|paridade|alto_baixo|cor/.test(sniperData.strategy.type))
            );
            return (
              <div key={id} className={`p-2.5 text-center ${isWinner ? 'bg-primary/5' : 'bg-card/80'}`}>
                <div className="text-[8px] font-black text-muted-foreground uppercase tracking-wider mb-1">
                  {id === 'statistical' ? '📊 ESTAT' : id === 'ballistic' ? '🎯 BALÍST' : '🔄 REVERS'}
                </div>
                <div className={`text-[12px] font-black font-mono ${
                  isWinner ? 'text-primary' : 'text-foreground/70'
                }`}>{agent.winRate}</div>
                <div className="flex items-center justify-center gap-1 mt-0.5">
                  <div className={`h-1 rounded-full flex-1 max-w-[40px] ${
                    agent.weight > 1.2 ? 'bg-green-500' : agent.weight > 0.7 ? 'bg-primary/50' : 'bg-destructive/50'
                  }`} style={{ width: `${Math.min(100, agent.weight * 50)}%` }} />
                  <span className="text-[7px] text-muted-foreground font-mono">{agent.weight?.toFixed(1)}</span>
                </div>
                {isWinner && <div className="text-[7px] text-primary font-bold mt-0.5">🏆 ATIVO</div>}
              </div>
            );
          })}
        </div>
        {sniperData.arbiterLog && (
          <div className="px-3 py-2 border-t border-border/20 space-y-0.5">
            {(sniperData.arbiterLog as string[]).slice(0, 3).map((log: string, i: number) => (
              <div key={i} className="text-[8px] text-muted-foreground font-mono truncate">{log}</div>
            ))}
          </div>
        )}
      </div>
    )}

        {/* ── TOP CANDIDATOS ────────────────────────────────── */}
        {topCandidates.length > 1 && !isSimpleMarket && (
          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Top candidatos</span>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {topCandidates.slice(0, 6).map((c: any, i: number) => (
                <div key={c.num} className={`flex items-center gap-2 px-3 py-2 rounded-xl shrink-0 border transition-all ${
                  i === 0 ? 'bg-primary/10 border-primary/25 shadow-sm shadow-primary/10' : 'bg-card border-border/40 hover:border-border/60'
                }`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-black text-white bg-gradient-to-br ${numGradient(c.num)} ${
                    i === 0 ? 'ring-1.5 ring-primary/60' : ''
                  }`}>{c.num}</div>
                  <span className="text-[11px] font-bold text-muted-foreground tabular-nums">{c.score?.toFixed(0) ?? '?'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
});

SniperSignal.displayName = 'SniperSignal';
export default SniperSignal;
