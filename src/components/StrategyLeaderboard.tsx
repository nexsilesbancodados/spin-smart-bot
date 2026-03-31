import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trophy, TrendingUp, Flame } from 'lucide-react';

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

const StrategyLeaderboard = () => {
  const [stats, setStats] = useState<StratStat[]>([]);

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

  return (
    <div className="glass rounded-2xl overflow-hidden border border-border/20">
      {/* Header */}
      <div className="relative px-4 pt-4 pb-3">
        <div className="absolute inset-0 bg-gradient-to-r from-gold/5 via-transparent to-amber-500/3" />
        <div className="relative flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gold/20 to-amber-500/10 border border-gold/25 flex items-center justify-center shadow-[0_0_15px_rgba(255,215,0,0.1)]">
            <Trophy className="w-4 h-4 text-gold" />
          </div>
          <div className="flex-1">
            <span className="font-display text-[10px] tracking-[0.15em] font-bold text-gold uppercase">Ranking Estratégias</span>
            <div className="text-[7px] text-muted-foreground/50 font-mono">Performance em tempo real</div>
          </div>
          <span className="text-[7px] px-2 py-1 rounded-lg glass text-gold/70 border border-gold/15 font-bold font-display tracking-wider">
            APRENDIZADO CONTÍNUO
          </span>
        </div>
      </div>

      {/* List */}
      <div className="px-3 pb-3 space-y-1.5">
        {stats.map((s, i) => {
          const wr = (s.win_rate * 100);
          const isHot = wr >= 45;
          const isCold = wr < 25;
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`;
          return (
            <motion.div key={s.strategy_type} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
              className={`flex items-center gap-2.5 p-3 rounded-xl border backdrop-blur-sm transition-all ${
                i === 0 ? 'glass border-gold/20 bg-gold/3' :
                isHot ? 'glass border-neon-green/15 bg-neon-green/2' : 
                isCold ? 'bg-background/10 border-border/10 opacity-45' : 
                'glass border-border/15'
              }`}>
              <span className="text-sm w-6 shrink-0 text-center">{medal}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-foreground/80 truncate">{s.strategy_label || s.strategy_type}</span>
                  <span className={`text-[11px] font-mono font-black ml-2 shrink-0 ${
                    i === 0 ? 'text-gold' : isHot ? 'text-neon-green' : isCold ? 'text-muted-foreground/30' : 'text-foreground/60'
                  }`}>{wr.toFixed(0)}%</span>
                </div>
                <div className="w-full h-1.5 bg-background/20 rounded-full overflow-hidden border border-border/5">
                  <motion.div className={`h-full rounded-full ${
                    i === 0 ? 'bg-gradient-to-r from-gold to-amber-400' :
                    isHot ? 'bg-gradient-to-r from-neon-green to-emerald-400' : 
                    isCold ? 'bg-muted-foreground/20' : 
                    'bg-neon-cyan/40'
                  }`}
                    animate={{ width: `${Math.min(wr, 100)}%` }} transition={{ duration: 0.6 }} />
                </div>
              </div>
              <div className="text-right shrink-0 flex flex-col items-end gap-0.5">
                <div className="text-[8px] text-muted-foreground/40 font-mono">{s.total_hits}/{s.total_predictions}</div>
                {s.current_streak > 1 && (
                  <div className="flex items-center gap-0.5 text-[7px] text-gold font-bold">
                    <Flame className="w-2.5 h-2.5" />
                    {s.current_streak}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
      <p className="text-[7px] text-muted-foreground/25 pb-3 text-center font-mono">Atualizado automaticamente • Estratégias com ≥3 previsões</p>
    </div>
  );
};

export default StrategyLeaderboard;
