import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';

const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const VOISINS = new Set([22,18,29,7,28,12,35,3,26,0,32,15,19,4,21,2,25]);
const TIERS = new Set([27,13,36,11,30,8,23,10,5,24,16,33]);
const ORPHELINS = new Set([1,20,14,31,9,17,34,6]);

const getColor = (n: number) => n === 0 ? 'green' : RED.has(n) ? 'red' : 'black';
const getDozen = (n: number) => n === 0 ? 0 : n <= 12 ? 1 : n <= 24 ? 2 : 3;
const getColumn = (n: number) => n === 0 ? 0 : ((n - 1) % 3) + 1;
const getSector = (n: number) => VOISINS.has(n) ? 'Voisins' : TIERS.has(n) ? 'Tiers' : ORPHELINS.has(n) ? 'Orphelins' : 'Zero';

interface GapItem { label: string; gap: number; sigma: number; status: 'hot' | 'cold' | 'normal'; emoji: string; }
interface TrendItem { label: string; ratio: string; direction: 'up' | 'down' | 'neutral'; }

interface Props { allNumbers: number[]; }

const LiveStatsBar = memo(({ allNumbers }: Props) => {
  const stats = useMemo(() => {
    if (allNumbers.length < 10) return null;
    const w50 = allNumbers.slice(0, 50);
    const w20 = allNumbers.slice(0, 20);
    const total = w50.length;

    // GAP ANALYSIS
    const gaps: GapItem[] = [];
    for (const color of ['red', 'black'] as const) {
      let gap = 0;
      for (const n of allNumbers) { if (getColor(n) === color) break; gap++; }
      const expectedGap = 1 / (18 / 37);
      const sigma = (gap - expectedGap) / Math.sqrt(expectedGap);
      if (gap >= 3) gaps.push({ label: color === 'red' ? 'Vermelho' : 'Preto', gap, sigma: parseFloat(sigma.toFixed(1)), status: sigma > 2 ? 'cold' : sigma < -1 ? 'hot' : 'normal', emoji: color === 'red' ? '🔴' : '⚫' });
    }
    for (let dz = 1; dz <= 3; dz++) {
      let gap = 0;
      for (const n of allNumbers) { if (n > 0 && getDozen(n) === dz) break; gap++; }
      const expectedGap = 1 / (12 / 37);
      const sigma = (gap - expectedGap) / Math.sqrt(expectedGap);
      if (gap >= 4) gaps.push({ label: `${dz}ª Dúzia`, gap, sigma: parseFloat(sigma.toFixed(1)), status: sigma > 2 ? 'cold' : sigma < -1 ? 'hot' : 'normal', emoji: '📊' });
    }
    for (let col = 1; col <= 3; col++) {
      let gap = 0;
      for (const n of allNumbers) { if (n > 0 && getColumn(n) === col) break; gap++; }
      const expectedGap = 1 / (12 / 37);
      const sigma = (gap - expectedGap) / Math.sqrt(expectedGap);
      if (gap >= 4) gaps.push({ label: `${col}ª Coluna`, gap, sigma: parseFloat(sigma.toFixed(1)), status: sigma > 2 ? 'cold' : sigma < -1 ? 'hot' : 'normal', emoji: '📐' });
    }
    let zeroGap = 0;
    for (const n of allNumbers) { if (n === 0) break; zeroGap++; }
    const zeroSigma = (zeroGap - 37) / Math.sqrt(37);
    if (zeroGap >= 20) gaps.push({ label: 'Zero', gap: zeroGap, sigma: parseFloat(zeroSigma.toFixed(1)), status: zeroSigma > 2 ? 'cold' : 'normal', emoji: '🟢' });
    gaps.sort((a, b) => b.sigma - a.sigma);

    // TRENDS
    const trends: TrendItem[] = [];
    const redIn20 = w20.filter(n => getColor(n) === 'red').length;
    const blackIn20 = w20.filter(n => getColor(n) === 'black').length;
    if (redIn20 >= 12) trends.push({ label: 'Vermelho dominante', ratio: `${redIn20}/20`, direction: 'up' });
    if (blackIn20 >= 12) trends.push({ label: 'Preto dominante', ratio: `${blackIn20}/20`, direction: 'up' });
    const parIn20 = w20.filter(n => n > 0 && n % 2 === 0).length;
    const imparIn20 = w20.filter(n => n > 0 && n % 2 === 1).length;
    if (parIn20 >= 13) trends.push({ label: 'Par dominante', ratio: `${parIn20}/20`, direction: 'up' });
    if (imparIn20 >= 13) trends.push({ label: 'Ímpar dominante', ratio: `${imparIn20}/20`, direction: 'up' });
    const altoIn20 = w20.filter(n => n >= 19).length;
    const baixoIn20 = w20.filter(n => n >= 1 && n <= 18).length;
    if (altoIn20 >= 13) trends.push({ label: 'Alto dominante', ratio: `${altoIn20}/20`, direction: 'up' });
    if (baixoIn20 >= 13) trends.push({ label: 'Baixo dominante', ratio: `${baixoIn20}/20`, direction: 'up' });
    const sectorCounts: Record<string, number> = { Voisins: 0, Tiers: 0, Orphelins: 0 };
    w20.forEach(n => { const s = getSector(n); if (sectorCounts[s] !== undefined) sectorCounts[s]++; });
    for (const [s, c] of Object.entries(sectorCounts)) {
      const expected20 = s === 'Voisins' ? 17/37*20 : s === 'Tiers' ? 12/37*20 : 8/37*20;
      if (c >= expected20 * 1.5) trends.push({ label: `${s} quente`, ratio: `${c}/20`, direction: 'up' });
    }

    // FREQUENCY DEVIATIONS
    const freq: Record<number, number> = {};
    w50.forEach(n => { freq[n] = (freq[n] || 0) + 1; });
    const expected = total / 37;
    const numbered = Array.from({ length: 37 }, (_, n) => ({ num: n, count: freq[n] || 0, dev: ((freq[n] || 0) - expected) / Math.sqrt(expected) }));
    numbered.sort((a, b) => b.dev - a.dev);
    const hotNums = numbered.filter(x => x.dev > 1.2).slice(0, 5);
    const coldNums = numbered.filter(x => x.dev < -0.8).sort((a, b) => a.dev - b.dev).slice(0, 5);

    return { gaps: gaps.slice(0, 6), trends: trends.slice(0, 4), hotNums, coldNums, total };
  }, [allNumbers]);

  if (!stats) return null;

  const numBg = (n: number) => n === 0 ? 'bg-emerald-600' : RED.has(n) ? 'bg-red-600' : 'bg-zinc-700';

  return (
    <div className="space-y-2.5">
      {/* GAP */}
      {stats.gaps.length > 0 && (
        <div className="glass rounded-xl p-3.5">
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-5 h-5 rounded-md bg-blue-500/15 flex items-center justify-center">
              <span className="text-[10px]">📉</span>
            </div>
            <span className="text-[9px] font-black text-foreground uppercase tracking-wider">Atraso (Gap)</span>
            <span className="text-[7px] text-muted-foreground ml-auto font-mono">σ = desvio padrão</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {stats.gaps.map((g, i) => (
              <motion.div
                key={g.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className={`px-3 py-2 rounded-lg border text-[9px] font-bold flex items-center gap-2 backdrop-blur-sm ${
                  g.status === 'cold'
                    ? 'bg-blue-500/10 border-blue-500/25 text-blue-400'
                    : g.status === 'hot'
                    ? 'bg-amber-500/10 border-amber-500/25 text-amber-400'
                    : 'bg-secondary/40 border-border/30 text-muted-foreground'
                }`}
              >
                <span>{g.emoji}</span>
                <span>{g.label}</span>
                <span className="font-mono text-[8px] bg-background/50 px-1.5 py-0.5 rounded">{g.gap}g</span>
                {Math.abs(g.sigma) >= 1.5 && (
                  <span className={`text-[7px] font-mono px-1.5 py-0.5 rounded ${
                    g.sigma > 2 ? 'bg-blue-500/20 text-blue-300' : 'bg-amber-500/10 text-amber-400'
                  }`}>
                    {g.sigma > 0 ? '+' : ''}{g.sigma}σ
                  </span>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* TRENDS */}
      {stats.trends.length > 0 && (
        <div className="glass rounded-xl p-3.5">
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-5 h-5 rounded-md bg-primary/15 flex items-center justify-center">
              <span className="text-[10px]">📈</span>
            </div>
            <span className="text-[9px] font-black text-foreground uppercase tracking-wider">Tendências (20 giros)</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {stats.trends.map((t, i) => (
              <div key={i} className="px-3 py-2 rounded-lg bg-primary/8 border border-primary/15 text-[9px] font-bold text-primary flex items-center gap-2">
                <span className="text-xs">{t.direction === 'up' ? '↑' : '→'}</span>
                <span>{t.label}</span>
                <span className="text-[8px] text-primary/60 font-mono bg-primary/10 px-1.5 py-0.5 rounded">{t.ratio}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* HOT / COLD NUMBERS */}
      <div className="grid grid-cols-2 gap-2">
        {stats.hotNums.length > 0 && (
          <div className="glass rounded-xl p-3.5">
            <div className="flex items-center gap-1.5 mb-2.5">
              <span className="text-xs">🔥</span>
              <span className="text-[9px] font-black text-amber-400 uppercase tracking-wider">Quentes</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {stats.hotNums.map(h => (
                <div key={h.num} className={`w-9 h-9 rounded-lg text-[10px] font-black text-white flex items-center justify-center ring-1 ring-amber-400/40 shadow-sm shadow-amber-500/20 ${numBg(h.num)}`}>
                  {h.num}
                </div>
              ))}
            </div>
            <div className="text-[7px] text-muted-foreground mt-2 font-mono">
              {stats.hotNums.map(h => `${h.num}(${h.count}×)`).join(' · ')}
            </div>
          </div>
        )}
        {stats.coldNums.length > 0 && (
          <div className="glass rounded-xl p-3.5">
            <div className="flex items-center gap-1.5 mb-2.5">
              <span className="text-xs">❄️</span>
              <span className="text-[9px] font-black text-blue-400 uppercase tracking-wider">Frios</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {stats.coldNums.map(c => (
                <div key={c.num} className={`w-9 h-9 rounded-lg text-[10px] font-black text-white flex items-center justify-center opacity-50 ring-1 ring-blue-400/30 ${numBg(c.num)}`}>
                  {c.num}
                </div>
              ))}
            </div>
            <div className="text-[7px] text-muted-foreground mt-2 font-mono">
              {stats.coldNums.map(c => `${c.num}(${c.count}×)`).join(' · ')}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

LiveStatsBar.displayName = 'LiveStatsBar';
export default LiveStatsBar;
