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
    <div className="border-b border-border/30 px-4 py-0 shrink-0 sticky top-0 z-40 glass">
      <div className="max-w-[1400px] mx-auto flex items-center justify-center gap-3 h-11 flex-wrap">
        
        {/* Stats compactas */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Target className="w-3 h-3 text-primary/60" />
            <span className="text-xs font-mono font-black text-primary">{predStats.total}</span>
          </div>

          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-neon-green shadow-[0_0_6px_hsl(var(--neon-green)/0.6)]" />
            <span className="text-xs font-mono font-black text-neon-green">{predStats.hits}</span>
          </div>

          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-destructive shadow-[0_0_6px_hsl(var(--destructive)/0.5)]" />
            <span className="text-xs font-mono font-black text-destructive">{predStats.misses}</span>
          </div>

          {predStats.exact > 0 && (
            <div className="flex items-center gap-1">
              <Crosshair className="w-3 h-3 text-primary/60" />
              <span className="text-xs font-mono font-black text-primary">{predStats.exact}</span>
            </div>
          )}
        </div>

        <div className="w-px h-5 bg-border/30" />

        {/* Win Rate — destaque */}
        <div className={`flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-bold border transition-all ${
          isWinning
            ? 'bg-neon-green/10 text-neon-green border-neon-green/30'
            : predStats.total > 0
            ? 'bg-destructive/10 text-destructive border-destructive/30'
            : 'bg-secondary text-muted-foreground border-border'
        }`}>
          <TrendingUp className="w-3 h-3" />
          <span className="font-mono font-black">{winPct}%</span>
        </div>

        {/* Progress bar */}
        {predStats.total > 0 && (
          <div className="w-20 h-1.5 bg-secondary/60 rounded-full overflow-hidden hidden sm:block border border-border/20">
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
            <span className={`text-[8px] font-black px-2 py-0.5 rounded border ${
              wr >= 0.5 ? 'bg-green-500/10 text-green-400 border-green-500/20' :
              wr < 0.28 ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
              'bg-secondary text-muted-foreground border-border'
            }`}>
              {wr >= 0.5 ? '🔥 QUENTE' : wr < 0.28 ? '❄️ FRIA' : '⚖️ NEUTRO'}
            </span>
          );
        })()}

        <div className="w-px h-5 bg-border/30" />

        {/* Reset */}
        <button onClick={async () => {
          await supabase.from('prediction_history').delete().not('id', 'is', null);
          setPredStats({ hits: 0, misses: 0, exact: 0, total: 0 });
        }} className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-destructive/50 hover:text-destructive">
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};

export default StatsBar;
