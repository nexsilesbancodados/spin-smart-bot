import { useMemo } from 'react';
import { AlertTriangle, Shield, Flame } from 'lucide-react';

interface ZeroPressureProps {
  allNumbers: number[];
}

const ZeroPressure = ({ allNumbers }: ZeroPressureProps) => {
  const roundsWithoutZero = useMemo(() => {
    const idx = allNumbers.indexOf(0);
    return idx === -1 ? allNumbers.length : idx;
  }, [allNumbers]);

  const { level, label, color, borderColor, barColor, recommendation } = useMemo(() => {
    if (roundsWithoutZero > 40) return {
      level: 3, label: 'CRÍTICO', color: 'text-red-400', borderColor: 'border-red-500/60',
      barColor: 'bg-red-500', recommendation: '🚨 ANOMALIA — Vizinhos do Zero (9 fichas)'
    };
    if (roundsWithoutZero > 25) return {
      level: 2, label: 'Pressão Alta', color: 'text-orange-400', borderColor: 'border-orange-500/50',
      barColor: 'bg-orange-500', recommendation: 'Jeu Zero (4 fichas) recomendado'
    };
    if (roundsWithoutZero > 14) return {
      level: 1, label: 'Atenção', color: 'text-yellow-400', borderColor: 'border-yellow-500/40',
      barColor: 'bg-yellow-500', recommendation: 'Considere 1 ficha no zero'
    };
    return {
      level: 0, label: 'Normal', color: 'text-emerald-400', borderColor: 'border-emerald-500/30',
      barColor: 'bg-emerald-500', recommendation: ''
    };
  }, [roundsWithoutZero]);

  const barPercent = Math.min((roundsWithoutZero / 60) * 100, 100);

  return (
    <div className={`bg-card border ${borderColor} rounded-xl p-3 transition-all ${level === 3 ? 'animate-pulse' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {level >= 2 ? <Flame className={`w-4 h-4 ${color}`} /> : <Shield className={`w-4 h-4 ${color}`} />}
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pressão do Zero</span>
        </div>
        <span className={`text-xs font-bold ${color}`}>{label}</span>
      </div>

      <div className="flex items-center gap-3">
        <span className={`text-3xl font-black tabular-nums ${color}`}>{roundsWithoutZero}</span>
        <div className="flex-1">
          <div className="text-[10px] text-muted-foreground mb-1">rodadas sem zero</div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div className={`h-full ${barColor} rounded-full transition-all duration-500`} style={{ width: `${barPercent}%` }} />
          </div>
        </div>
      </div>

      {recommendation && (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium" style={{ color: 'inherit' }}>
          <AlertTriangle className={`w-3 h-3 ${color} flex-shrink-0`} />
          <span className={color}>{recommendation}</span>
        </div>
      )}
    </div>
  );
};

export default ZeroPressure;
