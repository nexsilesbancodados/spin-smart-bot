import { useState, useCallback, useRef, useEffect } from 'react';
import { generateRandomNumber, getNumberColor, type RouletteNumber, type BotState } from '@/lib/roulette';
import RouletteBoard from '@/components/RouletteBoard';
import NumberHistory from '@/components/NumberHistory';
import StatsPanel from '@/components/StatsPanel';
import BotControls from '@/components/BotControls';
import ProfitChart from '@/components/ProfitChart';
import ManualInput from '@/components/ManualInput';
import { CircleDot } from 'lucide-react';

const INITIAL_BOT: BotState = {
  isRunning: false,
  strategy: 'martingale',
  currentBet: 5,
  baseBet: 5,
  balance: 1000,
  totalBets: 0,
  wins: 0,
  losses: 0,
  profitLoss: 0,
  sequence: [1, 1],
};

const Index = () => {
  const [history, setHistory] = useState<RouletteNumber[]>([]);
  const [bot, setBot] = useState<BotState>(INITIAL_BOT);
  const [profitData, setProfitData] = useState<{ round: number; profit: number }[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fibIndex = useRef(0);

  const addNumber = useCallback((n: number) => {
    const entry: RouletteNumber = { value: n, color: getNumberColor(n), timestamp: new Date() };
    setHistory(prev => [entry, ...prev]);

    setBot(prev => {
      if (!prev.isRunning) return prev;

      // Simple bet: always bet on red
      const won = entry.color === 'red';
      const payout = won ? prev.currentBet : -prev.currentBet;
      const newBalance = prev.balance + payout;
      const newPL = prev.profitLoss + payout;
      let nextBet = prev.baseBet;

      switch (prev.strategy) {
        case 'martingale':
          nextBet = won ? prev.baseBet : prev.currentBet * 2;
          break;
        case 'fibonacci': {
          if (won) {
            fibIndex.current = Math.max(0, fibIndex.current - 2);
          } else {
            fibIndex.current++;
          }
          const seq = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89];
          nextBet = prev.baseBet * (seq[Math.min(fibIndex.current, seq.length - 1)] || 1);
          break;
        }
        case 'dalembert':
          nextBet = won ? Math.max(prev.baseBet, prev.currentBet - prev.baseBet) : prev.currentBet + prev.baseBet;
          break;
        case 'pattern':
          nextBet = prev.baseBet; // simplified
          break;
      }

      const updated: BotState = {
        ...prev,
        balance: newBalance,
        profitLoss: newPL,
        totalBets: prev.totalBets + 1,
        wins: prev.wins + (won ? 1 : 0),
        losses: prev.losses + (won ? 0 : 1),
        currentBet: Math.min(nextBet, newBalance),
      };

      setProfitData(pd => [...pd, { round: pd.length + 1, profit: newPL }]);
      return updated;
    });
  }, []);

  const handleStart = () => {
    setBot(prev => ({ ...prev, isRunning: true }));
    fibIndex.current = 0;
    intervalRef.current = setInterval(() => {
      const n = generateRandomNumber();
      addNumber(n);
    }, 1500);
  };

  const handleStop = () => {
    setBot(prev => ({ ...prev, isRunning: false }));
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-casino">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CircleDot className="w-8 h-8 text-primary animate-spin-slow" />
            <div>
              <h1 className="font-display text-xl tracking-wider text-glow-green">ROULETTE ANALYZER</h1>
              <p className="text-xs text-muted-foreground">Sistema de Análise • Onabet</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${bot.isRunning ? 'bg-primary/10 text-primary border border-primary/30' : 'bg-secondary text-muted-foreground'}`}>
              <div className={`w-2 h-2 rounded-full ${bot.isRunning ? 'bg-primary animate-pulse-neon' : 'bg-muted-foreground'}`} />
              {bot.isRunning ? 'BOT ATIVO' : 'BOT INATIVO'}
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-4">
          <ManualInput onAddNumber={addNumber} onRandomNumber={() => addNumber(generateRandomNumber())} />
          <NumberHistory history={history} />
          <RouletteBoard lastNumbers={history.slice(0, 5).map(h => h.value)} onNumberClick={addNumber} />
          <ProfitChart data={profitData} />
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <BotControls
            bot={bot}
            onStart={handleStart}
            onStop={handleStop}
            onStrategyChange={id => setBot(prev => ({ ...prev, strategy: id }))}
            onBaseBetChange={bet => setBot(prev => ({ ...prev, baseBet: bet, currentBet: bet }))}
          />
          <StatsPanel history={history} />
        </div>
      </main>
    </div>
  );
};

export default Index;
