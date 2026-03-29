import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface ProfitChartProps {
  data: { round: number; profit: number }[];
}

const ProfitChart = ({ data }: ProfitChartProps) => {
  return (
    <div className="bg-card rounded-lg p-4 border border-border">
      <h3 className="font-display text-sm text-primary mb-3 tracking-wider uppercase">Evolução do Lucro</h3>
      {data.length < 2 ? (
        <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
          Inicie o bot para ver o gráfico
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 18%)" />
            <XAxis dataKey="round" tick={{ fontSize: 10, fill: 'hsl(220 10% 55%)' }} />
            <YAxis tick={{ fontSize: 10, fill: 'hsl(220 10% 55%)' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(220 18% 10%)',
                border: '1px solid hsl(220 15% 18%)',
                borderRadius: '8px',
                fontSize: 12,
              }}
            />
            <ReferenceLine y={0} stroke="hsl(220 10% 55%)" strokeDasharray="3 3" />
            <Line
              type="monotone"
              dataKey="profit"
              stroke="hsl(145 80% 42%)"
              strokeWidth={2}
              dot={false}
              name="Lucro (R$)"
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default ProfitChart;
