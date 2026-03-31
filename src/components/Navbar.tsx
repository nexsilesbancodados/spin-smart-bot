import { memo } from 'react';
import { motion } from 'framer-motion';
import {
  CircleDot, Brain, Wifi, WifiOff, Power, Sparkles, RefreshCw, Shield
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
    <nav className="glass-strong border-b border-border/10 z-50 shrink-0 relative overflow-hidden">
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-neon-cyan/40 via-neon-pink/30 to-neon-cyan/40" />
      
      <div className="max-w-[1400px] mx-auto px-4 flex items-center justify-between h-14">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <motion.div
              className="w-10 h-10 rounded-xl bg-gradient-to-br from-neon-cyan/20 to-neon-pink/15 border border-neon-cyan/25 flex items-center justify-center shadow-[0_0_15px_hsl(var(--neon-cyan)/0.2)]"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <CircleDot className="w-5 h-5 text-neon-cyan" />
            </motion.div>
            {isPolling && (
              <motion.div
                animate={{ scale: [1, 1.6, 1], opacity: [1, 0.4, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-neon-green shadow-[0_0_8px_hsl(var(--neon-green)/0.6)] border-2 border-background"
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
          <div className="hidden sm:flex items-center gap-2 text-[10px] font-mono font-bold">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl glass border border-border/15">
              <span className="text-neon-green">{predStats.hits}<span className="text-[8px] text-neon-green/50 ml-0.5">✓</span></span>
              <div className="w-px h-3 bg-border/20" />
              <span className="text-destructive/60">{predStats.misses}<span className="text-[8px] text-destructive/30 ml-0.5">✗</span></span>
            </div>
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border backdrop-blur-sm transition-all ${
              isWinning ? 'bg-neon-green/8 text-neon-green border-neon-green/20 shadow-[0_0_10px_hsl(var(--neon-green)/0.15)]' : 'bg-destructive/6 text-destructive border-destructive/10'
            }`}>
              <Shield className="w-3 h-3" />
              {winPct}%
            </div>
          </div>

          {autoLearnStatus !== 'idle' && aiEnabled && (
            <motion.div
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl glass border border-purple-500/15"
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
          <motion.button
            onClick={triggerLearn}
            disabled={isAnalyzing || !aiEnabled}
            whileTap={{ scale: 0.9 }}
            className="p-2.5 rounded-xl text-neon-cyan hover:bg-neon-cyan/8 transition-all disabled:opacity-20 border border-transparent hover:border-neon-cyan/15"
            title="Forçar Aprendizado"
          >
            <Brain className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
          </motion.button>

          <motion.button
            onClick={() => { fetchNumbers(); fetchStored(); }}
            whileTap={{ scale: 0.9 }}
            className="p-2.5 rounded-xl text-muted-foreground/50 hover:text-neon-cyan hover:bg-neon-cyan/8 transition-all border border-transparent hover:border-neon-cyan/15"
            title="Atualizar"
          >
            <RefreshCw className="w-4 h-4" />
          </motion.button>

          <motion.button
            onClick={() => setAiEnabled(!aiEnabled)}
            whileTap={{ scale: 0.95 }}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[10px] font-display font-bold transition-all border backdrop-blur-sm ${
              aiEnabled
                ? 'bg-neon-cyan/8 text-neon-cyan border-neon-cyan/20 shadow-[0_0_10px_hsl(var(--neon-cyan)/0.15)]'
                : 'bg-destructive/5 text-destructive/60 border-destructive/10'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            {aiEnabled ? 'IA ON' : 'IA OFF'}
          </motion.button>

          <motion.button
            onClick={() => setIsPolling(!isPolling)}
            whileTap={{ scale: 0.95 }}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[10px] font-display font-bold transition-all border backdrop-blur-sm ${
              isPolling
                ? 'bg-neon-green/6 text-neon-green border-neon-green/20 shadow-[0_0_10px_hsl(var(--neon-green)/0.15)]'
                : 'bg-destructive/5 text-destructive/60 border-destructive/10'
            }`}
          >
            {isPolling ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {isPolling ? 'LIVE' : 'OFF'}
          </motion.button>

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
