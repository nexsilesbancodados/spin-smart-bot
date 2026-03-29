import { useRoulette } from '@/contexts/RouletteContext';
import { motion, AnimatePresence } from 'framer-motion';
import { getNumberColor } from '@/lib/roulette';

const AnimatedHistory = () => {
  const { history } = useRoulette();
  const last20 = history.slice(0, 20);

  return (
    <div className="bg-card rounded-lg p-3 border border-border">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-display text-[10px] text-muted-foreground tracking-widest uppercase">
          Histórico Rodadas
        </h3>
        <span className="text-[10px] text-muted-foreground font-mono">{history.length} total</span>
      </div>
      <div className="flex flex-wrap gap-1">
        <AnimatePresence mode="popLayout">
          {last20.map((entry, i) => {
            const colorClass =
              entry.color === 'red'
                ? 'bg-roulette-red'
                : entry.color === 'black'
                ? 'bg-roulette-black'
                : 'bg-roulette-green';
            return (
              <motion.div
                key={`${entry.value}-${entry.timestamp.getTime()}`}
                layout
                initial={{ opacity: 0, scale: 0, rotate: -180 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{
                  type: 'spring',
                  stiffness: 500,
                  damping: 25,
                  delay: i === 0 ? 0 : 0,
                }}
                className={`${colorClass} w-8 h-8 rounded flex items-center justify-center text-xs font-bold text-white shadow-md ${
                  i === 0 ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : ''
                }`}
              >
                {entry.value}
              </motion.div>
            );
          })}
        </AnimatePresence>
        {last20.length === 0 && (
          <p className="text-muted-foreground text-xs w-full text-center py-2">
            Aguardando números...
          </p>
        )}
      </div>
    </div>
  );
};

export default AnimatedHistory;
