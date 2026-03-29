import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  CircleDot, Activity, Shield, ShieldCheck, MonitorPlay,
  RefreshCw, Wifi, WifiOff, Brain, Sparkles, TrendingUp,
  Hash, Flame, Snowflake, Target, BarChart3, ChevronDown,
  BookOpen, Zap, Clock, GraduationCap
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

const ROULETTE_TABLES = [
  { id: 'brasileira', name: 'Roleta Brasileira', provider: 'Playtech', iframeUrl: 'https://onabet.com/' },
  { id: 'immersiva', name: 'Roleta Immersiva', provider: 'Evolution', iframeUrl: 'https://onabet.com/' },
  { id: 'mega-fire', name: 'Mega Fire Blaze', provider: 'Playtech', iframeUrl: 'https://onabet.com/' },
  { id: 'xxxtreme', name: 'XXXtreme Roulette', provider: 'Evolution', iframeUrl: 'https://onabet.com/' },
  { id: 'speed', name: 'Speed Roulette', provider: 'Evolution', iframeUrl: 'https://onabet.com/' },
  { id: 'powerup', name: 'PowerUP Roulette', provider: 'Pragmatic', iframeUrl: 'https://onabet.com/' },
];

interface PatternInsight {
  id: string; pattern_type: string; description: string; confidence: number;
  numbers_involved: number[]; recommendation: string; created_at: string;
}

interface LearnedPattern {
  id: string; learning_type: string; title: string; knowledge: string;
  data_points: number; accuracy: number; metadata: any; learned_at: string; updated_at: string;
}

const PATTERN_ICONS: Record<string, typeof Brain> = {
  streak: TrendingUp, terminal: Hash, dozen: BarChart3, column: BarChart3,
  hot: Flame, cold: Snowflake, parity: RefreshCw, sector: Target,
  frequency_bias: Flame, terminal_pattern: Hash, color_tendency: TrendingUp,
  dozen_cycle: BarChart3, cavalos_pattern: Target, timing_pattern: Clock,
  streak_behavior: TrendingUp, sector_concentration: Target,
};

