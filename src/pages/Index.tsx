import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import PredictionHistory from '@/components/PredictionHistory';

const Index = () => {
  // Keep polling and auto-learn running in background
  const [apiNumbers, setApiNumbers] = useState<number[]>([]);
  const [storedNumbers, setStoredNumbers] = useState<number[]>([]);
  const [isPolling] = useState(true);
  const prevNumbersRef = useRef<string>('');
  const [sniperData, setSniperData] = useState<any>(null);
  const autoLearnRef = useRef<NodeJS.Timeout | null>(null);
  const autoLearnDisabled = useRef(false);
  const autoLearnErrorCount = useRef(0);

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
        }
      }
    } catch (err) {
      console.error('Fetch error:', err);
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
      if (res.data) setSniperData(res.data);
    } catch (err) { console.error('Sniper error:', err); }
  }, []);

  useEffect(() => {
    fetchSniper();
    if (!isPolling) return;
    const interval = setInterval(fetchSniper, 3000);
    return () => clearInterval(interval);
  }, [fetchSniper, isPolling]);

  // Auto-learn engine
  useEffect(() => {
    const cycleRef = { current: 0 };
    const runContinuousLearn = async () => {
      if (autoLearnDisabled.current) return;
      cycleRef.current++;
      try {
        if (cycleRef.current % 2 === 1) {
          await supabase.functions.invoke('ai-learn');
        } else {
          await supabase.functions.invoke('auto-analyze-patterns');
        }
      } catch (err: any) {
        autoLearnErrorCount.current++;
        const msg = err?.message || String(err);
        if (msg.includes('402') || msg.includes('429') || msg.includes('Credits') || msg.includes('credit')) {
          autoLearnDisabled.current = true;
        }
      }
    };
    const initialTimeout = setTimeout(runContinuousLearn, 20_000);
    autoLearnRef.current = setInterval(runContinuousLearn, 300_000);
    return () => { clearTimeout(initialTimeout); if (autoLearnRef.current) clearInterval(autoLearnRef.current); };
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1400px] mx-auto p-3">
          <PredictionHistory />
        </div>
      </div>
    </div>
  );
};

export default Index;
