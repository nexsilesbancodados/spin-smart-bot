import { useState, useEffect, useRef, useCallback, useMemo, memo, startTransition, lazy, Suspense } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import ManualInput from '@/components/ManualInput';
import SniperSignal from '@/components/SniperSignal';
import NumberDNADialog from '@/components/NumberDNADialog';
import { type StrategyId } from '@/lib/strategy-system';

const AIDebatePanel = lazy(() => import('@/components/AIDebatePanel'));

const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const WHEEL = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const VOISINS_PT = new Set([22,18,29,7,28,12,35,3,26,0,32,15,19,4,21,2,25]);
const TIERS_PT = new Set([27,13,36,11,30,8,23,10,5,24,16,33]);
const ORPHELINS_PT = new Set([1,20,14,31,9,17,34,6]);
const getSectorPT = (n: number) => VOISINS_PT.has(n) ? 'Voisins' : TIERS_PT.has(n) ? 'Tiers' : ORPHELINS_PT.has(n) ? 'Orphelins' : 'Zero';

const PULL: Record<number,number[]> = {0:[10,20,30,32,15,26,3,33,31,35],1:[11,35,16,4,18,28,27,29,33,14,31],2:[14,1,13,18,35,29,12,22],3:[13,27,6,11,30,8,23,33],4:[26,15,18,32,33,16,8,24,14],5:[3,33,16,24,10,18,15,25],6:[8,15,31,21,22,23,16,26],7:[16,18,17,30,31,28,12],8:[11,9,10,18,28,23],9:[34,35,36,3,16,26,23,24,32,31,29],10:[20,5,18,11,14,24,30],11:[8,18,16,21,30,1],12:[21,7,28,35],13:[31,27,36,6],14:[24,21,18,31,9],15:[4,19,21,32,0],16:[24,21,18,14,6,26],17:[34,6,25,27,7],18:[8,18,28,7],19:[9,19,29,4,21],20:[4,14,10,30],21:[19,2,4,23],22:[33,2,32,12],23:[32,11,2,33,13],24:[21,18,14,34,4],25:[2,4,17,28,29,12,7,18],26:[6,16,26,36,3,0],27:[28,29,24,22,26,33,31,34,35,36],28:[13,14,15,16,17,18,7],29:[35,28,22],30:[4,8,16,9,18,22,5,25,3],31:[13,9,14],32:[2,12,22,32,0,15],33:[16,3,23,13],34:[16,6,4,24],35:[0,3,7,12,26,28,29,35],36:[3,10,27,6]};

const DUPLICATE_SPIN_WINDOW_MS = 12000;
const SIGNAL_WINDOW_SECONDS = 18;
const POLL_INTERVAL_MS = 1000;
const HISTORY_SYNC_INTERVAL_MS = 15000;
const FRESHNESS_MAX_MS = 8000;

const numBg = (n: number) => n === 0 ? 'bg-emerald-600' : RED_NUMBERS.has(n) ? 'bg-red-600' : 'bg-zinc-800';

const playSound = (type: 'hit' | 'miss' | 'signal', enabled: boolean) => {
  if (!enabled) return;
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    if (type === 'hit') { osc.frequency.setValueAtTime(523, ctx.currentTime); osc.frequency.setValueAtTime(784, ctx.currentTime + 0.2); gain.gain.setValueAtTime(0.3, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5); osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.5); }
    else if (type === 'miss') { osc.frequency.setValueAtTime(200, ctx.currentTime); gain.gain.setValueAtTime(0.2, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3); osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3); }
    else { osc.frequency.setValueAtTime(440, ctx.currentTime); gain.gain.setValueAtTime(0.15, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25); osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.25); }
  } catch { /* no audio */ }
};

const getPrependedNumbers = (next: number[], previous: number[]) => {
  if (previous.length === 0) return next;
  const maxOffset = Math.min(12, next.length);
  for (let offset = 0; offset <= maxOffset; offset++) {
    const compareCount = Math.min(10, previous.length, next.length - offset);
    if (compareCount <= 0) continue;
    let matches = true;
    for (let i = 0; i < compareCount; i++) { if (next[offset + i] !== previous[i]) { matches = false; break; } }
    if (matches) return next.slice(0, offset);
  }
  return [];
};

