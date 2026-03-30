import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

const colorClass = (n: number) =>
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
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
      <span className="text-[8px] font-display font-bold tracking-[0.15em] text-muted-foreground shrink-0 uppercase">
        Últimos
      </span>
      <div className="flex gap-1.5">
        {last12.map((n, i) => (
          <motion.div
            key={`${i}-${n}`}
            initial={i === 0 ? { scale: 0.5, opacity: 0 } : false}
            animate={{ scale: 1, opacity: 1 }}
            className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-black text-white
              bg-gradient-to-br ${colorClass(n)} border-2 shrink-0 shadow-md
              ${i === 0 ? 'ring-2 ring-primary/60 ring-offset-1 ring-offset-background scale-110 shadow-lg shadow-primary/20' : ''}
            `}
          >
            {n}
          </motion.div>
        ))}
      </div>
    </div>
  );
});

Last12Numbers.displayName = 'Last12Numbers';
export default Last12Numbers;
