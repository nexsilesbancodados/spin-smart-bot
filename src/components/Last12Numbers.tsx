import { Clock } from 'lucide-react';

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

const getColor = (n: number): 'red' | 'black' | 'green' => n === 0 ? 'green' : RED_NUMBERS.includes(n) ? 'red' : 'black';
const getSectorName = (n: number) => VOISINS_NUMS.includes(n) ? 'Voisins' : TIERS_NUMS.includes(n) ? 'Tiers' : ORPHELINS_NUMS.includes(n) ? 'Orphelins' : 'Zero';
const getCavaloGroup = (n: number) => { for (const [k, v] of Object.entries(CAVALOS_GROUPS)) if (v.includes(n)) return k; return null; };

interface Props {
  allNumbers: number[];
}

const Last12Numbers = ({ allNumbers }: Props) => {
  if (allNumbers.length === 0) return null;

  return (
    <div className="bg-card/90 border border-border rounded-xl p-3">
      <div className="flex items-center gap-2 mb-2">
        <Clock className="w-4 h-4 text-primary" />
        <span className="text-[10px] font-bold tracking-[0.15em] text-primary">ÚLTIMOS 12 NÚMEROS</span>
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-1.5">
        {allNumbers.slice(0, 12).map((n, i) => {
          const color = getColor(n);
          const dozen = n === 0 ? '-' : n <= 12 ? '1ª' : n <= 24 ? '2ª' : '3ª';
          const col = n === 0 ? '-' : `C${((n - 1) % 3) + 1}`;
          const terminal = n % 10;
          const sector = getSectorName(n);
          const cavalo = getCavaloGroup(n);
          const freqIn100 = allNumbers.slice(0, 100).filter(x => x === n).length;
          return (
            <div key={i} className="flex flex-col items-center gap-0.5">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                color === 'red' ? 'bg-roulette-red text-white border-red-400/50' :
                color === 'black' ? 'bg-roulette-black text-white border-gray-500/50' :
                'bg-roulette-green text-white border-green-400/50'
              } ${i === 0 ? 'ring-2 ring-primary/60 scale-110 shadow-lg shadow-primary/20' : ''}`}>
                {n}
              </div>
              <span className={`text-[7px] font-bold ${color === 'red' ? 'text-red-400' : color === 'black' ? 'text-gray-400' : 'text-green-400'}`}>
                {color === 'red' ? 'VRM' : color === 'black' ? 'PRT' : 'VRD'}
              </span>
              <span className="text-[7px] text-muted-foreground">{dozen} Dz</span>
              <span className="text-[7px] text-muted-foreground">{col}</span>
              <span className="text-[7px] text-muted-foreground">T{terminal}</span>
              {cavalo && <span className="text-[7px] text-orange-400 font-bold">🐎{cavalo}</span>}
              <span className="text-[7px] text-muted-foreground">{sector.slice(0, 4)}</span>
              <span className={`text-[7px] font-mono font-bold ${freqIn100 >= 5 ? 'text-red-400' : freqIn100 >= 3 ? 'text-yellow-400' : 'text-muted-foreground'}`}>
                {freqIn100}x/100
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Last12Numbers;
