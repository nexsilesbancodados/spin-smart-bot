import {
  CircleDot, Brain, Shield, Wifi, WifiOff, RefreshCw, Download, History, Sparkles, Power, ChevronDown
} from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const STRATEGY_OPTIONS = [
  { value: 'all', label: 'Todas Estratégias' },
  { value: 'setor', label: '🎯 Vizinhos/Setor' },
  { value: 'terminal', label: '🔢 Terminais' },
  { value: 'cavalos', label: '🐎 Cavalos' },
  { value: 'duzia', label: '🎲 Dúzias' },
  { value: 'coluna', label: '📐 Colunas' },
  { value: 'cor', label: '🎨 Cor' },
  { value: 'paridade', label: '🔄 Par/Ímpar' },
  { value: 'alto_baixo', label: '↕️ Alto/Baixo' },
  { value: 'fusao', label: '⚡ Fusão/Convergência' },
  { value: 'puxada', label: '🧲 Puxada' },
  { value: 'zero', label: '🟢 Pressão Zero' },
  { value: 'rua', label: '🛣️ Ruas' },
  { value: 'hiper_quente', label: '🔥 Fase Quente' },
  { value: 'sequencia', label: '🔢 Múltiplos/Sequência' },
];

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

const Navbar = ({
  isPolling, setIsPolling, isAnalyzing, triggerLearn,
  confidenceFilter, setConfidenceFilter, lastUpdate,
  fetchNumbers, fetchStored, autoLearnStatus, onShowHistory,
  aiEnabled, setAiEnabled, strategyFilter, setStrategyFilter,
  predStats, setPredStats, activePatternCount, soundEnabled, setSoundEnabled, sessionMode,
}: NavbarProps) => {
  const winPct = predStats.total > 0 ? ((predStats.hits / predStats.total) * 100).toFixed(1) : '0.0';
  const isWinning = predStats.total > 0 && (predStats.hits / predStats.total) >= 0.5;

  return (
    <nav className="border-b border-border/40 z-50 shrink-0 relative overflow-hidden bg-card/95 backdrop-blur-md">
      {/* Top accent */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

      {/* ═══ ROW 1: Brand + Controls ═══ */}
      <div className="max-w-[1600px] mx-auto px-3 flex items-center justify-between h-11">
        {/* Logo */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="relative">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary/25 to-primary/5 border border-primary/30 flex items-center justify-center">
              <CircleDot className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_6px_hsl(var(--primary)/0.6)]" />
          </div>
          <div className="hidden sm:flex flex-col leading-none">
            <span className="font-display font-bold text-[11px] tracking-[0.2em] text-foreground">
              ROULETTE <span className="text-primary">PRO</span>
            </span>
            <span className="text-[7px] text-muted-foreground/60 tracking-wider">SISTEMA PREDITIVO</span>
          </div>
        </div>

        {/* Center: Strategy Filter + AI Toggle */}
        <div className="flex items-center gap-1.5">
          <span className="text-[7px] px-1.5 py-0.5 rounded font-bold border bg-primary/10 text-primary border-primary/30 font-display tracking-widest hidden md:inline-block">
            AI 24H
          </span>

          {activePatternCount != null && activePatternCount > 0 && (
            <div className="hidden md:flex items-center gap-1 text-[7px] px-1.5 py-0.5 rounded-md bg-secondary border border-border">
              <span className="text-green-400 font-bold">{activePatternCount}</span>
              <span className="text-muted-foreground">padrões</span>
            </div>
          )}

          {sessionMode && (
            <div className={`hidden md:flex items-center gap-1 text-[8px] font-bold ${sessionMode.color}`}>
              {sessionMode.label}
            </div>
          )}

          {setSoundEnabled && (
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[8px] font-bold border transition-all ${
                soundEnabled
                  ? 'bg-primary/10 text-primary border-primary/25'
                  : 'bg-secondary/40 text-muted-foreground border-border/40'
              }`}
              title={soundEnabled ? 'Som ligado' : 'Som desligado'}
            >
              {soundEnabled ? '🔊' : '🔇'}
            </button>
          )}

          <Select value={strategyFilter} onValueChange={setStrategyFilter}>
            <SelectTrigger className="h-7 w-[130px] sm:w-[160px] text-[9px] font-bold border-primary/25 bg-primary/5 text-primary rounded-md px-2 py-0 gap-1 focus:ring-1 focus:ring-primary/30">
              <SelectValue placeholder="Estratégia" />
            </SelectTrigger>
            <SelectContent className="text-[10px]">
              {STRATEGY_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value} className="text-[10px]">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* IA ON/OFF */}
          <button onClick={() => setAiEnabled(!aiEnabled)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[9px] font-bold transition-all border ${
              aiEnabled
                ? 'bg-primary/12 text-primary border-primary/25'
                : 'bg-destructive/10 text-destructive border-destructive/25'
            }`}>
            <Power className="w-3 h-3" />
            <span>{aiEnabled ? 'IA ON' : 'IA OFF'}</span>
            <span className={`w-1.5 h-1.5 rounded-full ${aiEnabled ? 'bg-primary animate-pulse' : 'bg-destructive'}`} />
          </button>

          {autoLearnStatus !== 'idle' && aiEnabled && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-neon-purple/10 border border-neon-purple/20 animate-pulse">
              <Sparkles className="w-2.5 h-2.5 text-purple-400" />
              <span className="text-[7px] font-bold text-purple-400 font-mono tracking-wider">
                {autoLearnStatus === 'learning' ? 'APRENDENDO' : autoLearnStatus === 'analyzing' ? 'ANALISANDO' : 'TESTANDO'}
              </span>
            </div>
          )}

          {/* IA Aprender */}
          <button onClick={triggerLearn} disabled={isAnalyzing || !aiEnabled}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[9px] font-bold transition-all border disabled:opacity-30
              bg-primary/8 text-primary border-primary/25 hover:bg-primary/15">
            <Brain className={`w-3 h-3 ${isAnalyzing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isAnalyzing ? 'APRENDENDO...' : 'APRENDER'}</span>
          </button>

          {/* Filtro confiança */}
          <button onClick={() => setConfidenceFilter(!confidenceFilter)}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-bold transition-all border ${
              confidenceFilter
                ? 'bg-gold/10 text-gold border-gold/25'
                : 'bg-secondary/40 text-muted-foreground border-border/40'
            }`}>
            <Shield className="w-3 h-3" />
            <span className="hidden sm:inline">{confidenceFilter ? '70%+' : 'TODOS'}</span>
          </button>

          {/* Live */}
          <button onClick={() => setIsPolling(!isPolling)}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-bold transition-all border ${
              isPolling
                ? 'bg-neon-green/10 text-neon-green border-neon-green/25'
                : 'bg-destructive/10 text-destructive border-destructive/25'
            }`}>
            {isPolling ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            <span className={`w-1.5 h-1.5 rounded-full ${isPolling ? 'bg-neon-green animate-pulse' : 'bg-destructive'}`} />
            <span>{isPolling ? 'LIVE' : 'OFF'}</span>
          </button>
        </div>

        {/* Right: Quick actions */}
        <div className="flex items-center gap-1">
          <button onClick={() => { fetchNumbers(); fetchStored(); }}
            className="p-1.5 text-muted-foreground hover:text-primary transition-colors rounded-md hover:bg-primary/8">
            <RefreshCw className="w-3 h-3" />
          </button>
          <button onClick={onShowHistory}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-bold bg-primary/8 text-primary border border-primary/20 hover:bg-primary/15 transition-all">
            <History className="w-3 h-3" />
            <span className="hidden sm:inline">Histórico</span>
          </button>
          <button
            onClick={() => {
              fetch('/roulette-extension.zip')
                .then(res => {
                  if (!res.ok) {
                    alert(`INSTALAR A EXTENSÃO SPIN SMART BOT:\n\n1. Baixe o arquivo ZIP da extensão\n2. Abra o Chrome e vá em: chrome://extensions\n3. Ative "Modo do desenvolvedor" (canto superior direito)\n4. Clique em "Carregar sem compactação"\n5. Selecione a pasta da extensão\n6. Acesse onabet.com na mesma aba do Chrome\n7. Ative o AutoBet no painel do app\n\nA extensão captura os números automaticamente e\nfaz as apostas quando você ativar o AutoBet! 🤖`);
                    return;
                  }
                  return res.blob();
                })
                .then(blob => {
                  if (!blob) return;
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(blob);
                  a.download = 'spin-smart-bot-extension.zip';
                  a.click();
                  URL.revokeObjectURL(a.href);
                })
                .catch(() => alert('Use o botão para ver instruções de instalação.'));
            }}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-bold bg-primary/8 text-primary border border-primary/20 hover:bg-primary/15 transition-all"
            title="Instalar extensão Chrome para autobet"
          >
            <Download className="w-3 h-3" />
            <span className="hidden sm:inline">Extensão</span>
          </button>
          {lastUpdate && (
            <span className="text-[8px] text-primary/50 font-mono hidden lg:inline tabular-nums ml-1">
              {lastUpdate.toLocaleTimeString('pt-BR')}
            </span>
          )}
        </div>
      </div>

      {/* ═══ ROW 2: Stats Bar (integrated) ═══ */}
      <div className="border-t border-border/20 bg-background/30">
        <div className="max-w-[1600px] mx-auto px-3 flex items-center justify-center gap-3 h-8 overflow-x-auto">
          {/* Total */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[7px] text-muted-foreground/60 font-bold tracking-[0.15em] uppercase font-display">Previsões</span>
            <span className="text-[11px] font-mono font-black text-primary bg-primary/8 px-2 py-0.5 rounded border border-primary/15">
              {predStats.total}
            </span>
          </div>

          <div className="w-px h-3 bg-border/30 shrink-0" />

          {/* Acertos */}
          <div className="flex items-center gap-1 shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-neon-green shadow-[0_0_4px_hsl(var(--neon-green)/0.5)]" />
            <span className="text-[11px] font-mono font-black text-neon-green">{predStats.hits}</span>
            <span className="text-[7px] text-muted-foreground/50 uppercase tracking-wide">Acertos</span>
          </div>

          {/* Erros */}
          <div className="flex items-center gap-1 shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-destructive shadow-[0_0_4px_hsl(var(--destructive)/0.4)]" />
            <span className="text-[11px] font-mono font-black text-destructive">{predStats.misses}</span>
            <span className="text-[7px] text-muted-foreground/50 uppercase tracking-wide">Erros</span>
          </div>

          {/* Exatos */}
          <div className="flex items-center gap-1 shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_4px_hsl(var(--primary)/0.5)]" />
            <span className="text-[11px] font-mono font-black text-primary">{predStats.exact}</span>
            <span className="text-[7px] text-muted-foreground/50 uppercase tracking-wide">Exatos</span>
          </div>

          <div className="w-px h-3 bg-border/30 shrink-0" />

          {/* Win Rate Badge */}
          <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-bold border shrink-0 ${
            isWinning
              ? 'bg-neon-green/8 text-neon-green border-neon-green/20'
              : 'bg-destructive/8 text-destructive border-destructive/20'
          }`}>
            <span className="font-mono font-black">{winPct}%</span>
            <span className="text-[6px] opacity-60 font-display tracking-[0.2em]">WIN</span>
          </div>

          {/* Mini progress */}
          {predStats.total > 0 && (
            <div className="w-20 h-1 bg-secondary/40 rounded-full overflow-hidden hidden sm:block shrink-0">
              <div
                className={`h-full rounded-full transition-all duration-700 ${isWinning ? 'bg-neon-green' : 'bg-destructive'}`}
                style={{ width: `${Math.min(parseFloat(winPct), 100)}%` }}
              />
            </div>
          )}

          {/* Reset */}
          <button onClick={async () => {
            const { supabase } = await import('@/integrations/supabase/client');
            await supabase.from('prediction_history').delete().not('id', 'is', null);
            setPredStats({ hits: 0, misses: 0, exact: 0, total: 0 });
          }} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[7px] font-bold text-destructive/60 hover:text-destructive hover:bg-destructive/10 transition-all shrink-0">
            <RefreshCw className="w-2 h-2" /> ZERAR
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
