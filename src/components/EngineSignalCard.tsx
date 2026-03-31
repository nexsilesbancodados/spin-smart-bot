import { memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, TrendingDown, Flame, AlertTriangle, BarChart3 } from 'lucide-react';
import { analyzeSpins, type EngineSignal } from '@/lib/analysis-engine';

const actionBg = (color: EngineSignal['actionColor']) => {
  switch (color) {
    case 'red': return 'from-red-600/90 to-red-900 shadow-red-500/20';
    case 'black': return 'from-zinc-700/90 to-zinc-900 shadow-zinc-500/15';
    case 'green': return 'from-emerald-600/90 to-emerald-900 shadow-emerald-500/20';
    case 'dozen': return 'from-blue-600/90 to-blue-900 shadow-blue-500/20';
    case 'column': return 'from-purple-600/90 to-purple-900 shadow-purple-500/20';
  }
};

const urgencyIcon = (u: EngineSignal['urgency']) => {
  if (u === 'high') return <Flame className="w-4 h-4 text-orange-400" />;
  if (u === 'medium') return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
  return <BarChart3 className="w-4 h-4 text-muted-foreground" />;
};

interface Props { allNumbers: number[]; }

const ConfidenceRing = ({ value }: { value: number }) => {
  const r = 20, c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  const color = value >= 80 ? 'hsl(142 70% 45%)' : value >= 65 ? 'hsl(48 96% 53%)' : 'hsl(215 14% 63%)';
  return (
    <div className="relative w-14 h-14 shrink-0">
      <svg viewBox="0 0 48 48" className="w-full h-full -rotate-90">
        <circle cx="24" cy="24" r={r} fill="none" stroke="hsl(var(--border))" strokeWidth="3" opacity={0.2} />
        <motion.circle
          cx="24" cy="24" r={r} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[12px] font-black text-foreground">{value}%</span>
      </div>
    </div>
  );
};

const EngineSignalCard = memo(({ allNumbers }: Props) => {
  const signals = useMemo(() => analyzeSpins(allNumbers), [allNumbers]);
  const top = signals[0] ?? null;

  if (!top) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-xl p-8 text-center">
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          className="space-y-2"
        >
          <div className="text-3xl opacity-40">🔍</div>
          <p className="text-xs font-bold text-muted-foreground">Analisando padrões da mesa...</p>
          <p className="text-[9px] text-muted-foreground/50">Aguardando convergência para entrada segura.</p>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={top.id}
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        className="space-y-2.5"
      >
        {/* MAIN CARD */}
        <div className={`rounded-xl overflow-hidden border ${
          top.urgency === 'high' ? 'border-green-500/30' : 'border-primary/20'
        } shadow-lg`}>
          {/* Action header */}
          <div className={`bg-gradient-to-r ${actionBg(top.actionColor)} px-4 py-4`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {urgencyIcon(top.urgency)}
                  <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/60">
                    {top.type === 'streak_break' ? 'Quebra de Sequência' : top.type === 'cold_dozen' ? 'Dúzia Fria' : 'Coluna Fria'}
                  </span>
                </div>
                <h2 className="text-xl font-black text-white leading-tight">{top.action}</h2>
              </div>
              <ConfidenceRing value={top.confidence} />
            </div>
          </div>

          {/* Body */}
          <div className="bg-card/95 backdrop-blur-sm px-4 py-3.5 space-y-2.5">
            <p className="text-[11px] text-muted-foreground leading-relaxed">{top.detail}</p>

            {/* Protection */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/8 border border-emerald-500/15">
              <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="text-[10px] font-bold text-emerald-400">{top.protection}</span>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-2 text-[10px] flex-wrap">
              {top.streakLength && (
                <span className="px-2.5 py-1 rounded-md bg-secondary/40 border border-border/30 font-bold text-foreground/80">
                  Streak: {top.streakLength}×
                </span>
              )}
              {top.absentRounds && (
                <span className="px-2.5 py-1 rounded-md bg-secondary/40 border border-border/30 font-bold text-foreground/80">
                  Ausente: {top.absentRounds}r
                </span>
              )}
              <span className="px-2.5 py-1 rounded-md bg-primary/10 border border-primary/15 font-bold text-primary inline-flex items-center gap-1">
                <Flame className="w-3 h-3" /> {top.confidence}%
              </span>
            </div>
          </div>
        </div>

        {/* SECONDARY SIGNALS */}
        {signals.length > 1 && (
          <div className="space-y-1.5">
            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 px-1">
              Outros padrões
            </span>
            {signals.slice(1, 3).map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl glass border border-border/30">
                <TrendingDown className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-bold text-foreground">{s.action}</span>
                  <p className="text-[8px] text-muted-foreground line-clamp-1">{s.detail}</p>
                </div>
                <span className="text-[10px] font-black text-primary shrink-0">{s.confidence}%</span>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
});

EngineSignalCard.displayName = 'EngineSignalCard';
export default EngineSignalCard;
