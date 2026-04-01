import { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend, CartesianGrid, BarChart, Bar } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

// Props: recebe histórico de previsões e permite comparar estratégias/modelos
export default function ComparativeDashboard({ predictions = [] }: { predictions: any[] }) {
  // Extrai estratégias disponíveis
  const strategies = useMemo(() => Array.from(new Set(predictions.map(p => p.strategy_type))), [predictions]);
  const [selected, setSelected] = useState<string[]>(strategies.slice(0, 2));

  // Filtra previsões por estratégia
  const dataByStrategy = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const s of strategies) map[s] = predictions.filter(p => p.strategy_type === s);
    return map;
  }, [predictions, strategies]);

  // Prepara dados para gráfico de Win Rate
  const winRateData = strategies.map(s => {
    const arr = dataByStrategy[s] || [];
    const total = arr.length;
    const hits = arr.filter(p => p.hit).length;
    return { strategy: s, winRate: total ? +(hits / total * 100).toFixed(1) : 0, total };
  });

  // Prepara dados para gráfico de PnL acumulado
  const pnlSeries = selected.map(s => {
    let cum = 0;
    return (dataByStrategy[s] || []).map((p, i) => {
      cum += p.profit || 0;
      return { x: i + 1, pnl: +cum.toFixed(2), strategy: s };
    });
  });

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Comparativo de Estratégias</CardTitle>
        <div className="flex flex-wrap gap-2 mt-2">
          {strategies.map(s => (
            <button
              key={s}
              className={`px-2 py-1 rounded text-xs font-bold border focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 transition ${selected.includes(s) ? 'bg-primary/10 border-primary text-primary' : 'bg-muted border-border text-muted-foreground'}`}
              onClick={() => setSelected(sel => sel.includes(s) ? sel.filter(x => x !== s) : [...sel, s])}
              aria-pressed={selected.includes(s)}
              aria-label={selected.includes(s) ? `Remover ${s} da comparação` : `Adicionar ${s} à comparação`}
              tabIndex={0}
              title={selected.includes(s) ? `Remover ${s} da comparação` : `Adicionar ${s} à comparação`}
            >
              {s}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-6">
          <h3 className="font-bold text-[13px] mb-2">Win Rate (%)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={winRateData.filter(d => selected.includes(d.strategy))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="strategy" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="winRate" fill="#06b6d4" name="Win Rate" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div>
          <h3 className="font-bold text-[13px] mb-2">PnL Acumulado</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="x" />
              <YAxis />
              <Tooltip />
              <Legend />
              {pnlSeries.map((series, idx) => (
                <Line key={selected[idx]} data={series} dataKey="pnl" name={selected[idx]} stroke={['#06b6d4', '#f59e42', '#10b981', '#ef4444'][idx % 4]} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
