import { useState, useEffect, useRef, memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crosshair, AlertTriangle, Clock, ShieldCheck, Zap, Brain, TrendingUp, Target, ChevronDown, Sparkles } from 'lucide-react';

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

const numColor = (n: number) =>
  n === 0 ? 'bg-emerald-600 text-white' : RED_NUMBERS.has(n) ? 'bg-red-600 text-white' : 'bg-zinc-800 text-white';

const getActionLevel = (prob: number) => {
  if (prob >= 85) return { label: '🔥 ENTRAR FORTE', color: 'text-neon-green', borderClass: 'border-neon-green/50', bg: 'bg-neon-green/5' };
  if (prob >= 65) return { label: '✅ ENTRAR', color: 'text-primary', borderClass: 'border-primary/40', bg: 'bg-primary/5' };
  if (prob >= 45) return { label: '⚡ ENTRAR', color: 'text-yellow-400', borderClass: 'border-yellow-400/30', bg: 'bg-yellow-400/5' };
  return { label: '🎯 ENTRAR', color: 'text-primary', borderClass: 'border-primary/30', bg: 'bg-primary/5' };
};

const BET_TYPE_LABELS: Record<string, { emoji: string; label: string }> = {
  terminal: { emoji: '🔢', label: 'Terminal' },
  vizinhos: { emoji: '🎯', label: 'Vizinhos' },
  setor: { emoji: '🌍', label: 'Setor' },
  duzia: { emoji: '📊', label: 'Dúzia' },
  coluna: { emoji: '📐', label: 'Coluna' },
  pleno: { emoji: '💎', label: 'Pleno' },
  cavalos: { emoji: '🐴', label: 'Cavalos' },
  cor: { emoji: '🎨', label: 'Cor' },
  paridade: { emoji: '⚖️', label: 'Par/Ímpar' },
  alto_baixo: { emoji: '📏', label: 'Alto/Baixo' },
  rua: { emoji: '🛤️', label: 'Rua' },
  linha: { emoji: '📋', label: 'Linha' },
  carre: { emoji: '🔲', label: 'Quadra' },
  sixline: { emoji: '6️⃣', label: 'Sixline' },
  split: { emoji: '✂️', label: 'Split' },
  orphelins: { emoji: '🌀', label: 'Orphelins' },
  tiers: { emoji: '🎪', label: 'Tiers' },
  voisins: { emoji: '🎡', label: 'Voisins' },
  jeu_zero: { emoji: '🟢', label: 'Jeu Zéro' },
  final: { emoji: '🔚', label: 'Final' },
  combinado: { emoji: '🧬', label: 'Combinado' },
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
  spinTimestamp?: number; // timestamp of when the spin was detected
}

const ANALYSIS_TYPES = [
  { value: 'all', emoji: '🧠', label: 'Auto (Melhor)' },
  { value: 'terminal', emoji: '🔢', label: 'Terminal' },
  { value: 'cavalos', emoji: '🐴', label: 'Cavalos' },
  { value: 'setor', emoji: '🌍', label: 'Setor' },
  { value: 'duzia', emoji: '📊', label: 'Dúzia' },
  { value: 'coluna', emoji: '📐', label: 'Coluna' },
  { value: 'cor', emoji: '🎨', label: 'Cor' },
  { value: 'paridade', emoji: '⚖️', label: 'Par/Ímpar' },
  { value: 'alto_baixo', emoji: '📏', label: 'Alto/Baixo' },
  { value: 'rua', emoji: '🛤️', label: 'Rua' },
  { value: 'zero', emoji: '🟢', label: 'Zero' },
  { value: 'puxada', emoji: '🧲', label: 'Puxadas' },
  { value: 'fusao', emoji: '🧬', label: 'Fusão' },
  { value: 'pleno', emoji: '💎', label: 'Pleno' },
];

