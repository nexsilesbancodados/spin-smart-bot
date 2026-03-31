import { memo } from 'react';
import { motion } from 'framer-motion';
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
  aiEnabled, setAiEnabled, predStats,
}: NavbarProps) => {
  const winPct = predStats.total > 0 ? ((predStats.hits / predStats.total) * 100).toFixed(0) : '—';
  const isWinning = predStats.total > 0 && (predStats.hits / predStats.total) >= 0.5;

  return (
    <nav className="glass-strong border-b border-border/10 z-50 shrink-0">
      <div className="max-w-[1400px] mx-auto px-4 flex items-center justify-between h-14">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-neon-cyan/20 to-neon-pink/10 border border-neon-cyan/25 flex items-center justify-center shadow-neon-cyan">
              <CircleDot className="w-4.5 h-4.5 text-neon-cyan" />
            </div>
            {isPolling && (
              <motion.div
                animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-neon-green shadow-neon-green border border-background"
              />
            )}
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-display font-bold text-sm tracking-[0.15em]">
              <span className="text-neon-cyan">SNIPER</span> <span className="text-neon-pink">PRO</span>
            </span>
            <span className="text-[7px] text-muted-foreground/30 tracking-wider font-mono">v5.0 — Roleta Brasileira</span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono font-bold">
            <span className="text-neon-green">{predStats.hits}✓</span>
            <span className="text-destructive/60">{predStats.misses}✗</span>
            <span className={`px-2.5 py-1 rounded-xl border backdrop-blur-sm ${
              isWinning ? 'bg-neon-green/8 text-neon-green border-neon-green/15 shadow-neon-green' : 'bg-destructive/6 text-destructive border-destructive/10'
            }`}>
              {winPct}%
            </span>
          </div>

          {autoLearnStatus !== 'idle' && aiEnabled && (
            <motion.div
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl glass border border-purple-500/15"
            >
              <Sparkles className="w-3 h-3 text-purple-400" />
              <span className="text-[7px] font-display font-bold text-purple-400 tracking-wider uppercase">
                {autoLearnStatus === 'learning' ? 'APRENDENDO' : autoLearnStatus === 'analyzing' ? 'ANALISANDO' : 'TESTANDO'}
              </span>
            </motion.div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5">
          <button onClick={triggerLearn} disabled={isAnalyzing || !aiEnabled}
            className="p-2.5 rounded-xl text-neon-cyan hover:bg-neon-cyan/8 transition-all disabled:opacity-20 border border-transparent hover:border-neon-cyan/15"
            title="Forçar Aprendizado">
            <Brain className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
          </button>

          <button onClick={() => { fetchNumbers(); fetchStored(); }}
            className="p-2.5 rounded-xl text-muted-foreground/50 hover:text-neon-cyan hover:bg-neon-cyan/8 transition-all border border-transparent hover:border-neon-cyan/15"
            title="Atualizar">
            <RefreshCw className="w-4 h-4" />
          </button>

          <button onClick={() => setAiEnabled(!aiEnabled)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[10px] font-display font-bold transition-all border backdrop-blur-sm ${
              aiEnabled
                ? 'bg-neon-cyan/8 text-neon-cyan border-neon-cyan/20 shadow-neon-cyan'
                : 'bg-destructive/5 text-destructive/60 border-destructive/10'
            }`}>
            <Power className="w-3.5 h-3.5" />
            {aiEnabled ? 'IA ON' : 'IA OFF'}
          </button>

          <button onClick={() => setIsPolling(!isPolling)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[10px] font-display font-bold transition-all border backdrop-blur-sm ${
              isPolling
                ? 'bg-neon-green/6 text-neon-green border-neon-green/20 shadow-neon-green'
                : 'bg-destructive/5 text-destructive/60 border-destructive/10'
            }`}>
            {isPolling ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {isPolling ? 'LIVE' : 'OFF'}
          </button>

          {lastUpdate && (
            <span className="text-[8px] text-muted-foreground/25 font-mono hidden lg:inline ml-1">
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
