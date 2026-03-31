import { memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, TrendingDown, Flame, AlertTriangle, BarChart3, Zap } from 'lucide-react';
import { analyzeSpins, type EngineSignal } from '@/lib/analysis-engine';

const actionBg = (color: EngineSignal['actionColor']) => {
  switch (color) {
    case 'red': return 'from-red-600/80 to-red-900/90';
    case 'black': return 'from-zinc-700/80 to-zinc-900/90';
    case 'green': return 'from-emerald-600/80 to-emerald-900/90';
    case 'dozen': return 'from-blue-600/80 to-blue-900/90';
    case 'column': return 'from-purple-600/80 to-purple-900/90';
  }
};

const urgencyIcon = (u: EngineSignal['urgency']) => {
  if (u === 'high') return <Flame className="w-4 h-4 text-[hsl(var(--gold))]" />;
  if (u === 'medium') return <AlertTriangle className="w-4 h-4 text-[hsl(var(--gold))]/70" />;
  return <BarChart3 className="w-4 h-4 text-muted-foreground" />;
};

const urgencyLabel = (u: EngineSignal['urgency']) => {
  if (u === 'high') return { text: 'URGENTE', cls: 'bg-[hsl(var(--gold))]/10 text-[hsl(var(--gold))] border-[hsl(var(--gold))]/20' };
  if (u === 'medium') return { text: 'ATENÇÃO', cls: 'bg-primary/10 text-primary border-primary/20' };
  return { text: 'INFORMAÇÃO', cls: 'bg-secondary/40 text-muted-foreground border-border/20' };
};

interface Props { allNumbers: number[]; }

const ConfidenceRing = ({ value }: { value: number }) => {
  const r = 22, c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  const color = value >= 80 ? 'hsl(var(--neon-green))' : value >= 65 ? 'hsl(var(--gold))' : 'hsl(var(--muted-foreground))';
  const glowColor = value >= 80 ? 'drop-shadow(0 0 4px hsl(var(--neon-green)/0.4))' : value >= 65 ? 'drop-shadow(0 0 4px hsl(var(--gold)/0.3))' : 'none';
  return (
    <div className="relative w-16 h-16 shrink-0">
      <svg viewBox="0 0 52 52" className="w-full h-full -rotate-90" style={{ filter: glowColor }}>
        <circle cx="26" cy="26" r={r} fill="none" stroke="hsl(var(--border))" strokeWidth="3" opacity={0.1} />
        <motion.circle
          cx="26" cy="26" r={r} fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[13px] font-black text-foreground font-mono">{value}%</span>
      </div>
    </div>
  );
};

