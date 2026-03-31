import { memo, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, ChevronDown, Zap } from 'lucide-react';
import { runAllStrategies, autoSelectStrategy, STRATEGY_LIST, type StrategyId, type StrategyConfig, type StrategyResult } from '@/lib/strategy-system';

interface Props {
  allNumbers: number[];
  betHistory: { won: boolean; amount: number; profit: number; timestamp: number }[];
  balance: number;
  baseBet: number;
  activeStrategy: StrategyId | 'auto';
  onSelectStrategy: (id: StrategyId | 'auto') => void;
}

const numBg = (n: number) => {
  const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
  return n === 0 ? 'bg-emerald-600' : RED.has(n) ? 'bg-red-600' : 'bg-zinc-800';
};

const StrategySelector = memo(({ allNumbers, betHistory, balance, baseBet, activeStrategy, onSelectStrategy }: Props) => {
  const [expanded, setExpanded] = useState(false);

  const cfg: StrategyConfig = useMemo(() => ({
    balance,
    baseBet,
    history: betHistory,
    allNumbers,
  }), [balance, baseBet, betHistory, allNumbers]);

  const allResults = useMemo(() => runAllStrategies(cfg), [cfg]);
  const autoSelected = useMemo(() => autoSelectStrategy(cfg), [cfg]);
  const activeResult = useMemo(() => {
    const id = activeStrategy === 'auto' ? autoSelected : activeStrategy;
    return allResults.find(r => r.id === id) || allResults[0];
  }, [activeStrategy, autoSelected, allResults]);

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Active strategy display */}
      <button onClick={() => setExpanded(!expanded)} className="w-full p-3 flex items-center gap-2">
        <Brain className="w-4 h-4 text-primary" />
        <div className="flex-1 text-left">
          <div className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">
            Estratégia {activeStrategy === 'auto' ? '(Auto)' : ''}
          </div>
          <div className="text-[11px] font-bold text-foreground flex items-center gap-1.5 mt-0.5">
            <span>{activeResult.emoji}</span>
            <span>{activeResult.name}</span>
            <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded ${
              activeResult.action === 'bet' || activeResult.action === 'increase' ? 'bg-green-500/10 text-green-400' :
              activeResult.action === 'wait' ? 'bg-amber-500/10 text-amber-400' :
              activeResult.action === 'decrease' ? 'bg-red-500/10 text-red-400' :
              'bg-secondary text-muted-foreground'
            }`}>
              ×{activeResult.betMultiplier.toFixed(1)}
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-[9px] font-mono font-bold ${activeResult.confidence >= 60 ? 'text-green-400' : 'text-amber-400'}`}>
            {activeResult.confidence}%
          </div>
          <div className={`text-[7px] px-1.5 py-0.5 rounded mt-0.5 ${
            activeResult.riskLevel === 'low' ? 'bg-green-500/10 text-green-400' :
            activeResult.riskLevel === 'high' ? 'bg-red-500/10 text-red-400' :
            'bg-amber-500/10 text-amber-400'
          }`}>
            {activeResult.riskLevel === 'low' ? '🟢' : activeResult.riskLevel === 'high' ? '🔴' : '🟡'} {activeResult.riskLevel}
          </div>
        </div>
        <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {/* Reason */}
      <div className="px-3 pb-2">
        <p className="text-[8px] text-muted-foreground">{activeResult.reason}</p>
        {activeResult.suggestedNumbers.length > 0 && (
          <div className="flex gap-0.5 mt-1.5">
            {activeResult.suggestedNumbers.slice(0, 5).map(n => (
              <div key={n} className={`w-6 h-6 rounded flex items-center justify-center text-[8px] font-bold text-white ${numBg(n)}`}>{n}</div>
            ))}
          </div>
        )}
      </div>

      {/* Expanded: all strategies */}
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="border-t border-border/50 p-3 space-y-1.5">
              {/* Auto option */}
              <button
                onClick={() => onSelectStrategy('auto')}
                className={`w-full flex items-center gap-2 p-2.5 rounded-lg border transition-all text-left ${
                  activeStrategy === 'auto'
                    ? 'bg-primary/10 border-primary/30 ring-1 ring-primary/20'
                    : 'bg-secondary/20 border-border/40 hover:border-border'
                }`}
              >
                <Zap className="w-4 h-4 text-primary" />
                <div className="flex-1">
                  <div className="text-[9px] font-black text-foreground">🤖 Auto-Seleção</div>
                  <div className="text-[7px] text-muted-foreground">IA escolhe a melhor estratégia automaticamente</div>
                </div>
                {activeStrategy === 'auto' && (
                  <span className="text-[7px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                    → {STRATEGY_LIST.find(s => s.id === autoSelected)?.name}
                  </span>
                )}
              </button>

              {/* Strategy list */}
              {allResults.map(result => {
                const info = STRATEGY_LIST.find(s => s.id === result.id)!;
                const isActive = activeStrategy === result.id;
                return (
                  <button
                    key={result.id}
                    onClick={() => onSelectStrategy(result.id)}
                    className={`w-full flex items-center gap-2 p-2.5 rounded-lg border transition-all text-left ${
                      isActive
                        ? 'bg-primary/10 border-primary/30 ring-1 ring-primary/20'
                        : 'bg-secondary/20 border-border/40 hover:border-border'
                    }`}
                  >
                    <span className="text-lg">{info.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[9px] font-bold text-foreground">{info.name}</div>
                      <div className="text-[7px] text-muted-foreground truncate">{info.desc}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`text-[9px] font-mono font-bold ${result.confidence >= 60 ? 'text-green-400' : 'text-amber-400'}`}>
                        {result.confidence}%
                      </div>
                      <div className="text-[7px] text-muted-foreground font-mono">×{result.betMultiplier.toFixed(1)}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

StrategySelector.displayName = 'StrategySelector';
export default StrategySelector;