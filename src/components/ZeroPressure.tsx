import { motion } from 'framer-motion';

interface Props { allNumbers: number[] }

const ZeroPressure = ({ allNumbers }: Props) => {
  const delay = allNumbers.findIndex(n => n === 0);
  const absence = delay === -1 ? allNumbers.length : delay;

  const level = absence >= 41 ? 'critical' : absence >= 26 ? 'high' : absence >= 15 ? 'medium' : 'normal';
  const pct = Math.min((absence / 74) * 100, 100);

  const config = {
    normal:   { color: 'text-green-400',  border: 'border-green-500/30',  bg: 'bg-green-500/10',  bar: 'from-green-500 to-emerald-400', label: 'Normal',       tip: '' },
    medium:   { color: 'text-yellow-400', border: 'border-yellow-500/30', bg: 'bg-yellow-500/10', bar: 'from-yellow-500 to-amber-400',  label: 'Atenção',      tip: '1 ficha no zero' },
    high:     { color: 'text-orange-400', border: 'border-orange-500/30', bg: 'bg-orange-500/10', bar: 'from-orange-500 to-red-400',    label: 'Pressão Alta', tip: 'Jeu Zero (4 fichas)' },
    critical: { color: 'text-red-400',    border: 'border-red-500/40',    bg: 'bg-red-500/15',    bar: 'from-red-500 to-rose-400',      label: '🚨 ANOMALIA',  tip: 'Vizinhos do Zero (9 fichas)' },
  }[level];

  if (absence < 10) return null;

  return (
    <motion.div
      animate={level === 'critical' ? { boxShadow: ['0 0 0px rgba(239,68,68,0)', '0 0 20px rgba(239,68,68,0.3)', '0 0 0px rgba(239,68,68,0)'] } : {}}
      transition={{ repeat: Infinity, duration: 1.5 }}
      className={`rounded-xl border p-3 ${config.bg} ${config.border} flex items-center gap-3`}
    >
      <div className="text-2xl">🟢</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className={`text-[10px] font-bold tracking-widest uppercase ${config.color}`}>PRESSÃO DO ZERO</span>
          <span className={`text-xs font-mono font-black ${config.color}`}>{absence} rodadas</span>
        </div>
        <div className="w-full h-1.5 bg-secondary/60 rounded-full overflow-hidden mb-1">
          <motion.div
            className={`h-full rounded-full bg-gradient-to-r ${config.bar}`}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6 }}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className={`text-[9px] font-bold ${config.color}`}>{config.label}</span>
          {config.tip && <span className="text-[8px] text-muted-foreground">→ {config.tip}</span>}
        </div>
      </div>
    </motion.div>
  );
};

export default ZeroPressure;
