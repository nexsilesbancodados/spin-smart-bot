import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  CircleDot, Activity, Shield, ShieldCheck, MonitorPlay,
  RefreshCw, Wifi, WifiOff, Brain, Sparkles, TrendingUp,
  Hash, Flame, Snowflake, Target, BarChart3, ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const CAVALOS_258 = [2, 5, 8, 12, 15, 18, 22, 25, 28, 32, 35];

const getColor = (n: number): 'red' | 'black' | 'green' => {
  if (n === 0) return 'green';
  return RED_NUMBERS.includes(n) ? 'red' : 'black';
};

const colorClass = (n: number) => {
  const c = getColor(n);
  return c === 'red' ? 'bg-roulette-red text-white' : c === 'black' ? 'bg-roulette-black text-white' : 'bg-roulette-green text-white';
};

// Available roulette tables with their API/iframe configurations
const ROULETTE_TABLES = [
  { id: 'brasileira', name: 'Roleta Brasileira', provider: 'Playtech', iframeUrl: 'https://onabet.com/' },
  { id: 'immersiva', name: 'Roleta Immersiva', provider: 'Evolution', iframeUrl: 'https://onabet.com/' },
  { id: 'mega-fire', name: 'Mega Fire Blaze', provider: 'Playtech', iframeUrl: 'https://onabet.com/' },
  { id: 'xxxtreme', name: 'XXXtreme Roulette', provider: 'Evolution', iframeUrl: 'https://onabet.com/' },
  { id: 'speed', name: 'Speed Roulette', provider: 'Evolution', iframeUrl: 'https://onabet.com/' },
  { id: 'powerup', name: 'PowerUP Roulette', provider: 'Pragmatic', iframeUrl: 'https://onabet.com/' },
];

interface PatternInsight {
  id: string;
  pattern_type: string;
  description: string;
  confidence: number;
  numbers_involved: number[];
  recommendation: string;
  created_at: string;
}

const PATTERN_ICONS: Record<string, typeof Brain> = {
  streak: TrendingUp, terminal: Hash, dozen: BarChart3, column: BarChart3,
  hot: Flame, cold: Snowflake, parity: RefreshCw, sector: Target,
};

