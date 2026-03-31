import { motion } from 'framer-motion';
import { Magnet, MapPin } from 'lucide-react';

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

  return (
    <div className="glass rounded-2xl overflow-hidden border border-primary/20 card-hover">
      {/* Header */}
      <div className="relative px-4 pt-4 pb-3">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/4 via-transparent to-neon-pink/3" />
        <div className="relative flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/15 to-neon-pink/10 border border-primary/20 flex items-center justify-center shadow-neon-cyan">
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
        <div className="flex flex-wrap gap-[3px] justify-center py-2 glass rounded-xl p-3 border border-border/10">
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
                  opacity: isSource || isTarget ? 1 : 0.2,
                }}
                className={`relative w-[22px] h-[22px] rounded-full flex items-center justify-center text-[7px] font-bold border transition-all ${
                  isSource
                    ? 'bg-primary text-primary-foreground border-primary ring-2 ring-primary/40 shadow-lg shadow-primary/25 z-10'
                    : isTarget
                    ? `${c === 'red' ? 'bg-red-600' : c === 'black' ? 'bg-zinc-800' : 'bg-emerald-600'} text-white border-gold/50 shadow-sm shadow-gold/15`
                    : `${c === 'red' ? 'bg-red-600' : c === 'black' ? 'bg-zinc-800' : 'bg-emerald-600'} text-white/30 border-white/5`
                }`}
              >
                {n}
                {isTarget && targetInfo && (
                  <span className="absolute -top-2.5 -right-1.5 text-[5px] font-bold text-gold bg-card/95 rounded-full px-1 py-px border border-gold/20">
                    {targetInfo.count}×
                  </span>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Pull targets */}
      <div className="px-4 pb-3">
        <div className="flex flex-wrap gap-1.5">
          {activePull.targets.slice(0, 5).map((t, i) => (
            <div key={t.num} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[8px] border backdrop-blur-sm ${
              i === 0 ? 'glass border-primary/20 text-primary font-bold' : 'glass border-border/15 text-muted-foreground'
            }`}>
              <span className="font-mono font-bold">{t.num}</span>
              <span className="text-muted-foreground/40">→</span>
              <span className="font-bold">{t.count}×</span>
              <span className="text-muted-foreground/30">({t.sector.slice(0, 4)})</span>
            </div>
          ))}
        </div>
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
    </div>
  );
};

export default PullRadar;
