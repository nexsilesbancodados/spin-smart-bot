import { memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, TrendingDown, Flame, AlertTriangle, BarChart3 } from 'lucide-react';
import { analyzeSpins, type EngineSignal } from '@/lib/analysis-engine';

const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const numBg = (n: number) => n === 0 ? 'bg-emerald-600' : RED_NUMBERS.has(n) ? 'bg-red-600' : 'bg-zinc-800';

const actionBg = (color: EngineSignal['actionColor']) => {
  switch (color) {
    case 'red': return 'from-red-600 to-red-800 shadow-red-500/30';
    case 'black': return 'from-zinc-700 to-zinc-900 shadow-zinc-500/20';
    case 'green': return 'from-emerald-600 to-emerald-800 shadow-emerald-500/30';
    case 'dozen': return 'from-blue-600 to-blue-800 shadow-blue-500/25';
    case 'column': return 'from-purple-600 to-purple-800 shadow-purple-500/25';
  }
};

const urgencyIcon = (u: EngineSignal['urgency']) => {
  if (u === 'high') return <Flame className="w-5 h-5 text-orange-400" />;
  if (u === 'medium') return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
  return <BarChart3 className="w-5 h-5 text-muted-foreground" />;
};

interface Props {
  allNumbers: number[];
}

const ConfidenceRing = ({ value }: { value: number }) => {
  const r = 22, c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  const color = value >= 80 ? '#22c55e' : value >= 65 ? '#eab308' : '#94a3b8';
  return (
    <div className="relative w-16 h-16 shrink-0">
      <svg viewBox="0 0 52 52" className="w-full h-full -rotate-90">
        <circle cx="26" cy="26" r={r} fill="none" stroke="hsl(var(--border))" strokeWidth="4" opacity={0.3} />
        <motion.circle
          cx="26" cy="26" r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[13px] font-black text-foreground leading-none">{value}%</span>
      </div>
    </div>
  );
};

const EngineSignalCard = memo(({ allNumbers }: Props) => {
  const signals = useMemo(() => analyzeSpins(allNumbers), [allNumbers]);
  const top = signals[0] ?? null;

  if (!top) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-2xl border border-border bg-card p-8 text-center"
      >
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          className="space-y-3"
        >
          <div className="text-4xl opacity-40">🔍</div>
          <p className="text-sm font-bold text-muted-foreground">
            Analisando a mesa em tempo real...
          </p>
          <p className="text-xs text-muted-foreground/60">
            Aguardando o padrão perfeito para entrada segura.
          </p>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={top.id}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="space-y-3"
      >
        {/* ── MAIN ACTION CARD ───────────────────────── */}
        <motion.div
          animate={{
            boxShadow: [
              `0 0 0px transparent`,
              `0 0 30px hsla(142,70%,45%,0.25)`,
              `0 0 0px transparent`,
            ],
          }}
          transition={{ duration: 2, ease: 'easeInOut' }}
          className={`rounded-2xl overflow-hidden border-2 ${
            top.urgency === 'high' ? 'border-green-500/40' : 'border-primary/30'
          }`}
        >
          {/* Action header */}
          <div className={`bg-gradient-to-r ${actionBg(top.actionColor)} px-5 py-5 shadow-lg`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  {urgencyIcon(top.urgency)}
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">
                    {top.type === 'streak_break' ? 'Quebra de Sequência' : top.type === 'cold_dozen' ? 'Dúzia Fria' : 'Coluna Fria'}
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight tracking-tight">
                  {top.action}
                </h2>
              </div>
              <ConfidenceRing value={top.confidence} />
            </div>
          </div>

          {/* Detail body */}
          <div className="bg-card px-5 py-4 space-y-3">
            <p className="text-[12px] text-muted-foreground leading-relaxed">
              {top.detail}
            </p>

            {/* Zero protection */}
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-[11px] font-bold text-emerald-400">{top.protection}</span>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-3 text-[11px]">
              {top.streakLength && (
                <span className="px-3 py-1.5 rounded-lg bg-secondary/50 border border-border/40 font-bold text-foreground/80">
                  Streak: {top.streakLength}×
                </span>
              )}
              {top.absentRounds && (
                <span className="px-3 py-1.5 rounded-lg bg-secondary/50 border border-border/40 font-bold text-foreground/80">
                  Ausente: {top.absentRounds} rodadas
                </span>
              )}
              <span className="px-3 py-1.5 rounded-lg bg-secondary/50 border border-border/40 font-bold text-foreground/80 inline-flex items-center gap-1">
                <Flame className="w-3 h-3 text-orange-400" />
                {top.confidence}% Match
              </span>
            </div>
          </div>
        </motion.div>

        {/* ── SECONDARY SIGNALS ──────────────────────── */}
        {signals.length > 1 && (
          <div className="space-y-1.5">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">
              Outros padrões detectados
            </span>
            <div className="grid gap-2">
              {signals.slice(1, 3).map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card border border-border/50">
                  <TrendingDown className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-[11px] font-bold text-foreground">{s.action}</span>
                    <p className="text-[9px] text-muted-foreground line-clamp-1">{s.detail}</p>
                  </div>
                  <span className="text-[11px] font-black text-primary shrink-0">{s.confidence}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
});

EngineSignalCard.displayName = 'EngineSignalCard';
export default EngineSignalCard;
