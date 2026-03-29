import { type RouletteNumber } from '@/lib/roulette';
import { MessageSquare } from 'lucide-react';

interface NumberHistoryProps {
  history: RouletteNumber[];
}

const NumberHistory = ({ history }: NumberHistoryProps) => {
  const colorClass = (color: string) =>
    color === 'red' ? 'bg-roulette-red' : color === 'black' ? 'bg-roulette-black' : 'bg-roulette-green';

  return (
    <div className="bg-card rounded-lg p-4 border border-border">
      <div className="flex items-center justify-center gap-2 mb-3">
        <h3 className="font-display text-sm text-foreground tracking-wider">Histórico Rodadas</h3>
        <MessageSquare className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto justify-center">
        {history.slice(0, 60).map((h, i) => (
          <div
            key={i}
            className={`${colorClass(h.color)} w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-foreground transition-all ${
              i === 0 ? 'ring-2 ring-accent scale-110 shadow-lg' : ''
            }`}
          >
            {h.value}
          </div>
        ))}
        {history.length === 0 && (
          <p className="text-muted-foreground text-sm py-4">Toque nos números acima para registrar as rodadas</p>
        )}
      </div>
      {history.length > 0 && (
        <p className="text-xs text-muted-foreground text-center mt-2">
          {history.length} rodadas registradas
        </p>
      )}
    </div>
  );
};

export default NumberHistory;
