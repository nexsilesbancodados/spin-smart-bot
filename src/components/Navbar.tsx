import {
  CircleDot, Brain, Shield, Wifi, WifiOff, RefreshCw, Download
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
}

const Navbar = ({
  isPolling, setIsPolling, isAnalyzing, triggerLearn,
  confidenceFilter, setConfidenceFilter, lastUpdate,
  fetchNumbers, fetchStored, autoLearnStatus,
}: NavbarProps) => (
  <nav className="bg-card/95 backdrop-blur-md border-b border-border px-4 py-2 z-50 shrink-0">
    <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 shrink-0">
        <CircleDot className="w-5 h-5 text-primary animate-spin-slow" />
        <span className="font-display text-sm tracking-[0.15em] text-primary font-bold hidden sm:inline">ROULETTE PRO</span>
        <span className="text-[7px] px-1.5 py-0.5 bg-primary/20 rounded-full text-primary font-bold border border-primary/30">AI 24H</span>
        {autoLearnStatus !== 'idle' && (
          <span className="text-[7px] px-1.5 py-0.5 bg-purple-500/20 rounded-full text-purple-400 font-bold border border-purple-500/30 animate-pulse">
            {autoLearnStatus === 'learning' ? '🧠' : autoLearnStatus === 'analyzing' ? '🔍' : '🎯'}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <button onClick={triggerLearn} disabled={isAnalyzing}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[9px] font-bold bg-primary/20 text-primary hover:bg-primary/30 transition-all border border-primary/30 disabled:opacity-50">
          <Brain className={`w-3 h-3 ${isAnalyzing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{isAnalyzing ? 'APRENDENDO...' : 'IA APRENDER'}</span>
        </button>
        <button onClick={() => setConfidenceFilter(!confidenceFilter)}
          className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[9px] font-bold transition-all ${
            confidenceFilter ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-secondary text-muted-foreground border border-border'
          }`}>
          <Shield className="w-3 h-3" />
          <span className="hidden sm:inline">{confidenceFilter ? '85%+' : 'TODOS'}</span>
        </button>
        <button onClick={() => setIsPolling(!isPolling)}
          className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[9px] font-bold transition-all ${
            isPolling ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-destructive/20 text-destructive border border-destructive/30'
          }`}>
          {isPolling ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          {isPolling ? 'LIVE' : 'OFF'}
        </button>
        <button onClick={() => { fetchNumbers(); fetchStored(); }} className="p-1.5 text-muted-foreground hover:text-primary transition-colors rounded-lg hover:bg-secondary">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
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
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[9px] font-bold bg-secondary text-muted-foreground border border-border hover:bg-muted transition-all"
        >
          <Download className="w-3 h-3" />
          <span className="hidden sm:inline">Extensão</span>
        </button>
        {lastUpdate && <span className="text-[8px] text-muted-foreground font-mono hidden md:inline">{lastUpdate.toLocaleTimeString('pt-BR')}</span>}
        <div className={`w-2 h-2 rounded-full ${isPolling ? 'bg-green-400 animate-pulse' : 'bg-muted'}`} />
      </div>
    </div>
  </nav>
);

export default Navbar;
