import { memo, useCallback, useMemo } from 'react';
import { RefreshCw, TrendingUp, Target, Crosshair, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';

interface StatsBarProps {
  predStats: { hits: number; misses: number; exact: number; total: number };
  setPredStats: (stats: { hits: number; misses: number; exact: number; total: number }) => void;
}

const StatsBar = memo(({ predStats, setPredStats }: StatsBarProps) => {
  const winPct = useMemo(() => 
    predStats.total > 0 ? ((predStats.hits / predStats.total) * 100).toFixed(1) : '0.0',
    [predStats.hits, predStats.total]
  );
  const isWinning = predStats.total > 0 && (predStats.hits / predStats.total) >= 0.5;

  const handleReset = useCallback(async () => {
    await supabase.from('prediction_history').delete().not('id', 'is', null);
    setPredStats({ hits: 0, misses: 0, exact: 0, total: 0 });
  }, [setPredStats]);

  const mesaStatus = useMemo(() => {
    if (predStats.total < 5) return null;
    const wr = predStats.hits / predStats.total;
    if (wr >= 0.5) return { className: 'bg-neon-green/8 text-neon-green border-neon-green/15', label: '🔥 QUENTE' };
    if (wr < 0.28) return { className: 'bg-neon-cyan/8 text-neon-cyan border-neon-cyan/15', label: '❄️ FRIA' };
    return { className: 'glass text-muted-foreground border-border/15', label: '⚖️ NEUTRO' };
  }, [predStats.hits, predStats.total]);

  return (
    <div className="border-b border-border/15 px-4 py-0 shrink-0 sticky top-0 z-40 glass-strong backdrop-blur-xl relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-neon-cyan/[0.01] via-transparent to-neon-pink/[0.01]" />

      <div className="relative max-w-[1400px] mx-auto flex items-center justify-center gap-4 h-12 flex-wrap">
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-background/10 border border-border/10">
            <Target className="w-3.5 h-3.5 text-primary/50" />
            <span className="text-xs font-mono font-black text-primary">{predStats.total}</span>
          </div>

          <div className="flex items-center gap-1">
            <motion.div
              animate={predStats.hits > 0 ? { scale: [1, 1.3, 1] } : {}}
              transition={{ duration: 0.3 }}
              className="w-2 h-2 rounded-full bg-neon-green shadow-[0_0_6px_hsl(var(--neon-green)/0.5)]"
            />
            <span className="text-xs font-mono font-black text-neon-green">{predStats.hits}</span>
          </div>

          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-destructive shadow-[0_0_6px_hsl(var(--destructive)/0.4)]" />
            <span className="text-xs font-mono font-black text-destructive">{predStats.misses}</span>
          </div>

          {predStats.exact > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-gold/8 border border-gold/15"
            >
              <Crosshair className="w-3.5 h-3.5 text-gold/60" />
              <span className="text-xs font-mono font-black text-gold">{predStats.exact}</span>
            </motion.div>
          )}
        </div>

        <div className="w-px h-5 bg-border/15" />

        <motion.div
          animate={isWinning ? { boxShadow: ['0 0 0px hsl(var(--neon-green)/0)', '0 0 15px hsl(var(--neon-green)/0.12)', '0 0 0px hsl(var(--neon-green)/0)'] } : {}}
          transition={{ duration: 2.5, repeat: Infinity }}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all backdrop-blur-sm ${
            isWinning
              ? 'bg-neon-green/8 text-neon-green border-neon-green/20'
              : predStats.total > 0
              ? 'bg-destructive/8 text-destructive border-destructive/20'
              : 'glass text-muted-foreground border-border/20'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span className="font-mono font-black">{winPct}%</span>
        </motion.div>

        {predStats.total > 0 && (
          <div className="w-28 h-2.5 bg-secondary/40 rounded-full overflow-hidden hidden sm:block border border-border/10 relative">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(parseFloat(winPct), 100)}%` }}
              transition={{ duration: 0.7 }}
              className={`h-full rounded-full ${isWinning ? 'bg-gradient-to-r from-neon-green to-emerald-400' : 'bg-gradient-to-r from-destructive to-rose-400'}`}
            />
            {isWinning && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent animate-shimmer bg-[length:200%_100%]" />
            )}
          </div>
        )}

        {mesaStatus && (
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`text-[8px] font-display font-bold px-2.5 py-1 rounded-xl border tracking-wider flex items-center gap-1 ${mesaStatus.className}`}
          >
            <Zap className="w-2.5 h-2.5" />
            {mesaStatus.label}
          </motion.span>
        )}

        <div className="w-px h-5 bg-border/15" />

        <motion.button
          onClick={handleReset}
          whileTap={{ scale: 0.9 }}
          whileHover={{ scale: 1.05 }}
          className="p-2 rounded-xl hover:bg-destructive/10 transition-colors text-destructive/40 hover:text-destructive border border-transparent hover:border-destructive/15"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </motion.button>
      </div>
    </div>
  );
});

StatsBar.displayName = 'StatsBar';
export default StatsBar;
