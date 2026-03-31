import { useState, useEffect, useRef, memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crosshair, AlertTriangle, Clock, ShieldCheck, Zap, Brain, TrendingUp, BookOpen, Target, Layers, GraduationCap, Sparkles, BarChart3, Radar, ChevronDown, Activity } from 'lucide-react';

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

const numColor = (n: number) =>
  n === 0 ? 'bg-emerald-600 text-white' : RED_NUMBERS.has(n) ? 'bg-red-600 text-white' : 'bg-zinc-800 text-white';

const getActionLevel = (prob: number) => {
  if (prob >= 85) return { label: '🔥 ENTRAR FORTE', color: 'text-neon-green', borderClass: 'border-neon-green/50', bg: 'bg-neon-green/5' };
  if (prob >= 65) return { label: '✅ ENTRAR', color: 'text-primary', borderClass: 'border-primary/40', bg: 'bg-primary/5' };
  if (prob >= 45) return { label: '⚠️ SINAL MODERADO', color: 'text-yellow-400', borderClass: 'border-yellow-400/30', bg: 'bg-yellow-400/5' };
  return { label: '⏸ AGUARDAR', color: 'text-muted-foreground', borderClass: 'border-border', bg: 'bg-secondary/5' };
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
}

const ANALYSIS_TYPES = [
  { value: 'all', emoji: '🧠', label: 'Auto (Melhor)' },
  { value: 'terminal', emoji: '🔢', label: 'Terminal' },
  { value: 'vizinhos', emoji: '🎯', label: 'Vizinhos' },
  { value: 'setor', emoji: '🌍', label: 'Setor' },
  { value: 'duzia', emoji: '📊', label: 'Dúzia' },
  { value: 'coluna', emoji: '📐', label: 'Coluna' },
  { value: 'pleno', emoji: '💎', label: 'Pleno' },
  { value: 'cavalos', emoji: '🐴', label: 'Cavalos' },
  { value: 'cor', emoji: '🎨', label: 'Cor' },
  { value: 'paridade', emoji: '⚖️', label: 'Par/Ímpar' },
  { value: 'alto_baixo', emoji: '📏', label: 'Alto/Baixo' },
  { value: 'rua', emoji: '🛤️', label: 'Rua' },
  { value: 'carre', emoji: '🔲', label: 'Quadra' },
  { value: 'orphelins', emoji: '🌀', label: 'Orphelins' },
  { value: 'tiers', emoji: '🎪', label: 'Tiers' },
  { value: 'voisins', emoji: '🎡', label: 'Voisins' },
  { value: 'jeu_zero', emoji: '🟢', label: 'Jeu Zéro' },
  { value: 'combinado', emoji: '🧬', label: 'Combinado' },
];

