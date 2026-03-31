import { motion } from 'framer-motion';
import { Magnet, MapPin, Crosshair } from 'lucide-react';

const WHEEL = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const RED_NUMBERS = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
const getColor = (n: number) => n === 0 ? 'green' : RED_NUMBERS.includes(n) ? 'red' : 'black';

interface PullPattern {
  source: number;
  targets: { num: number; count: number; sector: string }[];
  dominantSector: string;
  neighborRepeat: number;
}

interface Props {
  pullPatterns: PullPattern[];
  latestNumber: number;
}

const PullRadar = ({ pullPatterns, latestNumber }: Props) => {
  if (!pullPatterns || pullPatterns.length === 0) return null;
  const activePull = pullPatterns.find(p => p.source === latestNumber);
  if (!activePull) return null;

  const targetNums = new Set(activePull.targets.map(t => t.num));
  const maxCount = Math.max(...activePull.targets.map(t => t.count), 1);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl overflow-hidden border border-primary/20"
    >
      {/* Header */}
      <div className="relative px-4 pt-4 pb-3">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-neon-pink/4" />
        <div className="relative flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/15 to-neon-pink/10 border border-primary/20 flex items-center justify-center shadow-[0_0_12px_hsl(var(--primary)/0.15)]">
            <Magnet className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="font-display text-[10px] tracking-[0.15em] font-bold text-primary uppercase">Radar de Puxada</span>
            <div className="text-[7px] text-muted-foreground/50 font-mono">Nº {latestNumber} → alvos mais prováveis</div>
          </div>
          <span className="text-[8px] px-2.5 py-1 rounded-lg glass text-primary border border-primary/15 font-bold font-display tracking-wider">
            {activePull.dominantSector}
          </span>
        </div>
      </div>

      {/* Mini cylinder */}
      <div className="px-3 pb-3">
        <div className="flex flex-wrap gap-[3px] justify-center py-2.5 glass rounded-xl p-3 border border-border/10">
          {WHEEL.map((n, i) => {
            const isSource = n === latestNumber;
            const isTarget = targetNums.has(n);
            const targetInfo = activePull.targets.find(t => t.num === n);
            const c = getColor(n);

            return (
              <motion.div
                key={i}
                initial={{ scale: 0.8 }}
                animate={{
                  scale: isSource ? 1.35 : isTarget ? 1.15 : 0.85,
                  opacity: isSource || isTarget ? 1 : 0.15,
                }}
                transition={{ duration: 0.3, delay: isTarget ? i * 0.01 : 0 }}
                className={`relative w-[22px] h-[22px] rounded-full flex items-center justify-center text-[7px] font-bold border transition-all ${
                  isSource
                    ? 'bg-primary text-primary-foreground border-primary ring-2 ring-primary/40 shadow-[0_0_12px_hsl(var(--primary)/0.3)] z-10'
                    : isTarget
                    ? `${c === 'red' ? 'bg-red-600' : c === 'black' ? 'bg-zinc-800' : 'bg-emerald-600'} text-white border-[hsl(var(--gold))]/50 shadow-[0_0_6px_hsl(var(--gold)/0.2)]`
                    : `${c === 'red' ? 'bg-red-600' : c === 'black' ? 'bg-zinc-800' : 'bg-emerald-600'} text-white/30 border-white/5`
                }`}
              >
                {n}
                {isTarget && targetInfo && (
                  <span className="absolute -top-2.5 -right-1.5 text-[5px] font-bold text-[hsl(var(--gold))] bg-card/95 rounded-full px-1 py-px border border-[hsl(var(--gold))]/20">
                    {targetInfo.count}×
                  </span>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Pull targets with bars */}
      <div className="px-4 pb-3 space-y-1.5">
        <div className="flex items-center gap-1.5 mb-1">
          <Crosshair className="w-3 h-3 text-primary/50" />
          <span className="text-[8px] font-bold text-muted-foreground/60 font-display tracking-wider uppercase">Alvos Prioritários</span>
        </div>
        {activePull.targets.slice(0, 5).map((t, i) => {
          const c = getColor(t.num);
          const pct = (t.count / maxCount) * 100;
          return (
            <div key={t.num} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[9px] font-bold text-white shrink-0 ${
                c === 'red' ? 'bg-red-600' : c === 'green' ? 'bg-emerald-600' : 'bg-zinc-800'
              } ${i === 0 ? 'ring-1 ring-primary/40 shadow-[0_0_6px_hsl(var(--primary)/0.15)]' : ''}`}>
                {t.num}
              </div>
              <div className="flex-1">
                <div className="h-1.5 bg-background/20 rounded-full overflow-hidden border border-border/10">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, delay: i * 0.1 }}
                    className={`h-full rounded-full ${
                      i === 0 ? 'bg-gradient-to-r from-primary to-neon-pink' :
                      i <= 2 ? 'bg-primary/60' : 'bg-muted-foreground/30'
                    }`}
                  />
                </div>
              </div>
              <span className="text-[8px] font-mono font-bold text-foreground/70 w-6 text-right">{t.count}×</span>
              <span className="text-[7px] text-muted-foreground/30 w-10 text-right">{t.sector.slice(0, 5)}</span>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-4 pb-4">
        <div className="flex items-center gap-4 pt-2.5 border-t border-border/15 text-[8px] text-muted-foreground/50">
          <div className="flex items-center gap-1">
            <MapPin className="w-2.5 h-2.5" />
            <span>Vizinhos: <b className="text-foreground/60">{activePull.neighborRepeat}×</b></span>
          </div>
          <span>Setor: <b className="text-primary/60">{activePull.dominantSector}</b></span>
        </div>
      </div>
    </motion.div>
  );
};

export default PullRadar;
