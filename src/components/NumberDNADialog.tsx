import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { motion } from 'framer-motion';
import { Crosshair, Magnet, BarChart3, Target } from 'lucide-react';

const WHEEL = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const RED_NUMBERS = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
const VOISINS_NUMS = [22,18,29,7,28,12,35,3,26,0,32,15,19,4,21,2,25];
const TIERS_NUMS = [27,13,36,11,30,8,23,10,5,24,16,33];

const getColor = (n: number) => n === 0 ? 'green' : RED_NUMBERS.includes(n) ? 'red' : 'black';
const getSector = (n: number) => VOISINS_NUMS.includes(n) ? 'Voisins' : TIERS_NUMS.includes(n) ? 'Tiers' : 'Orphelins';

const wheelDist = (a: number, b: number) => {
  const ia = WHEEL.indexOf(a), ib = WHEEL.indexOf(b);
  if (ia === -1 || ib === -1) return 99;
  const d = Math.abs(ia - ib);
  return Math.min(d, WHEEL.length - d);
};

interface Props {
  number: number | null;
  allNumbers: number[];
  open: boolean;
  onClose: () => void;
}

const NumberDNADialog = ({ number, allNumbers, open, onClose }: Props) => {
  if (number === null) return null;

  const positions = allNumbers.map((n, i) => n === number ? i : -1).filter(i => i >= 0);
  const count = positions.length;

  // Average wheel distance to next number (magnet)
  const nextDists: number[] = [];
  const nextNums: number[] = [];
  positions.forEach(p => {
    if (p + 1 < allNumbers.length) {
      nextDists.push(wheelDist(number, allNumbers[p + 1]));
      nextNums.push(allNumbers[p + 1]);
    }
  });
  const avgDist = nextDists.length > 0 ? (nextDists.reduce((a, b) => a + b, 0) / nextDists.length) : 0;

  // Most common next sectors
  const sectorFreq: Record<string, number> = { Voisins: 0, Tiers: 0, Orphelins: 0 };
  nextNums.forEach(n => sectorFreq[getSector(n)]++);
  const topSector = Object.entries(sectorFreq).sort(([,a],[,b]) => b - a)[0];

  // Delays
  const delays = positions.slice(0, -1).map((p, i) => positions[i + 1] - p);
  const avgDelay = delays.length > 0 ? (delays.reduce((a, b) => a + b, 0) / delays.length) : 0;

  // Pull zone: numbers within avgDist on the wheel from this number
  const numIdx = WHEEL.indexOf(number);
  const pullRange = Math.round(avgDist) || 5;
  const pullNums: number[] = [];
  if (numIdx !== -1) {
    for (let d = -pullRange; d <= pullRange; d++) {
      const idx = ((numIdx + d) % WHEEL.length + WHEEL.length) % WHEEL.length;
      if (WHEEL[idx] !== number) pullNums.push(WHEEL[idx]);
    }
  }

  // Top next numbers
  const nextFreq: Record<number, number> = {};
  nextNums.forEach(n => { nextFreq[n] = (nextFreq[n] || 0) + 1; });
  const topNext = Object.entries(nextFreq).sort(([,a],[,b]) => b - a).slice(0, 5);

  const colorClass = (n: number) => {
    const c = getColor(n);
    return c === 'red' ? 'bg-roulette-red text-white' : c === 'black' ? 'bg-roulette-black text-white' : 'bg-roulette-green text-white';
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md bg-card border-primary/30 p-0 overflow-hidden">
        <div className="bg-gradient-to-r from-primary/20 via-card to-primary/10 p-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-primary">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${colorClass(number)} border-2 border-white/30 shadow-lg`}>
                {number}
              </div>
              <div>
                <span className="font-display text-sm tracking-[0.15em]">DNA DO NÚMERO {number}</span>
                <p className="text-[9px] text-muted-foreground font-normal mt-0.5">
                  Setor: {getSector(number)} • Terminal: {number % 10} • {getColor(number) === 'red' ? 'Vermelho' : getColor(number) === 'black' ? 'Preto' : 'Verde'}
                </p>
              </div>
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="p-4 space-y-3">
          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-secondary/50 rounded-lg p-2 text-center border border-border">
              <BarChart3 className="w-4 h-4 text-primary mx-auto mb-1" />
              <span className="text-xl font-bold font-mono text-foreground">{count}</span>
              <span className="text-[7px] text-muted-foreground block">APARIÇÕES</span>
            </div>
            <div className="bg-secondary/50 rounded-lg p-2 text-center border border-border">
              <Magnet className="w-4 h-4 text-amber-400 mx-auto mb-1" />
              <span className="text-xl font-bold font-mono text-foreground">{avgDist.toFixed(1)}</span>
              <span className="text-[7px] text-muted-foreground block">SALTO MÉDIO</span>
            </div>
            <div className="bg-secondary/50 rounded-lg p-2 text-center border border-border">
              <Target className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
              <span className="text-xl font-bold font-mono text-foreground">{avgDelay.toFixed(0)}</span>
              <span className="text-[7px] text-muted-foreground block">DELAY MÉDIO</span>
            </div>
          </div>

          {/* Magnet description */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-2">
            <span className="text-[8px] font-bold text-primary block mb-0.5">🧲 O IMÃ</span>
            <p className="text-[9px] text-foreground/80">
              Sempre que o <span className="font-bold">{number}</span> sai, a bola viaja em média <span className="font-bold text-primary">{avgDist.toFixed(1)} casas</span> no cilindro.
              {topSector && topSector[1] > 0 && (
                <> Em <span className="font-bold text-amber-400">{nextNums.length > 0 ? ((topSector[1] / nextNums.length) * 100).toFixed(0) : 0}%</span> das vezes, o próximo número cai no setor <span className="font-bold">{topSector[0]}</span>.</>
              )}
            </p>
          </div>

          {/* Top next numbers */}
          {topNext.length > 0 && (
            <div>
              <span className="text-[8px] font-bold text-foreground block mb-1">➡️ TOP NÚMEROS QUE SAEM DEPOIS</span>
              <div className="flex flex-wrap gap-1.5">
                {topNext.map(([num, freq]) => (
                  <div key={num} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-secondary/60 border border-border">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold ${colorClass(Number(num))} border border-white/20`}>{num}</div>
                    <span className="text-[8px] font-mono font-bold text-foreground">{freq}x</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mini cylinder */}
          <div>
            <span className="text-[8px] font-bold text-foreground block mb-1">🎰 ZONA DE PUXADA NO CILINDRO</span>
            <div className="flex flex-wrap gap-[3px] justify-center">
              {WHEEL.map((n, i) => {
                const isPull = pullNums.includes(n);
                const isMain = n === number;
                return (
                  <motion.div
                    key={i}
                    initial={{ scale: 0.8 }}
                    animate={{ scale: isMain ? 1.2 : isPull ? 1.05 : 0.9, opacity: isMain || isPull ? 1 : 0.3 }}
                    className={`w-[22px] h-[22px] rounded-full flex items-center justify-center text-[7px] font-bold border transition-all ${
                      isMain
                        ? 'bg-primary text-primary-foreground border-primary ring-2 ring-primary/50 shadow-lg shadow-primary/30'
                        : isPull
                        ? `${colorClass(n)} border-primary/40 shadow-sm shadow-primary/10`
                        : `${colorClass(n)} border-white/5`
                    }`}
                  >
                    {n}
                  </motion.div>
                );
              })}
            </div>
            <p className="text-[7px] text-muted-foreground text-center mt-1">
              Zona iluminada = área que o {number} costuma "puxar" ({pullNums.length} números)
            </p>
          </div>

          {/* Suggested bet */}
          <div className="bg-gradient-to-r from-primary/15 to-amber-500/10 border border-primary/30 rounded-lg p-2">
            <span className="text-[8px] font-bold text-primary block mb-1">💎 APOSTA SUGERIDA</span>
            <p className="text-[9px] text-foreground/80">
              Cobertura da zona de puxada: aposte nos <span className="font-bold text-primary">{Math.min(pullNums.length, 8)} vizinhos</span> do {number} no cilindro
              {topSector && topSector[1] > 0 && <> + reforço no setor <span className="font-bold text-amber-400">{topSector[0]}</span></>}.
            </p>
            <div className="flex flex-wrap gap-1 mt-1">
              {pullNums.slice(0, 8).map(n => (
                <div key={n} className={`w-5 h-5 rounded-full flex items-center justify-center text-[7px] font-bold ${colorClass(n)} border border-primary/30`}>{n}</div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NumberDNADialog;
