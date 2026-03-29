import { useState, useEffect, useRef, useCallback } from 'react';

import { supabase } from '@/integrations/supabase/client';
import {
  Activity, MonitorPlay, RefreshCw, Brain, Sparkles, TrendingUp,
  Hash, Flame, Snowflake, Target, BarChart3, ChevronDown,
  Zap, Clock, GraduationCap, Crosshair, Eye, AlertTriangle
} from 'lucide-react';
import Scanner500 from '@/components/Scanner500';
import PatternPanel24h from '@/components/PatternPanel24h';
import PredictionHistory from '@/components/PredictionHistory';
import BetPanel from '@/components/BetPanel';
import AILearningLog from '@/components/AILearningLog';
import NumberDNADialog from '@/components/NumberDNADialog';
import PullRadar from '@/components/PullRadar';
import Navbar from '@/components/Navbar';
import StatsBar from '@/components/StatsBar';
import Last12Numbers from '@/components/Last12Numbers';
import ZeroPressure from '@/components/ZeroPressure';
import SniperSignal from '@/components/SniperSignal';
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

const DUPLICATE_SPIN_WINDOW_MS = 5000;

const getPrependedNumbers = (next: number[], previous: number[]) => {
  if (previous.length === 0) return next;

  const maxOffset = Math.min(12, next.length);

  for (let offset = 0; offset <= maxOffset; offset++) {
    const compareCount = Math.min(10, previous.length, next.length - offset);
    if (compareCount <= 0) continue;

    let matches = true;
    for (let i = 0; i < compareCount; i++) {
      if (next[offset + i] !== previous[i]) {
        matches = false;
        break;
      }
    }

    if (matches) return next.slice(0, offset);
  }

  return [];
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
const colorClass = (n: number) => {
  if (n === 0) return 'bg-roulette-green text-white';
  return RED_NUMBERS.includes(n) ? 'bg-roulette-red text-white' : 'bg-roulette-black text-white';
};

const ROULETTE_TABLES = [
  { id: 'brasileira', name: 'Roleta Brasileira', provider: 'Playtech', iframeUrl: 'https://onabet.com/' },
];

const PATTERN_ICONS: Record<string, typeof Brain> = {
  streak: TrendingUp, terminal: Hash, dozen: BarChart3, column: BarChart3,
  hot: Flame, cold: Snowflake, parity: RefreshCw, sector: Target,
  frequency_bias: Flame, terminal_pattern: Hash, color_tendency: TrendingUp,
  dozen_cycle: BarChart3, cavalos_pattern: Target, timing_pattern: Clock,
  streak_behavior: TrendingUp, sector_concentration: Target,
};

const Index = () => {
  const [selectedTable] = useState(ROULETTE_TABLES[0]);
  const [apiNumbers, setApiNumbers] = useState<number[]>([]);
  const [storedNumbers, setStoredNumbers] = useState<number[]>([]);
  const [isPolling, setIsPolling] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const prevNumbersRef = useRef<string>('');
  const [sniperData, setSniperData] = useState<any>(null);
  const [sniperCountdown, setSniperCountdown] = useState(13);
  const sniperPrevKey = useRef<string>('');
  const sniperSameCount = useRef(0);
  const [sniperStale, setSniperStale] = useState(false);
  const [lastPredResult, setLastPredResult] = useState<{ hit: boolean | null; hitType: string | null; predicted: number | null; actual: number | null; label: string } | null>(null);
  const [autoLearnStatus, setAutoLearnStatus] = useState<'idle' | 'learning' | 'analyzing' | 'backtesting'>('idle');
  const [showCasino, setShowCasino] = useState(false);
  const [predStats, setPredStats] = useState<{ hits: number; misses: number; exact: number; total: number }>({ hits: 0, misses: 0, exact: 0, total: 0 });
  const [historyLimit, setHistoryLimit] = useState(100);
  const [selectedNum, setSelectedNum] = useState<number | null>(null);
  const [dnaNumber, setDnaNumber] = useState<number | null>(null);
  const [dnaOpen, setDnaOpen] = useState(false);
  const [confidenceFilter, setConfidenceFilter] = useState(true);
  const [sampleSize, setSampleSize] = useState(100);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPredHistory, setShowPredHistory] = useState(false);

  // Track if sniper is already being fetched to avoid double calls
  const sniperFetchingRef = useRef(false);
  const lastSniperTriggerRef = useRef(0);
  const lastSpinSignatureRef = useRef('');
  const apiSnapshotRef = useRef<number[]>([]);
  const lastAcceptedSpinRef = useRef<{ number: number | null; timestamp: number }>({ number: null, timestamp: 0 });
  const processedPredictionEventsRef = useRef<Record<string, number>>({});

  const isBurstDuplicate = useCallback((number: number) => {
    const { number: lastNumber, timestamp } = lastAcceptedSpinRef.current;
    return lastNumber === number && Date.now() - timestamp < DUPLICATE_SPIN_WINDOW_MS;
  }, []);

  const markAcceptedSpin = useCallback((number: number) => {
    lastAcceptedSpinRef.current = { number, timestamp: Date.now() };
  }, []);

  const shouldProcessPredictionEvent = useCallback((row: { id: string; hit: boolean | null; hit_type: string | null; actual_number: number | null }) => {
    const now = Date.now();
    Object.keys(processedPredictionEventsRef.current).forEach((key) => {
      if (now - processedPredictionEventsRef.current[key] > 15000) delete processedPredictionEventsRef.current[key];
    });

    const eventKey = `${row.id}-${row.hit}-${row.hit_type}-${row.actual_number}`;
    if (processedPredictionEventsRef.current[eventKey]) return false;
    processedPredictionEventsRef.current[eventKey] = now;
    return true;
  }, []);

  const handleNewSpin = useCallback((signature: string, latestNumber?: number) => {
    if (!signature || signature === lastSpinSignatureRef.current) return;
    lastSpinSignatureRef.current = signature;
    sniperSameCount.current = 0;
    setSniperStale(false);
    setSniperCountdown(13);
  }, []);

  const fetchSniper = useCallback(async () => {
    const now = Date.now();
    if (now - lastSniperTriggerRef.current < 1200) return;
    if (sniperFetchingRef.current) return;
    sniperFetchingRef.current = true;
    lastSniperTriggerRef.current = now;
    try {
      const res = await supabase.functions.invoke('sniper-predict', { body: { sampleSize } });
      if (res.data) {
        const key = `${res.data.strategy?.type}-${res.data.signal?.number}-${res.data.mode}`;
        if (key !== sniperPrevKey.current) {
          sniperPrevKey.current = key;
          sniperSameCount.current = 0;
          setSniperStale(false);
        } else {
          sniperSameCount.current++;
          if (sniperSameCount.current >= 3) setSniperStale(true);
        }
        setSniperData(res.data);
      }
    } catch (err) { console.error('Sniper error:', err); }
    finally { sniperFetchingRef.current = false; }
  }, [sampleSize]);

  // === Data Fetching ===
  const fetchNumbers = useCallback(async () => {
    try {
      const res = await supabase.functions.invoke('proxy-roleta');
      if (res.error) throw new Error(res.error.message);
      const data = res.data;
      if (data?.results && Array.isArray(data.results)) {
        const nums = data.results.map((n: unknown) => Number(n)).filter((n: number) => !isNaN(n) && n >= 0 && n <= 36);
        const previousSnapshot = apiSnapshotRef.current;
        const newNumbers = getPrependedNumbers(nums, previousSnapshot);
        const key = nums.slice(0, 20).join(',');

        if (previousSnapshot.length === 0) {
          apiSnapshotRef.current = nums;
          setApiNumbers(nums);
          setLastUpdate(new Date());
          prevNumbersRef.current = key;
        } else if (newNumbers.length > 0) {
          apiSnapshotRef.current = nums;
          setApiNumbers(prev => [...newNumbers, ...prev].slice(0, 1000));
          setLastUpdate(new Date());

          if (!isBurstDuplicate(newNumbers[0])) {
            markAcceptedSpin(newNumbers[0]);
            handleNewSpin(nums.slice(0, 3).join(','), newNumbers[0]);
            fetchSniper();
          }

          prevNumbersRef.current = key;
        }
        setError(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }, [fetchSniper, handleNewSpin, isBurstDuplicate, markAcceptedSpin]);

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
    fetchSniper();
    if (!isPolling) return;
    const interval = setInterval(() => { fetchNumbers(); fetchStored(); }, 3000);
    return () => clearInterval(interval);
  }, [fetchNumbers, fetchStored, fetchSniper, isPolling]);

  // Also trigger sniper instantly via realtime when a new number is inserted
  useEffect(() => {
    const ch = supabase.channel('sniper_trigger_rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'roulette_numbers' }, (payload: any) => {
        const row = payload?.new;
        if (typeof row?.number === 'number' && !isBurstDuplicate(row.number)) {
          markAcceptedSpin(row.number);
          apiSnapshotRef.current = [row.number, ...apiSnapshotRef.current].slice(0, 1000);
          setApiNumbers(prev => prev[0] === row.number ? prev : [row.number, ...prev].slice(0, 1000));
          handleNewSpin(`${row.number}-${row.fetched_at ?? ''}`, row.number);
          setLastUpdate(new Date());
          fetchSniper();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchSniper, handleNewSpin, isBurstDuplicate, markAcceptedSpin]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSniperCountdown(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // === Data loading ===
  const loadPredStats = useCallback(async () => {
    const { data } = await supabase.from('prediction_history').select('hit, hit_type').not('hit', 'is', null).limit(500);
    if (data) {
      const hits = data.filter((r: any) => r.hit === true).length;
      const exact = data.filter((r: any) => r.hit_type === 'exact').length;
      setPredStats({ hits, misses: data.length - hits, exact, total: data.length });
    }
  }, []);

  useEffect(() => { loadPredStats(); }, [loadPredStats]);

  // === Auto Learning ===
  const autoLearnRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cycleRef = useRef(0);
  const autoLearnErrorCount = useRef(0);
  const autoLearnDisabled = useRef(false);

  useEffect(() => {
    const runContinuousLearn = async () => {
      if (autoLearnDisabled.current || autoLearnErrorCount.current >= 2) {
        autoLearnDisabled.current = true;
        setAutoLearnStatus('idle');
        return;
      }
      const cycle = cycleRef.current++;
      try {
        if (cycle % 3 === 0) {
          setAutoLearnStatus('learning');
          const res = await supabase.functions.invoke('ai-learn');
          if (res?.error || res?.data?.error) throw new Error(res?.data?.error || res?.error?.message || 'ai-learn failed');
        } else if (cycle % 3 === 1) {
          setAutoLearnStatus('analyzing');
          const res = await supabase.functions.invoke('auto-analyze-patterns');
          if (res?.error || res?.data?.error) throw new Error(res?.data?.error || res?.error?.message || 'auto-analyze failed');
        } else {
          setAutoLearnStatus('backtesting');
          await supabase.functions.invoke('sniper-predict');
        }
        autoLearnErrorCount.current = 0;
      } catch (err: any) {
        autoLearnErrorCount.current++;
        const msg = err?.message || String(err);
        if (/402|429|[Cc]redit|[Rr]ate|exhausted|payment/i.test(msg)) {
          autoLearnDisabled.current = true;
          console.warn('Créditos de IA esgotados.');
        }
      } finally {
        setAutoLearnStatus('idle');
      }
    };
    const t = setTimeout(runContinuousLearn, 20_000);
    autoLearnRef.current = setInterval(runContinuousLearn, 300_000);
    return () => { clearTimeout(t); if (autoLearnRef.current) clearInterval(autoLearnRef.current); };
  }, []);

  // === Realtime ===
  useEffect(() => {
    const ch = supabase.channel('prediction_result_rt').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'prediction_history' }, (payload: any) => {
      const row = payload.new;
      if (row && row.hit !== null && row.actual_number !== null) {
        if (!shouldProcessPredictionEvent(row)) return;

        const isHit = row.hit === true;
        const hitType = row.hit_type;
        const label = row.strategy_label || row.strategy_type || 'Previsão';
        setLastPredResult({ hit: isHit, hitType, predicted: row.predicted_main, actual: row.actual_number, label });

        if (isHit) {
          console.log(`${hitType === 'exact' ? '🎯 ACERTO EXATO!' : '✅ ACERTO VIZINHO!'} ${label} — Previsto: ${row.predicted_main}, Saiu: ${row.actual_number}`);
        } else {
          console.log(`❌ ERRO — ${label} — Previsto: ${row.predicted_main}, Saiu: ${row.actual_number}`);
        }

        loadPredStats();
      }
    }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadPredStats, shouldProcessPredictionEvent]);

  const triggerLearn = async () => {
    setIsAnalyzing(true);
    try {
      const res = await supabase.functions.invoke('ai-learn');
      if (res.error || res.data?.error) {
        const status = res.error?.context?.status;
        const message = res.data?.error || res.error?.message || '';
        if (status === 402 || message.includes('Credits')) { console.warn('Créditos de IA esgotados.'); return; }
        if (status === 429 || message.includes('Rate')) { console.warn('Muitas tentativas.'); return; }
      }
    } catch (err) { console.error(err); }
    finally { setIsAnalyzing(false); }
  };

  // === Computed ===
  const allNumbers = apiNumbers.length > 0 ? apiNumbers : storedNumbers;
  const historySlice = allNumbers.slice(0, historyLimit);

  const terminalFreq = allNumbers.slice(0, 200).reduce<Record<number, number>>((acc, n) => {
    const t = n % 10; acc[t] = (acc[t] || 0) + 1; return acc;
  }, {});
  const maxTerminalFreq = Math.max(...Object.values(terminalFreq), 1);

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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Navbar */}
      <Navbar
        isPolling={isPolling} setIsPolling={setIsPolling}
        isAnalyzing={isAnalyzing} triggerLearn={triggerLearn}
        confidenceFilter={confidenceFilter} setConfidenceFilter={setConfidenceFilter}
        lastUpdate={lastUpdate} fetchNumbers={fetchNumbers} fetchStored={fetchStored}
        autoLearnStatus={autoLearnStatus}
        onShowHistory={() => setShowPredHistory(!showPredHistory)}
      />

      {/* Stats Bar - Fixo */}
      <StatsBar predStats={predStats} setPredStats={setPredStats} />

      {/* Prediction History Panel */}
      <AnimatePresence>
        {showPredHistory && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-border"
          >
            <div className="max-w-[1400px] mx-auto p-3">
              <PredictionHistory />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1400px] mx-auto p-3 space-y-3">

          {/* Últimos 12 */}
          <Last12Numbers allNumbers={allNumbers} />

          {/* SNIPER + BET PANEL */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="lg:col-span-2 space-y-2">
              {/* Sample Size Selector */}
              <div className="bg-card rounded-xl border border-border p-3 flex items-center gap-3">
                <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">📊 Base de Análise:</span>
                <input
                  type="range"
                  min={10}
                  max={500}
                  step={10}
                  value={sampleSize}
                  onChange={e => setSampleSize(Number(e.target.value))}
                  className="flex-1 accent-primary h-2 cursor-pointer"
                />
                <span className="text-sm font-bold text-primary min-w-[60px] text-right">{sampleSize} jogadas</span>
              </div>
              <SniperSignal
                sniperData={sniperData}
                sniperCountdown={sniperCountdown}
                sniperStale={sniperStale}
                lastPredResult={lastPredResult}
                confidenceFilter={confidenceFilter}
              />
            </div>
            <div className="lg:col-span-1">
              <BetPanel sniperData={sniperData} allNumbers={allNumbers} />
            </div>
          </div>

          {/* TOP ALTERNATIVAS */}
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
                        <div key={j} className={`w-5 h-5 rounded-full flex items-center justify-center text-[7px] font-bold ${colorClass(n)} border border-white/10`}>{n}</div>
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

          {/* ANÁLISE AVANÇADA (COLAPSÁVEL) */}
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

          {/* AI LEARNINGS */}
          {sniperData?.aiLearnings?.length > 0 && (
            <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-r from-purple-500/10 via-card to-blue-500/10 rounded-xl border border-purple-500/30 p-3">
              <div className="flex items-center gap-2 mb-2">
                <GraduationCap className="w-4 h-4 text-purple-400" />
                <span className="font-display text-[10px] tracking-[0.15em] font-bold text-purple-400">O QUE A IA APRENDEU AGORA</span>
                {sniperData.noiseFiltered > 0 && (
                  <span className="text-[7px] px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 font-bold ml-auto">
                    🔇 {sniperData.noiseFiltered} ruídos filtrados
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {sniperData.aiLearnings.map((learning: string, i: number) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-start gap-1.5 px-2 py-1.5 rounded-lg bg-secondary/60 border border-border">
                    <Sparkles className="w-3 h-3 text-purple-400 mt-0.5 shrink-0" />
                    <span className="text-[9px] text-foreground/90 leading-tight">{learning}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* DEEP MEMORY */}
          {sniperData?.deepMemory && (
            <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-r from-blue-500/10 via-card to-emerald-500/10 rounded-xl border border-blue-500/30 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="w-4 h-4 text-blue-400" />
                <span className="font-display text-[10px] tracking-[0.15em] font-bold text-blue-400">MEMÓRIA PROFUNDA</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                <div className="bg-secondary/40 rounded-lg p-2 border border-border">
                  <span className="text-[8px] font-bold text-purple-400 block mb-1">👻 ANCESTRAIS</span>
                  {sniperData.deepMemory.ancestralPatterns?.length > 0 ?
                    sniperData.deepMemory.ancestralPatterns.map((p: any, i: number) => (
                      <div key={i} className="text-[8px] text-foreground/80 mb-0.5">
                        <span className="font-mono">{p.pattern?.slice(0, 5).join(',')}</span>
                        <span className="text-muted-foreground ml-1">({p.occurrences}x)</span>
                      </div>
                    )) : <span className="text-[8px] text-muted-foreground">Coletando...</span>
                  }
                </div>
                <div className="bg-secondary/40 rounded-lg p-2 border border-border">
                  <span className="text-[8px] font-bold text-emerald-400 block mb-1">🧬 DNA MESA</span>
                  <div className="text-[8px] text-foreground/80 space-y-0.5">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Equilíbrio</span>
                      <span className="font-mono font-bold">{((sniperData.deepMemory.mesaDNA?.sectorBalance || 0) * 100).toFixed(0)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Vício</span>
                      <span className="font-mono font-bold">{sniperData.deepMemory.mesaDNA?.cylinderBias || 0}</span>
                    </div>
                  </div>
                </div>
                <div className="bg-secondary/40 rounded-lg p-2 border border-border">
                  <span className="text-[8px] font-bold text-orange-400 block mb-1">🔩 VIBRAÇÃO</span>
                  <div className="text-[8px] text-foreground/80 space-y-0.5">
                    {sniperData.deepMemory.cylinderInertia?.biasedNums?.length > 0 && (
                      <div><span className="text-muted-foreground">Viciados: </span><span className="font-mono font-bold">{sniperData.deepMemory.cylinderInertia.biasedNums.slice(0, 6).join(',')}</span></div>
                    )}
                  </div>
                </div>
                <div className="bg-secondary/40 rounded-lg p-2 border border-border">
                  <span className="text-[8px] font-bold text-cyan-400 block mb-1">🧬 GENÉTICOS</span>
                  {sniperData.deepMemory.geneticPatterns?.length > 0 ?
                    sniperData.deepMemory.geneticPatterns.map((gp: any, i: number) => (
                      <div key={i} className="text-[8px] text-foreground/80 mb-0.5">
                        <span className="font-bold">{gp.name}</span>
                        <span className="text-muted-foreground ml-1">→ {gp.numbers?.slice(0, 5).join(',')}</span>
                      </div>
                    )) : <span className="text-[8px] text-muted-foreground">Evoluindo...</span>
                  }
                </div>
                <div className="bg-secondary/40 rounded-lg p-2 border border-border">
                  <span className="text-[8px] font-bold text-yellow-400 block mb-1">🌊 FLUXO</span>
                  <div className="text-[8px] text-foreground/80 space-y-0.5">
                    {sniperData.deepMemory.flowDynamics?.mesaFlowState && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Modo</span>
                        <span className={`font-bold ${sniperData.deepMemory.flowDynamics.mesaFlowState.mode === 'concentracao' ? 'text-red-400' : 'text-muted-foreground'}`}>
                          {sniperData.deepMemory.flowDynamics.mesaFlowState.mode === 'concentracao' ? '🔥' : '⚖️'} {sniperData.deepMemory.flowDynamics.mesaFlowState.mode}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Extra analysis cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                {sniperData?.randomnessIndex && (
                  <div className="bg-secondary/40 rounded-lg p-2 border border-border">
                    <span className="text-[8px] font-bold text-rose-400 block mb-1">🛡️ RUÍDO</span>
                    <div className="text-[8px] space-y-0.5">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Índice</span>
                        <span className={`font-bold ${sniperData.randomnessIndex.overall >= 75 ? 'text-destructive' : 'text-green-400'}`}>{sniperData.randomnessIndex.overall}%</span>
                      </div>
                    </div>
                  </div>
                )}
                {sniperData?.kellyBetting && (
                  <div className="bg-secondary/40 rounded-lg p-2 border border-border">
                    <span className="text-[8px] font-bold text-emerald-400 block mb-1">💰 KELLY</span>
                    <div className="text-[8px] space-y-0.5">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Unidade</span>
                        <span className="font-bold">{sniperData.kellyBetting.unitMultiplier}x</span>
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
                    <span className="text-[8px] font-bold text-violet-400 block mb-1">🎭 DEALER</span>
                    <div className="text-[8px] space-y-0.5">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Perfil</span>
                        <span className={`font-bold ${sniperData.dealerBiometrics.profileType === 'mecânico' ? 'text-green-400' : 'text-destructive'}`}>
                          {sniperData.dealerBiometrics.profileType}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                {sniperData?.diamondDeflection?.length > 0 && (
                  <div className="bg-secondary/40 rounded-lg p-2 border border-border">
                    <span className="text-[8px] font-bold text-sky-400 block mb-1">💎 DEFLETORES</span>
                    <div className="text-[8px] space-y-0.5">
                      {sniperData.diamondDeflection.slice(0, 3).map((d: any, i: number) => (
                        <div key={i} className="flex justify-between">
                          <span className="text-muted-foreground">D#{d.zone}</span>
                          <span className="font-mono font-bold">{(d.deflectionRate * 100).toFixed(0)}%</span>
                        </div>
                      ))}
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
                <span className="font-display text-[10px] tracking-[0.15em] font-bold text-amber-400">ARQUÉTIPOS ATIVOS</span>
                <span className="text-[7px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold ml-auto">
                  {sniperData.archetypes.filter((a: any) => a.active).length}
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

          {/* PADRÕES 24H + PULL RADAR + ERROS */}
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

          {/* LOG */}
          <AILearningLog allNumbers={allNumbers} sniperData={sniperData} autoLearnStatus={autoLearnStatus} />

                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* STATUS BAR */}
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
                {computedCavalos.length > 0 && (
                  <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-secondary/60 border border-border">
                    <span className="text-muted-foreground">Cavalo:</span>
                    <span className="font-bold text-orange-400">C{computedCavalos[0][0]} ({computedCavalos[0][1]}x)</span>
                  </span>
                )}
                {Object.entries(computedSectors).length > 0 && (() => {
                  const sorted = Object.entries(computedSectors).sort(([,a], [,b]) => (b as number) - (a as number));
                  const total = sorted.reduce((a, [,b]) => a + (b as number), 0);
                  if (total === 0) return null;
                  const [topSector, topCount] = sorted[0];
                  return (
                    <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-secondary/60 border border-border">
                      <span className="text-muted-foreground">Setor:</span>
                      <span className="font-bold text-cyan-400">{topSector} {(((topCount as number) / total) * 100).toFixed(0)}%</span>
                    </span>
                  );
                })()}
                {sniperData?.memoryWindows?.macro?.topDebt?.length > 0 && (
                  <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-secondary/60 border border-border">
                    <span className="text-muted-foreground">Dívida:</span>
                    <span className="font-mono font-bold text-blue-400">{sniperData.memoryWindows.macro.topDebt.slice(0, 3).join(', ')}</span>
                  </span>
                )}
              </div>
            </div>
          )}

          {/* HISTÓRICO + TERMINAIS */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
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
                    if (!confirm('Limpar todo o histórico?')) return;
                    await supabase.from('roulette_numbers').delete().not('id', 'is', null);
                    apiSnapshotRef.current = apiNumbers.length > 0 ? [...apiNumbers] : [...storedNumbers];
                    lastAcceptedSpinRef.current = { number: null, timestamp: 0 };
                    lastSpinSignatureRef.current = '';
                    setStoredNumbers([]);
                    setApiNumbers([]);
                    prevNumbersRef.current = apiSnapshotRef.current.slice(0, 20).join(',');
                    console.log('Histórico limpo!');
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
                              onClick={() => setSelectedNum(selectedNum === n ? null : n)}
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

              {/* ANÁLISE DO NÚMERO SELECIONADO */}
              <AnimatePresence>
                {selectedNum !== null && historySlice.length > 0 && (() => {
                  const positions = historySlice.map((n, i) => n === selectedNum ? i : -1).filter(i => i >= 0);
                  const count = positions.length;
                  const delays = positions.slice(0, -1).map((p, i) => positions[i + 1] - p);
                  const avgDelay = delays.length > 0 ? (delays.reduce((a, b) => a + b, 0) / delays.length).toFixed(1) : '—';
                  const lastDelay = positions[0] !== undefined ? positions[0] : null;
                  const nextNums: number[] = [];
                  positions.forEach(p => { if (p + 1 < historySlice.length) nextNums.push(historySlice[p + 1]); });
                  const nextFreq: Record<number, number> = {};
                  nextNums.forEach(n => { nextFreq[n] = (nextFreq[n] || 0) + 1; });
                  const topNext = Object.entries(nextFreq).sort(([, a], [, b]) => b - a).slice(0, 5);
                  const prevNums: number[] = [];
                  positions.forEach(p => { if (p - 1 >= 0) prevNums.push(historySlice[p - 1]); });
                  const prevFreq: Record<number, number> = {};
                  prevNums.forEach(n => { prevFreq[n] = (prevFreq[n] || 0) + 1; });
                  const topPrev = Object.entries(prevFreq).sort(([, a], [, b]) => b - a).slice(0, 5);
                  const isRegular = delays.length >= 3 && delays.every(d => Math.abs(d - delays[0]) <= 2);

                  return (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      className="mt-3 bg-gradient-to-r from-primary/10 via-card to-primary/5 border border-primary/30 rounded-xl p-3 overflow-hidden">
                      <div className="flex items-center gap-2 mb-2">
                        <Crosshair className="w-4 h-4 text-primary" />
                        <span className="font-display text-[10px] tracking-[0.15em] font-bold text-primary">ANÁLISE #{selectedNum}</span>
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
                          <span className="text-[9px] font-bold text-primary">🎯 ASSINATURA DE MÃO — Intervalo ~{delays[0]} rodadas</span>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="bg-secondary/40 rounded-lg p-2 border border-border">
                          <span className="text-[8px] font-bold text-foreground block mb-1">⬅️ NÚMEROS ANTES</span>
                          {topPrev.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {topPrev.map(([num, freq]) => (
                                <div key={num} className="flex items-center gap-0.5">
                                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[7px] font-bold ${colorClass(Number(num))} border border-white/20`}>{num}</div>
                                  <span className="text-[7px] font-mono text-muted-foreground">{freq}x</span>
                                </div>
                              ))}
                            </div>
                          ) : <span className="text-[8px] text-muted-foreground">Sem dados</span>}
                        </div>
                        <div className="bg-secondary/40 rounded-lg p-2 border border-border">
                          <span className="text-[8px] font-bold text-foreground block mb-1">➡️ NÚMEROS DEPOIS</span>
                          {topNext.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {topNext.map(([num, freq]) => (
                                <div key={num} className="flex items-center gap-0.5">
                                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[7px] font-bold ${colorClass(Number(num))} border border-white/20`}>{num}</div>
                                  <span className="text-[7px] font-mono text-muted-foreground">{freq}x</span>
                                </div>
                              ))}
                            </div>
                          ) : <span className="text-[8px] text-muted-foreground">Sem dados</span>}
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
                <span className="text-[7px] text-muted-foreground/60 ml-auto">Clique filtrar • 2x DNA</span>
              </div>
            </div>

            {/* TERMINAIS */}
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

          {/* CASSINO */}
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

      <NumberDNADialog number={dnaNumber} allNumbers={allNumbers} open={dnaOpen} onClose={() => setDnaOpen(false)} />
    </div>
  );
};

export default Index;
