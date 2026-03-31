import { useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FlaskConical, Trophy, Zap, BarChart3, Loader2, ChevronDown, Target, Sparkles } from 'lucide-react';
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

const getMedalEmoji = (rank: number) => rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : `#${rank + 1}`;

const getWinRateColor = (rate: number) => {
  if (rate >= 50) return 'text-neon-green';
  if (rate >= 35) return 'text-primary';
  if (rate >= 25) return 'text-gold';
  return 'text-muted-foreground';
};

const getWinRateBarColor = (rate: number) => {
  if (rate >= 50) return 'bg-gradient-to-r from-neon-green to-emerald-400';
  if (rate >= 35) return 'bg-gradient-to-r from-primary to-cyan-400';
  if (rate >= 25) return 'bg-gradient-to-r from-gold to-amber-400';
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
    <div className="glass rounded-2xl overflow-hidden border border-border/20">
      {/* Header */}
      <div className="relative px-4 pt-4 pb-3">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/4 via-transparent to-neon-green/3" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/15 to-neon-green/10 border border-primary/20 flex items-center justify-center shadow-[0_0_15px_hsl(var(--primary)/0.15)]">
              <FlaskConical className="w-5 h-5 text-primary" />
            </div>
            <div>
              <span className="text-xs font-display font-bold text-primary tracking-[0.15em] uppercase">Backtest Automático</span>
              <div className="text-[8px] text-muted-foreground/50 font-mono mt-0.5">60+ IAs × 500 giros históricos</div>
            </div>
          </div>
          <motion.button
            onClick={runBacktest}
            disabled={loading}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary/10 text-primary border border-primary/25 text-[10px] font-bold hover:bg-primary/20 transition-all disabled:opacity-50 font-display tracking-wider"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5" />
                {data ? 'Rodar Novamente' : 'Iniciar Backtest'}
              </>
            )}
          </motion.button>
        </div>
      </div>

      <div className="px-4 pb-4">
        {error && (
          <div className="bg-destructive/8 border border-destructive/20 rounded-xl px-3 py-2.5 mb-3">
            <p className="text-[10px] text-destructive">{error}</p>
          </div>
        )}

        <AnimatePresence>
          {data && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { value: data.totalStrategies, label: 'IAs', color: 'text-foreground/80' },
                  { value: data.testedSpins, label: 'Giros', color: 'text-foreground/80' },
                  { value: `${data.strategies[0]?.winRate || 0}%`, label: 'Melhor', color: 'text-neon-green' },
                  { value: `${data.strategies.length > 0 ? (data.strategies.reduce((a, s) => a + s.winRate, 0) / data.strategies.length).toFixed(0) : 0}%`, label: 'Média', color: 'text-primary' },
                ].map((s, i) => (
                  <motion.div
                    key={s.label}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="glass rounded-xl border border-border/15 p-2.5 text-center backdrop-blur-sm"
                  >
                    <p className={`text-lg font-black ${s.color}`}>{s.value}</p>
                    <p className="text-[7px] text-muted-foreground/40 font-display tracking-wider uppercase">{s.label}</p>
                  </motion.div>
                ))}
              </div>

              {/* Category Filter */}
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setFilterCategory(null)}
                  className={`text-[8px] px-2.5 py-1 rounded-xl font-bold border transition-all ${
                    !filterCategory ? 'bg-primary/15 text-primary border-primary/30' : 'bg-background/10 text-muted-foreground/60 border-border/15 hover:border-border/25'
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
                      className={`text-[8px] px-2.5 py-1 rounded-xl font-bold border transition-all ${
                        filterCategory === c.category ? 'bg-primary/15 text-primary border-primary/30' : 'bg-background/10 text-muted-foreground/60 border-border/15 hover:border-border/25'
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
                        className={`rounded-xl border-2 p-3 text-center relative overflow-hidden ${
                          i === 0 ? 'border-gold/40 bg-gold/3' : i === 1 ? 'border-zinc-400/30 bg-zinc-400/3' : 'border-amber-700/30 bg-amber-700/3'
                        }`}
                      >
                        {i === 0 && <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-gold/3" />}
                        <div className="relative">
                          <span className="text-2xl">{getMedalEmoji(i)}</span>
                          <p className={`text-xl font-black mt-1 ${getWinRateColor(s.winRate)}`}>{s.winRate}%</p>
                          <p className="text-[9px] font-bold text-foreground/80 mt-0.5">{s.label}</p>
                          <p className="text-[7px] text-muted-foreground">{catInfo.emoji} {catInfo.label}</p>
                          <div className="flex justify-center gap-2 mt-1.5 text-[7px]">
                            <span className="text-neon-green">{s.exactHits} exato</span>
                            <span className="text-primary">{s.neighborHits} viz</span>
                          </div>
                          <p className="text-[7px] text-muted-foreground/60 mt-0.5 font-mono">{s.total} ativações</p>
                        </div>
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
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-background/10 border border-border/10 hover:border-border/20 transition-all"
                    >
                      <span className="text-[9px] font-mono text-muted-foreground w-5 text-right shrink-0">
                        {rank < 3 ? getMedalEmoji(rank) : `${rank + 1}.`}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[9px] font-bold ${catInfo.color}`}>{catInfo.emoji}</span>
                          <span className="text-[10px] font-bold text-foreground/80 truncate">{s.label}</span>
                          <span className="text-[7px] text-muted-foreground/50 shrink-0 font-mono">({s.total}×)</span>
                        </div>
                        <div className="w-full h-1.5 bg-background/20 rounded-full mt-1 overflow-hidden border border-border/5">
                          <motion.div
                            className={`h-full rounded-full ${getWinRateBarColor(s.winRate)}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(s.winRate, 100)}%` }}
                            transition={{ duration: 0.5, delay: i * 0.02 }}
                          />
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

        {!data && !loading && (
          <div className="text-center py-8 space-y-3">
            <div className="w-14 h-14 rounded-2xl glass border border-border/15 flex items-center justify-center mx-auto">
              <BarChart3 className="w-7 h-7 text-muted-foreground/15" />
            </div>
            <p className="text-[10px] text-muted-foreground/50">
              Rode o backtest para ver a taxa de acerto real de cada IA
            </p>
          </div>
        )}
      </div>
    </div>
  );
});

BacktestPanel.displayName = 'BacktestPanel';
export default BacktestPanel;
