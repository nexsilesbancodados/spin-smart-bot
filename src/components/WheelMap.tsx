import { useMemo } from 'react';
import { motion } from 'framer-motion';

const WHEEL = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const VOISINS = new Set([22,18,29,7,28,12,35,3,26,0,32,15,19,4,21,2,25]);
const TIERS = new Set([27,13,36,11,30,8,23,10,5,24,16,33]);
const ORPHELINS = new Set([1,6,9,14,17,20,31,34]);

interface Props {
  allNumbers: number[];
  sniperData: any;
}

const WheelMap = ({ allNumbers, sniperData }: Props) => {
  const recommended = useMemo(() => {
    const nums = sniperData?.strategy?.numbers || sniperData?.signal?.numbers || [];
    return new Set<number>(nums);
  }, [sniperData]);

  const recent = useMemo(() => {
    return { n0: allNumbers[0], n1: allNumbers[1], n2: allNumbers[2] };
  }, [allNumbers[0], allNumbers[1], allNumbers[2]]);

  const heatmap = useMemo(() => {
    const freq: Record<number, number> = {};
    allNumbers.slice(0, 50).forEach(n => { freq[n] = (freq[n] || 0) + 1; });
    const max = Math.max(...Object.values(freq), 1);
    return { freq, max };
  }, [allNumbers.slice(0, 50).join(',')]);

  const size = 420;
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 35;
  const sectorR = R + 20;
  const sectorRInner = R - 20;

  const sectorArcs = useMemo(() => {
    const groups = [
      { name: 'Voisins', set: VOISINS, color: 'neon-cyan' },
      { name: 'Tiers', set: TIERS, color: 'neon-green' },
      { name: 'Orphelins', set: ORPHELINS, color: 'neon-purple' },
    ];
    return groups.map(g => {
      const indices = WHEEL.map((n, i) => g.set.has(n) ? i : -1).filter(i => i >= 0);
      return { ...g, indices };
    });
  }, []);

  const angleStep = (2 * Math.PI) / WHEEL.length;

  const getRuns = (indices: number[]) => {
    if (!indices.length) return [];
    const sorted = [...indices].sort((a, b) => a - b);
    const runs: [number, number][] = [];
    let start = sorted[0], prev = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === prev + 1) { prev = sorted[i]; }
      else { runs.push([start, prev]); start = sorted[i]; prev = sorted[i]; }
    }
    runs.push([start, prev]);
    if (runs.length > 1 && runs[0][0] === 0 && runs[runs.length - 1][1] === WHEEL.length - 1) {
      const merged: [number, number] = [runs[runs.length - 1][0], runs[0][1] + WHEEL.length];
      runs.pop();
      runs[0] = merged;
    }
    return runs;
  };

  // Sector legend
  const sectorLegend = [
    { name: 'Voisins', color: 'bg-[hsl(var(--neon-cyan))]', count: VOISINS.size },
    { name: 'Tiers', color: 'bg-[hsl(var(--neon-green))]', count: TIERS.size },
    { name: 'Orphelins', color: 'bg-[hsl(var(--neon-purple))]', count: ORPHELINS.size },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }} 
      animate={{ opacity: 1, scale: 1 }}
      className="glass rounded-2xl border border-border/20 overflow-hidden"
    >
      {/* Header */}
      <div className="relative px-4 pt-4 pb-2">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-neon-purple/5" />
        <div className="relative flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/15 to-neon-purple/10 border border-primary/20 flex items-center justify-center shadow-[0_0_12px_hsl(var(--primary)/0.15)]">
            <span className="text-base">🎡</span>
          </div>
          <div className="flex-1">
            <h3 className="font-display text-[10px] font-bold tracking-[0.15em] text-primary uppercase">Mapa do Cilindro</h3>
            <p className="text-[7px] text-muted-foreground/50 font-mono">Roleta Europeia · 37 números</p>
          </div>
          {recent.n0 !== undefined && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg glass border border-primary/20">
              <span className="text-[7px] text-muted-foreground/50">Último:</span>
              <span className="text-sm font-black text-primary font-mono">{recent.n0}</span>
            </div>
          )}
        </div>
      </div>

      {/* Wheel SVG */}
      <div className="flex justify-center px-2 py-2">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="w-[300px] h-[300px] md:w-[380px] md:h-[380px]"
        >
          {/* Defs for gradients and filters */}
          <defs>
            <filter id="glow-primary" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="glow-gold" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <radialGradient id="center-grad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="hsl(var(--card))" />
              <stop offset="100%" stopColor="hsl(var(--background))" />
            </radialGradient>
          </defs>

          {/* Outer decorative rings */}
          <circle cx={cx} cy={cy} r={R + 25} fill="none" stroke="hsl(var(--primary))" strokeWidth="0.3" opacity={0.1} />
          <circle cx={cx} cy={cy} r={R + 22} fill="none" stroke="hsl(var(--primary))" strokeWidth="0.5" opacity={0.08} strokeDasharray="2 6" />
          <circle cx={cx} cy={cy} r={R - 22} fill="none" stroke="hsl(var(--border))" strokeWidth="0.3" opacity={0.1} />

          {/* Sector background arcs */}
          {sectorArcs.map(g => {
            const runs = getRuns(g.indices);
            return runs.map(([s, e], ri) => {
              const a1 = s * angleStep - Math.PI / 2 - angleStep / 2;
              const span = (e - s + 1);
              const a2 = a1 + span * angleStep;
              const x1o = cx + sectorR * Math.cos(a1), y1o = cy + sectorR * Math.sin(a1);
              const x2o = cx + sectorR * Math.cos(a2), y2o = cy + sectorR * Math.sin(a2);
              const x1i = cx + sectorRInner * Math.cos(a2), y1i = cy + sectorRInner * Math.sin(a2);
              const x2i = cx + sectorRInner * Math.cos(a1), y2i = cy + sectorRInner * Math.sin(a1);
              const la = span > WHEEL.length / 2 ? 1 : 0;
              const fillColor = g.name === 'Voisins' ? 'rgba(0,229,255,0.06)' : g.name === 'Tiers' ? 'rgba(0,255,136,0.05)' : 'rgba(168,85,247,0.05)';
              return (
                <path
                  key={`${g.name}-${ri}`}
                  d={`M${x1o},${y1o} A${sectorR},${sectorR} 0 ${la} 1 ${x2o},${y2o} L${x1i},${y1i} A${sectorRInner},${sectorRInner} 0 ${la} 0 ${x2i},${y2i} Z`}
                  fill={fillColor}
                />
              );
            });
          })}

          {/* Numbers */}
          {WHEEL.map((num, i) => {
            const angle = i * angleStep - Math.PI / 2;
            const x = cx + R * Math.cos(angle);
            const y = cy + R * Math.sin(angle);

            const isLast = num === recent.n0;
            const isSecond = num === recent.n1;
            const isThird = num === recent.n2;
            const isRecommended = recommended.has(num);

            const scale = isLast ? 1.4 : isSecond ? 1.15 : isThird ? 1.05 : 1;
            const r = 11 * scale;

            const fill = num === 0 ? '#16a34a' : RED.has(num) ? '#dc2626' : '#27272a';
            let stroke = 'none';
            let strokeWidth = 0;

            const heat = heatmap.freq[num] || 0;
            const heatPct = heat / heatmap.max;

            if (isLast) { stroke = 'hsl(var(--primary))'; strokeWidth = 2.5; }
            else if (isSecond) { stroke = '#a1a1aa'; strokeWidth = 2; }
            else if (isThird) { stroke = '#52525b'; strokeWidth = 1.5; }
            else if (isRecommended) { stroke = 'hsl(var(--gold))'; strokeWidth = 2; }
            else if (heatPct > 0.6) { stroke = 'rgba(249,115,22,0.6)'; strokeWidth = 1.5; }
            else if (heat === 0) { stroke = 'rgba(59,130,246,0.4)'; strokeWidth = 1; }

            return (
              <g key={num}>
                {/* Pulse glow for last */}
                {isLast && (
                  <motion.circle
                    cx={x} cy={y} r={r + 5} fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth="1.5"
                    opacity={0.4}
                    animate={{ r: [r + 3, r + 7, r + 3], opacity: [0.15, 0.5, 0.15] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                  />
                )}
                {/* Glow for recommended */}
                {isRecommended && !isLast && (
                  <motion.circle 
                    cx={x} cy={y} r={r + 3} fill="none"
                    stroke="hsl(var(--gold))" strokeWidth="1" opacity={0.35}
                    animate={{ opacity: [0.2, 0.5, 0.2] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                  />
                )}
                <circle cx={x} cy={y} r={r} fill={fill} stroke={stroke} strokeWidth={strokeWidth}
                  style={{
                    filter: isLast ? 'drop-shadow(0 0 10px hsl(var(--primary)))' :
                      isRecommended ? 'drop-shadow(0 0 6px hsl(var(--gold)))' : 'none'
                  }}
                />
                <text x={x} y={y} textAnchor="middle" dominantBaseline="central"
                  fill="white" fontSize={scale > 1 ? 9 * scale : 8} fontWeight="bold"
                  fontFamily="'JetBrains Mono', monospace"
                  style={{ pointerEvents: 'none' }}
                >
                  {num}
                </text>
              </g>
            );
          })}

          {/* Center */}
          <circle cx={cx} cy={cy} r={32} fill="url(#center-grad)" stroke="hsl(var(--border))" strokeWidth="0.5" opacity={0.9} />
          <circle cx={cx} cy={cy} r={30} fill="none" stroke="hsl(var(--primary))" strokeWidth="0.3" opacity={0.15} strokeDasharray="3 5" />
          <text x={cx} y={cy - 8} textAnchor="middle" fill="hsl(var(--primary))" fontSize="9" fontWeight="900" fontFamily="'Orbitron', sans-serif" letterSpacing="2" opacity="0.8">RODA</text>
          <text x={cx} y={cy + 4} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="6" opacity="0.5" fontFamily="'JetBrains Mono', monospace">EUROPEIA</text>
          <text x={cx} y={cy + 14} textAnchor="middle" fill="hsl(var(--primary))" fontSize="5" opacity="0.3" fontFamily="'JetBrains Mono', monospace">37 SLOTS</text>
        </svg>
      </div>

      {/* Legend */}
      <div className="px-4 pb-3">
        <div className="flex items-center justify-center gap-4">
          {sectorLegend.map(s => (
            <div key={s.name} className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${s.color} opacity-60`} />
              <span className="text-[7px] text-muted-foreground/50 font-mono">{s.name} ({s.count})</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center gap-4 mt-1.5">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full border-2 border-primary" />
            <span className="text-[7px] text-muted-foreground/40">Último</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full border-2 border-[hsl(var(--gold))]" />
            <span className="text-[7px] text-muted-foreground/40">Recomendado</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-full bg-orange-500/60" />
            <span className="text-[7px] text-muted-foreground/40">Quente</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default WheelMap;
