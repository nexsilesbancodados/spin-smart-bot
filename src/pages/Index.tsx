import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  CircleDot, Activity, Shield, ShieldCheck, MonitorPlay,
  RefreshCw, Wifi, WifiOff, Brain, Sparkles, TrendingUp,
  Hash, Flame, Snowflake, Target, BarChart3, ChevronDown,
  BookOpen, Zap, Clock, GraduationCap, Crosshair, Eye, AlertTriangle, Download
} from 'lucide-react';
import Scanner500 from '@/components/Scanner500';
import PredictionHistory from '@/components/PredictionHistory';
import BetPanel from '@/components/BetPanel';
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
  const [sniperData, setSniperData] = useState<any>(null);
  const [sniperCountdown, setSniperCountdown] = useState(13);
  const [autoLearnCycle, setAutoLearnCycle] = useState(0);
  const [autoLearnStatus, setAutoLearnStatus] = useState<'idle' | 'learning' | 'analyzing' | 'backtesting'>('idle');
  const [lastAutoLearnTime, setLastAutoLearnTime] = useState<Date | null>(null);
  const [showCasino, setShowCasino] = useState(false);

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

  const fetchSniper = useCallback(async () => {
    try {
      const res = await supabase.functions.invoke('sniper-predict');
      if (res.data) {
        setSniperData(res.data);
        setSniperCountdown(13);
      }
    } catch (err) { console.error('Sniper error:', err); }
  }, []);

  useEffect(() => {
    fetchSniper();
    if (!isPolling) return;
    const interval = setInterval(fetchSniper, 3000);
    return () => clearInterval(interval);
  }, [fetchSniper, isPolling]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSniperCountdown(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const loadInsights = useCallback(async () => {
    const { data } = await supabase.from('pattern_insights').select('*').order('created_at', { ascending: false }).limit(20);
    if (data) setInsights(data as PatternInsight[]);
  }, []);

  const loadLearned = useCallback(async () => {
    const { data } = await supabase.from('ai_learned_patterns').select('*').order('updated_at', { ascending: false }).limit(30);
    if (data) setLearned(data as LearnedPattern[]);
  }, []);

  useEffect(() => { loadInsights(); loadLearned(); }, [loadInsights, loadLearned]);

  // CONTINUOUS AUTO-LEARNING ENGINE (disabled when credits exhausted)
  const autoLearnRef = useRef<NodeJS.Timeout | null>(null);
  const cycleRef = useRef(0);
  const autoLearnErrorCount = useRef(0);
  const autoLearnDisabled = useRef(false);
  useEffect(() => {
    const runContinuousLearn = async () => {
      if (autoLearnDisabled.current) return;
      if (autoLearnErrorCount.current >= 2) {
        console.warn('[AutoLearn] Desativado — créditos AI esgotados ou rate limit. Recarregue a página para tentar novamente.');
        autoLearnDisabled.current = true;
        setAutoLearnStatus('idle');
        return;
      }
      const cycle = cycleRef.current;
      cycleRef.current++;
      setAutoLearnCycle(cycle);
      try {
        if (cycle % 3 === 0) {
          setAutoLearnStatus('learning');
          const res = await supabase.functions.invoke('ai-learn');
          if (res.error || res.data?.error) throw new Error(res.data?.error || res.error?.message || 'ai-learn failed');
        } else if (cycle % 3 === 1) {
          setAutoLearnStatus('analyzing');
          const res = await supabase.functions.invoke('auto-analyze-patterns');
          if (res.error || res.data?.error) throw new Error(res.data?.error || res.error?.message || 'auto-analyze failed');
        } else {
          setAutoLearnStatus('backtesting');
          await supabase.functions.invoke('sniper-predict');
        }
        await Promise.all([loadInsights(), loadLearned()]);
        setLastAutoLearnTime(new Date());
        autoLearnErrorCount.current = 0;
      } catch (err: any) {
        autoLearnErrorCount.current++;
        const msg = err?.message || String(err);
        const isCreditError = msg.includes('402') || msg.includes('429') || msg.includes('Credits') || msg.includes('Rate') || msg.includes('credit');
        if (isCreditError) {
          autoLearnDisabled.current = true;
          console.warn('[AutoLearn] AI credits exhausted — auto-learn disabled.');
        }
        console.error(`[AutoLearn] Ciclo ${cycle} erro (${autoLearnErrorCount.current}):`, msg);
      } finally {
        setAutoLearnStatus('idle');
      }
    };
    const initialTimeout = setTimeout(runContinuousLearn, 20_000);
    autoLearnRef.current = setInterval(runContinuousLearn, 300_000);
    return () => { clearTimeout(initialTimeout); if (autoLearnRef.current) clearInterval(autoLearnRef.current); };
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

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1400px] mx-auto p-3 space-y-3">

          {/* SCANNER 500 */}
          <Scanner500 layerResults={sniperData?.layerResults || null} isScanning={!!sniperData} />

          {/* SNIPER STRATEGY + BET PANEL side by side on desktop */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {/* SNIPER SIGNAL - 2 cols */}
            <div className="lg:col-span-2">
              {sniperData && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`rounded-xl border p-4 h-full transition-all ${
                    sniperData.mode === 'sniper'
                      ? 'bg-gradient-to-r from-primary/30 via-yellow-500/10 to-primary/20 border-primary shadow-lg shadow-primary/20'
                      : sniperData.mode === 'alert'
                      ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/10 border-yellow-500/50'
                      : sniperData.mode === 'recalibrating'
                      ? 'bg-gradient-to-r from-purple-500/20 to-blue-500/10 border-purple-500/50'
                      : 'bg-card border-border'
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-center gap-2 mb-3">
                    {sniperData.mode === 'sniper' ? (
                      <Crosshair className="w-5 h-5 text-primary animate-pulse" />
                    ) : sniperData.mode === 'alert' ? (
                      <AlertTriangle className="w-5 h-5 text-yellow-400" />
                    ) : (
                      <Eye className="w-5 h-5 text-muted-foreground" />
                    )}
                    <span className="font-display text-xs tracking-[0.2em] font-bold text-primary">
                      {sniperData.strategy ? `${sniperData.strategy.emoji} ${sniperData.strategy.label}` : 'SNIPER IA'}
                    </span>
                    {sniperData.mesaMode && (
                      <span className={`text-[7px] px-1.5 py-0.5 rounded font-bold ${
                        sniperData.mesaMode === 'fisico' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      }`}>
                        {sniperData.mesaMode === 'fisico' ? '🎰 FÍSICO' : '🧮 MATEMÁTICO'}
                      </span>
                    )}
                    <div className="ml-auto flex items-center gap-2">
                      <div className={`flex items-center gap-1 px-2 py-1 rounded-lg font-mono text-xs font-bold ${
                        sniperCountdown <= 3 ? 'bg-destructive/20 text-destructive animate-pulse' : sniperCountdown <= 7 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-secondary text-muted-foreground'
                      }`}>
                        <Clock className="w-3 h-3" />
                        {sniperCountdown}s
                      </div>
                    </div>
                  </div>

                  {sniperData.signal && sniperData.strategy ? (
                    <div className="space-y-3">
                      {/* BET TYPE BADGE */}
                      <div className="flex flex-wrap gap-1.5 mb-1">
                        {(() => {
                          const type = sniperData.strategy.type;
                          const betCategory = ['cor', 'paridade', 'alto_baixo'].includes(type) ? { label: 'APOSTA SIMPLES', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' }
                            : ['coluna', 'duzia_unica', 'duzias', 'column_cycle', 'dozen_phase'].includes(type) ? { label: 'GRUPO/DÚZIA', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' }
                            : ['sniper', 'voisins', 'setor_oposto'].includes(type) ? { label: 'SETOR/VIZINHOS', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' }
                            : ['cavalos', 'terminal_alternation'].includes(type) ? { label: 'CAVALOS/TERMINAIS', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' }
                            : ['numero_exato'].includes(type) ? { label: 'PLENO', color: 'bg-red-500/20 text-red-400 border-red-500/30' }
                            : { label: 'ESTRATÉGIA IA', color: 'bg-primary/20 text-primary border-primary/30' };
                          return (
                            <span className={`text-[8px] px-2 py-0.5 rounded-full font-bold border ${betCategory.color}`}>
                              {betCategory.label}
                            </span>
                          );
                        })()}
                        <span className="text-[8px] px-2 py-0.5 rounded-full font-bold bg-secondary text-muted-foreground border border-border">
                          {sniperData.strategy.numbers.length} números • {sniperData.strategy.coverage}% cobertura
                        </span>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="text-center shrink-0">
                          <div className="text-3xl mb-1">{sniperData.strategy.emoji}</div>
                          <div className={`text-2xl font-bold font-mono ${sniperData.signal.probability >= 85 ? 'text-primary' : 'text-yellow-400'}`}>
                            {sniperData.signal.probability}%
                          </div>
                          <span className="text-[7px] text-muted-foreground block">
                            {sniperData.layerResults ? `${sniperData.layerResults.total}/500` : ''}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-bold mb-1 ${sniperData.mode === 'sniper' ? 'text-primary' : 'text-yellow-400'}`}>
                            💡 {sniperData.strategy.label}
                          </p>
                          <p className="text-[9px] text-muted-foreground mb-2">
                            Payout: {sniperData.strategy.payout}x
                          </p>
                          <div className="mb-2">
                            <span className="text-[8px] text-muted-foreground block mb-1">🎯 NÚMEROS:</span>
                            <div className="flex flex-wrap gap-1">
                              {sniperData.strategy.numbers.slice(0, 18).map((n: number, i: number) => (
                                <div key={i} className={`w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold border ${
                                  i === 0 && sniperData.strategy.type === 'sniper'
                                    ? 'bg-primary text-primary-foreground border-primary/50 ring-2 ring-primary/30 animate-pulse'
                                    : `${colorClass(n)} border-white/20`
                                }`}>
                                  {n}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-primary/5 border border-primary/20 rounded-lg p-2">
                        <span className="text-[8px] text-muted-foreground">🧠 JUSTIFICATIVA:</span>
                        <p className="text-[9px] text-primary/90 italic mt-0.5">{sniperData.strategy.justification}</p>
                      </div>

                      {/* ALTERNATIVE STRATEGIES */}
                      {sniperData.allStrategies && sniperData.allStrategies.length > 1 && (
                        <div>
                          <span className="text-[8px] text-muted-foreground block mb-1">📋 ALTERNATIVAS:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {sniperData.allStrategies.slice(1, 5).map((alt: any, i: number) => (
                              <div key={i} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-secondary/70 border border-border text-[8px]">
                                <span>{alt.emoji}</span>
                                <span className="font-semibold text-foreground truncate max-w-[100px]">{alt.label}</span>
                                <span className="font-mono text-muted-foreground">{alt.probability}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-1">
                        {sniperData.signal.convergenceReasons?.slice(0, 6).map((r: string, i: number) => (
                          <span key={i} className="text-[7px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-semibold">{r}</span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 py-4">
                      <p className={`text-sm font-semibold ${sniperData.mode === 'observing' ? 'text-orange-400' : 'text-muted-foreground'}`}>
                        {sniperData.message}
                      </p>
                      {sniperData.convergenceScore !== undefined && (
                        <span className="text-[8px] font-mono text-muted-foreground ml-auto">Camadas: {sniperData.convergenceScore}/500</span>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
              {!sniperData && (
                <div className="bg-card rounded-xl border border-border p-6 h-full flex items-center justify-center">
                  <div className="text-center">
                    <Crosshair className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2 animate-pulse" />
                    <p className="text-sm text-muted-foreground">Carregando Sniper IA...</p>
                  </div>
                </div>
              )}
            </div>

            {/* BET PANEL - 1 col */}
            <div className="lg:col-span-1">
              <BetPanel sniperData={sniperData} allNumbers={allNumbers} />
            </div>
          </div>

          {/* MONITORAMENTO + ÚLTIMO NÚMERO */}
          <motion.div className={`rounded-xl border p-3 transition-all ${
            isCavaloEntry ? 'bg-gradient-to-r from-primary/20 to-yellow-500/10 border-primary/50 shadow-lg shadow-primary/10' : 'bg-card border-border'
          }`} animate={{ scale: isCavaloEntry ? [1, 1.003, 1] : 1 }} transition={{ duration: 0.4 }}>
            <div className="flex items-center gap-3">
              {isCavaloEntry ? <ShieldCheck className="w-6 h-6 text-primary animate-pulse" /> : <Shield className="w-6 h-6 text-muted-foreground" />}
              <div className="flex-1">
                <span className="font-display text-[10px] tracking-widest font-bold" style={{ color: isCavaloEntry ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))' }}>MONITORAMENTO</span>
                <span className={`text-sm font-bold block ${isCavaloEntry ? 'text-primary' : 'text-muted-foreground'}`}>
                  {allNumbers.length === 0 ? 'Aguardando...' : isCavaloEntry ? '🐴 Entrada nos CAVALOS 258!' : '👁️ Monitorando...'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-muted-foreground font-mono">{allNumbers.length} nums</span>
                {latestNumber !== undefined && (
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-lg
                    ${isCavalo(latestNumber) ? 'bg-yellow-400 text-black ring-2 ring-yellow-300/50' : colorClass(latestNumber)} border border-white/20`}>
                    {latestNumber}
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* DEALER + TERMINAIS + SETOR — compact row */}
          {sniperData && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* DEALER */}
              <div className="bg-card rounded-xl border border-border p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-3.5 h-3.5 text-purple-400" />
                  <span className="font-display text-[9px] tracking-[0.15em] font-bold text-purple-400">DEALER</span>
                  {sniperData.dealerSignature?.dealerChanged && (
                    <span className="text-[7px] px-1 py-0.5 rounded bg-destructive/20 text-destructive font-bold animate-pulse ml-auto">NOVO</span>
                  )}
                </div>
                {sniperData.dealerSignature ? (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-muted-foreground">Arco</span>
                      <span className="font-mono font-bold text-foreground">{sniperData.dealerSignature.arcMean}</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-muted-foreground">Desvio</span>
                      <span className="font-mono font-bold text-foreground">±{sniperData.dealerSignature.arcStdDev}</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-muted-foreground">Consistência</span>
                      <span className={`font-bold text-[8px] px-1.5 py-0.5 rounded ${
                        sniperData.dealerSignature.consistency === 'alta' ? 'bg-green-500/20 text-green-400' :
                        sniperData.dealerSignature.consistency === 'média' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-destructive/20 text-destructive'
                      }`}>{sniperData.dealerSignature.consistency}</span>
                    </div>
                    {sniperData.dealerSignature.maoViciada && (
                      <div className="bg-primary/10 border border-primary/30 rounded p-1.5 text-center mt-1">
                        <span className="text-[9px] font-bold text-primary">🎯 MÃO VICIADA</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-[10px] text-muted-foreground">Calibrando...</p>
                )}
              </div>

              {/* CAVALOS DO MOMENTO */}
              <div className="bg-card rounded-xl border border-border p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Flame className="w-3.5 h-3.5 text-orange-400" />
                  <span className="font-display text-[9px] tracking-[0.15em] font-bold text-orange-400">CAVALOS QUENTES</span>
                </div>
                {sniperData.hotTerminals ? (
                  <div className="space-y-1">
                    {sniperData.hotTerminals.cavalos?.slice(0, 4).map(([group, count]: [string, number], i: number) => {
                      const max = sniperData.hotTerminals.cavalos[0]?.[1] || 1;
                      const pct = (count / max) * 100;
                      return (
                        <div key={group} className="space-y-0.5">
                          <div className="flex justify-between text-[10px]">
                            <span className={`font-bold ${i === 0 ? 'text-orange-400' : 'text-muted-foreground'}`}>C {group}</span>
                            <span className="font-mono font-bold text-foreground">{count}x</span>
                          </div>
                          <div className="w-full h-1 bg-secondary rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${i === 0 ? 'bg-orange-400' : 'bg-muted-foreground/30'}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : <p className="text-[10px] text-muted-foreground">Coletando...</p>}
              </div>

              {/* SETOR */}
              <div className="bg-card rounded-xl border border-border p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="font-display text-[9px] tracking-[0.15em] font-bold text-cyan-400">SETORES</span>
                </div>
                {sniperData.sectorFreq ? (
                  <div className="space-y-1">
                    {Object.entries(sniperData.sectorFreq as Record<string, number>).sort(([,a],[,b]) => (b as number) - (a as number)).slice(0, 4).map(([sector, count], i) => {
                      const total = Object.values(sniperData.sectorFreq as Record<string, number>).reduce((a: number, b: number) => a + b, 0);
                      const pct = total > 0 ? ((count as number) / total) * 100 : 0;
                      return (
                        <div key={sector} className="space-y-0.5">
                          <div className="flex justify-between text-[10px]">
                            <span className={`font-bold truncate ${i === 0 ? 'text-cyan-400' : 'text-muted-foreground'}`}>{sector}</span>
                            <span className="font-mono text-foreground">{pct.toFixed(0)}%</span>
                          </div>
                          <div className="w-full h-1 bg-secondary rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${i === 0 ? 'bg-cyan-400' : 'bg-muted-foreground/30'}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : <p className="text-[10px] text-muted-foreground">Analisando...</p>}
              </div>
            </div>
          )}

          {/* HISTÓRICO + TERMINAIS side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
            {/* HISTÓRICO - 3 cols */}
            <div className="lg:col-span-3 bg-card rounded-xl border border-border p-4">
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
                  <span className="text-[9px] text-muted-foreground font-mono">{displayNumbers.length}</span>
                </div>
              </div>

              {error && <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-2 text-[10px] text-destructive font-semibold mb-2">⚠️ {error}</div>}

              {displayNumbers.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">Aguardando dados...</div>
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
                            className={`w-[32px] h-[32px] rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm hover:scale-110 transition-transform cursor-default border
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
                    <div className={`w-2.5 h-2.5 rounded-full ${l.cls} border border-white/10`} />
                    <span className="text-[8px] text-muted-foreground">{l.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* TERMINAIS - 1 col */}
            <div className="lg:col-span-1 bg-card rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 mb-3">
                <Hash className="w-4 h-4 text-primary" />
                <span className="font-display text-xs text-primary tracking-widest font-bold">TERMINAIS</span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {Array.from({ length: 10 }, (_, t) => {
                  const freq = terminalFreq[t] || 0;
                  const pct = maxTerminalFreq > 0 ? (freq / maxTerminalFreq) * 100 : 0;
                  const isHot = pct > 70;
                  return (
                    <div key={t} className="flex flex-col items-center gap-1">
                      <div className="w-full bg-secondary/50 rounded-lg h-12 flex flex-col-reverse overflow-hidden border border-border/50">
                        <motion.div className={`rounded-lg ${isHot ? 'bg-gradient-to-t from-primary to-primary/60' : 'bg-gradient-to-t from-muted-foreground/40 to-muted-foreground/20'}`}
                          animate={{ height: `${pct}%` }} transition={{ duration: 0.5 }} />
                      </div>
                      <div className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold border ${
                        isHot ? 'bg-primary/20 border-primary/50 text-primary' : 'bg-secondary border-border text-muted-foreground'}`}>{t}</div>
                      <span className={`text-[7px] font-mono font-bold ${isHot ? 'text-primary' : 'text-muted-foreground'}`}>{freq}x</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* PREVISÕES */}
          <PredictionHistory />

          {/* CASSINO AO VIVO - collapsible */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <button onClick={() => setShowCasino(!showCasino)}
              className="w-full flex items-center gap-2 px-4 py-2.5 border-b border-border hover:bg-secondary/50 transition-colors">
              <MonitorPlay className="w-4 h-4 text-primary" />
              <span className="font-display text-sm text-primary tracking-widest font-bold">CASSINO AO VIVO</span>
              <span className="text-[9px] text-muted-foreground ml-1">— {selectedTable.name}</span>
              <ChevronDown className={`w-4 h-4 text-muted-foreground ml-auto transition-transform ${showCasino ? 'rotate-180' : ''}`} />
            </button>
            {showCasino && (
              <div className="w-full" style={{ height: '550px' }}>
                <iframe src={selectedTable.iframeUrl} className="w-full h-full border-0" allowFullScreen
                  allow="autoplay; fullscreen; microphone; camera"
                  sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-top-navigation" />
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default Index;
