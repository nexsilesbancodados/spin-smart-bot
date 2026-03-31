import { useState, useEffect, useRef, useCallback, useMemo, memo, startTransition, lazy, Suspense } from 'react';
import { supabase } from '@/integrations/supabase/client';
const EnsembleDashboard = lazy(() => import('@/components/EnsembleDashboard'));
import {
  Activity, Brain, ChevronDown, Power, MonitorPlay, Crosshair
} from 'lucide-react';
const PredictionHistory = lazy(() => import('@/components/PredictionHistory'));
import BetPanel from '@/components/BetPanel';
const AILearningLog = lazy(() => import('@/components/AILearningLog'));
import NumberDNADialog from '@/components/NumberDNADialog';
import PullRadar from '@/components/PullRadar';
const StrategyLeaderboard = lazy(() => import('@/components/StrategyLeaderboard'));
import Navbar from '@/components/Navbar';
import Last12Numbers from '@/components/Last12Numbers';
import ZeroPressure from '@/components/ZeroPressure';
import SessionSummary from '@/components/SessionSummary';
import SniperSignal from '@/components/SniperSignal';
import ManualInput from '@/components/ManualInput';
import WheelMap from '@/components/WheelMap';
const Scanner500 = lazy(() => import('@/components/Scanner500'));
const BacktestPanel = lazy(() => import('@/components/BacktestPanel'));
const PatternPanel24h = lazy(() => import('@/components/PatternPanel24h'));
import EngineSignalCard from '@/components/EngineSignalCard';
import NumberTicker from '@/components/NumberTicker';
const AIIntelligenceLog = lazy(() => import('@/components/AIIntelligenceLog'));
const AIDebatePanel = lazy(() => import('@/components/AIDebatePanel'));
import { motion, AnimatePresence } from 'framer-motion';
import LiveStatsBar from '@/components/LiveStatsBar';
const UnifiedAnalysis = lazy(() => import('@/components/UnifiedAnalysis'));
import SettingsPanel from '@/components/SettingsPanel';
const PerformanceMonitor = lazy(() => import('@/components/PerformanceMonitor'));
import StrategySelector from '@/components/StrategySelector';
import { type StrategyId } from '@/lib/strategy-system';

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
const HISTORY_SYNC_INTERVAL_MS = 15000;
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
HistoryGrid.displayName = 'HistoryGrid';

