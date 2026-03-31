import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Activity } from 'lucide-react';

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

const chipStyle = (n: number, i: number) => {
  const base = n === 0
    ? 'from-emerald-500 to-emerald-700 shadow-emerald-500/20'
    : RED_NUMBERS.has(n)
    ? 'from-red-500 to-red-700 shadow-red-500/15'
    : 'from-zinc-600 to-zinc-900 shadow-zinc-500/10';
  const size = i === 0 ? 'w-12 h-12 text-base' : i < 3 ? 'w-10 h-10 text-sm' : 'w-8 h-8 text-xs';
  const opacity = i >= 8 ? 'opacity-20' : i >= 5 ? 'opacity-40' : '';
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
  const redPct = last12.length > 0 ? Math.round((reds / last12.length) * 100) : 0;
  const blackPct = last12.length > 0 ? Math.round((blacks / last12.length) * 100) : 0;

  // Parity & high/low
  const pars = last12.filter(n => n > 0 && n % 2 === 0).length;
  const altos = last12.filter(n => n >= 19).length;

  return (
    <div className="glass rounded-2xl px-4 py-3.5 border border-border/20 relative overflow-hidden">
      {/* Top accent */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-neon-cyan/40 via-neon-pink/30 to-neon-cyan/40" />
      <div className="absolute inset-0 bg-gradient-to-r from-neon-cyan/[0.02] via-transparent to-neon-pink/[0.01]" />
      
      <div className="relative flex items-center gap-2.5 overflow-x-auto scrollbar-thin pb-1">
        {/* Live counter */}
        <div className="shrink-0 flex flex-col items-center gap-0.5 pr-3 border-r border-border/15">
          <div className="flex items-center gap-1">
            <motion.div
              animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-1.5 h-1.5 rounded-full bg-neon-green shadow-[0_0_6px_hsl(var(--neon-green)/0.5)]"
            />
            <span className="text-[6px] font-display font-bold tracking-[0.25em] text-neon-cyan/60 uppercase">Live</span>
          </div>
          <motion.span
            key={last12.length}
            initial={{ scale: 1.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-base font-black text-neon-cyan font-mono"
          >
            {last12.length}
          </motion.span>
        </div>

        {/* Number chips */}
        <div className="flex gap-2 items-center">
          {last12.map((n, i) => (
            <motion.div
              key={`${i}-${n}`}
              initial={i === 0 ? { scale: 0, opacity: 0, rotateY: 180 } : false}
              animate={{ scale: 1, opacity: 1, rotateY: 0 }}
              transition={i === 0 ? { type: 'spring', stiffness: 400, damping: 18 } : undefined}
              className={`rounded-xl flex items-center justify-center font-black text-white shrink-0 shadow-md border border-white/8 transition-all
                ${chipStyle(n, i)}
                ${i === 0 ? 'ring-2 ring-primary/50 ring-offset-2 ring-offset-background shadow-[0_0_18px_hsl(var(--primary)/0.3)]' : 'hover:scale-110 active:scale-95'}
              `}
            >
              {n}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Stats footer */}
      <div className="relative flex items-center gap-2 mt-2.5 pt-2.5 border-t border-border/10">
        {/* Color distribution bar */}
        <div className="flex-1 flex items-center gap-2">
          <div className="flex-1 h-2.5 rounded-full overflow-hidden flex bg-background/20 border border-border/10">
            <motion.div
              className="h-full bg-gradient-to-r from-red-500 to-red-600"
              initial={{ width: 0 }}
              animate={{ width: `${redPct}%` }}
              transition={{ duration: 0.5 }}
            />
            {greens > 0 && (
              <motion.div
                className="h-full bg-emerald-500"
                initial={{ width: 0 }}
                animate={{ width: `${Math.round((greens / last12.length) * 100)}%` }}
                transition={{ duration: 0.5, delay: 0.1 }}
              />
            )}
            <motion.div
              className="h-full bg-gradient-to-r from-zinc-600 to-zinc-800"
              initial={{ width: 0 }}
              animate={{ width: `${blackPct}%` }}
              transition={{ duration: 0.5, delay: 0.2 }}
            />
          </div>
          <div className="flex items-center gap-1.5 text-[8px] font-mono shrink-0">
            <span className="text-red-400 font-bold">{reds}</span>
            <span className="text-muted-foreground/20">·</span>
            <span className="text-muted-foreground/60 font-bold">{blacks}</span>
            {greens > 0 && <><span className="text-muted-foreground/20">·</span><span className="text-emerald-400 font-bold">{greens}</span></>}
          </div>
        </div>

        {/* Quick micro-stats */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[7px] font-mono text-muted-foreground/40 px-1.5 py-0.5 rounded-md bg-background/20 border border-border/10">
            {pars > last12.length / 2 ? 'P' : 'I'}:{pars}/{last12.length - pars - greens}
          </span>
          <span className="text-[7px] font-mono text-muted-foreground/40 px-1.5 py-0.5 rounded-md bg-background/20 border border-border/10">
            {altos > (last12.length - greens) / 2 ? '↑' : '↓'}:{altos}/{last12.filter(n => n >= 1 && n <= 18).length}
          </span>
        </div>

        {streak >= 2 && (
          <motion.div
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-gold/10 border border-gold/25 shadow-[0_0_10px_hsl(var(--gold)/0.15)]"
          >
            <span className="text-[9px] font-black text-gold font-mono">🔱 {last12[0]} ×{streak}</span>
          </motion.div>
        )}
      </div>
    </div>
  );
});

Last12Numbers.displayName = 'Last12Numbers';
export default Last12Numbers;
