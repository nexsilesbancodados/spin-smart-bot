import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Crosshair, Shield, Zap, Brain, Activity, CheckCircle2 } from 'lucide-react';

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
  { key: 'blocoA', icon: Activity, label: 'Frequência', color: 'text-purple-400', bg: 'bg-purple-500' },
  { key: 'blocoB', icon: Zap, label: 'Transição', color: 'text-blue-400', bg: 'bg-blue-500' },
  { key: 'blocoC', icon: Shield, label: 'Setores', color: 'text-neon-cyan', bg: 'bg-primary' },
  { key: 'blocoD', icon: Brain, label: 'IA', color: 'text-amber-400', bg: 'bg-amber-500' },
  { key: 'blocoE', icon: Crosshair, label: 'Sniper', color: 'text-neon-green', bg: 'bg-green-500' },
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
    <div className={`glass rounded-2xl overflow-hidden border transition-all card-hover ${
      isConverged ? 'border-primary/25 shadow-neon-cyan' : 'border-border/20'
    }`}>
      {/* Header */}
      <div className="relative px-4 pt-4 pb-3">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/4 via-neon-cyan/3 to-neon-green/3" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-2.5 h-2.5 rounded-full ${
              animPhase === 'scanning' ? 'bg-amber-400 animate-pulse' : isConverged ? 'bg-primary animate-pulse shadow-[0_0_8px_hsl(var(--primary)/0.4)]' : 'bg-muted-foreground/40'
            }`} />
            <span className="font-display text-[10px] tracking-[0.2em] font-bold text-primary uppercase">Scanner 500</span>
          </div>
          <span className={`font-mono text-sm font-black ${
            isConverged ? 'text-primary text-glow-cyan' : total >= 300 ? 'text-amber-400' : 'text-muted-foreground'
          }`}>
            {total}/{layerResults.max}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 pb-3">
        <div className="relative w-full h-3 bg-secondary/60 rounded-full overflow-hidden border border-border/10">
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
                isConverged ? 'bg-gradient-to-r from-primary to-neon-green' : total >= 300 ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-muted-foreground/30'
              }`}
              initial={{ width: '0%' }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          )}
          <div className="absolute top-0 left-[80%] w-px h-full bg-primary/30" />
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

            return (
              <motion.div
                key={key}
                className={`rounded-xl p-2.5 border transition-all ${
                  isActive ? 'border-primary/40 glass scale-105 shadow-neon-cyan' : isScanned ? 'glass border-border/15' : 'border-transparent bg-secondary/10 opacity-30'
                }`}
                animate={isActive ? { scale: [1, 1.05, 1] } : {}}
                transition={{ duration: 0.3 }}
              >
                <div className="flex items-center gap-1 mb-2">
                  <Icon className={`w-3 h-3 ${isActive ? 'text-primary animate-pulse' : color}`} />
                  <span className="text-[6px] font-bold text-muted-foreground/60 truncate font-display tracking-wider">{label}</span>
                </div>
                <div className="w-full h-2 bg-background/60 rounded-full overflow-hidden border border-border/5">
                  <motion.div
                    className={`h-full rounded-full ${bg}`}
                    initial={{ width: '0%' }}
                    animate={{ width: isScanned ? `${blocoPct}%` : '0%' }}
                    transition={{ duration: 0.4, delay: isScanned ? 0 : 0.3 }}
                  />
                </div>
                <span className={`text-[8px] font-mono font-bold block mt-1.5 text-center ${blocoPct > 70 ? color : 'text-muted-foreground/50'}`}>
                  {bloco.score}/{bloco.max}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Status */}
      {animPhase === 'done' && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mx-4 mb-4 text-center text-[9px] font-bold px-3 py-2 rounded-xl border flex items-center justify-center gap-1.5 ${
            isConverged
              ? 'glass text-primary border-primary/20 text-glow-cyan'
              : total >= 300
              ? 'glass text-amber-400 border-amber-500/15'
              : 'glass text-muted-foreground border-border/20'
          }`}
        >
          {isConverged && <CheckCircle2 className="w-3.5 h-3.5" />}
          {isConverged
            ? `CONVERGÊNCIA: ${total}/500 — JOGADA CERTEIRA`
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
