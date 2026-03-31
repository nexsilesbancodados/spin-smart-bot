import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Crosshair, Shield, Zap, Brain, Activity } from 'lucide-react';

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
  { key: 'blocoA', icon: Activity, color: 'text-purple-400', bg: 'bg-purple-500', glow: 'shadow-purple-500/20' },
  { key: 'blocoB', icon: Zap, color: 'text-blue-400', bg: 'bg-blue-500', glow: 'shadow-blue-500/20' },
  { key: 'blocoC', icon: Shield, color: 'text-neon-cyan', bg: 'bg-primary', glow: 'shadow-primary/20' },
  { key: 'blocoD', icon: Brain, color: 'text-amber-400', bg: 'bg-amber-500', glow: 'shadow-amber-500/20' },
  { key: 'blocoE', icon: Crosshair, color: 'text-neon-green', bg: 'bg-green-500', glow: 'shadow-green-500/20' },
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

  return (
    <div className={`glass rounded-xl p-3.5 transition-all card-hover ${
      isConverged ? 'border-primary/30 shadow-neon-cyan' : 'border-border/30'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-2 h-2 rounded-full ${animPhase === 'scanning' ? 'bg-amber-400 animate-pulse' : isConverged ? 'bg-primary animate-pulse shadow-[0_0_6px_hsl(var(--primary)/0.4)]' : 'bg-muted-foreground/40'}`} />
          <span className="font-display text-[9px] tracking-[0.2em] font-bold text-primary">SCANNER 500</span>
        </div>
        <span className={`font-mono text-sm font-bold ${isConverged ? 'text-primary text-glow-cyan' : total >= 300 ? 'text-amber-400' : 'text-muted-foreground'}`}>
          {total}/{layerResults.max}
        </span>
      </div>

      {/* Progress bar */}
      <div className="relative w-full h-2.5 bg-secondary/60 rounded-full overflow-hidden mb-3">
        {animPhase === 'scanning' ? (
          <motion.div
            className="h-full bg-gradient-to-r from-purple-500 via-primary via-amber-500 to-green-500 rounded-full"
            initial={{ width: '0%' }}
            animate={{ width: `${(scanProgress / 500) * 100}%` }}
            transition={{ duration: 0.03 }}
          />
        ) : (
          <motion.div
            className={`h-full rounded-full ${isConverged ? 'bg-gradient-to-r from-primary to-neon-green' : total >= 300 ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-muted-foreground/30'}`}
            initial={{ width: '0%' }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        )}
        <div className="absolute top-0 left-[80%] w-px h-full bg-primary/30" />
      </div>

      {/* 5 Blocks */}
      <div className="grid grid-cols-5 gap-1.5">
        {BLOCO_CONFIG.map(({ key, icon: Icon, color, bg }, i) => {
          const bloco = layerResults[key as keyof LayerResults] as { score: number; max: number; label: string };
          const blocoPct = (bloco.score / bloco.max) * 100;
          const isActive = animPhase === 'scanning' && activeBloco === i;
          const isScanned = animPhase === 'scanning' ? activeBloco > i : true;

          return (
            <motion.div
              key={key}
              className={`rounded-lg p-2 border transition-all ${
                isActive ? 'border-primary/40 bg-primary/8 scale-105 shadow-sm' : isScanned ? 'border-border/20 bg-secondary/30' : 'border-transparent bg-secondary/10 opacity-30'
              }`}
              animate={isActive ? { scale: [1, 1.05, 1] } : {}}
              transition={{ duration: 0.3 }}
            >
              <div className="flex items-center gap-1 mb-1.5">
                <Icon className={`w-3 h-3 ${isActive ? 'text-primary animate-pulse' : color}`} />
                <span className="text-[6px] font-bold text-muted-foreground/60 truncate">{bloco.label.split(' ')[0]}</span>
              </div>
              <div className="w-full h-1.5 bg-background/60 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${bg}`}
                  initial={{ width: '0%' }}
                  animate={{ width: isScanned ? `${blocoPct}%` : '0%' }}
                  transition={{ duration: 0.4, delay: isScanned ? 0 : 0.3 }}
                />
              </div>
              <span className={`text-[7px] font-mono font-bold block mt-1 text-center ${blocoPct > 70 ? color : 'text-muted-foreground/50'}`}>
                {bloco.score}/{bloco.max}
              </span>
            </motion.div>
          );
        })}
      </div>

      {/* Status */}
      {animPhase === 'done' && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mt-3 text-center text-[8px] font-bold px-3 py-1.5 rounded-lg ${
            isConverged
              ? 'bg-primary/8 text-primary border border-primary/20 text-glow-cyan'
              : total >= 300
              ? 'bg-amber-500/8 text-amber-400 border border-amber-500/15'
              : 'bg-secondary/40 text-muted-foreground border border-border/20'
          }`}
        >
          {isConverged
            ? `✅ CONVERGÊNCIA: ${total}/500 — JOGADA CERTEIRA`
            : total >= 300
            ? `⚡ Parcial: ${total}/500 — Aguardando alinhamento`
            : `🔍 Varredura: ${total}/500 — Monitorando`
          }
        </motion.div>
      )}
    </div>
  );
};

export default Scanner500;
