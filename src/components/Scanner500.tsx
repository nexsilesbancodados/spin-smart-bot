import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crosshair, Shield, Zap, Brain, Activity, CheckCircle2, Sparkles, Target } from 'lucide-react';

interface LayerResults {
  blocoA: { score: number; max: number; label: string };
  blocoB: { score: number; max: number; label: string };
  blocoC: { score: number; max: number; label: string };
  blocoD: { score: number; max: number; label: string };
  blocoE: { score: number; max: number; label: string };
  total: number;
  max: number;
}

interface Scanner500Props {
  layerResults: LayerResults | null;
  isScanning: boolean;
}

const BLOCO_CONFIG = [
  { key: 'blocoA', icon: Activity, label: 'Frequência', color: 'text-purple-400', bg: 'bg-purple-500', glow: 'purple' },
  { key: 'blocoB', icon: Zap, label: 'Transição', color: 'text-blue-400', bg: 'bg-blue-500', glow: 'blue' },
  { key: 'blocoC', icon: Shield, label: 'Setores', color: 'text-neon-cyan', bg: 'bg-primary', glow: 'cyan' },
  { key: 'blocoD', icon: Brain, label: 'IA', color: 'text-amber-400', bg: 'bg-amber-500', glow: 'amber' },
  { key: 'blocoE', icon: Crosshair, label: 'Sniper', color: 'text-neon-green', bg: 'bg-green-500', glow: 'green' },
] as const;

