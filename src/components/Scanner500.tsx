import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  { key: 'blocoA', icon: Activity, color: 'text-purple-400', bg: 'bg-purple-500' },
  { key: 'blocoB', icon: Zap, color: 'text-blue-400', bg: 'bg-blue-500' },
  { key: 'blocoC', icon: Shield, color: 'text-cyan-400', bg: 'bg-cyan-500' },
  { key: 'blocoD', icon: Brain, color: 'text-amber-400', bg: 'bg-amber-500' },
  { key: 'blocoE', icon: Crosshair, color: 'text-green-400', bg: 'bg-green-500' },
] as const;

const Scanner500 = ({ layerResults, isScanning }: Scanner500Props) => {
  const [animPhase, setAnimPhase] = useState<'idle' | 'scanning' | 'done'>('idle');
  const [scanProgress, setScanProgress] = useState(0);
  const [activeBloco, setActiveBloco] = useState(0);
  const prevTotalRef = useRef(0);

  // Animate scan when new data arrives
  useEffect(() => {
    if (!layerResults) return;
    if (layerResults.total === prevTotalRef.current) return;
    prevTotalRef.current = layerResults.total;

    setAnimPhase('scanning');
    setScanProgress(0);
    setActiveBloco(0);

    // Animate through 5 blocks in 1.5s (300ms each)
    const blockInterval = setInterval(() => {
      setActiveBloco(prev => {
        if (prev >= 4) { clearInterval(blockInterval); return 4; }
        return prev + 1;
      });
    }, 300);

    // Smooth progress bar
    const progressInterval = setInterval(() => {
      setScanProgress(prev => {
        if (prev >= 500) { clearInterval(progressInterval); return 500; }
        return prev + 10;
      });
    }, 30); // 500/10 = 50 steps * 30ms = 1.5s

    const doneTimeout = setTimeout(() => {
      setAnimPhase('done');
    }, 1600);

    return () => {
      clearInterval(blockInterval);
      clearInterval(progressInterval);
      clearTimeout(doneTimeout);
    };
  }, [layerResults]);

  if (!layerResults) return null;

  const total = layerResults.total;
  const pct = (total / 500) * 100;
  const isConverged = total >= 400;

  return (
    <div className={`rounded-xl border p-3 transition-all ${
      isConverged
        ? 'bg-gradient-to-r from-primary/20 via-yellow-500/10 to-primary/10 border-primary/50 shadow-lg shadow-primary/10'
        : 'bg-card border-border'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${animPhase === 'scanning' ? 'bg-yellow-400 animate-pulse' : isConverged ? 'bg-green-400 animate-pulse' : 'bg-muted-foreground'}`} />
          <span className="font-display text-[9px] tracking-[0.2em] font-bold text-primary">SCANNER 500</span>
        </div>
        <span className={`font-mono text-sm font-bold ${isConverged ? 'text-primary' : total >= 300 ? 'text-yellow-400' : 'text-muted-foreground'}`}>
          {total}/{layerResults.max}
        </span>
      </div>

      {/* Main progress bar (the scan animation) */}
      <div className="relative w-full h-3 bg-secondary rounded-full overflow-hidden mb-3">
        {animPhase === 'scanning' ? (
          <motion.div
            className="h-full bg-gradient-to-r from-purple-500 via-blue-500 via-cyan-500 via-amber-500 to-green-500 rounded-full"
            initial={{ width: '0%' }}
            animate={{ width: `${(scanProgress / 500) * 100}%` }}
            transition={{ duration: 0.03 }}
          />
        ) : (
          <motion.div
            className={`h-full rounded-full ${isConverged ? 'bg-gradient-to-r from-primary to-yellow-500' : total >= 300 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' : 'bg-muted-foreground/50'}`}
            initial={{ width: '0%' }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        )}
        {/* Threshold marker at 400/500 = 80% */}
        <div className="absolute top-0 left-[80%] w-px h-full bg-primary/50" />
      </div>

      {/* 5 Blocos */}
      <div className="grid grid-cols-5 gap-1.5">
        {BLOCO_CONFIG.map(({ key, icon: Icon, color, bg }, i) => {
          const bloco = layerResults[key as keyof LayerResults] as { score: number; max: number; label: string };
          const blocoPct = (bloco.score / bloco.max) * 100;
          const isActive = animPhase === 'scanning' && activeBloco === i;
          const isScanned = animPhase === 'scanning' ? activeBloco > i : true;

          return (
            <motion.div
              key={key}
              className={`rounded-lg p-1.5 border transition-all ${
                isActive ? 'border-primary bg-primary/10 scale-105' : isScanned ? 'border-border bg-secondary/50' : 'border-transparent bg-secondary/20 opacity-40'
              }`}
              animate={isActive ? { scale: [1, 1.05, 1] } : {}}
              transition={{ duration: 0.3 }}
            >
              <div className="flex items-center gap-1 mb-1">
                <Icon className={`w-3 h-3 ${isActive ? 'text-primary animate-pulse' : color}`} />
                <span className="text-[6px] font-bold text-muted-foreground truncate">{bloco.label.split(' ')[0]}</span>
              </div>
              <div className="w-full h-1.5 bg-background rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${bg}`}
                  initial={{ width: '0%' }}
                  animate={{ width: isScanned ? `${blocoPct}%` : '0%' }}
                  transition={{ duration: 0.4, delay: isScanned ? 0 : 0.3 }}
                />
              </div>
              <span className={`text-[7px] font-mono font-bold block mt-0.5 text-center ${blocoPct > 70 ? color : 'text-muted-foreground'}`}>
                {bloco.score}/{bloco.max}
              </span>
            </motion.div>
          );
        })}
      </div>

      {/* Convergence status */}
      {animPhase === 'done' && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mt-2 text-center text-[8px] font-bold px-2 py-1 rounded-lg ${
            isConverged
              ? 'bg-primary/10 text-primary border border-primary/30'
              : total >= 300
              ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30'
              : 'bg-secondary text-muted-foreground border border-border'
          }`}
        >
          {isConverged
            ? `✅ CONVERGÊNCIA PENTACENTESIMAL: ${total}/500 — JOGADA CERTEIRA LIBERADA`
            : total >= 300
            ? `⚡ Convergência parcial: ${total}/500 — Aguardando alinhamento total`
            : `🔍 Varredura: ${total}/500 — Monitorando camadas`
          }
        </motion.div>
      )}
    </div>
  );
};

export default Scanner500;
