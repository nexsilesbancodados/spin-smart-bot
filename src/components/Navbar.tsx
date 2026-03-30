import { memo } from 'react';
import {
  CircleDot, Brain, Wifi, WifiOff, Power, Sparkles, RefreshCw
} from 'lucide-react';

interface NavbarProps {
  isPolling: boolean;
  setIsPolling: (v: boolean) => void;
  isAnalyzing: boolean;
  triggerLearn: () => void;
  confidenceFilter: boolean;
  setConfidenceFilter: (v: boolean) => void;
  lastUpdate: Date | null;
  fetchNumbers: () => void;
  fetchStored: () => void;
  autoLearnStatus: 'idle' | 'learning' | 'analyzing' | 'backtesting';
  onShowHistory: () => void;
  aiEnabled: boolean;
  setAiEnabled: (v: boolean) => void;
  strategyFilter: string;
  setStrategyFilter: (v: string) => void;
  predStats: { hits: number; misses: number; exact: number; total: number };
  setPredStats: (stats: { hits: number; misses: number; exact: number; total: number }) => void;
  activePatternCount?: number;
  soundEnabled?: boolean;
  setSoundEnabled?: (v: boolean) => void;
  sessionMode?: { label: string; color: string } | null;
}

const Navbar = memo(({
  isPolling, setIsPolling, isAnalyzing, triggerLearn,
  lastUpdate, fetchNumbers, fetchStored, autoLearnStatus,
  aiEnabled, setAiEnabled, predStats, setPredStats,
}: NavbarProps) => {
  const winPct = predStats.total > 0 ? ((predStats.hits / predStats.total) * 100).toFixed(0) : '—';
  const isWinning = predStats.total > 0 && (predStats.hits / predStats.total) >= 0.5;

  return (
    <nav className="border-b border-border/40 z-50 shrink-0 bg-card/95 backdrop-blur-md">
      <div className="max-w-[1400px] mx-auto px-4 flex items-center justify-between h-12">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/25 to-primary/5 border border-primary/30 flex items-center justify-center">
              <CircleDot className="w-4 h-4 text-primary" />
            </div>
            {isPolling && (
              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_6px_hsl(var(--primary)/0.6)]" />
            )}
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-display font-bold text-xs tracking-[0.15em] text-foreground">
              SNIPER <span className="text-primary">PRO</span>
            </span>
            <span className="text-[7px] text-muted-foreground/50 tracking-wider font-mono">v5.0</span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-[10px] font-mono font-bold">
            <span className="text-neon-green">{predStats.hits}✓</span>
            <span className="text-destructive">{predStats.misses}✗</span>
            <span className={`px-2 py-0.5 rounded border ${
              isWinning ? 'bg-neon-green/10 text-neon-green border-neon-green/20' : 'bg-destructive/10 text-destructive border-destructive/20'
            }`}>
              {winPct}%
            </span>
          </div>

          {autoLearnStatus !== 'idle' && aiEnabled && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-purple-500/10 border border-purple-500/20 animate-pulse">
              <Sparkles className="w-3 h-3 text-purple-400" />
              <span className="text-[7px] font-bold text-purple-400 tracking-wider">
                {autoLearnStatus === 'learning' ? 'APRENDENDO' : autoLearnStatus === 'analyzing' ? 'ANALISANDO' : 'TESTANDO'}
              </span>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5">
          <button onClick={triggerLearn} disabled={isAnalyzing || !aiEnabled}
            className="p-2 rounded-lg text-primary hover:bg-primary/10 transition-all disabled:opacity-30"
            title="Forçar Aprendizado">
            <Brain className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
          </button>

          <button onClick={() => { fetchNumbers(); fetchStored(); }}
            className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
            title="Atualizar">
            <RefreshCw className="w-4 h-4" />
          </button>

          <button onClick={() => setAiEnabled(!aiEnabled)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
              aiEnabled
                ? 'bg-primary/10 text-primary border-primary/25'
                : 'bg-destructive/10 text-destructive border-destructive/25'
            }`}>
            <Power className="w-3.5 h-3.5" />
            {aiEnabled ? 'IA ON' : 'IA OFF'}
          </button>

          <button onClick={() => setIsPolling(!isPolling)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
              isPolling
                ? 'bg-neon-green/10 text-neon-green border-neon-green/25'
                : 'bg-destructive/10 text-destructive border-destructive/25'
            }`}>
            {isPolling ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {isPolling ? 'LIVE' : 'OFF'}
          </button>

          {lastUpdate && (
            <span className="text-[8px] text-muted-foreground/50 font-mono hidden lg:inline">
              {lastUpdate.toLocaleTimeString('pt-BR')}
            </span>
          )}
        </div>
      </div>
    </nav>
  );
});

Navbar.displayName = 'Navbar';
export default Navbar;
