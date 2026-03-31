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
      const { data } = await supabase.from('strategy_stats').select('*').gte('total_predictions', 3).order('win_rate', { ascending: false }).limit(10);
      if (data) setStats(data as StratStat[]);
    };
    load();
    const ch = supabase.channel('strategy_stats_rt').on('postgres_changes', { event: '*', schema: 'public', table: 'strategy_stats' }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  if (stats.length === 0) return null;

  return (
    <div className="glass rounded-xl p-3.5">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-gold/15 to-amber-500/10 border border-gold/20 flex items-center justify-center shadow-[0_0_10px_rgba(255,215,0,0.1)]">
          <Trophy className="w-3.5 h-3.5 text-gold" />
        </div>
        <span className="font-display text-[10px] tracking-[0.15em] font-bold text-gold">RANKING ESTRATÉGIAS</span>
        <span className="text-[7px] px-1.5 py-0.5 rounded-full bg-gold/6 text-gold/70 border border-gold/12 font-bold ml-auto">APRENDIZADO CONTÍNUO</span>
      </div>

      <div className="space-y-1.5">
        {stats.map((s, i) => {
          const wr = (s.win_rate * 100);
          const isHot = wr >= 45;
          const isCold = wr < 25;
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`;
          return (
            <motion.div key={s.strategy_type} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
              className={`flex items-center gap-2 p-2.5 rounded-lg border backdrop-blur-sm ${
                isHot ? 'bg-neon-green/3 border-neon-green/12' : isCold ? 'bg-background/10 border-border/10 opacity-50' : 'bg-background/15 border-border/15'
              }`}>
              <span className="text-sm w-5 shrink-0">{medal}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[9px] font-bold text-foreground/70 truncate">{s.strategy_label || s.strategy_type}</span>
                  <span className={`text-[10px] font-mono font-black ml-2 shrink-0 ${isHot ? 'text-neon-green' : isCold ? 'text-muted-foreground/30' : 'text-foreground/60'}`}>{wr.toFixed(0)}%</span>
                </div>
                <div className="w-full h-1 bg-background/20 rounded-full overflow-hidden border border-border/5">
                  <motion.div className={`h-full rounded-full ${isHot ? 'bg-neon-green' : isCold ? 'bg-muted-foreground/20' : 'bg-neon-cyan/40'}`}
                    animate={{ width: `${Math.min(wr, 100)}%` }} transition={{ duration: 0.6 }} />
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[7px] text-muted-foreground/40 font-mono">{s.total_hits}/{s.total_predictions}</div>
                {s.current_streak > 1 && <div className="text-[7px] text-gold font-bold">🔥{s.current_streak}</div>}
              </div>
            </motion.div>
          );
        })}
      </div>
      <p className="text-[7px] text-muted-foreground/25 mt-2 text-center">Atualizado automaticamente • Estratégias com ≥3 previsões</p>
    </div>
  );
};

export default StrategyLeaderboard;