const LazyFallback = () => (
  <div className="glass rounded-xl border border-border/15 p-6 text-center animate-pulse">
    <div className="w-6 h-6 rounded-full border-2 border-primary/30 border-t-primary mx-auto animate-spin" />
    <p className="text-[8px] text-muted-foreground/40 mt-2 font-mono">Carregando...</p>
  </div>
);

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
  const [settingsConfig, setSettingsConfig] = useState({
    sensitivity: 'medio' as 'curto' | 'medio' | 'longo',
    riskLevel: 'moderado' as 'conservador' | 'moderado' | 'agressivo',
    betTypes: ['cor', 'duzia', 'coluna', 'setor', 'vizinhos', 'terminal', 'paridade', 'pleno'],
  });
  const [activeStrategyId, setActiveStrategyId] = useState<StrategyId | 'auto'>('auto');
  const [betHistoryForMonitor, setBetHistoryForMonitor] = useState<{ won: boolean; amount: number; profit: number; timestamp: number }[]>([]);
  const rtRetryRef = useRef(0);

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
      // Fire Omni-Core in parallel
      supabase.functions.invoke('omni-core', {
        body: { numbers: apiSnapshotRef.current.slice(0, 200) }
      }).then(res => {
        if (res.data && res.data.mode === 'signal') {
          setSniperData((prev: any) => ({
            ...(prev || {}),
            ...res.data,
            omniCore: true,
          }));
        } else if (res.data?.mode === 'kill_switch') {
          setSniperData((prev: any) => ({
            ...(prev || {}),
            killSwitch: true,
            killReason: res.data.message,
            temperature: res.data.temperature,
            agents: res.data.agents,
          }));
        }
      }).catch(() => {});
    }
  }, [soundEnabled, aiEnabled]);

  const triggerMicroLearn = useCallback(async () => {
    if (!aiEnabled) return;
    try {
      await Promise.allSettled([
        supabase.functions.invoke('auto-analyze-patterns'),
        supabase.functions.invoke('realtime-patterns'),
        supabase.functions.invoke('auto-recalibrate'),
      ]);
    } catch { /* */ }
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
          if (realtimeStatus !== 'connected' && !isBurstDuplicate(newNumbers[0])) {
            const fallbackSpinAt = Date.now();
            markAcceptedSpin(newNumbers[0]);
            handleNewSpin(`poll-${newNumbers[0]}-${fallbackSpinAt}`, fallbackSpinAt);
            sniperFetchingRef.current = false;
            lastSniperTriggerRef.current = 0;
            fetchSniperRef.current?.(0, true);
          }
          prevNumbersRef.current = key;
        }
        setError(null);
      }
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Erro'); }
  }, [handleNewSpin, isBurstDuplicate, markAcceptedSpin, realtimeStatus]);

  const fetchStored = useCallback(async () => {
    const { data } = await supabase.from('roulette_numbers').select('number').order('fetched_at', { ascending: false }).limit(1000);
    if (data) setStoredNumbers(data.map((r: any) => r.number));
  }, []);

  // Polling
  useEffect(() => {
    fetchNumbers(); fetchStored(); fetchSniper();
    if (!isPolling) return;
    const liveInterval = setInterval(fetchNumbers, POLL_INTERVAL_MS);
    const historyInterval = setInterval(fetchStored, HISTORY_SYNC_INTERVAL_MS);
    // Safety: if sniperData is still null after 6s, force a retry
    const safetyTimeout = setTimeout(() => {
      setSniperData((prev: any) => {
        if (prev === null) {
          fetchSniperRef.current?.(0, true);
          return { signal: null, mode: 'loading', message: '🔄 Reconectando IA...', strategy: null };
        }
        return prev;
      });
    }, 6000);
    return () => { clearInterval(liveInterval); clearInterval(historyInterval); clearTimeout(safetyTimeout); };
  }, [fetchNumbers, fetchStored, fetchSniper, isPolling]);

  // Realtime trigger — roulette_numbers
  useEffect(() => {
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let currentChannel: ReturnType<typeof supabase.channel> | null = null;

    const connect = () => {
      if (currentChannel) {
        try { supabase.removeChannel(currentChannel); } catch {}
        currentChannel = null;
      }
      const channelName = `sniper_trigger_rt_${Date.now()}`;
      currentChannel = supabase.channel(channelName)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'roulette_numbers' }, (payload: any) => {
        const row = payload?.new;
        if (typeof row?.number === 'number') {
          const spinAt = row.fetched_at ? new Date(row.fetched_at).getTime() : Date.now();
          const age = Date.now() - spinAt;
          if (age > FRESHNESS_MAX_MS) return; // Sinal atrasado — ignorar
          registerLiveSpin(row.number, spinAt, `rt-${row.id ?? row.fetched_at ?? ''}`);
        }
      }).subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeStatus('connected');
          rtRetryRef.current = 0;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setRealtimeStatus('disconnected');
          // Exponential backoff: 2s, 4s, 8s, 16s, max 30s
          const delay = Math.min(30000, 2000 * Math.pow(2, rtRetryRef.current));
          rtRetryRef.current++;
          retryTimeout = setTimeout(connect, delay);
        } else {
          setRealtimeStatus('connecting');
        }
      });
    };

    connect();

    // Heartbeat: if no data in 60s and connected, force reconnect
    const heartbeat = setInterval(() => {
      if (realtimeStatus === 'connected' && lastUpdate) {
        const silence = Date.now() - lastUpdate.getTime();
        if (silence > 60000) {
          setRealtimeStatus('connecting');
          connect();
        }
      }
    }, 30000);

    return () => {
      if (retryTimeout) clearTimeout(retryTimeout);
      clearInterval(heartbeat);
      if (currentChannel) supabase.removeChannel(currentChannel);
    };
  }, [registerLiveSpin]);

  // Realtime trigger — resultados_roleta (zero delay)
  useEffect(() => {
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let currentChannel: ReturnType<typeof supabase.channel> | null = null;

    const connect = () => {
      if (currentChannel) { try { supabase.removeChannel(currentChannel); } catch {} currentChannel = null; }
      currentChannel = supabase.channel(`resultados_rt_${Date.now()}`)
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
      }).subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          const delay = Math.min(30000, 2000 * Math.pow(2, Math.min(rtRetryRef.current, 5)));
          retryTimeout = setTimeout(connect, delay);
        }
      });
    };

    connect();
    return () => {
      if (retryTimeout) clearTimeout(retryTimeout);
      if (currentChannel) supabase.removeChannel(currentChannel);
    };
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
        } else if (phase === 2 || phase === 6) {
          setAutoLearnStatus('analyzing');
          await supabase.functions.invoke('omni-core', {
            body: { numbers: apiSnapshotRef.current.slice(0, 200) }
          });
        } else {
          setAutoLearnStatus('backtesting');
          await supabase.functions.invoke('sniper-predict', { body: { sampleSize: 50 } });
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
    <div className="min-h-screen bg-background text-foreground flex flex-col">

      <header className="sticky top-0 z-50 bg-background/98 backdrop-blur-xl border-b border-border/40">
        <div className="max-w-lg mx-auto px-3">
          <div className="flex items-center gap-2 h-11">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
                <span className="text-primary font-black text-[11px] font-display">S</span>
              </div>
              <span className="font-display font-black text-[10px] tracking-widest text-primary">SPIN SMART BOT</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {autoLearnStatus !== 'idle' ? (
                <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/12 border border-primary/25">
                  <motion.div animate={{ scale: [1, 1.4, 1] }} transition={{ repeat: Infinity, duration: 1 }}
                    className="w-1.5 h-1.5 rounded-full bg-primary" />
                  <span className="text-[7px] font-bold text-primary uppercase">
                    {autoLearnStatus === 'learning' ? 'aprendendo' : autoLearnStatus === 'analyzing' ? 'analisando' : 'processando'}
                  </span>
                </motion.div>
              ) : sniperCountdown > 0 ? (
                <span className="text-[8px] font-mono text-muted-foreground/60 tabular-nums">{sniperCountdown}s</span>
              ) : null}
              {sniperData?.killSwitch && (
                <div className="px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-[7px] font-black text-red-400">🛑 STOP</div>
              )}
              <button onClick={() => setAiEnabled((v: boolean) => !v)}
                className={`px-2.5 py-1 rounded-lg text-[9px] font-black tracking-wide border transition-all active:scale-95 ${
                  aiEnabled ? 'bg-primary/12 text-primary border-primary/30 hover:bg-primary/20' : 'bg-muted/30 text-muted-foreground border-border'
                }`}>
                {aiEnabled ? '⚡ ON' : '○ OFF'}
              </button>
            </div>
          </div>

          {allNumbers.length > 0 && (
            <div className="flex items-center gap-1 pb-2 overflow-x-auto">
              <span className="text-[7px] text-muted-foreground/40 font-mono shrink-0">↓</span>
              {allNumbers.slice(0, 8).map((n: number, i: number) => (
                <button key={`h${i}`} onClick={() => { setDnaNumber(n); setDnaOpen(true); }}
                  className={`shrink-0 font-black text-white transition-all active:scale-90 flex items-center justify-center ${numBg(n)} ${
                    i === 0 ? 'w-9 h-9 rounded-xl text-[13px] ring-2 ring-primary ring-offset-1 ring-offset-background' : 'w-7 h-7 rounded-lg text-[10px] opacity-80'
                  }`}>{n}</button>
              ))}
              {streakActive && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                  className={`shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full border text-[8px] font-black ml-0.5 ${
                    streakLen >= 4 ? 'bg-amber-500/20 border-amber-400/50 text-amber-400' : 'bg-primary/10 border-primary/30 text-primary'
                  }`}>
                  🔱 {streakNum}×{streakLen}
                </motion.div>
              )}
              {recentWR !== null && (
                <div className={`shrink-0 ml-auto px-2 py-0.5 rounded-full text-[7px] font-black ${
                  recentWR >= 50 ? 'bg-green-500/12 text-green-400' : recentWR >= 35 ? 'bg-amber-500/12 text-amber-400' : 'bg-red-500/12 text-red-400'
                }`}>{recentWR}%</div>
              )}
            </div>
          )}

          <div className="flex border-t border-border/20 -mx-3 px-3">
            {[
              { id: 'sinal', emoji: '🎯', label: 'SINAL', badge: sniperData?.signal?.probability ? `${sniperData.signal.probability}%` : undefined },
              { id: 'mesa', emoji: '📊', label: 'MESA', badge: allNumbers.length > 0 ? String(Math.min(allNumbers.length, 500)) : undefined },
              { id: 'padroes', emoji: '🔍', label: 'ANÁLISE' },
              { id: 'ia', emoji: '🧠', label: 'IA' },
            ].map((t: any) => (
              <button key={t.id} onClick={() => setActiveTab(t.id as any)}
                className={`flex-1 flex items-center justify-center gap-1 py-2 text-[8px] font-black tracking-wide transition-colors relative ${
                  activeTab === t.id ? 'text-primary' : 'text-muted-foreground/60 hover:text-muted-foreground'
                }`}>
                <span className="text-[10px]">{t.emoji}</span>
                <span>{t.label}</span>
                {t.badge && (
                  <span className={`text-[6px] px-1 py-0.5 rounded font-mono ${activeTab === t.id ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground/50'}`}>{t.badge}</span>
                )}
                {activeTab === t.id && <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-primary rounded-full" />}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-3 py-4">
        <AnimatePresence mode="wait">
          {activeTab === 'sinal' && (
            <motion.div key="sinal" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="space-y-3">
              <ManualInput onAddNumbers={handleManualNumbers} />

              {sniperData?.killSwitch && (
                <div className="p-4 rounded-2xl bg-red-950/30 border border-red-500/40 text-center space-y-1">
                  <div className="text-2xl">🛑</div>
                  <div className="text-[11px] font-black text-red-400">MESA DESFAVORÁVEL</div>
                  <div className="text-[9px] text-muted-foreground">{sniperData.killReason}</div>
                </div>
              )}

              <AnimatePresence mode="wait">
                {lastPredResult && lastPredResult.hit !== null && (
                  <motion.div key={`res${lastPredResult.actual}`}
                    initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                    className={`flex items-center gap-3 p-3 rounded-2xl border ${lastPredResult.hit ? 'bg-green-950/40 border-green-500/30' : 'bg-red-950/20 border-red-500/20'}`}>
                    <div className="text-2xl">{lastPredResult.hit ? '✅' : '❌'}</div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-[11px] font-black ${lastPredResult.hit ? 'text-green-400' : 'text-red-400'}`}>
                        {lastPredResult.hit ? 'ACERTOU!' : 'ERROU'}
                      </div>
                      <div className="text-[8px] text-muted-foreground mt-0.5">
                        Saiu: <b className="text-foreground">{lastPredResult.actual}</b>{' · '}Previsto: #{lastPredResult.predicted}
                      </div>
                    </div>
                    <div className={`w-10 h-10 rounded-xl text-[13px] font-black text-white flex items-center justify-center shrink-0 ${numBg(lastPredResult.actual ?? 0)}`}>{lastPredResult.actual}</div>
                  </motion.div>
                )}
              </AnimatePresence>

              {aiEnabled ? (
                <SniperSignal
                  sniperData={sniperData} sniperCountdown={sniperCountdown} sniperStale={sniperStale}
                  lastPredResult={lastPredResult} confidenceFilter={confidenceFilter}
                  rtInsights={rtInsights} allNumbers={allNumbers} autoLearnStatus={autoLearnStatus}
                  strategyFilter={strategyFilter} setStrategyFilter={setStrategyFilter}
                />
              ) : (
                <div className="bg-card rounded-2xl border border-border/30 p-14 text-center">
                  <div className="text-5xl mb-3 opacity-20">○</div>
                  <p className="text-sm font-bold text-muted-foreground">IA DESLIGADA</p>
                  <p className="text-[10px] text-muted-foreground/50 mt-1">Toque em ⚡ ON para ativar</p>
                </div>
              )}

              {allNumbers.length >= 3 && (
                <div className="grid grid-cols-4 gap-2">
                  <QuickCard label="Puxados" value={(PULL[allNumbers[0]] || []).slice(0,3).join(' ')} sub={`do ${allNumbers[0]}`} color="text-primary" />
                  <QuickCard label="Terminal" value={`T${hotTerm?.[0] ?? '?'}`} sub={`${hotTerm?.[1] ?? 0}× / 20`} color="text-amber-400" />
                  <QuickCard label="Zero" value={`${zeroPressure}g`} sub={zeroPressure > 40 ? '⚡ alto' : zeroPressure > 25 ? 'med' : 'ok'} color={zeroPressure > 40 ? 'text-green-400' : zeroPressure > 25 ? 'text-amber-400' : 'text-muted-foreground'} />
                  <QuickCard label="Hits" value={`${predStats.hits}/${predStats.total || 0}`} sub={predStats.total > 0 ? `${Math.round(predStats.hits / predStats.total * 100)}%` : '—'} color={predStats.total > 0 && predStats.hits / predStats.total >= 0.45 ? 'text-green-400' : 'text-foreground'} />
                </div>
              )}

              <button onClick={triggerLearn} disabled={isAnalyzing}
                className="w-full py-2.5 rounded-xl border border-border/30 bg-card/60 text-[9px] font-bold text-muted-foreground hover:text-foreground hover:bg-card transition-all disabled:opacity-40">
                {isAnalyzing ? '🔄 Analisando...' : '⚡ Forçar análise agora'}
              </button>
            </motion.div>
          )}

          {activeTab === 'mesa' && (
            <motion.div key="mesa" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="space-y-4">
              <div className="bg-card rounded-2xl border border-border/30 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Terminal Bias</h3>
                  <span className="text-[7px] text-muted-foreground/40">últimos 200</span>
                </div>
                <TerminalBars allNumbers={allNumbers} />
              </div>

              <div className="bg-card rounded-2xl border border-border/30 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Frequência</h3>
                  <div className="flex items-center gap-2 text-[7px] text-muted-foreground/40">
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block"/>quente</span>
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block"/>dívida</span>
                  </div>
                </div>
                <NumberFreqGrid allNumbers={allNumbers} onSelect={(n: number) => { setDnaNumber(n); setDnaOpen(true); }} />
                <p className="text-[7px] text-muted-foreground/30 text-center mt-2">Toque para análise DNA completa</p>
              </div>

              <div className="bg-card rounded-2xl border border-border/30 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Histórico</h3>
                  <div className="flex gap-1 ml-auto">
                    {[50, 100, 200].map((lim: number) => (
                      <button key={lim} onClick={() => startTransition(() => { setHistoryLimit(lim); setSelectedNum(null); })}
                        className={`px-2 py-0.5 rounded-md text-[7px] font-bold transition-all ${historyLimit === lim ? 'bg-primary/15 text-primary' : 'bg-secondary/50 text-muted-foreground/50'}`}>{lim}</button>
                    ))}
                  </div>
                </div>

                {selectedNum !== null && (
                  <div className="mb-2.5 flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-secondary/30 border border-border/20">
                    <div className={`w-7 h-7 rounded-lg text-[10px] font-black text-white flex items-center justify-center ${numBg(selectedNum)}`}>{selectedNum}</div>
                    <span className="text-[8px] text-muted-foreground flex-1">
                      <b className="text-foreground">{historySlice.filter((n: number) => n === selectedNum).length}×</b> em {historyLimit} · puxados: [{(PULL[selectedNum] || []).slice(0,4).join(', ')}]
                    </span>
                    <button onClick={() => setSelectedNum(null)} className="text-[9px] text-muted-foreground/40 hover:text-muted-foreground px-1">✕</button>
                  </div>
                )}

                {historySlice.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground/30 text-xs">Aguardando dados...</div>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {historySlice.map((n: number, i: number) => (
                      <button key={i} onClick={() => setSelectedNum(selectedNum === n ? null : n)}
                        className={`font-bold text-white transition-all flex items-center justify-center ${numBg(n)} ${
                          i === 0 ? 'w-8 h-8 rounded-xl text-[11px] ring-2 ring-primary ring-offset-1 ring-offset-background' : 'w-7 h-7 rounded-lg text-[9px]'
                        } ${selectedNum === n ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-background scale-110 z-10' : ''}
                        ${selectedNum !== null && selectedNum !== n ? 'opacity-20' : ''}`}>{n}</button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'padroes' && (
            <motion.div key="padroes" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
              <PatternsTab allNumbers={allNumbers} sniperData={sniperData}
                streakNum={streakNum} streakLen={streakLen} streakActive={streakActive}
                zeroPressure={zeroPressure} hotTerm={hotTerm} pull={PULL} numBg={numBg} />
            </motion.div>
          )}

          {activeTab === 'ia' && (
            <motion.div key="ia" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
              <IATab sniperData={sniperData} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <NumberDNADialog number={dnaNumber} allNumbers={allNumbers} open={dnaOpen} onClose={() => setDnaOpen(false)} />
    </div>
  );
};


// ═══════════════════════════════
// COMPONENTES AUXILIARES
// ═══════════════════════════════

const QuickCard = memo(({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) => (
  <div className="bg-card rounded-xl border border-border/30 p-2.5 text-center">
    <div className="text-[7px] text-muted-foreground/50 uppercase font-bold mb-1">{label}</div>
    <div className={`text-[12px] font-black font-mono leading-none ${color}`}>{value}</div>
    <div className="text-[7px] text-muted-foreground/40 mt-0.5">{sub}</div>
  </div>
));
QuickCard.displayName = 'QuickCard';

const TerminalBars = memo(({ allNumbers }: { allNumbers: number[] }) => {
  const data = useMemo(() => {
    const freq = Array(10).fill(0);
    allNumbers.slice(0, 200).forEach((n: number) => { freq[n % 10]++; });
    const total = allNumbers.slice(0, 200).length;
    const exp = total / 10;
    const maxF = Math.max(...freq, 1);
    return freq.map((c, t) => ({ t, c, bias: exp > 0 ? Math.round((c - exp) / exp * 100) : 0, pct: Math.max(4, Math.round(c / maxF * 100)) }));
  }, [allNumbers.slice(0, 200).join(',')]);
  return (
    <div className="flex items-end gap-1" style={{ height: 72 }}>
      {data.map(({ t, c, bias, pct }) => (
        <div key={t} className="flex-1 flex flex-col items-center">
          {Math.abs(bias) > 20 && <div className={`text-[6px] font-mono font-bold leading-none mb-0.5 ${bias > 0 ? 'text-amber-400' : 'text-blue-400'}`}>{bias > 0 ? '+' : ''}{bias}%</div>}
          <div className="w-full flex-1 flex items-end">
            <div className={`w-full rounded-t ${bias >= 60 ? 'bg-amber-500' : bias >= 25 ? 'bg-primary/80' : bias <= -40 ? 'bg-blue-500/50' : 'bg-muted-foreground/25'}`} style={{ height: `${pct}%`, minHeight: 3 }} />
          </div>
          <div className="text-[7px] font-mono font-bold text-foreground/70 mt-0.5">T{t}</div>
          <div className="text-[6px] text-muted-foreground/40">{c}</div>
        </div>
      ))}
    </div>
  );
});
TerminalBars.displayName = 'TerminalBars';

const RED_FREQ = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const NumberFreqGrid = memo(({ allNumbers, onSelect }: { allNumbers: number[]; onSelect: (n: number) => void }) => {
  const { freq, exp } = useMemo(() => {
    const f = Array(37).fill(0);
    allNumbers.forEach((n: number) => { if (n >= 0 && n <= 36) f[n]++; });
    return { freq: f, exp: allNumbers.length / 37 };
  }, [allNumbers.length, allNumbers[0]]);
  const maxF = Math.max(...freq, 1);
  return (
    <div className="grid grid-cols-9 gap-0.5">
      {Array.from({ length: 37 }, (_, n) => {
        const c = freq[n]; const hot = c > exp * 1.5; const cold = c < exp * 0.4;
        const op = allNumbers.length > 0 ? Math.max(0.18, Math.min(1, c / (exp * 1.8))) : 0.4;
        const bg = n === 0 ? 'bg-emerald-600' : RED_FREQ.has(n) ? 'bg-red-600' : 'bg-zinc-700';
        return (
          <button key={n} onClick={() => onSelect(n)} title={`${n}: ${c}×`}
            className={`relative h-8 rounded text-[9px] font-black text-white transition-all hover:scale-110 hover:z-10 ${bg} ${hot ? 'ring-1 ring-amber-400/80' : cold && c === 0 ? 'ring-1 ring-blue-400/60' : ''}`}
            style={{ opacity: op }}>
            {n}
            {hot && <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400" />}
            {cold && c === 0 && <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-blue-400" />}
          </button>
        );
      })}
    </div>
  );
});
NumberFreqGrid.displayName = 'NumberFreqGrid';

const VOISINS_PT = new Set([22,18,29,7,28,12,35,3,26,0,32,15,19,4,21,2,25]);
const TIERS_PT = new Set([27,13,36,11,30,8,23,10,5,24,16,33]);
const ORPHELINS_PT = new Set([1,20,14,31,9,17,34,6]);
const getSectorPT = (n: number) => VOISINS_PT.has(n) ? 'Voisins' : TIERS_PT.has(n) ? 'Tiers' : ORPHELINS_PT.has(n) ? 'Orphelins' : 'Zero';

const PatternsTab = memo(({ allNumbers, sniperData, streakNum, streakLen, streakActive, zeroPressure, hotTerm, pull, numBg }: {
  allNumbers: number[]; sniperData: any; streakNum: number; streakLen: number;
  streakActive: boolean; zeroPressure: number; hotTerm: [string,number]|undefined;
  pull: Record<number,number[]>; numBg: (n: number) => string;
}) => {
  const patterns = useMemo(() => {
    const list: any[] = [];
    if (allNumbers.length < 3) return list;
    if (streakActive) {
      const prob = Math.min(95, 50 + streakLen * 12);
      const pux = (pull[streakNum] || []).slice(0, 4);
      list.push({ id: 'streak', emoji: '🔱', title: `STREAK ${streakNum} × ${streakLen} consecutivas`,
        detail: `${streakNum} repetiu ${streakLen}× seguidas! Prob de repetir: ${prob}%. Cobrir: [${pux.join(', ')}]`,
        conf: prob, type: streakLen >= 4 ? 'high' : 'mid', numbers: [streakNum, ...pux].slice(0, 5) });
    }
    if (hotTerm) {
      const [tStr, c] = hotTerm; const t = Number(tStr);
      const exp20 = allNumbers.slice(0, 20).length / 10;
      const bias = exp20 > 0 ? (c - exp20) / exp20 * 100 : 0;
      if (Math.abs(bias) > 25) {
        const tNums = Array.from({length: 4}, (_, i) => i * 10 + t).filter(n => n >= 0 && n <= 36);
        list.push({ id: 'term', emoji: bias > 0 ? '🔥' : '❄️',
          title: `Terminal T${t} ${bias > 0 ? 'QUENTE' : 'FRIO'} (${bias > 0 ? '+' : ''}${bias.toFixed(0)}%)`,
          detail: `T${t} ${bias > 0 ? `${bias.toFixed(0)}% acima do esperado` : `${Math.abs(bias).toFixed(0)}% abaixo — reversão provável`}. Números: ${tNums.join(', ')}`,
          conf: Math.min(88, Math.abs(bias) > 60 ? 85 : 65), type: bias > 60 ? 'high' : bias > 25 ? 'mid' : 'cold', numbers: tNums });
      }
    }
    if (zeroPressure >= 22) {
      list.push({ id: 'zero', emoji: '🟢', title: `Pressão Zero — ${zeroPressure} giros`,
        detail: `Zero ausente há ${zeroPressure} giros (média 37). ${zeroPressure > 55 ? 'CRÍTICO!' : zeroPressure > 37 ? 'Acima da média.' : 'Atenção.'} Apostar Jeu Zéro.`,
        conf: Math.min(88, 35 + zeroPressure * 0.8), type: zeroPressure > 50 ? 'high' : 'mid',
        numbers: [0, 32, 15, 26, 3, 35, 12] });
    }
    if (allNumbers.length > 0) {
      const pux = pull[allNumbers[0]] || [];
      if (pux.length > 0) list.push({ id: 'pull', emoji: '🧲', title: `Puxados do ${allNumbers[0]}`,
        detail: `Após o ${allNumbers[0]}, mais frequentes: [${pux.slice(0,6).join(', ')}]. Pull desta mesa: 70-86%.`,
        conf: 68, type: 'mid', numbers: pux.slice(0, 6) });
    }
    const sc: Record<string,number> = {};
    allNumbers.slice(0,15).forEach((n: number) => { const s = getSectorPT(n); sc[s]=(sc[s]||0)+1; });
    const topS = Object.entries(sc).sort(([,a],[,b])=>b-a)[0];
    if (topS && topS[1] >= 5) list.push({ id: 'sector', emoji: '🌍', title: `Setor ${topS[0]} dominante (${topS[1]}/15)`,
      detail: `${topS[0]} concentrou ${topS[1]} dos últimos 15 giros.`, conf: 60, type: 'info' });
    const detectedPatterns = Array.isArray(sniperData?.detectedPatterns) ? sniperData.detectedPatterns : [];
    detectedPatterns.filter((p: any) => p.confidence >= 68).slice(0, 4).forEach((p: any) => {
      if (list.length >= 9) return;
      list.push({ id: `det_${p.name}`, emoji: p.emoji || '📊', title: p.name,
        detail: p.description + (p.action ? ` → ${p.action}` : ''), conf: p.confidence, type: p.confidence >= 80 ? 'mid' : 'info' });
    });
    const agents = Array.isArray(sniperData?.agents) ? sniperData.agents : [];
    agents.slice(0, 2).forEach((a: any) => {
      if (!a.signal || !a.numbers?.length || list.length >= 10) return;
      list.push({ id: `agent_${a.modelId}`, emoji: '🤖', title: `${a.modelName}: ${a.label}`,
        detail: a.reasoning?.slice(0, 120) || '', conf: a.confidence, type: a.confidence >= 72 ? 'mid' : 'info', numbers: Array.isArray(a.numbers) ? a.numbers.slice(0, 5) : [] });
    });
    return list.slice(0, 10);
  }, [allNumbers.slice(0, 20).join(','), sniperData?.detectedPatterns?.length, sniperData?.agents?.length, streakActive, zeroPressure]);

  if (patterns.length === 0) return (
    <div className="bg-card rounded-2xl border border-border/30 p-12 text-center">
      <div className="text-4xl mb-3 opacity-20">🔍</div>
      <p className="text-sm text-muted-foreground">Aguardando dados para análise...</p>
    </div>
  );
  return (
    <div className="space-y-2.5">
      {patterns.map((p: any, i: number) => (
        <motion.div key={p.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
          className={`p-3.5 rounded-2xl border flex items-start gap-3 ${
            p.type === 'high' ? 'bg-amber-950/30 border-amber-500/30' : p.type === 'mid' ? 'bg-primary/5 border-primary/20' :
            p.type === 'cold' ? 'bg-blue-950/20 border-blue-500/20' : 'bg-card border-border/25'
          }`}>
          <span className="text-2xl shrink-0">{p.emoji}</span>
          <div className="flex-1 min-w-0">
            <div className={`text-[10px] font-black leading-tight ${
              p.type === 'high' ? 'text-amber-400' : p.type === 'mid' ? 'text-primary' : p.type === 'cold' ? 'text-blue-400' : 'text-foreground'
            }`}>{p.title}</div>
            <p className="text-[8px] text-muted-foreground/70 mt-1 leading-relaxed">{p.detail}</p>
            {p.numbers?.length > 0 && (
              <div className="flex items-center gap-1 mt-2 flex-wrap">
                <span className="text-[7px] text-muted-foreground/40 mr-0.5">Apostar:</span>
                {p.numbers.slice(0, 6).map((n: number) => (
                  <div key={n} className={`w-6 h-6 rounded text-[9px] font-black text-white flex items-center justify-center ${numBg(n)}`}>{n}</div>
                ))}
              </div>
            )}
          </div>
          <div className={`shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded-full min-w-[36px] text-center ${
            p.conf >= 80 ? 'bg-green-500/15 text-green-400' : p.conf >= 60 ? 'bg-amber-500/15 text-amber-400' : 'bg-secondary text-muted-foreground/50'
          }`}>{p.conf}%</div>
        </motion.div>
      ))}
    </div>
  );
});
PatternsTab.displayName = 'PatternsTab';

const RED_IA = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const IATab = memo(({ sniperData }: { sniperData: any }) => {
  const numBgI = (n: number) => n === 0 ? 'bg-emerald-600' : RED_IA.has(n) ? 'bg-red-600' : 'bg-zinc-700';
  if (!sniperData) return (
    <div className="bg-card rounded-2xl border border-border/30 p-12 text-center">
      <div className="text-4xl mb-3 opacity-20">🧠</div>
      <p className="text-sm text-muted-foreground">Aguardando análise das IAs...</p>
    </div>
  );
  const ai = sniperData.aiReasoning || {};
  const learnings = sniperData.aiLearnings || [];
  const layers = sniperData.layerResults || {};
  const topCands = sniperData.topCandidates || [];
  const patterns = sniperData.patternsFidelity || [];
  const agents = sniperData.agents || [];
  return (
    <div className="space-y-3">
      <Suspense fallback={<div className="text-xs text-muted-foreground text-center py-4">Carregando debate...</div>}>
        <AIDebatePanel
          agents={agents}
          consensusMap={sniperData.consensusMap}
          ensembleConsensus={sniperData.ensembleConsensus}
          fusionTop5={sniperData.fusionTop5}
          fusionConfidence={sniperData.fusionConfidence}
          entryAction={sniperData.entryAction}
          totalModels={sniperData.totalModels || 9}
          modelPerformance={sniperData.modelPerformance}
        />
      </Suspense>

      {ai.suggestedBet && (
        <div className="bg-violet-950/30 rounded-2xl border border-violet-500/25 p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-8 h-8 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-base shrink-0">⚖️</div>
            <div className="flex-1">
              <div className="text-[9px] font-black text-violet-400 uppercase tracking-wider">Juiz Supremo</div>
              <div className="text-[7px] text-violet-400/50">{ai.confidence}% confiança · {ai.consensus || 0} consensos</div>
            </div>
          </div>
          <p className="text-[8px] text-foreground/75 leading-relaxed">{ai.suggestedBet?.slice(0, 280)}</p>
          {ai.patternIdentified && <div className="mt-2 px-2.5 py-1.5 rounded-xl bg-secondary/30 border border-border/20"><p className="text-[7px] text-muted-foreground/60">🔍 {ai.patternIdentified?.slice(0, 110)}</p></div>}
          {ai.marketAnalysis?.bestMarket && (
            <div className="mt-2 flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-emerald-950/30 border border-emerald-500/20">
              <span className="text-[9px] font-bold text-emerald-400">📈 {ai.marketAnalysis.bestMarket}</span>
              <span className="text-[7px] text-muted-foreground/40 ml-auto">{ai.marketAnalysis.marketConfidence}%</span>
            </div>
          )}
        </div>
      )}

      {topCands.length > 0 && (
        <div className="bg-card rounded-2xl border border-border/30 p-4">
          <h3 className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-3">Top Candidatos</h3>
          <div className="space-y-2">
            {topCands.slice(0, 7).map((c: any, i: number) => {
              const max = topCands[0]?.score || 1;
              return (
                <div key={c.num} className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg text-[11px] font-black text-white flex items-center justify-center shrink-0 ${numBgI(c.num)} ${i === 0 ? 'ring-2 ring-primary/70 ring-offset-1 ring-offset-background' : ''}`}>{c.num}</div>
                  <div className="flex-1 min-w-0">
                    <div className="h-1.5 bg-secondary/50 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${i === 0 ? 'bg-primary' : i <= 2 ? 'bg-primary/60' : 'bg-muted-foreground/30'}`} style={{ width: `${Math.round(c.score/max*100)}%` }} />
                    </div>
                    {c.reasons?.length > 0 && <p className="text-[6px] text-muted-foreground/40 truncate mt-0.5">{c.reasons.slice(0,3).join(' · ')}</p>}
                  </div>
                  <span className="text-[7px] font-mono text-muted-foreground/40 shrink-0 w-8 text-right">{c.score?.toFixed(0)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {layers.total !== undefined && (
        <div className="bg-card rounded-2xl border border-border/30 p-4">
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Score Total</h3>
            <span className="text-[11px] font-black font-mono text-primary">{layers.total} / {layers.max}</span>
          </div>
          <div className="h-1.5 bg-secondary/40 rounded-full overflow-hidden mb-3">
            <div className="h-full bg-gradient-to-r from-primary to-accent rounded-full" style={{ width: `${Math.round(layers.total / layers.max * 100)}%` }} />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {Object.entries(layers).filter(([k, v]) => k.startsWith('bloco') && typeof v === 'object' && (v as any)?.label).map(([k, v]: [string, any]) => (
              <div key={k} className="flex items-center gap-1.5">
                <div className={`w-0.5 h-5 rounded-full shrink-0 ${v.score/v.max >= 0.7 ? 'bg-green-500' : v.score/v.max >= 0.4 ? 'bg-amber-500' : 'bg-red-500/50'}`} />
                <span className="text-[7px] text-muted-foreground/50 flex-1 truncate">{v.label}</span>
                <span className="text-[7px] font-mono text-muted-foreground/40 shrink-0">{v.score}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {patterns.length > 0 && (
        <div className="bg-card rounded-2xl border border-border/30 p-4">
          <h3 className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-3">Fidelidade de Padrões</h3>
          <div className="space-y-1.5 max-h-52 overflow-y-auto">
            {[...patterns].sort((a: any, b: any) => b.fidelity - a.fidelity).slice(0, 14).map((p: any, i: number) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[9px] shrink-0">{p.emoji}</span>
                <span className="text-[7px] text-muted-foreground/60 flex-1 truncate">{p.name}</span>
                <div className="w-14 h-1 bg-secondary/30 rounded-full overflow-hidden shrink-0">
                  <div className={`h-full rounded-full ${p.fidelity >= 70 ? 'bg-green-500' : p.fidelity >= 40 ? 'bg-amber-500' : 'bg-red-500/40'}`} style={{ width: `${p.fidelity}%` }} />
                </div>
                <span className="text-[7px] font-mono text-muted-foreground/40 w-7 text-right shrink-0">{p.fidelity}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {learnings.length > 0 && (
        <div className="bg-card rounded-2xl border border-border/30 p-4">
          <h3 className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-3">Log de Aprendizado ({learnings.length})</h3>
          <div className="space-y-1.5 max-h-52 overflow-y-auto">
            {learnings.map((l: string, i: number) => (
              <div key={i} className="px-2.5 py-1.5 rounded-xl bg-secondary/20 border border-border/15">
                <span className="text-[8px] text-foreground/50 leading-snug">{l}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
IATab.displayName = 'IATab';


export default Index;
