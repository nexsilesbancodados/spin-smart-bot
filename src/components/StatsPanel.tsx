import { getHotNumbers, getColdNumbers, getColorStats, type RouletteNumber } from '@/lib/roulette';
import { Flame, Snowflake } from 'lucide-react';

interface StatsPanelProps {
  history: RouletteNumber[];
}

const StatsPanel = ({ history }: StatsPanelProps) => {
  const hot = getHotNumbers(history);
  const cold = getColdNumbers(history);
  const colors = getColorStats(history);
  const total = history.length || 1;

  return (
    <div className="bg-card rounded-lg p-4 border border-border space-y-4">
      <h3 className="font-display text-sm text-primary tracking-wider uppercase">Estatísticas</h3>

      {/* Color distribution */}
      <div>
        <p className="text-xs text-muted-foreground mb-2">Distribuição de Cores</p>
        <div className="flex gap-2 h-4 rounded-full overflow-hidden">
          <div className="bg-roulette-red transition-all" style={{ width: `${(colors.red / total) * 100}%` }} />
          <div className="bg-roulette-black transition-all" style={{ width: `${(colors.black / total) * 100}%` }} />
          <div className="bg-roulette-green transition-all" style={{ width: `${(colors.green / total) * 100}%` }} />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>🔴 {colors.red} ({((colors.red / total) * 100).toFixed(0)}%)</span>
          <span>⚫ {colors.black} ({((colors.black / total) * 100).toFixed(0)}%)</span>
          <span>🟢 {colors.green} ({((colors.green / total) * 100).toFixed(0)}%)</span>
        </div>
      </div>

      {/* Hot numbers */}
      <div>
        <div className="flex items-center gap-1 mb-2">
          <Flame className="w-4 h-4 text-accent" />
          <p className="text-xs text-accent font-semibold">Números Quentes</p>
        </div>
        <div className="flex gap-2">
          {hot.map(h => (
            <div key={h.number} className="flex flex-col items-center">
              <span className="text-foreground font-bold text-sm">{h.number}</span>
              <span className="text-xs text-muted-foreground">{h.freq}x</span>
            </div>
          ))}
        </div>
      </div>

      {/* Cold numbers */}
      <div>
        <div className="flex items-center gap-1 mb-2">
          <Snowflake className="w-4 h-4 text-blue-400" />
          <p className="text-xs text-blue-400 font-semibold">Números Frios</p>
        </div>
        <div className="flex gap-2">
          {cold.map(c => (
            <div key={c.number} className="flex flex-col items-center">
              <span className="text-foreground font-bold text-sm">{c.number}</span>
              <span className="text-xs text-muted-foreground">{c.freq}x</span>
            </div>
          ))}
        </div>
      </div>

      <div className="text-xs text-muted-foreground pt-2 border-t border-border">
        Total de rodadas: <span className="text-foreground font-semibold">{history.length}</span>
      </div>
    </div>
  );
};

export default StatsPanel;
