import { useState, useEffect, useRef, memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crosshair, AlertTriangle, Clock, ShieldCheck, Brain, TrendingUp, Zap, Target, Shield, ChevronDown, ChevronUp } from 'lucide-react';

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

const numColor = (n: number) =>
  n === 0 ? 'bg-roulette-green text-white' : RED_NUMBERS.has(n) ? 'bg-roulette-red text-white' : 'bg-roulette-black text-white';

const numGradient = (n: number) =>
  n === 0 ? 'from-emerald-500 to-emerald-700' : RED_NUMBERS.has(n) ? 'from-red-500 to-red-700' : 'from-zinc-600 to-zinc-900';

const getConfidenceStyle = (conf: number) => {
  if (conf >= 70) return { border: 'border-neon-green/40', bg: 'bg-neon-green/8', text: 'text-neon-green', glow: 'shadow-[0_0_12px_hsl(var(--neon-green)/0.15)]', label: 'FORTE', emoji: '🔥' };
  if (conf >= 55) return { border: 'border-primary/40', bg: 'bg-primary/8', text: 'text-primary', glow: '', label: 'ENTRAR', emoji: '✅' };
  if (conf >= 40) return { border: 'border-gold/30', bg: 'bg-gold/8', text: 'text-gold', glow: '', label: 'LEVE', emoji: '⚡' };
  return { border: 'border-border/30', bg: 'bg-secondary/10', text: 'text-muted-foreground', glow: '', label: 'OBSERVAR', emoji: '👁️' };
};

const BET_ORDER = ['cor', 'paridade', 'alto_baixo', 'duzia', 'coluna', 'terminal', 'setor', 'vizinhos', 'cavalos', 'rua', 'pleno'] as const;

const BET_TYPE_META: Record<string, { icon: string; label: string; category: 'simples' | 'medio' | 'avancado' }> = {
  cor: { icon: '🎨', label: 'Cor', category: 'simples' },
  paridade: { icon: '⚖️', label: 'Par/Ímpar', category: 'simples' },
  alto_baixo: { icon: '📏', label: 'Alto/Baixo', category: 'simples' },
  duzia: { icon: '🎲', label: 'Dúzia', category: 'medio' },
  coluna: { icon: '📐', label: 'Coluna', category: 'medio' },
  terminal: { icon: '🔢', label: 'Terminal', category: 'medio' },
  setor: { icon: '🌍', label: 'Setor', category: 'avancado' },
  vizinhos: { icon: '🎯', label: 'Vizinhos', category: 'avancado' },
  cavalos: { icon: '🐴', label: 'Cavalos', category: 'avancado' },
  rua: { icon: '🛤️', label: 'Rua', category: 'avancado' },
  pleno: { icon: '💎', label: 'Pleno', category: 'avancado' },
};

interface BetSignal {
  recommendation: string;
  numbers: number[];
  confidence: number;
  reasoning: string;
  emoji: string;
  payout: string;
}

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

