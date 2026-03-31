import { useState, useEffect, useRef, memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crosshair, AlertTriangle, Clock, ShieldCheck, Brain, TrendingUp, Zap, Target, Shield } from 'lucide-react';

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

const numColor = (n: number) =>
  n === 0 ? 'bg-roulette-green text-white' : RED_NUMBERS.has(n) ? 'bg-roulette-red text-white' : 'bg-roulette-black text-white';

const numGradient = (n: number) =>
  n === 0 ? 'from-emerald-500 to-emerald-700' : RED_NUMBERS.has(n) ? 'from-red-500 to-red-700' : 'from-zinc-600 to-zinc-900';

const getActionLevel = (prob: number) => {
  if (prob >= 85) return { label: 'ENTRAR FORTE', emoji: '🔥', color: 'text-neon-green', borderClass: 'border-neon-green/40', bgClass: 'bg-neon-green/8', glowClass: 'shadow-neon-green' };
  if (prob >= 65) return { label: 'ENTRAR', emoji: '✅', color: 'text-primary', borderClass: 'border-primary/40', bgClass: 'bg-primary/8', glowClass: 'shadow-neon-cyan' };
  if (prob >= 45) return { label: 'ENTRAR LEVE', emoji: '⚡', color: 'text-gold', borderClass: 'border-gold/30', bgClass: 'bg-gold/8', glowClass: '' };
  return { label: 'OBSERVAR', emoji: '👁️', color: 'text-muted-foreground', borderClass: 'border-border', bgClass: 'bg-secondary/20', glowClass: '' };
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
      detail = { type: 'coluna', label: `Coluna ${bestCol}`, visual: '📐', colorClass: 'bg-neon-purple/20 text-neon-purple border-neon-purple/40' };
    } else if (bt === 'paridade' || strategyFilter === 'paridade') {
      const parCount = nums.filter((n: number) => n > 0 && n % 2 === 0).length;
      const imparCount = nums.filter((n: number) => n > 0 && n % 2 === 1).length;
      const isPar = parCount > imparCount;
      detail = { type: 'paridade', label: isPar ? 'PAR' : 'ÍMPAR', visual: '⚖️', colorClass: 'bg-gold/20 text-gold border-gold/40' };
    } else if (bt === 'alto_baixo' || strategyFilter === 'alto_baixo') {
      const altoCount = nums.filter((n: number) => n >= 19).length;
      const baixoCount = nums.filter((n: number) => n >= 1 && n <= 18).length;
      const isAlto = altoCount > baixoCount;
      detail = { type: 'alto_baixo', label: isAlto ? 'ALTO (19-36)' : 'BAIXO (1-18)', visual: '📏', colorClass: 'bg-neon-cyan/20 text-neon-cyan border-neon-cyan/40' };
    } else if (bt === 'terminal' || strategyFilter === 'terminal') {
      const term = top1 % 10;
      detail = { type: 'terminal', label: `Terminal ${term}`, visual: '🔢', colorClass: 'bg-neon-cyan/20 text-neon-cyan border-neon-cyan/40' };
    } else if (bt === 'setor' || strategyFilter === 'setor') {
      const VOISINS_SET = new Set([22,18,29,7,28,12,35,3,26,0,32,15,19,4,21,2,25]);
      const TIERS_SET = new Set([27,13,36,11,30,8,23,10,5,24,16,33]);
      const vCount = nums.filter((n: number) => VOISINS_SET.has(n)).length;
      const tCount = nums.filter((n: number) => TIERS_SET.has(n)).length;
      const sectorName = vCount >= tCount ? 'Voisins du Zéro' : 'Tiers du Cylindre';
      detail = { type: 'setor', label: sectorName, visual: '🌍', colorClass: 'bg-neon-green/20 text-neon-green border-neon-green/40' };
    } else if (bt === 'cavalos' || strategyFilter === 'cavalos') {
      detail = { type: 'cavalos', label: 'Cavalos', visual: '🐴', colorClass: 'bg-neon-pink/20 text-neon-pink border-neon-pink/40' };
    } else if (bt === 'rua' || strategyFilter === 'rua') {
      const street = Math.ceil(top1 / 3);
      detail = { type: 'rua', label: `Rua ${street}`, visual: '🛤️', colorClass: 'bg-neon-purple/20 text-neon-purple border-neon-purple/40' };
    } else if (bt === 'pleno' || strategyFilter === 'pleno') {
      detail = { type: 'pleno', label: `Pleno ${top1}`, visual: '💎', colorClass: 'bg-gold/20 text-gold border-gold/40' };
    } else if (bt === 'vizinhos' || strategyFilter === 'vizinhos' || bt === 'puxada' || strategyFilter === 'puxada') {
      detail = { type: bt || strategyFilter, label: bt === 'puxada' || strategyFilter === 'puxada' ? 'Puxadas' : 'Vizinhos', visual: bt === 'puxada' || strategyFilter === 'puxada' ? '🧲' : '🎯', colorClass: 'bg-neon-pink/20 text-neon-pink border-neon-pink/40' };
    } else if (bt === 'fusao' || bt === 'fusion_top5' || strategyFilter === 'fusao') {
      detail = { type: 'fusao', label: 'Fusão Top 5 — 7 Modelos', visual: '🎯', colorClass: 'bg-neon-purple/20 text-neon-purple border-neon-purple/40' };
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
    return { ensTop1: top1, finalNumbers: nums, displayProb: rawProb, analysisDetail: detail, streakInfo, recentWR, fusionTop5: ft5 };
  }, [sniperData, strategyFilter, allNumbers]);

  // ── KILL SWITCH from Omni-Core ───
  if (sniperData?.killSwitch) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
        <div className="glass rounded-2xl p-6 text-center border-2 border-destructive/30">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="text-4xl mb-3"
          >🛡️</motion.div>
          <p className="text-sm font-black text-destructive font-display tracking-wider mb-2">PROTEÇÃO DE BANCA</p>
          <p className="text-xs text-muted-foreground">{sniperData.killReason || 'Anomalia detectada — sinais suspensos'}</p>
          {sniperData.temperature && (
            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full glass border border-border text-[10px] font-bold text-muted-foreground">
              🌡️ Mesa {sniperData.temperature.toUpperCase()}
            </div>
          )}
        </div>
        {sniperData.agents && (
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(sniperData.agents as Record<string, any>).map(([id, agent]: [string, any]) => (
              <div key={id} className="glass rounded-xl border border-border/40 p-2.5 text-center">
                <div className="text-[8px] font-black text-muted-foreground uppercase tracking-wider mb-1">
                  {id === 'statistical' ? '📊 Estat' : id === 'ballistic' ? '🎯 Balíst' : '🔄 Revers'}
                </div>
                <div className="text-[11px] font-black text-destructive font-mono">{agent.winRate}</div>
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
      <div className="glass rounded-2xl border border-primary/20 p-10 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="relative mx-auto w-14 h-14">
            <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-t-primary border-r-transparent border-b-transparent border-l-transparent"
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
            />
            <Crosshair className="w-6 h-6 text-primary/60 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-sm text-muted-foreground font-display tracking-wider">CARREGANDO IA</p>
          {autoLearnStatus && autoLearnStatus !== 'idle' && (
            <p className="text-[10px] text-primary/60 animate-pulse font-mono">
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
        className={`glass rounded-2xl border-2 overflow-hidden ${isHit ? 'border-neon-green/30' : 'border-destructive/30'}`}>
        <div className="p-5 flex items-center gap-4">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}
            className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isHit ? 'bg-neon-green/15 ring-2 ring-neon-green/30' : 'bg-destructive/15 ring-2 ring-destructive/30'}`}>
            {isHit ? <ShieldCheck className="w-7 h-7 text-neon-green" /> : <AlertTriangle className="w-7 h-7 text-destructive" />}
          </motion.div>
          <div className="flex-1">
            <span className={`text-lg font-black font-display tracking-wider ${isHit ? 'text-neon-green' : 'text-destructive'}`}>
              {isHit ? (lastPredResult.hitType === 'exact' ? '🎯 EXATO!' : '✅ ACERTO!') : '❌ ERRO'}
            </span>
            <div className="flex gap-4 text-xs text-muted-foreground mt-1 font-mono">
              <span>Previsto: <strong className="text-foreground">{lastPredResult.predicted}</strong></span>
              <span>Saiu: <strong className="text-foreground">{lastPredResult.actual}</strong></span>
            </div>
          </div>
        </div>
        <div className="border-t border-border/20 px-5 py-2 bg-secondary/10">
          <p className="text-[10px] text-muted-foreground/60 text-center font-mono">⏳ Analisando próximo giro...</p>
        </div>
      </motion.div>
    );
  }

  // No signal — premium waiting state
  if (!sniperData?.signal || !sniperData?.strategy) {
    const waitingMessage = sniperCountdown === 0
      ? '🔎 Analisando... aguardando próxima rodada'
      : sniperData?.message || 'Aguardando dados...';

    return (
      <div className="glass rounded-2xl border border-border/20 p-8 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.02] to-transparent" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border/30 to-transparent" />
        <div className="relative">
          <motion.div animate={{ opacity: [0.3, 0.8, 0.3], y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 3 }}>
            <Clock className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
          </motion.div>
          <p className="text-[11px] text-muted-foreground/50 font-display tracking-wider font-bold">{waitingMessage}</p>
          <div className="mt-3 flex justify-center gap-1">
            {[0, 1, 2].map(i => (
              <motion.div
                key={i}
                animate={{ opacity: [0.2, 0.8, 0.2] }}
                transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.3 }}
                className="w-1.5 h-1.5 rounded-full bg-primary/40"
              />
            ))}
          </div>
        </div>
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
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass border-2 border-destructive/30 rounded-2xl px-4 py-3 text-center"
        >
          <span className="text-xs font-black text-destructive font-display tracking-wider">⛔ PAUSE — 4 erros seguidos</span>
          <p className="text-[9px] text-muted-foreground mt-1">Aguarde nova tendência para continuar</p>
        </motion.div>
      )}

      <div className={reedStopped ? 'opacity-30 pointer-events-none space-y-3' : 'space-y-3'}>
        {/* ── HEADER: Juiz Supremo ─────────────────────────── */}
        <div className={`glass rounded-2xl border ${action.borderClass} ${action.bgClass} p-4 ${action.glowClass}`}>
          <div className="flex items-center gap-2 flex-wrap mb-2.5">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
              <Brain className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] font-black uppercase tracking-[0.15em] text-primary font-display">
                Juiz Supremo
              </span>
            </div>
            {/* Confidence badge */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className={`px-3 py-1.5 rounded-full border font-display font-black text-[11px] ${
                displayProb >= 80 ? 'bg-neon-green/10 text-neon-green border-neon-green/30' :
                displayProb >= 60 ? 'bg-primary/10 text-primary border-primary/25' :
                'bg-secondary text-muted-foreground border-border'
              }`}
            >
              {displayProb}%
            </motion.div>
            {ai?.consensus > 0 && (
              <span className="text-[9px] px-2.5 py-1 rounded-full bg-neon-purple/10 text-neon-purple font-bold border border-neon-purple/20">
                {ai.consensus} consensos
              </span>
            )}
            {aiSuccessCount && (
              <span className="text-[9px] px-2.5 py-1 rounded-full glass text-muted-foreground font-bold border border-border/40 font-mono">
                {aiSuccessCount} IAs
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2 pl-1">
            {conciseReason}
          </p>
        </div>

        {/* ── SIGNAL CARD: Próximo Giro ────────────────────── */}
        <div className="glass rounded-2xl border-2 border-primary/25 overflow-hidden card-hover">
          {/* Header bar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/20 bg-gradient-to-r from-primary/8 to-transparent">
            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-primary flex items-center gap-2 font-display">
              <Target className="w-4 h-4" />
              PRÓXIMO GIRO
            </span>
            <motion.span
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className={`text-[11px] font-black ${action.color} flex items-center gap-1.5 px-3 py-1 rounded-full border ${action.borderClass} ${action.bgClass}`}
            >
              {action.emoji} {action.label}
            </motion.span>
          </div>

          <div className="p-4">
            {isSimpleMarket ? (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-4"
              >
                <span className="text-5xl">{analysisDetail?.visual}</span>
                <div>
                  <p className="text-2xl font-black text-foreground leading-none font-display tracking-wide">{primaryCall}</p>
                  <p className="text-[11px] text-muted-foreground mt-1.5">Aposte neste mercado para a próxima rodada</p>
                </div>
              </motion.div>
            ) : (
              <div className="space-y-3">
                {/* Main number + label */}
                <div className="flex items-center gap-4">
                  <motion.div
                    initial={{ scale: 0, rotateY: 180 }}
                    animate={{ scale: 1, rotateY: 0 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                    className={`w-18 h-18 rounded-2xl flex items-center justify-center text-3xl font-black text-white bg-gradient-to-br ${numGradient(ensTop1)} ring-2 ring-primary/40 shadow-lg shadow-primary/20`}
                    style={{ width: 72, height: 72 }}
                  >
                    {ensTop1}
                  </motion.div>
                  <div className="flex-1">
                    <p className="text-xl font-black text-foreground leading-none font-display tracking-wide">{primaryCall}</p>
                    <p className="text-[11px] text-muted-foreground mt-1.5">
                      {fusionTop5.length > 0 ? `Fusão de ${sniperData?.totalModels || 7} modelos → Top 5` : 'Aposte nesses números agora'}
                    </p>
                    {analysisDetail && (
                      <div className={`inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-lg border text-[9px] font-bold ${analysisDetail.colorClass}`}>
                        <span>{analysisDetail.visual}</span>
                        <span>{analysisDetail.label}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* FUSION TOP 5 with voter details */}
                {fusionTop5.length > 0 ? (
                  <div className="space-y-2">
                    {fusionTop5.map((t: any, i: number) => (
                      <motion.div
                        key={t.number}
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: i * 0.06 }}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border backdrop-blur-sm ${
                          i === 0 ? 'glass-strong border-primary/30 ring-1 ring-primary/15' : 'glass border-border/30'
                        }`}
                      >
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-[15px] font-black text-white bg-gradient-to-br ${numGradient(t.number)} ${
                          i === 0 ? 'ring-2 ring-primary/50 shadow-md shadow-primary/15' : 'ring-1 ring-white/10'
                        }`}>
                          {t.number}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-[11px] font-black font-mono ${i === 0 ? 'text-primary' : 'text-foreground'}`}>
                              #{i + 1}
                            </span>
                            <span className="text-[9px] px-2 py-0.5 rounded-full glass border border-border/30 font-bold text-muted-foreground">
                              {t.voterCount} modelo{t.voterCount > 1 ? 's' : ''}
                            </span>
                            <span className="text-[9px] font-mono text-muted-foreground/60 ml-auto">
                              score: {t.score}
                            </span>
                          </div>
                          <p className="text-[8px] text-muted-foreground/50 mt-0.5 truncate font-mono">
                            {t.voters?.join(', ')}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  /* Fallback: original number pills */
                  <div className="flex flex-wrap gap-2">
                    {compactNumbers.map((n: number, i: number) => (
                      <motion.div
                        key={n}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: i * 0.05 }}
                        className={`h-12 min-w-12 px-3 rounded-xl flex items-center justify-center text-base font-black text-white bg-gradient-to-br ${numGradient(n)} ${
                          i === 0 ? 'ring-2 ring-primary/50 shadow-md shadow-primary/15' : 'ring-1 ring-white/10'
                        }`}
                      >
                        {n}
                      </motion.div>
                    ))}
                    {remainingCount > 0 && (
                      <div className="h-12 px-4 rounded-xl flex items-center justify-center text-sm font-bold glass text-muted-foreground border border-border/30">
                        +{remainingCount}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Stats bar */}
          <div className="flex items-center gap-3 px-4 py-2.5 border-t border-border/15 bg-secondary/5 flex-wrap">
            <span className="text-[10px] font-bold text-foreground/60 font-mono">
              {fusionTop5.length > 0 ? 'Top 5 Fusão' : `${finalNumbers.length} números`}
            </span>
            <div className="w-px h-3 bg-border/30" />
            <span className="text-[10px] font-bold text-foreground/60 font-mono">
              Paga <b className="text-primary">{payout}x</b>
            </span>
            {sniperData?.entryForce && (
              <>
                <div className="w-px h-3 bg-border/30" />
                <span className={`text-[10px] font-bold inline-flex items-center gap-1 ${
                  sniperData.entryForce === 'forte' ? 'text-neon-green' :
                  sniperData.entryForce === 'padrao' ? 'text-primary' : 'text-muted-foreground'
                }`}>
                  {sniperData.entryForce === 'forte' ? <Zap className="w-3 h-3" /> : sniperData.entryForce === 'padrao' ? '✅' : '👁️'}
                  {' '}Entrada {sniperData.entryForce.charAt(0).toUpperCase() + sniperData.entryForce.slice(1)}
                </span>
              </>
            )}
            {recentWR !== null && (
              <>
                <div className="w-px h-3 bg-border/30" />
                <span className="text-[10px] font-bold text-foreground/60 inline-flex items-center gap-1 font-mono">
                  <TrendingUp className="w-3 h-3 text-primary" /> WR <b className="text-foreground">{recentWR}%</b>
                </span>
              </>
            )}
            {streakInfo && (
              <>
                <div className="w-px h-3 bg-border/30" />
                <span className="text-[10px] font-bold text-gold font-mono">
                  🔱 #{streakInfo.num} {streakInfo.count}×
                </span>
              </>
            )}
          </div>
        </div>

        {/* ── OMNI-CORE: Agentes + Temperatura ─────────────── */}
        {sniperData?.agents && sniperData?.omniCore && (
          <div className="glass rounded-2xl border border-border/30 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/15">
              <span className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] font-display">⚙️ OMNI-CORE</span>
              {sniperData.temperature && (
                <span className={`ml-auto text-[9px] font-bold px-2.5 py-1 rounded-full border ${
                  sniperData.temperature === 'quente' ? 'bg-neon-green/10 text-neon-green border-neon-green/25' :
                  sniperData.temperature === 'morna' ? 'bg-primary/10 text-primary border-primary/25' :
                  sniperData.temperature === 'fria' ? 'bg-neon-cyan/10 text-neon-cyan border-neon-cyan/25' :
                  'bg-destructive/10 text-destructive border-destructive/25'
                }`}>
                  🌡️ {sniperData.temperature.toUpperCase()}
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-px bg-border/10">
              {Object.entries(sniperData.agents as Record<string, any>).map(([id, agent]: [string, any]) => {
                const isWinner = sniperData.strategy?.type && (
                  (id === 'statistical' && /duzia|coluna|cor/.test(sniperData.strategy.type)) ||
                  (id === 'ballistic' && /setor|vizinho/.test(sniperData.strategy.type)) ||
                  (id === 'reversion' && /revers|paridade|alto_baixo|cor/.test(sniperData.strategy.type))
                );
                return (
                  <div key={id} className={`p-3 text-center ${isWinner ? 'bg-primary/5' : 'bg-card/60'}`}>
                    <div className="text-[8px] font-black text-muted-foreground uppercase tracking-wider mb-1 font-mono">
                      {id === 'statistical' ? '📊 ESTAT' : id === 'ballistic' ? '🎯 BALÍST' : '🔄 REVERS'}
                    </div>
                    <div className={`text-[13px] font-black font-mono ${
                      isWinner ? 'text-primary text-glow-cyan' : 'text-foreground/70'
                    }`}>{agent.winRate}</div>
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <div className={`h-1.5 rounded-full flex-1 max-w-[40px] transition-all ${
                        agent.weight > 1.2 ? 'bg-neon-green' : agent.weight > 0.7 ? 'bg-primary/50' : 'bg-destructive/50'
                      }`} style={{ width: `${Math.min(100, agent.weight * 50)}%` }} />
                      <span className="text-[7px] text-muted-foreground font-mono">{agent.weight?.toFixed(1)}</span>
                    </div>
                    {isWinner && <div className="text-[7px] text-primary font-bold mt-0.5 font-mono">🏆 ATIVO</div>}
                  </div>
                );
              })}
            </div>
            {sniperData.arbiterLog && (
              <div className="px-4 py-2.5 border-t border-border/15 space-y-0.5">
                {(sniperData.arbiterLog as string[]).slice(0, 3).map((log: string, i: number) => (
                  <div key={i} className="text-[8px] text-muted-foreground/60 font-mono truncate">{log}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TOP CANDIDATOS ────────────────────────────────── */}
        {topCandidates.length > 1 && !isSimpleMarket && (
          <div className="space-y-2">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 px-1 font-display">Top candidatos</span>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
              {topCandidates.slice(0, 6).map((c: any, i: number) => (
                <motion.div
                  key={c.num}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl shrink-0 border transition-all backdrop-blur-sm ${
                    i === 0 ? 'glass-strong border-primary/25 shadow-sm shadow-primary/10' : 'glass border-border/30 hover:border-border/60'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-[12px] font-black text-white bg-gradient-to-br ${numGradient(c.num)} ${
                    i === 0 ? 'ring-1.5 ring-primary/50' : ''
                  }`}>{c.num}</div>
                  <span className="text-[11px] font-bold text-muted-foreground tabular-nums font-mono">{c.score?.toFixed(0) ?? '?'}</span>
                </motion.div>
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
