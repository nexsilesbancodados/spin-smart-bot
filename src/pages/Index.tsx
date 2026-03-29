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
import PatternPanel24h from '@/components/PatternPanel24h';
import PredictionHistory from '@/components/PredictionHistory';
import BetPanel from '@/components/BetPanel';
import AILearningLog from '@/components/AILearningLog';
import NumberDNADialog from '@/components/NumberDNADialog';
import PullRadar from '@/components/PullRadar';
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
  const sniperSameCount = useRef(0);
  const [sniperStale, setSniperStale] = useState(false);
  const [lastPredResult, setLastPredResult] = useState<{ hit: boolean | null; hitType: string | null; predicted: number | null; actual: number | null; label: string } | null>(null);
  const [autoLearnCycle, setAutoLearnCycle] = useState(0);
  const [autoLearnStatus, setAutoLearnStatus] = useState<'idle' | 'learning' | 'analyzing' | 'backtesting'>('idle');
  const [lastAutoLearnTime, setLastAutoLearnTime] = useState<Date | null>(null);
  const [showCasino, setShowCasino] = useState(false);
  const [predStats, setPredStats] = useState<{ hits: number; misses: number; exact: number; total: number }>({ hits: 0, misses: 0, exact: 0, total: 0 });

  // === HISTORY INTERACTIVE STATES ===
  const [historyLimit, setHistoryLimit] = useState(100);
  const [selectedNum, setSelectedNum] = useState<number | null>(null);
  const [dnaNumber, setDnaNumber] = useState<number | null>(null);
  const [dnaOpen, setDnaOpen] = useState(false);
  const [confidenceFilter, setConfidenceFilter] = useState(true); // hide signals < 85%
  const [showAdvanced, setShowAdvanced] = useState(false);

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
        const key = `${res.data.strategy?.type}-${res.data.signal?.number}-${res.data.mode}`;
        if (key !== sniperPrevKey.current) {
          sniperPrevKey.current = key;
          sniperSameCount.current = 0;
          setSniperStale(false);
          setSniperCountdown(13);
        } else {
          sniperSameCount.current++;
          if (sniperSameCount.current >= 3) {
            setSniperStale(true);
          }
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
          let res: any;
          try { res = await supabase.functions.invoke('ai-learn'); } catch (e) {
            throw Object.assign(new Error(String(e)), { status: 402 });
          }
          const errMsg = typeof res?.data === 'string' ? res.data : res?.data?.error || res?.error?.message || '';
          if (res?.error || errMsg) {
            throw Object.assign(new Error(errMsg || 'ai-learn failed'), { status: res?.error?.context?.status });
          }
        } else if (cycle % 3 === 1) {
          setAutoLearnStatus('analyzing');
          let res: any;
          try { res = await supabase.functions.invoke('auto-analyze-patterns'); } catch (e) {
            throw Object.assign(new Error(String(e)), { status: 402 });
          }
          const errMsg = typeof res?.data === 'string' ? res.data : res?.data?.error || res?.error?.message || '';
          if (res?.error || errMsg) {
            throw Object.assign(new Error(errMsg || 'auto-analyze failed'), { status: res?.error?.context?.status });
          }
        } else {
          setAutoLearnStatus('backtesting');
          try { await supabase.functions.invoke('sniper-predict'); } catch {}
        }
        await Promise.all([loadInsights(), loadLearned()]);
        setLastAutoLearnTime(new Date());
        autoLearnErrorCount.current = 0;
      } catch (err: any) {
        autoLearnErrorCount.current++;
        const msg = err?.message || String(err);
        const status = err?.status;
        const isCreditError = status === 402 || status === 429 || /402|429|[Cc]redit|[Rr]ate|exhausted|payment/i.test(msg);
        if (isCreditError) {
          autoLearnDisabled.current = true;
          toast.error('Créditos de IA esgotados. Adicione saldo em Settings → Cloud & AI balance.');
        }
        console.error(`[AutoLearn] Ciclo ${cycle} erro:`, msg);
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
        setLastPredResult({ hit: isHit, hitType, predicted, actual, label });
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
  const historySlice = allNumbers.slice(0, historyLimit);
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

      {/* CONTADOR DE ACERTOS/ERROS - FIXO */}
      <div className="bg-card/95 backdrop-blur-md border-b border-border px-4 py-1.5 shrink-0 sticky top-0 z-40">
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
          <div className="w-px h-3 bg-border" />
          <button onClick={async () => {
            await supabase.from('prediction_history').delete().not('id', 'is', null);
            setPredStats({ hits: 0, misses: 0, exact: 0, total: 0 });
          }} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-destructive/10 text-destructive border border-destructive/30 hover:bg-destructive/20 transition-all">
            <RefreshCw className="w-2.5 h-2.5" /> REINICIAR
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1400px] mx-auto p-3 space-y-3">

          {/* ÚLTIMOS 12 NÚMEROS COM INFO DETALHADA */}
          {allNumbers.length > 0 && (
            <div className="bg-card/90 border border-border rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-primary" />
                <span className="text-[10px] font-bold tracking-[0.15em] text-primary">ÚLTIMOS 12 NÚMEROS</span>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-1.5">
                {allNumbers.slice(0, 12).map((n, i) => {
                  const color = getColor(n);
                  const dozen = n === 0 ? '-' : n <= 12 ? '1ª' : n <= 24 ? '2ª' : '3ª';
                  const col = n === 0 ? '-' : `C${((n - 1) % 3) + 1}`;
                  const terminal = n % 10;
                  const sector = getSectorName(n);
                  const cavalo = getCavaloGroup(n);
                  const freqIn100 = allNumbers.slice(0, 100).filter(x => x === n).length;
                  return (
                    <div key={i} className="flex flex-col items-center gap-0.5">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 ${
                        color === 'red' ? 'bg-roulette-red text-white border-red-400/50' :
                        color === 'black' ? 'bg-roulette-black text-white border-gray-500/50' :
                        'bg-roulette-green text-white border-green-400/50'
                      } ${i === 0 ? 'ring-2 ring-primary/50 scale-110' : ''}`}>
                        {n}
                      </div>
                      <span className={`text-[7px] font-bold ${color === 'red' ? 'text-red-400' : color === 'black' ? 'text-gray-400' : 'text-green-400'}`}>
                        {color === 'red' ? 'VRM' : color === 'black' ? 'PRT' : 'VRD'}
                      </span>
                      <span className="text-[7px] text-muted-foreground">{dozen} Dz</span>
                      <span className="text-[7px] text-muted-foreground">{col}</span>
                      <span className="text-[7px] text-muted-foreground">T{terminal}</span>
                      {cavalo && <span className="text-[7px] text-orange-400 font-bold">🐎{cavalo}</span>}
                      <span className="text-[7px] text-muted-foreground">{sector.slice(0, 4)}</span>
                      <span className={`text-[7px] font-mono font-bold ${freqIn100 >= 5 ? 'text-red-400' : freqIn100 >= 3 ? 'text-yellow-400' : 'text-muted-foreground'}`}>
                        {freqIn100}x/100
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
                      {sniperCountdown > 0 ? (
                        <div className={`flex items-center gap-1 px-2 py-1 rounded-lg font-mono text-xs font-bold ${
                          sniperCountdown <= 3 ? 'bg-destructive/20 text-destructive animate-pulse' : sniperCountdown <= 7 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-secondary text-muted-foreground'
                        }`}>
                          <Clock className="w-3 h-3" />
                          {sniperCountdown}s
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 px-2 py-1 rounded-lg font-mono text-[9px] font-bold bg-secondary text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          Aguardando giro...
                        </div>
                      )}
                    </div>
                  </div>

                  {/* STALE: show last result instead of repeating same prediction */}
                  {sniperStale && lastPredResult ? (
                    <div className="flex flex-col items-center gap-3 py-6">
                      {lastPredResult.hit === true ? (
                        <>
                          <div className="w-14 h-14 rounded-full bg-green-500/20 border-2 border-green-500/50 flex items-center justify-center">
                            <ShieldCheck className="w-7 h-7 text-green-400" />
                          </div>
                          <span className="text-sm font-bold text-green-400">
                            {lastPredResult.hitType === 'exact' ? '🎯 ACERTO EXATO!' : '✅ ACERTO VIZINHO!'}
                          </span>
                        </>
                      ) : lastPredResult.hit === false ? (
                        <>
                          <div className="w-14 h-14 rounded-full bg-destructive/20 border-2 border-destructive/50 flex items-center justify-center">
                            <AlertTriangle className="w-7 h-7 text-destructive" />
                          </div>
                          <span className="text-sm font-bold text-destructive">❌ ERRO NA ÚLTIMA PREVISÃO</span>
                        </>
                      ) : null}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>Previsto: <strong className="text-foreground">{lastPredResult.predicted}</strong></span>
                        <span>•</span>
                        <span>Saiu: <strong className="text-foreground">{lastPredResult.actual}</strong></span>
                      </div>
                      <span className="text-[9px] text-muted-foreground italic">{lastPredResult.label}</span>
                      <span className="text-[8px] text-muted-foreground/60 mt-1">Aguardando nova jogada...</span>
                    </div>
                  ) : sniperData.signal && sniperData.strategy ? (
                    <div className="space-y-3">
                      {/* CONFIDENCE FILTER */}
                      {confidenceFilter && sniperData.signal.probability < 85 && (
                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-center">
                          <Shield className="w-5 h-5 text-amber-400 mx-auto mb-1" />
                          <span className="text-[10px] font-bold text-amber-400 block">FILTRO DE SEGURANÇA ATIVO</span>
                          <span className="text-[8px] text-muted-foreground">Convergência {sniperData.signal.probability}% — abaixo do limiar 85%. Aguardando sinal mais forte.</span>
                        </div>
                      )}
                      {/* BET INSTRUCTIONS — MAIN ACTION */}
                      {(!confidenceFilter || sniperData.signal.probability >= 85) && sniperData.betInstructions && sniperData.betInstructions.bets?.length > 0 && (
                        <div className="bg-gradient-to-r from-primary/20 via-primary/10 to-transparent border-2 border-primary/40 rounded-xl p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <Zap className="w-4 h-4 text-primary" />
                            <span className="text-[10px] font-bold tracking-[0.15em] text-primary">JOGADAS RECOMENDADAS</span>
                            <span className={`ml-auto text-lg font-bold font-mono ${sniperData.signal.probability >= 85 ? 'text-primary' : 'text-yellow-400'}`}>
                              {sniperData.signal.probability}%
                            </span>
                          </div>
                          <div className="space-y-1.5">
                            {sniperData.betInstructions.bets.map((bet: any, i: number) => (
                              <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                                i === 0 
                                  ? 'bg-primary/15 border-primary/30 shadow-sm shadow-primary/10' 
                                  : 'bg-secondary/50 border-border'
                              }`}>
                                <span className="text-lg">{bet.emoji}</span>
                                <div className="flex-1 min-w-0">
                                  <span className={`text-xs font-bold ${i === 0 ? 'text-primary' : 'text-foreground'}`}>{bet.label}</span>
                                  <p className="text-[9px] text-muted-foreground truncate">{bet.detail}</p>
                                </div>
                                {i === 0 && (
                                  <span className="text-[7px] px-1.5 py-0.5 bg-primary/20 text-primary rounded-full font-bold border border-primary/30 shrink-0">
                                    PRINCIPAL
                                  </span>
                                )}
                                {i > 0 && (
                                  <span className="text-[7px] px-1.5 py-0.5 bg-secondary text-muted-foreground rounded-full font-bold border border-border shrink-0">
                                    REFORÇO
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                          <div className="flex items-center gap-2 text-[8px] text-muted-foreground">
                            <span>Payout: {sniperData.strategy.payout}x</span>
                            <span>•</span>
                            <span>{sniperData.strategy.numbers.length} números</span>
                            <span>•</span>
                            <span>{sniperData.strategy.coverage}% cobertura</span>
                            {sniperData.layerResults && (
                              <>
                                <span>•</span>
                                <span>{sniperData.layerResults.total}/{sniperData.layerResults.max || 1000} camadas</span>
                              </>
                            )}
                          </div>
                        </div>
                      )}

                      {/* NÚMEROS */}
                      <div>
                        <span className="text-[8px] text-muted-foreground block mb-1">🎯 NÚMEROS COBERTOS:</span>
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
                        <span className="text-[8px] font-mono text-muted-foreground ml-auto">Camadas: {sniperData.convergenceScore}/{sniperData.layerResults?.max || 1000}</span>
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

          {/* TOP ALTERNATIVAS — mostra as 3 melhores jogadas alternativas */}
          {sniperData?.topAlternatives?.length > 0 && (
            <div className="bg-card/90 rounded-xl border border-border p-3">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-4 h-4 text-cyan-400" />
                <span className="font-display text-[10px] tracking-[0.15em] font-bold text-cyan-400">JOGADAS ALTERNATIVAS</span>
                <span className="text-[7px] px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 font-bold">
                  TOP {sniperData.topAlternatives.length}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {sniperData.topAlternatives.map((alt: any, i: number) => (
                  <div key={i} className="bg-secondary/40 rounded-lg p-2.5 border border-border hover:border-primary/30 transition-all">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-sm">{alt.emoji}</span>
                      <span className="text-[9px] font-bold text-foreground truncate">{alt.label}</span>
                      <span className={`ml-auto text-[10px] font-mono font-bold ${alt.probability >= 80 ? 'text-primary' : alt.probability >= 65 ? 'text-yellow-400' : 'text-muted-foreground'}`}>
                        {alt.probability}%
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-0.5 mb-1.5">
                      {alt.numbers?.slice(0, 8).map((n: number, j: number) => (
                        <div key={j} className={`w-5 h-5 rounded-full flex items-center justify-center text-[7px] font-bold ${colorClass(n)} border border-white/10`}>
                          {n}
                        </div>
                      ))}
                      {alt.numbers?.length > 8 && <span className="text-[7px] text-muted-foreground self-center">+{alt.numbers.length - 8}</span>}
                    </div>
                    <p className="text-[7px] text-muted-foreground line-clamp-2">{alt.justification}</p>
                    <div className="flex items-center gap-2 mt-1 text-[7px] text-muted-foreground">
                      <span>Payout: {alt.payout}x</span>
                      <span>•</span>
                      <span>{alt.coverage}% cobertura</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* === ANÁLISE AVANÇADA (COLAPSÁVEL) === */}
          {sniperData && (
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <button onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-secondary/50 transition-colors">
                <Brain className="w-4 h-4 text-purple-400" />
                <span className="font-display text-[10px] tracking-[0.15em] font-bold text-purple-400">ANÁLISE AVANÇADA</span>
                {sniperData?.aiLearnings?.length > 0 && (
                  <span className="text-[7px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30 font-bold">
                    {sniperData.aiLearnings.length} insights
                  </span>
                )}
                {sniperData?.deepMemory && (
                  <span className="text-[7px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 font-bold">
                    1700+ CAMADAS
                  </span>
                )}
                <ChevronDown className={`w-4 h-4 text-muted-foreground ml-auto transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {showAdvanced && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="p-3 space-y-3 border-t border-border">

          {/* O QUE A IA APRENDEU AGORA */}
          {sniperData?.aiLearnings && sniperData.aiLearnings.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-r from-purple-500/10 via-card to-blue-500/10 rounded-xl border border-purple-500/30 p-3"
            >
              <div className="flex items-center gap-2 mb-2">
                <GraduationCap className="w-4 h-4 text-purple-400" />
                <span className="font-display text-[10px] tracking-[0.15em] font-bold text-purple-400">O QUE A IA APRENDEU AGORA</span>
                {sniperData.noiseFiltered > 0 && (
                  <span className="text-[7px] px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 font-bold ml-auto">
                    🔇 {sniperData.noiseFiltered} ruídos filtrados
                  </span>
                )}
                {sniperData.dealerChaos && (
                  <span className="text-[7px] px-1.5 py-0.5 rounded-full bg-destructive/20 text-destructive border border-destructive/30 font-bold animate-pulse">
                    ⚠️ DEALER CAÓTICO
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {sniperData.aiLearnings.map((learning: string, i: number) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-start gap-1.5 px-2 py-1.5 rounded-lg bg-secondary/60 border border-border"
                  >
                    <Sparkles className="w-3 h-3 text-purple-400 mt-0.5 shrink-0" />
                    <span className="text-[9px] text-foreground/90 leading-tight">{learning}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* DEEP MEMORY */}
          {sniperData?.deepMemory && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-r from-blue-500/10 via-card to-emerald-500/10 rounded-xl border border-blue-500/30 p-3"
            >
              <div className="flex items-center gap-2 mb-2">
                <Eye className="w-4 h-4 text-blue-400" />
                <span className="font-display text-[10px] tracking-[0.15em] font-bold text-blue-400">MEMÓRIA PROFUNDA & FÍSICA AVANÇADA</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                {/* Ancestral Patterns */}
                <div className="bg-secondary/40 rounded-lg p-2 border border-border">
                  <span className="text-[8px] font-bold text-purple-400 block mb-1">👻 SEQUÊNCIAS ANCESTRAIS</span>
                  {sniperData.deepMemory.ancestralPatterns?.length > 0 ? (
                    sniperData.deepMemory.ancestralPatterns.map((p: any, i: number) => (
                      <div key={i} className="text-[8px] text-foreground/80 mb-0.5">
                        <span className="font-mono">{p.pattern?.slice(0, 5).join(',')}</span>
                        <span className="text-muted-foreground ml-1">({p.occurrences}x visto)</span>
                      </div>
                    ))
                  ) : (
                    <span className="text-[8px] text-muted-foreground">Coletando dados...</span>
                  )}
                </div>
                {/* Mesa DNA */}
                <div className="bg-secondary/40 rounded-lg p-2 border border-border">
                  <span className="text-[8px] font-bold text-emerald-400 block mb-1">🧬 DNA DE MESA</span>
                  <div className="text-[8px] text-foreground/80 space-y-0.5">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Equilíbrio</span>
                      <span className="font-mono font-bold">{((sniperData.deepMemory.mesaDNA?.sectorBalance || 0) * 100).toFixed(0)}%</span>
                    </div>
                    {sniperData.deepMemory.mesaDNA?.terminalSignature?.length > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Terminais</span>
                        <span className="font-mono font-bold">T{sniperData.deepMemory.mesaDNA.terminalSignature.join(',T')}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Vício cilindro</span>
                      <span className="font-mono font-bold">{sniperData.deepMemory.mesaDNA?.cylinderBias || 0} pos.</span>
                    </div>
                  </div>
                </div>
                {/* Cylinder Physics */}
                <div className="bg-secondary/40 rounded-lg p-2 border border-border">
                  <span className="text-[8px] font-bold text-orange-400 block mb-1">🔩 MICRO-VIBRAÇÃO</span>
                  <div className="text-[8px] text-foreground/80 space-y-0.5">
                    {sniperData.deepMemory.cylinderInertia?.biasedNums?.length > 0 && (
                      <div>
                        <span className="text-muted-foreground">Viciados: </span>
                        <span className="font-mono font-bold">{sniperData.deepMemory.cylinderInertia.biasedNums.slice(0, 6).join(',')}</span>
                      </div>
                    )}
                    {sniperData.deepMemory.cylinderInertia?.dominantPin !== null && sniperData.deepMemory.cylinderInertia?.dominantPin !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Pino dom.</span>
                        <span className="font-mono font-bold text-orange-400">#{sniperData.deepMemory.cylinderInertia.dominantPin + 1} (+{sniperData.deepMemory.cylinderInertia.pinStrength}%)</span>
                      </div>
                    )}
                  </div>
                </div>
                {/* Genetic Patterns */}
                <div className="bg-secondary/40 rounded-lg p-2 border border-border">
                  <span className="text-[8px] font-bold text-cyan-400 block mb-1">🧬 PADRÕES GENÉTICOS</span>
                  {sniperData.deepMemory.geneticPatterns?.length > 0 ? (
                    sniperData.deepMemory.geneticPatterns.map((gp: any, i: number) => (
                      <div key={i} className="text-[8px] text-foreground/80 mb-0.5">
                        <span className="font-bold">{gp.name}</span>
                        <span className="text-muted-foreground ml-1">→ {gp.numbers?.slice(0, 5).join(',')}</span>
                      </div>
                    ))
                  ) : (
                    <span className="text-[8px] text-muted-foreground">Evoluindo...</span>
                  )}
                </div>
                {/* Flow Dynamics */}
                <div className="bg-secondary/40 rounded-lg p-2 border border-border">
                  <span className="text-[8px] font-bold text-yellow-400 block mb-1">🌊 DINÂMICA DE FLUXO</span>
                  <div className="text-[8px] text-foreground/80 space-y-0.5">
                    {sniperData.deepMemory.flowDynamics?.mesaFlowState && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Modo</span>
                          <span className={`font-bold ${sniperData.deepMemory.flowDynamics.mesaFlowState.mode === 'concentracao' ? 'text-red-400' : sniperData.deepMemory.flowDynamics.mesaFlowState.mode === 'gangorra' ? 'text-blue-400' : 'text-muted-foreground'}`}>
                            {sniperData.deepMemory.flowDynamics.mesaFlowState.mode === 'concentracao' ? '🔥 Concentração' : sniperData.deepMemory.flowDynamics.mesaFlowState.mode === 'gangorra' ? '🔄 Gangorra' : '⚖️ Neutro'}
                          </span>
                        </div>
                        {sniperData.deepMemory.flowDynamics.mesaFlowState.clusterZone && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Zona</span>
                            <span className="font-mono font-bold text-red-400">{sniperData.deepMemory.flowDynamics.mesaFlowState.clusterZone}</span>
                          </div>
                        )}
                      </>
                    )}
                    {sniperData.deepMemory.flowDynamics?.pullPatterns?.length > 0 && (
                      <div>
                        <span className="text-muted-foreground">Puxadas: </span>
                        {sniperData.deepMemory.flowDynamics.pullPatterns.slice(0, 2).map((pp: any, i: number) => (
                          <span key={i} className="font-mono font-bold">{pp.source}→{pp.dominantSector.slice(0, 4)} </span>
                        ))}
                      </div>
                    )}
                    {sniperData.deepMemory.flowDynamics?.terminalProgression?.predictedNext !== null && sniperData.deepMemory.flowDynamics?.terminalProgression?.predictedNext !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Escada</span>
                        <span className="font-mono font-bold text-yellow-400">→ T{sniperData.deepMemory.flowDynamics.terminalProgression.predictedNext}</span>
                      </div>
                    )}
                    {sniperData.deepMemory.flowDynamics?.neighborJumps >= 3 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Vizinhos</span>
                        <span className="font-mono font-bold text-green-400">{sniperData.deepMemory.flowDynamics.neighborJumps}x seguidos</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* New Analysis Cards Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                {sniperData?.randomnessIndex && (
                  <div className="bg-secondary/40 rounded-lg p-2 border border-border">
                    <span className="text-[8px] font-bold text-rose-400 block mb-1">🛡️ FILTRO RUÍDO</span>
                    <div className="text-[8px] text-foreground/80 space-y-0.5">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Índice</span>
                        <span className={`font-bold ${sniperData.randomnessIndex.overall >= 75 ? 'text-destructive' : sniperData.randomnessIndex.overall >= 50 ? 'text-yellow-400' : 'text-green-400'}`}>
                          {sniperData.randomnessIndex.overall}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Estável</span>
                        <span className={`font-bold ${sniperData.randomnessIndex.stable ? 'text-green-400' : 'text-destructive'}`}>
                          {sniperData.randomnessIndex.stable ? '✅ Sim' : '❌ Não'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                {sniperData?.diamondDeflection?.length > 0 && (
                  <div className="bg-secondary/40 rounded-lg p-2 border border-border">
                    <span className="text-[8px] font-bold text-sky-400 block mb-1">💎 DEFLETORES</span>
                    <div className="text-[8px] text-foreground/80 space-y-0.5">
                      {sniperData.diamondDeflection.slice(0, 3).map((d: any, i: number) => (
                        <div key={i} className="flex justify-between">
                          <span className="text-muted-foreground">D#{d.zone}</span>
                          <span className="font-mono font-bold">{(d.deflectionRate * 100).toFixed(0)}% → {d.targetSector.slice(0, 4)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {sniperData?.kellyBetting && (
                  <div className="bg-secondary/40 rounded-lg p-2 border border-border">
                    <span className="text-[8px] font-bold text-emerald-400 block mb-1">💰 KELLY CRITERION</span>
                    <div className="text-[8px] text-foreground/80 space-y-0.5">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Unidade</span>
                        <span className={`font-bold ${sniperData.kellyBetting.unitMultiplier >= 3 ? 'text-primary' : 'text-foreground'}`}>
                          {sniperData.kellyBetting.unitMultiplier}x
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Risco</span>
                        <span className="font-bold">{sniperData.kellyBetting.riskLevel}</span>
                      </div>
                    </div>
                  </div>
                )}
                {sniperData?.dealerBiometrics && (
                  <div className="bg-secondary/40 rounded-lg p-2 border border-border">
                    <span className="text-[8px] font-bold text-violet-400 block mb-1">🎭 BIOMETRIA DEALER</span>
                    <div className="text-[8px] text-foreground/80 space-y-0.5">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Perfil</span>
                        <span className={`font-bold ${sniperData.dealerBiometrics.profileType === 'mecânico' ? 'text-green-400' : 'text-destructive'}`}>
                          {sniperData.dealerBiometrics.profileType}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Consist.</span>
                        <span className="font-mono font-bold">{sniperData.dealerBiometrics.arcConsistency}%</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ARQUÉTIPOS */}
          {sniperData?.archetypes?.length > 0 && (
            <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
              className="bg-card rounded-xl border border-border p-3">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-amber-400" />
                <span className="font-display text-[10px] tracking-[0.15em] font-bold text-amber-400">7 ARQUÉTIPOS DE PADRÕES</span>
                <span className="text-[7px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold ml-auto">
                  {sniperData.archetypes.filter((a: any) => a.active).length} ATIVOS
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {sniperData.archetypes.filter((a: any) => a.active).map((arch: any, i: number) => (
                  <div key={i} className="rounded-lg p-2 border text-[8px] bg-amber-500/10 border-amber-500/30">
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-sm">{arch.emoji}</span>
                      <span className="font-bold text-amber-400">{arch.name}</span>
                      <span className="ml-auto font-mono font-bold">{arch.strength}%</span>
                    </div>
                    <div className="text-foreground/70 mb-1">{arch.detail}</div>
                    {arch.predictedNums?.length > 0 && (
                      <div className="flex flex-wrap gap-0.5 mt-1">
                        {arch.predictedNums.slice(0, 6).map((n: number) => (
                          <div key={n} className={`w-4 h-4 rounded-full flex items-center justify-center text-[6px] font-bold ${colorClass(n)} border border-white/20`}>{n}</div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* PADRÕES 24H + PULL RADAR + ERROR ANALYSIS */}
          {sniperData?.transitionMatrix && <PatternPanel24h sniperData={sniperData} />}
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {sniperData?.deepMemory?.flowDynamics?.pullPatterns && allNumbers.length > 0 && (
              <PullRadar pullPatterns={sniperData.deepMemory.flowDynamics.pullPatterns} latestNumber={allNumbers[0]} />
            )}
            {sniperData?.errorAnalysis && (
              <div className="bg-card/90 rounded-xl border border-destructive/20 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  <span className="font-display text-[10px] tracking-[0.15em] font-bold text-destructive">ANÁLISE DE ERROS</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                  {Object.entries(sniperData.errorAnalysis.categories || {}).map(([cat, cnt]) => {
                    const labels: Record<string, { icon: string; name: string }> = {
                      dealer_change: { icon: '🎭', name: 'Dealer' },
                      wrong_sector: { icon: '🗺️', name: 'Setor' },
                      wrong_terminal: { icon: '🔢', name: 'Terminal' },
                      deflector_bounce: { icon: '💎', name: 'Defletor' },
                      entropy_break: { icon: '🔀', name: 'Entropia' },
                    };
                    const info = labels[cat] || { icon: '❓', name: cat };
                    return (
                      <div key={cat} className={`rounded-lg p-1.5 text-center border ${
                        (cnt as number) >= 2 ? 'bg-destructive/10 border-destructive/30' : 'bg-secondary/40 border-border'
                      }`}>
                        <span className="text-sm block">{info.icon}</span>
                        <span className={`text-[10px] font-mono font-bold block ${(cnt as number) >= 2 ? 'text-destructive' : 'text-muted-foreground'}`}>{cnt as number}</span>
                        <span className="text-[7px] text-muted-foreground block">{info.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* LOG APRENDIZADO + SCANNER */}
          <AILearningLog allNumbers={allNumbers} sniperData={sniperData} autoLearnStatus={autoLearnStatus} />

                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* COMPACT STATUS BAR — shows key info from internal analysis */}
          {(sniperData?.memoryWindows || allNumbers.length >= 10) && (
            <div className="bg-card/80 rounded-xl border border-border p-2.5">
              <div className="flex flex-wrap items-center gap-2 text-[8px]">
                {sniperData?.memoryWindows?.micro && (
                  <>
                    <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-secondary/60 border border-border">
                      <span className="text-muted-foreground">Dealer:</span>
                      <span className={`font-bold ${
                        sniperData.memoryWindows.micro.dealerRhythm === 'VICIADO' ? 'text-primary' :
                        sniperData.memoryWindows.micro.dealerRhythm === 'Regular' ? 'text-green-400' : 'text-destructive'
                      }`}>{sniperData.memoryWindows.micro.dealerRhythm}</span>
                    </span>
                    <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-secondary/60 border border-border">
                      <span className="text-muted-foreground">Arco:</span>
                      <span className="font-mono font-bold text-foreground">{sniperData.memoryWindows.micro.arcMean}±{sniperData.memoryWindows.micro.arcStd}</span>
                    </span>
                  </>
                )}
                {sniperData?.memoryWindows?.mesa && (
                  <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-secondary/60 border border-border">
                    <span className="text-muted-foreground">Win Rate:</span>
                    <span className={`font-mono font-bold ${sniperData.memoryWindows.mesa.winRate >= 50 ? 'text-green-400' : 'text-yellow-400'}`}>
                      {sniperData.memoryWindows.mesa.winRate}%
                    </span>
                  </span>
                )}
                {computedCavalos.length > 0 && (
                  <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-secondary/60 border border-border">
                    <span className="text-muted-foreground">Cavalo quente:</span>
                    <span className="font-bold text-orange-400">C{computedCavalos[0][0]} ({computedCavalos[0][1]}x)</span>
                  </span>
                )}
                {Object.entries(computedSectors).length > 0 && (() => {
                  const sorted = Object.entries(computedSectors).sort(([,a], [,b]) => (b as number) - (a as number));
                  const total = sorted.reduce((a, [,b]) => a + (b as number), 0);
                  if (sorted.length === 0 || total === 0) return null;
                  const [topSector, topCount] = sorted[0];
                  return (
                    <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-secondary/60 border border-border">
                      <span className="text-muted-foreground">Setor dom.:</span>
                      <span className="font-bold text-cyan-400">{topSector} {(((topCount as number) / total) * 100).toFixed(0)}%</span>
                    </span>
                  );
                })()}
                {(sniperData?.dealerSignature?.maoViciada || computedDealer?.maoViciada) && (
                  <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/15 border border-primary/30">
                    <span className="font-bold text-primary">🎯 MÃO VICIADA</span>
                  </span>
                )}
                {sniperData?.memoryWindows?.macro?.topDebt?.length > 0 && (
                  <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-secondary/60 border border-border">
                    <span className="text-muted-foreground">Dívida:</span>
                    <span className="font-mono font-bold text-blue-400">{sniperData.memoryWindows.macro.topDebt.slice(0, 3).join(', ')}</span>
                  </span>
                )}
              </div>
            </div>
          )}

          {/* HISTÓRICO + TERMINAIS side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
          {/* HISTÓRICO INTERATIVO - 3 cols */}
            <div className="lg:col-span-3 bg-card rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  <span className="font-display text-sm text-primary tracking-widest font-bold">HISTÓRICO</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {[50, 100, 250, 500].map(lim => (
                    <button key={lim} onClick={() => { setHistoryLimit(lim); setSelectedNum(null); }}
                      className={`text-[9px] px-2 py-1 rounded-lg font-bold transition-all ${
                        historyLimit === lim ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-secondary text-muted-foreground border border-border'
                      }`}>
                      {lim}
                    </button>
                  ))}
                  <span className="text-[8px] text-muted-foreground font-mono ml-1">{Math.min(historyLimit, allNumbers.length)} giros</span>
                  <button onClick={async () => {
                    if (!confirm('Limpar todo o histórico de números armazenados?')) return;
                    await supabase.from('roulette_numbers').delete().not('id', 'is', null);
                    setStoredNumbers([]);
                    setApiNumbers([]);
                    prevNumbersRef.current = '';
                    toast.success('Histórico limpo!');
                  }} className="text-[9px] px-2 py-1 rounded-lg font-bold bg-destructive/20 text-destructive border border-destructive/30 hover:bg-destructive/30 transition-all ml-1">
                    🗑️ Limpar
                  </button>
                </div>
              </div>

              {error && <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-2 text-[10px] text-destructive font-semibold mb-2">⚠️ {error}</div>}

              {selectedNum !== null && (
                <button onClick={() => setSelectedNum(null)} className="text-[9px] px-2 py-1 rounded-lg font-bold bg-destructive/20 text-destructive border border-destructive/30 mb-2 hover:bg-destructive/30 transition-all">
                  ✕ Limpar filtro (#{selectedNum})
                </button>
              )}

              {historySlice.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">Aguardando dados...</div>
              ) : (
                <div className="space-y-1">
                  {(() => {
                    const hRows: number[][] = [];
                    for (let i = 0; i < historySlice.length; i += 20) hRows.push(historySlice.slice(i, i + 20));
                    return hRows.map((row, rowIdx) => (
                      <div key={rowIdx} className="flex gap-[3px] flex-wrap">
                        {row.map((n, i) => {
                          const isSelected = selectedNum === n;
                          const isDimmed = selectedNum !== null && selectedNum !== n;
                          return (
                            <motion.div key={`${rowIdx}-${i}-${n}`}
                              initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: isDimmed ? 0.25 : 1 }}
                              transition={{ duration: 0.12, delay: i * 0.005 }}
                              onClick={() => { setSelectedNum(selectedNum === n ? null : n); }}
                              onDoubleClick={() => { setDnaNumber(n); setDnaOpen(true); }}
                              className={`w-[32px] h-[32px] rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm transition-all cursor-pointer border
                                ${isSelected ? 'ring-2 ring-primary scale-110 bg-primary text-primary-foreground border-primary' : isDimmed ? `${colorClass(n)} border-white/5` : `${colorClass(n)} border-white/10 hover:scale-110`}`}>
                              {n}
                            </motion.div>
                          );
                        })}
                      </div>
                    ));
                  })()}
                </div>
              )}

              {/* PAINEL DE INSIGHTS DO NÚMERO SELECIONADO */}
              <AnimatePresence>
                {selectedNum !== null && historySlice.length > 0 && (() => {
                  const positions = historySlice.map((n, i) => n === selectedNum ? i : -1).filter(i => i >= 0);
                  const count = positions.length;
                  const delays = positions.slice(0, -1).map((p, i) => positions[i + 1] - p);
                  const avgDelay = delays.length > 0 ? (delays.reduce((a, b) => a + b, 0) / delays.length).toFixed(1) : '—';
                  const lastDelay = positions[0] !== undefined ? positions[0] : null;
                  // Next numbers after each occurrence
                  const nextNums: number[] = [];
                  positions.forEach(p => { if (p + 1 < historySlice.length) nextNums.push(historySlice[p + 1]); });
                  const nextFreq: Record<number, number> = {};
                  nextNums.forEach(n => { nextFreq[n] = (nextFreq[n] || 0) + 1; });
                  const topNext = Object.entries(nextFreq).sort(([, a], [, b]) => b - a).slice(0, 5);
                  // Previous numbers before each occurrence
                  const prevNums: number[] = [];
                  positions.forEach(p => { if (p - 1 >= 0) prevNums.push(historySlice[p - 1]); });
                  const prevFreq: Record<number, number> = {};
                  prevNums.forEach(n => { prevFreq[n] = (prevFreq[n] || 0) + 1; });
                  const topPrev = Object.entries(prevFreq).sort(([, a], [, b]) => b - a).slice(0, 5);
                  // Sector distribution of next numbers
                  const nextSectors: Record<string, number> = { Voisins: 0, Tiers: 0, Orphelins: 0, Zero: 0 };
                  nextNums.forEach(n => { nextSectors[getSectorName(n)]++; });
                  const totalNextSectors = Object.values(nextSectors).reduce((a, b) => a + b, 0);
                  // Sector distribution of previous numbers
                  const prevSectors: Record<string, number> = { Voisins: 0, Tiers: 0, Orphelins: 0, Zero: 0 };
                  prevNums.forEach(n => { prevSectors[getSectorName(n)]++; });
                  const totalPrevSectors = Object.values(prevSectors).reduce((a, b) => a + b, 0);
                  // Regularity check
                  const isRegular = delays.length >= 3 && delays.every(d => Math.abs(d - delays[0]) <= 2);

                  return (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      className="mt-3 bg-gradient-to-r from-primary/10 via-card to-primary/5 border border-primary/30 rounded-xl p-3 overflow-hidden">
                      <div className="flex items-center gap-2 mb-2">
                        <Crosshair className="w-4 h-4 text-primary" />
                        <span className="font-display text-[10px] tracking-[0.15em] font-bold text-primary">ANÁLISE DO NÚMERO {selectedNum}</span>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${colorClass(selectedNum)} border border-white/20`}>{selectedNum}</div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                        <div className="bg-secondary/50 rounded-lg p-2 text-center border border-border">
                          <span className="text-lg font-bold font-mono text-foreground">{count}</span>
                          <span className="text-[7px] text-muted-foreground block">APARIÇÕES/{historyLimit}</span>
                        </div>
                        <div className="bg-secondary/50 rounded-lg p-2 text-center border border-border">
                          <span className="text-lg font-bold font-mono text-foreground">{avgDelay}</span>
                          <span className="text-[7px] text-muted-foreground block">DELAY MÉDIO</span>
                        </div>
                        <div className={`rounded-lg p-2 text-center border ${lastDelay !== null && lastDelay === 0 ? 'bg-green-500/10 border-green-500/30' : 'bg-secondary/50 border-border'}`}>
                          <span className={`text-lg font-bold font-mono ${lastDelay !== null && lastDelay <= 10 ? 'text-green-400' : 'text-foreground'}`}>
                            {lastDelay !== null ? lastDelay : '—'}
                          </span>
                          <span className="text-[7px] text-muted-foreground block">GIROS ATRÁS</span>
                        </div>
                        <div className={`rounded-lg p-2 text-center border ${isRegular ? 'bg-primary/10 border-primary/30' : 'bg-secondary/50 border-border'}`}>
                          <span className={`text-lg font-bold font-mono ${isRegular ? 'text-primary' : 'text-foreground'}`}>
                            {isRegular ? '🎯' : '🔀'}
                          </span>
                          <span className="text-[7px] text-muted-foreground block">{isRegular ? 'REGULAR' : 'ALEATÓRIO'}</span>
                        </div>
                      </div>

                      {isRegular && delays.length >= 3 && (
                        <div className="bg-primary/10 border border-primary/30 rounded-lg p-2 text-center mb-2">
                          <span className="text-[9px] font-bold text-primary">🎯 ASSINATURA DE MÃO DETECTADA — Intervalo ~{delays[0]} rodadas (Dealer com mecânica perfeita)</span>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {/* Previous numbers (before) */}
                        <div className="bg-secondary/40 rounded-lg p-2 border border-border">
                          <span className="text-[8px] font-bold text-foreground block mb-1">⬅️ NÚMEROS QUE SAEM ANTES</span>
                          {topPrev.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {topPrev.map(([num, freq]) => (
                                <div key={num} className="flex items-center gap-0.5">
                                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[7px] font-bold ${colorClass(Number(num))} border border-white/20`}>{num}</div>
                                  <span className="text-[7px] font-mono text-muted-foreground">{freq}x</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[8px] text-muted-foreground">Sem dados suficientes</span>
                          )}
                        </div>

                        {/* Next numbers (after) */}
                        <div className="bg-secondary/40 rounded-lg p-2 border border-border">
                          <span className="text-[8px] font-bold text-foreground block mb-1">➡️ NÚMEROS QUE SAEM DEPOIS</span>
                          {topNext.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {topNext.map(([num, freq]) => (
                                <div key={num} className="flex items-center gap-0.5">
                                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[7px] font-bold ${colorClass(Number(num))} border border-white/20`}>{num}</div>
                                  <span className="text-[7px] font-mono text-muted-foreground">{freq}x</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[8px] text-muted-foreground">Sem dados suficientes</span>
                          )}
                        </div>

                        {/* Sector heat map BEFORE */}
                        <div className="bg-secondary/40 rounded-lg p-2 border border-border">
                          <span className="text-[8px] font-bold text-foreground block mb-1">🌡️ CALOR PRÉ-GIRO</span>
                          {totalPrevSectors > 0 ? (
                            <div className="space-y-1">
                              {Object.entries(prevSectors).sort(([, a], [, b]) => b - a).map(([sector, cnt]) => {
                                const pct = totalPrevSectors > 0 ? (cnt / totalPrevSectors) * 100 : 0;
                                return (
                                  <div key={sector} className="space-y-0.5">
                                    <div className="flex justify-between text-[9px]">
                                      <span className="text-muted-foreground">{sector}</span>
                                      <span className="font-mono font-bold text-foreground">{pct.toFixed(0)}% ({cnt}/{totalPrevSectors})</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                                      <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-[8px] text-muted-foreground">Sem dados suficientes</span>
                          )}
                        </div>

                        {/* Sector heat map AFTER */}
                        <div className="bg-secondary/40 rounded-lg p-2 border border-border">
                          <span className="text-[8px] font-bold text-foreground block mb-1">🌡️ CALOR PÓS-GIRO</span>
                          {totalNextSectors > 0 ? (
                            <div className="space-y-1">
                              {Object.entries(nextSectors).sort(([, a], [, b]) => b - a).map(([sector, cnt]) => {
                                const pct = totalNextSectors > 0 ? (cnt / totalNextSectors) * 100 : 0;
                                return (
                                  <div key={sector} className="space-y-0.5">
                                    <div className="flex justify-between text-[9px]">
                                      <span className="text-muted-foreground">{sector}</span>
                                      <span className="font-mono font-bold text-foreground">{pct.toFixed(0)}% ({cnt}/{totalNextSectors})</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-[8px] text-muted-foreground">Sem dados suficientes</span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })()}
              </AnimatePresence>

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
                <span className="text-[7px] text-muted-foreground/60 ml-auto">Clique para filtrar • Duplo-clique para DNA completo</span>
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

      {/* DNA Dialog */}
      <NumberDNADialog number={dnaNumber} allNumbers={allNumbers} open={dnaOpen} onClose={() => setDnaOpen(false)} />
    </div>
  );
};

export default Index;
