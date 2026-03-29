import { getNumberColor, type RouletteColor } from '@/lib/roulette';

interface RouletteBoardProps {
  lastNumbers: number[];
  onNumberClick?: (n: number) => void;
}

const NumberCell = ({ value, onClick, isRecent }: { value: number; onClick?: () => void; isRecent: boolean }) => {
  const color = getNumberColor(value);
  const colorClass = color === 'red' ? 'bg-roulette-red' : color === 'black' ? 'bg-roulette-black' : 'bg-roulette-green';

  return (
    <button
      onClick={onClick}
      className={`${colorClass} w-9 h-9 rounded-sm flex items-center justify-center text-xs font-semibold text-foreground transition-all hover:scale-110 hover:z-10 ${isRecent ? 'ring-2 ring-accent shadow-neon-gold' : ''}`}
    >
      {value}
    </button>
  );
};

const RouletteBoard = ({ lastNumbers, onNumberClick }: RouletteBoardProps) => {
  const rows = [
    [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
    [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
    [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
  ];

  return (
    <div className="bg-card rounded-lg p-4 border border-border">
      <h3 className="font-display text-sm text-primary mb-3 tracking-wider uppercase">Tabuleiro</h3>
      <div className="flex gap-1">
        <div className="flex items-center">
          <NumberCell value={0} isRecent={lastNumbers.includes(0)} onClick={() => onNumberClick?.(0)} />
        </div>
        <div className="flex flex-col gap-1">
          {rows.map((row, i) => (
            <div key={i} className="flex gap-1">
              {row.map(n => (
                <NumberCell key={n} value={n} isRecent={lastNumbers.slice(0, 5).includes(n)} onClick={() => onNumberClick?.(n)} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RouletteBoard;
