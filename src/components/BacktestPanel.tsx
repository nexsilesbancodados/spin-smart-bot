import { useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FlaskConical, Trophy, TrendingUp, Zap, BarChart3, Loader2, ChevronDown, Target, Award } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface StrategyResult {
  name: string;
  label: string;
  category: string;
  total: number;
  hits: number;
  exactHits: number;
  neighborHits: number;
  winRate: number;
  exactRate: number;
  activationRate: number;
}

interface CategoryResult {
  category: string;
  winRate: number;
  totalBets: number;
}

interface BacktestData {
  strategies: StrategyResult[];
  categories: CategoryResult[];
  totalSpins: number;
  testedSpins: number;
  totalStrategies: number;
}

const CATEGORY_INFO: Record<string, { emoji: string; label: string; color: string }> = {
  terminal: { emoji: '🔢', label: 'Terminal', color: 'text-cyan-400' },
  puxada: { emoji: '🧲', label: 'Puxada', color: 'text-pink-400' },
  vizinhos: { emoji: '🎯', label: 'Vizinhos', color: 'text-orange-400' },
  setor: { emoji: '🌍', label: 'Setor', color: 'text-emerald-400' },
  duzia: { emoji: '📊', label: 'Dúzia', color: 'text-blue-400' },
  coluna: { emoji: '📐', label: 'Coluna', color: 'text-purple-400' },
  cor: { emoji: '🎨', label: 'Cor', color: 'text-red-400' },
  paridade: { emoji: '⚖️', label: 'Paridade', color: 'text-amber-400' },
  alto_baixo: { emoji: '📏', label: 'Alto/Baixo', color: 'text-teal-400' },
  cavalos: { emoji: '🐴', label: 'Cavalos', color: 'text-orange-300' },
  pleno: { emoji: '💎', label: 'Pleno', color: 'text-yellow-400' },
  rua: { emoji: '🛤️', label: 'Rua', color: 'text-indigo-400' },
  fusao: { emoji: '🧬', label: 'Fusão', color: 'text-violet-400' },
};

const getMedalEmoji = (rank: number) => {
  if (rank === 0) return '🥇';
  if (rank === 1) return '🥈';
  if (rank === 2) return '🥉';
  return `#${rank + 1}`;
};

const getWinRateColor = (rate: number) => {
  if (rate >= 50) return 'text-neon-green';
  if (rate >= 35) return 'text-primary';
  if (rate >= 25) return 'text-yellow-400';
  return 'text-muted-foreground';
};

const getWinRateBarColor = (rate: number) => {
  if (rate >= 50) return 'bg-gradient-to-r from-neon-green to-emerald-400';
  if (rate >= 35) return 'bg-gradient-to-r from-primary to-cyan-400';
  if (rate >= 25) return 'bg-yellow-400';
  return 'bg-muted-foreground/50';
};

