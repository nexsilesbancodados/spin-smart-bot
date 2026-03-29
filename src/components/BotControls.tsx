import { STRATEGIES, type BotState } from '@/lib/roulette';
import { Button } from '@/components/ui/button';
import { Play, Square, TrendingUp, TrendingDown, DollarSign, Target } from 'lucide-react';

interface BotControlsProps {
  bot: BotState;
  onStart: () => void;
  onStop: () => void;
  onStrategyChange: (id: string) => void;
  onBaseBetChange: (bet: number) => void;
}

const BotControls = ({ bot, onStart, onStop, onStrategyChange, onBaseBetChange }: BotControlsProps) => {
  const winRate = bot.totalBets > 0 ? ((bot.wins / bot.totalBets) * 100).toFixed(1) : '0.0';

  return (
    <div className="bg-card rounded-lg p-4 border border-border space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm text-primary tracking-wider uppercase">Bot Automático</h3>
        <div className={`w-2.5 h-2.5 rounded-full ${bot.isRunning ? 'bg-primary animate-pulse-neon' : 'bg-muted-foreground'}`} />
      </div>

      {/* Strategy selector */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Estratégia</label>
        <div className="grid grid-cols-2 gap-1.5">
          {STRATEGIES.map(s => (
            <button
              key={s.id}
              onClick={() => onStrategyChange(s.id)}
              className={`px-3 py-2 rounded-md text-xs font-medium transition-all ${
                bot.strategy === s.id
                  ? 'bg-primary text-primary-foreground shadow-neon-green'
                  : 'bg-secondary text-secondary-foreground hover:bg-muted'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {STRATEGIES.find(s => s.id === bot.strategy)?.description}
        </p>
      </div>

      {/* Base bet */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Aposta Base (R$)</label>
        <div className="flex gap-2">
          {[1, 5, 10, 25, 50].map(v => (
            <button
              key={v}
              onClick={() => onBaseBetChange(v)}
              className={`flex-1 py-1.5 rounded text-xs font-semibold transition-all ${
                bot.baseBet === v
                  ? 'bg-accent text-accent-foreground shadow-neon-gold'
                  : 'bg-secondary text-secondary-foreground hover:bg-muted'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-secondary rounded-md p-2.5">
          <div className="flex items-center gap-1 text-muted-foreground text-xs mb-0.5">
            <DollarSign className="w-3 h-3" />
            Saldo
          </div>
          <p className={`font-display text-sm ${bot.balance >= 0 ? 'text-primary' : 'text-destructive'}`}>
            R$ {bot.balance.toFixed(2)}
          </p>
        </div>
        <div className="bg-secondary rounded-md p-2.5">
          <div className="flex items-center gap-1 text-muted-foreground text-xs mb-0.5">
            <Target className="w-3 h-3" />
            Aposta Atual
          </div>
          <p className="font-display text-sm text-accent">R$ {bot.currentBet.toFixed(2)}</p>
        </div>
        <div className="bg-secondary rounded-md p-2.5">
          <div className="flex items-center gap-1 text-muted-foreground text-xs mb-0.5">
            {bot.profitLoss >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            Lucro/Perda
          </div>
          <p className={`font-display text-sm ${bot.profitLoss >= 0 ? 'text-primary' : 'text-destructive'}`}>
            R$ {bot.profitLoss.toFixed(2)}
          </p>
        </div>
        <div className="bg-secondary rounded-md p-2.5">
          <div className="flex items-center gap-1 text-muted-foreground text-xs mb-0.5">
            <Target className="w-3 h-3" />
            Taxa de Acerto
          </div>
          <p className="font-display text-sm text-foreground">{winRate}%</p>
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        Apostas: {bot.totalBets} | ✅ {bot.wins} | ❌ {bot.losses}
      </div>

      {/* Start/Stop */}
      <Button
        onClick={bot.isRunning ? onStop : onStart}
        className={`w-full font-display tracking-wider ${
          bot.isRunning
            ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'
            : 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-neon-green'
        }`}
      >
        {bot.isRunning ? <Square className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
        {bot.isRunning ? 'PARAR BOT' : 'INICIAR BOT'}
      </Button>
    </div>
  );
};

export default BotControls;
