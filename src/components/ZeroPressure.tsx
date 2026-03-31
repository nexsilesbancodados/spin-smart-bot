import { motion } from 'framer-motion';
import { AlertTriangle, Shield, Zap } from 'lucide-react';

interface Props { allNumbers: number[] }

const ZeroPressure = ({ allNumbers }: Props) => {
  const delay = allNumbers.findIndex(n => n === 0);
  const absence = delay === -1 ? allNumbers.length : delay;

  const level = absence >= 41 ? 'critical' : absence >= 26 ? 'high' : absence >= 15 ? 'medium' : 'normal';
  const pct = Math.min((absence / 74) * 100, 100);

  const config = {
    normal:   { color: 'text-neon-green',  border: 'border-neon-green/20',  bg: 'bg-neon-green/3',  bar: 'from-neon-green to-emerald-400', barShadow: 'shadow-[0_0_8px_hsl(var(--neon-green)/0.3)]', label: 'Normal', tip: '', icon: Shield },
    medium:   { color: 'text-gold',        border: 'border-gold/20',        bg: 'bg-gold/3',        bar: 'from-gold to-amber-400',         barShadow: 'shadow-[0_0_8px_hsl(var(--gold)/0.3)]', label: 'Atenção', tip: '1 ficha no zero', icon: AlertTriangle },
    high:     { color: 'text-orange-400',   border: 'border-orange-500/20',  bg: 'bg-orange-500/3',  bar: 'from-orange-500 to-red-400',     barShadow: 'shadow-[0_0_8px_rgba(249,115,22,0.3)]', label: 'Pressão Alta', tip: 'Jeu Zero (4 fichas)', icon: AlertTriangle },
    critical: { color: 'text-destructive',  border: 'border-destructive/25', bg: 'bg-destructive/3', bar: 'from-destructive to-rose-400',   barShadow: 'shadow-[0_0_12px_rgba(239,68,68,0.3)]', label: '🚨 ANOMALIA', tip: 'Vizinhos do Zero (9 fichas)', icon: Zap },
  }[level];

  if (absence < 10) return null;

  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass rounded-2xl border overflow-hidden ${config.bg} ${config.border}`}
    >
      {/* Scanline for critical */}
      {level === 'critical' && (
        <motion.div 
          className="absolute inset-0 pointer-events-none"
          animate={{ opacity: [0.05, 0.15, 0.05] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          style={{ background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(239,68,68,0.03) 2px, rgba(239,68,68,0.03) 4px)' }}
        />
      )}

      <div className="relative z-10 p-4 flex items-center gap-4">
        {/* Icon section */}
        <div className={`relative shrink-0`}>
          <motion.div
            animate={level === 'critical' ? { scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] } : {}}
            transition={{ repeat: Infinity, duration: 2 }}
            className={`w-14 h-14 rounded-xl flex items-center justify-center border ${
              level === 'critical' ? 'bg-destructive/10 border-destructive/30' :
              level === 'high' ? 'bg-orange-500/10 border-orange-500/25' :
              level === 'medium' ? 'bg-gold/10 border-gold/25' :
              'bg-neon-green/10 border-neon-green/25'
            }`}
          >
            <span className="text-3xl">🟢</span>
          </motion.div>
          {/* Badge with absence count */}
          <div className={`absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-md text-[8px] font-black font-mono border ${
            level === 'critical' ? 'bg-destructive text-white border-destructive' :
            level === 'high' ? 'bg-orange-500 text-white border-orange-600' :
            level === 'medium' ? 'bg-[hsl(var(--gold))] text-background border-[hsl(var(--gold))]' :
            'bg-[hsl(var(--neon-green))] text-background border-[hsl(var(--neon-green))]'
          }`}>
            {absence}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Icon className={`w-3.5 h-3.5 ${config.color}`} />
            <span className={`text-[10px] font-display font-bold tracking-[0.15em] uppercase ${config.color}`}>
              Pressão do Zero
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-3 bg-background/20 rounded-full overflow-hidden mb-2 border border-border/10 relative">
            <motion.div 
              className={`h-full rounded-full bg-gradient-to-r ${config.bar} ${config.barShadow}`} 
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }} 
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
            {/* Threshold markers */}
            <div className="absolute top-0 bottom-0 left-[20%] w-px bg-muted-foreground/10" />
            <div className="absolute top-0 bottom-0 left-[35%] w-px bg-muted-foreground/10" />
            <div className="absolute top-0 bottom-0 left-[55%] w-px bg-gold/20" />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`text-[9px] font-bold ${config.color}`}>{config.label}</span>
              <span className="text-[8px] text-muted-foreground/40 font-mono">{absence}/37 média</span>
            </div>
            {config.tip && (
              <span className="text-[8px] text-muted-foreground/50 font-mono flex items-center gap-1">
                → {config.tip}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Critical action bar */}
      {level === 'critical' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="border-t border-destructive/15 px-4 py-2 bg-destructive/5 flex items-center justify-between"
        >
          <span className="text-[8px] font-bold text-destructive/80">⚡ Ação recomendada: apostar Vizinhos do Zero</span>
          <span className="text-[7px] font-mono text-destructive/50">{absence} giros sem zero</span>
        </motion.div>
      )}
    </motion.div>
  );
};

export default ZeroPressure;