const Scanner500 = ({ layerResults }: Scanner500Props) => {
  const [animPhase, setAnimPhase] = useState<'idle' | 'scanning' | 'done'>('idle');
  const [scanProgress, setScanProgress] = useState(0);
  const [activeBloco, setActiveBloco] = useState(0);
  const prevTotalRef = useRef(0);

  useEffect(() => {
    if (!layerResults) return;
    if (layerResults.total === prevTotalRef.current) return;
    prevTotalRef.current = layerResults.total;

    setAnimPhase('scanning');
    setScanProgress(0);
    setActiveBloco(0);

    const blockInterval = setInterval(() => {
      setActiveBloco(prev => { if (prev >= 4) { clearInterval(blockInterval); return 4; } return prev + 1; });
    }, 300);

    const progressInterval = setInterval(() => {
      setScanProgress(prev => { if (prev >= 500) { clearInterval(progressInterval); return 500; } return prev + 10; });
    }, 30);

    const doneTimeout = setTimeout(() => setAnimPhase('done'), 1600);

    return () => { clearInterval(blockInterval); clearInterval(progressInterval); clearTimeout(doneTimeout); };
  }, [layerResults]);

  if (!layerResults) return null;

  const total = layerResults.total;
  const pct = (total / 500) * 100;
  const isConverged = total >= 400;
  const isPartial = total >= 300 && total < 400;

  return (
    <div className={`glass rounded-2xl overflow-hidden border transition-all relative ${
      isConverged ? 'border-primary/25 shadow-[0_0_25px_hsl(var(--primary)/0.15)]' : 'border-border/20'
    }`}>
      {/* Decorative background */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/[0.02] via-transparent to-neon-green/[0.02]" />
      {isConverged && <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] via-transparent to-neon-green/[0.03] animate-pulse" />}
      
      {/* Header */}
      <div className="relative px-4 pt-4 pb-3">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/4 via-neon-cyan/3 to-neon-green/3" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`relative w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${
              isConverged 
                ? 'bg-gradient-to-br from-primary/15 to-neon-green/10 border-primary/25 shadow-[0_0_15px_hsl(var(--primary)/0.2)]'
                : 'bg-gradient-to-br from-purple-500/10 to-neon-cyan/10 border-border/20'
            }`}>
              <Target className={`w-5 h-5 ${isConverged ? 'text-primary' : 'text-muted-foreground/60'}`} />
              <div className={`absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full transition-all ${
                animPhase === 'scanning' ? 'bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.4)]' 
                : isConverged ? 'bg-neon-green shadow-[0_0_8px_hsl(var(--neon-green)/0.5)]' 
                : 'bg-muted-foreground/30'
              }`} />
            </div>
            <div>
              <span className="font-display text-xs tracking-[0.2em] font-bold text-primary uppercase">Scanner 500</span>
              <div className="text-[7px] text-muted-foreground/40 font-mono">5 camadas • varredura profunda</div>
            </div>
            {animPhase === 'scanning' && (
              <motion.div
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-400/10 border border-amber-400/15"
              >
                <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                <span className="text-[7px] text-amber-400 font-bold font-display tracking-wider">SCANNING</span>
              </motion.div>
            )}
          </div>
          <div className="text-right">
            <span className={`font-mono text-lg font-black leading-none ${
              isConverged ? 'text-primary' : isPartial ? 'text-amber-400' : 'text-muted-foreground'
            }`}>
              {total}
            </span>
            <span className="text-[9px] text-muted-foreground/30 font-mono">/{layerResults.max}</span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 pb-3">
        <div className="relative w-full h-4 bg-background/20 rounded-full overflow-hidden border border-border/10">
          {animPhase === 'scanning' ? (
            <motion.div
              className="h-full bg-gradient-to-r from-purple-500 via-primary via-amber-500 to-green-500 rounded-full"
              initial={{ width: '0%' }}
              animate={{ width: `${(scanProgress / 500) * 100}%` }}
              transition={{ duration: 0.03 }}
            />
          ) : (
            <motion.div
              className={`h-full rounded-full ${
                isConverged ? 'bg-gradient-to-r from-primary to-neon-green' : isPartial ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-muted-foreground/30'
              }`}
              initial={{ width: '0%' }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          )}
          {/* Threshold markers */}
          <div className="absolute top-0 left-[60%] w-px h-full bg-amber-400/20" />
          <div className="absolute top-0 left-[80%] w-px h-full bg-primary/30" />
          {isConverged && animPhase === 'done' && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer bg-[length:200%_100%]" />
          )}
          {/* Percentage label */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[7px] font-mono font-bold text-white/60 drop-shadow-sm">{pct.toFixed(0)}%</span>
          </div>
        </div>
      </div>

      {/* 5 Blocks */}
      <div className="px-3 pb-3">
        <div className="grid grid-cols-5 gap-1.5">
          {BLOCO_CONFIG.map(({ key, icon: Icon, label, color, bg }, i) => {
            const bloco = layerResults[key as keyof LayerResults] as { score: number; max: number; label: string };
            const blocoPct = (bloco.score / bloco.max) * 100;
            const isActive = animPhase === 'scanning' && activeBloco === i;
            const isScanned = animPhase === 'scanning' ? activeBloco > i : true;
            const isPerfect = blocoPct >= 90;

            return (
              <motion.div
                key={key}
                className={`rounded-xl p-2.5 border transition-all relative overflow-hidden ${
                  isActive ? 'border-primary/40 glass scale-105 shadow-[0_0_12px_hsl(var(--primary)/0.2)]' 
                  : isPerfect && isScanned ? `glass border-neon-green/20 bg-neon-green/3`
                  : isScanned ? 'glass border-border/15' 
                  : 'border-transparent bg-background/5 opacity-30'
                }`}
                animate={isActive ? { scale: [1, 1.05, 1] } : {}}
                transition={{ duration: 0.3 }}
              >
                {isPerfect && isScanned && (
                  <div className="absolute inset-0 bg-gradient-to-b from-neon-green/[0.04] to-transparent" />
                )}
                <div className="relative">
                  <div className="flex items-center gap-1 mb-2">
                    <Icon className={`w-3 h-3 ${isActive ? 'text-primary animate-pulse' : color}`} />
                    <span className="text-[6px] font-bold text-muted-foreground/60 truncate font-display tracking-wider">{label}</span>
                  </div>
                  <div className="w-full h-3 bg-background/20 rounded-full overflow-hidden border border-border/5">
                    <motion.div
                      className={`h-full rounded-full ${isPerfect ? 'bg-gradient-to-r from-neon-green to-emerald-400' : bg}`}
                      initial={{ width: '0%' }}
                      animate={{ width: isScanned ? `${blocoPct}%` : '0%' }}
                      transition={{ duration: 0.4, delay: isScanned ? 0 : 0.3 }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className={`text-[8px] font-mono font-bold ${blocoPct > 70 ? color : 'text-muted-foreground/50'}`}>
                      {bloco.score}/{bloco.max}
                    </span>
                    {isPerfect && isScanned && <span className="text-[6px]">✨</span>}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Status */}
      <AnimatePresence>
        {animPhase === 'done' && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`mx-4 mb-4 text-center px-3 py-3.5 rounded-xl border relative overflow-hidden ${
              isConverged
                ? 'glass text-primary border-primary/20 shadow-[0_0_15px_hsl(var(--primary)/0.15)]'
                : isPartial
                ? 'glass text-amber-400 border-amber-500/15'
                : 'glass text-muted-foreground border-border/20'
            }`}
          >
            {isConverged && <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.03] via-transparent to-neon-green/[0.03]" />}
            <div className="relative flex items-center justify-center gap-2.5">
              {isConverged ? (
                <>
                  <CheckCircle2 className="w-4.5 h-4.5" />
                  <div className="flex flex-col items-start">
                    <span className="text-[10px] font-black font-display tracking-wider">CONVERGÊNCIA TOTAL</span>
                    <span className="text-[7px] text-primary/60 font-mono">{total}/500 pontos — entrada certeira</span>
                  </div>
                </>
              ) : isPartial ? (
                <>
                  <Zap className="w-4 h-4" />
                  <div className="flex flex-col items-start">
                    <span className="text-[10px] font-bold font-display tracking-wider">CONVERGÊNCIA PARCIAL</span>
                    <span className="text-[7px] text-amber-400/60 font-mono">{total}/500 — aguardando alinhamento</span>
                  </div>
                </>
              ) : (
                <>
                  <Activity className="w-4 h-4" />
                  <div className="flex flex-col items-start">
                    <span className="text-[10px] font-bold font-display tracking-wider">VARREDURA EM ANDAMENTO</span>
                    <span className="text-[7px] text-muted-foreground/50 font-mono">{total}/500 — monitorando</span>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Scanner500;