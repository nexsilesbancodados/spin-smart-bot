import { Clock } from 'lucide-react';
import { motion } from 'framer-motion';

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const WHEEL = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const VOISINS_NUMS = [22,18,29,7,28,12,35,3,26,0,32,15,19,4,21,2,25];
const TIERS_NUMS = [27,13,36,11,30,8,23,10,5,24,16,33];
const ORPHELINS_NUMS = [1,20,14,31,9,17,34,6];

const CAVALOS_GROUPS: Record<string, number[]> = {
  '258': [2,5,8,12,15,18,22,25,28,32,35],
  '147': [1,4,7,11,14,17,21,24,27,31,34],
  '03': [0,3,10,13,20,23,30,33],
  '69': [6,9,16,19,26,29,36],
};

const COL1 = [1,4,7,10,13,16,19,22,25,28,31,34];
const COL2 = [2,5,8,11,14,17,20,23,26,29,32,35];
const COL3 = [3,6,9,12,15,18,21,24,27,30,33,36];

const getColor = (n: number): 'red' | 'black' | 'green' => n === 0 ? 'green' : RED_NUMBERS.includes(n) ? 'red' : 'black';
const getSectorName = (n: number) => VOISINS_NUMS.includes(n) ? 'Vois' : TIERS_NUMS.includes(n) ? 'Tier' : ORPHELINS_NUMS.includes(n) ? 'Orph' : 'Zero';
const getCavaloGroup = (n: number) => { for (const [k, v] of Object.entries(CAVALOS_GROUPS)) if (v.includes(n)) return k; return null; };
const getColumn = (n: number) => n === 0 ? '-' : COL1.includes(n) ? 'C1' : COL2.includes(n) ? 'C2' : 'C3';

interface Props {
  allNumbers: number[];
}

const Last12Numbers = ({ allNumbers }: Props) => {
  if (allNumbers.length === 0) return null;

  return (
    <div className="bg-gradient-card rounded-xl border border-border/60 p-4 relative overflow-hidden">
      {/* Accent line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      
      <div className="flex items-center gap-2 mb-4">
        <div className="w-6 h-6 rounded-md bg-primary/15 border border-primary/30 flex items-center justify-center">
          <Clock className="w-3.5 h-3.5 text-primary" />
        </div>
        <span className="font-display text-[10px] font-bold tracking-[0.2em] text-primary uppercase text-glow-cyan">
          Últimos 12 Números
        </span>
        <div className="flex-1 h-px bg-gradient-to-r from-primary/20 to-transparent ml-2" />
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-2">
        {allNumbers.slice(0, 12).map((n, i) => {
          const color = getColor(n);
          const dozen = n === 0 ? '-' : n <= 12 ? '1ª Dz' : n <= 24 ? '2ª Dz' : '3ª Dz';
          const col = getColumn(n);
          const terminal = `T${n % 10}`;
          const sector = getSectorName(n);
          const cavalo = getCavaloGroup(n);
          const freqIn100 = allNumbers.slice(0, 100).filter(x => x === n).length;
          const isLatest = i === 0;

          return (
            <motion.div
              key={`${i}-${n}`}
              initial={isLatest ? { scale: 0.7, opacity: 0 } : false}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3, type: 'spring', stiffness: 200 }}
              className={`flex flex-col items-center rounded-xl border transition-all ${
                isLatest
                  ? 'bg-gradient-to-b from-primary/15 to-primary/5 border-primary/40 shadow-neon-cyan'
                  : 'bg-secondary/20 border-border/40 hover:border-primary/30 hover:bg-secondary/40'
              }`}
              style={{ padding: '8px 3px' }}
            >
              {/* Number Ball */}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-lg transition-all ${
                color === 'red'
                  ? 'bg-gradient-to-br from-red-500 to-red-700 text-white border-2 border-red-400/30'
                  : color === 'black'
                  ? 'bg-gradient-to-br from-gray-600 to-gray-900 text-white border-2 border-gray-500/30'
                  : 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white border-2 border-emerald-400/30'
              } ${isLatest ? 'ring-2 ring-primary/60 ring-offset-1 ring-offset-background scale-110 shadow-[0_0_15px_hsl(var(--primary)/0.3)]' : ''}`}>
                {n}
              </div>

              {/* Color Label */}
              <span className={`text-[7px] font-bold mt-1.5 font-mono ${
                color === 'red' ? 'text-red-400' : color === 'black' ? 'text-gray-400' : 'text-emerald-400'
              }`}>
                {color === 'red' ? 'VRM' : color === 'black' ? 'PRT' : 'VRD'}
              </span>

              {/* Info Grid */}
              <div className="w-full mt-1.5 space-y-0.5">
                <div className="flex justify-between px-1">
                  <span className="text-[6px] text-muted-foreground/60 font-mono">{dozen}</span>
                </div>
                <div className="flex justify-between px-1">
                  <span className="text-[6px] text-muted-foreground/60 font-mono">{col}</span>
                  <span className="text-[6px] text-muted-foreground/60 font-mono">{terminal}</span>
                </div>

                {/* Cavalos */}
                <div className="flex justify-center">
                  {cavalo ? (
                    <span className="text-[6px] text-gold font-bold">🐎 {cavalo}</span>
                  ) : (
                    <span className="text-[6px] text-muted-foreground/30">—</span>
                  )}
                </div>

                {/* Sector */}
                <div className="flex justify-center">
                  <span className={`text-[6px] font-semibold ${
                    sector === 'Vois' ? 'text-primary' : sector === 'Tier' ? 'text-neon-pink' : sector === 'Orph' ? 'text-accent' : 'text-neon-green'
                  }`}>
                    {sector}
                  </span>
                </div>

                {/* Frequency */}
                <div className="flex justify-center mt-0.5">
                  <span className={`text-[7px] font-mono font-bold px-1.5 py-px rounded-sm ${
                    freqIn100 >= 5
                      ? 'bg-destructive/15 text-destructive border border-destructive/20'
                      : freqIn100 >= 3
                      ? 'bg-gold/15 text-gold border border-gold/20'
                      : 'bg-secondary/40 text-muted-foreground border border-border/30'
                  }`}>
                    {freqIn100}x/100
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default Last12Numbers;