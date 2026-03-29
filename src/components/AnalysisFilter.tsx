import { useState } from 'react';
import { type RouletteNumber } from '@/lib/roulette';
import {
  type AnalysisType,
  FILTER_OPTIONS,
  getAnalysisGroups,
} from '@/lib/roulette-analysis';
import { ChevronDown } from 'lucide-react';

interface AnalysisFilterProps {
  history: RouletteNumber[];
}

const AnalysisFilter = ({ history }: AnalysisFilterProps) => {
  const [selectedFilter, setSelectedFilter] = useState<AnalysisType | ''>('');
  const [enabledGroups, setEnabledGroups] = useState<Set<string>>(new Set());

  const groups = selectedFilter ? getAnalysisGroups(selectedFilter, history) : [];

  const toggleGroup = (id: string) => {
    setEnabledGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleFilterChange = (value: string) => {
    setSelectedFilter(value as AnalysisType);
    setEnabledGroups(new Set());
  };

  return (
    <div className="space-y-3">
      {/* Filter Selector */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="relative">
          <select
            value={selectedFilter}
            onChange={e => handleFilterChange(e.target.value)}
            className="w-full bg-card text-foreground text-sm font-semibold px-4 py-3 appearance-none cursor-pointer focus:outline-none"
          >
            <option value="" disabled>Selecione Opção</option>
            {FILTER_OPTIONS.map(group => (
              <optgroup key={group.group} label={group.group}>
                {group.options.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Analysis Groups */}
      {groups.length > 0 && (
        <div className="bg-card rounded-lg p-4 border border-border space-y-3">
          {/* Toggle switches */}
          <div className="flex flex-wrap gap-3">
            {groups.map(g => (
              <label key={g.id} className="flex items-center gap-2 cursor-pointer">
                <span
                  className="px-2.5 py-1 rounded text-xs font-bold text-foreground"
                  style={{ backgroundColor: g.color }}
                >
                  {g.label}
                </span>
                <button
                  onClick={() => toggleGroup(g.id)}
                  className={`w-10 h-5 rounded-full transition-colors relative ${
                    enabledGroups.has(g.id) ? 'bg-primary' : 'bg-muted'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-foreground absolute top-0.5 transition-transform ${
                      enabledGroups.has(g.id) ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </label>
            ))}
          </div>

          {/* Percentage bars */}
          <div className="flex flex-wrap gap-2">
            {groups.map(g => (
              <div key={g.id} className="flex-1 min-w-[60px]">
                <div className="text-center text-xs text-muted-foreground mb-1">
                  {g.count} ({g.percentage.toFixed(0)}%)
                </div>
                <div className="h-3 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${g.percentage}%`, backgroundColor: g.color }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* History classified by selected groups */}
          {enabledGroups.size > 0 && history.length > 0 && (
            <div className="border-t border-border pt-3">
              <p className="text-xs text-muted-foreground mb-2">Últimas rodadas filtradas:</p>
              <div className="flex flex-wrap gap-1">
                {history.slice(0, 30).map((h, i) => {
                  const matchingGroup = groups.find(g =>
                    enabledGroups.has(g.id) && g.numbers.includes(h.value)
                  );
                  if (!matchingGroup && selectedFilter !== 'JuntoSeparado') return null;
                  
                  const bgColor = matchingGroup ? matchingGroup.color : 'hsl(var(--muted))';
                  return (
                    <div
                      key={i}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-foreground"
                      style={{ backgroundColor: bgColor }}
                    >
                      {h.value}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AnalysisFilter;
