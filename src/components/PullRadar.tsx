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

  // Find pull pattern for latest number
  const activePull = pullPatterns.find(p => p.source === latestNumber);
  if (!activePull) return null;

  const targetNums = new Set(activePull.targets.map(t => t.num));
  const sourceIdx = WHEEL.indexOf(latestNumber);

  return (
    <div className="bg-card/90 rounded-xl border border-primary/30 p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm">🧲</span>
        <span className="font-display text-[10px] tracking-[0.15em] font-bold text-primary">RADAR DE PUXADA — Nº {latestNumber}</span>
        <span className="text-[7px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 font-bold ml-auto">
          → {activePull.dominantSector}
        </span>
      </div>

      {/* Mini cylinder with pull arrows */}
      <div className="flex flex-wrap gap-[2px] justify-center">
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
                scale: isSource ? 1.3 : isTarget ? 1.1 : 0.85,
                opacity: isSource || isTarget ? 1 : 0.3,
              }}
              className={`relative w-[20px] h-[20px] rounded-full flex items-center justify-center text-[6px] font-bold border transition-all ${
                isSource
                  ? 'bg-primary text-primary-foreground border-primary ring-2 ring-primary/50 shadow-lg shadow-primary/30 z-10'
                  : isTarget
                  ? `${c === 'red' ? 'bg-roulette-red' : c === 'black' ? 'bg-roulette-black' : 'bg-roulette-green'} text-white border-amber-400/60 shadow-sm shadow-amber-400/20`
                  : `${c === 'red' ? 'bg-roulette-red' : c === 'black' ? 'bg-roulette-black' : 'bg-roulette-green'} text-white/40 border-white/5`
              }`}
            >
              {n}
              {isTarget && targetInfo && (
                <span className="absolute -top-2 -right-1 text-[5px] font-bold text-amber-400 bg-card/90 rounded px-0.5">
                  {targetInfo.count}x
                </span>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Pull targets list */}
      <div className="flex flex-wrap gap-1.5 mt-2">
        {activePull.targets.slice(0, 5).map((t, i) => (
          <div key={t.num} className={`flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[8px] border ${
            i === 0 ? 'bg-primary/15 border-primary/30 text-primary font-bold' : 'bg-secondary/60 border-border text-muted-foreground'
          }`}>
            <span className="font-mono">{t.num}</span>
            <span>→{t.count}x</span>
            <span className="text-muted-foreground">({t.sector.slice(0, 4)})</span>
          </div>
        ))}
      </div>

      <p className="text-[7px] text-muted-foreground mt-1">
        Vizinhos repetidos: {activePull.neighborRepeat}x • Setor dominante: {activePull.dominantSector}
      </p>
    </div>
  );
};

export default PullRadar;
