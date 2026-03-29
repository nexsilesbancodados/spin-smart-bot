import { createContext, useContext, useState, useCallback, useRef, useEffect, useMemo, type ReactNode } from 'react';
import { type RouletteNumber, type BotState, getNumberColor, generateRandomNumber, getHotNumbers, getColdNumbers } from '@/lib/roulette';
import { supabase } from '@/integrations/supabase/client';

interface Alert {
  id: string;
  message: string;
  type: 'pattern' | 'streak' | 'absence';
  timestamp: Date;
}

interface RouletteContextType {
  history: RouletteNumber[];
  alerts: Alert[];
  provider: string;
  table: string;
  autoMode: boolean;
  autoSpeed: number;
  setProvider: (p: string) => void;
  setTable: (t: string) => void;
  addNumber: (n: number) => void;
  addNumbers: (nums: number[]) => void;
  clearHistory: () => void;
  dismissAlert: (id: string) => void;
  toggleAutoMode: () => void;
  setAutoSpeed: (speed: number) => void;
}

const RouletteContext = createContext<RouletteContextType | null>(null);

export const useRoulette = () => {
  const ctx = useContext(RouletteContext);
  if (!ctx) throw new Error('useRoulette must be inside RouletteProvider');
  return ctx;
};

// Pattern detection — deduplicates by alert type key
const detectPatterns = (history: RouletteNumber[], existingAlerts: Alert[]): Alert[] => {
  const newAlerts: Alert[] = [];
  if (history.length < 5) return newAlerts;

  // Existing alert keys for dedup (strip timestamp-based suffix)
  const existingKeys = new Set(existingAlerts.map(a => a.id.replace(/-\d+$/, '')));
  const addIfNew = (key: string, message: string, type: Alert['type']) => {
    if (!existingKeys.has(key)) {
      newAlerts.push({ id: `${key}-${Date.now()}`, message, type, timestamp: new Date() });
    }
  };

  // 1. Same color streak (5+)
  const recentColors = history.slice(0, 8).map(h => h.color);
  let streak = 1;
  for (let i = 1; i < recentColors.length; i++) {
    if (recentColors[i] === recentColors[0] && recentColors[0] !== 'green') streak++;
    else break;
  }
  if (streak >= 5) {
    const colorName = recentColors[0] === 'red' ? 'VERMELHO' : 'PRETO';
    addIfNew(`streak-${recentColors[0]}`, `🔥 ${streak}x ${colorName} seguidos! Possível reversão.`, 'streak');
  }

  // 2. Dozen absence (8+ rounds)
  const recent8 = history.slice(0, 8).map(h => h.value);
  const d1 = recent8.some(v => v >= 1 && v <= 12);
  const d2 = recent8.some(v => v >= 13 && v <= 24);
  const d3 = recent8.some(v => v >= 25 && v <= 36);
  if (!d1) addIfNew('abs-d1', '⚠️ Dúzia 1 ausente há 8+ rodadas!', 'absence');
  if (!d2) addIfNew('abs-d2', '⚠️ Dúzia 2 ausente há 8+ rodadas!', 'absence');
  if (!d3) addIfNew('abs-d3', '⚠️ Dúzia 3 ausente há 8+ rodadas!', 'absence');

  // 3. Column absence
  const c1 = recent8.some(v => v > 0 && ((v - 1) % 3) === 0);
  const c2 = recent8.some(v => v > 0 && ((v - 1) % 3) === 1);
  const c3 = recent8.some(v => v > 0 && ((v - 1) % 3) === 2);
  if (!c1) addIfNew('abs-c1', '⚠️ Coluna 1 ausente há 8+ rodadas!', 'absence');
  if (!c2) addIfNew('abs-c2', '⚠️ Coluna 2 ausente há 8+ rodadas!', 'absence');
  if (!c3) addIfNew('abs-c3', '⚠️ Coluna 3 ausente há 8+ rodadas!', 'absence');

  // 4. Same terminal repeating (3+)
  if (history.length >= 3) {
    const terminals = history.slice(0, 4).map(h => h.value % 10);
    if (terminals[0] === terminals[1] && terminals[1] === terminals[2]) {
      addIfNew(`term-${terminals[0]}`, `🎯 Terminal ${terminals[0]} saiu 3x seguidas!`, 'pattern');
    }
  }

  // 5. Parity streak (6+ even or odd)
  const parities = history.slice(0, 8).filter(h => h.value > 0).map(h => h.value % 2);
  if (parities.length >= 6) {
    let parStreak = 1;
    for (let i = 1; i < parities.length; i++) {
      if (parities[i] === parities[0]) parStreak++;
      else break;
    }
    if (parStreak >= 6) {
      addIfNew(`parity-${parities[0]}`, `🔄 ${parStreak}x ${parities[0] === 0 ? 'PAR' : 'ÍMPAR'} seguidos!`, 'streak');
    }
  }

  return newAlerts;
};

