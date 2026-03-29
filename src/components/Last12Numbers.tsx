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
    <div className="bg-card/95 border border-border rounded-xl p-3 backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-primary" />
        <span className="font-display text-[10px] font-bold tracking-[0.18em] text-primary uppercase">Últimos 12 Números</span>
        <div className="flex-1 h-px bg-gradient-to-r from-primary/30 to-transparent ml-2" />
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-1.5">
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
              className={`flex flex-col items-center rounded-lg border transition-all ${
                isLatest
                  ? 'bg-gradient-to-b from-primary/15 to-primary/5 border-primary/40 shadow-md shadow-primary/10'
                  : 'bg-secondary/30 border-border/60 hover:border-border hover:bg-secondary/50'
              }`}
              style={{ padding: '6px 2px' }}
            >
              {/* Number Ball */}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-md transition-all ${
                color === 'red'
                  ? 'bg-gradient-to-br from-red-500 to-red-700 text-white border-2 border-red-400/40'
                  : color === 'black'
                  ? 'bg-gradient-to-br from-gray-700 to-gray-900 text-white border-2 border-gray-500/40'
                  : 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white border-2 border-emerald-400/40'
              } ${isLatest ? 'ring-2 ring-primary/50 ring-offset-1 ring-offset-background scale-110' : ''}`}>
                {n}
              </div>

              {/* Color Label */}
              <span className={`text-[7px] font-bold mt-1 ${
                color === 'red' ? 'text-red-400' : color === 'black' ? 'text-gray-400' : 'text-emerald-400'
              }`}>
                {color === 'red' ? 'VRM' : color === 'black' ? 'PRT' : 'VRD'}
              </span>

              {/* Info Grid */}
              <div className="w-full mt-1 space-y-px">
                <div className="flex justify-between px-1">
                  <span className="text-[6px] text-muted-foreground/70">{dozen}</span>
                </div>
                <div className="flex justify-between px-1">
                  <span className="text-[6px] text-muted-foreground/70">{col}</span>
                  <span className="text-[6px] text-muted-foreground/70">{terminal}</span>
                </div>

                {/* Cavalos */}
                <div className="flex justify-center">
                  {cavalo ? (
                    <span className="text-[6px] text-amber-400 font-bold">🐎 {cavalo}</span>
                  ) : (
                    <span className="text-[6px] text-muted-foreground/40">—</span>
                  )}
                </div>

                {/* Sector */}
                <div className="flex justify-center">
                  <span className={`text-[6px] font-semibold ${
                    sector === 'Vois' ? 'text-cyan-400' : sector === 'Tier' ? 'text-purple-400' : sector === 'Orph' ? 'text-rose-400' : 'text-emerald-400'
                  }`}>
                    {sector}
                  </span>
                </div>

                {/* Frequency */}
                <div className="flex justify-center mt-0.5">
                  <span className={`text-[7px] font-mono font-bold px-1.5 py-px rounded-sm ${
                    freqIn100 >= 5
                      ? 'bg-red-500/15 text-red-400 border border-red-500/20'
                      : freqIn100 >= 3
                      ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                      : 'bg-secondary/60 text-muted-foreground border border-border/40'
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
