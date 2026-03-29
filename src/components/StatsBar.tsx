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
    <div className="bg-card/95 backdrop-blur-md border-b border-border px-4 py-2 shrink-0 sticky top-0 z-40">
      <div className="max-w-[1400px] mx-auto flex items-center justify-center gap-4 flex-wrap">
        {/* Total */}
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-muted-foreground font-bold tracking-wider">PREVISÕES</span>
          <span className="text-sm font-mono font-bold text-foreground bg-secondary/60 px-2 py-0.5 rounded-md">{predStats.total}</span>
        </div>

        <div className="w-px h-5 bg-border" />

        {/* Acertos */}
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-sm shadow-green-500/50" />
          <span className="text-sm font-mono font-bold text-green-400">{predStats.hits}</span>
          <span className="text-[8px] text-muted-foreground">ACERTOS</span>
        </div>

        {/* Erros */}
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-destructive shadow-sm shadow-destructive/50" />
          <span className="text-sm font-mono font-bold text-destructive">{predStats.misses}</span>
          <span className="text-[8px] text-muted-foreground">ERROS</span>
        </div>

        {/* Exatos */}
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-primary shadow-sm shadow-primary/50" />
          <span className="text-sm font-mono font-bold text-primary">{predStats.exact}</span>
          <span className="text-[8px] text-muted-foreground">EXATOS</span>
        </div>

        <div className="w-px h-5 bg-border" />

        {/* Win Rate */}
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-all ${
          isWinning
            ? 'bg-green-500/15 text-green-400 border-green-500/40 shadow-sm shadow-green-500/10'
            : 'bg-destructive/15 text-destructive border-destructive/40'
        }`}>
          <span className="font-mono">{winPct}%</span>
          <span className="text-[8px] opacity-80">WIN</span>
        </div>

        {/* Win/Loss Bar */}
        {predStats.total > 0 && (
          <div className="w-24 h-2 bg-secondary rounded-full overflow-hidden hidden sm:block">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all duration-500"
              style={{ width: `${parseFloat(winPct)}%` }}
            />
          </div>
        )}

        <div className="w-px h-5 bg-border" />

        {/* Reset */}
        <button onClick={async () => {
          await supabase.from('prediction_history').delete().not('id', 'is', null);
          setPredStats({ hits: 0, misses: 0, exact: 0, total: 0 });
        }} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold bg-destructive/10 text-destructive border border-destructive/30 hover:bg-destructive/20 transition-all">
          <RefreshCw className="w-2.5 h-2.5" /> ZERAR
        </button>
      </div>
    </div>
  );
};

export default StatsBar;