const SniperSignal = memo(({ sniperData, sniperStale, lastPredResult, allNumbers = [], autoLearnStatus, strategyFilter = 'all', setStrategyFilter }: Props) => {
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

  const { ensTop1, finalNumbers, displayProb } = useMemo(() => {
    if (!sniperData?.signal || !sniperData?.strategy) {
      return { ensTop1: 0, finalNumbers: [], displayProb: 0 };
    }
    const top1 = sniperData.ensemble?.top1 ?? sniperData.topCandidates?.[0]?.num ?? sniperData.strategy.numbers[0];
    const nums: number[] = sniperData.strategy.numbers || [];
    const rawProb = sniperData.signal.probability || 0;
    return { ensTop1: top1, finalNumbers: nums, displayProb: rawProb };
  }, [sniperData]);

  // Loading
  if (!sniperData) {
    return (
      <div className="bg-card rounded-2xl border border-border p-10 flex items-center justify-center">
        <div className="text-center">
          <Crosshair className="w-8 h-8 text-primary/30 mx-auto mb-3 animate-pulse" />
          <p className="text-sm text-muted-foreground">Carregando IA...</p>
          {autoLearnStatus && autoLearnStatus !== 'idle' && (
            <p className="text-[10px] text-primary/60 mt-1 animate-pulse">
              {autoLearnStatus === 'learning' ? '🧠 Aprendendo...' : autoLearnStatus === 'analyzing' ? '🔍 Analisando...' : '📊 Backtesting...'}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Stale — show last result
  if (sniperStale && lastPredResult) {
    return (
      <div className="bg-card rounded-2xl border border-border p-5">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${
            lastPredResult.hit ? 'bg-green-500/15 border-green-500/40' : 'bg-destructive/15 border-destructive/40'
          }`}>
            {lastPredResult.hit
              ? <ShieldCheck className="w-6 h-6 text-green-400" />
              : <AlertTriangle className="w-6 h-6 text-destructive" />}
          </div>
          <div>
            <span className={`text-base font-black ${lastPredResult.hit ? 'text-green-400' : 'text-destructive'}`}>
              {lastPredResult.hit
                ? (lastPredResult.hitType === 'exact' ? '🎯 ACERTO EXATO!' : '✅ ACERTO!')
                : '❌ ERRO'}
            </span>
            <div className="flex gap-3 text-xs text-muted-foreground mt-1">
              <span>Previsto: <strong className="text-foreground">{lastPredResult.predicted}</strong></span>
              <span>Saiu: <strong className="text-foreground">{lastPredResult.actual}</strong></span>
            </div>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground/50 mt-2 text-center">⏳ Aguardando próximo giro...</p>
      </div>
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
  const lastNumber = allNumbers?.[0];
  const betTypeInfo = ai?.betType ? BET_TYPE_LABELS[ai.betType] || { emoji: '🎯', label: ai.betType } : null;
  const aiLearnings: string[] = sniperData?.aiLearnings || [];
  const topCandidates = sniperData?.topCandidates || [];

  // Count AI sources from learnings
  const aiSourceMatch = aiLearnings.find(l => l.includes('MEGA-IA') || l.includes('MULTI-IA'));
  const aiCountMatch = aiSourceMatch?.match(/(\d+)\/(\d+)/);
  const aiSuccessCount = aiCountMatch ? aiCountMatch[1] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border-2 overflow-hidden shadow-xl bg-card ${action.borderClass}`}
    >
      {/* REED STOP */}
      {reedStopped && (
        <div className="bg-destructive/10 border-b border-destructive/30 p-2.5 text-center">
          <span className="text-xs font-black text-destructive">⛔ PAUSE — 4 erros seguidos • Aguarde nova tendência</span>
        </div>
      )}

      <div className={reedStopped ? 'opacity-30 pointer-events-none' : ''}>

        {/* ═══ SELETOR DE ANÁLISE (compacto) ═══ */}
        <div className="px-4 pt-3 pb-1">
          <button
            onClick={() => setShowAnalysisSelector(!showAnalysisSelector)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/60 border border-border/50 hover:bg-secondary transition-colors w-full"
          >
            <Target className="w-3.5 h-3.5 text-primary" />
            <span className="text-[9px] font-black text-primary uppercase tracking-wider">
              {ANALYSIS_TYPES.find(a => a.value === strategyFilter)?.emoji} {ANALYSIS_TYPES.find(a => a.value === strategyFilter)?.label || 'Auto'}
            </span>
            {aiSuccessCount && (
              <span className="text-[7px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-bold ml-auto">
                {aiSuccessCount} IAs
              </span>
            )}
            <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${showAnalysisSelector ? 'rotate-180' : ''} ${!aiSuccessCount ? 'ml-auto' : ''}`} />
          </button>
          <AnimatePresence>
            {showAnalysisSelector && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="flex flex-wrap gap-1.5 mt-2 pb-1">
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
        </div>

        {/* ═══ JOGADA PRINCIPAL — Hero compacto ═══ */}
        <div className="px-4 py-3">
          <div className="flex items-center gap-4">
            {/* Número principal */}
            <div className="relative shrink-0">
              <motion.div
                animate={displayProb >= 85 ? { scale: [1, 1.04, 1] } : {}}
                transition={{ duration: 1.5, repeat: Infinity }}
                className={`w-[72px] h-[72px] rounded-full flex items-center justify-center text-3xl font-black shadow-2xl ring-4 ${numColor(ensTop1)} ${
                  displayProb >= 85 ? 'ring-neon-green/60 shadow-neon-green/30' : 'ring-primary/30'
                }`}
              >
                {ensTop1}
              </motion.div>
            </div>

            {/* Ação + Números */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Zap className={`w-4 h-4 ${action.color}`} />
                <span className={`text-sm font-black ${action.color}`}>{action.label}</span>
                {betTypeInfo && (
                  <span className="text-[8px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 ml-auto">
                    {betTypeInfo.emoji} {betTypeInfo.label}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {finalNumbers.map((n: number, i: number) => {
                  const isMain = n === ensTop1;
                  return (
                    <motion.div
                      key={n}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className={`flex items-center justify-center rounded-full font-black shadow-md
                        ${isMain ? 'w-9 h-9 text-xs ring-2' : 'w-7 h-7 text-[10px] ring-1'}
                        ${numColor(n)}
                        ${isMain ? (displayProb >= 85 ? 'ring-neon-green' : 'ring-primary') : 'ring-white/10 opacity-80'}
                      `}
                    >
                      {n}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Descrição da jogada */}
          {ai?.betDescription && (
            <p className="text-[11px] text-primary/70 mt-2 leading-snug font-medium">{ai.betDescription}</p>
          )}
        </div>

        {/* ═══ BARRA DE ASSERTIVIDADE ═══ */}
        <div className="px-4 py-2.5 border-t border-border/20 bg-secondary/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="w-3.5 h-3.5 text-primary/60" />
            <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider">
              {finalNumbers.length} nums • paga {Math.max(1, 36 - finalNumbers.length)}x
              {lastNumber !== undefined && ` • último: ${lastNumber}`}
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-20 h-1.5 bg-secondary rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${displayProb}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className={`h-full rounded-full ${
                  displayProb >= 85 ? 'bg-neon-green' : displayProb >= 65 ? 'bg-primary' : 'bg-yellow-400'
                }`}
              />
            </div>
            <span className={`text-xl font-black font-mono ${action.color}`}>{displayProb}%</span>
          </div>
        </div>

        {/* ═══ PADRÃO + MERCADO (inline) ═══ */}
        {(ai?.patternIdentified || ai?.marketAnalysis?.bestMarket) && (
          <div className="px-4 py-2.5 border-t border-border/15 bg-secondary/10">
            {ai?.marketAnalysis?.bestMarket && (
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-3 h-3 text-primary/60" />
                <span className="text-[10px] font-bold text-foreground/80">{ai.marketAnalysis.bestMarket}</span>
                <span className="text-[8px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-bold ml-auto">
                  {ai.marketAnalysis.marketConfidence}%
                </span>
              </div>
            )}
            {ai?.patternIdentified && (
              <p className="text-[9px] text-muted-foreground leading-relaxed">{ai.patternIdentified}</p>
            )}
          </div>
        )}

        {/* ═══ TOP 5 CANDIDATOS (compacto) ═══ */}
        {topCandidates.length > 1 && (
          <div className="px-4 py-2.5 border-t border-border/15">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {topCandidates.slice(0, 6).map((c: any, i: number) => (
                <div key={c.num} className={`flex items-center gap-1 px-2 py-1 rounded-lg shrink-0 ${
                  i === 0 ? 'bg-primary/10 border border-primary/20' : 'bg-secondary/30 border border-border/30'
                }`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black ${numColor(c.num)} ${i === 0 ? 'ring-1 ring-primary' : ''}`}>{c.num}</div>
                  <span className="text-[8px] font-bold text-foreground/70">{c.score?.toFixed(0) ?? '?'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ DETALHES (colapsável) ═══ */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="w-full flex items-center justify-center gap-1.5 px-4 py-2 border-t border-border/15 hover:bg-secondary/20 transition-colors"
        >
          <Sparkles className="w-3 h-3 text-muted-foreground" />
          <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider">
            {showDetails ? 'Ocultar' : 'Ver'} Detalhes ({aiLearnings.length} insights)
          </span>
          <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${showDetails ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
          {showDetails && aiLearnings.length > 0 && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="px-4 pb-3 space-y-1">
                {aiLearnings.slice(0, 8).map((learning: string, i: number) => (
                  <div key={i} className="flex items-start gap-1.5 px-2 py-1.5 rounded-lg bg-secondary/30 border border-border/20">
                    <span className="text-[9px] text-foreground/80 leading-tight">{learning}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </motion.div>
  );
});

SniperSignal.displayName = 'SniperSignal';
export default SniperSignal;
