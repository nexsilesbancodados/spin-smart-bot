import { useState, useEffect, useRef, memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crosshair, AlertTriangle, Clock, ShieldCheck, Zap, Brain, TrendingUp, Target, ChevronDown, Sparkles, Volume2 } from 'lucide-react';

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

const numColor = (n: number) =>
  n === 0 ? 'bg-emerald-600 text-white' : RED_NUMBERS.has(n) ? 'bg-red-600 text-white' : 'bg-zinc-800 text-white';

const numGradient = (n: number) =>
  n === 0 ? 'from-emerald-500 to-emerald-700' : RED_NUMBERS.has(n) ? 'from-red-500 to-red-700' : 'from-zinc-600 to-zinc-900';

const getActionLevel = (prob: number) => {
  if (prob >= 85) return { label: 'ENTRAR FORTE', emoji: '🔥', color: 'text-neon-green', borderClass: 'border-neon-green/50', glow: 'shadow-[0_0_30px_hsl(var(--neon-green)/0.2)]' };
  if (prob >= 65) return { label: 'ENTRAR', emoji: '✅', color: 'text-primary', borderClass: 'border-primary/40', glow: 'shadow-[0_0_20px_hsl(var(--primary)/0.15)]' };
  if (prob >= 45) return { label: 'ENTRAR LEVE', emoji: '⚡', color: 'text-yellow-400', borderClass: 'border-yellow-400/30', glow: '' };
  return { label: 'OBSERVAR', emoji: '👁️', color: 'text-muted-foreground', borderClass: 'border-border', glow: '' };
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

const SniperSignal = memo(({ sniperData, sniperCountdown, sniperStale, lastPredResult, allNumbers = [], autoLearnStatus, strategyFilter = 'all', setStrategyFilter }: Props) => {
  const [showAnalysisSelector, setShowAnalysisSelector] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
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

  const { ensTop1, finalNumbers, displayProb, analysisDetail } = useMemo(() => {
    if (!sniperData?.signal || !sniperData?.strategy) {
      return { ensTop1: 0, finalNumbers: [], displayProb: 0, analysisDetail: null };
    }
    const top1 = sniperData.ensemble?.top1 ?? sniperData.topCandidates?.[0]?.num ?? sniperData.strategy.numbers[0];
    const nums: number[] = sniperData.strategy.numbers || [];
    const rawProb = sniperData.signal.probability || 0;

    // Derive analysis-specific detail based on betType or strategy
    const bt = sniperData.aiReasoning?.betType || sniperData.strategy?.type || '';
    let detail: { type: string; label: string; visual: string; colorClass: string } | null = null;

    if (bt === 'cor' || strategyFilter === 'cor') {
      const redCount = nums.filter((n: number) => RED_NUMBERS.has(n)).length;
      const blackCount = nums.filter((n: number) => n > 0 && !RED_NUMBERS.has(n)).length;
      const isRed = redCount > blackCount;
      detail = {
        type: 'cor',
        label: isRed ? 'VERMELHO' : 'PRETO',
        visual: isRed ? '🔴' : '⚫',
        colorClass: isRed ? 'bg-red-600/20 text-red-400 border-red-500/40' : 'bg-zinc-700/30 text-zinc-300 border-zinc-500/40',
      };
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
    } else if (bt === 'fusao' || strategyFilter === 'fusao') {
      detail = { type: 'fusao', label: 'Fusão Multi-IA', visual: '🧬', colorClass: 'bg-violet-600/20 text-violet-400 border-violet-500/40' };
    }

    return { ensTop1: top1, finalNumbers: nums, displayProb: rawProb, analysisDetail: detail };
  }, [sniperData, strategyFilter]);

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
  if (sniperStale && lastPredResult) {
    const isHit = lastPredResult.hit;
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`rounded-2xl border-2 overflow-hidden ${isHit ? 'border-green-500/40 bg-green-500/5' : 'border-destructive/30 bg-destructive/5'}`}
      >
        <div className="p-5 flex items-center gap-4">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
            className={`w-14 h-14 rounded-full flex items-center justify-center ${
              isHit ? 'bg-green-500/20 ring-2 ring-green-500/40' : 'bg-destructive/15 ring-2 ring-destructive/30'
            }`}
          >
            {isHit
              ? <ShieldCheck className="w-7 h-7 text-green-400" />
              : <AlertTriangle className="w-7 h-7 text-destructive" />}
          </motion.div>
          <div className="flex-1">
            <span className={`text-lg font-black ${isHit ? 'text-green-400' : 'text-destructive'}`}>
              {isHit
                ? (lastPredResult.hitType === 'exact' ? '🎯 ACERTO EXATO!' : '✅ ACERTO!')
                : '❌ ERRO'}
            </span>
            <div className="flex gap-4 text-xs text-muted-foreground mt-1">
              <span>Previsto: <strong className="text-foreground">{lastPredResult.predicted}</strong></span>
              <span>Saiu: <strong className="text-foreground">{lastPredResult.actual}</strong></span>
            </div>
          </div>
        </div>
        <div className="border-t border-border/20 px-5 py-2 bg-secondary/10">
          <p className="text-[10px] text-muted-foreground/60 text-center">⏳ Aguardando próximo giro...</p>
        </div>
      </motion.div>
    );
  }

  // No signal
  if (!sniperData?.signal || !sniperData?.strategy) {
    return (
      <div className="bg-card rounded-2xl border border-border p-8 text-center">
        <Clock className="w-7 h-7 text-muted-foreground/40 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">{sniperData?.message || 'Aguardando dados...'}</p>
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

  const countdownColor = sniperCountdown <= 4 ? 'text-destructive' : sniperCountdown <= 8 ? 'text-yellow-400' : 'text-primary';
  const countdownBg = sniperCountdown <= 4 ? 'bg-destructive' : sniperCountdown <= 8 ? 'bg-yellow-400' : 'bg-primary';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border-2 overflow-hidden bg-card ${action.borderClass} ${action.glow}`}
    >
      {/* REED STOP */}
      {reedStopped && (
        <div className="bg-destructive/10 border-b border-destructive/30 px-4 py-2.5 text-center">
          <span className="text-xs font-black text-destructive">⛔ PAUSE — 4 erros seguidos • Aguarde nova tendência</span>
        </div>
      )}

      <div className={reedStopped ? 'opacity-30 pointer-events-none' : ''}>

        {/* ═══ TOP BAR: Timer + Filtro + IAs ═══ */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/20 bg-secondary/10">
          {/* Countdown */}
          {sniperCountdown > 0 && sniperCountdown <= 14 ? (
            <div className={`flex items-center gap-1.5 ${sniperCountdown <= 4 ? 'animate-pulse' : ''}`}>
              <Clock className={`w-3.5 h-3.5 ${countdownColor}`} />
              <span className={`text-sm font-black font-mono tabular-nums ${countdownColor}`}>{sniperCountdown}s</span>
              <div className="w-12 h-1.5 bg-secondary rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-300 ${countdownBg}`}
                  style={{ width: `${(sniperCountdown / 14) * 100}%` }} />
              </div>
            </div>
          ) : sniperCountdown === 0 ? (
            <span className="text-[9px] font-bold text-destructive/60">⏸ Tempo</span>
          ) : null}

          {/* Filtro */}
          <button
            onClick={() => setShowAnalysisSelector(!showAnalysisSelector)}
            className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-secondary/60 border border-border/50 hover:bg-secondary transition-colors"
          >
            <span className="text-[9px] font-bold text-primary">
              {ANALYSIS_TYPES.find(a => a.value === strategyFilter)?.emoji} {ANALYSIS_TYPES.find(a => a.value === strategyFilter)?.label || 'Auto'}
            </span>
            {aiSuccessCount && (
              <span className="text-[7px] px-1 py-0.5 rounded bg-primary/10 text-primary font-bold">{aiSuccessCount} IAs</span>
            )}
            <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${showAnalysisSelector ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Analysis selector dropdown */}
        <AnimatePresence>
          {showAnalysisSelector && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-b border-border/20">
              <div className="flex flex-wrap gap-1.5 px-4 py-2.5">
                {ANALYSIS_TYPES.map(at => (
                  <button
                    key={at.value}
                    onClick={() => { setStrategyFilter?.(at.value); setShowAnalysisSelector(false); }}
                    className={`text-[9px] px-2.5 py-1.5 rounded-lg font-bold transition-all border ${
                      strategyFilter === at.value
                        ? 'bg-primary/20 text-primary border-primary/40 ring-1 ring-primary/30'
                        : 'bg-secondary/40 text-muted-foreground border-border/50 hover:bg-secondary/60'
                    }`}
                  >
                    {at.emoji} {at.label}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══ HERO: Número + Ação + % — a informação principal ═══ */}
        <div className="px-4 pt-5 pb-3">
          <div className="flex items-center gap-5">
            {/* Número principal — GRANDE */}
            <div className="relative">
              <motion.div
                animate={displayProb >= 85 ? { scale: [1, 1.06, 1] } : {}}
                transition={{ duration: 1.5, repeat: Infinity }}
                className={`w-[88px] h-[88px] rounded-full flex items-center justify-center text-4xl font-black shadow-2xl bg-gradient-to-br ${numGradient(ensTop1)} ring-4 ${
                  displayProb >= 85 ? 'ring-neon-green/60 shadow-neon-green/30' : 'ring-primary/30'
                }`}
              >
                {ensTop1}
              </motion.div>
              {/* Glow ring */}
              {displayProb >= 75 && (
                <div className={`absolute inset-0 rounded-full animate-ping opacity-20 ${
                  displayProb >= 85 ? 'bg-neon-green' : 'bg-primary'
                }`} style={{ animationDuration: '2s' }} />
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              {/* Ação */}
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-2xl font-black tracking-tight ${action.color}`}>
                  {action.emoji} {action.label}
                </span>
              </div>

              {/* Tipo de aposta + detalhe da análise */}
              {(betTypeInfo || analysisDetail) && (
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  {betTypeInfo && (
                    <span className="text-sm font-bold text-foreground/80">
                      {betTypeInfo.emoji} {betTypeInfo.label}
                    </span>
                  )}
                  {analysisDetail && (
                    <motion.span
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-black border ${analysisDetail.colorClass}`}
                    >
                      {analysisDetail.visual} {analysisDetail.label}
                    </motion.span>
                  )}
                </div>
              )}

              {/* Confiança */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2.5 bg-secondary rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${displayProb}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className={`h-full rounded-full ${
                      displayProb >= 85 ? 'bg-gradient-to-r from-neon-green to-emerald-400' 
                        : displayProb >= 65 ? 'bg-gradient-to-r from-primary to-cyan-400' 
                        : 'bg-yellow-400'
                    }`}
                  />
                </div>
                <span className={`text-2xl font-black font-mono tabular-nums ${action.color}`}>{displayProb}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ NÚMEROS PARA APOSTAR ═══ */}
        <div className="px-4 pb-4">
          <div className="rounded-xl border border-border/30 overflow-hidden">
            <div className="bg-secondary/20 px-3 py-2 border-b border-border/15 flex items-center justify-between">
              <span className="text-[10px] font-bold text-foreground/70">
                APOSTE EM {finalNumbers.length} NÚMEROS
              </span>
              <span className="text-[10px] font-bold text-primary">
                💰 Paga {payout}x
              </span>
            </div>
            <div className="p-3 flex flex-wrap gap-2 justify-center">
              {finalNumbers.map((n: number, i: number) => {
                const isMain = n === ensTop1;
                return (
                  <motion.div
                    key={n}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: i * 0.03, type: 'spring', stiffness: 300 }}
                    className={`flex items-center justify-center rounded-lg font-black shadow-lg bg-gradient-to-br
                      ${isMain ? 'w-11 h-11 text-base ring-2 shadow-xl' : 'w-9 h-9 text-sm'}
                      ${numGradient(n)}
                      ${isMain 
                        ? (displayProb >= 85 ? 'ring-neon-green shadow-neon-green/20' : 'ring-primary shadow-primary/20') 
                        : 'ring-1 ring-white/5'}
                    `}
                  >
                    {n}
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ═══ INSIGHT DA IA (se houver) ═══ */}
        {(ai?.betDescription || ai?.patternIdentified) && (
          <div className="px-4 pb-3">
            <div className="bg-primary/5 rounded-lg border border-primary/10 px-3 py-2">
              {ai?.betDescription && (
                <p className="text-[11px] text-foreground/70 leading-relaxed">
                  <Brain className="w-3 h-3 text-primary/60 inline mr-1" />
                  {ai.betDescription}
                </p>
              )}
              {ai?.patternIdentified && !ai?.betDescription && (
                <p className="text-[10px] text-muted-foreground leading-relaxed">{ai.patternIdentified}</p>
              )}
            </div>
          </div>
        )}

        {/* ═══ TOP CANDIDATOS (compacto) ═══ */}
        {topCandidates.length > 1 && (
          <div className="px-4 pb-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              <span className="text-[8px] text-muted-foreground font-bold shrink-0 uppercase">Top:</span>
              {topCandidates.slice(0, 6).map((c: any, i: number) => (
                <div key={c.num} className={`flex items-center gap-1 px-2 py-1 rounded-lg shrink-0 ${
                  i === 0 ? 'bg-primary/10 border border-primary/20' : 'bg-secondary/30 border border-border/20'
                }`}>
                  <div className={`w-6 h-6 rounded flex items-center justify-center text-[9px] font-black bg-gradient-to-br ${numGradient(c.num)} ${i === 0 ? 'ring-1 ring-primary' : ''}`}>{c.num}</div>
                  <span className="text-[8px] font-bold text-foreground/60">{c.score?.toFixed(0) ?? '?'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ DETALHES (colapsável) ═══ */}
        {aiLearnings.length > 0 && (
          <>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-2 border-t border-border/15 hover:bg-secondary/20 transition-colors"
            >
              <Sparkles className="w-3 h-3 text-muted-foreground" />
              <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider">
                {showDetails ? 'Ocultar' : 'Ver'} Insights ({aiLearnings.length})
              </span>
              <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${showDetails ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {showDetails && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="px-4 pb-3 space-y-1">
                    {aiLearnings.slice(0, 8).map((learning: string, i: number) => (
                      <div key={i} className="px-2.5 py-1.5 rounded-lg bg-secondary/20 border border-border/15">
                        <span className="text-[9px] text-foreground/70 leading-tight">{learning}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

      </div>
    </motion.div>
  );
});

SniperSignal.displayName = 'SniperSignal';
export default SniperSignal;