const SignalCard = memo(({ type, signal, delay }: { type: string; signal: BetSignal; delay: number }) => {
  const [expanded, setExpanded] = useState(false);
  const meta = BET_TYPE_META[type] || { icon: '🎯', label: type, category: 'avancado' as const };
  const style = getConfidenceStyle(signal.confidence);
  const isSimple = meta.category === 'simples';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay * 0.04 }}
      className={`glass rounded-xl border ${style.border} ${style.glow} overflow-hidden transition-all`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left"
      >
        <span className="text-lg">{signal.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-[11px] font-black tracking-wide ${style.text}`}>
              {signal.recommendation}
            </span>
          </div>
          <span className="text-[8px] text-muted-foreground/50 font-mono">{meta.label} · {signal.payout}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${style.border} ${style.bg} ${style.text}`}>
            {signal.confidence}%
          </span>
          <span className={`text-[8px] font-black ${style.text}`}>{style.emoji}</span>
          {!isSimple && (
            expanded ? <ChevronUp className="w-3 h-3 text-muted-foreground/40" /> : <ChevronDown className="w-3 h-3 text-muted-foreground/40" />
          )}
        </div>
      </button>

      <AnimatePresence>
        {(expanded || isSimple) && signal.numbers.length > 0 && !isSimple && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-2.5 space-y-1.5">
              <p className="text-[8px] text-muted-foreground/60 leading-relaxed">{signal.reasoning}</p>
              <div className="flex flex-wrap gap-1">
                {signal.numbers.slice(0, 12).map((n, i) => (
                  <span key={`${n}-${i}`}
                    className={`w-6 h-6 rounded-md flex items-center justify-center text-[8px] font-black text-white ${
                      n === 0 ? 'bg-emerald-600' : RED_NUMBERS.has(n) ? 'bg-red-600' : 'bg-zinc-700'
                    } ${i === 0 ? 'ring-1 ring-primary/50' : ''}`}
                  >
                    {n}
                  </span>
                ))}
                {signal.numbers.length > 12 && (
                  <span className="w-6 h-6 rounded-md flex items-center justify-center text-[7px] font-bold glass text-muted-foreground border border-border/30">
                    +{signal.numbers.length - 12}
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});
SignalCard.displayName = 'SignalCard';

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

  const recentWR = typeof sniperData?.recentWinRate === 'number' ? Math.round(sniperData.recentWinRate * 100) : null;

  // ── KILL SWITCH from Omni-Core ───
  if (sniperData?.killSwitch) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-3">
        <div className="glass rounded-2xl p-6 text-center border-2 border-destructive/25 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-destructive/[0.03] to-transparent" />
          <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 3 }} className="text-5xl mb-3 inline-block">🛡️</motion.div>
          <p className="text-sm font-black text-destructive font-display tracking-[0.15em] mb-2">PROTEÇÃO DE BANCA</p>
          <p className="text-[10px] text-muted-foreground/60 leading-relaxed max-w-xs mx-auto">{sniperData.killReason || 'Anomalia detectada — sinais suspensos temporariamente'}</p>
        </div>
      </motion.div>
    );
  }

  // Loading state
  if (!sniperData) {
    return (
      <div className="glass rounded-2xl border border-primary/15 p-5 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] via-transparent to-neon-pink/[0.02]" />
        <div className="relative flex items-center gap-3">
          <div className="relative w-10 h-10 shrink-0">
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-t-primary border-r-neon-pink/50 border-b-transparent border-l-transparent"
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
            />
            <Crosshair className="w-4 h-4 text-primary/50 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <div>
            <p className="text-[10px] text-foreground/60 font-display tracking-[0.12em] font-bold">INICIALIZANDO IA</p>
            <p className="text-[7px] text-muted-foreground/30 font-mono mt-0.5">Processando modelos de predição...</p>
          </div>
        </div>
      </div>
    );
  }

  // Stale — show last result
  if (sniperStale && lastPredResult && !sniperData?.signal) {
    const isHit = lastPredResult.hit;
    return (
      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
        className={`glass rounded-2xl border-2 overflow-hidden relative ${isHit ? 'border-neon-green/25' : 'border-destructive/25'}`}>
        <div className="relative p-5 flex items-center gap-4">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}
            className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isHit ? 'bg-neon-green/10 ring-2 ring-neon-green/25' : 'bg-destructive/10 ring-2 ring-destructive/25'}`}>
            {isHit ? <ShieldCheck className="w-7 h-7 text-neon-green" /> : <AlertTriangle className="w-7 h-7 text-destructive" />}
          </motion.div>
          <div>
            <span className={`text-lg font-black font-display tracking-[0.12em] ${isHit ? 'text-neon-green' : 'text-destructive'}`}>
              {isHit ? '✅ ACERTO!' : '❌ ERRO'}
            </span>
            <div className="flex gap-4 text-xs text-muted-foreground mt-1 font-mono">
              <span>Previsto: <strong className="text-foreground">{lastPredResult.predicted}</strong></span>
              <span>Saiu: <strong className="text-foreground">{lastPredResult.actual}</strong></span>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // No signal
  if (!sniperData?.signal || !sniperData?.strategy) {
    return (
      <div className="glass rounded-2xl border border-border/20 p-8 text-center">
        <motion.div animate={{ opacity: [0.3, 0.8, 0.3], y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 3 }}>
          <Clock className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
        </motion.div>
        <p className="text-[11px] text-muted-foreground/50 font-display tracking-wider font-bold">
          {sniperData?.message || 'Aguardando dados...'}
        </p>
      </div>
    );
  }

  const allBetSignals: Record<string, BetSignal> = sniperData?.allBetSignals || {};
  const displayProb = sniperData?.signal?.probability || 0;
  const ai = sniperData?.aiReasoning;
  const conciseReason = ai?.suggestedBet || ai?.betDescription || ai?.patternIdentified || 'Sinais prontos para o próximo giro';

  // Sort signals by confidence
  const sortedSignals = BET_ORDER
    .filter(type => allBetSignals[type])
    .sort((a, b) => (allBetSignals[b]?.confidence || 0) - (allBetSignals[a]?.confidence || 0));

  // Best signal
  const bestType = sortedSignals[0];
  const bestSignal = bestType ? allBetSignals[bestType] : null;

  // Group: simples (1:1), medio (2:1), avancado
  const simples = sortedSignals.filter(t => BET_TYPE_META[t]?.category === 'simples');
  const medio = sortedSignals.filter(t => BET_TYPE_META[t]?.category === 'medio');
  const avancado = sortedSignals.filter(t => BET_TYPE_META[t]?.category === 'avancado');

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      {/* REED STOP */}
      {reedStopped && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="glass border-2 border-destructive/30 rounded-2xl px-4 py-3 text-center">
          <span className="text-xs font-black text-destructive font-display tracking-wider">⛔ PAUSE — 4 erros seguidos</span>
          <p className="text-[9px] text-muted-foreground mt-1">Aguarde nova tendência</p>
        </motion.div>
      )}

      <div className={reedStopped ? 'opacity-30 pointer-events-none space-y-3' : 'space-y-3'}>
        {/* ── HEADER: AI Brain ─────────────────────────── */}
        <div className="glass rounded-2xl border border-primary/25 p-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20">
              <Brain className="w-3.5 h-3.5 text-primary" />
              <span className="text-[9px] font-black uppercase tracking-[0.12em] text-primary font-display">PRÓXIMO GIRO</span>
            </div>
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
              className={`px-2.5 py-1 rounded-full border font-display font-black text-[10px] ${
                displayProb >= 70 ? 'bg-neon-green/10 text-neon-green border-neon-green/30' :
                displayProb >= 50 ? 'bg-primary/10 text-primary border-primary/25' :
                'bg-secondary text-muted-foreground border-border'
              }`}>{displayProb}%</motion.div>
            {recentWR !== null && (
              <span className="text-[9px] font-bold text-foreground/60 font-mono ml-auto flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-primary" /> WR {recentWR}%
              </span>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground leading-relaxed mt-2 pl-1 line-clamp-2">{conciseReason}</p>
        </div>

        {/* ── BEST SIGNAL HIGHLIGHT ────────────────────── */}
        {bestSignal && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass rounded-2xl border-2 border-primary/30 p-4 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] to-transparent" />
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
            <div className="relative">
              <div className="flex items-center gap-1 mb-2">
                <Target className="w-3.5 h-3.5 text-primary" />
                <span className="text-[8px] font-black text-primary uppercase tracking-[0.2em] font-display">MELHOR SINAL</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-4xl">{bestSignal.emoji}</span>
                <div className="flex-1">
                  <p className="text-xl font-black text-foreground leading-none font-display tracking-wide">{bestSignal.recommendation}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{bestSignal.reasoning}</p>
                </div>
                <div className={`text-[13px] font-black px-3 py-1.5 rounded-xl border ${getConfidenceStyle(bestSignal.confidence).border} ${getConfidenceStyle(bestSignal.confidence).bg} ${getConfidenceStyle(bestSignal.confidence).text}`}>
                  {bestSignal.confidence}%
                </div>
              </div>
              {bestSignal.numbers.length > 0 && bestSignal.numbers.length <= 12 && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {bestSignal.numbers.slice(0, 12).map((n, i) => (
                    <span key={`best-${n}-${i}`}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-[9px] font-black text-white ${
                        n === 0 ? 'bg-emerald-600' : RED_NUMBERS.has(n) ? 'bg-red-600' : 'bg-zinc-700'
                      } ${i === 0 ? 'ring-1 ring-primary/50' : ''}`}>{n}</span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2 mt-2.5">
                <span className="text-[8px] text-muted-foreground/50 font-mono">Paga {bestSignal.payout}</span>
                <span className="text-[8px] text-muted-foreground/50 font-mono">·</span>
                <span className="text-[8px] text-muted-foreground/50 font-mono">{BET_TYPE_META[bestType]?.label}</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── SIMPLE BETS (1:1) ────────────────────────── */}
        {simples.length > 0 && (
          <div>
            <span className="text-[8px] font-black text-muted-foreground/50 uppercase tracking-[0.2em] px-1 font-display">Apostas Simples · 1:1</span>
            <div className="grid grid-cols-1 gap-1.5 mt-1.5">
              {simples.map((type, i) => (
                <SignalCard key={type} type={type} signal={allBetSignals[type]} delay={i} />
              ))}
            </div>
          </div>
        )}

        {/* ── MEDIUM BETS (2:1+) ───────────────────────── */}
        {medio.length > 0 && (
          <div>
            <span className="text-[8px] font-black text-muted-foreground/50 uppercase tracking-[0.2em] px-1 font-display">Dúzias · Colunas · Terminais</span>
            <div className="grid grid-cols-1 gap-1.5 mt-1.5">
              {medio.map((type, i) => (
                <SignalCard key={type} type={type} signal={allBetSignals[type]} delay={simples.length + i} />
              ))}
            </div>
          </div>
        )}

        {/* ── ADVANCED BETS ────────────────────────────── */}
        {avancado.length > 0 && (
          <div>
            <span className="text-[8px] font-black text-muted-foreground/50 uppercase tracking-[0.2em] px-1 font-display">Setores · Vizinhos · Plenos</span>
            <div className="grid grid-cols-1 gap-1.5 mt-1.5">
              {avancado.map((type, i) => (
                <SignalCard key={type} type={type} signal={allBetSignals[type]} delay={simples.length + medio.length + i} />
              ))}
            </div>
          </div>
        )}

        {/* ── OMNI-CORE AGENTS ─────────────────────────── */}
        {sniperData?.agents && sniperData?.omniCore && (
          <div className="glass rounded-xl border border-border/30 overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border/15">
              <span className="text-[8px] font-black text-muted-foreground uppercase tracking-[0.2em] font-display">⚙️ OMNI-CORE</span>
              {sniperData.temperature && (
                <span className={`ml-auto text-[8px] font-bold px-2 py-0.5 rounded-full border ${
                  sniperData.temperature === 'quente' ? 'bg-neon-green/10 text-neon-green border-neon-green/25' :
                  sniperData.temperature === 'morna' ? 'bg-primary/10 text-primary border-primary/25' :
                  'bg-destructive/10 text-destructive border-destructive/25'
                }`}>🌡️ {sniperData.temperature.toUpperCase()}</span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-px bg-border/10">
              {Object.entries(sniperData.agents as Record<string, any>).map(([id, agent]: [string, any]) => (
                <div key={id} className="p-2.5 text-center bg-card/60">
                  <div className="text-[7px] font-black text-muted-foreground uppercase tracking-wider font-mono">
                    {id === 'statistical' ? '📊 ESTAT' : id === 'ballistic' ? '🎯 BALÍST' : '🔄 REVERS'}
                  </div>
                  <div className="text-[12px] font-black font-mono text-foreground/70 mt-0.5">{agent.winRate}</div>
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