// ═══════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════
const Index = () => {
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
  const [predStats, setPredStats] = useState({ hits: 0, misses: 0, exact: 0, total: 0 });
  const [historyLimit, setHistoryLimit] = useState(100);
  const [selectedNum, setSelectedNum] = useState<number | null>(null);
  const [dnaNumber, setDnaNumber] = useState<number | null>(null);
  const [dnaOpen, setDnaOpen] = useState(false);
  const [confidenceFilter] = useState(true);
  const [sampleSize] = useState(500);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [strategyFilter, setStrategyFilter] = useState<string>('all');
  const [soundEnabled] = useState(true);
  const [activeTab, setActiveTab] = useState<'sinal' | 'mesa' | 'padroes' | 'ia'>('sinal');
  const [lastSpinAt, setLastSpinAt] = useState<number | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  const rtRetryRef = useRef(0);

  const sniperFetchingRef = useRef(false);
  const lastSniperTriggerRef = useRef(0);
  const lastSpinSignatureRef = useRef('');
  const apiSnapshotRef = useRef<number[]>([]);
  const fetchSniperRef = useRef<((retryCount?: number, force?: boolean) => void) | null>(null);
  const lastAcceptedSpinRef = useRef<{ number: number | null; timestamp: number }>({ number: null, timestamp: 0 });
  const processedPredictionEventsRef = useRef<Record<string, number>>({});
  const spinCountSinceMicroLearnRef = useRef(0);

  const handleManualNumbers = (nums: number[]) => {
    apiSnapshotRef.current = [...nums, ...apiSnapshotRef.current].slice(0, 1000);
    setApiNumbers(prev => [...nums, ...prev].slice(0, 1000));
  };

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
      sniperFetchingRef.current = false;
      lastSniperTriggerRef.current = 0;
      const freshNumbers = apiSnapshotRef.current.slice(0, 500);
      supabase.functions.invoke('omni-core', { body: { numbers: freshNumbers } }).then(res => {
        if (res.data && res.data.mode === 'signal') {
          setSniperData((prev: any) => ({ ...(prev || {}), ...res.data, omniCore: true }));
        } else if (res.data?.mode === 'kill_switch') {
          setSniperData((prev: any) => ({ ...(prev || {}), killSwitch: true, killReason: res.data.message, temperature: res.data.temperature, agents: res.data.agents }));
        }
      }).catch(() => {});
      fetchSniperRef.current?.(0, true);
      supabase.functions.invoke('realtime-patterns').then(res => { if (res.data?.all_insights?.length > 0) setRtInsights(res.data.all_insights.slice(0, 6)); }).catch(() => {});
    }
  }, [soundEnabled, aiEnabled]);

  const triggerMicroLearn = useCallback(async () => {
    if (!aiEnabled) return;
    try { await Promise.allSettled([supabase.functions.invoke('auto-analyze-patterns'), supabase.functions.invoke('realtime-patterns'), supabase.functions.invoke('auto-recalibrate')]); } catch { /* */ }
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
      const res = await supabase.functions.invoke('sniper-predict', { body: { sampleSize, numbers: clientNums, strategyFilter: strategyFilter !== 'all' ? strategyFilter : undefined } });
      if (res.error) {
        if (retryCount < 2) { sniperFetchingRef.current = false; setTimeout(() => fetchSniper(retryCount + 1, force), 2000 * (retryCount + 1)); return; }
        setSniperData((prev: any) => prev ?? { signal: null, mode: 'error', message: '⚠️ Erro ao conectar', strategy: null });
      }
      if (res.data) {
        const key = `${res.data.strategy?.type}-${res.data.signal?.number}-${res.data.mode}`;
        if (key !== sniperPrevKey.current) { sniperPrevKey.current = key; sniperSameCount.current = 0; setSniperStale(false); }
        else { sniperSameCount.current++; if (sniperSameCount.current >= 6) setSniperStale(true); }
        setSniperData(res.data);
      }
    } catch (err) {
      if (retryCount < 2) { sniperFetchingRef.current = false; setTimeout(() => fetchSniper(retryCount + 1, force), 2000 * (retryCount + 1)); return; }
      setSniperData((prev: any) => prev ?? { signal: null, mode: 'error', message: '⚠️ Falha na conexão', strategy: null });
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
    if (spinCountSinceMicroLearnRef.current >= 10) { spinCountSinceMicroLearnRef.current = 0; triggerMicroLearn(); }
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
          apiSnapshotRef.current = nums; setApiNumbers(nums); setLastUpdate(new Date()); prevNumbersRef.current = key;
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
    const safetyTimeout = setTimeout(() => {
      setSniperData((prev: any) => { if (prev === null) { fetchSniperRef.current?.(0, true); return { signal: null, mode: 'loading', message: '🔄 Reconectando...', strategy: null }; } return prev; });
    }, 6000);
    return () => { clearInterval(liveInterval); clearInterval(historyInterval); clearTimeout(safetyTimeout); };
  }, [fetchNumbers, fetchStored, fetchSniper, isPolling]);

  // Realtime — roulette_numbers
  useEffect(() => {
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let currentChannel: ReturnType<typeof supabase.channel> | null = null;
    const connect = () => {
      if (currentChannel) { try { supabase.removeChannel(currentChannel); } catch {} currentChannel = null; }
      currentChannel = supabase.channel(`sniper_trigger_rt_${Date.now()}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'roulette_numbers' }, (payload: any) => {
          const row = payload?.new;
          if (typeof row?.number === 'number') {
            const spinAt = row.fetched_at ? new Date(row.fetched_at).getTime() : Date.now();
            if (Date.now() - spinAt > FRESHNESS_MAX_MS) return;
            registerLiveSpin(row.number, spinAt, `rt-${row.id ?? row.fetched_at ?? ''}`);
          }
        }).subscribe((status) => {
          if (status === 'SUBSCRIBED') { setRealtimeStatus('connected'); rtRetryRef.current = 0; }
          else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { setRealtimeStatus('disconnected'); retryTimeout = setTimeout(connect, Math.min(30000, 2000 * Math.pow(2, rtRetryRef.current++))); }
          else { setRealtimeStatus('connecting'); }
        });
    };
    connect();
    const heartbeat = setInterval(() => {
      if (realtimeStatus === 'connected' && lastUpdate && Date.now() - lastUpdate.getTime() > 60000) { setRealtimeStatus('connecting'); connect(); }
    }, 30000);
    return () => { if (retryTimeout) clearTimeout(retryTimeout); clearInterval(heartbeat); if (currentChannel) supabase.removeChannel(currentChannel); };
  }, [registerLiveSpin]);

  // Realtime — resultados_roleta
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
              if (Date.now() - insertedAt > FRESHNESS_MAX_MS) return;
              registerLiveSpin(num, insertedAt, `rt-res-${row.id ?? ''}`);
            }
          }
        }).subscribe((status) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') retryTimeout = setTimeout(connect, Math.min(30000, 2000 * Math.pow(2, Math.min(rtRetryRef.current, 5))));
        });
    };
    connect();
    return () => { if (retryTimeout) clearTimeout(retryTimeout); if (currentChannel) supabase.removeChannel(currentChannel); };
  }, [registerLiveSpin]);

  // Extension
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'NUMBER_FROM_EXTENSION') {
        const n = event.data.number;
        if (typeof n === 'number' && n >= 0 && n <= 36) registerLiveSpin(n, Date.now(), 'extension');
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [registerLiveSpin]);

  // Countdown
  useEffect(() => {
    if (!lastSpinAt) { setSniperCountdown(SIGNAL_WINDOW_SECONDS); return; }
    const update = () => setSniperCountdown(Math.max(0, SIGNAL_WINDOW_SECONDS - Math.floor((Date.now() - lastSpinAt) / 1000)));
    update();
    const timer = setInterval(update, 1000);
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
        if (phase === 0 || phase === 4) { setAutoLearnStatus('learning'); await supabase.functions.invoke('ai-learn'); }
        else if (phase === 1 || phase === 5) { setAutoLearnStatus('analyzing'); await supabase.functions.invoke('auto-analyze-patterns'); }
        else if (phase === 3 || phase === 7) { setAutoLearnStatus('analyzing'); await Promise.allSettled([supabase.functions.invoke('realtime-patterns'), phase === 7 ? supabase.functions.invoke('calibrate-constants') : Promise.resolve()]); }
        else if (phase === 8) { setAutoLearnStatus('analyzing'); await supabase.functions.invoke('markov-engine'); }
        else if (phase === 2 || phase === 6) { setAutoLearnStatus('analyzing'); await supabase.functions.invoke('omni-core', { body: { numbers: apiSnapshotRef.current.slice(0, 200) } }); }
        else { setAutoLearnStatus('backtesting'); await supabase.functions.invoke('sniper-predict', { body: { sampleSize: 50 } }); }
        autoLearnErrorCount.current = 0;
        consecutiveSuccessRef.current++;
        if (consecutiveSuccessRef.current >= 3) currentIntervalRef.current = Math.max(30_000, currentIntervalRef.current * 0.8);
      } catch (err: any) {
        autoLearnErrorCount.current++;
        consecutiveSuccessRef.current = 0;
        const msg = err?.message || String(err);
        if (/402|429|[Cc]redit|[Rr]ate/i.test(msg)) { currentIntervalRef.current = Math.min(600_000, currentIntervalRef.current * 3); if (autoLearnErrorCount.current >= 5) autoLearnDisabled.current = true; }
        else { currentIntervalRef.current = Math.min(300_000, currentIntervalRef.current * 1.5); }
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
      setAutoLearnStatus('learning'); await supabase.functions.invoke('ai-learn');
      setAutoLearnStatus('analyzing'); await supabase.functions.invoke('auto-analyze-patterns');
      setAutoLearnStatus('backtesting'); await supabase.functions.invoke('sniper-predict');
    } catch { /* */ }
    finally { setIsAnalyzing(false); setAutoLearnStatus('idle'); }
  };

  const allNumbers = useMemo(() => apiNumbers.length > 0 ? apiNumbers : storedNumbers, [apiNumbers, storedNumbers]);
  const historySlice = useMemo(() => allNumbers.slice(0, historyLimit), [allNumbers, historyLimit]);

  // Derived data
  let streakNum = allNumbers[0] ?? -1, streakLen = 1;
  for (let i = 1; i < allNumbers.length; i++) { if (allNumbers[i] === streakNum) streakLen++; else break; }
  const streakActive = streakLen >= 2;

  const termFreq20: Record<number,number> = {};
  allNumbers.slice(0,20).forEach(n => { termFreq20[n%10] = (termFreq20[n%10]||0)+1; });
  const hotTerm = Object.entries(termFreq20).sort(([,a],[,b])=>b-a)[0];

  const zeroIdx = allNumbers.indexOf(0);
  const zeroPressure = zeroIdx < 0 ? allNumbers.length : zeroIdx;

  const winPct = predStats.total > 0 ? Math.round(predStats.hits / predStats.total * 100) : null;

  // ═══════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">

      {/* ─── HEADER ─── */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-xl border-b border-border/30">
        <div className="max-w-lg mx-auto px-4">

          {/* Top bar */}
          <div className="flex items-center h-12 gap-3">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/25 flex items-center justify-center shrink-0">
                <span className="text-primary font-black text-xs font-display">S</span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-display font-black text-[11px] tracking-[0.2em] text-foreground">SPIN SMART</span>
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${realtimeStatus === 'connected' ? 'bg-primary animate-pulse' : realtimeStatus === 'connecting' ? 'bg-accent' : 'bg-destructive'}`} />
                  <span className="text-[7px] font-mono text-muted-foreground/50">
                    {realtimeStatus === 'connected' ? 'LIVE' : realtimeStatus === 'connecting' ? 'CONECTANDO' : 'OFFLINE'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {/* Stats */}
              {predStats.total > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-card/80 border border-border/20">
                  <span className="text-[9px] font-mono font-bold text-primary">{predStats.hits}✓</span>
                  <span className="text-[7px] text-muted-foreground/30">|</span>
                  <span className="text-[9px] font-mono font-bold text-destructive/60">{predStats.misses}✗</span>
                  {winPct !== null && (
                    <>
                      <span className="text-[7px] text-muted-foreground/30">|</span>
                      <span className={`text-[9px] font-mono font-black ${winPct >= 50 ? 'text-primary' : 'text-destructive/70'}`}>{winPct}%</span>
                    </>
                  )}
                </div>
              )}

              {/* AI Toggle */}
              <button
                onClick={() => setAiEnabled(v => !v)}
                className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black tracking-wider border transition-all active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
                  aiEnabled ? 'bg-primary/10 text-primary border-primary/25' : 'bg-muted/30 text-muted-foreground/50 border-border/20'
                }`}
                aria-pressed={aiEnabled}
                aria-label={aiEnabled ? 'Desligar IA' : 'Ligar IA'}
                tabIndex={0}
              >
                {aiEnabled ? '⚡ ON' : '○ OFF'}
              </button>
            </div>
          </div>

          {/* Number strip */}
          {allNumbers.length > 0 && (
            <div className="flex items-center gap-1 pb-2 overflow-x-auto scrollbar-none">
              {allNumbers.slice(0, 10).map((n, i) => (
                <button
                  key={`h${i}`}
                  onClick={() => { setDnaNumber(n); setDnaOpen(true); }}
                  className={`shrink-0 font-black text-white transition-all active:scale-90 flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${numBg(n)} ${
                    i === 0 ? 'w-9 h-9 rounded-xl text-sm ring-2 ring-primary/50 ring-offset-1 ring-offset-background shadow-lg shadow-primary/10' : 'w-7 h-7 rounded-lg text-[10px] opacity-70'
                  }`}
                  aria-label={`Ver DNA do número ${n}`}
                  tabIndex={0}
                >
                  {n}
                </button>
              ))}
              {streakActive && (
                <span className="shrink-0 ml-1 px-2 py-0.5 rounded-full bg-accent/15 border border-accent/30 text-accent text-[8px] font-black">
                  🔱 {streakNum}×{streakLen}
                </span>
              )}
            </div>
          )}

          {/* Tabs */}
          <div className="flex border-t border-border/15 -mx-4 px-4">
            {[
              { id: 'sinal', icon: '🎯', label: 'SINAL' },
              { id: 'mesa', icon: '📊', label: 'MESA' },
              { id: 'padroes', icon: '🔍', label: 'ANÁLISE' },
              { id: 'ia', icon: '🧠', label: 'IA' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[8px] font-black tracking-wider transition-all relative focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
                  activeTab === t.id ? 'text-primary' : 'text-muted-foreground/40 hover:text-muted-foreground/60'
                }`}
                aria-current={activeTab === t.id}
                aria-label={`Selecionar aba ${t.label}`}
                tabIndex={0}
              >
                <span className="text-[11px]">{t.icon}</span>
                <span>{t.label}</span>
                {activeTab === t.id && (
                  <motion.div layoutId="tab-indicator" className="absolute bottom-0 left-4 right-4 h-[2px] bg-primary rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ─── MAIN ─── */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-4">
        <AnimatePresence mode="wait">
          {/* ══ SINAL TAB ══ */}
          {activeTab === 'sinal' && (
            <motion.div key="sinal" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-3">
              <ManualInput onAddNumbers={handleManualNumbers} />

              {/* AI status */}
              {autoLearnStatus !== 'idle' && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/5 border border-primary/15">
                  <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ repeat: Infinity, duration: 1.2 }} className="w-2 h-2 rounded-full bg-primary" />
                  <span className="text-[9px] font-bold text-primary/70">
                    {autoLearnStatus === 'learning' ? 'Aprendendo...' : autoLearnStatus === 'analyzing' ? 'Analisando...' : 'Processando...'}
                  </span>
                </div>
              )}

              {/* Kill switch */}
              {sniperData?.killSwitch && (
                <div className="p-4 rounded-2xl bg-destructive/5 border border-destructive/25 text-center">
                  <div className="text-2xl mb-1">🛑</div>
                  <p className="text-[11px] font-black text-destructive">MESA DESFAVORÁVEL</p>
                  <p className="text-[9px] text-muted-foreground/60 mt-0.5">{sniperData.killReason}</p>
                </div>
              )}

              {/* Last result + Feedback */}
              <AnimatePresence mode="wait">
                {lastPredResult && lastPredResult.hit !== null && (
                  <motion.div key={`res${lastPredResult.actual}`}
                    initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                    className={`flex flex-col gap-2 px-4 py-3 rounded-2xl border ${
                      lastPredResult.hit ? 'bg-primary/5 border-primary/20' : 'bg-destructive/5 border-destructive/15'
                    }`}>
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{lastPredResult.hit ? '✅' : '❌'}</span>
                      <div className="flex-1 min-w-0">
                        <span className={`text-[11px] font-black ${lastPredResult.hit ? 'text-primary' : 'text-destructive'}`}>
                          {lastPredResult.hit ? 'ACERTOU!' : 'ERROU'}
                        </span>
                        <div className="text-[8px] text-muted-foreground/50 mt-0.5">
                          Saiu <b className="text-foreground">{lastPredResult.actual}</b> · Previsto #{lastPredResult.predicted}
                        </div>
                      </div>
                      <div className={`w-9 h-9 rounded-xl text-sm font-black text-white flex items-center justify-center ${numBg(lastPredResult.actual ?? 0)}`}>{lastPredResult.actual}</div>
                    </div>
                    {/* Painel de feedback */}
                    <UserSignalFeedback lastPredResult={lastPredResult} />
                  </motion.div>
                )}
              </AnimatePresence>
// Painel de feedback do usuário para sinais
import { useState as useStateReact } from 'react';
const UserSignalFeedback = ({ lastPredResult }: { lastPredResult: { hit: boolean | null; hitType: string | null; predicted: number | null; actual: number | null; label: string } }) => {
  const [feedback, setFeedback] = useStateReact<'bom' | 'ruim' | null>(null);
  const [sending, setSending] = useStateReact(false);
  const [sent, setSent] = useStateReact(false);
  const handleFeedback = async (type: 'bom' | 'ruim') => {
    setSending(true);
    try {
      // Envia feedback para Supabase (ajuste endpoint conforme backend)
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          predicted: lastPredResult.predicted,
          actual: lastPredResult.actual,
          hit: lastPredResult.hit,
          label: lastPredResult.label,
          timestamp: Date.now(),
        })
      });
      setFeedback(type);
      setSent(true);
    } catch {
      setFeedback(null);
    } finally {
      setSending(false);
    }
  };
  if (sent) return <div className="text-[8px] text-primary/70 font-bold mt-1">Obrigado pelo feedback!</div>;
  return (
    <div className="flex items-center gap-2 mt-1">
      <span className="text-[8px] text-muted-foreground/50">Feedback:</span>
      <button disabled={sending} onClick={() => handleFeedback('bom')} className={`px-2 py-0.5 rounded-lg text-[8px] font-bold border ${feedback === 'bom' ? 'bg-primary/20 text-primary border-primary/30' : 'bg-card text-primary border-primary/20 hover:bg-primary/10'} transition-all`}>
        👍 Bom
      </button>
      <button disabled={sending} onClick={() => handleFeedback('ruim')} className={`px-2 py-0.5 rounded-lg text-[8px] font-bold border ${feedback === 'ruim' ? 'bg-destructive/20 text-destructive border-destructive/30' : 'bg-card text-destructive border-destructive/20 hover:bg-destructive/10'} transition-all`}>
        👎 Ruim
      </button>
    </div>
  );
};

              {/* Sniper */}
              {aiEnabled ? (
                <SniperSignal
                  sniperData={sniperData} sniperCountdown={sniperCountdown} sniperStale={sniperStale}
                  lastPredResult={lastPredResult} confidenceFilter={confidenceFilter}
                  rtInsights={rtInsights} allNumbers={allNumbers} autoLearnStatus={autoLearnStatus}
                  strategyFilter={strategyFilter} setStrategyFilter={setStrategyFilter}
                />
              ) : (
                <div className="rounded-2xl border border-border/20 bg-card/50 p-14 text-center">
                  <div className="text-4xl mb-2 opacity-15">○</div>
                  <p className="text-sm font-bold text-muted-foreground/50">IA DESLIGADA</p>
                </div>
              )}

              {/* Quick stats */}
              {allNumbers.length >= 3 && (
                <div className="grid grid-cols-4 gap-2">
                  <QuickStat label="Puxados" value={(PULL[allNumbers[0]] || []).slice(0,3).join(' ')} sub={`do ${allNumbers[0]}`} accent />
                  <QuickStat label="Terminal" value={`T${hotTerm?.[0] ?? '?'}`} sub={`${hotTerm?.[1] ?? 0}×/20`} />
                  <QuickStat label="Zero" value={`${zeroPressure}g`} sub={zeroPressure > 40 ? '⚡ alto' : zeroPressure > 25 ? 'med' : 'ok'} accent={zeroPressure > 35} />
                  <QuickStat label="WR" value={winPct !== null ? `${winPct}%` : '—'} sub={`${predStats.total} total`} accent={winPct !== null && winPct >= 45} />
                </div>
              )}

              <button onClick={triggerLearn} disabled={isAnalyzing}
                className="w-full py-3 rounded-xl border border-border/20 bg-card/50 text-[10px] font-bold text-muted-foreground/60 hover:text-foreground hover:bg-card/80 transition-all disabled:opacity-30 active:scale-[0.98]">
                {isAnalyzing ? '🔄 Analisando...' : '⚡ Forçar análise'}
              </button>
            </motion.div>
          )}

          {/* ══ MESA TAB ══ */}
          {activeTab === 'mesa' && (
            <motion.div key="mesa" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">

              {/* Terminal bars */}
              <div className="bg-card/80 rounded-2xl border border-border/20 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">Terminal Bias</h3>
                  <span className="text-[7px] text-muted-foreground/30 font-mono">200 giros</span>
                </div>
                <TerminalBars allNumbers={allNumbers} />
              </div>

              {/* Frequency grid */}
              <div className="bg-card/80 rounded-2xl border border-border/20 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">Frequência</h3>
                  <div className="flex items-center gap-2 text-[7px] text-muted-foreground/30">
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-accent inline-block"/>quente</span>
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block"/>frio</span>
                  </div>
                </div>
                <NumberFreqGrid allNumbers={allNumbers} onSelect={(n) => { setDnaNumber(n); setDnaOpen(true); }} />
              </div>

              {/* History */}
              <div className="bg-card/80 rounded-2xl border border-border/20 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">Histórico</h3>
                  <div className="flex gap-1 ml-auto">
                    {[50, 100, 200].map(lim => (
                      <button key={lim} onClick={() => startTransition(() => { setHistoryLimit(lim); setSelectedNum(null); })}
                        className={`px-2 py-0.5 rounded-md text-[7px] font-bold transition-all ${historyLimit === lim ? 'bg-primary/15 text-primary' : 'bg-card text-muted-foreground/40'}`}>{lim}</button>
                    ))}
                  </div>
                </div>
                {selectedNum !== null && (
                  <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border/20">
                    <div className={`w-7 h-7 rounded-lg text-[10px] font-black text-white flex items-center justify-center ${numBg(selectedNum)}`}>{selectedNum}</div>
                    <span className="text-[8px] text-muted-foreground flex-1">
                      <b className="text-foreground">{historySlice.filter(n => n === selectedNum).length}×</b> em {historyLimit} · pull: [{(PULL[selectedNum] || []).slice(0,4).join(', ')}]
                    </span>
                    <button onClick={() => setSelectedNum(null)} className="text-muted-foreground/30 hover:text-muted-foreground text-sm">✕</button>
                  </div>
                )}
                {historySlice.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground/20 text-xs">Aguardando dados...</div>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {historySlice.map((n, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedNum(selectedNum === n ? null : n)}
                        className={`font-bold text-white transition-all flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${numBg(n)} ${
                          i === 0 ? 'w-8 h-8 rounded-xl text-[11px] ring-2 ring-primary/40 ring-offset-1 ring-offset-background' : 'w-7 h-7 rounded-lg text-[9px]'
                        } ${selectedNum === n ? 'ring-2 ring-accent ring-offset-1 ring-offset-background scale-110 z-10' : ''}
                        ${selectedNum !== null && selectedNum !== n ? 'opacity-15' : ''}`}
                        aria-label={`Selecionar número ${n} no histórico`}
                        tabIndex={0}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ══ ANÁLISE TAB ══ */}
          {activeTab === 'padroes' && (
            <motion.div key="padroes" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <PatternsTab allNumbers={allNumbers} sniperData={sniperData}
                streakNum={streakNum} streakLen={streakLen} streakActive={streakActive}
                zeroPressure={zeroPressure} hotTerm={hotTerm} numBg={numBg} />
            </motion.div>
          )}

          {/* ══ IA TAB ══ */}
          {activeTab === 'ia' && (
            <motion.div key="ia" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
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
// AUXILIARES
// ═══════════════════════════════

const QuickStat = memo(({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: boolean }) => (
  <div className="bg-card/80 rounded-xl border border-border/20 p-2.5 text-center">
    <div className="text-[7px] text-muted-foreground/40 uppercase font-bold tracking-wider mb-1">{label}</div>
    <div className={`text-[12px] font-black font-mono leading-none ${accent ? 'text-primary' : 'text-foreground'}`}>{value}</div>
    <div className="text-[7px] text-muted-foreground/30 mt-0.5">{sub}</div>
  </div>
));
QuickStat.displayName = 'QuickStat';

const RED_F = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

const TerminalBars = memo(({ allNumbers }: { allNumbers: number[] }) => {
  const data = useMemo(() => {
    const freq = Array(10).fill(0);
    allNumbers.slice(0, 200).forEach(n => freq[n % 10]++);
    const total = allNumbers.slice(0, 200).length;
    const exp = total / 10;
    const maxF = Math.max(...freq, 1);
    return freq.map((c, t) => ({ t, c, bias: exp > 0 ? Math.round((c - exp) / exp * 100) : 0, pct: Math.max(6, Math.round(c / maxF * 100)) }));
  }, [allNumbers.slice(0, 200).join(',')]);
  return (
    <div className="flex items-end gap-1.5" style={{ height: 80 }}>
      {data.map(({ t, c, bias, pct }) => (
        <div key={t} className="flex-1 flex flex-col items-center">
          {Math.abs(bias) > 20 && <div className={`text-[7px] font-mono font-bold leading-none mb-1 ${bias > 0 ? 'text-accent' : 'text-blue-400'}`}>{bias > 0 ? '+' : ''}{bias}%</div>}
          <div className="w-full flex-1 flex items-end">
            <div className={`w-full rounded-t-sm transition-all ${bias >= 50 ? 'bg-accent' : bias >= 20 ? 'bg-primary/70' : bias <= -30 ? 'bg-blue-500/40' : 'bg-muted-foreground/20'}`} style={{ height: `${pct}%`, minHeight: 4 }} />
          </div>
          <div className="text-[8px] font-mono font-bold text-foreground/60 mt-1">T{t}</div>
          <div className="text-[6px] text-muted-foreground/30">{c}</div>
        </div>
      ))}
    </div>
  );
});
TerminalBars.displayName = 'TerminalBars';

const NumberFreqGrid = memo(({ allNumbers, onSelect }: { allNumbers: number[]; onSelect: (n: number) => void }) => {
  const { freq, exp } = useMemo(() => {
    const f = Array(37).fill(0);
    allNumbers.forEach(n => { if (n >= 0 && n <= 36) f[n]++; });
    return { freq: f, exp: allNumbers.length / 37 };
  }, [allNumbers.length, allNumbers[0]]);
  return (
    <div className="grid grid-cols-10 gap-0.5">
      {Array.from({ length: 37 }, (_, n) => {
        const c = freq[n]; const hot = c > exp * 1.5; const cold = c < exp * 0.4;
        const op = allNumbers.length > 0 ? Math.max(0.2, Math.min(1, c / (exp * 1.6))) : 0.4;
        const bg = n === 0 ? 'bg-emerald-600' : RED_F.has(n) ? 'bg-red-600' : 'bg-zinc-700';
        return (
          <button key={n} onClick={() => onSelect(n)} title={`${n}: ${c}×`}
            className={`relative h-8 rounded text-[9px] font-black text-white transition-all hover:scale-110 hover:z-10 ${bg} ${hot ? 'ring-1 ring-accent/70' : cold && c === 0 ? 'ring-1 ring-blue-400/50' : ''}`}
            style={{ opacity: op }}>
            {n}
            {hot && <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-accent" />}
          </button>
        );
      })}
    </div>
  );
});
NumberFreqGrid.displayName = 'NumberFreqGrid';

const PatternsTab = memo(({ allNumbers, sniperData, streakNum, streakLen, streakActive, zeroPressure, hotTerm, numBg: numBgFn }: {
  allNumbers: number[]; sniperData: any; streakNum: number; streakLen: number;
  streakActive: boolean; zeroPressure: number; hotTerm: [string,number]|undefined;
  numBg: (n: number) => string;
}) => {
  const [selectedPattern, setSelectedPattern] = useState<string | null>(null);
  // Geração dos padrões
  const patterns = useMemo(() => {
    const list: any[] = [];
    if (allNumbers.length < 3) return list;
    if (streakActive) {
      const prob = Math.min(95, 50 + streakLen * 12);
      const pux = (PULL[streakNum] || []).slice(0, 4);
      list.push({ id: 'streak', emoji: '🔱', title: `STREAK ${streakNum} × ${streakLen}`,
        detail: `Repetiu ${streakLen}× seguidas. Cobrir: [${pux.join(', ')}]`,
        conf: prob, type: streakLen >= 4 ? 'high' : 'mid', numbers: [streakNum, ...pux].slice(0, 5),
        validate: (n: number) => n === streakNum });
    }
    if (hotTerm) {
      const [tStr, c] = hotTerm; const t = Number(tStr);
      const exp20 = allNumbers.slice(0, 20).length / 10;
      const bias = exp20 > 0 ? (c - exp20) / exp20 * 100 : 0;
      if (Math.abs(bias) > 25) {
        const tNums = Array.from({length: 4}, (_, i) => i * 10 + t).filter(n => n >= 0 && n <= 36);
        list.push({ id: 'term', emoji: bias > 0 ? '🔥' : '❄️',
          title: `Terminal T${t} ${bias > 0 ? 'QUENTE' : 'FRIO'}`,
          detail: `${bias > 0 ? `+${bias.toFixed(0)}% acima` : `${Math.abs(bias).toFixed(0)}% abaixo`} do esperado`,
          conf: Math.min(88, Math.abs(bias) > 60 ? 85 : 65), type: bias > 60 ? 'high' : 'mid', numbers: tNums,
          validate: (n: number) => tNums.includes(n) });
      }
    }
    if (zeroPressure >= 22) {
      const zeroNums = [0, 32, 15, 26, 3, 35, 12];
      list.push({ id: 'zero', emoji: '🟢', title: `Zero ausente — ${zeroPressure}g`,
        detail: `Média 37. ${zeroPressure > 55 ? 'CRÍTICO!' : zeroPressure > 37 ? 'Acima da média.' : 'Atenção.'}`,
        conf: Math.min(88, 35 + zeroPressure * 0.8), type: zeroPressure > 50 ? 'high' : 'mid',
        numbers: zeroNums, validate: (n: number) => zeroNums.includes(n) });
    }
    if (allNumbers.length > 0) {
      const pux = PULL[allNumbers[0]] || [];
      if (pux.length > 0) list.push({ id: 'pull', emoji: '🧲', title: `Puxados do ${allNumbers[0]}`,
        detail: `Frequentes: [${pux.slice(0,6).join(', ')}]`,
        conf: 68, type: 'mid', numbers: pux.slice(0, 6), validate: (n: number) => pux.includes(n) });
    }
    // Sector analysis
    const sc: Record<string,number> = {};
    allNumbers.slice(0,15).forEach(n => { const s = getSectorPT(n); sc[s]=(sc[s]||0)+1; });
    const topS = Object.entries(sc).sort(([,a],[,b])=>b-a)[0];
    if (topS && topS[1] >= 5) list.push({ id: 'sector', emoji: '🌍', title: `${topS[0]} dominante (${topS[1]}/15)`,
      detail: `Setor concentrou ${topS[1]} dos últimos 15.`, conf: 60, type: 'info', validate: (n: number) => getSectorPT(n) === topS[0] });
    // AI detected patterns
    const detectedPatterns = Array.isArray(sniperData?.detectedPatterns) ? sniperData.detectedPatterns : [];
    detectedPatterns.filter((p: any) => p.confidence >= 68).slice(0, 4).forEach((p: any) => {
      if (list.length >= 9) return;
      list.push({ id: `det_${p.name}`, emoji: p.emoji || '📊', title: p.name,
        detail: p.description + (p.action ? ` → ${p.action}` : ''), conf: p.confidence, type: p.confidence >= 80 ? 'mid' : 'info',
        numbers: Array.isArray(p.numbers) ? p.numbers : [], validate: (n: number) => Array.isArray(p.numbers) && p.numbers.includes(n),
        ia: p.ia, reasoning: p.reasoning });
    });
    // Agents
    const agents = Array.isArray(sniperData?.agents) ? sniperData.agents : [];
    agents.slice(0, 2).forEach((a: any) => {
      if (!a.signal || !a.numbers?.length || list.length >= 10) return;
      list.push({ id: `agent_${a.modelId}`, emoji: '🤖', title: `${a.modelName}: ${a.label}`,
        detail: a.reasoning?.slice(0, 120) || '', conf: a.confidence, type: a.confidence >= 72 ? 'mid' : 'info', numbers: Array.isArray(a.numbers) ? a.numbers.slice(0, 5) : [],
        validate: (n: number) => Array.isArray(a.numbers) && a.numbers.includes(n), ia: a.modelName, reasoning: a.reasoning });
    });
    return list.slice(0, 10);
  }, [allNumbers.slice(0, 20).join(','), sniperData?.detectedPatterns?.length, sniperData?.agents?.length, streakActive, zeroPressure]);

  // Validação visual: destaca ocorrências do padrão no histórico
  const historyHighlight = useMemo(() => {
    if (!selectedPattern) return [];
    const pat = patterns.find((p: any) => p.id === selectedPattern);
    if (!pat || !pat.validate) return [];
    return allNumbers.map((n, i) => pat.validate(n) ? i : -1).filter(i => i >= 0);
  }, [selectedPattern, patterns, allNumbers]);

  // Estatísticas do padrão selecionado
  const patternStats = useMemo(() => {
    if (!selectedPattern) return null;
    const pat = patterns.find((p: any) => p.id === selectedPattern);
    if (!pat || !pat.validate) return null;
    const total = allNumbers.length;
    const occurrences = allNumbers.filter(pat.validate).length;
    let streaks = 0, maxStreak = 0, curStreak = 0;
    for (let i = 0; i < allNumbers.length; i++) {
      if (pat.validate(allNumbers[i])) { curStreak++; maxStreak = Math.max(maxStreak, curStreak); }
      else { if (curStreak > 1) streaks++; curStreak = 0; }
    }
    if (curStreak > 1) streaks++;
    // Frequência por janela de 20
    const windowSize = 20;
    const freqByWindow = [];
    for (let i = 0; i < allNumbers.length; i += windowSize) {
      const win = allNumbers.slice(i, i + windowSize);
      freqByWindow.push(win.filter(pat.validate).length);
    }
    // Taxa de acerto (hit rate) se houver dados de acerto
    let hitRate = null;
    if (typeof sniperData?.predictionHistory === 'object' && Array.isArray(sniperData.predictionHistory)) {
      // predictionHistory: [{predicted, actual, hit, timestamp}]
      const relevant = sniperData.predictionHistory.filter((h: any) => pat.validate(h.predicted));
      const hits = relevant.filter((h: any) => h.hit === true).length;
      hitRate = relevant.length > 0 ? Math.round((hits / relevant.length) * 100) : null;
    }
    // Gráfico de evolução de acertos (últimos 20)
    let hitHistory: number[] = [];
    if (typeof sniperData?.predictionHistory === 'object' && Array.isArray(sniperData.predictionHistory)) {
      const relevant = sniperData.predictionHistory.filter((h: any) => pat.validate(h.predicted));
      hitHistory = relevant.slice(-20).map((h: any) => h.hit ? 1 : 0);
    }
    return { total, occurrences, pct: total > 0 ? Math.round(occurrences / total * 100) : 0, streaks, maxStreak, freqByWindow, hitRate, hitHistory };
  }, [selectedPattern, patterns, allNumbers, sniperData?.predictionHistory]);

  if (patterns.length === 0) return (
    <div className="bg-card/80 rounded-2xl border border-border/20 p-14 text-center">
      <div className="text-4xl mb-3 opacity-15">🔍</div>
      <p className="text-sm text-muted-foreground/40">Aguardando dados...</p>
    </div>
  );

  return (
    <div className="space-y-2">
      {patterns.map((p: any, i: number) => (
        <motion.div key={p.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
          className={`p-3.5 rounded-2xl border flex items-start gap-3 cursor-pointer ${
            p.type === 'high' ? 'bg-accent/5 border-accent/20' : p.type === 'mid' ? 'bg-primary/4 border-primary/15' :
            p.type === 'cold' ? 'bg-blue-500/5 border-blue-500/15' : 'bg-card/80 border-border/20'
          } ${selectedPattern === p.id ? 'ring-2 ring-primary/40' : ''}`}
          onClick={() => setSelectedPattern(selectedPattern === p.id ? null : p.id)}
        >
          <span className="text-xl shrink-0 mt-0.5">{p.emoji}</span>
          <div className="flex-1 min-w-0">
            <div className={`text-[10px] font-black leading-tight ${
              p.type === 'high' ? 'text-accent' : p.type === 'mid' ? 'text-primary' : p.type === 'cold' ? 'text-blue-400' : 'text-foreground'
            }`}>{p.title}</div>
            <p className="text-[8px] text-muted-foreground/50 mt-1 leading-relaxed">{p.detail}</p>
            {p.numbers?.length > 0 && (
              <div className="flex items-center gap-1 mt-2 flex-wrap">
                {p.numbers.slice(0, 6).map((n: number) => (
                  <div key={n} className={`w-6 h-6 rounded text-[9px] font-black text-white flex items-center justify-center ${numBgFn(n)}`}>{n}</div>
                ))}
              </div>
            )}
            {/* Integração IA: mostra qual IA detectou e raciocínio */}
            {p.ia && (
              <div className="mt-2 text-[7px] text-primary/80 font-mono">IA: {p.ia} <span className="text-muted-foreground/40">{p.reasoning?.slice(0, 80)}</span></div>
            )}
          </div>
          <span className={`shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded-full min-w-[36px] text-center ${
            p.conf >= 80 ? 'bg-primary/10 text-primary' : p.conf >= 60 ? 'bg-accent/10 text-accent' : 'bg-card text-muted-foreground/40'
          }`}>{p.conf}%</span>
        </motion.div>
      ))}

      {/* Se um padrão está selecionado, mostra incidência, estatísticas e gráfico */}
      {selectedPattern && (
        <div className="bg-card/80 rounded-2xl border border-primary/20 p-4 mt-2">
          <div className="text-[9px] font-black text-primary mb-2">Validação no histórico</div>
          <div className="flex flex-wrap gap-1 mb-2">
            {allNumbers.slice(0, 60).map((n, i) => (
              <span key={i} className={`w-6 h-6 rounded text-[9px] font-black flex items-center justify-center border transition-all ${
                historyHighlight.includes(i) ? 'bg-primary/80 text-white border-primary/80 scale-110 z-10' : numBgFn(n) + ' text-white border-border/20 opacity-40'
              }`} title={historyHighlight.includes(i) ? 'Ocorrência do padrão' : ''}>{n}</span>
            ))}
          </div>
          {patternStats && (
            <div className="mb-2 text-[8px] text-muted-foreground/60 flex flex-wrap gap-4">
              <span><b className="text-primary font-bold">{patternStats.occurrences}</b> ocorrências ({patternStats.pct}%)</span>
              <span><b className="text-primary font-bold">{patternStats.streaks}</b> streaks</span>
              <span>máx streak: <b className="text-primary font-bold">{patternStats.maxStreak}</b></span>
              <span>total analisado: {patternStats.total}</span>
              {patternStats.hitRate !== null && (
                <span className="text-primary font-bold">Hit rate: {patternStats.hitRate}%</span>
              )}
            </div>
          )}
          {/* Gráfico de evolução de acertos */}
          {patternStats && patternStats.hitHistory && patternStats.hitHistory.length > 0 && (
            <div className="mt-1 mb-2">
              <div className="text-[7px] text-muted-foreground/40 mb-1">Evolução dos últimos acertos</div>
              <div className="flex items-end gap-0.5 h-7">
                {patternStats.hitHistory.map((v, i) => (
                  <div key={i} className={`w-2 rounded ${v ? 'bg-primary' : 'bg-destructive/40'}`} style={{ height: v ? 20 : 7 }} />
                ))}
              </div>
            </div>
          )}
          {/* Gráfico de barras simples */}
          {patternStats && patternStats.freqByWindow.length > 1 && (
            <div className="mt-2">
              <div className="text-[7px] text-muted-foreground/40 mb-1">Ocorrências por janela de 20 giros</div>
              <div className="flex items-end gap-1 h-14">
                {patternStats.freqByWindow.map((v, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center">
                    <div className="w-4 rounded-t bg-primary/60" style={{ height: `${6 * v}px`, minHeight: 2 }} />
                    <div className="text-[7px] text-muted-foreground/40 mt-0.5">{v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="text-[7px] text-muted-foreground/40 mt-2">Ocorrências destacadas nos últimos 60 giros.</div>
        </div>
      )}
    </div>
  );
});
PatternsTab.displayName = 'PatternsTab';

const RED_IA = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const IATab = memo(({ sniperData }: { sniperData: any }) => {
  const numBgI = (n: number) => n === 0 ? 'bg-emerald-600' : RED_IA.has(n) ? 'bg-red-600' : 'bg-zinc-800';
  if (!sniperData) return (
    <div className="bg-card/80 rounded-2xl border border-border/20 p-14 text-center">
      <div className="text-4xl mb-3 opacity-15">🧠</div>
      <p className="text-sm text-muted-foreground/40">Aguardando análise...</p>
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
      <Suspense fallback={<div className="text-xs text-muted-foreground/40 text-center py-6">Carregando...</div>}>
        <AIDebatePanel
          agents={agents} consensusMap={sniperData.consensusMap}
          ensembleConsensus={sniperData.ensembleConsensus} fusionTop5={sniperData.fusionTop5}
          fusionConfidence={sniperData.fusionConfidence} entryAction={sniperData.entryAction}
          totalModels={sniperData.totalModels || 9} modelPerformance={sniperData.modelPerformance}
        />
      </Suspense>

      {ai.suggestedBet && (
        <div className="bg-violet-500/5 rounded-2xl border border-violet-500/15 p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">⚖️</span>
            <div>
              <div className="text-[9px] font-black text-violet-400 uppercase tracking-wider">Juiz Supremo</div>
              <div className="text-[7px] text-violet-400/40">{ai.confidence}% · {ai.consensus || 0} consensos</div>
            </div>
          </div>
          <p className="text-[8px] text-foreground/60 leading-relaxed">{ai.suggestedBet?.slice(0, 280)}</p>
        </div>
      )}

      {topCands.length > 0 && (
        <div className="bg-card/80 rounded-2xl border border-border/20 p-4">
          <h3 className="text-[9px] font-black text-muted-foreground/50 uppercase tracking-widest mb-3">Top Candidatos</h3>
          <div className="space-y-2">
            {topCands.slice(0, 7).map((c: any, i: number) => {
              const max = topCands[0]?.score || 1;
              return (
                <div key={c.num} className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg text-[11px] font-black text-white flex items-center justify-center shrink-0 ${numBgI(c.num)} ${i === 0 ? 'ring-2 ring-primary/60 ring-offset-1 ring-offset-background' : ''}`}>{c.num}</div>
                  <div className="flex-1 min-w-0">
                    <div className="h-1.5 bg-card rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${i === 0 ? 'bg-primary' : i <= 2 ? 'bg-primary/50' : 'bg-muted-foreground/20'}`} style={{ width: `${Math.round(c.score/max*100)}%` }} />
                    </div>
                    {c.reasons?.length > 0 && <p className="text-[6px] text-muted-foreground/30 truncate mt-0.5">{c.reasons.slice(0,3).join(' · ')}</p>}
                  </div>
                  <span className="text-[7px] font-mono text-muted-foreground/30 w-7 text-right">{c.score?.toFixed(0)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {layers.total !== undefined && (
        <div className="bg-card/80 rounded-2xl border border-border/20 p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[9px] font-black text-muted-foreground/50 uppercase tracking-widest">Score Total</h3>
            <span className="text-[11px] font-black font-mono text-primary">{layers.total}/{layers.max}</span>
          </div>
          <div className="h-1.5 bg-card rounded-full overflow-hidden mb-3">
            <div className="h-full bg-gradient-to-r from-primary to-accent rounded-full" style={{ width: `${Math.round(layers.total / layers.max * 100)}%` }} />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {Object.entries(layers).filter(([k, v]) => k.startsWith('bloco') && typeof v === 'object' && (v as any)?.label).map(([k, v]: [string, any]) => (
              <div key={k} className="flex items-center gap-1.5">
                <div className={`w-0.5 h-4 rounded-full shrink-0 ${v.score/v.max >= 0.7 ? 'bg-primary' : v.score/v.max >= 0.4 ? 'bg-accent' : 'bg-destructive/40'}`} />
                <span className="text-[7px] text-muted-foreground/40 flex-1 truncate">{v.label}</span>
                <span className="text-[7px] font-mono text-muted-foreground/30">{v.score}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {patterns.length > 0 && (
        <div className="bg-card/80 rounded-2xl border border-border/20 p-4">
          <h3 className="text-[9px] font-black text-muted-foreground/50 uppercase tracking-widest mb-3">Fidelidade de Padrões</h3>
          <div className="space-y-1.5 max-h-48 overflow-y-auto scrollbar-none">
            {[...patterns].sort((a: any, b: any) => b.fidelity - a.fidelity).slice(0, 12).map((p: any, i: number) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[9px] shrink-0">{p.emoji}</span>
                <span className="text-[7px] text-muted-foreground/40 flex-1 truncate">{p.name}</span>
                <div className="w-12 h-1 bg-card rounded-full overflow-hidden shrink-0">
                  <div className={`h-full rounded-full ${p.fidelity >= 70 ? 'bg-primary' : p.fidelity >= 40 ? 'bg-accent' : 'bg-destructive/30'}`} style={{ width: `${p.fidelity}%` }} />
                </div>
                <span className="text-[7px] font-mono text-muted-foreground/30 w-7 text-right">{p.fidelity}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {learnings.length > 0 && (
        <div className="bg-card/80 rounded-2xl border border-border/20 p-4">
          <h3 className="text-[9px] font-black text-muted-foreground/50 uppercase tracking-widest mb-3">Log ({learnings.length})</h3>
          <div className="space-y-1 max-h-48 overflow-y-auto scrollbar-none">
            {learnings.map((l: string, i: number) => (
              <div key={i} className="px-2.5 py-1.5 rounded-lg bg-card border border-border/10">
                <span className="text-[8px] text-foreground/40 leading-snug">{l}</span>
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
