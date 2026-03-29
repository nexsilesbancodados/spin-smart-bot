import { useRoulette } from '@/contexts/RouletteContext';
import { getNumberColor } from '@/lib/roulette';
import { getAnalysisGroups, type AnalysisType } from '@/lib/roulette-analysis';
import { useState } from 'react';
import { motion } from 'framer-motion';

const STAT_TABS: { id: AnalysisType; label: string }[] = [
  { id: 'Duzias', label: 'Dúzias' },
  { id: 'Colunas', label: 'Colunas' },
  { id: 'Terminais', label: 'Term.' },
  { id: 'Setores', label: 'Setores' },
  { id: 'Vizinhos', label: '7/27' },
  { id: 'JuntoSeparado', label: 'J/S' },
  { id: 'ZeroDez', label: '0/10' },
  { id: 'LadoRace', label: 'Lado' },
];

const LiveStats = () => {
  const { history } = useRoulette();
  const [activeTab, setActiveTab] = useState<AnalysisType>('Duzias');

  const groups = getAnalysisGroups(activeTab, history);

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      {/* Tabs */}
      <div className="flex overflow-x-auto scrollbar-hide border-b border-border">
        {STAT_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-2.5 py-1.5 text-[10px] font-bold whitespace-nowrap transition-colors shrink-0 ${
              activeTab === tab.id
                ? 'text-primary border-b-2 border-primary bg-primary/5'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Bars */}
      <div className="p-3 space-y-2">
        {groups.map(group => (
          <div key={group.id} className="space-y-0.5">
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-bold text-foreground w-8">{group.label}</span>
              <div className="flex-1 mx-2 h-4 bg-secondary rounded overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${group.percentage}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className="h-full rounded"
                  style={{ background: group.color }}
                />
              </div>
              <span className="text-muted-foreground font-mono w-14 text-right">
                {group.percentage.toFixed(1)}% <span className="text-[8px]">({group.count})</span>
              </span>
            </div>
          </div>
        ))}
        {groups.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">Adicione números para ver estatísticas</p>
        )}
      </div>
    </div>
  );
};

export default LiveStats;
