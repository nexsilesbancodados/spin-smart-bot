import { useState, useEffect, useRef, memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Crosshair, AlertTriangle, Clock, ShieldCheck, Zap, Brain, TrendingUp, BookOpen, Target, Layers } from 'lucide-react';

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

const numColor = (n: number) =>
  n === 0 ? 'bg-emerald-600 text-white' : RED_NUMBERS.has(n) ? 'bg-red-600 text-white' : 'bg-zinc-800 text-white';

const getActionLevel = (prob: number) => {
  if (prob >= 85) return { label: '🔥 ENTRAR FORTE', color: 'text-neon-green', borderClass: 'border-neon-green/50' };
  if (prob >= 65) return { label: '✅ ENTRAR', color: 'text-primary', borderClass: 'border-primary/40' };
  if (prob >= 45) return { label: '⚠️ SINAL MODERADO', color: 'text-yellow-400', borderClass: 'border-yellow-400/30' };
  return { label: '⏸ AGUARDAR', color: 'text-muted-foreground', borderClass: 'border-border' };
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
}

const SniperSignal = memo(({ sniperData, sniperStale, lastPredResult, allNumbers = [] }: Props) => {
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
      <div className="bg-card rounded-2xl border border-border p-12 flex items-center justify-center">
        <div className="text-center">
          <Crosshair className="w-8 h-8 text-primary/30 mx-auto mb-3 animate-pulse" />
          <p className="text-sm text-muted-foreground">Carregando IA...</p>
        </div>
      </div>
    );
  }

  // Stale — show last result
  if (sniperStale && lastPredResult) {
    return (
      <div className="bg-card rounded-2xl border border-border p-6">
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center border-2 ${
            lastPredResult.hit ? 'bg-green-500/15 border-green-500/40' : 'bg-destructive/15 border-destructive/40'
          }`}>
            {lastPredResult.hit
              ? <ShieldCheck className="w-7 h-7 text-green-400" />
              : <AlertTriangle className="w-7 h-7 text-destructive" />}
          </div>
          <div>
            <span className={`text-lg font-black ${lastPredResult.hit ? 'text-green-400' : 'text-destructive'}`}>
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
        <p className="text-[10px] text-muted-foreground/50 mt-3 text-center">⏳ Aguardando próximo giro...</p>
      </div>
    );
  }

  // No signal
  if (!sniperData?.signal || !sniperData?.strategy) {
    return (
      <div className="bg-card rounded-2xl border border-border p-8 text-center">
        <Clock className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">{sniperData?.message || 'Aguardando dados...'}</p>
      </div>
    );
  }

  const action = getActionLevel(displayProb);
  const ai = sniperData?.aiReasoning;
  const lastNumber = allNumbers?.[0];
  const betTypeInfo = ai?.betType ? BET_TYPE_LABELS[ai.betType] || { emoji: '🎯', label: ai.betType } : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border-2 overflow-hidden shadow-xl bg-card ${action.borderClass}`}
    >
      {/* REED STOP */}
      {reedStopped && (
        <div className="bg-destructive/10 border-b border-destructive/30 p-3 text-center">
          <span className="text-xs font-black text-destructive">⛔ PAUSE — 4 erros seguidos</span>
        </div>
      )}

      <div className={reedStopped ? 'opacity-30 pointer-events-none' : ''}>

        {/* ═══ PROTOCOLO EXPANDIDO ═══ */}

        {/* ① JOGADA SUGERIDA — Hero section */}
        <div className="p-5 pb-3">
          <div className="flex items-center gap-2 mb-3">
            <Crosshair className="w-4 h-4 text-primary" />
            <span className="text-[10px] font-black text-primary uppercase tracking-widest">Jogada Sugerida</span>
            {betTypeInfo && (
              <span className="text-[8px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {betTypeInfo.emoji} {betTypeInfo.label}
              </span>
            )}
            {ai?.feedbackAction && (
              <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full ml-auto ${
                ai.feedbackAction === 'reforçar' ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                : ai.feedbackAction === 'descartar' ? 'bg-destructive/10 text-destructive border border-destructive/20'
                : 'bg-yellow-400/10 text-yellow-400 border border-yellow-400/20'
              }`}>
                {ai.feedbackAction === 'reforçar' ? '✅ Reforçado' : ai.feedbackAction === 'descartar' ? '🔄 Descartado' : '⚙️ Ajustando'}
              </span>
            )}
          </div>

          {/* Bet description (full) */}
          {ai?.betDescription && (
            <p className="text-xs font-bold text-primary/80 mb-1.5 leading-snug">{ai.betDescription}</p>
          )}

          {/* Suggested bet text */}
          {ai?.suggestedBet && (
            <p className="text-sm font-bold text-foreground mb-3 leading-snug">{ai.suggestedBet}</p>
          )}

          {/* Hero number + confidence */}
          <div className="flex items-center gap-5 mb-3">
            <div className="relative shrink-0">
              <motion.div
                animate={displayProb >= 85 ? { scale: [1, 1.05, 1] } : {}}
                transition={{ duration: 1.5, repeat: Infinity }}
                className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl font-black shadow-2xl ring-4 ${numColor(ensTop1)} ${
                  displayProb >= 85 ? 'ring-neon-green/60 shadow-neon-green/30' : 'ring-primary/30'
                }`}
              >
                {ensTop1}
              </motion.div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Zap className={`w-4 h-4 ${action.color}`} />
                <span className={`text-sm font-black ${action.color}`}>{action.label}</span>
              </div>

              {/* Numbers to bet */}
              <div className="flex flex-wrap gap-1.5">
                {finalNumbers.map((n: number, i: number) => {
                  const isMain = i === 0 || n === ensTop1;
                  return (
                    <motion.div
                      key={n}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className={`flex items-center justify-center rounded-full font-black shadow-md
                        ${isMain ? 'w-10 h-10 text-xs ring-2' : 'w-8 h-8 text-[10px] ring-1'}
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

          {/* Secondary bet suggestion */}
          {ai?.secondaryBet && (
            <div className="mt-2 px-3 py-2 rounded-lg bg-secondary/40 border border-border/40">
              <div className="flex items-center gap-1.5">
                <Target className="w-3 h-3 text-muted-foreground" />
                <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider">Proteção</span>
              </div>
              <p className="text-[10px] text-foreground/70 mt-1">{ai.secondaryBet}</p>
            </div>
          )}
        </div>

        {/* ② ANÁLISE DE MERCADO */}
        {ai?.marketAnalysis?.bestMarket && (
          <div className="px-5 py-3 border-t border-border/20 bg-primary/5">
            <div className="flex items-center gap-2 mb-1.5">
              <Layers className="w-3.5 h-3.5 text-primary" />
              <span className="text-[9px] font-black text-primary uppercase tracking-wider">Melhor Mercado</span>
              <span className="text-[8px] px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/25 font-bold ml-auto">
                {ai.marketAnalysis.marketConfidence}%
              </span>
            </div>
            <p className="text-[11px] font-bold text-foreground/90">{ai.marketAnalysis.bestMarket}</p>
            {ai.marketAnalysis.reasoning && (
              <p className="text-[10px] text-muted-foreground mt-1">{ai.marketAnalysis.reasoning}</p>
            )}
          </div>
        )}

        {/* ③ PADRÃO IDENTIFICADO */}
        {ai?.patternIdentified && (
          <div className="px-5 py-3 border-t border-border/20 bg-cyan-500/5">
            <div className="flex items-center gap-2 mb-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-[9px] font-black text-cyan-400 uppercase tracking-wider">Padrão Identificado</span>
              {ai.sectorFocus && ai.sectorFocus !== 'misto' && (
                <span className="text-[8px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-bold ml-auto">
                  {ai.sectorFocus}
                </span>
              )}
            </div>
            <p className="text-[11px] text-foreground/80 leading-relaxed">{ai.patternIdentified}</p>
          </div>
        )}

        {/* ④ O QUE APRENDI */}
        {ai?.learned && (
          <div className="px-5 py-3 border-t border-border/20 bg-amber-500/5">
            <div className="flex items-center gap-2 mb-1.5">
              <BookOpen className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[9px] font-black text-amber-400 uppercase tracking-wider">O que Aprendi</span>
            </div>
            <p className="text-[11px] text-amber-200/70 leading-relaxed">{ai.learned}</p>
          </div>
        )}

        {/* ⑤ ASSERTIVIDADE */}
        <div className="px-5 py-3 border-t border-border/20 bg-secondary/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="w-3.5 h-3.5 text-primary" />
              <span className="text-[9px] font-black text-muted-foreground uppercase tracking-wider">Assertividade</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-24 h-2 bg-secondary rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${displayProb}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className={`h-full rounded-full ${
                    displayProb >= 85 ? 'bg-neon-green' : displayProb >= 65 ? 'bg-primary' : displayProb >= 45 ? 'bg-yellow-400' : 'bg-muted-foreground'
                  }`}
                />
              </div>
              <span className={`text-2xl font-black font-mono ${action.color}`}>{displayProb}%</span>
            </div>
          </div>
          <p className="text-[9px] text-muted-foreground/60 mt-1">
            {finalNumbers.length} números • paga {Math.max(1, 36 - finalNumbers.length)}x
            {lastNumber !== undefined && ` • último: ${lastNumber}`}
          </p>
        </div>

      </div>
    </motion.div>
  );
});

SniperSignal.displayName = 'SniperSignal';
export default SniperSignal;
