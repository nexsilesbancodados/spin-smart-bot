import { useState, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Flame, Award, TrendingUp, ChevronDown } from 'lucide-react';

interface StratStat {
  strategy_type: string;
  strategy_label: string;
  total_predictions: number;
  total_hits: number;
  win_rate: number;
  avg_probability: number;
  best_streak: number;
  current_streak: number;
  last_hit_at: string | null;
}

import { supabase } from '@/integrations/supabase/client';

const StrategyLeaderboard = memo(() => {
  const [stats, setStats] = useState<StratStat[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('strategy_stats').select('*').gte('total_predictions', 3).order('win_rate', { ascending: false }).limit(10);
      if (data) setStats(data as StratStat[]);
    };
    load();
    const ch = supabase.channel('strategy_stats_rt').on('postgres_changes', { event: '*', schema: 'public', table: 'strategy_stats' }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  if (stats.length === 0) return null;

  const topStrategy = stats[0];
  const topWr = (topStrategy.win_rate * 100).toFixed(0);
  const displayStats = expanded ? stats : stats.slice(0, 5);

  return (
    <div className="glass rounded-2xl overflow-hidden border border-border/20">
      {/* Header */}
      <div className="relative px-4 pt-4 pb-3">
        <div className="absolute inset-0 bg-gradient-to-r from-gold/5 via-transparent to-amber-500/3" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
        <div className="relative flex items-center gap-2.5">
          <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-gold/20 to-amber-500/10 border border-gold/25 flex items-center justify-center shadow-[0_0_15px_rgba(255,215,0,0.15)]">
            <Trophy className="w-5 h-5 text-gold" />
          </div>
          <div className="flex-1">
            <span className="font-display text-xs tracking-[0.15em] font-bold text-gold uppercase">Ranking Estratégias</span>
            <div className="text-[8px] text-muted-foreground/50 font-mono mt-0.5">
              Líder: {topStrategy.strategy_label || topStrategy.strategy_type} — {topWr}% WR
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[7px] px-2.5 py-1 rounded-xl glass text-gold/70 border border-gold/15 font-bold font-display tracking-wider flex items-center gap-1">
              <Award className="w-3 h-3" />
              LIVE
            </span>
          </div>
        </div>
      </div>

      {/* Podium — Top 3 summary */}
      {stats.length >= 3 && (
        <div className="px-4 pb-3">
          <div className="grid grid-cols-3 gap-1.5">
            {stats.slice(0, 3).map((s, i) => {
              const wr = (s.win_rate * 100).toFixed(0);
              const medals = ['🥇', '🥈', '🥉'];
              const borders = ['border-gold/25 bg-gold/5', 'border-muted-foreground/15 bg-muted/5', 'border-amber-700/15 bg-amber-900/5'];
              return (
                <motion.div
                  key={s.strategy_type}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className={`glass rounded-xl p-2.5 border text-center relative overflow-hidden ${borders[i]}`}
                >
                  <div className="text-lg mb-0.5">{medals[i]}</div>
                  <div className="text-[8px] font-bold text-foreground/70 truncate">{s.strategy_label || s.strategy_type}</div>
                  <div className={`text-[13px] font-black font-mono mt-0.5 ${
                    i === 0 ? 'text-gold' : 'text-foreground/60'
                  }`}>{wr}%</div>
                  <div className="text-[7px] text-muted-foreground/30 font-mono">{s.total_hits}/{s.total_predictions}</div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Full List */}
      <div className="px-3 pb-2 space-y-1">
        {displayStats.map((s, i) => {
          const wr = (s.win_rate * 100);
          const isHot = wr >= 45;
          const isCold = wr < 25;
          return (
            <motion.div key={s.strategy_type} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
              className={`flex items-center gap-2.5 p-2.5 rounded-xl border backdrop-blur-sm transition-all hover:scale-[1.01] ${
                i === 0 ? 'glass border-gold/20 bg-gold/3 relative overflow-hidden' :
                isHot ? 'glass border-neon-green/15 bg-neon-green/2' : 
                isCold ? 'bg-background/5 border-border/10 opacity-45' : 
                'glass border-border/15'
              }`}>
              {i === 0 && <div className="absolute inset-0 bg-gradient-to-r from-gold/3 via-transparent to-gold/2" />}
              <span className="relative text-[10px] font-mono w-5 shrink-0 text-center text-muted-foreground/40">#{i+1}</span>
              <div className="relative flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[10px] font-bold text-foreground/80 truncate">{s.strategy_label || s.strategy_type}</span>
                    {isHot && <TrendingUp className="w-3 h-3 text-neon-green shrink-0" />}
                  </div>
                  <span className={`text-[11px] font-mono font-black ml-2 shrink-0 ${
                    i === 0 ? 'text-gold' : isHot ? 'text-neon-green' : isCold ? 'text-muted-foreground/30' : 'text-foreground/60'
                  }`}>{wr.toFixed(0)}%</span>
                </div>
                <div className="w-full h-2 bg-background/20 rounded-full overflow-hidden border border-border/5">
                  <motion.div className={`h-full rounded-full ${
                    i === 0 ? 'bg-gradient-to-r from-gold to-amber-400' :
                    isHot ? 'bg-gradient-to-r from-neon-green to-emerald-400' : 
                    isCold ? 'bg-muted-foreground/20' : 
                    'bg-neon-cyan/40'
                  }`}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(wr, 100)}%` }}
                    transition={{ duration: 0.6, delay: i * 0.05 }}
                  />
                </div>
              </div>
              <div className="relative text-right shrink-0 flex flex-col items-end gap-0.5">
                <div className="text-[8px] text-muted-foreground/40 font-mono">{s.total_hits}/{s.total_predictions}</div>
                {s.current_streak > 1 && (
                  <div className="flex items-center gap-0.5 text-[7px] text-gold font-bold px-1.5 py-0.5 rounded-lg bg-gold/8 border border-gold/10">
                    <Flame className="w-2.5 h-2.5" />
                    {s.current_streak}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Expand/Collapse */}
      {stats.length > 5 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full py-2 flex items-center justify-center gap-1 text-[8px] text-muted-foreground/40 hover:text-foreground/60 transition-colors border-t border-border/10"
        >
          <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          {expanded ? 'Menos' : `+${stats.length - 5} estratégias`}
        </button>
      )}

      <p className="text-[7px] text-muted-foreground/25 pb-3 text-center font-mono">Atualizado automaticamente • ≥3 previsões</p>
    </div>
  );
});

StrategyLeaderboard.displayName = 'StrategyLeaderboard';
export default StrategyLeaderboard;