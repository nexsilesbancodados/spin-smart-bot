import { RefreshCw, History, Trophy, X, Crosshair } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface StatsBarProps {
  predStats: { hits: number; misses: number; exact: number; total: number };
  setPredStats: (stats: { hits: number; misses: number; exact: number; total: number }) => void;
}

const StatsBar = ({ predStats, setPredStats }: StatsBarProps) => {
  const winPct = predStats.total > 0 ? ((predStats.hits / predStats.total) * 100).toFixed(1) : '0.0';
  const isWinning = predStats.total > 0 && (predStats.hits / predStats.total) >= 0.5;

  return (
    <div className="border-b border-border/40 px-4 py-0 shrink-0 sticky top-0 z-40"
      style={{ background: 'linear-gradient(180deg, hsl(var(--card) / 0.98) 0%, hsl(var(--card) / 0.92) 100%)', backdropFilter: 'blur(12px)' }}>
      <div className="max-w-[1400px] mx-auto flex items-center justify-center gap-5 h-10 flex-wrap">
        {/* Total */}
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-muted-foreground font-bold tracking-widest uppercase">Previsões</span>
          <span className="text-sm font-mono font-black text-foreground bg-secondary/50 px-2.5 py-0.5 rounded-md border border-border/30">
            {predStats.total}
          </span>
        </div>

        <div className="w-px h-4 bg-border/40" />

        {/* Acertos */}
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]" />
          <span className="text-sm font-mono font-black text-green-400">{predStats.hits}</span>
          <span className="text-[8px] text-muted-foreground/70 uppercase tracking-wide">Acertos</span>
        </div>

        {/* Erros */}
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-destructive shadow-[0_0_6px_hsl(var(--destructive)/0.5)]" />
          <span className="text-sm font-mono font-black text-destructive">{predStats.misses}</span>
          <span className="text-[8px] text-muted-foreground/70 uppercase tracking-wide">Erros</span>
        </div>

        {/* Exatos */}
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.5)]" />
          <span className="text-sm font-mono font-black text-primary">{predStats.exact}</span>
          <span className="text-[8px] text-muted-foreground/70 uppercase tracking-wide">Exatos</span>
        </div>

        <div className="w-px h-4 bg-border/40" />

        {/* Win Rate — pill */}
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border transition-all ${
          isWinning
            ? 'bg-green-500/10 text-green-400 border-green-500/30 shadow-[0_0_10px_rgba(34,197,94,0.1)]'
            : 'bg-destructive/10 text-destructive border-destructive/30'
        }`}>
          <span className="font-mono font-black">{winPct}%</span>
          <span className="text-[7px] opacity-70 font-bold">WIN</span>
        </div>

        {/* Progress bar */}
        {predStats.total > 0 && (
          <div className="w-20 h-1.5 bg-secondary/60 rounded-full overflow-hidden hidden sm:block">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${isWinning ? 'bg-gradient-to-r from-green-500 to-emerald-400' : 'bg-gradient-to-r from-destructive to-rose-400'}`}
              style={{ width: `${Math.min(parseFloat(winPct), 100)}%` }}
            />
          </div>
        )}

        <div className="w-px h-4 bg-border/40" />

        {/* Reset */}
        <button onClick={async () => {
          await supabase.from('prediction_history').delete().not('id', 'is', null);
          setPredStats({ hits: 0, misses: 0, exact: 0, total: 0 });
        }} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[8px] font-bold bg-destructive/8 text-destructive/80 border border-destructive/20 hover:bg-destructive/15 hover:text-destructive transition-all">
          <RefreshCw className="w-2.5 h-2.5" /> ZERAR
        </button>
      </div>
    </div>
  );
};

export default StatsBar;
