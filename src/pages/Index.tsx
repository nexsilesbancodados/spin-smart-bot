import { useState, useEffect, useRef, useCallback, useMemo, memo, startTransition } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Activity, Brain, ChevronDown, Power, MonitorPlay, Crosshair
} from 'lucide-react';
import PredictionHistory from '@/components/PredictionHistory';
import BetPanel from '@/components/BetPanel';
import AILearningLog from '@/components/AILearningLog';
import NumberDNADialog from '@/components/NumberDNADialog';
import PullRadar from '@/components/PullRadar';
import StrategyLeaderboard from '@/components/StrategyLeaderboard';
import Navbar from '@/components/Navbar';
import Last12Numbers from '@/components/Last12Numbers';
import ZeroPressure from '@/components/ZeroPressure';
import SessionSummary from '@/components/SessionSummary';
import SniperSignal from '@/components/SniperSignal';
import ManualInput from '@/components/ManualInput';
import WheelMap from '@/components/WheelMap';
import Scanner500 from '@/components/Scanner500';
import BacktestPanel from '@/components/BacktestPanel';
import PatternPanel24h from '@/components/PatternPanel24h';
import EngineSignalCard from '@/components/EngineSignalCard';
import NumberTicker from '@/components/NumberTicker';
import AIIntelligenceLog from '@/components/AIIntelligenceLog';
import { motion, AnimatePresence } from 'framer-motion';

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

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

const DUPLICATE_SPIN_WINDOW_MS = 12000;
const SIGNAL_WINDOW_SECONDS = 18;
const POLL_INTERVAL_MS = 1000;
const ROULETTE_TABLES = [
  { id: 'brasileira', name: 'Roleta Brasileira', provider: 'Playtech', iframeUrl: 'https://onabet.com/casino/roleta-brasileira' },
  { id: 'brasileira2', name: 'Roleta Brasileira 2', provider: 'Playtech', iframeUrl: 'https://onabet.com/casino/roleta-ao-vivo' },
];

const colorClass = (n: number) => {
  if (n === 0) return 'bg-emerald-600 text-white';
  return RED_NUMBERS.has(n) ? 'bg-red-600 text-white' : 'bg-zinc-800 text-white';
};
const getSectorName = (n: number) => VOISINS_NUMS.includes(n) ? 'Voisins' : TIERS_NUMS.includes(n) ? 'Tiers' : ORPHELINS_NUMS.includes(n) ? 'Orphelins' : 'Zero';
const getCavaloGroup = (n: number) => { for (const [k, v] of Object.entries(CAVALOS_GROUPS)) if (v.includes(n)) return k; return null; };

