import {
  CircleDot, Brain, Shield, Wifi, WifiOff, RefreshCw, Download, History, Sparkles
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
}

const Navbar = ({
  isPolling, setIsPolling, isAnalyzing, triggerLearn,
  confidenceFilter, setConfidenceFilter, lastUpdate,
  fetchNumbers, fetchStored, autoLearnStatus, onShowHistory,
}: NavbarProps) => (
  <nav className="border-b border-border/60 px-4 py-0 z-50 shrink-0 glass relative overflow-hidden">
    {/* Subtle top accent line */}
    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
    
    <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-3 h-14">
      {/* Logo */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="relative">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 flex items-center justify-center shadow-neon-cyan">
            <CircleDot className="w-4 h-4 text-primary" />
          </div>
          <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_hsl(var(--primary)/0.6)]" />
        </div>
        <div className="hidden sm:flex flex-col">
          <span className="font-display font-bold text-xs tracking-[0.2em] text-foreground leading-none">
            ROULETTE <span className="text-primary text-glow-cyan">PRO</span>
          </span>
          <span className="text-[8px] text-muted-foreground tracking-wider">SISTEMA PREDITIVO</span>
        </div>
        <span className="text-[7px] px-2 py-1 rounded-md font-bold border bg-primary/10 text-primary border-primary/30 font-display tracking-widest shadow-neon-cyan">
          AI 24H
        </span>
        {autoLearnStatus !== 'idle' && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-neon-purple/10 border border-neon-purple/25 animate-pulse">
            <Sparkles className="w-3 h-3 text-purple-400" />
            <span className="text-[7px] font-bold text-purple-400 font-mono tracking-wider">
              {autoLearnStatus === 'learning' ? 'APRENDENDO' : autoLearnStatus === 'analyzing' ? 'ANALISANDO' : 'TESTANDO'}
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5">
        {/* IA Aprender */}
        <button onClick={triggerLearn} disabled={isAnalyzing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-bold transition-all border disabled:opacity-40
            bg-gradient-to-r from-primary/15 to-primary/5 text-primary border-primary/30 hover:from-primary/25 hover:to-primary/10 hover:shadow-neon-cyan">
          <Brain className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{isAnalyzing ? 'APRENDENDO...' : 'IA APRENDER'}</span>
        </button>

        {/* Filtro */}
        <button onClick={() => setConfidenceFilter(!confidenceFilter)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] font-bold transition-all border ${
            confidenceFilter
              ? 'bg-gold/10 text-gold border-gold/30 shadow-neon-gold'
              : 'bg-secondary/50 text-muted-foreground border-border/50'
          }`}>
          <Shield className="w-3 h-3" />
          <span className="hidden sm:inline">{confidenceFilter ? '70%+' : 'TODOS'}</span>
        </button>

        {/* Live */}
        <button onClick={() => setIsPolling(!isPolling)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[9px] font-bold transition-all border ${
            isPolling
              ? 'bg-neon-green/10 text-neon-green border-neon-green/30 shadow-neon-green'
              : 'bg-destructive/10 text-destructive border-destructive/30'
          }`}>
          {isPolling ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          <span className={`w-1.5 h-1.5 rounded-full ${isPolling ? 'bg-neon-green animate-pulse shadow-[0_0_6px_hsl(var(--neon-green)/0.6)]' : 'bg-destructive'}`} />
          {isPolling ? 'LIVE' : 'OFF'}
        </button>

        {/* Refresh */}
        <button onClick={() => { fetchNumbers(); fetchStored(); }}
          className="p-1.5 text-muted-foreground hover:text-primary transition-colors rounded-lg hover:bg-primary/10">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>

        {/* Histórico */}
        <button onClick={onShowHistory}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] font-bold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15 hover:shadow-neon-cyan transition-all">
          <History className="w-3 h-3" />
          <span className="hidden sm:inline">Histórico</span>
        </button>

        {/* Extensão */}
        <button
          onClick={() => {
            fetch('/roulette-extension.zip')
              .then(res => { if (!res.ok) throw new Error('Download failed'); return res.blob(); })
              .then(blob => {
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'roulette-extension.zip';
                a.click();
                URL.revokeObjectURL(a.href);
              })
              .catch(err => alert(err.message));
          }}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] font-bold bg-secondary/40 text-muted-foreground border border-border/50 hover:bg-secondary/70 hover:text-foreground transition-all"
        >
          <Download className="w-3 h-3" />
          <span className="hidden sm:inline">Extensão</span>
        </button>

        {/* Timestamp */}
        {lastUpdate && (
          <span className="text-[9px] text-primary/60 font-mono hidden md:inline tabular-nums">
            {lastUpdate.toLocaleTimeString('pt-BR')}
          </span>
        )}
      </div>
    </div>
  </nav>
);

export default Navbar;