import { useState, useCallback, useRef, useEffect } from 'react';
import { generateRandomNumber, getNumberColor, getHotNumbers, type RouletteNumber, type BotState } from '@/lib/roulette';
import NumberHistory from '@/components/NumberHistory';
import StatsPanel from '@/components/StatsPanel';
import BotControls from '@/components/BotControls';
import ProfitChart from '@/components/ProfitChart';
import BetSuggestion from '@/components/BetSuggestion';
import QuickNumberPad from '@/components/QuickNumberPad';
import AnalysisFilter from '@/components/AnalysisFilter';
import PremiumTable from '@/components/PremiumTable';
import { CircleDot, Settings, ChevronDown, ClipboardPaste, X } from 'lucide-react';

const PROVIDERS: Record<string, { label: string; tables: string[] }> = {
  Playtech: {
    label: 'Playtech',
    tables: ['Roleta Brasileira', 'Mega Fire Blaze Roulette Live', 'Roulette'],
  },
  Evolution: {
    label: 'Evolution',
    tables: ['Roleta Immersiva', 'Roulette Evo', 'Roleta Relâmpago XXXtreme', 'Roleta ao Vivo'],
  },
  Pragmatic: {
    label: 'Pragmatic',
    tables: ['PowerUP Roulette', 'Roulette Macao', 'Brasileira Roleta'],
  },
};

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
  const [provider, setProvider] = useState('Playtech');
  const [table, setTable] = useState('Roleta Brasileira');
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<'roleta' | 'aulas' | 'bacbo'>('roleta');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fibIndex = useRef(0);

  const addNumber = useCallback((n: number) => {
    const entry: RouletteNumber = { value: n, color: getNumberColor(n), timestamp: new Date() };
    setHistory(prev => [entry, ...prev]);

    setBot(prev => {
      if (!prev.isRunning) return prev;
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
          if (won) fibIndex.current = Math.max(0, fibIndex.current - 2);
          else fibIndex.current++;
          const seq = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89];
          nextBet = prev.baseBet * (seq[Math.min(fibIndex.current, seq.length - 1)] || 1);
          break;
        }
        case 'dalembert':
          nextBet = won ? Math.max(prev.baseBet, prev.currentBet - prev.baseBet) : prev.currentBet + prev.baseBet;
          break;
        case 'pattern':
          nextBet = prev.baseBet;
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
    intervalRef.current = setInterval(() => addNumber(generateRandomNumber()), 1500);
  };

  const handleStop = () => {
    setBot(prev => ({ ...prev, isRunning: false }));
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  const hotNumbers = getHotNumbers(history, 10);

  return (
    <div className="min-h-screen bg-gradient-casino flex flex-col">
      {/* Navbar */}
      <nav className="bg-secondary border-b border-border px-4 py-2.5">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CircleDot className="w-5 h-5 text-primary animate-spin-slow" />
            <span className="font-display text-sm tracking-wider text-glow-green">ANALISES PARA ROLETA</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground px-2 py-0.5 bg-accent/20 rounded text-accent font-semibold">Free</span>
            <button onClick={() => setShowSettings(!showSettings)} className="p-1.5 rounded-md bg-card text-muted-foreground hover:text-foreground transition-colors">
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 max-w-2xl mx-auto w-full p-3 space-y-3 pb-16">
        {/* Provider & Table Selectors */}
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="flex">
            <div className="flex-1 relative border-r border-border">
              <select
                value={provider}
                onChange={e => {
                  setProvider(e.target.value);
                  setTable(PROVIDERS[e.target.value].tables[0]);
                }}
                className="w-full bg-card text-foreground text-sm font-semibold px-3 py-2.5 appearance-none cursor-pointer focus:outline-none"
              >
                <option value="" disabled>Selecione Provedor</option>
                {Object.entries(PROVIDERS).map(([key, p]) => (
                  <option key={key} value={key}>{p.label}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <div className="flex-1 relative">
              <select
                value={table}
                onChange={e => setTable(e.target.value)}
                className="w-full bg-card text-foreground text-sm font-semibold px-3 py-2.5 appearance-none cursor-pointer focus:outline-none"
              >
                {PROVIDERS[provider]?.tables.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
          <div className="bg-primary text-center py-1.5 text-xs font-bold text-primary-foreground tracking-wide">
            ⚡ {PROVIDERS[provider]?.label} • {table}
          </div>
        </div>

        {/* Premium Table */}
        <PremiumTable history={history} />

        {/* Analysis Filter */}
        <AnalysisFilter history={history} />

        {/* Quick Number Pad */}
        <QuickNumberPad onAddNumber={addNumber} />

        {/* Histórico Rodadas */}
        <NumberHistory history={history} />

        {/* Números Puxado */}
        <div className="bg-card rounded-lg p-4 border border-border">
          <h3 className="font-display text-sm text-foreground mb-3 tracking-wider text-center">Números Puxado</h3>
          <div className="flex flex-wrap gap-1.5 justify-center">
            {hotNumbers.length > 0 && history.length > 0 ? hotNumbers.map(h => {
              const color = getNumberColor(h.number);
              const colorClass = color === 'red' ? 'bg-roulette-red' : color === 'black' ? 'bg-roulette-black' : 'bg-roulette-green';
              return (
                <div key={h.number} className={`${colorClass} w-9 h-9 rounded-sm flex items-center justify-center text-xs font-bold text-foreground relative`}>
                  {h.number}
                  <span className="absolute -top-1 -right-1 bg-accent text-accent-foreground text-[8px] rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">
                    {h.freq}
                  </span>
                </div>
              );
            }) : (
              <p className="text-muted-foreground text-sm">Adicione números para ver os mais puxados</p>
            )}
          </div>
        </div>

        {/* Sinal de Aposta */}
        <BetSuggestion history={history} bot={bot} />

        {/* Stats */}
        <StatsPanel history={history} />

        {/* Settings Panel */}
        {showSettings && (
          <div className="space-y-3">
            <BotControls
              bot={bot}
              onStart={handleStart}
              onStop={handleStop}
              onStrategyChange={id => setBot(prev => ({ ...prev, strategy: id }))}
              onBaseBetChange={bet => setBot(prev => ({ ...prev, baseBet: bet, currentBet: bet }))}
            />
            <ProfitChart data={profitData} />
          </div>
        )}
      </main>

      {/* Footer Navigation */}
      <footer className="fixed bottom-0 left-0 right-0 bg-secondary border-t border-border">
        <div className="max-w-2xl mx-auto flex justify-around">
          {[
            { id: 'aulas' as const, icon: '📚', label: 'Aulas' },
            { id: 'roleta' as const, icon: '🎰', label: 'Roleta' },
            { id: 'bacbo' as const, icon: '🎲', label: 'BacBo' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center py-2 text-xs transition-colors ${
                activeTab === tab.id ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <span className="text-lg">{tab.icon}</span>
              <span className="font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </footer>
    </div>
  );
};

export default Index;