const playSound = (type: 'hit' | 'miss' | 'signal', enabled: boolean) => {
  if (!enabled) return;
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (type === 'hit') {
      osc.frequency.setValueAtTime(523, ctx.currentTime);
      osc.frequency.setValueAtTime(784, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } else if (type === 'miss') {
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } else {
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch { /* no audio */ }
};

const getPrependedNumbers = (next: number[], previous: number[]) => {
  if (previous.length === 0) return next;
  const maxOffset = Math.min(12, next.length);
  for (let offset = 0; offset <= maxOffset; offset++) {
    const compareCount = Math.min(10, previous.length, next.length - offset);
    if (compareCount <= 0) continue;
    let matches = true;
    for (let i = 0; i < compareCount; i++) {
      if (next[offset + i] !== previous[i]) { matches = false; break; }
    }
    if (matches) return next.slice(0, offset);
  }
  return [];
};

// Memoized history grid
const HistoryGrid = memo(({ historySlice, selectedNum, setSelectedNum }: {
  historySlice: number[]; selectedNum: number | null; setSelectedNum: (n: number | null) => void;
}) => {
  const rows = useMemo(() => {
    const r: number[][] = [];
    for (let i = 0; i < historySlice.length; i += 20) r.push(historySlice.slice(i, i + 20));
    return r;
  }, [historySlice]);

  return (
    <div className="space-y-1">
      {rows.map((row, ri) => (
        <div key={ri} className="flex gap-1 flex-wrap">
          {row.map((n, i) => (
            <div key={`${ri}-${i}-${n}`}
              onClick={() => setSelectedNum(selectedNum === n ? null : n)}
              style={{ opacity: selectedNum !== null && selectedNum !== n ? 0.2 : 1 }}
              className={`w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold cursor-pointer border transition-all
                ${selectedNum === n ? 'ring-2 ring-primary scale-110 bg-primary text-primary-foreground border-primary' : `${colorClass(n)} border-white/10 hover:scale-105`}`}>
              {n}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
});

const Index = () => {
  const [selectedTable, setSelectedTable] = useState(ROULETTE_TABLES[0]);
  const [apiNumbers, setApiNumbers] = useState<number[]>([]);
  const [storedNumbers, setStoredNumbers] = useState<number[]>([]);
  const [isPolling, setIsPolling] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const prevNumbersRef = useRef<string>('');
  const [sniperData, setSniperData] = useState<any>(null);
  const [rtInsights, setRtInsights] = useState<any[]>([]);
  const [sniperCountdown, setSniperCountdown] = useState(SIGNAL_WINDOW_SECONDS);
  const sniperPrevKey = useRef<string>('');
  const sniperSameCount = useRef(0);
  const [sniperStale, setSniperStale] = useState(false);
  const [lastPredResult, setLastPredResult] = useState<{ hit: boolean | null; hitType: string | null; predicted: number | null; actual: number | null; label: string } | null>(null);
  const [autoLearnStatus, setAutoLearnStatus] = useState<'idle' | 'learning' | 'analyzing' | 'backtesting'>('idle');
  const [showCasino, setShowCasino] = useState(false);
  const [predStats, setPredStats] = useState({ hits: 0, misses: 0, exact: 0, total: 0 });
  const [historyLimit, setHistoryLimit] = useState(100);
  const [selectedNum, setSelectedNum] = useState<number | null>(null);
  const [dnaNumber, setDnaNumber] = useState<number | null>(null);
  const [dnaOpen, setDnaOpen] = useState(false);
  const [confidenceFilter, setConfidenceFilter] = useState(true);
  const [sampleSize] = useState(100);
  const [showPredHistory, setShowPredHistory] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [strategyFilter, setStrategyFilter] = useState<string>('all');
  const [soundEnabled] = useState(true);
  const [activePatternCount, setActivePatternCount] = useState(0);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'sinal' | 'mesa' | 'padroes' | 'ia'>('sinal');
  const [lastSpinAt, setLastSpinAt] = useState<number | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  const FRESHNESS_MAX_MS = 8000;

  const handleManualNumbers = (nums: number[]) => {
    apiSnapshotRef.current = [...nums, ...apiSnapshotRef.current].slice(0, 1000);
    setApiNumbers(prev => [...nums, ...prev].slice(0, 1000));
  };

  // Pattern count polling
  useEffect(() => {
    const load = async () => {
      const { count } = await supabase.from('pattern_insights').select('*', { count: 'exact', head: true }).gt('confidence', 45);
      setActivePatternCount(count || 0);
    };
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  const sniperFetchingRef = useRef(false);
  const lastSniperTriggerRef = useRef(0);
  const lastSpinSignatureRef = useRef('');
  const apiSnapshotRef = useRef<number[]>([]);
  const fetchSniperRef = useRef<((retryCount?: number, force?: boolean) => void) | null>(null);
  const lastAcceptedSpinRef = useRef<{ number: number | null; timestamp: number }>({ number: null, timestamp: 0 });
  const processedPredictionEventsRef = useRef<Record<string, number>>({});
  const spinCountSinceMicroLearnRef = useRef(0);

  const isBurstDuplicate = useCallback((number: number) => {
    const { number: lastNumber, timestamp } = lastAcceptedSpinRef.current;
    return lastNumber === number && Date.now() - timestamp < DUPLICATE_SPIN_WINDOW_MS;
  }, []);

  const markAcceptedSpin = useCallback((number: number) => {
    lastAcceptedSpinRef.current = { number, timestamp: Date.now() };
  }, []);

  const shouldProcessPredictionEvent = useCallback((row: { id: string; hit: boolean | null; hit_type: string | null; actual_number: number | null }) => {
    const now = Date.now();
    Object.keys(processedPredictionEventsRef.current).forEach(key => {
      if (now - processedPredictionEventsRef.current[key] > 15000) delete processedPredictionEventsRef.current[key];
    });
    const eventKey = `${row.id}-${row.hit}-${row.hit_type}-${row.actual_number}`;
    if (processedPredictionEventsRef.current[eventKey]) return false;
    processedPredictionEventsRef.current[eventKey] = now;
    return true;
  }, []);

  const handleNewSpin = useCallback((signature: string, spinAt = Date.now()) => {
    if (!signature || signature === lastSpinSignatureRef.current) return;
    lastSpinSignatureRef.current = signature;
    sniperSameCount.current = 0;
    setSniperStale(false);
    setLastSpinAt(spinAt);
    setSniperCountdown(SIGNAL_WINDOW_SECONDS);
    playSound('signal', soundEnabled);
    if (aiEnabled) {
      // Force fetch immediately — bypass any in-flight lock
      sniperFetchingRef.current = false;
      lastSniperTriggerRef.current = 0;
      fetchSniperRef.current?.(0, true);
      supabase.functions.invoke('realtime-patterns')
        .then(res => { if (res.data?.all_insights?.length > 0) setRtInsights(res.data.all_insights.slice(0, 6)); })
        .catch(() => {});
    }
  }, [soundEnabled, aiEnabled]);

  const triggerMicroLearn = useCallback(async () => {
    if (!aiEnabled) return;
    try { await Promise.allSettled([supabase.functions.invoke('auto-analyze-patterns'), supabase.functions.invoke('realtime-patterns')]); } catch { /* */ }
  }, [aiEnabled]);

  const fetchSniper = useCallback(async (retryCount = 0, force = false) => {
    const now = Date.now();
    if (!force && now - lastSniperTriggerRef.current < 5000 && retryCount === 0) return;
    if (sniperFetchingRef.current && !force) return;
    if (!aiEnabled) return;
    sniperFetchingRef.current = true;
    lastSniperTriggerRef.current = now;
    try {
      const latestNumbers = apiSnapshotRef.current.length > 0 ? apiSnapshotRef.current : apiNumbers;
      const clientNums = latestNumbers.length > 0 ? latestNumbers.slice(0, sampleSize) : undefined;
      const res = await supabase.functions.invoke('sniper-predict', {
        body: { sampleSize, numbers: clientNums, strategyFilter: strategyFilter !== 'all' ? strategyFilter : undefined }
      });
      if (res.error) {
        if (retryCount < 2) { sniperFetchingRef.current = false; setTimeout(() => fetchSniper(retryCount + 1, force), 2000 * (retryCount + 1)); return; }
        // After all retries failed, set fallback so UI doesn't stay stuck on "Carregando IA..."
        setSniperData((prev: any) => prev ?? { signal: null, mode: 'error', message: '⚠️ Erro ao conectar — tentando novamente...', strategy: null });
      }
      if (res.data) {
        const key = `${res.data.strategy?.type}-${res.data.signal?.number}-${res.data.mode}`;
        if (key !== sniperPrevKey.current) { sniperPrevKey.current = key; sniperSameCount.current = 0; setSniperStale(false); }
        else { sniperSameCount.current++; if (sniperSameCount.current >= 6) setSniperStale(true); }
        setSniperData(res.data);
      }
    } catch (err) {
      if (retryCount < 2) { sniperFetchingRef.current = false; setTimeout(() => fetchSniper(retryCount + 1, force), 2000 * (retryCount + 1)); return; }
      // After all retries failed via exception, set fallback
      setSniperData((prev: any) => prev ?? { signal: null, mode: 'error', message: '⚠️ Falha na conexão — tentando novamente...', strategy: null });
    } finally { sniperFetchingRef.current = false; }
  }, [sampleSize, aiEnabled, apiNumbers, strategyFilter]);
  fetchSniperRef.current = fetchSniper;

  const registerLiveSpin = useCallback((number: number, spinAt = Date.now(), source = 'live') => {
    if (typeof number !== 'number' || number < 0 || number > 36) return false;
    if (isBurstDuplicate(number)) return false;

    markAcceptedSpin(number);
    apiSnapshotRef.current = [number, ...apiSnapshotRef.current].slice(0, 1000);
    setApiNumbers(prev => [number, ...prev].slice(0, 1000));
    handleNewSpin(`${source}-${number}-${spinAt}`, spinAt);
    setLastUpdate(new Date(spinAt));

    spinCountSinceMicroLearnRef.current++;
    if (spinCountSinceMicroLearnRef.current >= 10) {
      spinCountSinceMicroLearnRef.current = 0;
      triggerMicroLearn();
    }

    return true;
  }, [handleNewSpin, isBurstDuplicate, markAcceptedSpin, triggerMicroLearn]);

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
            handleNewSpin(nums.slice(0, 3).join(','), Date.now());
            // Force immediate sniper prediction for the next round
            sniperFetchingRef.current = false;
            lastSniperTriggerRef.current = 0;
            fetchSniperRef.current?.(0, true);
          }
          prevNumbersRef.current = key;
        }
        setError(null);
      }
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Erro'); }
  }, [handleNewSpin, isBurstDuplicate, markAcceptedSpin]);

  const fetchStored = useCallback(async () => {
    const { data } = await supabase.from('roulette_numbers').select('number').order('fetched_at', { ascending: false }).limit(1000);
    if (data) setStoredNumbers(data.map((r: any) => r.number));
  }, []);

  // Polling
  useEffect(() => {
    fetchNumbers(); fetchStored(); fetchSniper();
    if (!isPolling) return;
    const interval = setInterval(() => { fetchNumbers(); fetchStored(); }, POLL_INTERVAL_MS);
    // Safety: if sniperData is still null after 12s, force a retry
    const safetyTimeout = setTimeout(() => {
      setSniperData((prev: any) => {
        if (prev === null) {
          fetchSniperRef.current?.(0, true);
          return { signal: null, mode: 'loading', message: '🔄 Reconectando IA...', strategy: null };
        }
        return prev;
      });
    }, 12000);
    return () => { clearInterval(interval); clearTimeout(safetyTimeout); };
  }, [fetchNumbers, fetchStored, fetchSniper, isPolling]);

  // Realtime trigger — roulette_numbers
  useEffect(() => {
    const ch = supabase.channel('sniper_trigger_rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'roulette_numbers' }, (payload: any) => {
        const row = payload?.new;
        if (typeof row?.number === 'number') {
          const spinAt = row.fetched_at ? new Date(row.fetched_at).getTime() : Date.now();
          const age = Date.now() - spinAt;
          if (age > FRESHNESS_MAX_MS) return; // Sinal atrasado — ignorar
          registerLiveSpin(row.number, spinAt, `rt-${row.id ?? row.fetched_at ?? ''}`);
        }
      }).subscribe((status) => {
        if (status === 'SUBSCRIBED') setRealtimeStatus('connected');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setRealtimeStatus('disconnected');
        else setRealtimeStatus('connecting');
      });
    return () => { supabase.removeChannel(ch); };
  }, [registerLiveSpin]);

  // Realtime trigger — resultados_roleta (zero delay)
  useEffect(() => {
    const ch = supabase.channel('resultados_rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'resultados_roleta' }, (payload: any) => {
        const row = payload?.new;
        if (row?.numero !== undefined) {
          const num = Number(row.numero);
          if (!isNaN(num) && num >= 0 && num <= 36) {
            const insertedAt = row.created_at ? new Date(row.created_at).getTime() : Date.now();
            const age = Date.now() - insertedAt;
            if (age > FRESHNESS_MAX_MS) return; // Sinal atrasado — ignorar
            registerLiveSpin(num, insertedAt, `rt-res-${row.id ?? ''}`);
          }
        }
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [registerLiveSpin]);

  // Extension message listener
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'NUMBER_FROM_EXTENSION') {
        const n = event.data.number;
        if (typeof n === 'number' && n >= 0 && n <= 36) {
          registerLiveSpin(n, Date.now(), 'extension');
        }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [registerLiveSpin]);

  // Countdown
  useEffect(() => {
    if (!lastSpinAt) {
      setSniperCountdown(SIGNAL_WINDOW_SECONDS);
      return;
    }

    const updateCountdown = () => {
      const elapsedSeconds = Math.floor((Date.now() - lastSpinAt) / 1000);
      setSniperCountdown(Math.max(0, SIGNAL_WINDOW_SECONDS - elapsedSeconds));
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [lastSpinAt]);

  // Pred stats
  const loadPredStats = useCallback(async () => {
    const { data } = await supabase.from('prediction_history').select('hit, hit_type').not('hit', 'is', null).limit(500);
    if (data) {
      const hits = data.filter((r: any) => r.hit === true).length;
      const exact = data.filter((r: any) => r.hit_type === 'exact').length;
      setPredStats({ hits, misses: data.length - hits, exact, total: data.length });
    }
  }, []);
  useEffect(() => { loadPredStats(); }, [loadPredStats]);

  // Auto learn loop
  const cycleRef = useRef(0);
  const autoLearnErrorCount = useRef(0);
  const autoLearnDisabled = useRef(false);
  const consecutiveSuccessRef = useRef(0);
  const currentIntervalRef = useRef(60_000);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const run = async () => {
      if (!aiEnabled || autoLearnDisabled.current) { setAutoLearnStatus('idle'); schedule(); return; }
      const cycle = cycleRef.current++;
      try {
        supabase.functions.invoke('realtime-patterns').catch(() => {});
        const phase = cycle % 9;
        if (phase === 0 || phase === 4) {
          setAutoLearnStatus('learning');
          await supabase.functions.invoke('ai-learn');
        } else if (phase === 1 || phase === 5) {
          setAutoLearnStatus('analyzing');
          await supabase.functions.invoke('auto-analyze-patterns');
        } else if (phase === 3 || phase === 7) {
          setAutoLearnStatus('analyzing');
          await Promise.allSettled([supabase.functions.invoke('realtime-patterns'), phase === 7 ? supabase.functions.invoke('calibrate-constants') : Promise.resolve()]);
        } else if (phase === 8) {
          setAutoLearnStatus('analyzing');
          await supabase.functions.invoke('markov-engine');
        } else {
          setAutoLearnStatus('backtesting');
          await supabase.functions.invoke('sniper-predict', { body: { sampleSize: phase === 2 || phase === 6 ? 200 : 50 } });
        }
        autoLearnErrorCount.current = 0;
        consecutiveSuccessRef.current++;
        if (consecutiveSuccessRef.current >= 3) currentIntervalRef.current = Math.max(30_000, currentIntervalRef.current * 0.8);
      } catch (err: any) {
        autoLearnErrorCount.current++;
        consecutiveSuccessRef.current = 0;
        const msg = err?.message || String(err);
        if (/402|429|[Cc]redit|[Rr]ate/i.test(msg)) {
          currentIntervalRef.current = Math.min(600_000, currentIntervalRef.current * 3);
          if (autoLearnErrorCount.current >= 5) autoLearnDisabled.current = true;
        } else { currentIntervalRef.current = Math.min(300_000, currentIntervalRef.current * 1.5); }
      } finally { setAutoLearnStatus('idle'); schedule(); }
    };
    const schedule = () => { if (!autoLearnDisabled.current) timeoutId = setTimeout(run, currentIntervalRef.current); };
    timeoutId = setTimeout(run, 15_000);
    return () => { if (timeoutId) clearTimeout(timeoutId); };
  }, [aiEnabled]);

  // Realtime prediction results
  useEffect(() => {
    const ch = supabase.channel('prediction_result_rt').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'prediction_history' }, (payload: any) => {
      const row = payload.new;
      if (row && row.hit !== null && row.actual_number !== null) {
        if (!shouldProcessPredictionEvent(row)) return;
        const isHit = row.hit === true;
        setLastPredResult({ hit: isHit, hitType: row.hit_type, predicted: row.predicted_main, actual: row.actual_number, label: row.strategy_label || '' });
        setPredStats(prev => ({ hits: prev.hits + (isHit ? 1 : 0), misses: prev.misses + (isHit ? 0 : 1), exact: prev.exact + (row.hit_type === 'exact' ? 1 : 0), total: prev.total + 1 }));
        playSound(isHit ? 'hit' : 'miss', soundEnabled);
        setTimeout(() => loadPredStats(), 2000);
      }
    }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadPredStats, shouldProcessPredictionEvent, soundEnabled]);

  useEffect(() => { const i = setInterval(() => loadPredStats(), 30000); return () => clearInterval(i); }, [loadPredStats]);

  const triggerLearn = async () => {
    setIsAnalyzing(true);
    try {
      setAutoLearnStatus('learning');
      const r1 = await supabase.functions.invoke('ai-learn');
      if (!r1.error) { setAutoLearnStatus('analyzing'); await supabase.functions.invoke('auto-analyze-patterns'); }
      setAutoLearnStatus('backtesting');
      await supabase.functions.invoke('sniper-predict');
    } catch { /* */ }
    finally { setIsAnalyzing(false); setAutoLearnStatus('idle'); }
  };

  // Computed
  const allNumbers = useMemo(() => apiNumbers.length > 0 ? apiNumbers : storedNumbers, [apiNumbers, storedNumbers]);
  const historySlice = useMemo(() => allNumbers.slice(0, historyLimit), [allNumbers, historyLimit]);

  const toggleSection = (name: string) => setActiveSection(prev => prev === name ? null : name);

  const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
  const PULL: Record<number,number[]> = {0:[10,20,30,32,15,26,3,33,31,35],1:[11,35,16,4,18,28,27,29,33,14,31],2:[14,1,13,18,35,29,12,22],3:[13,27,6,11,30,8,23,33],4:[26,15,18,32,33,16,8,24,14],5:[3,33,16,24,10,18,15,25],6:[8,15,31,21,22,23,16,26],7:[16,18,17,30,31,28,12],8:[11,9,10,18,28,23],9:[34,35,36,3,16,26,23,24,32,31,29],10:[20,5,18,11,14,24,30],11:[8,18,16,21,30,1],12:[21,7,28,35],13:[31,27,36,6],14:[24,21,18,31,9],15:[4,19,21,32,0],16:[24,21,18,14,6,26],17:[34,6,25,27,7],18:[8,18,28,7],19:[9,19,29,4,21],20:[4,14,10,30],21:[19,2,4,23],22:[33,2,32,12],23:[32,11,2,33,13],24:[21,18,14,34,4],25:[2,4,17,28,29,12,7,18],26:[6,16,26,36,3,0],27:[28,29,24,22,26,33,31,34,35,36],28:[13,14,15,16,17,18,7],29:[35,28,22],30:[4,8,16,9,18,22,5,25,3],31:[13,9,14],32:[2,12,22,32,0,15],33:[16,3,23,13],34:[16,6,4,24],35:[0,3,7,12,26,28,29,35],36:[3,10,27,6]};

  // Streak ativo
  let streakNum = allNumbers[0] ?? -1, streakLen = 1;
  for (let i = 1; i < allNumbers.length; i++) {
    if (allNumbers[i] === streakNum) streakLen++;
    else break;
  }
  const streakActive = streakLen >= 2;

  // Terminal dominante (últimos 20)
  const termFreq20: Record<number,number> = {};
  allNumbers.slice(0,20).forEach(n => { termFreq20[n%10] = (termFreq20[n%10]||0)+1; });
  const hotTerm = Object.entries(termFreq20).sort(([,a],[,b])=>b-a)[0];

  // Zero pressão
  const zeroIdx = allNumbers.indexOf(0);
  const zeroPressure = zeroIdx < 0 ? allNumbers.length : zeroIdx;

  // WR recente
  const recentWR = typeof sniperData?.recentWinRate === 'number'
    ? Math.round(sniperData.recentWinRate * 100) : null;

  const numBg = (n: number) => n === 0 ? 'bg-emerald-600' : RED.has(n) ? 'bg-red-600' : 'bg-zinc-700';

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* ═══ HEADER FIXO ══════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-50 bg-background/98 backdrop-blur border-b border-border/60 shadow-sm">
        <div className="max-w-2xl mx-auto px-3">

          {/* Linha 1: Marca + Status + Toggle */}
          <div className="flex items-center gap-2 py-2.5">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
                <span className="font-display font-black text-sm text-primary">S</span>
              </div>
              <div className="min-w-0">
                <div className="font-display font-black text-[11px] tracking-widest text-primary leading-none">SPIN SMART BOT</div>
                <div className="text-[7px] text-muted-foreground font-mono leading-none mt-0.5">IA ROLETA BRASILEIRA PLAYTECH</div>
              </div>
            </div>

            {/* Status da IA */}
            <div className="flex items-center gap-1.5 shrink-0">
              {autoLearnStatus !== 'idle' && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 border border-primary/20">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  <span className="text-[8px] font-bold text-primary capitalize">{autoLearnStatus === 'learning' ? 'aprendendo' : autoLearnStatus === 'analyzing' ? 'analisando' : 'processando'}</span>
                </div>
              )}
              {sniperCountdown > 0 && autoLearnStatus === 'idle' && (
                <span className="text-[8px] font-mono text-muted-foreground">{sniperCountdown}s</span>
              )}
              <button
                onClick={() => setAiEnabled(v => !v)}
                className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black tracking-wide border transition-all ${
                  aiEnabled
                    ? 'bg-primary/15 text-primary border-primary/30 hover:bg-primary/25'
                    : 'bg-destructive/10 text-destructive border-destructive/30'
                }`}
              >
                {aiEnabled ? '⚡ ON' : '○ OFF'}
              </button>
            </div>
          </div>

          {/* Linha 2: Últimos números + streak */}
          {allNumbers.length > 0 && (
            <div className="flex items-center gap-1.5 pb-2">
              <span className="text-[7px] text-muted-foreground font-mono shrink-0">ÚLTIMOS:</span>
              {allNumbers.slice(0, 7).map((n, i) => (
                <button
                  key={`${n}-${i}`}
                  onClick={() => { setDnaNumber(n); setDnaOpen(true); }}
                  className={`w-7 h-7 rounded-md text-[10px] font-black text-white flex items-center justify-center transition-all hover:scale-110 shrink-0 ${numBg(n)} ${
                    i === 0 ? 'ring-2 ring-primary ring-offset-1 ring-offset-background w-8 h-8 text-[11px]' : ''
                  }`}
                >
                  {n}
                </button>
              ))}
              {streakActive && (
                <div className={`ml-1 flex items-center gap-1 px-2 py-0.5 rounded-full border text-[8px] font-black ${
                  streakLen >= 4
                    ? 'bg-amber-500/20 border-amber-400/50 text-amber-400 animate-pulse'
                    : 'bg-primary/10 border-primary/30 text-primary'
                }`}>
                  🔱 {streakNum} ×{streakLen}
                </div>
              )}
              {recentWR !== null && (
                <div className={`ml-auto shrink-0 px-2 py-0.5 rounded-full text-[8px] font-black ${
                  recentWR >= 50 ? 'bg-green-500/15 text-green-400' :
                  recentWR >= 35 ? 'bg-amber-500/15 text-amber-400' :
                  'bg-red-500/15 text-red-400'
                }`}>WR {recentWR}%</div>
              )}
            </div>
          )}

          {/* Linha 3: Tabs de navegação */}
          <div className="flex border-t border-border/30">
            {[
              { id: 'sinal' as const, label: '🎯 SINAL', badge: sniperData?.signal?.probability ? `${sniperData.signal.probability}%` : undefined },
              { id: 'mesa' as const, label: '📊 MESA', badge: allNumbers.length > 0 ? `${Math.min(allNumbers.length, 500)}` : undefined },
              { id: 'padroes' as const, label: '🔍 ANÁLISE' },
              { id: 'ia' as const, label: '🧠 IA' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex-1 py-2 text-[8px] font-black tracking-wide transition-all relative ${
                  activeTab === t.id
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.label}
                {t.badge && (
                  <span className={`ml-1 text-[6px] font-mono px-1 py-0.5 rounded ${activeTab === t.id ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                    {t.badge}
                  </span>
                )}
                {activeTab === t.id && (
                  <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-primary rounded-t" />
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ═══ CONTEÚDO PRINCIPAL ═══════════════════════════════════════════════ */}
      <main className="max-w-2xl mx-auto px-3 py-4">

        {/* ── ABA: SINAL ─────────────────────────────────────────────────── */}
        {activeTab === 'sinal' && (
          <div className="space-y-3">

            {/* Input manual */}
            <ManualInput onAddNumbers={handleManualNumbers} />

            {/* Status de conexão */}
            {realtimeStatus === 'disconnected' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="px-4 py-2.5 rounded-xl bg-destructive/10 border border-destructive/30 flex items-center gap-2"
              >
                <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                <span className="text-[10px] font-bold text-destructive">🔌 Reconectando ao servidor...</span>
              </motion.div>
            )}
            {realtimeStatus === 'connecting' && (
              <div className="px-4 py-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                <span className="text-[10px] font-bold text-yellow-400">Conectando ao Realtime...</span>
              </div>
            )}

            {/* Erro */}
            {error && (
              <div className="px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/30 text-[10px] text-destructive font-semibold">
                ⚠️ {error}
              </div>
            )}

            {/* SNIPER SIGNAL — painel principal */}
            {aiEnabled ? (
              <>
              {allNumbers.length > 0 && (
                <motion.div
                  key={allNumbers[0]}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary/10 to-transparent border border-primary/25"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black text-primary uppercase tracking-wider">Saiu:</span>
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                      className={`w-10 h-10 rounded-xl text-base font-black text-white flex items-center justify-center shadow-lg ${numBg(allNumbers[0])} ring-2 ring-primary/50`}
                    >
                      {allNumbers[0]}
                    </motion.div>
                  </div>
                  <div className="flex-1">
                    {sniperCountdown > 0 ? (
                      <>
                        <span className="text-[10px] text-foreground font-bold">→ Jogada para o <span className="text-primary">próximo giro</span></span>
                        {lastSpinAt && (
                          <div className="text-[8px] text-muted-foreground mt-0.5">
                            Detectado há {Math.max(0, Math.round((Date.now() - lastSpinAt) / 1000))}s
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="text-[10px] text-muted-foreground font-bold">⏳ Aguardando próxima rodada...</span>
                    )}
                  </div>
                  <div className="shrink-0">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" title="Sinal ativo" />
                  </div>
                </motion.div>
              )}
              <div className={`transition-all duration-500 rounded-2xl ${
                sniperCountdown > 0 && sniperData?.signal ? 'shadow-[0_0_25px_hsl(142,70%,45%,0.15)] ring-1 ring-green-500/20' : ''
              }`}>
                <SniperSignal
                  sniperData={sniperData}
                  sniperCountdown={sniperCountdown}
                  sniperStale={sniperStale}
                  lastPredResult={lastPredResult}
                  confidenceFilter={confidenceFilter}
                  rtInsights={rtInsights}
                  allNumbers={allNumbers}
                  autoLearnStatus={autoLearnStatus}
                  strategyFilter={strategyFilter}
                  setStrategyFilter={setStrategyFilter}
                />
              </div>
              {/* ── ENGINE ANALYSIS (Streaks, Cold Zones) ────── */}
              <EngineSignalCard allNumbers={allNumbers} />
              </>
            ) : (
              <div className="bg-card rounded-2xl border border-border p-12 text-center">
                <div className="text-5xl mb-4 opacity-30">○</div>
                <p className="text-sm font-bold text-muted-foreground">IA DESLIGADA</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Clique "⚡ ON" para ativar</p>
              </div>
            )}

            {/* ── ÚLTIMO GIRO ──────────────────────────────── */}
            <AnimatePresence mode="wait">
              {lastPredResult && lastPredResult.hit !== null && (
                <motion.div
                  key={lastPredResult.actual}
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 ${
                    lastPredResult.hit ? 'border-green-500/30 bg-green-500/5' : 'border-border/60 bg-card/80'
                  }`}
                >
                  <span className="text-2xl shrink-0">{lastPredResult.hit ? '✅' : '❌'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">Último giro</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      Saiu <b className="text-foreground">{lastPredResult.actual}</b>
                      {' · '}Sua jogada anterior {lastPredResult.hit ? <span className="text-green-400 font-bold">bateu</span> : <span className="text-destructive font-bold">não bateu</span>}
                    </div>
                  </div>
                  <motion.div
                    initial={{ scale: 0, rotate: -90 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 250 }}
                    className={`w-12 h-12 rounded-xl text-base font-black text-white flex items-center justify-center shadow-lg ${numBg(lastPredResult.actual ?? 0)}`}
                  >
                    {lastPredResult.actual}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── CARDS DE CONTEXTO ──────────────────────────── */}
            {allNumbers.length >= 5 && (
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-card rounded-xl border border-border/50 p-3 text-center space-y-1">
                  <div className="text-[8px] text-muted-foreground uppercase font-bold tracking-wider">Puxados</div>
                  <div className="text-[12px] font-black text-primary font-mono leading-tight">
                    {(PULL[allNumbers[0]] || []).slice(0,3).join(' ')}
                  </div>
                  <div className="text-[8px] text-muted-foreground">do {allNumbers[0]}</div>
                </div>
                <div className="bg-card rounded-xl border border-border/50 p-3 text-center space-y-1">
                  <div className="text-[8px] text-muted-foreground uppercase font-bold tracking-wider">Terminal</div>
                  <div className="text-[12px] font-black text-amber-400 font-mono">T{hotTerm?.[0]}</div>
                  <div className="text-[8px] text-muted-foreground">{hotTerm?.[1]}× em 20</div>
                </div>
                <div className="bg-card rounded-xl border border-border/50 p-3 text-center space-y-1">
                  <div className="text-[8px] text-muted-foreground uppercase font-bold tracking-wider">Zero</div>
                  <div className={`text-[12px] font-black font-mono ${zeroPressure > 40 ? 'text-green-400' : zeroPressure > 25 ? 'text-amber-400' : 'text-muted-foreground'}`}>
                    {zeroPressure}g
                  </div>
                  <div className="text-[8px] text-muted-foreground">{zeroPressure > 40 ? '⚡ pressão' : zeroPressure > 25 ? 'atenção' : 'ok'}</div>
                </div>
                <div className="bg-card rounded-xl border border-border/50 p-3 text-center space-y-1">
                  <div className="text-[8px] text-muted-foreground uppercase font-bold tracking-wider">Hits</div>
                  <div className="text-[12px] font-black text-foreground font-mono">
                    {predStats.hits}/{predStats.total || 1}
                  </div>
                  <div className="text-[8px] text-muted-foreground">
                    {predStats.total > 0 ? `${Math.round(predStats.hits/predStats.total*100)}%` : '—'}
                  </div>
                </div>
              </div>
            )}

            {/* Botão de forçar análise */}
            <button
              onClick={triggerLearn}
              disabled={isAnalyzing}
              className="w-full py-2 rounded-xl border border-border bg-secondary/40 text-[9px] font-bold text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-all disabled:opacity-40"
            >
              {isAnalyzing ? '🔄 Analisando...' : '⚡ Forçar análise da IA agora'}
            </button>
          </div>
        )}

        {/* ── ABA: MESA ──────────────────────────────────────────────────── */}
        {activeTab === 'mesa' && (
          <div className="space-y-4">

            {/* Terminal Bias */}
            <div className="bg-card rounded-xl border border-border p-4">
              <h3 className="text-[9px] font-black text-muted-foreground uppercase tracking-wider mb-3">
                Terminal Bias (últimos 200)
              </h3>
              <div className="flex items-end gap-1.5" style={{ height: 80 }}>
                {Array.from({ length: 10 }, (_, t) => {
                  const cnt = allNumbers.slice(0,200).filter(n => n%10===t).length;
                  const exp = allNumbers.slice(0,200).length / 10;
                  const bias = exp > 0 ? ((cnt-exp)/exp*100) : 0;
                  const maxCnt = Math.max(...Array.from({length:10},(_,i)=>allNumbers.slice(0,200).filter(n=>n%10===i).length),1);
                  const pct = cnt/maxCnt*100;
                  return (
                    <div key={t} className="flex-1 flex flex-col items-center gap-0.5">
                      {Math.abs(bias) > 20 && (
                        <div className={`text-[6px] font-mono font-bold ${bias>0?'text-amber-400':'text-blue-400'}`}>
                          {bias>0?'+':''}{bias.toFixed(0)}%
                        </div>
                      )}
                      <div className="w-full flex items-end" style={{ flex: 1 }}>
                        <div
                          className={`w-full rounded-t transition-all ${
                            bias > 50 ? 'bg-amber-500' : bias > 20 ? 'bg-primary/70' : bias < -30 ? 'bg-blue-500/40' : 'bg-muted-foreground/30'
                          }`}
                          style={{ height: `${Math.max(4, pct)}%`, minHeight: 4 }}
                        />
                      </div>
                      <div className="text-[7px] font-mono font-bold text-foreground">T{t}</div>
                      <div className="text-[6px] text-muted-foreground">{cnt}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Frequência numérica — grid 37 números */}
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-[9px] font-black text-muted-foreground uppercase tracking-wider">Frequência (500 giros)</h3>
                <div className="flex items-center gap-2 ml-auto text-[7px] text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block"/>quente</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block"/>frio</span>
                </div>
              </div>
              <div className="grid grid-cols-9 gap-1">
                {Array.from({ length: 37 }, (_, n) => {
                  const cnt = allNumbers.filter(x => x === n).length;
                  const exp = allNumbers.length / 37;
                  const hot = cnt > exp * 1.5;
                  const cold = cnt < exp * 0.5;
                  const op = allNumbers.length > 0 ? Math.max(0.2, Math.min(1, cnt / (exp * 2))) : 0.5;
                  return (
                    <button
                      key={n}
                      onClick={() => { setDnaNumber(n); setDnaOpen(true); }}
                      title={`${n}: ${cnt}×`}
                      className={`h-8 rounded-md text-[9px] font-black text-white transition-all hover:scale-110 relative ${numBg(n)} ${
                        hot ? 'ring-1 ring-amber-400' : cold ? 'ring-1 ring-blue-400/60' : ''
                      }`}
                      style={{ opacity: op }}
                    >
                      {n}
                      {(hot || cnt === 0) && (
                        <div className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${hot ? 'bg-amber-400' : 'bg-blue-400'}`} />
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 text-[7px] text-muted-foreground text-center">Toque em qualquer número para análise completa (DNA)</div>
            </div>

            {/* Histórico sequencial */}
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-[9px] font-black text-muted-foreground uppercase tracking-wider">Histórico</h3>
                <div className="flex gap-1 ml-auto">
                  {[50, 100, 200, 500].map(lim => (
                    <button key={lim}
                      onClick={() => startTransition(() => { setHistoryLimit(lim); setSelectedNum(null); })}
                      className={`px-2 py-0.5 rounded text-[7px] font-bold transition-all ${
                        historyLimit === lim ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'
                      }`}>
                      {lim}
                    </button>
                  ))}
                </div>
              </div>

              {selectedNum !== null && (
                <div className="mb-2 flex items-center gap-2 px-2 py-1.5 rounded-lg bg-secondary/40 border border-border/30">
                  <div className={`w-6 h-6 rounded text-[9px] font-black text-white flex items-center justify-center ${numBg(selectedNum)}`}>{selectedNum}</div>
                  <span className="text-[8px] text-muted-foreground">
                    apareceu <b className="text-foreground">{allNumbers.slice(0, historyLimit).filter(n => n === selectedNum).length}×</b> em {historyLimit} giros
                  </span>
                  <button onClick={() => setSelectedNum(null)} className="ml-auto text-[8px] text-muted-foreground hover:text-foreground">✕</button>
                </div>
              )}

              {historySlice.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-xs">Aguardando dados...</div>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {historySlice.map((n, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedNum(selectedNum === n ? null : n)}
                      className={`w-7 h-7 rounded text-[9px] font-bold text-white flex items-center justify-center transition-all ${numBg(n)} ${
                        i === 0 ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : ''
                      } ${selectedNum === n ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-background scale-110 z-10' : ''}
                      ${selectedNum !== null && selectedNum !== n ? 'opacity-25' : ''}`}
                    >{n}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── ABA: ANÁLISE / PADRÕES ─────────────────────────────────────── */}
        {activeTab === 'padroes' && (
          <div className="space-y-3">
            <PatternsTab allNumbers={allNumbers} sniperData={sniperData} streakNum={streakNum} streakLen={streakLen} streakActive={streakActive} zeroPressure={zeroPressure} hotTerm={hotTerm} pull={PULL} />
          </div>
        )}

        {/* ── ABA: IA ─────────────────────────────────────────────────────── */}
        {activeTab === 'ia' && (
          <div className="space-y-3">
            <AIIntelligenceLog />
            <IATab sniperData={sniperData} />
          </div>
        )}

      </main>

      {/* ── TICKER FIXO NO RODAPÉ ──────────────────────── */}
      <NumberTicker numbers={allNumbers} />

      {/* Padding para não esconder conteúdo atrás do ticker */}
      <div className="h-14" />

      <NumberDNADialog number={dnaNumber} allNumbers={allNumbers} open={dnaOpen} onClose={() => setDnaOpen(false)} />
    </div>
  );
};

// ═══ COMPONENTE: PADRÕES ══════════════════════════════════════════════════════
const PatternsTab = memo(({ allNumbers, sniperData, streakNum, streakLen, streakActive, zeroPressure, hotTerm, pull }: {
  allNumbers: number[]; sniperData: any; streakNum: number; streakLen: number;
  streakActive: boolean; zeroPressure: number; hotTerm: [string,number]|undefined;
  pull: Record<number,number[]>;
}) => {
  const RED_N = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
  const VOISINS_N = new Set([22,18,29,7,28,12,35,3,26,0,32,15,19,4,21,2,25]);
  const TIERS_N = new Set([27,13,36,11,30,8,23,10,5,24,16,33]);
  const ORPHELINS_N = new Set([1,20,14,31,9,17,34,6]);
  const getSector = (n: number) => VOISINS_N.has(n) ? 'Voisins' : TIERS_N.has(n) ? 'Tiers' : ORPHELINS_N.has(n) ? 'Orphelins' : 'Zero';

  const patterns = useMemo(() => {
    const result: { emoji: string; title: string; detail: string; conf: number; type: 'hot'|'cold'|'info' }[] = [];
    if (allNumbers.length < 5) return result;

    if (streakActive) {
      const prob = Math.min(95, 50 + streakLen * 12);
      result.push({ emoji: '🔱', title: `STREAK ${streakNum} × ${streakLen} consecutivas`, detail: `${streakNum} repetiu ${streakLen}x seguidas! Probabilidade de repetir: ${prob}%. Apostar no ${streakNum} e vizinhos.`, conf: prob, type: 'hot' });
    }

    if (hotTerm) {
      const [t, c] = hotTerm;
      const exp20 = allNumbers.slice(0,20).length / 10;
      const bias = exp20 > 0 ? ((c - exp20) / exp20 * 100) : 0;
      if (Math.abs(bias) > 30) result.push({ emoji: bias > 0 ? '🔥' : '❄️', title: `Terminal T${t} ${bias > 0 ? 'dominante' : 'frio'}`, detail: `T${t} apareceu ${c}× em 20 giros (${bias > 0 ? '+' : ''}${bias.toFixed(0)}% vs esperado). ${bias > 0 ? `Números: ${(allNumbers.slice(0,50).filter(n=>n%10===Number(t)).slice(0,5)).join(', ')}` : 'Pode reverter em breve.'}`, conf: Math.abs(bias) > 60 ? 85 : 65, type: bias > 0 ? 'hot' : 'cold' });
    }

    if (zeroPressure >= 25) {
      result.push({ emoji: '🟢', title: `Pressão Zero — ${zeroPressure} giros`, detail: `Zero ausente há ${zeroPressure} giros. Média: 37. ${zeroPressure > 50 ? 'CRÍTICO — zona de apostas elevada!' : zeroPressure > 35 ? 'Atenção — acima da média.' : 'Ligeiramente acima da média.'} Apostar Jeu Zéro.`, conf: Math.min(88, 40 + zeroPressure), type: 'info' });
    }

    if (allNumbers.length > 0) {
      const puxados = pull[allNumbers[0]] || [];
      if (puxados.length > 0) {
        result.push({ emoji: '🧲', title: `Puxados do ${allNumbers[0]}`, detail: `Após o ${allNumbers[0]} sair, os mais frequentes são: [${puxados.slice(0,6).join(', ')}]. Esta mesa tem taxas de pull confirmadas acima de 70%.`, conf: 68, type: 'info' });
      }
    }

    // Setor dominante
    const sectorCnt: Record<string,number> = { Voisins: 0, Tiers: 0, Orphelins: 0, Zero: 0 };
    allNumbers.slice(0,15).forEach(n => { sectorCnt[getSector(n)]++; });
    const topSector = Object.entries(sectorCnt).sort(([,a],[,b])=>b-a)[0];
    if (topSector && topSector[1] >= 5) {
      result.push({ emoji: '🌍', title: `Setor ${topSector[0]} dominante`, detail: `${topSector[0]} concentrou ${topSector[1]} de 15 giros recentes. Momentum ativo.`, conf: 60, type: 'info' });
    }

    // Padrões do sniper
    const detected = sniperData?.detectedPatterns || [];
    detected.slice(0, 5).forEach((p: any) => {
      if (result.length >= 8) return;
      result.push({ emoji: p.emoji || '📊', title: p.name, detail: p.description + (p.action ? ` Ação: ${p.action}` : ''), conf: p.confidence, type: p.confidence >= 80 ? 'hot' : 'info' });
    });

    // Breakouts
    const breakouts = sniperData?.advancedAnalysis?.breakouts || [];
    breakouts.forEach((b: any) => {
      if (!b.active || result.length >= 10) return;
      result.push({ emoji: '🔀', title: 'Breakout detectado', detail: b.description, conf: b.confidence, type: 'info' });
    });

    return result.slice(0, 10);
  }, [allNumbers.slice(0,20).join(','), sniperData?.detectedPatterns?.length, streakActive, zeroPressure]);

  if (patterns.length === 0) return (
    <div className="bg-card rounded-xl border border-border p-8 text-center">
      <div className="text-3xl mb-3 opacity-40">🔍</div>
      <p className="text-sm text-muted-foreground">Aguardando dados para análise de padrões...</p>
      <p className="text-xs text-muted-foreground/50 mt-1">Mínimo 5 giros necessários</p>
    </div>
  );

  return (
    <>
      {patterns.map((p, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.04 }}
          className={`flex items-start gap-3 p-3.5 rounded-xl border ${
            p.type === 'hot' ? 'bg-amber-500/8 border-amber-500/25' :
            p.type === 'cold' ? 'bg-blue-500/8 border-blue-500/25' :
            'bg-card border-border'
          }`}
        >
          <span className="text-xl shrink-0 mt-0.5">{p.emoji}</span>
          <div className="flex-1 min-w-0">
            <div className={`text-[10px] font-black leading-snug ${
              p.type === 'hot' ? 'text-amber-400' : p.type === 'cold' ? 'text-blue-400' : 'text-foreground'
            }`}>{p.title}</div>
            <p className="text-[8px] text-muted-foreground mt-1 leading-relaxed">{p.detail}</p>
          </div>
          <div className={`shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded-full ${
            p.conf >= 80 ? 'bg-green-500/20 text-green-400' :
            p.conf >= 60 ? 'bg-amber-500/20 text-amber-400' :
            'bg-secondary text-muted-foreground'
          }`}>{p.conf}%</div>
        </motion.div>
      ))}
    </>
  );
});
PatternsTab.displayName = 'PatternsTab';

// ═══ COMPONENTE: IA ═══════════════════════════════════════════════════════════
const IATab = memo(({ sniperData }: { sniperData: any }) => {
  if (!sniperData) return (
    <div className="bg-card rounded-xl border border-border p-8 text-center">
      <div className="text-3xl mb-3 opacity-40">🧠</div>
      <p className="text-sm text-muted-foreground">Aguardando primeira análise das IAs...</p>
    </div>
  );

  const ai = sniperData.aiReasoning || {};
  const learnings = sniperData.aiLearnings || [];
  const layers = sniperData.layerResults || {};
  const topCands = sniperData.topCandidates || [];
  const patterns = sniperData.patternsFidelity || [];
  const RED_N = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
  const numBg = (n: number) => n === 0 ? 'bg-emerald-600' : RED_N.has(n) ? 'bg-red-600' : 'bg-zinc-700';

  return (
    <div className="space-y-3">

      {/* Veredito do Juiz Supremo */}
      {ai.suggestedBet && (
        <div className="bg-violet-500/8 rounded-xl border border-violet-500/25 p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-7 h-7 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
              <span className="text-sm">⚖️</span>
            </div>
            <div className="flex-1">
              <div className="text-[9px] font-black text-violet-400 uppercase tracking-wide">Juiz Supremo</div>
              <div className="text-[7px] text-violet-300/60">{ai.confidence}% confiança</div>
            </div>
            {ai.consensus > 0 && (
              <span className="text-[8px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-400 font-bold border border-violet-500/30">
                {ai.consensus} consensos
              </span>
            )}
          </div>
          <p className="text-[8px] text-foreground/80 leading-relaxed">{ai.suggestedBet?.slice(0, 300)}</p>
          {ai.patternIdentified && (
            <div className="mt-2 px-2.5 py-1.5 rounded-lg bg-secondary/50 border border-border/30">
              <p className="text-[7px] text-muted-foreground">🔍 {ai.patternIdentified?.slice(0, 120)}</p>
            </div>
          )}
          {ai.marketAnalysis?.bestMarket && (
            <div className="mt-2 flex items-center gap-2 px-2 py-1.5 rounded-lg bg-emerald-500/8 border border-emerald-500/20">
              <span className="text-[9px] font-bold text-emerald-400">📈 Melhor mercado: {ai.marketAnalysis.bestMarket}</span>
              <span className="text-[7px] text-muted-foreground ml-auto">{ai.marketAnalysis.marketConfidence}% conf.</span>
            </div>
          )}
        </div>
      )}

      {/* Top candidatos */}
      {topCands.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-4">
          <h3 className="text-[9px] font-black text-muted-foreground uppercase tracking-wider mb-3">Top Candidatos</h3>
          <div className="space-y-2">
            {topCands.slice(0, 7).map((c: any, i: number) => {
              const max = topCands[0]?.score || 1;
              return (
                <div key={c.num} className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg text-[11px] font-black text-white flex items-center justify-center shrink-0 ${numBg(c.num)} ${i === 0 ? 'ring-2 ring-primary/60 ring-offset-1 ring-offset-background' : ''}`}>
                    {c.num}
                  </div>
                  <div className="flex-1">
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${i === 0 ? 'bg-primary' : i <= 2 ? 'bg-primary/60' : 'bg-muted-foreground/40'}`}
                        style={{ width: `${(c.score/max)*100}%` }} />
                    </div>
                    {c.reasons && (
                      <p className="text-[6px] text-muted-foreground mt-0.5 truncate">{c.reasons.slice(0,4).join(' · ')}</p>
                    )}
                  </div>
                  <span className="text-[8px] font-mono text-muted-foreground shrink-0 w-10 text-right">{c.score?.toFixed(0)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Layer scores */}
      {layers.total !== undefined && (
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[9px] font-black text-muted-foreground uppercase tracking-wider">Score Total</h3>
            <span className="text-[11px] font-black font-mono text-primary">{layers.total} / {layers.max}</span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden mb-3">
            <div className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
              style={{ width: `${(layers.total/layers.max)*100}%` }} />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {Object.entries(layers)
              .filter(([k, v]) => k.startsWith('bloco') && typeof v === 'object' && (v as any).label)
              .map(([k, v]: [string, any]) => (
                <div key={k} className="flex items-center gap-1.5">
                  <div className="w-1 h-5 rounded-full shrink-0 overflow-hidden bg-secondary">
                    <div className={`w-full rounded-full ${v.score/v.max > 0.7 ? 'bg-green-500' : v.score/v.max > 0.4 ? 'bg-amber-500' : 'bg-red-500/50'}`}
                      style={{ height: `${(v.score/(v.max||1))*100}%` }} />
                  </div>
                  <span className="text-[7px] text-muted-foreground truncate flex-1">{v.label}</span>
                  <span className="text-[7px] font-mono text-muted-foreground shrink-0">{v.score}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Fidelidade de padrões */}
      {patterns.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-4">
          <h3 className="text-[9px] font-black text-muted-foreground uppercase tracking-wider mb-3">Fidelidade de Padrões</h3>
          <div className="space-y-1.5 max-h-56 overflow-y-auto">
            {[...patterns]
              .sort((a: any, b: any) => b.fidelity - a.fidelity)
              .slice(0, 15)
              .map((p: any, i: number) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[9px] shrink-0">{p.emoji}</span>
                <span className="text-[7px] text-muted-foreground flex-1 truncate">{p.name}</span>
                <div className="w-16 h-1 bg-secondary rounded-full overflow-hidden shrink-0">
                  <div className={`h-full rounded-full ${p.fidelity >= 70 ? 'bg-green-500' : p.fidelity >= 40 ? 'bg-amber-500' : 'bg-red-500/50'}`}
                    style={{ width: `${p.fidelity}%` }} />
                </div>
                <span className="text-[7px] font-mono text-muted-foreground w-8 text-right shrink-0">{p.fidelity}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Logs de aprendizado */}
      {learnings.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-4">
          <h3 className="text-[9px] font-black text-muted-foreground uppercase tracking-wider mb-3">Log de Aprendizado ({learnings.length})</h3>
          <div className="space-y-1.5 max-h-52 overflow-y-auto">
            {learnings.map((l: string, i: number) => (
              <div key={i} className="px-2.5 py-1.5 rounded-lg bg-secondary/30 border border-border/20">
                <span className="text-[8px] text-foreground/70 leading-snug">{l}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
IATab.displayName = 'IATab';


// Reusable collapsible section
const CollapsibleSection = memo(({ title, badge, isOpen, onToggle, children }: {
  title: string; badge?: string; isOpen: boolean; onToggle: () => void; children: React.ReactNode;
}) => (
  <div className="bg-card/80 rounded-xl border border-border/50 overflow-hidden backdrop-blur-sm">
    <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-primary/5 transition-all group">
      <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
        <ChevronDown className="w-4 h-4 text-primary/50 group-hover:text-primary transition-colors" />
      </motion.div>
      <span className="font-display text-[11px] tracking-[0.12em] font-bold text-primary/80 group-hover:text-primary transition-colors">{title}</span>
      {badge && (
        <span className="text-[8px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/15 font-bold font-mono ml-auto">
          {badge}
        </span>
      )}
    </button>
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ height: 0, opacity: 0 }} 
          animate={{ height: 'auto', opacity: 1 }} 
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeInOut' }}
          className="overflow-hidden"
        >
          <div className="p-4 border-t border-border/30">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
));

export default Index;
