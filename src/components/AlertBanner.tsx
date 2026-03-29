import { useRoulette } from '@/contexts/RouletteContext';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, Flame, Target } from 'lucide-react';

const iconMap = {
  streak: Flame,
  absence: AlertTriangle,
  pattern: Target,
};

const AlertBanner = () => {
  const { alerts, dismissAlert } = useRoulette();

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <AnimatePresence mode="popLayout">
        {alerts.slice(0, 3).map((alert) => {
          const Icon = iconMap[alert.type];
          return (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className={`relative overflow-hidden rounded-lg border px-3 py-2 flex items-center gap-2 text-xs font-semibold ${
                alert.type === 'streak'
                  ? 'bg-destructive/15 border-destructive/40 text-destructive'
                  : alert.type === 'pattern'
                  ? 'bg-primary/15 border-primary/40 text-primary'
                  : 'bg-accent/15 border-accent/40 text-accent'
              }`}
            >
              {/* Animated glow */}
              <motion.div
                className="absolute inset-0 opacity-20"
                animate={{ opacity: [0.1, 0.25, 0.1] }}
                transition={{ duration: 2, repeat: Infinity }}
                style={{
                  background: alert.type === 'streak'
                    ? 'linear-gradient(90deg, transparent, hsl(0 72% 51% / 0.3), transparent)'
                    : alert.type === 'pattern'
                    ? 'linear-gradient(90deg, transparent, hsl(145 80% 42% / 0.3), transparent)'
                    : 'linear-gradient(90deg, transparent, hsl(43 96% 56% / 0.3), transparent)',
                }}
              />
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1 tracking-wide font-display text-[10px] uppercase">
                ESTRATÉGIA DETECTADA
              </span>
              <span className="flex-1 text-foreground font-body">{alert.message}</span>
              <button onClick={() => dismissAlert(alert.id)} className="p-0.5 hover:bg-foreground/10 rounded">
                <X className="w-3 h-3" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

export default AlertBanner;
