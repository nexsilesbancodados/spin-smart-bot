import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import { type RouletteNumber, type BotState, getNumberColor, generateRandomNumber, getHotNumbers, getColdNumbers } from '@/lib/roulette';

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

// Pattern detection
const detectPatterns = (history: RouletteNumber[]): Alert[] => {
  const alerts: Alert[] = [];
  if (history.length < 5) return alerts;

  // 1. Same color streak (5+)
  const recentColors = history.slice(0, 8).map(h => h.color);
  let streak = 1;
  for (let i = 1; i < recentColors.length; i++) {
    if (recentColors[i] === recentColors[0] && recentColors[0] !== 'green') streak++;
    else break;
  }
  if (streak >= 5) {
    const colorName = recentColors[0] === 'red' ? 'VERMELHO' : 'PRETO';
    alerts.push({
      id: `streak-${Date.now()}`,
      message: `🔥 ${streak}x ${colorName} seguidos! Possível reversão.`,
      type: 'streak',
      timestamp: new Date(),
    });
  }

  // 2. Dozen absence (8+ rounds)
  const recent8 = history.slice(0, 8).map(h => h.value);
  const d1 = recent8.some(v => v >= 1 && v <= 12);
  const d2 = recent8.some(v => v >= 13 && v <= 24);
  const d3 = recent8.some(v => v >= 25 && v <= 36);
  if (!d1) alerts.push({ id: `abs-d1-${Date.now()}`, message: '⚠️ Dúzia 1 ausente há 8+ rodadas!', type: 'absence', timestamp: new Date() });
  if (!d2) alerts.push({ id: `abs-d2-${Date.now()}`, message: '⚠️ Dúzia 2 ausente há 8+ rodadas!', type: 'absence', timestamp: new Date() });
  if (!d3) alerts.push({ id: `abs-d3-${Date.now()}`, message: '⚠️ Dúzia 3 ausente há 8+ rodadas!', type: 'absence', timestamp: new Date() });

  // 3. Column absence
  const c1 = recent8.some(v => v > 0 && ((v - 1) % 3) === 0);
  const c2 = recent8.some(v => v > 0 && ((v - 1) % 3) === 1);
  const c3 = recent8.some(v => v > 0 && ((v - 1) % 3) === 2);
  if (!c1) alerts.push({ id: `abs-c1-${Date.now()}`, message: '⚠️ Coluna 1 ausente há 8+ rodadas!', type: 'absence', timestamp: new Date() });
  if (!c2) alerts.push({ id: `abs-c2-${Date.now()}`, message: '⚠️ Coluna 2 ausente há 8+ rodadas!', type: 'absence', timestamp: new Date() });
  if (!c3) alerts.push({ id: `abs-c3-${Date.now()}`, message: '⚠️ Coluna 3 ausente há 8+ rodadas!', type: 'absence', timestamp: new Date() });

  // 4. Same terminal repeating (3+)
  if (history.length >= 3) {
    const terminals = history.slice(0, 4).map(h => h.value % 10);
    if (terminals[0] === terminals[1] && terminals[1] === terminals[2]) {
      alerts.push({
        id: `term-${Date.now()}`,
        message: `🎯 Terminal ${terminals[0]} saiu 3x seguidas!`,
        type: 'pattern',
        timestamp: new Date(),
      });
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
      alerts.push({
        id: `parity-${Date.now()}`,
        message: `🔄 ${parStreak}x ${parities[0] === 0 ? 'PAR' : 'ÍMPAR'} seguidos!`,
        type: 'streak',
        timestamp: new Date(),
      });
    }
  }

  return alerts;
};

export const RouletteProvider = ({ children }: { children: ReactNode }) => {
  const [history, setHistory] = useState<RouletteNumber[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [provider, setProvider] = useState('Playtech');
  const [table, setTable] = useState('Roleta Brasileira');
  const [autoMode, setAutoMode] = useState(false);
  const [autoSpeed, setAutoSpeedState] = useState(8); // seconds between numbers
  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const addNumber = useCallback((n: number) => {
    const entry: RouletteNumber = { value: n, color: getNumberColor(n), timestamp: new Date() };
    setHistory(prev => {
      const updated = [entry, ...prev];
      const newAlerts = detectPatterns(updated);
      if (newAlerts.length > 0) {
        setAlerts(prev => [...newAlerts, ...prev].slice(0, 10));
      }
      return updated;
    });
  }, []);

  const addNumbers = useCallback((nums: number[]) => {
    const entries = nums.map(n => ({
      value: n,
      color: getNumberColor(n),
      timestamp: new Date(),
    } as RouletteNumber));
    setHistory(prev => {
      const updated = [...entries.reverse(), ...prev];
      const newAlerts = detectPatterns(updated);
      if (newAlerts.length > 0) {
        setAlerts(prev => [...newAlerts, ...prev].slice(0, 10));
      }
      return updated;
    });
  }, []);

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
