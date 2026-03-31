import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

const colorGradient = (n: number) =>
  n === 0
    ? 'from-emerald-500 to-emerald-700 border-emerald-400/40'
    : RED_NUMBERS.has(n)
    ? 'from-red-500 to-red-700 border-red-400/40'
    : 'from-zinc-600 to-zinc-900 border-zinc-500/30';

interface Props {
  allNumbers: number[];
}

const Last12Numbers = memo(({ allNumbers }: Props) => {
  const last12 = useMemo(() => allNumbers.slice(0, 12), [allNumbers]);

  if (last12.length === 0) return null;

  return (
    <div className="bg-card/60 rounded-xl border border-border/40 px-3 py-2.5 backdrop-blur-sm">
      <div className="flex items-center gap-3 overflow-x-auto scrollbar-thin">
        <div className="shrink-0 flex flex-col items-center gap-0.5">
          <span className="text-[7px] font-black tracking-[0.2em] text-primary/60 uppercase">Últimos</span>
          <span className="text-[10px] font-black text-primary">{last12.length}</span>
        </div>
        <div className="w-px h-8 bg-border/40 shrink-0" />
        <div className="flex gap-1.5">
          {last12.map((n, i) => (
            <motion.div
              key={`${i}-${n}`}
              initial={i === 0 ? { scale: 0, opacity: 0, rotateY: 180 } : false}
              animate={{ scale: 1, opacity: 1, rotateY: 0 }}
              transition={i === 0 ? { type: 'spring', stiffness: 300, damping: 15 } : undefined}
              className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-black text-white
                bg-gradient-to-br ${colorGradient(n)} border shrink-0 shadow-md
                ${i === 0 ? 'ring-2 ring-primary/60 ring-offset-1 ring-offset-background scale-110 shadow-lg shadow-primary/20' : ''}
                ${i === 1 ? 'opacity-90' : i >= 6 ? 'opacity-50' : ''}
              `}
            >
              {n}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
});

Last12Numbers.displayName = 'Last12Numbers';
export default Last12Numbers;
