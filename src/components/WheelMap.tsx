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

  const size = 400;
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 30;
  const sectorR = R + 18;
  const sectorRInner = R - 18;

  const sectorArcs = useMemo(() => {
    const groups = [
      { name: 'Voisins', set: VOISINS, color: 'hsla(var(--neon-cyan), 0.08)' },
      { name: 'Tiers', set: TIERS, color: 'hsla(var(--neon-green), 0.06)' },
      { name: 'Orphelins', set: ORPHELINS, color: 'hsla(var(--neon-purple), 0.06)' },
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

  return (
    <div className="flex justify-center">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="w-[300px] h-[300px] md:w-[380px] md:h-[380px]"
      >
        {/* Outer glow ring */}
        <circle cx={cx} cy={cy} r={R + 22} fill="none" stroke="hsl(var(--primary))" strokeWidth="0.5" opacity={0.15} />
        <circle cx={cx} cy={cy} r={R - 22} fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" opacity={0.1} />

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
            return (
              <path
                key={`${g.name}-${ri}`}
                d={`M${x1o},${y1o} A${sectorR},${sectorR} 0 ${la} 1 ${x2o},${y2o} L${x1i},${y1i} A${sectorRInner},${sectorRInner} 0 ${la} 0 ${x2i},${y2i} Z`}
                fill={g.name === 'Voisins' ? 'rgba(0,229,255,0.06)' : g.name === 'Tiers' ? 'rgba(0,255,136,0.05)' : 'rgba(168,85,247,0.05)'}
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

          const scale = isLast ? 1.35 : isSecond ? 1.1 : isThird ? 1.05 : 1;
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
              {/* Glow for last */}
              {isLast && (
                <motion.circle
                  cx={x} cy={y} r={r + 4} fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="1"
                  opacity={0.4}
                  animate={{ r: [r + 3, r + 6, r + 3], opacity: [0.2, 0.5, 0.2] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                />
              )}
              {/* Glow for recommended */}
              {isRecommended && !isLast && (
                <circle cx={x} cy={y} r={r + 3} fill="none"
                  stroke="hsl(var(--gold))" strokeWidth="0.8" opacity={0.3}
                />
              )}
              <circle cx={x} cy={y} r={r} fill={fill} stroke={stroke} strokeWidth={strokeWidth}
                style={{
                  filter: isLast ? 'drop-shadow(0 0 8px hsl(var(--primary)))' :
                    isRecommended ? 'drop-shadow(0 0 4px hsl(var(--gold)))' : 'none'
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
        <circle cx={cx} cy={cy} r={28} fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="0.5" opacity={0.8} />
        <text x={cx} y={cy - 6} textAnchor="middle" fill="hsl(var(--primary))" fontSize="8" fontWeight="900" fontFamily="'Orbitron', sans-serif" letterSpacing="2" opacity="0.7">RODA</text>
        <text x={cx} y={cy + 6} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="6" opacity="0.4" fontFamily="'JetBrains Mono', monospace">EUROPEIA</text>
      </svg>
    </div>
  );
};

export default WheelMap;
