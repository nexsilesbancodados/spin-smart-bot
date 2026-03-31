import { memo, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart3, TrendingUp, TrendingDown, AlertTriangle, Shield, ChevronDown } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts';

interface BetEntry {
  won: boolean;
  amount: number;
  profit: number;
  timestamp: number;
}

interface Props {
  betHistory: BetEntry[];
  balance: number;
  allNumbers: number[];
}

const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

const PerformanceMonitor = memo(({ betHistory, balance, allNumbers }: Props) => {
  const [expanded, setExpanded] = useState(false);

  const metrics = useMemo(() => {
    if (betHistory.length < 2) return null;

    const wins = betHistory.filter(b => b.won).length;
    const total = betHistory.length;
    const winRate = total > 0 ? wins / total : 0;

    // Running P&L
    let cumPnl = 0;
    const pnlSeries = betHistory.slice().reverse().map((b, i) => {
      cumPnl += b.profit;
      return { x: i + 1, pnl: Math.round(cumPnl * 100) / 100 };
    });

    // Max Drawdown
    let peak = 0;
    let maxDD = 0;
    pnlSeries.forEach(p => {
      if (p.pnl > peak) peak = p.pnl;
      const dd = peak - p.pnl;
      if (dd > maxDD) maxDD = dd;
    });

    // Sharpe Ratio (simplified: mean return / std of returns)
    const returns = betHistory.map(b => b.profit);
    const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const stdReturn = Math.sqrt(returns.reduce((a, r) => a + (r - meanReturn) ** 2, 0) / returns.length);
    const sharpe = stdReturn > 0 ? meanReturn / stdReturn : 0;

    // Profit factor: gross profit / gross loss
    const grossProfit = returns.filter(r => r > 0).reduce((a, b) => a + b, 0);
    const grossLoss = Math.abs(returns.filter(r => r < 0).reduce((a, b) => a + b, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

    // Average win/loss
    const avgWin = wins > 0 ? grossProfit / wins : 0;
    const losses = total - wins;
    const avgLoss = losses > 0 ? grossLoss / losses : 0;

    // Longest streaks
    let maxWinStreak = 0, maxLossStreak = 0, curWin = 0, curLoss = 0;
    betHistory.forEach(b => {
      if (b.won) { curWin++; curLoss = 0; maxWinStreak = Math.max(maxWinStreak, curWin); }
      else { curLoss++; curWin = 0; maxLossStreak = Math.max(maxLossStreak, curLoss); }
    });

    // Anomaly detection: check if recent performance deviates significantly
    const recent10WR = betHistory.slice(0, 10).filter(b => b.won).length / Math.min(10, betHistory.length);
    const anomaly = Math.abs(recent10WR - winRate) > 0.25;
    const anomalyMsg = anomaly
      ? recent10WR < winRate
        ? '⚠️ Performance recente abaixo da média — possível mudança de regime'
        : '🔥 Performance recente acima da média — momentum positivo'
      : null;

    // Color distribution for pie chart
    const colorDist = { red: 0, black: 0, green: 0 };
    allNumbers.slice(0, 50).forEach(n => {
      if (n === 0) colorDist.green++;
      else if (RED.has(n)) colorDist.red++;
      else colorDist.black++;
    });

    return {
      winRate, total, wins, losses,
      pnlSeries,
      totalPnl: cumPnl,
      maxDrawdown: Math.round(maxDD * 100) / 100,
      sharpe: Math.round(sharpe * 100) / 100,
      profitFactor: profitFactor === Infinity ? '∞' : Math.round(profitFactor * 100) / 100,
      avgWin: Math.round(avgWin * 100) / 100,
      avgLoss: Math.round(avgLoss * 100) / 100,
      maxWinStreak,
      maxLossStreak,
      anomaly,
      anomalyMsg,
      colorDist,
    };
  }, [betHistory, allNumbers]);

  if (!metrics) {
    return (
      <div className="bg-card rounded-xl border border-border p-4 text-center">
        <BarChart3 className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
        <p className="text-[9px] text-muted-foreground">Precisa de pelo menos 2 apostas para monitoramento</p>
      </div>
    );
  }

  const PIE_COLORS = ['hsl(0, 72%, 51%)', 'hsl(0, 0%, 20%)', 'hsl(142, 76%, 36%)'];

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-2 p-3 border-b border-border/50">
        <BarChart3 className="w-4 h-4 text-primary" />
        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider flex-1 text-left">
          Monitor de Performance
        </span>
        <div className="flex items-center gap-2">
          <span className={`text-[9px] font-mono font-bold ${metrics.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {metrics.totalPnl >= 0 ? '+' : ''}{metrics.totalPnl.toFixed(2)}
          </span>
          <span className="text-[8px] font-mono text-muted-foreground">
            WR {Math.round(metrics.winRate * 100)}%
          </span>
          <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Quick Stats Row (always visible) */}
      <div className="grid grid-cols-4 gap-px bg-border/30">
        {[
          { label: 'Win Rate', value: `${Math.round(metrics.winRate * 100)}%`, color: metrics.winRate > 0.5 ? 'text-green-400' : 'text-red-400' },
          { label: 'Sharpe', value: `${metrics.sharpe}`, color: metrics.sharpe > 0 ? 'text-green-400' : 'text-red-400' },
          { label: 'Max DD', value: `${metrics.maxDrawdown}`, color: 'text-red-400' },
          { label: 'P.Factor', value: `${metrics.profitFactor}`, color: Number(metrics.profitFactor) > 1 ? 'text-green-400' : 'text-amber-400' },
        ].map(s => (
          <div key={s.label} className="bg-card p-2 text-center">
            <div className="text-[6px] text-muted-foreground uppercase">{s.label}</div>
            <div className={`text-[11px] font-black font-mono ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Anomaly Alert */}
      {metrics.anomalyMsg && (
        <div className={`px-3 py-2 flex items-center gap-2 ${
          metrics.anomaly && metrics.anomalyMsg.startsWith('⚠️')
            ? 'bg-destructive/5 border-b border-destructive/20'
            : 'bg-green-500/5 border-b border-green-500/20'
        }`}>
          <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
          <span className="text-[8px] font-bold text-muted-foreground">{metrics.anomalyMsg}</span>
        </div>
      )}

      {/* Expanded Details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-3 space-y-3">
              {/* P&L Chart */}
              <div>
                <div className="text-[8px] font-bold text-muted-foreground uppercase mb-2">Curva de P&L</div>
                <div className="h-32 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={metrics.pnlSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
                      <XAxis dataKey="x" tick={{ fontSize: 8, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis tick={{ fontSize: 8, fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: 8,
                          fontSize: 10,
                        }}
                        formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'P&L']}
                      />
                      <Line
                        type="monotone"
                        dataKey="pnl"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Detailed stats grid */}
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { label: 'Total Apostas', value: metrics.total },
                  { label: 'Vitórias', value: metrics.wins },
                  { label: 'Derrotas', value: metrics.losses },
                  { label: 'Média Ganho', value: `R$${metrics.avgWin}` },
                  { label: 'Média Perda', value: `R$${metrics.avgLoss}` },
                  { label: 'Streak Win', value: `${metrics.maxWinStreak}×` },
                  { label: 'Streak Loss', value: `${metrics.maxLossStreak}×` },
                  { label: 'Saldo', value: `R$${balance.toFixed(0)}` },
                  { label: 'ROI', value: `${balance > 0 ? ((metrics.totalPnl / balance) * 100).toFixed(1) : 0}%` },
                ].map(s => (
                  <div key={s.label} className="bg-secondary/30 rounded-lg p-2 text-center">
                    <div className="text-[6px] text-muted-foreground uppercase">{s.label}</div>
                    <div className="text-[10px] font-black text-foreground font-mono">{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Color Distribution Pie */}
              <div>
                <div className="text-[8px] font-bold text-muted-foreground uppercase mb-2">Distribuição de Cores (50 giros)</div>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Vermelho', value: metrics.colorDist.red },
                            { name: 'Preto', value: metrics.colorDist.black },
                            { name: 'Verde', value: metrics.colorDist.green },
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={15}
                          outerRadius={35}
                          dataKey="value"
                        >
                          {PIE_COLORS.map((color, i) => (
                            <Cell key={i} fill={color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-1">
                    {[
                      { label: '🔴 Vermelho', count: metrics.colorDist.red, color: 'text-red-400' },
                      { label: '⚫ Preto', count: metrics.colorDist.black, color: 'text-foreground' },
                      { label: '🟢 Verde', count: metrics.colorDist.green, color: 'text-green-400' },
                    ].map(c => (
                      <div key={c.label} className="flex items-center gap-2">
                        <span className="text-[8px]">{c.label}</span>
                        <span className={`text-[9px] font-mono font-bold ${c.color}`}>{c.count}</span>
                        <span className="text-[7px] text-muted-foreground">({allNumbers.length > 0 ? Math.round(c.count / Math.min(50, allNumbers.length) * 100) : 0}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

PerformanceMonitor.displayName = 'PerformanceMonitor';
export default PerformanceMonitor;