const SubSection = memo(({ title, icon: Icon, color, children, defaultOpen = false }: {
  title: string; icon: any; color: string; children: React.ReactNode; defaultOpen?: boolean;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-border/20">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 px-5 py-2.5 hover:bg-secondary/20 transition-colors">
        <Icon className={`w-3.5 h-3.5 ${color}`} />
        <span className={`text-[9px] font-black uppercase tracking-wider ${color}`}>{title}</span>
        <ChevronDown className={`w-3 h-3 text-muted-foreground ml-auto transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-5 pb-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

const SniperSignal = memo(({ sniperData, sniperStale, lastPredResult, allNumbers = [], autoLearnStatus }: Props) => {
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
  const learnedInfluence = sniperData?.learnedBetInfluence || [];
  const aiLearnings: string[] = sniperData?.aiLearnings || [];
  const trendEngine = sniperData?.trendEngine;
  const memoryWindows = sniperData?.memoryWindows;
  const layerResults = sniperData?.layerResults;
  const pullPatterns = sniperData?.pullPatterns || [];
  const topCandidates = sniperData?.topCandidates || [];

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

        {/* ═══ ① JOGADA SUGERIDA — Hero ═══ */}
        <div className="p-5 pb-3">
          <div className="flex items-center gap-2 mb-3">
            <Crosshair className="w-4 h-4 text-primary" />
            <span className="text-[10px] font-black text-primary uppercase tracking-widest">Jogada Sugerida</span>
            {betTypeInfo && (
              <span className="text-[8px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {betTypeInfo.emoji} {betTypeInfo.label}
              </span>
            )}
            {autoLearnStatus && autoLearnStatus !== 'idle' && (
              <span className="text-[7px] px-1.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-bold ml-auto animate-pulse">
                {autoLearnStatus === 'learning' ? '🧠' : autoLearnStatus === 'analyzing' ? '🔍' : '📊'}
              </span>
            )}
          </div>

          {ai?.betDescription && (
            <p className="text-xs font-bold text-primary/80 mb-1.5 leading-snug">{ai.betDescription}</p>
          )}
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

          {/* Secondary bet */}
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

        {/* ═══ ② ASSERTIVIDADE ═══ */}
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

        {/* ═══ ③ MELHOR MERCADO ═══ */}
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

        {/* ═══ ④ PADRÃO IDENTIFICADO ═══ */}
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

        {/* ═══ ⑤ TOP CANDIDATOS (mini ensemble) ═══ */}
        {topCandidates.length > 1 && (
          <SubSection title="Top Candidatos" icon={Crosshair} color="text-amber-400" defaultOpen>
            <div className="flex flex-wrap gap-2">
              {topCandidates.slice(0, 8).map((c: any, i: number) => (
                <div key={c.num} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-secondary/40 border border-border/50">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black ${numColor(c.num)} ${i === 0 ? 'ring-2 ring-amber-400' : 'ring-1 ring-white/10'}`}>{c.num}</div>
                  <div className="text-[8px]">
                    <span className="font-bold text-foreground">{c.score?.toFixed(0) ?? '?'}pts</span>
                    {c.reasons && <span className="text-muted-foreground ml-1">({c.reasons.length})</span>}
                  </div>
                </div>
              ))}
            </div>
          </SubSection>
        )}

        {/* ═══ ⑥ APRENDIZADO APLICADO ═══ */}
        {learnedInfluence.length > 0 && (
          <SubSection title={`Aprendizado Aplicado (${learnedInfluence.length})`} icon={GraduationCap} color="text-emerald-400" defaultOpen>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {learnedInfluence.slice(0, 6).map((inf: any, i: number) => (
                <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-secondary/40 border border-border">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black shrink-0 ${numColor(inf.num)}`}>{inf.num}</div>
                  <div className="min-w-0">
                    <span className="text-[8px] text-emerald-300 font-bold block truncate">{inf.source}</span>
                    <span className="text-[7px] text-muted-foreground">+{inf.boost}pts</span>
                  </div>
                </div>
              ))}
            </div>
          </SubSection>
        )}

        {/* ═══ ⑦ TREND ENGINE ═══ */}
        {trendEngine && trendEngine.mode !== 'NEUTRO' && (
          <SubSection title={`Trend Engine — ${trendEngine.mode}`} icon={Activity} color={trendEngine.mode === 'TENDENCIA' ? 'text-green-400' : 'text-orange-400'}>
            <div className="space-y-1.5">
              {trendEngine.colorTrend?.direction && (
                <div className="text-[10px] text-foreground/80">
                  🎨 Cor: <strong className={trendEngine.colorTrend.direction === 'red' ? 'text-red-400' : 'text-foreground'}>{trendEngine.colorTrend.direction}</strong> ({trendEngine.colorTrend.strength}%)
                </div>
              )}
              {trendEngine.dozenTrend?.direction && (
                <div className="text-[10px] text-foreground/80">🎲 Dúzia: <strong>D{trendEngine.dozenTrend.direction}</strong> ({trendEngine.dozenTrend.strength}%)</div>
              )}
              {trendEngine.sectorTrend?.direction && (
                <div className="text-[10px] text-foreground/80">🗺️ Setor: <strong>{trendEngine.sectorTrend.direction}</strong> ({trendEngine.sectorTrend.strength}%)</div>
              )}
              {trendEngine.reasoning?.slice(0, 3).map((r: string, i: number) => (
                <div key={i} className="text-[9px] text-muted-foreground">{r}</div>
              ))}
            </div>
          </SubSection>
        )}

        {/* ═══ ⑧ ANÁLISE IA (todos os insights) ═══ */}
        {aiLearnings.length > 0 && (
          <SubSection title={`Análise IA (${aiLearnings.length} insights)`} icon={Brain} color="text-purple-400">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {aiLearnings.slice(0, 12).map((learning: string, i: number) => (
                <div key={i} className="flex items-start gap-1.5 px-2 py-1.5 rounded-lg bg-secondary/40 border border-border">
                  <Sparkles className="w-3 h-3 text-purple-400 mt-0.5 shrink-0" />
                  <span className="text-[9px] text-foreground/90 leading-tight">{learning}</span>
                </div>
              ))}
            </div>
          </SubSection>
        )}

        {/* ═══ ⑨ MEMÓRIA MULTI-JANELA ═══ */}
        {memoryWindows && (
          <SubSection title="Memória Multi-Janela" icon={BarChart3} color="text-blue-400">
            <div className="grid grid-cols-3 gap-2">
              {memoryWindows.micro && (
                <div className="rounded-lg bg-secondary/40 border border-border p-2">
                  <span className="text-[8px] font-black text-blue-400 block mb-1">MICRO (10)</span>
                  <div className="text-[9px] text-foreground/80 space-y-0.5">
                    <div>Arco: {memoryWindows.micro.arcMean}±{memoryWindows.micro.arcStd}</div>
                    <div>Dealer: {memoryWindows.micro.dealerRhythm}</div>
                    <div>{memoryWindows.micro.colorBias}</div>
                  </div>
                </div>
              )}
              {memoryWindows.mesa && (
                <div className="rounded-lg bg-secondary/40 border border-border p-2">
                  <span className="text-[8px] font-black text-blue-400 block mb-1">MESA (100)</span>
                  <div className="text-[9px] text-foreground/80 space-y-0.5">
                    <div>WR: {memoryWindows.mesa.winRate}%</div>
                    <div>{memoryWindows.mesa.bestStrategy}</div>
                    <div>{memoryWindows.mesa.totalPredictions} previsões</div>
                  </div>
                </div>
              )}
              {memoryWindows.macro && (
                <div className="rounded-lg bg-secondary/40 border border-border p-2">
                  <span className="text-[8px] font-black text-blue-400 block mb-1">MACRO (500)</span>
                  <div className="text-[9px] text-foreground/80 space-y-0.5">
                    <div>{memoryWindows.macro.totalNumbers} nums</div>
                    <div>{memoryWindows.macro.uniqueNumbers} únicos</div>
                    {memoryWindows.macro.topDebt?.length > 0 && (
                      <div>Dívida: {memoryWindows.macro.topDebt.slice(0, 3).join(', ')}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </SubSection>
        )}

        {/* ═══ ⑩ PULL RADAR ═══ */}
        {pullPatterns.length > 0 && (
          <SubSection title="Radar de Puxadas" icon={Radar} color="text-orange-400">
            <div className="space-y-1.5">
              {pullPatterns.slice(0, 4).map((p: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-[10px]">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black ${numColor(p.source)}`}>{p.source}</div>
                  <span className="text-muted-foreground">→</span>
                  <div className="flex gap-1 flex-wrap">
                    {(p.targets || []).slice(0, 5).map((t: any) => (
                      <span key={t.num} className="px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-300 border border-orange-500/20 font-bold text-[8px]">
                        {t.num} ({t.count}x)
                      </span>
                    ))}
                  </div>
                  <span className="text-[8px] text-muted-foreground ml-auto">{p.dominantSector}</span>
                </div>
              ))}
            </div>
          </SubSection>
        )}

        {/* ═══ ⑪ SCANNER 1700 CAMADAS ═══ */}
        {layerResults && (
          <SubSection title={`Scanner ${layerResults.total || 0}/1700 Camadas`} icon={BarChart3} color="text-indigo-400">
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
              {Object.entries(layerResults).filter(([k]) => k !== 'total').map(([block, val]: [string, any]) => {
                const pct = typeof val === 'object' ? (val.score / val.max * 100) : (typeof val === 'number' ? val : 0);
                return (
                  <div key={block} className="text-center">
                    <div className="h-8 bg-secondary/30 rounded overflow-hidden flex flex-col justify-end">
                      <div className={`rounded-t transition-all ${pct > 70 ? 'bg-primary' : pct > 40 ? 'bg-yellow-400/60' : 'bg-muted-foreground/30'}`}
                        style={{ height: `${Math.min(100, pct)}%` }} />
                    </div>
                    <span className="text-[7px] font-bold text-foreground mt-0.5 block">{block}</span>
                  </div>
                );
              })}
            </div>
          </SubSection>
        )}

        {/* ═══ ⑫ O QUE APRENDI ═══ */}
        {ai?.learned && (
          <div className="px-5 py-3 border-t border-border/20 bg-amber-500/5">
            <div className="flex items-center gap-2 mb-1.5">
              <BookOpen className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[9px] font-black text-amber-400 uppercase tracking-wider">O que Aprendi</span>
            </div>
            <p className="text-[11px] text-amber-200/70 leading-relaxed">{ai.learned}</p>
          </div>
        )}

      </div>
    </motion.div>
  );
});

SniperSignal.displayName = 'SniperSignal';
export default SniperSignal;