const Index = () => {
  const [selectedTable, setSelectedTable] = useState(ROULETTE_TABLES[0]);
  const [apiNumbers, setApiNumbers] = useState<number[]>([]);
  const [isPolling, setIsPolling] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [insights, setInsights] = useState<PatternInsight[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const prevNumbersRef = useRef<string>('');

  const fetchNumbers = useCallback(async () => {
    try {
      const res = await supabase.functions.invoke('proxy-roleta');
      if (res.error) throw new Error(res.error.message);
      const data = res.data;
      if (data?.results && Array.isArray(data.results)) {
        const nums = data.results.slice(0, 100).map((n: unknown) => Number(n)).filter((n: number) => !isNaN(n) && n >= 0 && n <= 36);
        const key = nums.join(',');
        if (key !== prevNumbersRef.current) {
          prevNumbersRef.current = key;
          setApiNumbers(nums);
          setLastUpdate(new Date());
        }
        setError(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar dados');
    }
  }, []);

  useEffect(() => {
    fetchNumbers();
    if (!isPolling) return;
    const interval = setInterval(fetchNumbers, 3000);
    return () => clearInterval(interval);
  }, [fetchNumbers, isPolling]);

  const loadInsights = useCallback(async () => {
    const { data } = await supabase
      .from('pattern_insights')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setInsights(data as PatternInsight[]);
  }, []);

  useEffect(() => { loadInsights(); }, [loadInsights]);

  useEffect(() => {
    const channel = supabase
      .channel('pattern_insights_rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pattern_insights' }, () => loadInsights())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadInsights]);

  const triggerAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      await supabase.functions.invoke('auto-analyze-patterns');
      await loadInsights();
    } catch (err) { console.error(err); }
    finally { setIsAnalyzing(false); }
  };

  // Cavalos 258 logic
  const isCavalo = (n: number) => CAVALOS_258.includes(n);
  const latestNumber = apiNumbers[0];
  const isCavaloEntry = latestNumber !== undefined && isCavalo(latestNumber);

  // Terminal analysis
  const terminalFreq = apiNumbers.reduce<Record<number, number>>((acc, n) => {
    const t = n % 10; acc[t] = (acc[t] || 0) + 1; return acc;
  }, {});
  const maxTerminalFreq = Math.max(...Object.values(terminalFreq), 1);

  // Rows of 20 for history display
  const rows: number[][] = [];
  for (let i = 0; i < apiNumbers.length; i += 20) rows.push(apiNumbers.slice(i, i + 20));

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Navbar */}
      <nav className="bg-card/95 backdrop-blur-md border-b border-border px-4 py-2.5 z-50 shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CircleDot className="w-5 h-5 text-primary animate-spin-slow" />
            <span className="font-display text-sm tracking-[0.15em] text-primary font-bold">ROULETTE PRO</span>
            <span className="text-[8px] px-2 py-0.5 bg-primary/20 rounded-full text-primary font-bold border border-primary/30">AI 24H</span>
          </div>

          {/* Roulette Selector */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <select
                value={selectedTable.id}
                onChange={e => {
                  const t = ROULETTE_TABLES.find(r => r.id === e.target.value);
                  if (t) setSelectedTable(t);
                }}
                className="bg-secondary border border-border rounded-lg px-4 py-1.5 text-[11px] font-semibold text-foreground appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary pr-8 min-w-[180px]"
              >
                {ROULETTE_TABLES.map(t => (
                  <option key={t.id} value={t.id} className="bg-card">{t.provider} — {t.name}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button onClick={triggerAnalysis} disabled={isAnalyzing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-primary/20 text-primary hover:bg-primary/30 transition-all border border-primary/30 disabled:opacity-50">
              <Brain className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-pulse' : ''}`} />
              {isAnalyzing ? 'ANALISANDO...' : 'IA ANALISAR'}
            </button>
            <button onClick={() => setIsPolling(!isPolling)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                isPolling ? 'bg-neon-green/20 text-green-400 border border-green-500/30' : 'bg-destructive/20 text-destructive border border-destructive/30'
              }`}>
              {isPolling ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              {isPolling ? 'AO VIVO' : 'PAUSADO'}
            </button>
            <button onClick={fetchNumbers} className="p-1.5 text-muted-foreground hover:text-primary transition-colors rounded-lg hover:bg-secondary">
              <RefreshCw className="w-4 h-4" />
            </button>
            {lastUpdate && <span className="text-[9px] text-muted-foreground font-mono">{lastUpdate.toLocaleTimeString('pt-BR')}</span>}
            <div className={`w-2.5 h-2.5 rounded-full ${isPolling ? 'bg-green-400 animate-pulse' : 'bg-muted'}`} />
          </div>
        </div>
      </nav>

      {/* Main content — stacked cards */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-4 space-y-4">

          {/* CARD 1: HISTÓRICO */}
          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                <span className="font-display text-base text-primary tracking-widest font-bold">HISTÓRICO</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-muted-foreground font-mono">{selectedTable.provider} — {selectedTable.name}</span>
                <span className="text-[10px] text-muted-foreground font-mono">{apiNumbers.length} números</span>
              </div>
            </div>

            {apiNumbers.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">Aguardando dados da API...</div>
            ) : (
              <div className="space-y-1.5">
                {rows.map((row, rowIdx) => (
                  <div key={rowIdx} className="flex gap-1 justify-start flex-wrap">
                    {row.map((n, i) => {
                      const globalIdx = rowIdx * 20 + i;
                      const isInCavaloZone = globalIdx < 80;
                      const isCavaloNum = isCavalo(n);
                      const highlight = isInCavaloZone && isCavaloNum;

                      return (
                        <motion.div
                          key={`${rowIdx}-${i}-${n}`}
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ duration: 0.15, delay: i * 0.006 }}
                          className={`w-[38px] h-[38px] rounded-full flex items-center justify-center text-[11px] font-bold shadow-md hover:scale-110 transition-transform cursor-default border
                            ${highlight
                              ? 'bg-yellow-400 text-black border-yellow-300 shadow-yellow-400/30 shadow-lg ring-2 ring-yellow-300/50'
                              : `${colorClass(n)} border-white/10`
                            }`}
                        >
                          {n}
                        </motion.div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}

            {/* Legend */}
            <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-full bg-roulette-red border border-white/10" />
                <span className="text-[9px] text-muted-foreground">Vermelho</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-full bg-roulette-black border border-white/10" />
                <span className="text-[9px] text-muted-foreground">Preto</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-full bg-roulette-green border border-white/10" />
                <span className="text-[9px] text-muted-foreground">Zero</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-full bg-yellow-400 border border-yellow-300" />
                <span className="text-[9px] text-muted-foreground">Cavalos 258</span>
              </div>
            </div>
          </div>

          {/* CARD 2: MONITORAMENTO */}
          <motion.div
            className={`rounded-xl border p-5 transition-all ${
              isCavaloEntry
                ? 'bg-gradient-to-r from-primary/20 to-yellow-500/10 border-primary/50 shadow-lg shadow-primary/10'
                : 'bg-card border-border'
            }`}
            animate={{ scale: isCavaloEntry ? [1, 1.005, 1] : 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-3">
              {isCavaloEntry ? (
                <ShieldCheck className="w-8 h-8 text-primary animate-pulse" />
              ) : (
                <Shield className="w-8 h-8 text-muted-foreground" />
              )}
              <div>
                <span className="font-display text-base tracking-widest font-bold block mb-0.5"
                  style={{ color: isCavaloEntry ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))' }}>
                  MONITORAMENTO
                </span>
                <span className={`text-lg font-bold ${isCavaloEntry ? 'text-primary' : 'text-muted-foreground'}`}>
                  {apiNumbers.length === 0
                    ? 'Aguardando dados...'
                    : isCavaloEntry
                      ? '🐴 Fazer entrada nos CAVALOS 258!'
                      : '👁️ Monitorando as leituras...'
                  }
                </span>
              </div>
              {latestNumber !== undefined && (
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground font-mono">Último:</span>
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shadow-lg
                    ${isCavalo(latestNumber) ? 'bg-yellow-400 text-black ring-2 ring-yellow-300/50' : colorClass(latestNumber)}
                    border border-white/20`}>
                    {latestNumber}
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* CARD 3: ANÁLISE DE TERMINAIS + INSIGHTS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Terminal Analysis */}
            <div className="bg-card rounded-xl border border-border p-5">
              <div className="flex items-center gap-2 mb-4">
                <Hash className="w-5 h-5 text-primary" />
                <span className="font-display text-base text-primary tracking-widest font-bold">TERMINAIS</span>
              </div>
              <div className="grid grid-cols-10 gap-2">
                {Array.from({ length: 10 }, (_, t) => {
                  const freq = terminalFreq[t] || 0;
                  const pct = maxTerminalFreq > 0 ? (freq / maxTerminalFreq) * 100 : 0;
                  const isHot = pct > 70;
                  return (
                    <div key={t} className="flex flex-col items-center gap-1.5">
                      <div className="w-full bg-secondary/50 rounded-lg h-20 flex flex-col-reverse overflow-hidden border border-border/50">
                        <motion.div
                          className={`rounded-lg ${isHot ? 'bg-gradient-to-t from-primary to-primary/60' : 'bg-gradient-to-t from-muted-foreground/40 to-muted-foreground/20'}`}
                          animate={{ height: `${pct}%` }}
                          transition={{ duration: 0.5 }}
                        />
                      </div>
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold border ${
                        isHot ? 'bg-primary/20 border-primary/50 text-primary' : 'bg-secondary border-border text-muted-foreground'
                      }`}>
                        {t}
                      </div>
                      <span className={`text-[9px] font-mono font-bold ${isHot ? 'text-primary' : 'text-muted-foreground'}`}>{freq}x</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* AI Insights */}
            <div className="bg-card rounded-xl border border-primary/20 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  <span className="font-display text-base text-primary tracking-widest font-bold">INSIGHTS IA</span>
                  <span className="text-[8px] px-1.5 py-0.5 bg-primary/20 rounded-full text-primary border border-primary/30 font-bold">24H</span>
                </div>
                <span className="text-[9px] text-muted-foreground font-mono">{insights.length} padrões</span>
              </div>

              {insights.length === 0 ? (
                <div className="text-center py-6">
                  <Brain className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-[11px] text-muted-foreground">Clique "IA ANALISAR" ou aguarde a análise automática</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                  <AnimatePresence mode="popLayout">
                    {insights.slice(0, 10).map((insight) => {
                      const Icon = PATTERN_ICONS[insight.pattern_type] || Brain;
                      return (
                        <motion.div key={insight.id}
                          initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                          className="bg-secondary/50 rounded-lg border border-border p-3 hover:border-primary/30 transition-colors">
                          <div className="flex items-start gap-2">
                            <Icon className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[8px] font-bold uppercase tracking-wider text-primary">{insight.pattern_type}</span>
                                <div className="flex items-center gap-1 ml-auto">
                                  <div className="w-10 h-1.5 bg-secondary rounded-full overflow-hidden">
                                    <div className="h-full rounded-full bg-primary" style={{ width: `${insight.confidence}%` }} />
                                  </div>
                                  <span className="text-[8px] font-mono text-muted-foreground">{insight.confidence}%</span>
                                </div>
                              </div>
                              <p className="text-[10px] text-foreground/90 leading-relaxed">{insight.description}</p>
                              {insight.recommendation && (
                                <p className="text-[9px] text-primary/80 italic mt-1">💡 {insight.recommendation}</p>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>

          {/* CARD 4: IFRAME ONABET */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-border">
              <MonitorPlay className="w-5 h-5 text-primary" />
              <span className="font-display text-base text-primary tracking-widest font-bold">CASSINO AO VIVO</span>
              <span className="text-[10px] text-muted-foreground ml-2">— {selectedTable.name}</span>
            </div>
            <div className="w-full" style={{ height: '600px' }}>
              <iframe
                src={selectedTable.iframeUrl}
                className="w-full h-full border-0"
                allowFullScreen
                allow="autoplay; fullscreen; microphone; camera"
                sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-top-navigation"
              />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Index;
