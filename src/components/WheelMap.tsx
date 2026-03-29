import { useMemo } from 'react';

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
  const R = size / 2 - 30; // radius for number centers
  const sectorR = R + 18; // sector arc outer
  const sectorRInner = R - 18; // sector arc inner

  // Build sector arcs
  const sectorArcs = useMemo(() => {
    const groups = [
      { name: 'Voisins', set: VOISINS, color: 'rgba(59,130,246,0.12)' },
      { name: 'Tiers', set: TIERS, color: 'rgba(34,197,94,0.10)' },
      { name: 'Orphelins', set: ORPHELINS, color: 'rgba(168,85,247,0.10)' },
    ];
    return groups.map(g => {
      // Find contiguous runs of indices
      const indices = WHEEL.map((n, i) => g.set.has(n) ? i : -1).filter(i => i >= 0);
      return { ...g, indices };
    });
  }, []);

  const angleStep = (2 * Math.PI) / WHEEL.length;

  const arcPath = (startIdx: number, endIdx: number, rOuter: number, rInner: number) => {
    const a1 = startIdx * angleStep - Math.PI / 2 - angleStep / 2;
    const a2 = (endIdx + 1) * angleStep - Math.PI / 2 - angleStep / 2;
    const x1o = cx + rOuter * Math.cos(a1);
    const y1o = cy + rOuter * Math.sin(a1);
    const x2o = cx + rOuter * Math.cos(a2);
    const y2o = cy + rOuter * Math.sin(a2);
    const x1i = cx + rInner * Math.cos(a2);
    const y1i = cy + rInner * Math.sin(a2);
    const x2i = cx + rInner * Math.cos(a1);
    const y2i = cy + rInner * Math.sin(a1);
    const largeArc = (endIdx - startIdx + 1) > WHEEL.length / 2 ? 1 : 0;
    return `M${x1o},${y1o} A${rOuter},${rOuter} 0 ${largeArc} 1 ${x2o},${y2o} L${x1i},${y1i} A${rInner},${rInner} 0 ${largeArc} 0 ${x2i},${y2i} Z`;
  };

  // Get contiguous runs from indices
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
    // Handle wrap-around (Voisins wraps around 0)
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
        className="w-[300px] h-[300px] md:w-[400px] md:h-[400px]"
      >
        {/* Sector background arcs */}
        {sectorArcs.map(g => {
          const runs = getRuns(g.indices);
          return runs.map(([s, e], ri) => {
            const es = e >= WHEEL.length ? e % WHEEL.length : e;
            // For wrapping, draw as single arc from s to e
            const a1 = s * angleStep - Math.PI / 2 - angleStep / 2;
            const span = ((e >= WHEEL.length ? e : e) - s + 1);
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
                fill={g.color}
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

          const scale = isLast ? 1.3 : isSecond ? 1.1 : isThird ? 1.05 : 1;
          const r = 11 * scale;

          const fill = num === 0 ? '#16a34a' : RED.has(num) ? '#dc2626' : '#27272a';
          let stroke = 'none';
          let strokeWidth = 0;

          // Heatmap ring
          const heat = heatmap.freq[num] || 0;
          const heatPct = heat / heatmap.max;
          const heatRing = heatPct > 0.6
            ? 'rgba(249,115,22,0.8)'
            : heatPct < 0.1 && heat === 0
            ? 'rgba(59,130,246,0.6)'
            : null;

          if (isLast) { stroke = '#ffffff'; strokeWidth = 2.5; }
          else if (isSecond) { stroke = '#a1a1aa'; strokeWidth = 2; }
          else if (isThird) { stroke = '#52525b'; strokeWidth = 1.5; }
          else if (isRecommended) { stroke = '#eab308'; strokeWidth = 2; }
          else if (heatRing) { stroke = heatRing; strokeWidth = 1.5; }

          return (
            <g key={num}>
              <circle cx={x} cy={y} r={r} fill={fill} stroke={stroke} strokeWidth={strokeWidth}
                style={{ filter: isLast ? 'drop-shadow(0 0 6px rgba(255,255,255,0.5))' : isRecommended ? 'drop-shadow(0 0 4px rgba(234,179,8,0.4))' : 'none' }}
              />
              <text x={x} y={y} textAnchor="middle" dominantBaseline="central"
                fill="white" fontSize={scale > 1 ? 9 * scale : 8} fontWeight="bold"
                style={{ pointerEvents: 'none' }}
              >
                {num}
              </text>
            </g>
          );
        })}

        {/* Center label */}
        <text x={cx} y={cy - 8} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="9" fontWeight="bold" opacity="0.6">RODA</text>
        <text x={cx} y={cy + 6} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="7" opacity="0.4">EUROPEIA</text>
      </svg>
    </div>
  );
};

export default WheelMap;
