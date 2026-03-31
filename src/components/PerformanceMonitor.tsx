import { memo, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart3, AlertTriangle, ChevronDown } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts';

interface BetEntry { won: boolean; amount: number; profit: number; timestamp: number }
interface Props { betHistory: BetEntry[]; balance: number; allNumbers: number[] }

const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

const PerformanceMonitor = memo(({ betHistory, balance, allNumbers }: Props) => {
  const [expanded, setExpanded] = useState(false);

  const metrics = useMemo(() => {
    if (betHistory.length < 2) return null;
    const wins = betHistory.filter(b => b.won).length;
    const total = betHistory.length;
    const winRate = total > 0 ? wins / total : 0;
    let cumPnl = 0;
    const pnlSeries = betHistory.slice().reverse().map((b, i) => { cumPnl += b.profit; return { x: i + 1, pnl: Math.round(cumPnl * 100) / 100 }; });
    let peak = 0, maxDD = 0;
    pnlSeries.forEach(p => { if (p.pnl > peak) peak = p.pnl; const dd = peak - p.pnl; if (dd > maxDD) maxDD = dd; });
    const returns = betHistory.map(b => b.profit);
    const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const stdReturn = Math.sqrt(returns.reduce((a, r) => a + (r - meanReturn) ** 2, 0) / returns.length);
    const sharpe = stdReturn > 0 ? meanReturn / stdReturn : 0;
    const grossProfit = returns.filter(r => r > 0).reduce((a, b) => a + b, 0);
    const grossLoss = Math.abs(returns.filter(r => r < 0).reduce((a, b) => a + b, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
    const avgWin = wins > 0 ? grossProfit / wins : 0;
    const losses = total - wins;
    const avgLoss = losses > 0 ? grossLoss / losses : 0;
    let maxWinStreak = 0, maxLossStreak = 0, curWin = 0, curLoss = 0;
    betHistory.forEach(b => { if (b.won) { curWin++; curLoss = 0; maxWinStreak = Math.max(maxWinStreak, curWin); } else { curLoss++; curWin = 0; maxLossStreak = Math.max(maxLossStreak, curLoss); } });
    const recent10WR = betHistory.slice(0, 10).filter(b => b.won).length / Math.min(10, betHistory.length);
    const anomaly = Math.abs(recent10WR - winRate) > 0.25;
    const anomalyMsg = anomaly ? recent10WR < winRate ? '⚠️ Performance recente abaixo da média — possível mudança de regime' : '🔥 Performance recente acima da média — momentum positivo' : null;
    const colorDist = { red: 0, black: 0, green: 0 };
    allNumbers.slice(0, 50).forEach(n => { if (n === 0) colorDist.green++; else if (RED.has(n)) colorDist.red++; else colorDist.black++; });
    return { winRate, total, wins, losses, pnlSeries, totalPnl: cumPnl, maxDrawdown: Math.round(maxDD * 100) / 100, sharpe: Math.round(sharpe * 100) / 100, profitFactor: profitFactor === Infinity ? '∞' : Math.round(profitFactor * 100) / 100, avgWin: Math.round(avgWin * 100) / 100, avgLoss: Math.round(avgLoss * 100) / 100, maxWinStreak, maxLossStreak, anomaly, anomalyMsg, colorDist };
  }, [betHistory, allNumbers]);

  if (!metrics) {
    return (
      <div className="glass rounded-2xl p-6 text-center border border-border/20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-neon-green/[0.02] via-transparent to-neon-cyan/[0.01]" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-green/20 to-transparent" />
        <div className="relative">
          <div className="w-12 h-12 rounded-2xl glass border border-border/15 flex items-center justify-center mx-auto mb-2.5">
            <BarChart3 className="w-5 h-5 text-muted-foreground/15" />
          </div>
          <p className="text-[9px] text-muted-foreground/40 font-display tracking-wider">AGUARDANDO DADOS</p>
          <p className="text-[7px] text-muted-foreground/25 mt-1 font-mono">Precisa de ≥2 apostas para monitoramento</p>
        </div>
      </div>
    );
  }

  const PIE_COLORS = ['hsl(0, 72%, 51%)', 'hsl(0, 0%, 20%)', 'hsl(142, 76%, 36%)'];

  return (
    <div className="glass rounded-2xl overflow-hidden border border-border/20 relative">
      <div className="absolute inset-0 bg-gradient-to-br from-neon-green/[0.01] via-transparent to-neon-cyan/[0.01]" />
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-3 p-4 border-b border-border/10 relative">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-neon-green/15 to-neon-cyan/10 border border-neon-green/20 flex items-center justify-center shadow-neon-green">
          <BarChart3 className="w-4 h-4 text-neon-green" />
        </div>
        <div className="flex-1 text-left">
          <span className="text-[10px] font-display font-bold text-muted-foreground/60 uppercase tracking-[0.15em]">Monitor de Performance</span>
          <div className="text-[7px] text-muted-foreground/40 font-mono mt-0.5">{metrics.total} apostas registradas</div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-[11px] font-mono font-bold ${metrics.totalPnl >= 0 ? 'text-neon-green' : 'text-destructive'}`}>
            {metrics.totalPnl >= 0 ? '+' : ''}{metrics.totalPnl.toFixed(2)}
          </span>
          <span className="text-[8px] font-mono text-muted-foreground/40 px-2 py-0.5 rounded-lg glass border border-border/15">WR {Math.round(metrics.winRate * 100)}%</span>
          <ChevronDown className={`w-4 h-4 text-muted-foreground/25 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </button>

      <div className="grid grid-cols-4 gap-px bg-border/10">
        {[
          { label: 'Win Rate', value: `${Math.round(metrics.winRate * 100)}%`, color: metrics.winRate > 0.5 ? 'text-neon-green' : 'text-destructive' },
          { label: 'Sharpe', value: `${metrics.sharpe}`, color: metrics.sharpe > 0 ? 'text-neon-green' : 'text-destructive' },
          { label: 'Max DD', value: `${metrics.maxDrawdown}`, color: 'text-destructive' },
          { label: 'P.Factor', value: `${metrics.profitFactor}`, color: Number(metrics.profitFactor) > 1 ? 'text-neon-green' : 'text-gold' },
        ].map(s => (
          <div key={s.label} className="bg-background/10 p-2 text-center backdrop-blur-sm">
            <div className="text-[6px] text-muted-foreground/30 uppercase">{s.label}</div>
            <div className={`text-[11px] font-black font-mono ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {metrics.anomalyMsg && (
        <div className={`px-3 py-2 flex items-center gap-2 ${
          metrics.anomaly && metrics.anomalyMsg.startsWith('⚠️') ? 'bg-destructive/3 border-b border-destructive/10' : 'bg-neon-green/3 border-b border-neon-green/10'
        }`}>
          <AlertTriangle className="w-3 h-3 text-gold shrink-0" />
          <span className="text-[8px] font-bold text-muted-foreground/60">{metrics.anomalyMsg}</span>
        </div>
      )}

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="p-3 space-y-3">
              <div>
                <div className="text-[8px] font-bold text-muted-foreground/40 uppercase mb-2">Curva de P&L</div>
                <div className="h-32 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={metrics.pnlSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.15)" />
                      <XAxis dataKey="x" tick={{ fontSize: 8, fill: 'hsl(var(--muted-foreground) / 0.3)' }} />
                      <YAxis tick={{ fontSize: 8, fill: 'hsl(var(--muted-foreground) / 0.3)' }} />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border) / 0.2)', borderRadius: 8, fontSize: 10 }} formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'P&L']} />
                      <Line type="monotone" dataKey="pnl" stroke="hsl(var(--neon-cyan))" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { label: 'Total Apostas', value: metrics.total }, { label: 'Vitórias', value: metrics.wins }, { label: 'Derrotas', value: metrics.losses },
                  { label: 'Média Ganho', value: `R$${metrics.avgWin}` }, { label: 'Média Perda', value: `R$${metrics.avgLoss}` }, { label: 'Streak Win', value: `${metrics.maxWinStreak}×` },
                  { label: 'Streak Loss', value: `${metrics.maxLossStreak}×` }, { label: 'Saldo', value: `R$${balance.toFixed(0)}` }, { label: 'ROI', value: `${balance > 0 ? ((metrics.totalPnl / balance) * 100).toFixed(1) : 0}%` },
                ].map(s => (
                  <div key={s.label} className="bg-background/10 rounded-lg p-2 text-center border border-border/5 backdrop-blur-sm">
                    <div className="text-[6px] text-muted-foreground/30 uppercase">{s.label}</div>
                    <div className="text-[10px] font-black text-foreground/70 font-mono">{s.value}</div>
                  </div>
                ))}
              </div>

              <div>
                <div className="text-[8px] font-bold text-muted-foreground/40 uppercase mb-2">Distribuição de Cores (50 giros)</div>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart><Pie data={[{ name: 'Vermelho', value: metrics.colorDist.red }, { name: 'Preto', value: metrics.colorDist.black }, { name: 'Verde', value: metrics.colorDist.green }]} cx="50%" cy="50%" innerRadius={15} outerRadius={35} dataKey="value">
                        {PIE_COLORS.map((color, i) => <Cell key={i} fill={color} />)}
                      </Pie></PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-1">
                    {[
                      { label: '🔴 Vermelho', count: metrics.colorDist.red, color: 'text-red-400' },
                      { label: '⚫ Preto', count: metrics.colorDist.black, color: 'text-foreground/60' },
                      { label: '🟢 Verde', count: metrics.colorDist.green, color: 'text-neon-green' },
                    ].map(c => (
                      <div key={c.label} className="flex items-center gap-2">
                        <span className="text-[8px]">{c.label}</span>
                        <span className={`text-[9px] font-mono font-bold ${c.color}`}>{c.count}</span>
                        <span className="text-[7px] text-muted-foreground/30">({allNumbers.length > 0 ? Math.round(c.count / Math.min(50, allNumbers.length) * 100) : 0}%)</span>
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
