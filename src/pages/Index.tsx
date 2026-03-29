import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
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

const WHEEL = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const WL = WHEEL.length;
const VOISINS_NUMS = [22,18,29,7,28,12,35,3,26,0,32,15,19,4,21,2,25];
const TIERS_NUMS = [27,13,36,11,30,8,23,10,5,24,16,33];
const ORPHELINS_NUMS = [1,20,14,31,9,17,34,6];

const CAVALOS_GROUPS: Record<string, number[]> = {
  '258': [2,5,8,12,15,18,22,25,28,32,35],
  '147': [1,4,7,11,14,17,21,24,27,31,34],
  '03': [0,3,10,13,20,23,30,33],
  '69': [6,9,16,19,26,29,36],
};

const wheelIdx = (n: number) => WHEEL.indexOf(n);
const wheelDist = (a: number, b: number) => {
  const ia = wheelIdx(a), ib = wheelIdx(b);
  if (ia === -1 || ib === -1) return 99;
  const d = Math.abs(ia - ib);
  return Math.min(d, WL - d);
};
const getSectorName = (n: number) => VOISINS_NUMS.includes(n) ? 'Voisins' : TIERS_NUMS.includes(n) ? 'Tiers' : ORPHELINS_NUMS.includes(n) ? 'Orphelins' : 'Zero';
const getCavaloGroup = (n: number) => { for (const [k, v] of Object.entries(CAVALOS_GROUPS)) if (v.includes(n)) return k; return null; };

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
  const sniperPrevKey = useRef<string>('');
  const [autoLearnCycle, setAutoLearnCycle] = useState(0);
  const [autoLearnStatus, setAutoLearnStatus] = useState<'idle' | 'learning' | 'analyzing' | 'backtesting'>('idle');
  const [lastAutoLearnTime, setLastAutoLearnTime] = useState<Date | null>(null);
  const [showCasino, setShowCasino] = useState(false);
  const [predStats, setPredStats] = useState<{ hits: number; misses: number; exact: number; total: number }>({ hits: 0, misses: 0, exact: 0, total: 0 });

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
        // Only reset countdown if the prediction actually changed
        const key = `${res.data.strategy?.type}-${res.data.signal?.number}-${res.data.mode}`;
        if (key !== sniperPrevKey.current) {
          sniperPrevKey.current = key;
          setSniperCountdown(13);
        }
        setSniperData(res.data);
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

  const loadPredStats = useCallback(async () => {
    const { data } = await supabase.from('prediction_history').select('hit, hit_type').not('hit', 'is', null).limit(500);
    if (data) {
      const hits = data.filter((r: any) => r.hit === true).length;
      const exact = data.filter((r: any) => r.hit_type === 'exact').length;
      setPredStats({ hits, misses: data.length - hits, exact, total: data.length });
    }
  }, []);

  useEffect(() => { loadInsights(); loadLearned(); loadPredStats(); }, [loadInsights, loadLearned, loadPredStats]);

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
          const message = res.data?.error || res.error?.message || '';
          const status = res.error?.context?.status;
          if (res.error || res.data?.error) {
            const err = new Error(message || 'ai-learn failed');
            (err as any).status = status;
            throw err;
          }
        } else if (cycle % 3 === 1) {
          setAutoLearnStatus('analyzing');
          const res = await supabase.functions.invoke('auto-analyze-patterns');
          const message = res.data?.error || res.error?.message || '';
          const status = res.error?.context?.status;
          if (res.error || res.data?.error) {
            const err = new Error(message || 'auto-analyze failed');
            (err as any).status = status;
            throw err;
          }
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
        const status = err?.status;
        const isCreditError = status === 402 || status === 429 || msg.includes('402') || msg.includes('429') || msg.includes('Credits') || msg.includes('Rate') || msg.includes('credit');
        if (isCreditError) {
          autoLearnDisabled.current = true;
          toast.error(status === 402 ? 'Créditos de IA esgotados. O aprendizado automático foi pausado.' : 'Limite de requisições atingido. O aprendizado automático foi pausado.');
          console.warn('[AutoLearn] AI credits exhausted / rate limited — auto-learn disabled.');
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
    const ch3 = supabase.channel('prediction_result_rt').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'prediction_history' }, (payload: any) => {
      const row = payload.new;
      if (row && row.hit !== null && row.actual_number !== null) {
        const isHit = row.hit === true;
        const hitType = row.hit_type;
        const label = row.strategy_label || row.strategy_type || 'Previsão';
        const predicted = row.predicted_main;
        const actual = row.actual_number;
        if (isHit) {
          toast.success(
            `${hitType === 'exact' ? '🎯 ACERTO EXATO!' : '✅ ACERTO VIZINHO!'} ${label} — Previsto: ${predicted}, Saiu: ${actual}`,
            { duration: 8000, style: { background: '#0a2e1a', border: '1px solid #22c55e', color: '#4ade80' } }
          );
        } else {
          toast.error(
            `❌ ERRO — ${label} — Previsto: ${predicted}, Saiu: ${actual}`,
            { duration: 6000, style: { background: '#2e0a0a', border: '1px solid #ef4444', color: '#f87171' } }
          );
        }
        loadPredStats();
      }
    }).subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); supabase.removeChannel(ch3); };
  }, [loadInsights, loadLearned, loadPredStats]);

  const triggerLearn = async () => {
    setIsAnalyzing(true);
    try {
      const res = await supabase.functions.invoke('ai-learn');
      const status = res.error?.context?.status;
      const message = res.data?.error || res.error?.message || '';
      if (res.error || res.data?.error) {
        if (status === 402 || message.includes('Credits')) {
          toast.error('Créditos de IA esgotados. O aprendizado manual não pôde ser executado.');
          return;
        }
        if (status === 429 || message.includes('Rate')) {
          toast.error('Muitas tentativas em pouco tempo. Tente novamente em instantes.');
          return;
        }
        throw new Error(message || 'ai-learn failed');
      }
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

  // === REAL computed stats from allNumbers ===
  const computedDealer = (() => {
    if (allNumbers.length < 10) return null;
    const arcs: number[] = [];
    for (let i = 0; i < Math.min(50, allNumbers.length - 1); i++) arcs.push(wheelDist(allNumbers[i], allNumbers[i + 1]));
    const mean = arcs.length > 0 ? arcs.reduce((a, b) => a + b, 0) / arcs.length : 0;
    const stdDev = Math.sqrt(arcs.length > 0 ? arcs.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arcs.length : 99);
    const last3 = arcs.slice(0, 3);
    const range3 = last3.length === 3 ? Math.max(...last3) - Math.min(...last3) : 99;
    const recentMean = arcs.slice(0, 10).reduce((a, b) => a + b, 0) / Math.max(arcs.slice(0, 10).length, 1);
    const olderMean = arcs.slice(10, 20).reduce((a, b) => a + b, 0) / Math.max(arcs.slice(10, 20).length, 1);
    const changed = arcs.length >= 20 && Math.abs(recentMean - olderMean) > 5;
    return {
      arcMean: +mean.toFixed(1),
      arcStdDev: +stdDev.toFixed(1),
      consistency: stdDev < 2.5 ? 'alta' : stdDev < 4 ? 'média' : 'baixa',
      maoViciada: range3 <= 2,
      dealerChanged: changed,
    };
  })();

  const computedCavalos = (() => {
    const slice = allNumbers.slice(0, 50);
    if (slice.length < 5) return [];
    const freq: Record<string, number> = { '258': 0, '147': 0, '03': 0, '69': 0 };
    slice.forEach(n => { const g = getCavaloGroup(n); if (g) freq[g]++; });
    return Object.entries(freq).sort(([, a], [, b]) => b - a);
  })();

  const computedSectors = (() => {
    const slice = allNumbers.slice(0, 100);
    if (slice.length < 5) return {};
    const freq: Record<string, number> = { Voisins: 0, Tiers: 0, Orphelins: 0, Zero: 0 };
    slice.forEach(n => { freq[getSectorName(n)]++; });
    return freq;
  })();

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

      {/* CONTADOR DE ACERTOS/ERROS */}
      {predStats.total > 0 && (
        <div className="bg-card/80 border-b border-border px-4 py-1.5 shrink-0">
          <div className="max-w-[1400px] mx-auto flex items-center justify-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-[8px] text-muted-foreground font-bold">PREVISÕES:</span>
              <span className="text-[10px] font-mono font-bold text-foreground">{predStats.total}</span>
            </div>
            <div className="w-px h-3 bg-border" />
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-[10px] font-mono font-bold text-green-400">{predStats.hits}</span>
              <span className="text-[7px] text-muted-foreground">ACERTOS</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-destructive" />
              <span className="text-[10px] font-mono font-bold text-destructive">{predStats.misses}</span>
              <span className="text-[7px] text-muted-foreground">ERROS</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-[10px] font-mono font-bold text-primary">{predStats.exact}</span>
              <span className="text-[7px] text-muted-foreground">EXATOS</span>
            </div>
            <div className="w-px h-3 bg-border" />
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border ${
              predStats.total > 0 && (predStats.hits / predStats.total) >= 0.5
                ? 'bg-green-500/10 text-green-400 border-green-500/30'
                : 'bg-destructive/10 text-destructive border-destructive/30'
            }`}>
              {predStats.total > 0 ? ((predStats.hits / predStats.total) * 100).toFixed(1) : '0.0'}% WIN
            </div>
          </div>
        </div>
      )}

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

          {/* DEALER + CAVALOS + SETOR — always real data */}
          {allNumbers.length >= 10 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* DEALER */}
              <div className="bg-card rounded-xl border border-border p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-3.5 h-3.5 text-purple-400" />
                  <span className="font-display text-[9px] tracking-[0.15em] font-bold text-purple-400">DEALER</span>
                  {(sniperData?.dealerSignature?.dealerChanged || computedDealer?.dealerChanged) && (
                    <span className="text-[7px] px-1 py-0.5 rounded bg-destructive/20 text-destructive font-bold animate-pulse ml-auto">NOVO</span>
                  )}
                </div>
                {(() => {
                  const d = sniperData?.dealerSignature || computedDealer;
                  if (!d) return <p className="text-[10px] text-muted-foreground">Calibrando...</p>;
                  return (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-muted-foreground">Arco</span>
                        <span className="font-mono font-bold text-foreground">{d.arcMean}</span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-muted-foreground">Desvio</span>
                        <span className="font-mono font-bold text-foreground">±{d.arcStdDev}</span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-muted-foreground">Consistência</span>
                        <span className={`font-bold text-[8px] px-1.5 py-0.5 rounded ${
                          d.consistency === 'alta' ? 'bg-green-500/20 text-green-400' :
                          d.consistency === 'média' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-destructive/20 text-destructive'
                        }`}>{d.consistency}</span>
                      </div>
                      {d.maoViciada && (
                        <div className="bg-primary/10 border border-primary/30 rounded p-1.5 text-center mt-1">
                          <span className="text-[9px] font-bold text-primary">🎯 MÃO VICIADA</span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* CAVALOS QUENTES */}
              <div className="bg-card rounded-xl border border-border p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Flame className="w-3.5 h-3.5 text-orange-400" />
                  <span className="font-display text-[9px] tracking-[0.15em] font-bold text-orange-400">CAVALOS QUENTES</span>
                </div>
                {(() => {
                  const cavalos = sniperData?.hotTerminals?.cavalos || computedCavalos;
                  if (!cavalos || cavalos.length === 0) return <p className="text-[10px] text-muted-foreground">Coletando...</p>;
                  const maxCount = cavalos[0]?.[1] || 1;
                  return (
                    <div className="space-y-1">
                      {cavalos.slice(0, 4).map(([group, count]: [string, number], i: number) => {
                        const pct = (count / maxCount) * 100;
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
                  );
                })()}
              </div>

              {/* SETORES */}
              <div className="bg-card rounded-xl border border-border p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="font-display text-[9px] tracking-[0.15em] font-bold text-cyan-400">SETORES</span>
                </div>
                {(() => {
                  const sectors = sniperData?.sectorFreq || computedSectors;
                  const entries = Object.entries(sectors as Record<string, number>);
                  if (entries.length === 0) return <p className="text-[10px] text-muted-foreground">Analisando...</p>;
                  const total = entries.reduce((a, [, b]) => a + (b as number), 0);
                  return (
                    <div className="space-y-1">
                      {entries.sort(([, a], [, b]) => (b as number) - (a as number)).slice(0, 4).map(([sector, count], i) => {
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
                  );
                })()}
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