const EngineSignalCard = memo(({ allNumbers }: Props) => {
  const signals = useMemo(() => analyzeSpins(allNumbers), [allNumbers]);
  const top = signals[0] ?? null;

  if (!top) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-2xl p-8 text-center border border-border/20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.02] via-transparent to-neon-pink/[0.02]" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          className="relative space-y-3"
        >
          <div className="relative mx-auto w-16 h-16">
            <div className="absolute inset-0 rounded-full border-2 border-primary/10" />
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-t-primary border-r-transparent border-b-transparent border-l-transparent"
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
            />
            <div className="absolute inset-0 flex items-center justify-center text-2xl opacity-50">🔍</div>
          </div>
          <p className="text-xs font-bold text-muted-foreground font-display tracking-wider">ANALISANDO PADRÕES</p>
          <p className="text-[9px] text-muted-foreground/50 font-mono">Aguardando convergência para entrada segura</p>
        </motion.div>
      </motion.div>
    );
  }

  const uLabel = urgencyLabel(top.urgency);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={top.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className="space-y-2.5"
      >
        {/* MAIN CARD */}
        <div className={`glass rounded-2xl overflow-hidden border ${
          top.urgency === 'high' ? 'border-neon-green/25 shadow-[0_0_15px_hsl(var(--neon-green)/0.08)]' : 'border-primary/20'
        }`}>
          {/* Action header */}
          <div className={`bg-gradient-to-r ${actionBg(top.actionColor)} px-4 py-4 backdrop-blur-sm relative overflow-hidden`}>
            {/* Decorative grid */}
            <div className="absolute inset-0 opacity-5" style={{ 
              backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.3) 1px, transparent 1px)',
              backgroundSize: '16px 16px'
            }} />
            
            <div className="relative flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  {urgencyIcon(top.urgency)}
                  <span className={`text-[7px] font-bold uppercase tracking-[0.15em] px-2 py-0.5 rounded-md border ${uLabel.cls}`}>
                    {uLabel.text}
                  </span>
                  <span className="text-[8px] font-bold uppercase tracking-[0.12em] text-white/40 font-display">
                    {top.type === 'streak_break' ? 'Quebra de Sequência' : top.type === 'cold_dozen' ? 'Dúzia Fria' : 'Coluna Fria'}
                  </span>
                </div>
                <h2 className="text-xl font-black text-white leading-tight font-display tracking-wide">{top.action}</h2>
              </div>
              <ConfidenceRing value={top.confidence} />
            </div>
          </div>

          {/* Body */}
          <div className="px-4 py-3.5 space-y-3">
            <p className="text-[11px] text-muted-foreground leading-relaxed">{top.detail}</p>

            {/* Protection */}
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl glass border border-neon-green/15 bg-neon-green/3">
              <Shield className="w-4 h-4 text-neon-green shrink-0" />
              <span className="text-[10px] font-bold text-neon-green">{top.protection}</span>
            </div>

            {/* Stats pills */}
            <div className="flex items-center gap-2 text-[10px] flex-wrap">
              {top.streakLength && (
                <span className="px-2.5 py-1.5 rounded-lg glass border border-border/15 font-bold text-foreground/80 font-mono flex items-center gap-1">
                  <Zap className="w-3 h-3 text-[hsl(var(--gold))]" />
                  Streak: {top.streakLength}×
                </span>
              )}
              {top.absentRounds && (
                <span className="px-2.5 py-1.5 rounded-lg glass border border-border/15 font-bold text-foreground/80 font-mono flex items-center gap-1">
                  <TrendingDown className="w-3 h-3 text-[hsl(var(--neon-cyan))]" />
                  Ausente: {top.absentRounds}r
                </span>
              )}
              <span className="px-2.5 py-1.5 rounded-lg bg-primary/8 border border-primary/15 font-bold text-primary inline-flex items-center gap-1 font-mono">
                <Flame className="w-3 h-3" /> {top.confidence}%
              </span>
            </div>
          </div>
        </div>

        {/* SECONDARY SIGNALS */}
        {signals.length > 1 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 px-1">
              <div className="w-4 h-px bg-gradient-to-r from-muted-foreground/20 to-transparent" />
              <span className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 font-display">
                Outros padrões
              </span>
              <div className="flex-1 h-px bg-gradient-to-r from-muted-foreground/10 to-transparent" />
            </div>
            {signals.slice(1, 3).map((s, idx) => (
              <motion.div 
                key={s.id} 
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.08 }}
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl glass border border-border/15 hover:border-primary/15 transition-all group cursor-default"
              >
                <div className="w-8 h-8 rounded-lg glass border border-border/10 flex items-center justify-center shrink-0 group-hover:border-primary/20 group-hover:bg-primary/5 transition-all">
                  <TrendingDown className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-primary/70 transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-bold text-foreground">{s.action}</span>
                  <p className="text-[8px] text-muted-foreground/50 line-clamp-1">{s.detail}</p>
                </div>
                <div className="shrink-0 text-right">
                  <span className={`text-[10px] font-black font-mono ${s.confidence >= 80 ? 'text-neon-green' : s.confidence >= 65 ? 'text-gold' : 'text-primary'}`}>{s.confidence}%</span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
});

EngineSignalCard.displayName = 'EngineSignalCard';
export default EngineSignalCard;
