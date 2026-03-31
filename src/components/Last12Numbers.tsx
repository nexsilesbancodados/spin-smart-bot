import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

const chipStyle = (n: number, i: number) => {
  const base = n === 0
    ? 'from-emerald-500 to-emerald-700 shadow-emerald-500/20'
    : RED_NUMBERS.has(n)
    ? 'from-red-500 to-red-700 shadow-red-500/15'
    : 'from-zinc-600 to-zinc-900 shadow-zinc-500/10';
  const size = i === 0 ? 'w-12 h-12 text-base' : i < 3 ? 'w-10 h-10 text-sm' : 'w-8 h-8 text-xs';
  const opacity = i >= 8 ? 'opacity-25' : i >= 5 ? 'opacity-45' : '';
  return `${size} ${opacity} bg-gradient-to-br ${base}`;
};

interface Props { allNumbers: number[] }

const Last12Numbers = memo(({ allNumbers }: Props) => {
  const last12 = useMemo(() => allNumbers.slice(0, 12), [allNumbers]);

  if (last12.length === 0) return null;

  let streak = 1;
  for (let i = 1; i < last12.length; i++) { if (last12[i] === last12[0]) streak++; else break; }

  const reds = last12.filter(n => RED_NUMBERS.has(n)).length;
  const blacks = last12.filter(n => n > 0 && !RED_NUMBERS.has(n)).length;
  const greens = last12.filter(n => n === 0).length;

  return (
    <div className="glass rounded-2xl px-4 py-3.5 border border-border/20 relative overflow-hidden">
      {/* Top accent */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-cyan/25 to-transparent" />
      
      <div className="flex items-center gap-2.5 overflow-x-auto scrollbar-thin pb-1">
        <div className="shrink-0 flex flex-col items-center gap-1 pr-3 border-r border-border/15">
          <span className="text-[6px] font-display font-bold tracking-[0.25em] text-neon-cyan/50 uppercase">Live</span>
          <motion.span
            key={last12.length}
            initial={{ scale: 1.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-sm font-black text-neon-cyan font-mono"
          >
            {last12.length}
          </motion.span>
        </div>
        <div className="flex gap-2 items-center">
          {last12.map((n, i) => (
            <motion.div
              key={`${i}-${n}`}
              initial={i === 0 ? { scale: 0, opacity: 0, rotateY: 180 } : false}
              animate={{ scale: 1, opacity: 1, rotateY: 0 }}
              transition={i === 0 ? { type: 'spring', stiffness: 400, damping: 18 } : undefined}
              className={`rounded-xl flex items-center justify-center font-black text-white shrink-0 shadow-md border border-white/8 transition-all
                ${chipStyle(n, i)}
                ${i === 0 ? 'ring-2 ring-neon-cyan/60 ring-offset-2 ring-offset-background shadow-[0_0_12px_hsl(var(--neon-cyan)/0.3)]' : 'hover:scale-105'}
              `}
            >
              {n}
            </motion.div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 mt-2.5 pt-2.5 border-t border-border/10">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-red-500/8 border border-red-500/10">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
            <span className="text-[9px] font-bold text-red-400/70 font-mono">{reds}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-zinc-600/8 border border-zinc-600/10">
            <div className="w-2.5 h-2.5 rounded-full bg-zinc-600/70" />
            <span className="text-[9px] font-bold text-muted-foreground/50 font-mono">{blacks}</span>
          </div>
          {greens > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-500/8 border border-emerald-500/10">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
              <span className="text-[9px] font-bold text-emerald-400/70 font-mono">{greens}</span>
            </div>
          )}
        </div>
        {streak >= 2 && (
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-gold/8 border border-gold/20 shadow-[0_0_8px_hsl(var(--gold)/0.1)]"
          >
            <span className="text-[9px] font-black text-gold font-mono">🔱 {last12[0]} ×{streak}</span>
          </motion.div>
        )}
        <div className="ml-auto text-[8px] text-muted-foreground/25 font-mono">
          {reds > blacks ? '🔴 tendência' : blacks > reds ? '⚫ tendência' : '→ neutro'}
        </div>
      </div>
    </div>
  );
});

Last12Numbers.displayName = 'Last12Numbers';
export default Last12Numbers;
