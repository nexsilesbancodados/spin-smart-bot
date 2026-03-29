import { RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface StatsBarProps {
  predStats: { hits: number; misses: number; exact: number; total: number };
  setPredStats: (stats: { hits: number; misses: number; exact: number; total: number }) => void;
}

const StatsBar = ({ predStats, setPredStats }: StatsBarProps) => {
  const winPct = predStats.total > 0 ? ((predStats.hits / predStats.total) * 100).toFixed(1) : '0.0';
  const isWinning = predStats.total > 0 && (predStats.hits / predStats.total) >= 0.5;

  return (
    <div className="border-b border-border/30 px-4 py-0 shrink-0 sticky top-0 z-40 glass">
      <div className="max-w-[1400px] mx-auto flex items-center justify-center gap-4 h-10 flex-wrap">
        {/* Total */}
        <div className="flex items-center gap-2">
          <span className="text-[8px] text-muted-foreground font-bold tracking-[0.2em] uppercase font-display">Previsões</span>
          <span className="text-sm font-mono font-black text-primary bg-primary/10 px-2.5 py-0.5 rounded-md border border-primary/20">
            {predStats.total}
          </span>
        </div>

        <div className="w-px h-4 bg-primary/20" />

        {/* Acertos */}
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-neon-green shadow-[0_0_8px_hsl(var(--neon-green)/0.6)]" />
          <span className="text-sm font-mono font-black text-neon-green">{predStats.hits}</span>
          <span className="text-[8px] text-muted-foreground/70 uppercase tracking-wide">Acertos</span>
        </div>

        {/* Erros */}
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-destructive shadow-[0_0_8px_hsl(var(--destructive)/0.5)]" />
          <span className="text-sm font-mono font-black text-destructive">{predStats.misses}</span>
          <span className="text-[8px] text-muted-foreground/70 uppercase tracking-wide">Erros</span>
        </div>

        {/* Exatos */}
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.6)]" />
          <span className="text-sm font-mono font-black text-primary">{predStats.exact}</span>
          <span className="text-[8px] text-muted-foreground/70 uppercase tracking-wide">Exatos</span>
        </div>

        <div className="w-px h-4 bg-primary/20" />

        {/* Win Rate */}
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border transition-all ${
          isWinning
            ? 'bg-neon-green/10 text-neon-green border-neon-green/30 shadow-neon-green'
            : 'bg-destructive/10 text-destructive border-destructive/30'
        }`}>
          <span className="font-mono font-black">{winPct}%</span>
          <span className="text-[7px] opacity-70 font-bold font-display tracking-widest">WIN</span>
        </div>

        {/* Progress bar */}
        {predStats.total > 0 && (
          <div className="w-24 h-1.5 bg-secondary/60 rounded-full overflow-hidden hidden sm:block border border-border/30">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${isWinning ? 'bg-gradient-to-r from-neon-green to-emerald-400 shadow-neon-green' : 'bg-gradient-to-r from-destructive to-rose-400'}`}
              style={{ width: `${Math.min(parseFloat(winPct), 100)}%` }}
            />
          </div>
        )}

        <div className="w-px h-4 bg-primary/20" />

        {/* Reset */}
        <button onClick={async () => {
          await supabase.from('prediction_history').delete().not('id', 'is', null);
          setPredStats({ hits: 0, misses: 0, exact: 0, total: 0 });
        }} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[8px] font-bold bg-destructive/8 text-destructive/80 border border-destructive/20 hover:bg-destructive/15 hover:text-destructive transition-all">
           <RefreshCw className="w-2.5 h-2.5" /> ZERAR
         </button>

         {predStats.total >= 5 && (() => {
           const wr = predStats.hits / predStats.total;
           const isHot = wr >= 0.5;
           const isCold = wr < 0.28;
           return (
             <>
               <div className="w-px h-4 bg-border/40" />
               <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[8px] font-bold border ${
                 isHot ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                 isCold ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                 'bg-secondary text-muted-foreground border-border'
               }`}>
                 {isHot ? '🔥 QUENTE' : isCold ? '❄️ FRIA' : '⚖️ NEUTRO'}
               </div>
             </>
           );
         })()}
      </div>
    </div>
  );
};

export default StatsBar;