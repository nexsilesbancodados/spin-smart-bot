import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';

const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const numBg = (n: number) => n === 0 ? 'bg-emerald-600' : RED_NUMBERS.has(n) ? 'bg-red-600' : 'bg-zinc-800';

interface Props { numbers: number[]; }

const NumberTicker = memo(({ numbers }: Props) => {
  const last15 = useMemo(() => numbers.slice(0, 15), [numbers]);
  if (last15.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 glass-strong safe-bottom">
      <div className="max-w-2xl mx-auto flex items-center gap-1.5 px-3 py-2 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-1.5 shrink-0 mr-1 pr-2 border-r border-border/30">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_6px_hsl(var(--primary)/0.4)]" />
          <span className="text-[7px] font-black text-primary/70 uppercase tracking-[0.2em]">LIVE</span>
        </div>
        {last15.map((n, i) => (
          <motion.div
            key={`${n}-${i}`}
            initial={i === 0 ? { scale: 0, opacity: 0, rotateY: 180 } : false}
            animate={{ scale: 1, opacity: 1, rotateY: 0 }}
            transition={i === 0 ? { type: 'spring', stiffness: 400, damping: 15 } : undefined}
            className={`rounded-lg flex items-center justify-center font-black text-white shrink-0 border border-white/5 ${numBg(n)} ${
              i === 0
                ? 'w-9 h-9 text-[12px] ring-2 ring-primary/50 shadow-lg shadow-primary/15 ring-offset-1 ring-offset-background'
                : i < 3
                ? 'w-8 h-8 text-[11px]'
                : 'w-7 h-7 text-[10px]'
            } ${i >= 8 ? 'opacity-30' : i >= 5 ? 'opacity-50' : ''}`}
          >
            {n}
          </motion.div>
        ))}
      </div>
    </div>
  );
});

NumberTicker.displayName = 'NumberTicker';
export default NumberTicker;
