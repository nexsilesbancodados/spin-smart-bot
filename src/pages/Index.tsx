import { useState, useEffect, useRef, useCallback, useMemo, memo, startTransition } from 'react';
import { supabase } from '@/integrations/supabase/client';
import EnsembleDashboard from '@/components/EnsembleDashboard';
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
import LiveStatsBar from '@/components/LiveStatsBar';
import UnifiedAnalysis from '@/components/UnifiedAnalysis';
import SettingsPanel from '@/components/SettingsPanel';
import PerformanceMonitor from '@/components/PerformanceMonitor';
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
    return () => { clearInterval(liveInterval); clearInterval(historyInterval); clearTimeout(safetyTimeout); };
  }, [fetchNumbers, fetchStored, fetchSniper, isPolling]);

  // Realtime trigger — roulette_numbers
  useEffect(() => {
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let currentChannel: ReturnType<typeof supabase.channel> | null = null;

    const connect = () => {
      if (currentChannel) {
        supabase.removeChannel(currentChannel);
      }
      currentChannel = supabase.channel('sniper_trigger_rt')
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
      if (currentChannel) supabase.removeChannel(currentChannel);
      currentChannel = supabase.channel('resultados_rt')
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
    <div className="min-h-screen bg-background text-foreground">

      {/* ═══ HEADER FIXO ══════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-50 glass-strong border-b border-border/10 shadow-2xl shadow-background/80 overflow-hidden">
        {/* Top accent gradient */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-neon-cyan/50 via-neon-pink/40 to-neon-cyan/50" />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.02] to-transparent pointer-events-none" />
        
        <div className="max-w-2xl mx-auto px-3 relative">

          {/* Linha 1: Marca + Status + Toggle */}
          <div className="flex items-center gap-2 py-2.5">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div className="relative">
                <motion.div 
                  whileHover={{ scale: 1.05 }}
                  className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/25 to-neon-pink/15 border border-primary/25 flex items-center justify-center shadow-[0_0_20px_hsl(var(--primary)/0.2)]"
                >
                  <span className="font-display font-black text-sm text-primary text-glow-cyan">S</span>
                </motion.div>
                {isPolling && (
                  <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-neon-green shadow-[0_0_10px_hsl(var(--neon-green)/0.6)]">
                    <div className="absolute inset-0 rounded-full bg-neon-green animate-ping opacity-30" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="font-display font-black text-[12px] tracking-[0.2em] leading-none">
                  <span className="text-primary text-glow-cyan">SPIN</span>{' '}
                  <span className="bg-gradient-to-r from-neon-pink to-neon-purple bg-clip-text text-transparent">SMART</span>
                </div>
                <div className="text-[7px] text-muted-foreground/30 font-mono leading-none mt-0.5 tracking-wider">IA ROLETA BRASILEIRA · v5.0</div>
              </div>
            </div>

            {/* Status da IA */}
            <div className="flex items-center gap-1.5 shrink-0">
              {autoLearnStatus !== 'idle' && (
                <motion.div 
                  animate={{ opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-neon-purple/10 border border-neon-purple/20 backdrop-blur-sm"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-neon-purple animate-pulse" />
                  <span className="text-[8px] font-bold text-neon-purple font-mono">{autoLearnStatus === 'learning' ? 'LEARN' : autoLearnStatus === 'analyzing' ? 'ANALYZE' : 'TEST'}</span>
                </motion.div>
              )}
              {sniperCountdown > 0 && autoLearnStatus === 'idle' && (
                <span className="text-[9px] font-mono text-primary/60 tabular-nums font-bold px-2 py-0.5 rounded-lg glass border border-primary/10">{sniperCountdown}s</span>
              )}
              <SettingsPanel config={settingsConfig} onChange={setSettingsConfig} />
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setAiEnabled(v => !v)}
                className={`px-3 py-1.5 rounded-xl text-[9px] font-black tracking-wide border transition-all backdrop-blur-sm font-display ${
                  aiEnabled
                    ? 'bg-primary/12 text-primary border-primary/25 hover:bg-primary/20 shadow-[0_0_12px_hsl(var(--primary)/0.15)]'
                    : 'bg-destructive/8 text-destructive border-destructive/20'
                }`}
              >
                {aiEnabled ? '⚡ ON' : '○ OFF'}
              </motion.button>
            </div>
          </div>

          {/* Linha 2: Últimos números + streak */}
          {allNumbers.length > 0 && (
            <div className="flex items-center gap-1.5 pb-2.5">
              <span className="text-[7px] text-muted-foreground/30 font-mono shrink-0 uppercase tracking-wider">Últimos</span>
              {allNumbers.slice(0, 7).map((n, i) => (
                <motion.button
                  key={`${n}-${i}`}
                  initial={i === 0 ? { scale: 0, rotate: -180 } : {}}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={i === 0 ? { type: 'spring', stiffness: 300, damping: 15 } : {}}
                  onClick={() => { setDnaNumber(n); setDnaOpen(true); }}
                  className={`rounded-xl font-black text-white flex items-center justify-center transition-all hover:scale-110 shrink-0 ${numBg(n)} ${
                    i === 0
                      ? 'ring-2 ring-primary/60 ring-offset-1 ring-offset-background w-9 h-9 text-[12px] shadow-lg shadow-primary/25'
                      : i <= 2
                      ? 'w-7 h-7 text-[10px] opacity-85'
                      : 'w-6 h-6 text-[9px] opacity-50'
                  }`}
                >
                  {n}
                </motion.button>
              ))}
              {streakActive && (
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className={`ml-1 flex items-center gap-1 px-2.5 py-1 rounded-xl border text-[8px] font-black backdrop-blur-sm ${
                  streakLen >= 4
                    ? 'bg-gold/15 border-gold/30 text-gold animate-pulse shadow-[0_0_10px_hsl(var(--gold)/0.2)]'
                    : 'bg-primary/8 border-primary/20 text-primary'
                }`}>
                  🔱 {streakNum} ×{streakLen}
                </motion.div>
              )}
              {recentWR !== null && (
                <div className={`ml-auto shrink-0 px-2.5 py-1 rounded-xl text-[8px] font-black font-mono border backdrop-blur-sm ${
                  recentWR >= 50 ? 'bg-neon-green/8 text-neon-green border-neon-green/20 shadow-[0_0_8px_hsl(var(--neon-green)/0.15)]' :
                  recentWR >= 35 ? 'bg-gold/8 text-gold border-gold/15' :
                  'bg-destructive/8 text-destructive border-destructive/15'
                }`}>WR {recentWR}%</div>
              )}
            </div>
          )}

          {/* Linha 3: Tabs de navegação — premium style */}
          <div className="flex border-t border-border/10">
            {[
              { id: 'sinal' as const, label: 'SINAL', icon: '🎯', badge: sniperData?.signal?.probability ? `${sniperData.signal.probability}%` : undefined },
              { id: 'mesa' as const, label: 'MESA', icon: '📊', badge: allNumbers.length > 0 ? `${Math.min(allNumbers.length, 500)}` : undefined },
              { id: 'padroes' as const, label: 'ANÁLISE', icon: '🔍' },
              { id: 'ia' as const, label: 'IA', icon: '🧠' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex-1 py-3 text-[8px] font-black tracking-[0.12em] transition-all relative font-display ${
                  activeTab === t.id
                    ? 'text-primary'
                    : 'text-muted-foreground/35 hover:text-foreground/60'
                }`}
              >
                <span className="text-[10px] mr-0.5">{t.icon}</span>
                {t.label}
                {t.badge && (
                  <span className={`ml-1 text-[6px] font-mono px-1.5 py-0.5 rounded-lg ${
                    activeTab === t.id 
                      ? 'bg-primary/15 text-primary border border-primary/20' 
                      : 'bg-secondary/30 text-muted-foreground/30 border border-border/10'
                  }`}>
                    {t.badge}
                  </span>
                )}
                {activeTab === t.id && (
                  <motion.div 
                    layoutId="header-tab" 
                    className="absolute bottom-0 left-2 right-2 h-[2px] rounded-t" 
                    style={{ background: 'linear-gradient(90deg, hsl(var(--neon-cyan)), hsl(var(--neon-pink)), hsl(var(--neon-cyan)))' }}
                  />
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
                className="px-4 py-2.5 rounded-xl bg-destructive/10 border border-destructive/30 flex items-center gap-2 justify-between"
              >
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                  <span className="text-[10px] font-bold text-destructive">
                    🔌 Reconectando... (tentativa {Math.min(rtRetryRef.current, 9)})
                  </span>
                </div>
                <span className="text-[8px] text-muted-foreground">Polling ativo como backup</span>
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
                      <span className="text-[10px] text-muted-foreground font-bold">🔎 Analisando... aguardando próxima rodada</span>
                    )}
                  </div>
                  <div className="shrink-0">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" title="Sinal ativo" />
                  </div>
                </motion.div>
              )}
              <div className={`transition-all duration-500 rounded-2xl ${
                sniperCountdown > 0 && sniperData?.signal ? 'shadow-neon-green ring-1 ring-neon-green/30' : ''
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

              {/* ── STRATEGY SELECTOR ────── */}
              <StrategySelector
                allNumbers={allNumbers}
                betHistory={betHistoryForMonitor}
                balance={1000}
                baseBet={1}
                activeStrategy={activeStrategyId}
                onSelectStrategy={setActiveStrategyId}
              />
              
              {/* ── PERFORMANCE MONITOR ────── */}
              {betHistoryForMonitor.length >= 2 && (
                <PerformanceMonitor
                  betHistory={betHistoryForMonitor}
                  balance={1000}
                  allNumbers={allNumbers}
                />
              )}
              </>
            ) : (
              <div className="bg-card rounded-2xl border border-border p-12 text-center">
                <div className="text-5xl mb-4 opacity-30">○</div>
                <p className="text-sm font-bold text-muted-foreground">IA DESLIGADA</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Clique "⚡ ON" para ativar</p>
              </div>
            )}

            {/* ── LIVE STATS BAR ──────────────────────────── */}
            {allNumbers.length >= 10 && (
              <LiveStatsBar allNumbers={allNumbers} />
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

            {/* ── CARDS DE CONTEXTO — Premium ──────────────────────────── */}
            {allNumbers.length >= 5 && (
              <div className="grid grid-cols-4 gap-2">
                {[
                  {
                    label: 'Puxados', delay: 0,
                    value: (PULL[allNumbers[0]] || []).slice(0,3).join(' '),
                    sub: `do ${allNumbers[0]}`,
                    borderColor: 'border-primary/15 hover:border-primary/30',
                    textColor: 'text-primary',
                    glowColor: 'shadow-[0_0_10px_hsl(var(--primary)/0.08)]',
                  },
                  {
                    label: 'Terminal', delay: 0.05,
                    value: `T${hotTerm?.[0]}`,
                    sub: `${hotTerm?.[1]}× em 20`,
                    borderColor: 'border-gold/15 hover:border-gold/30',
                    textColor: 'text-[hsl(var(--gold))]',
                    glowColor: 'shadow-[0_0_10px_hsl(var(--gold)/0.08)]',
                  },
                  {
                    label: 'Zero', delay: 0.1,
                    value: `${zeroPressure}g`,
                    sub: zeroPressure > 40 ? '⚡ pressão' : zeroPressure > 25 ? 'atenção' : 'ok',
                    borderColor: zeroPressure > 40 ? 'border-neon-green/25 bg-neon-green/3' : zeroPressure > 25 ? 'border-gold/15' : 'border-border/15',
                    textColor: zeroPressure > 40 ? 'text-neon-green' : zeroPressure > 25 ? 'text-[hsl(var(--gold))]' : 'text-muted-foreground',
                    glowColor: zeroPressure > 40 ? 'shadow-[0_0_10px_hsl(var(--neon-green)/0.1)]' : '',
                  },
                  {
                    label: 'Hits', delay: 0.15,
                    value: `${predStats.hits}/${predStats.total || 1}`,
                    sub: predStats.total > 0 ? `${Math.round(predStats.hits/predStats.total*100)}%` : '—',
                    borderColor: 'border-border/15 hover:border-neon-cyan/20',
                    textColor: 'text-foreground',
                    glowColor: '',
                  },
                ].map((card, idx) => (
                  <motion.div
                    key={card.label}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: card.delay }}
                    className={`glass rounded-xl border p-3 text-center space-y-1 transition-all group relative overflow-hidden ${card.borderColor} ${card.glowColor}`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-transparent to-primary/[0.02] opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative">
                      <div className="text-[8px] text-muted-foreground/40 uppercase font-bold tracking-wider font-display">{card.label}</div>
                      <div className={`text-[12px] font-black font-mono leading-tight group-hover:scale-105 transition-transform ${card.textColor}`}>
                        {card.value}
                      </div>
                      <div className="text-[7px] text-muted-foreground/25 font-mono">{card.sub}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Botão de forçar análise */}
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={triggerLearn}
              disabled={isAnalyzing}
              className="w-full py-3 rounded-xl border border-primary/10 glass text-[9px] font-bold text-muted-foreground/60 hover:text-primary hover:border-primary/25 hover:bg-primary/3 transition-all disabled:opacity-30 font-display tracking-wider"
            >
              {isAnalyzing ? '🔄 Analisando...' : '⚡ Forçar análise da IA agora'}
            </motion.button>
          </div>
        )}

        {/* ── ABA: MESA ──────────────────────────────────────────────────── */}
        {activeTab === 'mesa' && (
          <div className="space-y-4">

            {/* Terminal Bias */}
            <div className="glass rounded-xl border border-border/20 p-4">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-gold/15 to-amber-500/10 border border-gold/20 flex items-center justify-center shadow-[0_0_8px_hsl(var(--gold)/0.15)]">
                  <span className="text-sm">🔢</span>
                </div>
                <h3 className="text-[10px] font-black text-gold uppercase tracking-[0.15em]">
                  Terminal Bias <span className="text-muted-foreground/40 font-normal">(200)</span>
                </h3>
              </div>
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
                        <div className={`text-[6px] font-mono font-bold ${bias>0?'text-gold':'text-neon-cyan'}`}>
                          {bias>0?'+':''}{bias.toFixed(0)}%
                        </div>
                      )}
                      <div className="w-full flex items-end" style={{ flex: 1 }}>
                        <div
                          className={`w-full rounded-t transition-all ${
                            bias > 50 ? 'bg-gradient-to-t from-gold to-amber-400 shadow-[0_0_6px_hsl(var(--gold)/0.3)]' : bias > 20 ? 'bg-primary/70' : bias < -30 ? 'bg-neon-cyan/40' : 'bg-muted-foreground/20'
                          }`}
                          style={{ height: `${Math.max(4, pct)}%`, minHeight: 4 }}
                        />
                      </div>
                      <div className="text-[7px] font-mono font-bold text-foreground/80">T{t}</div>
                      <div className="text-[6px] text-muted-foreground/40">{cnt}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Frequência numérica — grid 37 números */}
            <div className="glass rounded-xl border border-border/20 p-4">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-neon-cyan/15 to-neon-pink/10 border border-neon-cyan/20 flex items-center justify-center shadow-neon-cyan">
                  <span className="text-sm">📊</span>
                </div>
                <h3 className="text-[10px] font-black text-neon-cyan uppercase tracking-[0.15em]">Frequência <span className="text-muted-foreground/40 font-normal">(500)</span></h3>
                <div className="flex items-center gap-2 ml-auto text-[7px] text-muted-foreground/50">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gold inline-block shadow-[0_0_4px_hsl(var(--gold)/0.4)]"/>quente</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-neon-cyan inline-block shadow-neon-cyan"/>frio</span>
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
                        hot ? 'ring-1 ring-gold shadow-[0_0_6px_hsl(var(--gold)/0.3)]' : cold ? 'ring-1 ring-neon-cyan/60 shadow-neon-cyan' : ''
                      }`}
                      style={{ opacity: op }}
                    >
                      {n}
                      {(hot || cnt === 0) && (
                        <div className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${hot ? 'bg-gold shadow-[0_0_4px_hsl(var(--gold)/0.5)]' : 'bg-neon-cyan shadow-neon-cyan'}`} />
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2.5 text-[7px] text-muted-foreground/30 text-center font-mono">Toque em qualquer número para DNA completo</div>
            </div>

            {/* Histórico sequencial */}
            <div className="glass rounded-xl border border-border/20 p-4">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-neon-pink/15 to-purple-500/10 border border-neon-pink/20 flex items-center justify-center shadow-neon-pink">
                  <span className="text-sm">📜</span>
                </div>
                <h3 className="text-[10px] font-black text-neon-pink uppercase tracking-[0.15em]">Histórico</h3>
                <div className="flex gap-1 ml-auto">
                  {[50, 100, 200, 500].map(lim => (
                    <button key={lim}
                      onClick={() => startTransition(() => { setHistoryLimit(lim); setSelectedNum(null); })}
                      className={`px-2 py-0.5 rounded text-[7px] font-bold transition-all border ${
                        historyLimit === lim ? 'bg-neon-pink/15 text-neon-pink border-neon-pink/25' : 'bg-background/20 text-muted-foreground/50 border-border/10 hover:text-foreground'
                      }`}>
                      {lim}
                    </button>
                  ))}
                </div>
              </div>

              {selectedNum !== null && (
                <div className="mb-2.5 flex items-center gap-2 px-2.5 py-1.5 rounded-lg glass border border-primary/15">
                  <div className={`w-6 h-6 rounded text-[9px] font-black text-white flex items-center justify-center ${numBg(selectedNum)}`}>{selectedNum}</div>
                  <span className="text-[8px] text-muted-foreground/60">
                    apareceu <b className="text-foreground">{allNumbers.slice(0, historyLimit).filter(n => n === selectedNum).length}×</b> em {historyLimit} giros
                  </span>
                  <button onClick={() => setSelectedNum(null)} className="ml-auto text-[8px] text-muted-foreground/40 hover:text-foreground">✕</button>
                </div>
              )}

              {historySlice.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground/40 text-xs">Aguardando dados...</div>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {historySlice.map((n, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedNum(selectedNum === n ? null : n)}
                      className={`w-7 h-7 rounded text-[9px] font-bold text-white flex items-center justify-center transition-all ${numBg(n)} ${
                        i === 0 ? 'ring-2 ring-primary/60 ring-offset-1 ring-offset-background shadow-neon-cyan' : ''
                      } ${selectedNum === n ? 'ring-2 ring-gold ring-offset-1 ring-offset-background scale-110 z-10 shadow-[0_0_8px_hsl(var(--gold)/0.3)]' : ''}
                      ${selectedNum !== null && selectedNum !== n ? 'opacity-20' : ''}`}
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
            <UnifiedAnalysis sniperData={sniperData} allNumbers={allNumbers} />
            <PatternsTab allNumbers={allNumbers} sniperData={sniperData} streakNum={streakNum} streakLen={streakLen} streakActive={streakActive} zeroPressure={zeroPressure} hotTerm={hotTerm} pull={PULL} />
          </div>
        )}

        {/* ── ABA: IA ─────────────────────────────────────────────────────── */}
        {activeTab === 'ia' && (
          <div className="space-y-3">
            <EnsembleDashboard sniperData={sniperData} />
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
          className={`glass flex items-start gap-3 p-3.5 rounded-xl border backdrop-blur-sm ${
            p.type === 'hot' ? 'bg-gold/5 border-gold/20 shadow-[0_0_8px_hsl(var(--gold)/0.08)]' :
            p.type === 'cold' ? 'bg-neon-cyan/5 border-neon-cyan/20 shadow-neon-cyan' :
            'border-border/15'
          }`}
        >
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0 border backdrop-blur-sm ${
            p.type === 'hot' ? 'bg-gold/10 border-gold/20' :
            p.type === 'cold' ? 'bg-neon-cyan/10 border-neon-cyan/20' :
            'bg-background/20 border-border/15'
          }`}>{p.emoji}</div>
          <div className="flex-1 min-w-0">
            <div className={`text-[10px] font-black leading-snug ${
              p.type === 'hot' ? 'text-gold' : p.type === 'cold' ? 'text-neon-cyan' : 'text-foreground/80'
            }`}>{p.title}</div>
            <p className="text-[8px] text-muted-foreground/50 mt-1 leading-relaxed">{p.detail}</p>
          </div>
          <div className={`shrink-0 text-[9px] font-black px-2 py-0.5 rounded-full border backdrop-blur-sm ${
            p.conf >= 80 ? 'bg-neon-green/10 text-neon-green border-neon-green/20' :
            p.conf >= 60 ? 'bg-gold/10 text-gold border-gold/20' :
            'bg-background/15 text-muted-foreground/50 border-border/15'
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
        <div className="glass rounded-xl border border-neon-purple/20 p-4 shadow-[0_0_12px_rgba(168,85,247,0.08)]">
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-neon-purple/20 to-neon-pink/10 border border-neon-purple/25 flex items-center justify-center shadow-[0_0_8px_rgba(168,85,247,0.2)]">
              <span className="text-sm">⚖️</span>
            </div>
            <div className="flex-1">
              <div className="text-[10px] font-black text-neon-purple uppercase tracking-[0.15em]">Juiz Supremo</div>
              <div className="text-[7px] text-neon-purple/50 font-mono">{ai.confidence}% confiança</div>
            </div>
            {ai.consensus > 0 && (
              <span className="text-[8px] px-2 py-0.5 rounded-full bg-neon-purple/10 text-neon-purple font-bold border border-neon-purple/20">
                {ai.consensus} consensos
              </span>
            )}
          </div>
          <p className="text-[8px] text-foreground/70 leading-relaxed">{ai.suggestedBet?.slice(0, 300)}</p>
          {ai.patternIdentified && (
            <div className="mt-2 px-2.5 py-1.5 rounded-lg glass border border-border/15">
              <p className="text-[7px] text-muted-foreground/60">🔍 {ai.patternIdentified?.slice(0, 120)}</p>
            </div>
          )}
          {ai.marketAnalysis?.bestMarket && (
            <div className="mt-2 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-neon-green/5 border border-neon-green/15">
              <span className="text-[9px] font-bold text-neon-green">📈 Melhor mercado: {ai.marketAnalysis.bestMarket}</span>
              <span className="text-[7px] text-muted-foreground/40 ml-auto font-mono">{ai.marketAnalysis.marketConfidence}%</span>
            </div>
          )}
        </div>
      )}

      {/* Top candidatos */}
      {topCands.length > 0 && (
        <div className="glass rounded-xl border border-border/20 p-4">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary/15 to-neon-pink/10 border border-primary/20 flex items-center justify-center shadow-neon-cyan">
              <span className="text-sm">🏆</span>
            </div>
            <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.15em]">Top Candidatos</h3>
          </div>
          <div className="space-y-2">
            {topCands.slice(0, 7).map((c: any, i: number) => {
              const max = topCands[0]?.score || 1;
              return (
                <div key={c.num} className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg text-[11px] font-black text-white flex items-center justify-center shrink-0 ${numBg(c.num)} ${i === 0 ? 'ring-2 ring-primary/60 ring-offset-1 ring-offset-background shadow-neon-cyan' : ''}`}>
                    {c.num}
                  </div>
                  <div className="flex-1">
                    <div className="h-1.5 bg-background/20 rounded-full overflow-hidden border border-border/10">
                      <div className={`h-full rounded-full transition-all ${i === 0 ? 'bg-gradient-to-r from-primary to-neon-pink shadow-neon-cyan' : i <= 2 ? 'bg-primary/60' : 'bg-muted-foreground/30'}`}
                        style={{ width: `${(c.score/max)*100}%` }} />
                    </div>
                    {c.reasons && (
                      <p className="text-[6px] text-muted-foreground/40 mt-0.5 truncate">{c.reasons.slice(0,4).join(' · ')}</p>
                    )}
                  </div>
                  <span className="text-[8px] font-mono text-muted-foreground/50 shrink-0 w-10 text-right">{c.score?.toFixed(0)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Layer scores */}
      {layers.total !== undefined && (
        <div className="glass rounded-xl border border-border/20 p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[10px] font-black text-neon-cyan uppercase tracking-[0.15em]">Score Total</h3>
            <span className="text-[11px] font-black font-mono text-primary">{layers.total} / {layers.max}</span>
          </div>
          <div className="h-2 bg-background/20 rounded-full overflow-hidden mb-3 border border-border/10">
            <div className="h-full bg-gradient-to-r from-primary via-neon-pink to-neon-purple rounded-full shadow-neon-cyan"
              style={{ width: `${(layers.total/layers.max)*100}%` }} />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {Object.entries(layers)
              .filter(([k, v]) => k.startsWith('bloco') && typeof v === 'object' && (v as any).label)
              .map(([k, v]: [string, any]) => (
                <div key={k} className="flex items-center gap-1.5">
                  <div className="w-1 h-5 rounded-full shrink-0 overflow-hidden bg-background/20">
                    <div className={`w-full rounded-full ${v.score/v.max > 0.7 ? 'bg-neon-green' : v.score/v.max > 0.4 ? 'bg-gold' : 'bg-destructive/50'}`}
                      style={{ height: `${(v.score/(v.max||1))*100}%` }} />
                  </div>
                  <span className="text-[7px] text-muted-foreground/50 truncate flex-1">{v.label}</span>
                  <span className="text-[7px] font-mono text-muted-foreground/40 shrink-0">{v.score}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Fidelidade de padrões */}
      {patterns.length > 0 && (
        <div className="glass rounded-xl border border-border/20 p-4">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-gold/15 to-amber-500/10 border border-gold/20 flex items-center justify-center">
              <span className="text-sm">🎯</span>
            </div>
            <h3 className="text-[10px] font-black text-gold uppercase tracking-[0.15em]">Fidelidade de Padrões</h3>
          </div>
          <div className="space-y-1.5 max-h-56 overflow-y-auto scrollbar-thin">
            {[...patterns]
              .sort((a: any, b: any) => b.fidelity - a.fidelity)
              .slice(0, 15)
              .map((p: any, i: number) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[9px] shrink-0">{p.emoji}</span>
                <span className="text-[7px] text-muted-foreground/50 flex-1 truncate">{p.name}</span>
                <div className="w-16 h-1.5 bg-background/20 rounded-full overflow-hidden shrink-0 border border-border/10">
                  <div className={`h-full rounded-full ${p.fidelity >= 70 ? 'bg-neon-green' : p.fidelity >= 40 ? 'bg-gold' : 'bg-destructive/50'}`}
                    style={{ width: `${p.fidelity}%` }} />
                </div>
                <span className="text-[7px] font-mono text-muted-foreground/40 w-8 text-right shrink-0">{p.fidelity}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Logs de aprendizado */}
      {learnings.length > 0 && (
        <div className="glass rounded-xl border border-border/20 p-4">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-neon-pink/15 to-purple-500/10 border border-neon-pink/20 flex items-center justify-center shadow-neon-pink">
              <span className="text-sm">📝</span>
            </div>
            <h3 className="text-[10px] font-black text-neon-pink uppercase tracking-[0.15em]">Log de Aprendizado <span className="text-muted-foreground/30 font-normal">({learnings.length})</span></h3>
          </div>
          <div className="space-y-1.5 max-h-52 overflow-y-auto scrollbar-thin">
            {learnings.map((l: string, i: number) => (
              <div key={i} className="px-2.5 py-1.5 rounded-lg glass border border-border/10">
                <span className="text-[8px] text-foreground/60 leading-snug">{l}</span>
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
  <div className="glass rounded-xl border border-border/15 overflow-hidden">
    <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-primary/5 transition-all group">
      <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
        <ChevronDown className="w-4 h-4 text-primary/40 group-hover:text-primary transition-colors" />
      </motion.div>
      <span className="font-display text-[11px] tracking-[0.12em] font-bold text-primary/70 group-hover:text-primary transition-colors">{title}</span>
      {badge && (
        <span className="text-[8px] px-2 py-0.5 rounded-full bg-primary/8 text-primary border border-primary/15 font-bold font-mono ml-auto">
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
