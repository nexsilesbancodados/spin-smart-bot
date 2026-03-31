import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

const chipStyle = (n: number, i: number) => {
  const base = n === 0
    ? 'from-emerald-500 to-emerald-700 shadow-emerald-500/20'
    : RED_NUMBERS.has(n)
    ? 'from-red-500 to-red-700 shadow-red-500/15'
    : 'from-zinc-600 to-zinc-900 shadow-zinc-500/10';
  const size = i === 0 ? 'w-11 h-11 text-base' : i < 3 ? 'w-9 h-9 text-sm' : 'w-8 h-8 text-xs';
  const opacity = i >= 8 ? 'opacity-30' : i >= 5 ? 'opacity-50' : '';
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
    <div className="glass rounded-xl px-3 py-3">
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin pb-1">
        <div className="shrink-0 flex flex-col items-center gap-0.5 pr-2 border-r border-border/15">
          <span className="text-[6px] font-black tracking-[0.25em] text-neon-cyan/40 uppercase">Live</span>
          <span className="text-xs font-black text-neon-cyan font-mono">{last12.length}</span>
        </div>
        <div className="flex gap-1.5 items-center">
          {last12.map((n, i) => (
            <motion.div
              key={`${i}-${n}`}
              initial={i === 0 ? { scale: 0, opacity: 0, rotateY: 180 } : false}
              animate={{ scale: 1, opacity: 1, rotateY: 0 }}
              transition={i === 0 ? { type: 'spring', stiffness: 400, damping: 18 } : undefined}
              className={`rounded-lg flex items-center justify-center font-black text-white shrink-0 shadow-md border border-white/8 transition-all
                ${chipStyle(n, i)}
                ${i === 0 ? 'ring-2 ring-neon-cyan/60 ring-offset-1 ring-offset-background shadow-neon-cyan' : 'hover:scale-105'}
              `}
            >
              {n}
            </motion.div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border/10">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
          <span className="text-[8px] font-bold text-muted-foreground/50">{reds}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-zinc-600/70" />
          <span className="text-[8px] font-bold text-muted-foreground/50">{blacks}</span>
        </div>
        {greens > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
            <span className="text-[8px] font-bold text-muted-foreground/50">{greens}</span>
          </div>
        )}
        {streak >= 2 && (
          <div className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-full bg-gold/8 border border-gold/20">
            <span className="text-[8px] font-black text-gold">🔱 {last12[0]} ×{streak}</span>
          </div>
        )}
        <div className="ml-auto text-[7px] text-muted-foreground/25 font-mono">
          {reds > blacks ? '🔴 tendência' : blacks > reds ? '⚫ tendência' : '→ neutro'}
        </div>
      </div>
    </div>
  );
});

Last12Numbers.displayName = 'Last12Numbers';
export default Last12Numbers;