const BacktestPanel = memo(() => {
  const [data, setData] = useState<BacktestData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  const runBacktest = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: fnError } = await supabase.functions.invoke('backtest-strategies');
      if (fnError) throw new Error(fnError.message);
      setData(result);
    } catch (e: any) {
      setError(e.message || 'Erro ao rodar backtest');
    } finally {
      setLoading(false);
    }
  };

  const filteredStrategies = data?.strategies.filter(s => !filterCategory || s.category === filterCategory) || [];
  const displayStrategies = showAll ? filteredStrategies : filteredStrategies.slice(0, 15);

  return (
    <div className="space-y-3">
      {/* Header + Run Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold text-foreground/80">Backtest Automático</span>
        </div>
        <button
          onClick={runBacktest}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/15 text-primary border border-primary/30 text-[10px] font-bold hover:bg-primary/25 transition-all disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              Processando...
            </>
          ) : (
            <>
              <Zap className="w-3 h-3" />
              {data ? 'Rodar Novamente' : 'Rodar 60+ IAs × 500 Giros'}
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">
          <p className="text-[10px] text-destructive">{error}</p>
        </div>
      )}

      {/* Results */}
      <AnimatePresence>
        {data && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-secondary/30 rounded-lg border border-border/30 p-2.5 text-center">
                <p className="text-lg font-black text-foreground">{data.totalStrategies}</p>
                <p className="text-[8px] text-muted-foreground font-bold">IAs</p>
              </div>
              <div className="bg-secondary/30 rounded-lg border border-border/30 p-2.5 text-center">
                <p className="text-lg font-black text-foreground">{data.testedSpins}</p>
                <p className="text-[8px] text-muted-foreground font-bold">Giros</p>
              </div>
              <div className="bg-secondary/30 rounded-lg border border-border/30 p-2.5 text-center">
                <p className="text-lg font-black text-neon-green">{data.strategies[0]?.winRate || 0}%</p>
                <p className="text-[8px] text-muted-foreground font-bold">Melhor</p>
              </div>
              <div className="bg-secondary/30 rounded-lg border border-border/30 p-2.5 text-center">
                <p className="text-lg font-black text-primary">
                  {data.strategies.length > 0 ? (data.strategies.reduce((a, s) => a + s.winRate, 0) / data.strategies.length).toFixed(0) : 0}%
                </p>
                <p className="text-[8px] text-muted-foreground font-bold">Média</p>
              </div>
            </div>

            {/* Category Filter */}
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setFilterCategory(null)}
                className={`text-[8px] px-2 py-1 rounded-md font-bold border transition-all ${
                  !filterCategory ? 'bg-primary/20 text-primary border-primary/40' : 'bg-secondary/30 text-muted-foreground border-border/30'
                }`}
              >
                Todas
              </button>
              {data.categories.map(c => {
                const info = CATEGORY_INFO[c.category] || { emoji: '📌', label: c.category, color: 'text-foreground' };
                return (
                  <button
                    key={c.category}
                    onClick={() => setFilterCategory(filterCategory === c.category ? null : c.category)}
                    className={`text-[8px] px-2 py-1 rounded-md font-bold border transition-all ${
                      filterCategory === c.category ? 'bg-primary/20 text-primary border-primary/40' : 'bg-secondary/30 text-muted-foreground border-border/30'
                    }`}
                  >
                    {info.emoji} {info.label} ({c.winRate}%)
                  </button>
                );
              })}
            </div>

            {/* Top 3 Podium */}
            {!filterCategory && (
              <div className="grid grid-cols-3 gap-2">
                {data.strategies.slice(0, 3).map((s, i) => {
                  const catInfo = CATEGORY_INFO[s.category] || { emoji: '📌', label: s.category, color: 'text-foreground' };
                  return (
                    <motion.div
                      key={s.name}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: i * 0.1 }}
                      className={`rounded-xl border-2 p-3 text-center ${
                        i === 0 ? 'border-yellow-500/50 bg-yellow-500/5' : i === 1 ? 'border-zinc-400/40 bg-zinc-400/5' : 'border-amber-700/40 bg-amber-700/5'
                      }`}
                    >
                      <span className="text-2xl">{getMedalEmoji(i)}</span>
                      <p className={`text-xl font-black mt-1 ${getWinRateColor(s.winRate)}`}>{s.winRate}%</p>
                      <p className="text-[9px] font-bold text-foreground/80 mt-0.5">{s.label}</p>
                      <p className="text-[7px] text-muted-foreground">{catInfo.emoji} {catInfo.label}</p>
                      <div className="flex justify-center gap-2 mt-1.5 text-[7px]">
                        <span className="text-neon-green">{s.exactHits} exato</span>
                        <span className="text-primary">{s.neighborHits} viz</span>
                      </div>
                      <p className="text-[7px] text-muted-foreground/60 mt-0.5">{s.total} ativações</p>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Strategy List */}
            <div className="space-y-1">
              {displayStrategies.map((s, i) => {
                const catInfo = CATEGORY_INFO[s.category] || { emoji: '📌', label: s.category, color: 'text-foreground' };
                const rank = data.strategies.indexOf(s);
                return (
                  <motion.div
                    key={s.name}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/20 border border-border/20 hover:bg-secondary/40 transition-colors"
                  >
                    <span className="text-[9px] font-mono text-muted-foreground w-5 text-right shrink-0">
                      {rank < 3 ? getMedalEmoji(rank) : `${rank + 1}.`}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[9px] font-bold ${catInfo.color}`}>{catInfo.emoji}</span>
                        <span className="text-[10px] font-bold text-foreground/80 truncate">{s.label}</span>
                        <span className="text-[7px] text-muted-foreground/60 shrink-0">({s.total}x)</span>
                      </div>
                      <div className="w-full h-1 bg-secondary rounded-full mt-1 overflow-hidden">
                        <div className={`h-full rounded-full ${getWinRateBarColor(s.winRate)}`}
                          style={{ width: `${Math.min(s.winRate, 100)}%` }} />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-sm font-black ${getWinRateColor(s.winRate)}`}>{s.winRate}%</span>
                      <div className="flex gap-1.5 text-[7px] justify-end">
                        <span className="text-neon-green/70">{s.exactRate}% ex</span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Show More */}
            {filteredStrategies.length > 15 && (
              <button
                onClick={() => setShowAll(!showAll)}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-[9px] font-bold text-muted-foreground hover:text-primary transition-colors"
              >
                {showAll ? 'Mostrar menos' : `Ver todas (${filteredStrategies.length})`}
                <ChevronDown className={`w-3 h-3 transition-transform ${showAll ? 'rotate-180' : ''}`} />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty State */}
      {!data && !loading && (
        <div className="text-center py-6 space-y-2">
          <BarChart3 className="w-8 h-8 text-muted-foreground/30 mx-auto" />
          <p className="text-[10px] text-muted-foreground">
            Rode o backtest para ver a taxa de acerto real de cada IA nos últimos 500 giros
          </p>
        </div>
      )}
    </div>
  );
});

BacktestPanel.displayName = 'BacktestPanel';
export default BacktestPanel;
