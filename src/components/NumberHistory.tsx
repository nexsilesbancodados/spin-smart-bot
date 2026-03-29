import { type RouletteNumber } from '@/lib/roulette';

interface NumberHistoryProps {
  history: RouletteNumber[];
}

const NumberHistory = ({ history }: NumberHistoryProps) => {
  const colorClass = (color: string) =>
    color === 'red' ? 'bg-roulette-red' : color === 'black' ? 'bg-roulette-black' : 'bg-roulette-green';

  return (
    <div className="bg-card rounded-lg p-4 border border-border">
      <h3 className="font-display text-sm text-primary mb-3 tracking-wider uppercase">Últimos Números</h3>
      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
        {history.slice(0, 50).map((h, i) => (
          <div
            key={i}
            className={`${colorClass(h.color)} w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-foreground ${i === 0 ? 'ring-2 ring-accent animate-pulse-neon scale-110' : 'opacity-80'}`}
          >
            {h.value}
          </div>
        ))}
        {history.length === 0 && (
          <p className="text-muted-foreground text-sm">Nenhum número registrado ainda.</p>
        )}
      </div>
    </div>
  );
};

export default NumberHistory;
