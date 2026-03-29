import { useState, useEffect, useRef, useCallback } from 'react';
import { useRoulette } from '@/contexts/RouletteContext';
import { getNumberColor, getHotNumbers, getColdNumbers } from '@/lib/roulette';
import { getPremiumRow } from '@/lib/roulette-analysis';
import AlertBanner from '@/components/AlertBanner';
import PremiumTable from '@/components/PremiumTable';
import AIAnalysis from '@/components/AIAnalysis';
import DebugModal from '@/components/DebugModal';
import {
  CircleDot, ChevronDown, Flame, Snowflake,
  Hash, Activity, Zap, RefreshCw, Wifi, WifiOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

const getColor = (n: number): 'red' | 'black' | 'green' => {
  if (n === 0) return 'green';
  return RED_NUMBERS.includes(n) ? 'red' : 'black';
};

const colorClass = (n: number) => {
  const c = getColor(n);
  return c === 'red' ? 'bg-roulette-red' : c === 'black' ? 'bg-roulette-black' : 'bg-roulette-green';
};

const PROVIDERS: Record<string, { label: string; tables: string[] }> = {
  Playtech: {
    label: 'Playtech',
    tables: ['Roleta Brasileira', 'Mega Fire Blaze Roulette Live', 'Roulette'],
  },
  Evolution: {
    label: 'Evolution',
    tables: ['Roleta Immersiva', 'Roulette Evo', 'Roleta Relâmpago XXXtreme', 'Roleta ao Vivo'],
  },
};

const Index = () => {
  const { provider, table, setProvider, setTable, history } = useRoulette();
  const [apiNumbers, setApiNumbers] = useState<number[]>([]);
  const [isPolling, setIsPolling] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const prevNumbersRef = useRef<string>('');

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

  const fetchNumbers = useCallback(async () => {
    try {
      const res = await supabase.functions.invoke('proxy-roleta');
      if (res.error) throw new Error(res.error.message);
      const data = res.data;
      if (data?.results && Array.isArray(data.results)) {
        const nums = data.results.slice(0, 100).map((n: unknown) => Number(n)).filter((n: number) => !isNaN(n) && n >= 0 && n <= 36);
        const key = nums.join(',');
        if (key !== prevNumbersRef.current) {
          prevNumbersRef.current = key;
          setApiNumbers(nums);
          setLastUpdate(new Date());
        }
        setError(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar dados');
    }
  }, []);

  useEffect(() => {
    fetchNumbers();
    if (!isPolling) return;
    const interval = setInterval(fetchNumbers, 3000);
    return () => clearInterval(interval);
  }, [fetchNumbers, isPolling]);

  // Terminal analysis for last 100 numbers
  const terminalFreq = apiNumbers.reduce<Record<number, number>>((acc, n) => {
    const t = n % 10;
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});
  const maxTerminalFreq = Math.max(...Object.values(terminalFreq), 1);

  const redCount = apiNumbers.filter(n => getColor(n) === 'red').length;
  const blackCount = apiNumbers.filter(n => getColor(n) === 'black').length;
  const greenCount = apiNumbers.filter(n => getColor(n) === 'green').length;
  const total = apiNumbers.length || 1;

  // Group by terminal for "Números Puxados"
  const terminalGroups = apiNumbers.slice(0, 40).reduce<Record<number, number[]>>((acc, n) => {
    const t = n % 10;
    if (!acc[t]) acc[t] = [];
    acc[t].push(n);
    return acc;
  }, {});

  // Hot/Cold from API numbers
  const freqMap = apiNumbers.reduce<Record<number, number>>((acc, n) => {
    acc[n] = (acc[n] || 0) + 1;
    return acc;
  }, {});
  const sorted = Object.entries(freqMap).map(([n, f]) => ({ number: Number(n), freq: f })).sort((a, b) => b.freq - a.freq);
  const hotNums = sorted.slice(0, 8);
  const coldNums = sorted.slice(-8).reverse();

  // Split 100 numbers into rows of 20
  const rows: number[][] = [];
  for (let i = 0; i < apiNumbers.length; i += 20) {
    rows.push(apiNumbers.slice(i, i + 20));
  }

  return (
    <div className="h-screen bg-gradient-casino flex flex-col overflow-hidden">
      {/* Top Navbar */}
      <nav className="bg-card/90 backdrop-blur-md border-b border-border px-4 py-2 z-50 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CircleDot className="w-5 h-5 text-primary animate-spin-slow" />
            <span className="font-display text-xs tracking-widest text-glow-cyan">ROULETTE ANALYTICS</span>
            <span className="text-[9px] px-2 py-0.5 bg-accent/20 rounded-full text-accent font-bold border border-accent/30">PRO</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsPolling(!isPolling)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-bold transition-all ${
                isPolling ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-destructive/20 text-destructive border border-destructive/30'
              }`}
            >
              {isPolling ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {isPolling ? 'AO VIVO' : 'PAUSADO'}
            </button>
            <button
              onClick={fetchNumbers}
              className="p-1.5 text-muted-foreground hover:text-primary transition-colors rounded-md hover:bg-secondary"
              title="Atualizar agora"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            {lastUpdate && (
              <span className="text-[9px] text-muted-foreground font-mono">
                {lastUpdate.toLocaleTimeString('pt-BR')}
              </span>
            )}
            <div className={`w-2 h-2 rounded-full ${isPolling ? 'bg-primary animate-pulse shadow-neon-cyan' : 'bg-muted'}`} />
          </div>
        </div>
      </nav>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT SIDEBAR */}
        <aside className="flex flex-col w-[300px] border-r border-border bg-card/50 backdrop-blur-sm shrink-0">
          {/* Provider/Table Selectors */}
          <div className="shrink-0 border-b border-border">
            <div className="flex">
              <div className="flex-1 relative border-r border-border">
                <select
                  value={provider}
                  onChange={e => {
                    setProvider(e.target.value);
                    setTable(PROVIDERS[e.target.value].tables[0]);
                  }}
                  className="w-full bg-transparent text-foreground text-[11px] font-semibold px-3 py-2 appearance-none cursor-pointer focus:outline-none"
                >
                  {Object.entries(PROVIDERS).map(([key, p]) => (
                    <option key={key} value={key} className="bg-card">{p.label}</option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 text-muted-foreground absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <div className="flex-1 relative">
                <select
                  value={table}
                  onChange={e => setTable(e.target.value)}
                  className="w-full bg-transparent text-foreground text-[11px] font-semibold px-3 py-2 appearance-none cursor-pointer focus:outline-none"
                >
                  {PROVIDERS[provider]?.tables.map(t => (
                    <option key={t} value={t} className="bg-card">{t}</option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 text-muted-foreground absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
            <div className="flex items-center justify-between px-3 py-1.5 bg-primary/5 border-t border-primary/10">
              <div className="flex items-center gap-2">
                <Zap className="w-3 h-3 text-primary" />
                <span className="text-[9px] font-bold text-primary tracking-wider font-display">
                  {PROVIDERS[provider]?.label} • {table}
                </span>
              </div>
              <span className="text-[9px] text-muted-foreground font-mono">{apiNumbers.length} números</span>
            </div>
          </div>

          {/* Scrollable sidebar content */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {error && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-2 text-[10px] text-destructive font-semibold">
                ⚠️ {error}
              </div>
            )}

            {/* Color Distribution */}
            {apiNumbers.length > 0 && (
              <div className="bg-card rounded-lg border border-border p-3">
                <div className="flex gap-1 h-3 rounded-full overflow-hidden mb-2">
                  <motion.div animate={{ width: `${(redCount / total) * 100}%` }} className="bg-roulette-red" transition={{ duration: 0.5 }} />
                  <motion.div animate={{ width: `${(blackCount / total) * 100}%` }} className="bg-roulette-black" transition={{ duration: 0.5 }} />
                  <motion.div animate={{ width: `${(greenCount / total) * 100}%` }} className="bg-roulette-green" transition={{ duration: 0.5 }} />
                </div>
                <div className="flex justify-between text-[9px] font-mono text-muted-foreground">
                  <span className="text-roulette-red">🔴 {redCount} ({((redCount / total) * 100).toFixed(0)}%)</span>
                  <span>⚫ {blackCount} ({((blackCount / total) * 100).toFixed(0)}%)</span>
                  <span className="text-roulette-green">🟢 {greenCount}</span>
                </div>
              </div>
            )}

            {/* Hot & Cold Numbers */}
            {apiNumbers.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-card rounded-lg border border-border p-2.5">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Flame className="w-3.5 h-3.5 text-destructive" />
                    <span className="font-display text-[9px] text-destructive tracking-widest">QUENTES</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {hotNums.map(h => (
                      <div key={h.number} className={`${colorClass(h.number)} w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold text-foreground relative`}>
                        {h.number}
                        <span className="absolute -top-1 -right-1 bg-destructive text-foreground text-[7px] rounded-full w-3 h-3 flex items-center justify-center font-bold">
                          {h.freq}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-card rounded-lg border border-border p-2.5">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Snowflake className="w-3.5 h-3.5 text-primary" />
                    <span className="font-display text-[9px] text-primary tracking-widest">FRIOS</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {coldNums.map(h => (
                      <div key={h.number} className={`${colorClass(h.number)} w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold text-foreground opacity-50`}>
                        {h.number}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Números Puxados */}
            {apiNumbers.length > 0 && (
              <div className="bg-card rounded-lg border border-border p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Hash className="w-3.5 h-3.5 text-accent" />
                  <span className="font-display text-[9px] text-accent tracking-widest">NÚMEROS PUXADOS</span>
                </div>
                <div className="space-y-1.5 max-h-44 overflow-y-auto">
                  {Object.entries(terminalGroups).sort(([a], [b]) => Number(a) - Number(b)).map(([terminal, nums]) => (
                    <div key={terminal} className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-accent w-8 shrink-0 font-display">T{terminal}</span>
                      <div className="flex flex-wrap gap-0.5">
                        {nums.slice(0, 10).map((n, i) => (
                          <span key={`${n}-${i}`} className={`${colorClass(n)} w-6 h-6 rounded text-[9px] font-bold text-foreground flex items-center justify-center`}>
                            {n}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Alerts */}
            <AlertBanner />
          </div>
        </aside>

        {/* CENTER - Main Content */}
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-4 space-y-4">
          {/* Histórico de Roleta - 100 números em linhas de 20 */}
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                <span className="font-display text-sm text-primary tracking-widest">HISTÓRICO DE ROLETA</span>
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">
                Últimos {apiNumbers.length} números • Atualização a cada 3s
              </span>
            </div>

            {apiNumbers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Aguardando dados da API...
              </div>
            ) : (
              <div className="space-y-1.5">
                {rows.map((row, rowIdx) => (
                  <div key={rowIdx} className="flex gap-1 flex-wrap">
                    <AnimatePresence mode="popLayout">
                      {row.map((n, i) => (
                        <motion.div
                          key={`${rowIdx}-${i}-${n}`}
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={{ duration: 0.2, delay: i * 0.01 }}
                          className={`${colorClass(n)} w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold text-foreground shadow-md hover:scale-110 transition-transform cursor-default`}
                        >
                          {n}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Análise de Terminais */}
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 mb-3">
              <Hash className="w-4 h-4 text-accent" />
              <span className="font-display text-sm text-accent tracking-widest">ANÁLISE DE TERMINAIS</span>
            </div>

            <div className="grid grid-cols-10 gap-2">
              {Array.from({ length: 10 }, (_, t) => {
                const freq = terminalFreq[t] || 0;
                const pct = maxTerminalFreq > 0 ? (freq / maxTerminalFreq) * 100 : 0;
                return (
                  <div key={t} className="flex flex-col items-center gap-1">
                    <div className="w-full bg-secondary rounded-full h-24 flex flex-col-reverse overflow-hidden relative">
                      <motion.div
                        className="bg-gradient-to-t from-primary to-accent rounded-full"
                        animate={{ height: `${pct}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                    <span className="text-[11px] font-bold text-foreground font-display">{t}</span>
                    <span className="text-[9px] text-muted-foreground font-mono">{freq}x</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI Analysis */}
          <AIAnalysis />
        </div>
      </div>

      <DebugModal />
    </div>
  );
};

export default Index;
