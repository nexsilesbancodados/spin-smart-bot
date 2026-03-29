import { getNumberColor } from '@/lib/roulette';

interface QuickNumberPadProps {
  onAddNumber: (n: number) => void;
}

const ALL_NUMBERS = Array.from({ length: 37 }, (_, i) => i);

const QuickNumberPad = ({ onAddNumber }: QuickNumberPadProps) => {
  return (
    <div className="bg-card rounded-lg p-3 border border-border">
      <h3 className="font-display text-xs text-primary mb-2 tracking-wider uppercase text-center">Toque para Registrar</h3>
      <div className="grid grid-cols-10 gap-1">
        {ALL_NUMBERS.map(n => {
          const color = getNumberColor(n);
          const colorClass =
            color === 'red'
              ? 'bg-roulette-red hover:bg-roulette-red/80 active:scale-90'
              : color === 'black'
              ? 'bg-roulette-black hover:bg-roulette-black/80 active:scale-90'
              : 'bg-roulette-green hover:bg-roulette-green/80 active:scale-90';
          return (
            <button
              key={n}
              onClick={() => onAddNumber(n)}
              className={`${colorClass} aspect-square rounded-sm flex items-center justify-center text-xs font-bold text-foreground transition-transform`}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default QuickNumberPad;