export const RouletteProvider = ({ children }: { children: ReactNode }) => {
  const [history, setHistory] = useState<RouletteNumber[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [provider, setProvider] = useState('Playtech');
  const [table, setTable] = useState('Roleta Brasileira');
  const [autoMode, setAutoMode] = useState(false);
  const [autoSpeed, setAutoSpeedState] = useState(8);
  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Dedup: track last added numbers with timestamps to prevent duplicates
  const lastAddedRef = useRef<{ value: number; time: number }[]>([]);
  const DEDUP_WINDOW_MS = 3000; // ignore same number within 3 seconds

  const isDuplicate = useCallback((n: number): boolean => {
    const now = Date.now();
    // Clean old entries
    lastAddedRef.current = lastAddedRef.current.filter(e => now - e.time < DEDUP_WINDOW_MS);
    // Check if this number was added recently
    if (lastAddedRef.current.some(e => e.value === n)) return true;
    lastAddedRef.current.push({ value: n, time: now });
    return false;
  }, []);

  const addNumber = useCallback((n: number) => {
    if (isDuplicate(n)) return; // skip duplicate within dedup window
    const entry: RouletteNumber = { value: n, color: getNumberColor(n), timestamp: new Date() };
    setHistory(prev => {
      const updated = [entry, ...prev];
      setTimeout(() => {
        setAlerts(currentAlerts => {
          const newAlerts = detectPatterns(updated, currentAlerts);
          if (newAlerts.length > 0) return [...newAlerts, ...currentAlerts].slice(0, 10);
          return currentAlerts;
        });
      }, 0);
      return updated;
    });
  }, [isDuplicate]);

  const addNumbers = useCallback((nums: number[]) => {
    const dedupedNums = nums.filter(n => !isDuplicate(n));
    if (dedupedNums.length === 0) return;
    const entries = dedupedNums.map(n => ({
      value: n,
      color: getNumberColor(n),
      timestamp: new Date(),
    } as RouletteNumber));
    setHistory(prev => {
      const updated = [...entries.reverse(), ...prev];
      setTimeout(() => {
        setAlerts(currentAlerts => {
          const newAlerts = detectPatterns(updated, currentAlerts);
          if (newAlerts.length > 0) return [...newAlerts, ...currentAlerts].slice(0, 10);
          return currentAlerts;
        });
      }, 0);
      return updated;
    });
  }, [isDuplicate]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    setAlerts([]);
  }, []);

  const dismissAlert = useCallback((id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  }, []);

  const toggleAutoMode = useCallback(() => {
    setAutoMode(prev => !prev);
  }, []);

  const setAutoSpeed = useCallback((speed: number) => {
    setAutoSpeedState(speed);
  }, []);

  // Auto mode: generate random numbers at interval
  useEffect(() => {
    if (autoMode) {
      autoRef.current = setInterval(() => {
        const num = generateRandomNumber();
        addNumber(num);
      }, autoSpeed * 1000);
    } else {
      if (autoRef.current) {
        clearInterval(autoRef.current);
        autoRef.current = null;
      }
    }
    return () => {
      if (autoRef.current) {
        clearInterval(autoRef.current);
        autoRef.current = null;
      }
    };
  }, [autoMode, autoSpeed, addNumber]);

  // Listen for external POST messages
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data?.type === 'roulette_result' || data?.event === 'game_state_round_finished') {
          const number = data.number ?? data.result ?? data.value ?? data.n;
          if (typeof number === 'number' && number >= 0 && number <= 36) {
            addNumber(number);
          }
        }
      } catch {}
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [addNumber]);

  // Supabase Realtime: listen for new inserts on historico_roleta
  useEffect(() => {
    const channel = supabase
      .channel('historico_roleta_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'historico_roleta' },
        (payload) => {
          const row = payload.new as { number: number; color: string };
          if (typeof row.number === 'number' && row.number >= 0 && row.number <= 36) {
            addNumber(row.number);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [addNumber]);

  // Supabase Realtime: listen for new inserts on resultados_roleta
  useEffect(() => {
    const channel = supabase
      .channel('resultados_roleta_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'resultados_roleta' },
        (payload) => {
          const row = payload.new as { numero: string; mesa: string };
          const num = parseInt(row.numero, 10);
          if (!isNaN(num) && num >= 0 && num <= 36) {
            addNumber(num);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [addNumber]);

  // Load 500+ recent numbers from ALL tables on mount
  useEffect(() => {
    const loadHistory = async () => {
      const [historicoRes, resultadosRes, rouletteRes] = await Promise.all([
        supabase.from('historico_roleta').select('number, created_at').order('created_at', { ascending: false }).limit(500),
        supabase.from('resultados_roleta').select('numero, created_at').order('created_at', { ascending: false }).limit(500),
        supabase.from('roulette_numbers').select('number, fetched_at').order('fetched_at', { ascending: false }).limit(500),
      ]);

      const all: { value: number; timestamp: Date }[] = [];
      const seen = new Set<string>();

      const addUnique = (val: number, ts: Date) => {
        const key = `${val}-${ts.getTime()}`;
        if (!seen.has(key) && val >= 0 && val <= 36) {
          seen.add(key);
          all.push({ value: val, timestamp: ts });
        }
      };

      (historicoRes.data || []).forEach(r => addUnique(r.number, new Date(r.created_at)));
      (resultadosRes.data || []).forEach(r => {
        const num = parseInt(r.numero, 10);
        if (!isNaN(num)) addUnique(num, new Date(r.created_at));
      });
      (rouletteRes.data || []).forEach(r => addUnique(r.number, new Date(r.fetched_at)));

      all.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      if (all.length > 0) {
        const entries: RouletteNumber[] = all.slice(0, 600).map(row => ({
          value: row.value,
          color: getNumberColor(row.value),
          timestamp: row.timestamp,
        }));
        setHistory(entries);
      }
    };
    loadHistory();
  }, []);

  return (
    <RouletteContext.Provider value={{
      history, alerts, provider, table, autoMode, autoSpeed,
      setProvider, setTable, addNumber, addNumbers, clearHistory, dismissAlert,
      toggleAutoMode, setAutoSpeed,
    }}>
      {children}
    </RouletteContext.Provider>
  );
};
