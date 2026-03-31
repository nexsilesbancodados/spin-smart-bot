import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';

const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const numBg = (n: number) => n === 0 ? 'bg-gradient-to-br from-emerald-500 to-emerald-700' : RED_NUMBERS.has(n) ? 'bg-gradient-to-br from-red-500 to-red-700' : 'bg-gradient-to-br from-zinc-600 to-zinc-900';

interface Props { numbers: number[]; }

const NumberTicker = memo(({ numbers }: Props) => {
  const last15 = useMemo(() => numbers.slice(0, 15), [numbers]);
  if (last15.length === 0) return null;

  // Streak detection
  let streak = 1;
  for (let i = 1; i < last15.length; i++) { if (last15[i] === last15[0]) streak++; else break; }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 safe-bottom relative overflow-hidden">
      {/* Background layers */}
      <div className="absolute inset-0 glass-strong" />
      <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.03] via-transparent to-neon-pink/[0.02]" />
      
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-neon-cyan/40 via-neon-pink/30 to-neon-cyan/40" />
      
      <div className="relative max-w-2xl mx-auto flex items-center gap-2 px-4 py-2.5 overflow-x-auto scrollbar-none">
        {/* Live indicator */}
        <div className="flex items-center gap-2 shrink-0 mr-1 pr-3 border-r border-border/20">
          <div className="relative">
            <motion.div
              animate={{ scale: [1, 1.5, 1], opacity: [1, 0.4, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-2.5 h-2.5 rounded-full bg-primary shadow-[0_0_12px_hsl(var(--primary)/0.6)]"
            />
            <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-primary/30 animate-ping" />
          </div>
          <div className="flex flex-col">
            <span className="text-[6px] font-display font-black text-primary/80 uppercase tracking-[0.25em] leading-none">LIVE</span>
            <span className="text-[5px] font-mono text-muted-foreground/30 leading-none mt-0.5">{last15.length} spins</span>
          </div>
        </div>

        {/* Number chips */}
        {last15.map((n, i) => (
          <motion.div
            key={`${n}-${i}`}
            initial={i === 0 ? { scale: 0, opacity: 0, rotateY: 180 } : false}
            animate={{ scale: 1, opacity: 1, rotateY: 0 }}
            transition={i === 0 ? { type: 'spring', stiffness: 400, damping: 15 } : undefined}
            className={`rounded-xl flex items-center justify-center font-black text-white shrink-0 border border-white/8 shadow-sm transition-all ${numBg(n)} ${
              i === 0
                ? 'w-11 h-11 text-[14px] ring-2 ring-primary/60 shadow-[0_0_15px_hsl(var(--primary)/0.3)] ring-offset-1 ring-offset-background'
                : i < 3
                ? 'w-8 h-8 text-[11px] hover:scale-110'
                : 'w-7 h-7 text-[10px] hover:scale-105'
            } ${i >= 10 ? 'opacity-20' : i >= 7 ? 'opacity-35' : i >= 4 ? 'opacity-55' : ''}`}
          >
            {n}
          </motion.div>
        ))}

        {/* Streak badge */}
        {streak >= 2 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="shrink-0 ml-1 flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-gold/12 border border-gold/25 shadow-[0_0_10px_hsl(var(--gold)/0.15)]"
          >
            <span className="text-[9px] font-black text-gold font-mono">🔱 ×{streak}</span>
          </motion.div>
        )}
      </div>
    </div>
  );
});

NumberTicker.displayName = 'NumberTicker';
export default NumberTicker;