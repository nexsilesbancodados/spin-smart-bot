import { useState, useEffect, useRef, useCallback, useMemo, memo, startTransition } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Activity, Brain, ChevronDown, GraduationCap, Sparkles, Power, MonitorPlay, Crosshair
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
import PatternPanel24h from '@/components/PatternPanel24h';
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

const DUPLICATE_SPIN_WINDOW_MS = 20000;
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
  const [sniperCountdown, setSniperCountdown] = useState(13);
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

  const handleManualNumbers = (nums: number[]) => {
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

  const handleNewSpin = useCallback((signature: string) => {
    if (!signature || signature === lastSpinSignatureRef.current) return;
    lastSpinSignatureRef.current = signature;
    sniperSameCount.current = 0;
    setSniperStale(false);
    setSniperCountdown(13);
    playSound('signal', soundEnabled);
    if (aiEnabled) {
      supabase.functions.invoke('realtime-patterns')
        .then(res => { if (res.data?.all_insights?.length > 0) setRtInsights(res.data.all_insights.slice(0, 6)); })
        .catch(() => {});
    }
  }, [soundEnabled, aiEnabled]);

  const triggerMicroLearn = useCallback(async () => {
    if (!aiEnabled) return;
    try { await Promise.allSettled([supabase.functions.invoke('auto-analyze-patterns'), supabase.functions.invoke('realtime-patterns')]); } catch { /* */ }
  }, [aiEnabled]);

  const fetchSniper = useCallback(async (retryCount = 0) => {
    const now = Date.now();
    if (now - lastSniperTriggerRef.current < 15000 && retryCount === 0) return;
    if (sniperFetchingRef.current && retryCount === 0) return;
    if (!aiEnabled) return;
    sniperFetchingRef.current = true;
    lastSniperTriggerRef.current = now;
    try {
      const clientNums = apiNumbers.length > 0 ? apiNumbers.slice(0, sampleSize) : undefined;
      const res = await supabase.functions.invoke('sniper-predict', {
        body: { sampleSize, numbers: clientNums, strategyFilter: strategyFilter !== 'all' ? strategyFilter : undefined }
      });
      if (res.error) {
        if (retryCount < 2) { sniperFetchingRef.current = false; setTimeout(() => fetchSniper(retryCount + 1), 2000 * (retryCount + 1)); return; }
      }
      if (res.data) {
        const key = `${res.data.strategy?.type}-${res.data.signal?.number}-${res.data.mode}`;
        if (key !== sniperPrevKey.current) { sniperPrevKey.current = key; sniperSameCount.current = 0; setSniperStale(false); }
        else { sniperSameCount.current++; if (sniperSameCount.current >= 3) setSniperStale(true); }
        setSniperData(res.data);
      }
    } catch (err) {
      if (retryCount < 2) { sniperFetchingRef.current = false; setTimeout(() => fetchSniper(retryCount + 1), 2000 * (retryCount + 1)); return; }
    } finally { sniperFetchingRef.current = false; }
  }, [sampleSize, aiEnabled, apiNumbers, strategyFilter]);

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
            handleNewSpin(nums.slice(0, 3).join(','));
            fetchSniper();
          }
          prevNumbersRef.current = key;
        }
        setError(null);
      }
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Erro'); }
  }, [fetchSniper, handleNewSpin, isBurstDuplicate, markAcceptedSpin]);

  const fetchStored = useCallback(async () => {
    const { data } = await supabase.from('roulette_numbers').select('number').order('fetched_at', { ascending: false }).limit(1000);
    if (data) setStoredNumbers(data.map((r: any) => r.number));
  }, []);

  // Polling
  useEffect(() => {
    fetchNumbers(); fetchStored(); fetchSniper();
    if (!isPolling) return;
    const interval = setInterval(() => { fetchNumbers(); fetchStored(); }, 3000);
    return () => clearInterval(interval);
  }, [fetchNumbers, fetchStored, fetchSniper, isPolling]);

  // Realtime trigger
  useEffect(() => {
    const ch = supabase.channel('sniper_trigger_rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'roulette_numbers' }, (payload: any) => {
        const row = payload?.new;
        if (typeof row?.number === 'number' && !isBurstDuplicate(row.number)) {
          markAcceptedSpin(row.number);
          apiSnapshotRef.current = [row.number, ...apiSnapshotRef.current].slice(0, 1000);
          setApiNumbers(prev => prev[0] === row.number ? prev : [row.number, ...prev].slice(0, 1000));
          handleNewSpin(`${row.number}-${row.fetched_at ?? ''}`);
          setLastUpdate(new Date());
          fetchSniper();
          spinCountSinceMicroLearnRef.current++;
          if (spinCountSinceMicroLearnRef.current >= 10) { spinCountSinceMicroLearnRef.current = 0; triggerMicroLearn(); }
        }
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchSniper, handleNewSpin, isBurstDuplicate, markAcceptedSpin, triggerMicroLearn]);

  // Extension message listener
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'NUMBER_FROM_EXTENSION') {
        const n = event.data.number;
        if (typeof n === 'number' && n >= 0 && n <= 36) setApiNumbers(prev => [n, ...prev].slice(0, 1000));
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // Countdown
  useEffect(() => {
    const timer = setInterval(() => setSniperCountdown(prev => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(timer);
  }, []);

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

  return (
    <div className="min-h-screen bg-gradient-casino flex flex-col">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-80 h-80 bg-primary/3 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-accent/3 rounded-full blur-[120px]" />
      </div>

      <Navbar
        isPolling={isPolling} setIsPolling={setIsPolling}
        isAnalyzing={isAnalyzing} triggerLearn={triggerLearn}
        confidenceFilter={confidenceFilter} setConfidenceFilter={setConfidenceFilter}
        lastUpdate={lastUpdate} fetchNumbers={fetchNumbers} fetchStored={fetchStored}
        autoLearnStatus={autoLearnStatus} onShowHistory={() => setShowPredHistory(!showPredHistory)}
        aiEnabled={aiEnabled} setAiEnabled={setAiEnabled}
        strategyFilter={strategyFilter} setStrategyFilter={setStrategyFilter}
        predStats={predStats} setPredStats={setPredStats}
        activePatternCount={activePatternCount}
      />

      {/* Prediction History */}
      <AnimatePresence>
        {showPredHistory && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-b border-border">
            <div className="max-w-[1400px] mx-auto p-3"><PredictionHistory /></div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto relative z-10">
        <div className="max-w-[1200px] mx-auto p-4 space-y-4">

          {/* ════ ÚLTIMOS NÚMEROS ════ */}
          <Last12Numbers allNumbers={allNumbers} />

          {/* ════ SNIPER SIGNAL + LOG LADO A LADO ════ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              {aiEnabled ? (
                <SniperSignal
                  sniperData={sniperData}
                  sniperCountdown={sniperCountdown}
                  sniperStale={sniperStale}
                  lastPredResult={lastPredResult}
                  confidenceFilter={confidenceFilter}
                  rtInsights={rtInsights}
                  allNumbers={allNumbers}
                />
              ) : (
                <div className="bg-card rounded-2xl border border-destructive/30 p-12 text-center h-full flex flex-col items-center justify-center">
                  <Power className="w-10 h-10 text-destructive/40 mb-3" />
                  <p className="text-sm font-bold text-destructive">IA DESLIGADA</p>
                  <p className="text-xs text-muted-foreground mt-1">Clique "IA ON" para reativar</p>
                </div>
              )}
            </div>
            <div className="lg:col-span-1 space-y-3">
              <AILearningLog allNumbers={allNumbers} sniperData={sniperData} autoLearnStatus={autoLearnStatus} rtInsights={rtInsights} />
              <ManualInput onAddNumbers={handleManualNumbers} />
            </div>
          </div>

          {/* ════ APRENDIZADO APLICADO ════ */}
          {sniperData?.learnedBetInfluence?.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="bg-card rounded-xl border border-emerald-500/30 p-4">
              <div className="flex items-center gap-2 mb-3">
                <GraduationCap className="w-4 h-4 text-emerald-400" />
                <span className="font-display text-[10px] tracking-[0.15em] font-bold text-emerald-400">APRENDIZADO → JOGADA</span>
                <span className="text-[8px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold ml-auto">
                  {sniperData.learnedBetInfluence.length} padrões
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {sniperData.learnedBetInfluence.slice(0, 6).map((inf: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-secondary/40 border border-border">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black shrink-0 ${colorClass(inf.num)}`}>{inf.num}</div>
                    <div className="min-w-0">
                      <span className="text-[8px] text-emerald-300 font-bold block truncate">{inf.source}</span>
                      <span className="text-[7px] text-muted-foreground">+{inf.boost}pts</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ════ AI INSIGHTS (sempre visível quando há dados) ════ */}
          {sniperData?.aiLearnings?.length > 0 && (
            <div className="bg-card rounded-xl border border-purple-500/20 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Brain className="w-4 h-4 text-purple-400" />
                <span className="font-display text-[10px] tracking-[0.15em] font-bold text-purple-400">ANÁLISE IA</span>
                <span className="text-[8px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 font-bold font-mono ml-auto">
                  {sniperData.aiLearnings.length} insights
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {sniperData.aiLearnings.slice(0, 8).map((learning: string, i: number) => (
                  <div key={i} className="flex items-start gap-1.5 px-2.5 py-2 rounded-lg bg-secondary/40 border border-border">
                    <Sparkles className="w-3 h-3 text-purple-400 mt-0.5 shrink-0" />
                    <span className="text-[9px] text-foreground/90 leading-tight">{learning}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ════ COLLAPSIBLE SECTIONS ════ */}
          <div className="space-y-2">

            {/* Ferramentas */}
            <CollapsibleSection
              title="🛠️ FERRAMENTAS"
              isOpen={activeSection === 'tools'}
              onToggle={() => toggleSection('tools')}
            >
              <div className="space-y-3">
                <ZeroPressure allNumbers={allNumbers} />
                <SessionSummary allNumbers={allNumbers} />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <WheelMap allNumbers={allNumbers} sniperData={sniperData} />
                  <BetPanel sniperData={sniperData} allNumbers={allNumbers} />
                </div>
              </div>
            </CollapsibleSection>

            {/* Rankings & Radar */}
            <CollapsibleSection
              title="📊 RANKINGS & RADAR"
              isOpen={activeSection === 'rankings'}
              onToggle={() => toggleSection('rankings')}
            >
              <div className="space-y-3">
                <StrategyLeaderboard />
                <PullRadar pullPatterns={sniperData?.pullPatterns || []} latestNumber={allNumbers[0] ?? 0} />
                <Scanner500 layerResults={sniperData?.layerResults || null} isScanning={false} />
                <PatternPanel24h sniperData={sniperData} />
              </div>
            </CollapsibleSection>

            {/* Histórico */}
            <CollapsibleSection
              title="📜 HISTÓRICO"
              badge={`${allNumbers.length} giros`}
              isOpen={activeSection === 'history'}
              onToggle={() => toggleSection('history')}
            >
              <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {[50, 100, 250, 500].map(lim => (
                    <button key={lim} onClick={() => startTransition(() => { setHistoryLimit(lim); setSelectedNum(null); })}
                      className={`text-[9px] px-2.5 py-1 rounded-lg font-bold transition-all ${
                        historyLimit === lim ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-secondary text-muted-foreground border border-border'
                      }`}>
                      {lim}
                    </button>
                  ))}
                  
                </div>

                {error && <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-2 text-[10px] text-destructive font-semibold">⚠️ {error}</div>}

                {historySlice.length === 0
                  ? <div className="text-center py-8 text-muted-foreground text-sm">Aguardando dados...</div>
                  : <HistoryGrid historySlice={historySlice} selectedNum={selectedNum} setSelectedNum={setSelectedNum} />
                }

                {/* Terminal frequency */}
                <div className="grid grid-cols-10 gap-1.5">
                  {Array.from({ length: 10 }, (_, t) => {
                    const count = allNumbers.slice(0, 200).filter(n => n % 10 === t).length;
                    const max = Math.max(...Array.from({ length: 10 }, (_, i) => allNumbers.slice(0, 200).filter(n => n % 10 === i).length), 1);
                    return (
                      <div key={t} className="text-center">
                        <div className="h-12 bg-secondary/30 rounded overflow-hidden flex flex-col justify-end">
                          <div className={`rounded-t transition-all ${count === max ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                            style={{ height: `${(count / max) * 100}%` }} />
                        </div>
                        <span className="text-[8px] font-mono font-bold text-foreground mt-1 block">T{t}</span>
                        <span className="text-[7px] text-muted-foreground">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CollapsibleSection>

            {/* Cassino ao vivo */}
            <CollapsibleSection
              title="🎰 CASSINO AO VIVO"
              isOpen={activeSection === 'casino'}
              onToggle={() => toggleSection('casino')}
            >
              <div>
                <div className="flex gap-2 mb-3">
                  {ROULETTE_TABLES.map(table => (
                    <button key={table.id} onClick={() => setSelectedTable(table)}
                      className={`px-3 py-1 rounded-lg text-[9px] font-bold transition-all border ${
                        selectedTable.id === table.id ? 'bg-primary/15 text-primary border-primary/30' : 'bg-secondary/40 text-muted-foreground border-border'
                      }`}>
                      {table.name}
                    </button>
                  ))}
                </div>
                <div className="w-full rounded-lg overflow-hidden" style={{ height: '500px' }}>
                  <iframe src={selectedTable.iframeUrl} className="w-full h-full border-0" allowFullScreen
                    allow="autoplay; fullscreen; microphone; camera"
                    sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-top-navigation" />
                </div>
              </div>
            </CollapsibleSection>
          </div>
        </div>
      </div>

      <NumberDNADialog number={dnaNumber} allNumbers={allNumbers} open={dnaOpen} onClose={() => setDnaOpen(false)} />
    </div>
  );
};

// Reusable collapsible section
const CollapsibleSection = memo(({ title, badge, isOpen, onToggle, children }: {
  title: string; badge?: string; isOpen: boolean; onToggle: () => void; children: React.ReactNode;
}) => (
  <div className="bg-card rounded-xl border border-border/60 overflow-hidden">
    <button onClick={onToggle} className="w-full flex items-center gap-2 px-4 py-3 hover:bg-primary/5 transition-colors">
      <ChevronDown className={`w-4 h-4 text-primary/60 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      <span className="font-display text-[10px] tracking-[0.15em] font-bold text-primary">{title}</span>
      {badge && (
        <span className="text-[7px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-bold font-mono ml-auto">
          {badge}
        </span>
      )}
    </button>
    <AnimatePresence>
      {isOpen && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
          <div className="p-4 border-t border-border/40">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
));

export default Index;
