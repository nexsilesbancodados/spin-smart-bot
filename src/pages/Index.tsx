import { useState, useEffect, useRef, useCallback } from 'react';
import { useRoulette } from '@/contexts/RouletteContext';
import { getNumberColor } from '@/lib/roulette';
import AlertBanner from '@/components/AlertBanner';
import AIAnalysis from '@/components/AIAnalysis';
import DebugModal from '@/components/DebugModal';
import {
  CircleDot, ChevronDown, Flame, Snowflake,
  Hash, Activity, Zap, RefreshCw, Wifi, WifiOff,
  Brain, TrendingUp, Target, BarChart3, Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

const getColor = (n: number): 'red' | 'black' | 'green' => {
  if (n === 0) return 'green';
  return RED_NUMBERS.includes(n) ? 'red' : 'black';
};

const colorClass = (n: number) => {
  const c = getColor(n);
  return c === 'red' ? 'bg-roulette-red' : c === 'black' ? 'bg-roulette-black' : 'bg-roulette-green';
};

const PROVIDERS: Record<string, { label: string; tables: string[] }> = {
  Playtech: { label: 'Playtech', tables: ['Roleta Brasileira', 'Mega Fire Blaze', 'Roulette'] },
  Evolution: { label: 'Evolution', tables: ['Roleta Immersiva', 'Roulette Evo', 'XXXtreme', 'Roleta ao Vivo'] },
};

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
  streak: TrendingUp,
  terminal: Hash,
  dozen: BarChart3,
  column: BarChart3,
  hot: Flame,
  cold: Snowflake,
  parity: RefreshCw,
  sector: Target,
};

const PATTERN_COLORS: Record<string, string> = {
  streak: 'text-roulette-red',
  terminal: 'text-accent',
  dozen: 'text-primary',
  column: 'text-primary',
  hot: 'text-destructive',
  cold: 'text-blue-400',
  parity: 'text-yellow-400',
  sector: 'text-accent',
};

