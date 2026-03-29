import { useState } from 'react';
import { type RouletteNumber } from '@/lib/roulette';
import { getPremiumRow } from '@/lib/roulette-analysis';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface PremiumTableProps {
  history: RouletteNumber[];
}

const COLUMNS = [
  { key: 'number', label: 'N°', default: true },
  { key: 'cincoDois', label: '5/2', default: true },
  { key: 'terminal', label: 'Terminal', default: true },
  { key: 'coluna', label: 'Coluna', default: true },
  { key: 'duzia', label: 'Dúzia', default: true },
  { key: 'altoBaixo', label: 'A/B', default: false },
  { key: 'parImpar', label: 'P/I', default: false },
  { key: 'setor', label: 'Setor', default: false },
  { key: 'zeroDez', label: '0/10', default: false },
  { key: 'juntoSeparado', label: 'J/S', default: false },
  { key: 'lado', label: 'Lado', default: false },
];

const PremiumTable = ({ history }: PremiumTableProps) => {
  const [enabled, setEnabled] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [visibleCols, setVisibleCols] = useState<Set<string>>(
    new Set(COLUMNS.filter(c => c.default).map(c => c.key))
  );

  const toggleCol = (key: string) => {
    setVisibleCols(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const rows = history.slice(0, 30).map((h, i) => {
    const prev = i < history.length - 1 ? history[i + 1]?.value : undefined;
    return getPremiumRow(h.value, prev);
  });

  const activeCols = COLUMNS.filter(c => visibleCols.has(c.key));

  const getNumberBg = (color: string) => {
    if (color === 'red') return 'bg-roulette-red';
    if (color === 'black') return 'bg-roulette-black';
    return 'bg-roulette-green';
  };

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-sm text-foreground font-medium">Tabela Premium</span>
          <button
            onClick={() => setEnabled(!enabled)}
            className={`w-10 h-5 rounded-full transition-colors relative ${enabled ? 'bg-primary' : 'bg-muted'}`}
          >
            <div className={`w-4 h-4 rounded-full bg-foreground absolute top-0.5 transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </label>
        {enabled && (
          <button
            onClick={() => setShowOptions(!showOptions)}
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Opções {showOptions ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        )}
      </div>

      {enabled && showOptions && (
        <div className="px-4 py-2 border-b border-border">
          <div className="flex flex-wrap gap-2">
            {COLUMNS.map(col => (
              <label key={col.key} className="flex items-center gap-1.5 text-xs text-foreground cursor-pointer">
                {col.label}
                <input
                  type="checkbox"
                  checked={visibleCols.has(col.key)}
                  onChange={() => toggleCol(col.key)}
                  className="rounded border-border"
                />
              </label>
            ))}
          </div>
        </div>
      )}

      {enabled && history.length > 0 && (
        <div className="overflow-x-auto max-h-64">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-secondary">
              <tr>
                {activeCols.map(col => (
                  <th key={col.key} className="px-2 py-1.5 text-muted-foreground font-semibold text-center whitespace-nowrap">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-t border-border/50 hover:bg-secondary/50">
                  {activeCols.map(col => (
                    <td key={col.key} className="px-2 py-1 text-center text-foreground">
                      {col.key === 'number' ? (
                        <span className={`${getNumberBg(row.color)} inline-flex w-6 h-6 rounded-full items-center justify-center text-[10px] font-bold text-foreground`}>
                          {row.number}
                        </span>
                      ) : (
                        (row as any)[col.key]
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {enabled && history.length === 0 && (
        <p className="text-muted-foreground text-sm text-center py-4">Adicione números para ver a tabela</p>
      )}
    </div>
  );
};

export default PremiumTable;
