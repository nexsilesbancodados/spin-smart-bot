import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';

const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const numBg = (n: number) => n === 0 ? 'bg-emerald-600' : RED_NUMBERS.has(n) ? 'bg-red-600' : 'bg-zinc-800';

interface Props {
  numbers: number[];
}

const NumberTicker = memo(({ numbers }: Props) => {
  const last15 = useMemo(() => numbers.slice(0, 15), [numbers]);
  if (last15.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border/50 safe-bottom">
      <div className="flex items-center gap-1.5 px-3 py-2 overflow-x-auto scrollbar-none">
        <span className="text-[8px] font-black text-muted-foreground uppercase tracking-wider shrink-0 mr-1">
          LIVE
        </span>
        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shrink-0 mr-1" />
        {last15.map((n, i) => (
          <motion.div
            key={`${n}-${i}`}
            initial={i === 0 ? { scale: 0, opacity: 0 } : false}
            animate={{ scale: 1, opacity: 1 }}
            transition={i === 0 ? { type: 'spring', stiffness: 400, damping: 15 } : undefined}
            className={`w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-black text-white shrink-0 ${numBg(n)} ${
              i === 0 ? 'ring-2 ring-primary/60 shadow-md scale-110' : i >= 8 ? 'opacity-40' : ''
            }`}
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
