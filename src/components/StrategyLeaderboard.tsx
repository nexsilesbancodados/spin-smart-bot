import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Trophy } from 'lucide-react';

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

const StrategyLeaderboard = () => {
  const [stats, setStats] = useState<StratStat[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('strategy_stats')
        .select('*')
        .gte('total_predictions', 3)
        .order('win_rate', { ascending: false })
        .limit(10);
      if (data) setStats(data as StratStat[]);
    };
    load();
    const ch = supabase.channel('strategy_stats_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'strategy_stats' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  if (stats.length === 0) return null;

  return (
    <div className="bg-card rounded-xl border border-border p-3">
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="w-4 h-4 text-yellow-400" />
        <span className="font-display text-[10px] tracking-[0.15em] font-bold text-yellow-400">RANKING DE ESTRATÉGIAS</span>
        <span className="text-[7px] px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 font-bold ml-auto">
          APRENDIZADO CONTÍNUO
        </span>
      </div>

      <div className="space-y-1.5">
        {stats.map((s, i) => {
          const wr = (s.win_rate * 100);
          const isHot = wr >= 45;
          const isCold = wr < 25;
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`;
          return (
            <motion.div
              key={s.strategy_type}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className={`flex items-center gap-2 p-2 rounded-lg border ${
                isHot ? 'bg-green-500/8 border-green-500/20' :
                isCold ? 'bg-secondary/30 border-border/50 opacity-60' :
                'bg-secondary/40 border-border'
              }`}
            >
              <span className="text-sm w-5 shrink-0">{medal}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[9px] font-bold text-foreground truncate">{s.strategy_label || s.strategy_type}</span>
                  <span className={`text-[10px] font-mono font-black ml-2 shrink-0 ${isHot ? 'text-green-400' : isCold ? 'text-muted-foreground' : 'text-foreground'}`}>
                    {wr.toFixed(0)}%
                  </span>
                </div>
                <div className="w-full h-1 bg-secondary/60 rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${isHot ? 'bg-green-500' : isCold ? 'bg-muted-foreground/40' : 'bg-primary/60'}`}
                    animate={{ width: `${Math.min(wr, 100)}%` }}
                    transition={{ duration: 0.6 }}
                  />
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[7px] text-muted-foreground font-mono">{s.total_hits}/{s.total_predictions}</div>
                {s.current_streak > 1 && (
                  <div className="text-[7px] text-orange-400 font-bold">🔥{s.current_streak}</div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
      <p className="text-[7px] text-muted-foreground mt-2 text-center">
        Atualizado automaticamente • Estratégias com ≥3 previsões
      </p>
    </div>
  );
};

export default StrategyLeaderboard;
