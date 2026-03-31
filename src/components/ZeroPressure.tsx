import { motion } from 'framer-motion';

interface Props { allNumbers: number[] }

const ZeroPressure = ({ allNumbers }: Props) => {
  const delay = allNumbers.findIndex(n => n === 0);
  const absence = delay === -1 ? allNumbers.length : delay;

  const level = absence >= 41 ? 'critical' : absence >= 26 ? 'high' : absence >= 15 ? 'medium' : 'normal';
  const pct = Math.min((absence / 74) * 100, 100);

  const config = {
    normal:   { color: 'text-neon-green',  border: 'border-neon-green/20',  bg: 'bg-neon-green/5',  bar: 'from-neon-green to-emerald-400', label: 'Normal',       tip: '' },
    medium:   { color: 'text-gold',        border: 'border-gold/20',        bg: 'bg-gold/5',        bar: 'from-gold to-amber-400',         label: 'Atenção',      tip: '1 ficha no zero' },
    high:     { color: 'text-orange-400',   border: 'border-orange-500/20',  bg: 'bg-orange-500/5',  bar: 'from-orange-500 to-red-400',     label: 'Pressão Alta', tip: 'Jeu Zero (4 fichas)' },
    critical: { color: 'text-destructive',  border: 'border-destructive/25', bg: 'bg-destructive/5', bar: 'from-destructive to-rose-400',   label: '🚨 ANOMALIA', tip: 'Vizinhos do Zero (9 fichas)' },
  }[level];

  if (absence < 10) return null;

  return (
    <motion.div
      animate={level === 'critical' ? { boxShadow: ['0 0 0px rgba(239,68,68,0)', '0 0 20px rgba(239,68,68,0.2)', '0 0 0px rgba(239,68,68,0)'] } : {}}
      transition={{ repeat: Infinity, duration: 1.5 }}
      className={`glass rounded-xl border p-3.5 ${config.bg} ${config.border} flex items-center gap-4 relative overflow-hidden`}
    >
      {level === 'critical' && <div className="absolute inset-0 scanline opacity-20" />}
      
      <div className="text-2xl relative z-10">🟢</div>
      <div className="flex-1 min-w-0 relative z-10">
        <div className="flex items-center justify-between mb-1.5">
          <span className={`text-[10px] font-display font-bold tracking-[0.2em] uppercase ${config.color}`}>PRESSÃO DO ZERO</span>
          <span className={`text-xs font-mono font-black ${config.color}`}>{absence} rodadas</span>
        </div>
        <div className="w-full h-2 bg-background/20 rounded-full overflow-hidden mb-1.5 border border-border/10">
          <motion.div className={`h-full rounded-full bg-gradient-to-r ${config.bar}`} animate={{ width: `${pct}%` }} transition={{ duration: 0.6 }} />
        </div>
        <div className="flex items-center justify-between">
          <span className={`text-[9px] font-bold ${config.color}`}>{config.label}</span>
          {config.tip && <span className="text-[8px] text-muted-foreground/40 font-mono">→ {config.tip}</span>}
        </div>
      </div>
    </motion.div>
  );
};

export default ZeroPressure;
