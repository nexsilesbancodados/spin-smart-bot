import { motion } from 'framer-motion';

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
    <div className="glass rounded-xl border border-primary/20 p-3.5 card-hover">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/15 flex items-center justify-center text-sm">🧲</div>
        <div className="flex-1 min-w-0">
          <span className="font-display text-[10px] tracking-[0.12em] font-bold text-primary">RADAR DE PUXADA</span>
          <div className="text-[7px] text-muted-foreground">Nº {latestNumber} → alvos mais prováveis</div>
        </div>
        <span className="text-[8px] px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/15 font-bold">
          {activePull.dominantSector}
        </span>
      </div>

      {/* Mini cylinder */}
      <div className="flex flex-wrap gap-[3px] justify-center py-2">
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
                  ? `${c === 'red' ? 'bg-red-600' : c === 'black' ? 'bg-zinc-800' : 'bg-emerald-600'} text-white border-amber-400/50 shadow-sm shadow-amber-400/15`
                  : `${c === 'red' ? 'bg-red-600' : c === 'black' ? 'bg-zinc-800' : 'bg-emerald-600'} text-white/30 border-white/5`
              }`}
            >
              {n}
              {isTarget && targetInfo && (
                <span className="absolute -top-2.5 -right-1.5 text-[5px] font-bold text-amber-400 bg-card/95 rounded-full px-1 py-px border border-amber-400/20">
                  {targetInfo.count}×
                </span>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Pull targets */}
      <div className="flex flex-wrap gap-1.5 mt-3">
        {activePull.targets.slice(0, 5).map((t, i) => (
          <div key={t.num} className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[8px] border backdrop-blur-sm ${
            i === 0 ? 'bg-primary/10 border-primary/20 text-primary font-bold' : 'bg-secondary/40 border-border/30 text-muted-foreground'
          }`}>
            <span className="font-mono font-bold">{t.num}</span>
            <span className="text-muted-foreground/60">→</span>
            <span>{t.count}×</span>
            <span className="text-muted-foreground/40">({t.sector.slice(0, 4)})</span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border/20 text-[7px] text-muted-foreground/50">
        <span>Vizinhos repetidos: <b className="text-foreground/60">{activePull.neighborRepeat}×</b></span>
        <span>Setor: <b className="text-primary/60">{activePull.dominantSector}</b></span>
      </div>
    </div>
  );
};

export default PullRadar;
