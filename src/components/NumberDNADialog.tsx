import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { motion } from 'framer-motion';
import { Magnet, BarChart3, Target } from 'lucide-react';

const WHEEL = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const RED_NUMBERS = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
const VOISINS_NUMS = [22,18,29,7,28,12,35,3,26,0,32,15,19,4,21,2,25];
const TIERS_NUMS = [27,13,36,11,30,8,23,10,5,24,16,33];

const getColor = (n: number) => n === 0 ? 'green' : RED_NUMBERS.includes(n) ? 'red' : 'black';
const getSector = (n: number) => VOISINS_NUMS.includes(n) ? 'Voisins' : TIERS_NUMS.includes(n) ? 'Tiers' : 'Orphelins';
const wheelDist = (a: number, b: number) => { const ia = WHEEL.indexOf(a), ib = WHEEL.indexOf(b); if (ia === -1 || ib === -1) return 99; const d = Math.abs(ia - ib); return Math.min(d, WHEEL.length - d); };

interface Props { number: number | null; allNumbers: number[]; open: boolean; onClose: () => void }

const NumberDNADialog = ({ number, allNumbers, open, onClose }: Props) => {
  if (number === null) return null;

  const positions = allNumbers.map((n, i) => n === number ? i : -1).filter(i => i >= 0);
  const count = positions.length;
  const nextDists: number[] = [];
  const nextNums: number[] = [];
  positions.forEach(p => { if (p + 1 < allNumbers.length) { nextDists.push(wheelDist(number, allNumbers[p + 1])); nextNums.push(allNumbers[p + 1]); } });
  const avgDist = nextDists.length > 0 ? (nextDists.reduce((a, b) => a + b, 0) / nextDists.length) : 0;
  const sectorFreq: Record<string, number> = { Voisins: 0, Tiers: 0, Orphelins: 0 };
  nextNums.forEach(n => sectorFreq[getSector(n)]++);
  const topSector = Object.entries(sectorFreq).sort(([,a],[,b]) => b - a)[0];
  const delays = positions.slice(0, -1).map((p, i) => positions[i + 1] - p);
  const avgDelay = delays.length > 0 ? (delays.reduce((a, b) => a + b, 0) / delays.length) : 0;
  const numIdx = WHEEL.indexOf(number);
  const pullRange = Math.round(avgDist) || 5;
  const pullNums: number[] = [];
  if (numIdx !== -1) { for (let d = -pullRange; d <= pullRange; d++) { const idx = ((numIdx + d) % WHEEL.length + WHEEL.length) % WHEEL.length; if (WHEEL[idx] !== number) pullNums.push(WHEEL[idx]); } }
  const nextFreq: Record<number, number> = {};
  nextNums.forEach(n => { nextFreq[n] = (nextFreq[n] || 0) + 1; });
  const topNext = Object.entries(nextFreq).sort(([,a],[,b]) => b - a).slice(0, 5);

  const colorClass = (n: number) => { const c = getColor(n); return c === 'red' ? 'bg-red-600 text-white' : c === 'black' ? 'bg-zinc-800 text-white' : 'bg-emerald-600 text-white'; };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md glass-strong border-neon-cyan/25 p-0 overflow-hidden shadow-2xl shadow-neon-cyan/10">
        <div className="relative p-5">
          <div className="absolute inset-0 bg-gradient-to-br from-neon-cyan/6 via-transparent to-neon-pink/4" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-cyan/50 to-transparent" />
          <DialogHeader className="relative">
            <DialogTitle className="flex items-center gap-3.5 text-neon-cyan">
              <motion.div 
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black ${colorClass(number)} border-2 border-white/20 shadow-lg shadow-neon-cyan/25 ring-2 ring-neon-cyan/20`}
              >
                {number}
              </motion.div>
              <div>
                <span className="font-display text-sm tracking-[0.15em] font-bold">DNA DO NÚMERO {number}</span>
                <p className="text-[9px] text-muted-foreground/50 font-normal mt-1 flex items-center gap-2 flex-wrap">
                  <span className="px-1.5 py-0.5 rounded-md bg-neon-cyan/8 border border-neon-cyan/15 text-neon-cyan/70">{getSector(number)}</span>
                  <span className="px-1.5 py-0.5 rounded-md bg-neon-pink/8 border border-neon-pink/15 text-neon-pink/70">T{number % 10}</span>
                  <span className={`px-1.5 py-0.5 rounded-md border ${getColor(number) === 'red' ? 'bg-red-500/10 border-red-500/15 text-red-400' : getColor(number) === 'black' ? 'bg-zinc-500/10 border-zinc-500/15 text-zinc-400' : 'bg-emerald-500/10 border-emerald-500/15 text-emerald-400'}`}>
                    {getColor(number) === 'red' ? 'Vermelho' : getColor(number) === 'black' ? 'Preto' : 'Verde'}
                  </span>
                </p>
              </div>
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="p-4 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: <BarChart3 className="w-4 h-4 text-neon-cyan" />, value: count, label: 'APARIÇÕES' },
              { icon: <Magnet className="w-4 h-4 text-gold" />, value: avgDist.toFixed(1), label: 'SALTO MÉDIO' },
              { icon: <Target className="w-4 h-4 text-neon-pink" />, value: avgDelay.toFixed(0), label: 'DELAY MÉDIO' },
            ].map(s => (
              <div key={s.label} className="bg-background/15 rounded-lg p-2 text-center border border-border/10 backdrop-blur-sm">
                <div className="mx-auto mb-1 flex justify-center">{s.icon}</div>
                <span className="text-xl font-bold font-mono text-foreground/80">{s.value}</span>
                <span className="text-[7px] text-muted-foreground/40 block">{s.label}</span>
              </div>
            ))}
          </div>

          {(() => {
            const PULL_DNA: Record<number, number[]> = {
              0:[10,20,30,32,15,26,3,33,31],1:[11,35,16,4,18,28,27,29,33],2:[14,1,13,18,35,29],3:[13,27,6,11,30,8],4:[26,15,18,32,33,16,8],
              5:[3,33,16,24,10,18],6:[8,15,31,21,22,23],7:[16,18,17,30,31],8:[11,9,10],9:[34,35,36,3,16,26,23,24,32,31],10:[20,5,18,11,14,24],
              11:[8,18,16,21],12:[21],13:[31],14:[24,21,18],15:[4,19,21],16:[24,21,18,14],17:[34,6,25],18:[8,18,28],19:[9,19,29],20:[4,14],
              21:[19],22:[33,2],23:[32,11,2],24:[21,18,14],25:[2,4,17,28,29,12,7,18],26:[6,16,26,36,3,0],27:[28,29,24,22,26,33,31,34,35,36],
              28:[13,14,15,16,17,18],29:[35],30:[4,8,16,9,18,22,5,25,3],31:[13],32:[2,12,22,32],33:[16],34:[16],35:[0,3,7,12,26,28,29],36:[3,10,27]
            };
            const T_DG: Record<number, string> = {1:'T1+T6',6:'T1+T6',2:'T2+T7',7:'T2+T7',3:'T3+T8',8:'T3+T8',4:'T4+T9',9:'T4+T9',0:'T0+T5',5:'T0+T5'};
            const DUPLAS_DNA: Record<string, number[]> = {
              'T1+T6':[1,11,21,31,6,16,26,36],'T2+T7':[2,12,22,32,7,17,27],
              'T3+T8':[3,13,23,33,8,18,28],'T4+T9':[4,14,24,34,9,19,29],'T0+T5':[10,20,30,5,15,25,35]
            };
            const puxados = PULL_DNA[number] || [];
            const terminal = number % 10;
            const dupla = T_DG[terminal];
            const duplaNumeros = DUPLAS_DNA[dupla] || [];
            return (
              <>
                {puxados.length > 0 && (
                  <div className="bg-neon-cyan/3 rounded-lg p-2.5 border border-neon-cyan/10">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Magnet className="w-3.5 h-3.5 text-neon-cyan" />
                      <span className="text-[9px] font-bold text-neon-cyan">PUXADOS DO {number}</span>
                      <span className="text-[7px] text-muted-foreground/30 ml-auto">próximas 4 rodadas</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {puxados.map(n => <div key={n} className={`w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold border border-white/8 ${colorClass(n)}`}>{n}</div>)}
                    </div>
                  </div>
                )}
                <div className="bg-neon-pink/3 rounded-lg p-2.5 border border-neon-pink/10">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Target className="w-3.5 h-3.5 text-neon-pink" />
                    <span className="text-[9px] font-bold text-neon-pink">DUPLA DANI GREEN</span>
                    <span className="text-[8px] font-mono font-bold text-neon-pink/50 ml-auto">{dupla}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {duplaNumeros.map(n => <div key={n} className={`w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold border ${
                      n === number ? 'border-neon-pink ring-1 ring-neon-pink/40' : 'border-white/8'
                    } ${colorClass(n)}`}>{n}</div>)}
                  </div>
                  <p className="text-[7px] text-muted-foreground/30 mt-1.5">Dupla de terminais para este número</p>
                </div>
              </>
            );
          })()}

          <div className="bg-neon-cyan/3 border border-neon-cyan/10 rounded-lg p-2">
            <span className="text-[8px] font-bold text-neon-cyan block mb-0.5">🧲 O IMÃ</span>
            <p className="text-[9px] text-foreground/60">
              Sempre que o <span className="font-bold">{number}</span> sai, a bola viaja em média <span className="font-bold text-neon-cyan">{avgDist.toFixed(1)} casas</span> no cilindro.
              {topSector && topSector[1] > 0 && <> Em <span className="font-bold text-gold">{nextNums.length > 0 ? ((topSector[1] / nextNums.length) * 100).toFixed(0) : 0}%</span> das vezes cai no setor <span className="font-bold">{topSector[0]}</span>.</>}
            </p>
          </div>

          {topNext.length > 0 && (
            <div>
              <span className="text-[8px] font-bold text-foreground/60 block mb-1">➡️ TOP NÚMEROS QUE SAEM DEPOIS</span>
              <div className="flex flex-wrap gap-1.5">
                {topNext.map(([num, freq]) => (
                  <div key={num} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-background/10 border border-border/10 backdrop-blur-sm">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold ${colorClass(Number(num))} border border-white/10`}>{num}</div>
                    <span className="text-[8px] font-mono font-bold text-foreground/60">{freq}x</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <span className="text-[8px] font-bold text-foreground/60 block mb-1">🎰 ZONA DE PUXADA NO CILINDRO</span>
            <div className="flex flex-wrap gap-[3px] justify-center">
              {WHEEL.map((n, i) => {
                const isPull = pullNums.includes(n);
                const isMain = n === number;
                return (
                  <motion.div key={i} initial={{ scale: 0.8 }} animate={{ scale: isMain ? 1.2 : isPull ? 1.05 : 0.9, opacity: isMain || isPull ? 1 : 0.2 }}
                    className={`w-[22px] h-[22px] rounded-full flex items-center justify-center text-[7px] font-bold border transition-all ${
                      isMain ? 'bg-neon-cyan text-white border-neon-cyan ring-2 ring-neon-cyan/40 shadow-lg shadow-neon-cyan/25'
                      : isPull ? `${colorClass(n)} border-neon-cyan/30 shadow-sm shadow-neon-cyan/10`
                      : `${colorClass(n)} border-white/3`
                    }`}>{n}</motion.div>
                );
              })}
            </div>
            <p className="text-[7px] text-muted-foreground/25 text-center mt-1">Zona iluminada = área que o {number} costuma "puxar" ({pullNums.length} números)</p>
          </div>

          <div className="bg-gradient-to-r from-neon-cyan/5 to-gold/3 border border-neon-cyan/15 rounded-lg p-2">
            <span className="text-[8px] font-bold text-neon-cyan block mb-1">💎 APOSTA SUGERIDA</span>
            <p className="text-[9px] text-foreground/60">
              Cobertura da zona de puxada: aposte nos <span className="font-bold text-neon-cyan">{Math.min(pullNums.length, 8)} vizinhos</span> do {number} no cilindro
              {topSector && topSector[1] > 0 && <> + reforço no setor <span className="font-bold text-gold">{topSector[0]}</span></>}.
            </p>
            <div className="flex flex-wrap gap-1 mt-1">
              {pullNums.slice(0, 8).map(n => <div key={n} className={`w-5 h-5 rounded-full flex items-center justify-center text-[7px] font-bold ${colorClass(n)} border border-neon-cyan/20`}>{n}</div>)}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NumberDNADialog;