const Index = () => {
  const [selectedTable, setSelectedTable] = useState(ROULETTE_TABLES[0]);
  const [apiNumbers, setApiNumbers] = useState<number[]>([]);
  const [storedNumbers, setStoredNumbers] = useState<number[]>([]);
  const [isPolling, setIsPolling] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [insights, setInsights] = useState<PatternInsight[]>([]);
  const [learned, setLearned] = useState<LearnedPattern[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<'insights' | 'knowledge'>('insights');
  const [showAllHistory, setShowAllHistory] = useState(false);
  const prevNumbersRef = useRef<string>('');

  // Fetch from API
  const fetchNumbers = useCallback(async () => {
    try {
      const res = await supabase.functions.invoke('proxy-roleta');
      if (res.error) throw new Error(res.error.message);
      const data = res.data;
      if (data?.results && Array.isArray(data.results)) {
        const nums = data.results.map((n: unknown) => Number(n)).filter((n: number) => !isNaN(n) && n >= 0 && n <= 36);
        const key = nums.slice(0, 20).join(',');
        if (key !== prevNumbersRef.current) {
          prevNumbersRef.current = key;
          setApiNumbers(nums);
          setLastUpdate(new Date());
        }
        setError(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }, []);

  // Fetch stored numbers (last 1000)
  const fetchStored = useCallback(async () => {
    const { data } = await supabase
      .from('roulette_numbers')
      .select('number')
      .order('fetched_at', { ascending: false })
      .limit(1000);
    if (data) setStoredNumbers(data.map((r: any) => r.number));
  }, []);

  useEffect(() => {
    fetchNumbers();
    fetchStored();
    if (!isPolling) return;
    const interval = setInterval(() => { fetchNumbers(); fetchStored(); }, 3000);
    return () => clearInterval(interval);
  }, [fetchNumbers, fetchStored, isPolling]);

  // Load insights + learned
  const loadInsights = useCallback(async () => {
    const { data } = await supabase.from('pattern_insights').select('*').order('created_at', { ascending: false }).limit(20);
    if (data) setInsights(data as PatternInsight[]);
  }, []);

  const loadLearned = useCallback(async () => {
    const { data } = await supabase.from('ai_learned_patterns').select('*').order('updated_at', { ascending: false }).limit(30);
    if (data) setLearned(data as LearnedPattern[]);
  }, []);

  useEffect(() => { loadInsights(); loadLearned(); }, [loadInsights, loadLearned]);

  // Auto-learn every 5 minutes
  const autoLearnRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    const runAutoLearn = async () => {
      try {
        console.log('[AutoLearn] Iniciando aprendizado automático...');
        await supabase.functions.invoke('ai-learn');
        await Promise.all([loadInsights(), loadLearned()]);
        console.log('[AutoLearn] Concluído.');
      } catch (err) { console.error('[AutoLearn] Erro:', err); }
    };

    // First learn after 30s
    const initialTimeout = setTimeout(runAutoLearn, 30_000);
    // Then every 5 minutes
    autoLearnRef.current = setInterval(runAutoLearn, 5 * 60 * 1000);

    return () => {
      clearTimeout(initialTimeout);
      if (autoLearnRef.current) clearInterval(autoLearnRef.current);
    };
  }, [loadInsights, loadLearned]);

  useEffect(() => {
    const ch1 = supabase.channel('insights_rt').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pattern_insights' }, () => loadInsights()).subscribe();
    const ch2 = supabase.channel('learned_rt').on('postgres_changes', { event: '*', schema: 'public', table: 'ai_learned_patterns' }, () => loadLearned()).subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); };
  }, [loadInsights, loadLearned]);

  const triggerLearn = async () => {
    setIsAnalyzing(true);
    try {
      await supabase.functions.invoke('ai-learn');
      await Promise.all([loadInsights(), loadLearned()]);
    } catch (err) { console.error(err); }
    finally { setIsAnalyzing(false); }
  };

  // Use stored numbers (up to 1000) merged with API
  const allNumbers = storedNumbers.length > apiNumbers.length ? storedNumbers : apiNumbers;
  const displayNumbers = showAllHistory ? allNumbers : allNumbers.slice(0, 100);

  const isCavalo = (n: number) => CAVALOS_258.includes(n);
  const latestNumber = allNumbers[0];
  const isCavaloEntry = latestNumber !== undefined && isCavalo(latestNumber);

  const terminalFreq = allNumbers.slice(0, 200).reduce<Record<number, number>>((acc, n) => {
    const t = n % 10; acc[t] = (acc[t] || 0) + 1; return acc;
  }, {});
  const maxTerminalFreq = Math.max(...Object.values(terminalFreq), 1);

  const rows: number[][] = [];
  for (let i = 0; i < displayNumbers.length; i += 20) rows.push(displayNumbers.slice(i, i + 20));

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Navbar */}
      <nav className="bg-card/95 backdrop-blur-md border-b border-border px-4 py-2.5 z-50 shrink-0">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 shrink-0">
            <CircleDot className="w-5 h-5 text-primary animate-spin-slow" />
            <span className="font-display text-sm tracking-[0.15em] text-primary font-bold hidden sm:inline">ROULETTE PRO</span>
            <span className="text-[7px] px-1.5 py-0.5 bg-primary/20 rounded-full text-primary font-bold border border-primary/30">AI 24H</span>
          </div>

          <div className="relative shrink-0">
            <select value={selectedTable.id} onChange={e => { const t = ROULETTE_TABLES.find(r => r.id === e.target.value); if (t) setSelectedTable(t); }}
              className="bg-secondary border border-border rounded-lg px-3 py-1.5 text-[10px] font-semibold text-foreground appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary pr-7 min-w-[160px]">
              {ROULETTE_TABLES.map(t => <option key={t.id} value={t.id} className="bg-card">{t.provider} — {t.name}</option>)}
            </select>
            <ChevronDown className="w-3 h-3 text-muted-foreground absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <div className="flex items-center gap-2">
            <button onClick={triggerLearn} disabled={isAnalyzing}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] font-bold bg-primary/20 text-primary hover:bg-primary/30 transition-all border border-primary/30 disabled:opacity-50">
              <Brain className={`w-3 h-3 ${isAnalyzing ? 'animate-spin' : ''}`} />
              {isAnalyzing ? 'APRENDENDO...' : 'IA APRENDER'}
            </button>
            <button onClick={() => setIsPolling(!isPolling)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] font-bold transition-all ${
                isPolling ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-destructive/20 text-destructive border border-destructive/30'
              }`}>
              {isPolling ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {isPolling ? 'LIVE' : 'OFF'}
            </button>
            <button onClick={() => { fetchNumbers(); fetchStored(); }} className="p-1 text-muted-foreground hover:text-primary transition-colors rounded-lg hover:bg-secondary">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            {lastUpdate && <span className="text-[8px] text-muted-foreground font-mono hidden md:inline">{lastUpdate.toLocaleTimeString('pt-BR')}</span>}
            <div className={`w-2 h-2 rounded-full ${isPolling ? 'bg-green-400 animate-pulse' : 'bg-muted'}`} />
          </div>
        </div>
      </nav>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1400px] mx-auto p-3 space-y-3">

          {/* MONITORAMENTO */}
          <motion.div className={`rounded-xl border p-4 transition-all ${
            isCavaloEntry ? 'bg-gradient-to-r from-primary/20 to-yellow-500/10 border-primary/50 shadow-lg shadow-primary/10' : 'bg-card border-border'
          }`} animate={{ scale: isCavaloEntry ? [1, 1.003, 1] : 1 }} transition={{ duration: 0.4 }}>
            <div className="flex items-center gap-3">
              {isCavaloEntry ? <ShieldCheck className="w-7 h-7 text-primary animate-pulse" /> : <Shield className="w-7 h-7 text-muted-foreground" />}
              <div className="flex-1">
                <span className="font-display text-xs tracking-widest font-bold block" style={{ color: isCavaloEntry ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))' }}>MONITORAMENTO</span>
                <span className={`text-base font-bold ${isCavaloEntry ? 'text-primary' : 'text-muted-foreground'}`}>
                  {allNumbers.length === 0 ? 'Aguardando...' : isCavaloEntry ? '🐴 Fazer entrada nos CAVALOS 258!' : '👁️ Monitorando as leituras...'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-muted-foreground font-mono">{allNumbers.length} nums</span>
                {latestNumber !== undefined && (
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center text-base font-bold shadow-lg
                    ${isCavalo(latestNumber) ? 'bg-yellow-400 text-black ring-2 ring-yellow-300/50' : colorClass(latestNumber)} border border-white/20`}>
                    {latestNumber}
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* HISTÓRICO */}
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                <span className="font-display text-sm text-primary tracking-widest font-bold">HISTÓRICO</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowAllHistory(!showAllHistory)}
                  className={`text-[9px] px-2 py-1 rounded-lg font-bold transition-all ${
                    showAllHistory ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-secondary text-muted-foreground border border-border'
                  }`}>
                  {showAllHistory ? `TODOS (${allNumbers.length})` : 'ÚLTIMOS 100'}
                </button>
                <span className="text-[9px] text-muted-foreground font-mono">{displayNumbers.length} números</span>
              </div>
            </div>

            {error && <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-2 text-[10px] text-destructive font-semibold mb-2">⚠️ {error}</div>}

            {displayNumbers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">Aguardando dados...</div>
            ) : (
              <div className="space-y-1">
                {rows.map((row, rowIdx) => (
                  <div key={rowIdx} className="flex gap-[3px] flex-wrap">
                    {row.map((n, i) => {
                      const globalIdx = rowIdx * 20 + i;
                      const highlight = globalIdx < 80 && isCavalo(n);
                      return (
                        <motion.div key={`${rowIdx}-${i}-${n}`}
                          initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                          transition={{ duration: 0.12, delay: i * 0.005 }}
                          className={`w-[34px] h-[34px] rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm hover:scale-110 transition-transform cursor-default border
                            ${highlight ? 'bg-yellow-400 text-black border-yellow-300 shadow-yellow-400/20 ring-1 ring-yellow-300/50' : `${colorClass(n)} border-white/10`}`}>
                          {n}
                        </motion.div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3 mt-3 pt-2 border-t border-border">
              {[
                { cls: 'bg-roulette-red', label: 'Vermelho' },
                { cls: 'bg-roulette-black', label: 'Preto' },
                { cls: 'bg-roulette-green', label: 'Zero' },
                { cls: 'bg-yellow-400', label: 'Cavalos 258' },
              ].map(l => (
                <div key={l.label} className="flex items-center gap-1">
                  <div className={`w-3 h-3 rounded-full ${l.cls} border border-white/10`} />
                  <span className="text-[8px] text-muted-foreground">{l.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* TERMINAIS + IA side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
            {/* Terminais */}
            <div className="lg:col-span-2 bg-card rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 mb-3">
                <Hash className="w-4 h-4 text-primary" />
                <span className="font-display text-sm text-primary tracking-widest font-bold">TERMINAIS</span>
              </div>
              <div className="grid grid-cols-10 gap-1.5">
                {Array.from({ length: 10 }, (_, t) => {
                  const freq = terminalFreq[t] || 0;
                  const pct = maxTerminalFreq > 0 ? (freq / maxTerminalFreq) * 100 : 0;
                  const isHot = pct > 70;
                  return (
                    <div key={t} className="flex flex-col items-center gap-1">
                      <div className="w-full bg-secondary/50 rounded-lg h-16 flex flex-col-reverse overflow-hidden border border-border/50">
                        <motion.div className={`rounded-lg ${isHot ? 'bg-gradient-to-t from-primary to-primary/60' : 'bg-gradient-to-t from-muted-foreground/40 to-muted-foreground/20'}`}
                          animate={{ height: `${pct}%` }} transition={{ duration: 0.5 }} />
                      </div>
                      <div className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold border ${
                        isHot ? 'bg-primary/20 border-primary/50 text-primary' : 'bg-secondary border-border text-muted-foreground'}`}>{t}</div>
                      <span className={`text-[8px] font-mono font-bold ${isHot ? 'text-primary' : 'text-muted-foreground'}`}>{freq}x</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* IA Panel */}
            <div className="lg:col-span-3 bg-card rounded-xl border border-primary/20 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="font-display text-sm text-primary tracking-widest font-bold">INTELIGÊNCIA ARTIFICIAL</span>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setActiveTab('insights')}
                    className={`text-[9px] px-2.5 py-1 rounded-lg font-bold transition-all ${activeTab === 'insights' ? 'bg-primary/20 text-primary border border-primary/30' : 'text-muted-foreground hover:text-foreground'}`}>
                    <Zap className="w-3 h-3 inline mr-1" />Padrões
                  </button>
                  <button onClick={() => setActiveTab('knowledge')}
                    className={`text-[9px] px-2.5 py-1 rounded-lg font-bold transition-all ${activeTab === 'knowledge' ? 'bg-primary/20 text-primary border border-primary/30' : 'text-muted-foreground hover:text-foreground'}`}>
                    <GraduationCap className="w-3 h-3 inline mr-1" />Aprendizado
                  </button>
                </div>
              </div>

              {activeTab === 'insights' ? (
                insights.length === 0 ? (
                  <div className="text-center py-6">
                    <Brain className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-[10px] text-muted-foreground">Clique "IA APRENDER" ou aguarde a análise automática (a cada hora)</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {insights.slice(0, 12).map(insight => {
                      const Icon = PATTERN_ICONS[insight.pattern_type] || Brain;
                      return (
                        <motion.div key={insight.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
                          className="bg-secondary/50 rounded-lg border border-border p-2.5 hover:border-primary/30 transition-colors">
                          <div className="flex items-start gap-2">
                            <Icon className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="text-[7px] font-bold uppercase tracking-wider text-primary">{insight.pattern_type}</span>
                                <div className="flex items-center gap-1 ml-auto">
                                  <div className="w-8 h-1 bg-secondary rounded-full overflow-hidden">
                                    <div className="h-full rounded-full bg-primary" style={{ width: `${insight.confidence}%` }} />
                                  </div>
                                  <span className="text-[7px] font-mono text-muted-foreground">{insight.confidence}%</span>
                                </div>
                              </div>
                              <p className="text-[9px] text-foreground/90 leading-relaxed">{insight.description}</p>
                              {insight.recommendation && <p className="text-[8px] text-primary/80 italic mt-0.5">💡 {insight.recommendation}</p>}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )
              ) : (
                learned.length === 0 ? (
                  <div className="text-center py-6">
                    <BookOpen className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-[10px] text-muted-foreground">A IA ainda não aprendeu nada. Execute a primeira análise.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {learned.map(l => {
                      const Icon = PATTERN_ICONS[l.learning_type] || GraduationCap;
                      return (
                        <motion.div key={l.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                          className="bg-secondary/50 rounded-lg border border-border p-2.5 hover:border-primary/30 transition-colors">
                          <div className="flex items-start gap-2">
                            <Icon className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="text-[8px] font-bold text-primary">{l.title}</span>
                                <div className="flex items-center gap-1 ml-auto">
                                  <span className="text-[7px] font-mono text-muted-foreground">{l.data_points} pts</span>
                                  <span className="text-[7px] font-mono text-primary">{l.accuracy}%</span>
                                </div>
                              </div>
                              <p className="text-[9px] text-foreground/80 leading-relaxed">{l.knowledge}</p>
                              <span className="text-[7px] text-muted-foreground/50 mt-0.5 block">
                                Aprendido: {new Date(l.learned_at).toLocaleString('pt-BR')} • Atualizado: {new Date(l.updated_at).toLocaleString('pt-BR')}
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )
              )}
            </div>
          </div>

          {/* IFRAME */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
              <MonitorPlay className="w-4 h-4 text-primary" />
              <span className="font-display text-sm text-primary tracking-widest font-bold">CASSINO AO VIVO</span>
              <span className="text-[9px] text-muted-foreground ml-1">— {selectedTable.name}</span>
            </div>
            <div className="w-full" style={{ height: '550px' }}>
              <iframe src={selectedTable.iframeUrl} className="w-full h-full border-0" allowFullScreen
                allow="autoplay; fullscreen; microphone; camera"
                sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-top-navigation" />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Index;
