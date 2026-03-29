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
  <nav className="border-b border-border/60 px-4 py-0 z-50 shrink-0"
    style={{ background: 'linear-gradient(180deg, hsl(var(--card)) 0%, hsl(var(--card) / 0.95) 100%)' }}>
    <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-3 h-12">
      {/* Logo */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="relative">
          <CircleDot className="w-5 h-5 text-primary" />
          <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary animate-pulse" />
        </div>
        <span className="font-bold text-sm tracking-[0.12em] text-foreground hidden sm:inline">
          ROULETTE <span className="text-primary">PRO</span>
        </span>
        <span className="text-[8px] px-2 py-0.5 rounded-md font-bold border bg-primary/10 text-primary border-primary/30">
          AI 24H
        </span>
        {autoLearnStatus !== 'idle' && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/25 animate-pulse">
            <Sparkles className="w-3 h-3 text-purple-400" />
            <span className="text-[7px] font-bold text-purple-400">
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
            bg-gradient-to-r from-primary/15 to-primary/5 text-primary border-primary/30 hover:from-primary/25 hover:to-primary/10">
          <Brain className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{isAnalyzing ? 'APRENDENDO...' : 'IA APRENDER'}</span>
        </button>

        {/* Filtro */}
        <button onClick={() => setConfidenceFilter(!confidenceFilter)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] font-bold transition-all border ${
            confidenceFilter
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              : 'bg-secondary/50 text-muted-foreground border-border/50'
          }`}>
          <Shield className="w-3 h-3" />
          <span className="hidden sm:inline">{confidenceFilter ? '70%+' : 'TODOS'}</span>
        </button>

        {/* Live */}
        <button onClick={() => setIsPolling(!isPolling)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[9px] font-bold transition-all border ${
            isPolling
              ? 'bg-green-500/10 text-green-400 border-green-500/30'
              : 'bg-destructive/10 text-destructive border-destructive/30'
          }`}>
          {isPolling ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          <span className={`w-1.5 h-1.5 rounded-full ${isPolling ? 'bg-green-400 animate-pulse' : 'bg-destructive'}`} />
          {isPolling ? 'LIVE' : 'OFF'}
        </button>

        {/* Refresh */}
        <button onClick={() => { fetchNumbers(); fetchStored(); }}
          className="p-1.5 text-muted-foreground hover:text-primary transition-colors rounded-lg hover:bg-secondary/50">
          <RefreshCw className="w-3.5 h-3.5" />
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
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] font-bold bg-secondary/40 text-muted-foreground border border-border/50 hover:bg-secondary/70 transition-all"
        >
          <Download className="w-3 h-3" />
          <span className="hidden sm:inline">Extensão</span>
        </button>

        {/* Timestamp */}
        {lastUpdate && (
          <span className="text-[9px] text-muted-foreground/60 font-mono hidden md:inline tabular-nums">
            {lastUpdate.toLocaleTimeString('pt-BR')}
          </span>
        )}
      </div>
    </div>
  </nav>
);

export default Navbar;
