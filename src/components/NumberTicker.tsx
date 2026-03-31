import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';

const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const numBg = (n: number) => n === 0 ? 'bg-emerald-600' : RED.has(n) ? 'bg-red-600' : 'bg-zinc-700';

interface Props { numbers: number[]; }

const NumberTicker = memo(({ numbers }: Props) => {
  const last12 = useMemo(() => numbers.slice(0, 12), [numbers]);
  if (last12.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 safe-bottom">
      <div className="glass-strong border-t border-border/30">
        <div className="max-w-lg mx-auto flex items-center gap-1.5 px-3 py-2 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-1.5 shrink-0 mr-1 pr-2 border-r border-border/20">
            <div className="relative">
              <motion.div animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
                className="w-2 h-2 rounded-full bg-primary" />
            </div>
            <span className="text-[7px] font-bold text-primary/60 uppercase tracking-wider">LIVE</span>
          </div>

          {last12.map((n, i) => (
            <motion.div
              key={`${n}-${i}`}
              initial={i === 0 ? { scale: 0, opacity: 0 } : false}
              animate={{ scale: 1, opacity: 1 }}
              transition={i === 0 ? { type: 'spring', stiffness: 400, damping: 15 } : undefined}
              className={`rounded-lg flex items-center justify-center font-black text-white shrink-0 ${numBg(n)} ${
                i === 0 ? 'w-9 h-9 text-[13px] ring-2 ring-primary/50 ring-offset-1 ring-offset-background' :
                i < 3 ? 'w-7 h-7 text-[10px]' : 'w-6 h-6 text-[9px]'
              } ${i >= 8 ? 'opacity-25' : i >= 5 ? 'opacity-45' : ''}`}
            >
              {n}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
});

NumberTicker.displayName = 'NumberTicker';
export default NumberTicker;