const Index = () => {
  const { provider, table, setProvider, setTable } = useRoulette();
  const [apiNumbers, setApiNumbers] = useState<number[]>([]);
  const [isPolling, setIsPolling] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [insights, setInsights] = useState<PatternInsight[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const prevNumbersRef = useRef<string>('');

  // Fetch numbers from API via proxy
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

  // Poll API every 3 seconds
  useEffect(() => {
    fetchNumbers();
    if (!isPolling) return;
    const interval = setInterval(fetchNumbers, 3000);
    return () => clearInterval(interval);
  }, [fetchNumbers, isPolling]);

  // Load stored AI insights
  const loadInsights = useCallback(async () => {
    const { data } = await supabase
      .from('pattern_insights')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);
    if (data) setInsights(data as PatternInsight[]);
  }, []);

  useEffect(() => { loadInsights(); }, [loadInsights]);

  // Realtime: listen for new pattern insights
  useEffect(() => {
    const channel = supabase
      .channel('pattern_insights_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pattern_insights' }, () => {
        loadInsights();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadInsights]);

  // Trigger manual AI analysis
  const triggerAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const res = await supabase.functions.invoke('auto-analyze-patterns');
      if (res.error) throw new Error(res.error.message);
      await loadInsights();
    } catch (err) {
      console.error('Analysis error:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Stats
  const terminalFreq = apiNumbers.reduce<Record<number, number>>((acc, n) => {
    const t = n % 10; acc[t] = (acc[t] || 0) + 1; return acc;
  }, {});
  const maxTerminalFreq = Math.max(...Object.values(terminalFreq), 1);
  const redCount = apiNumbers.filter(n => getColor(n) === 'red').length;
  const blackCount = apiNumbers.filter(n => getColor(n) === 'black').length;
  const greenCount = apiNumbers.filter(n => getColor(n) === 'green').length;
  const total = apiNumbers.length || 1;

  const freqMap = apiNumbers.reduce<Record<number, number>>((acc, n) => { acc[n] = (acc[n] || 0) + 1; return acc; }, {});
  const sorted = Object.entries(freqMap).map(([n, f]) => ({ number: Number(n), freq: f })).sort((a, b) => b.freq - a.freq);
  const hotNums = sorted.slice(0, 8);
  const coldNums = sorted.slice(-8).reverse();

  // Dozen stats
  const d1 = apiNumbers.filter(n => n >= 1 && n <= 12).length;
  const d2 = apiNumbers.filter(n => n >= 13 && n <= 24).length;
  const d3 = apiNumbers.filter(n => n >= 25 && n <= 36).length;

  // Rows of 20
  const rows: number[][] = [];
  for (let i = 0; i < apiNumbers.length; i += 20) rows.push(apiNumbers.slice(i, i + 20));

  return (
    <div className="h-screen bg-gradient-casino flex flex-col overflow-hidden text-foreground">
      {/* Top Navbar */}
      <nav className="bg-card/95 backdrop-blur-md border-b border-border px-4 py-2 z-50 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CircleDot className="w-5 h-5 text-primary animate-spin-slow" />
            <span className="font-display text-xs tracking-[0.2em] text-glow-cyan font-bold">ROULETTE ANALYTICS</span>
            <span className="text-[8px] px-2 py-0.5 bg-accent/20 rounded-full text-accent font-bold border border-accent/30">AI PRO</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={triggerAnalysis}
              disabled={isAnalyzing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-accent/20 text-accent hover:bg-accent/30 transition-all border border-accent/30 disabled:opacity-50"
            >
              <Brain className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-pulse' : ''}`} />
              {isAnalyzing ? 'ANALISANDO...' : 'ANALISAR IA'}
            </button>
            <button
              onClick={() => setIsPolling(!isPolling)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                isPolling ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-destructive/20 text-destructive border border-destructive/30'
              }`}
            >
              {isPolling ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              {isPolling ? 'AO VIVO' : 'PAUSADO'}
            </button>
            <button onClick={fetchNumbers} className="p-1.5 text-muted-foreground hover:text-primary transition-colors rounded-lg hover:bg-secondary">
              <RefreshCw className="w-4 h-4" />
            </button>
            {lastUpdate && <span className="text-[9px] text-muted-foreground font-mono">{lastUpdate.toLocaleTimeString('pt-BR')}</span>}
            <div className={`w-2.5 h-2.5 rounded-full ${isPolling ? 'bg-primary animate-pulse shadow-neon-cyan' : 'bg-muted'}`} />
          </div>
        </div>
      </nav>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT SIDEBAR */}
        <aside className="flex flex-col w-[280px] border-r border-border bg-card/60 backdrop-blur-sm shrink-0">
          {/* Provider/Table */}
          <div className="shrink-0 border-b border-border">
            <div className="grid grid-cols-2">
              <div className="relative border-r border-border">
                <select value={provider} onChange={e => { setProvider(e.target.value); setTable(PROVIDERS[e.target.value].tables[0]); }}
                  className="w-full bg-transparent text-foreground text-[11px] font-semibold px-3 py-2.5 appearance-none cursor-pointer focus:outline-none">
                  {Object.entries(PROVIDERS).map(([key, p]) => <option key={key} value={key} className="bg-card">{p.label}</option>)}
                </select>
                <ChevronDown className="w-3 h-3 text-muted-foreground absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <div className="relative">
                <select value={table} onChange={e => setTable(e.target.value)}
                  className="w-full bg-transparent text-foreground text-[11px] font-semibold px-3 py-2.5 appearance-none cursor-pointer focus:outline-none">
                  {PROVIDERS[provider]?.tables.map(t => <option key={t} value={t} className="bg-card">{t}</option>)}
                </select>
                <ChevronDown className="w-3 h-3 text-muted-foreground absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
            <div className="flex items-center justify-between px-3 py-1.5 bg-primary/5 border-t border-primary/10">
              <div className="flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-primary" />
                <span className="text-[9px] font-bold text-primary tracking-wider font-display">{PROVIDERS[provider]?.label} • {table}</span>
              </div>
              <span className="text-[9px] text-muted-foreground font-mono">{apiNumbers.length}</span>
            </div>
          </div>

          {/* Sidebar content */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
            {error && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-2 text-[10px] text-destructive font-semibold">⚠️ {error}</div>
            )}

            {/* Color Distribution */}
            {apiNumbers.length > 0 && (
              <div className="bg-card/80 rounded-lg border border-border p-2.5">
                <div className="flex gap-1 h-2.5 rounded-full overflow-hidden mb-1.5">
                  <motion.div animate={{ width: `${(redCount / total) * 100}%` }} className="bg-roulette-red rounded-l-full" transition={{ duration: 0.5 }} />
                  <motion.div animate={{ width: `${(blackCount / total) * 100}%` }} className="bg-roulette-black" transition={{ duration: 0.5 }} />
                  <motion.div animate={{ width: `${(greenCount / total) * 100}%` }} className="bg-roulette-green rounded-r-full" transition={{ duration: 0.5 }} />
                </div>
                <div className="flex justify-between text-[9px] font-mono text-muted-foreground">
                  <span className="text-roulette-red">🔴 {redCount} ({((redCount / total) * 100).toFixed(0)}%)</span>
                  <span>⚫ {blackCount} ({((blackCount / total) * 100).toFixed(0)}%)</span>
                  <span className="text-roulette-green">🟢 {greenCount}</span>
                </div>
              </div>
            )}

            {/* Dozens */}
            {apiNumbers.length > 0 && (
              <div className="bg-card/80 rounded-lg border border-border p-2.5">
                <span className="text-[9px] font-display text-primary tracking-widest mb-1.5 block">DÚZIAS</span>
                <div className="space-y-1">
                  {[{ label: '1ª (1-12)', count: d1 }, { label: '2ª (13-24)', count: d2 }, { label: '3ª (25-36)', count: d3 }].map(d => (
                    <div key={d.label} className="flex items-center gap-2">
                      <span className="text-[9px] text-muted-foreground w-16 shrink-0">{d.label}</span>
                      <div className="flex-1 bg-secondary rounded-full h-2 overflow-hidden">
                        <motion.div className="bg-primary h-full rounded-full" animate={{ width: `${(d.count / total) * 100}%` }} transition={{ duration: 0.5 }} />
                      </div>
                      <span className="text-[9px] font-mono text-foreground w-6 text-right">{d.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Hot & Cold */}
            {apiNumbers.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-card/80 rounded-lg border border-border p-2">
                  <div className="flex items-center gap-1 mb-1.5">
                    <Flame className="w-3 h-3 text-destructive" />
                    <span className="font-display text-[8px] text-destructive tracking-widest">QUENTES</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {hotNums.map(h => (
                      <div key={h.number} className={`${colorClass(h.number)} w-6 h-6 rounded flex items-center justify-center text-[9px] font-bold text-foreground relative`}>
                        {h.number}
                        <span className="absolute -top-0.5 -right-0.5 bg-destructive text-[6px] rounded-full w-2.5 h-2.5 flex items-center justify-center font-bold">{h.freq}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-card/80 rounded-lg border border-border p-2">
                  <div className="flex items-center gap-1 mb-1.5">
                    <Snowflake className="w-3 h-3 text-primary" />
                    <span className="font-display text-[8px] text-primary tracking-widest">FRIOS</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {coldNums.map(h => (
                      <div key={h.number} className={`${colorClass(h.number)} w-6 h-6 rounded flex items-center justify-center text-[9px] font-bold text-foreground opacity-50`}>
                        {h.number}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Alerts */}
            <AlertBanner />
          </div>
        </aside>

        {/* CENTER */}
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Histórico de Roleta */}
            <div className="bg-card/80 rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  <span className="font-display text-sm text-primary tracking-widest font-bold">HISTÓRICO DE ROLETA</span>
                </div>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {apiNumbers.length} números • 3s refresh
                </span>
              </div>
              {apiNumbers.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">Aguardando dados da API...</div>
              ) : (
                <div className="space-y-1">
                  {rows.map((row, rowIdx) => (
                    <div key={rowIdx} className="flex gap-[3px] justify-start">
                      {row.map((n, i) => (
                        <motion.div
                          key={`${rowIdx}-${i}-${n}`}
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ duration: 0.15, delay: i * 0.008 }}
                          className={`${colorClass(n)} w-[38px] h-[38px] rounded-full flex items-center justify-center text-[11px] font-bold text-foreground shadow-md hover:scale-110 hover:shadow-lg transition-transform cursor-default border border-white/10`}
                        >
                          {n}
                        </motion.div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Análise de Terminais */}
            <div className="bg-card/80 rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 mb-4">
                <Hash className="w-4 h-4 text-accent" />
                <span className="font-display text-sm text-accent tracking-widest font-bold">ANÁLISE DE TERMINAIS</span>
              </div>
              <div className="grid grid-cols-10 gap-3">
                {Array.from({ length: 10 }, (_, t) => {
                  const freq = terminalFreq[t] || 0;
                  const pct = maxTerminalFreq > 0 ? (freq / maxTerminalFreq) * 100 : 0;
                  const isHot = pct > 75;
                  return (
                    <div key={t} className="flex flex-col items-center gap-1.5">
                      <div className="w-full bg-secondary/50 rounded-lg h-20 flex flex-col-reverse overflow-hidden relative border border-border/50">
                        <motion.div
                          className={`rounded-lg ${isHot ? 'bg-gradient-to-t from-accent to-primary' : 'bg-gradient-to-t from-primary/60 to-primary/30'}`}
                          animate={{ height: `${pct}%` }}
                          transition={{ duration: 0.5 }}
                        />
                      </div>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold border ${isHot ? 'bg-accent/20 border-accent/50 text-accent' : 'bg-secondary border-border text-muted-foreground'}`}>
                        {t}
                      </div>
                      <span className={`text-[9px] font-mono font-bold ${isHot ? 'text-accent' : 'text-muted-foreground'}`}>{freq}x</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* AI Insights Panel */}
            <div className="bg-card/80 rounded-xl border border-accent/20 p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-accent" />
                  <span className="font-display text-sm text-accent tracking-widest font-bold">INSIGHTS DA IA</span>
                  <span className="text-[8px] px-1.5 py-0.5 bg-accent/20 rounded-full text-accent border border-accent/30 font-bold">AUTO 24H</span>
                </div>
                <span className="text-[9px] text-muted-foreground font-mono">{insights.length} padrões salvos</span>
              </div>

              {insights.length === 0 ? (
                <div className="text-center py-6">
                  <Brain className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-[11px] text-muted-foreground">Clique em "ANALISAR IA" para iniciar a detecção de padrões</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[400px] overflow-y-auto pr-1">
                  <AnimatePresence mode="popLayout">
                    {insights.map((insight) => {
                      const Icon = PATTERN_ICONS[insight.pattern_type] || Brain;
                      const iconColor = PATTERN_COLORS[insight.pattern_type] || 'text-primary';
                      return (
                        <motion.div
                          key={insight.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="bg-secondary/50 rounded-lg border border-border p-3 hover:border-accent/30 transition-colors"
                        >
                          <div className="flex items-start gap-2">
                            <Icon className={`w-4 h-4 ${iconColor} shrink-0 mt-0.5`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-[8px] font-bold uppercase tracking-wider ${iconColor}`}>{insight.pattern_type}</span>
                                <div className="flex items-center gap-1 ml-auto">
                                  <div className="w-12 h-1.5 bg-secondary rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${insight.confidence > 70 ? 'bg-accent' : insight.confidence > 40 ? 'bg-primary' : 'bg-muted-foreground'}`}
                                      style={{ width: `${insight.confidence}%` }} />
                                  </div>
                                  <span className="text-[8px] font-mono text-muted-foreground">{insight.confidence}%</span>
                                </div>
                              </div>
                              <p className="text-[10px] text-foreground/90 leading-relaxed mb-1.5">{insight.description}</p>
                              {insight.recommendation && (
                                <p className="text-[9px] text-accent/80 italic">💡 {insight.recommendation}</p>
                              )}
                              {insight.numbers_involved && insight.numbers_involved.length > 0 && (
                                <div className="flex flex-wrap gap-0.5 mt-1.5">
                                  {insight.numbers_involved.slice(0, 12).map((n, i) => (
                                    <span key={i} className={`${colorClass(n)} w-5 h-5 rounded text-[8px] font-bold text-foreground flex items-center justify-center`}>{n}</span>
                                  ))}
                                </div>
                              )}
                              <span className="text-[7px] text-muted-foreground/50 mt-1 block">
                                {new Date(insight.created_at).toLocaleString('pt-BR')}
                              </span>
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
        </div>
      </div>

      <DebugModal />
    </div>
  );
};

export default Index;
