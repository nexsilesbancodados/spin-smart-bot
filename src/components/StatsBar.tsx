import { RefreshCw, TrendingUp, Target, Crosshair } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';

interface StatsBarProps {
  predStats: { hits: number; misses: number; exact: number; total: number };
  setPredStats: (stats: { hits: number; misses: number; exact: number; total: number }) => void;
}

const StatsBar = ({ predStats, setPredStats }: StatsBarProps) => {
  const winPct = predStats.total > 0 ? ((predStats.hits / predStats.total) * 100).toFixed(1) : '0.0';
  const isWinning = predStats.total > 0 && (predStats.hits / predStats.total) >= 0.5;

  return (
    <div className="border-b border-border/15 px-4 py-0 shrink-0 sticky top-0 z-40 glass-strong backdrop-blur-xl">
      <div className="max-w-[1400px] mx-auto flex items-center justify-center gap-4 h-12 flex-wrap">
        
        {/* Stats compactas */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-primary/50" />
            <span className="text-xs font-mono font-black text-primary">{predStats.total}</span>
          </div>

          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-neon-green shadow-[0_0_6px_hsl(var(--neon-green)/0.5)]" />
            <span className="text-xs font-mono font-black text-neon-green">{predStats.hits}</span>
          </div>

          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-destructive shadow-[0_0_6px_hsl(var(--destructive)/0.4)]" />
            <span className="text-xs font-mono font-black text-destructive">{predStats.misses}</span>
          </div>

          {predStats.exact > 0 && (
            <div className="flex items-center gap-1">
              <Crosshair className="w-3.5 h-3.5 text-gold/60" />
              <span className="text-xs font-mono font-black text-gold">{predStats.exact}</span>
            </div>
          )}
        </div>

        <div className="w-px h-5 bg-border/15" />

        {/* Win Rate */}
        <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all backdrop-blur-sm ${
          isWinning
            ? 'bg-neon-green/8 text-neon-green border-neon-green/20 shadow-neon-green'
            : predStats.total > 0
            ? 'bg-destructive/8 text-destructive border-destructive/20'
            : 'glass text-muted-foreground border-border/20'
        }`}>
          <TrendingUp className="w-3.5 h-3.5" />
          <span className="font-mono font-black">{winPct}%</span>
        </div>

        {/* Progress bar */}
        {predStats.total > 0 && (
          <div className="w-24 h-2 bg-secondary/40 rounded-full overflow-hidden hidden sm:block border border-border/10">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(parseFloat(winPct), 100)}%` }}
              transition={{ duration: 0.7 }}
              className={`h-full rounded-full ${isWinning ? 'bg-gradient-to-r from-neon-green to-emerald-400' : 'bg-gradient-to-r from-destructive to-rose-400'}`}
            />
          </div>
        )}

        {/* Mesa status */}
        {predStats.total >= 5 && (() => {
          const wr = predStats.hits / predStats.total;
          return (
            <span className={`text-[8px] font-display font-bold px-2.5 py-1 rounded-xl border tracking-wider ${
              wr >= 0.5 ? 'bg-neon-green/8 text-neon-green border-neon-green/15' :
              wr < 0.28 ? 'bg-neon-cyan/8 text-neon-cyan border-neon-cyan/15' :
              'glass text-muted-foreground border-border/15'
            }`}>
              {wr >= 0.5 ? '🔥 QUENTE' : wr < 0.28 ? '❄️ FRIA' : '⚖️ NEUTRO'}
            </span>
          );
        })()}

        <div className="w-px h-5 bg-border/15" />

        {/* Reset */}
        <button onClick={async () => {
          await supabase.from('prediction_history').delete().not('id', 'is', null);
          setPredStats({ hits: 0, misses: 0, exact: 0, total: 0 });
        }} className="p-2 rounded-xl hover:bg-destructive/10 transition-colors text-destructive/40 hover:text-destructive border border-transparent hover:border-destructive/15">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default StatsBar;
