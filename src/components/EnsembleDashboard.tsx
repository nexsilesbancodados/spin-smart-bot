import { memo, useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Progress } from '@/components/ui/progress';
import { Brain, Zap, BarChart3, FlaskConical, Trophy, RefreshCw } from 'lucide-react';

interface ModelPerf { winRate: number; total: number; hits: number; streak: number; weight: number; }
interface DiscoveredPattern { test_name: string; description: string; significant: boolean; confidence: number; recommendation: string | null; }
interface EnsembleDashboardProps { sniperData: any; }

const MODEL_META: Record<string, { name: string; icon: string; desc: string }> = {
  markov: { name: 'Markov Chain', icon: '🔗', desc: 'Transições sequenciais (ordens 1-5)' },
  neural_pattern: { name: 'Neural Pattern', icon: '🧠', desc: 'Padrões temporais e autocorrelação' },
  gradient: { name: 'Gradient Boost', icon: '📈', desc: 'Feature scoring multi-dimensional' },
  bayesian: { name: 'Bayesiano', icon: '🎲', desc: 'Probabilidades condicionais + KL-div' },
  statistical: { name: 'Estatístico', icon: '📊', desc: 'Desvios, streaks, setores, reversão' },
  pattern_discovery: { name: 'Pattern Discovery', icon: '🔬', desc: 'Mineração de regras de associação' },
  rl_optimizer: { name: 'RL Optimizer', icon: '🤖', desc: 'Aprendizado por reforço simulado' },
};

const EnsembleDashboard = memo(({ sniperData }: EnsembleDashboardProps) => {
  const [dbWeights, setDbWeights] = useState<any[]>([]);
  const [discoveredPatterns, setDiscoveredPatterns] = useState<DiscoveredPattern[]>([]);
  const [activeView, setActiveView] = useState<'models' | 'patterns' | 'stats'>('models');
  const [isDiscovering, setIsDiscovering] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('ensemble_weights').select('*');
      if (data) setDbWeights(data);
    };
    load();
    const ch = supabase.channel('ensemble_weights_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ensemble_weights' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const runPatternDiscovery = useCallback(async () => {
    setIsDiscovering(true);
    try {
      const res = await supabase.functions.invoke('pattern-discovery');
      if (res.data?.patterns) setDiscoveredPatterns(res.data.patterns);
    } catch { /* */ }
    setIsDiscovering(false);
  }, []);

  const triggerRecalibration = useCallback(async () => {
    try {
      await supabase.functions.invoke('auto-recalibrate');
      const { data } = await supabase.from('ensemble_weights').select('*');
      if (data) setDbWeights(data);
    } catch { /* */ }
  }, []);

  const modelPerf: Record<string, ModelPerf> = useMemo(() => {
    if (sniperData?.modelPerformance) return sniperData.modelPerformance;
    const result: Record<string, ModelPerf> = {};
    for (const row of dbWeights) {
      result[row.model_id] = { winRate: Number(row.win_rate) || 0, total: row.total_predictions || 0, hits: row.total_hits || 0, streak: row.current_streak || 0, weight: Number(row.weight) || 1 };
    }
    return result;
  }, [sniperData?.modelPerformance, dbWeights]);

  const modelSignals = sniperData?.modelSignals || [];
  const temperature = sniperData?.temperature || 'morna';
  const ensembleConsensus = sniperData?.ensembleConsensus || 0;
  const ensembleConfidence = sniperData?.ensembleConfidence || 0;
  const arbiterLog = sniperData?.arbiterLog || [];
  const totalModels = sniperData?.totalModels || 7;
  const totalPreds = Object.values(modelPerf).reduce((a, m) => a + m.total, 0);
  const totalHits = Object.values(modelPerf).reduce((a, m) => a + m.hits, 0);
  const overallWR = totalPreds > 0 ? (totalHits / totalPreds * 100).toFixed(1) : '0';
  const bestModel = Object.entries(modelPerf).sort(([, a], [, b]) => b.winRate - a.winRate)[0];
  const significantPatterns = discoveredPatterns.filter(p => p.significant);

  const tempConfig = {
    quente: { color: 'text-[hsl(var(--gold))]', bg: 'bg-[hsl(var(--gold))]/5 border-[hsl(var(--gold))]/15', icon: '🔥' },
    fria: { color: 'text-[hsl(var(--neon-cyan))]', bg: 'bg-[hsl(var(--neon-cyan))]/5 border-[hsl(var(--neon-cyan))]/15', icon: '❄️' },
    caotica: { color: 'text-destructive', bg: 'bg-destructive/5 border-destructive/15', icon: '🌪️' },
    morna: { color: 'text-muted-foreground', bg: 'bg-secondary/30 border-border/20', icon: '🌡️' },
  };
  const tc = tempConfig[temperature as keyof typeof tempConfig] || tempConfig.morna;

  return (
    <div className="space-y-3">
      {/* Tab Selector — premium */}
      <div className="glass rounded-2xl p-1 border border-border/15 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.02] via-transparent to-neon-pink/[0.02]" />
        <div className="relative flex gap-1">
          {[
            { id: 'models' as const, label: 'Modelos', icon: <Brain className="w-3.5 h-3.5" />, count: totalModels },
            { id: 'patterns' as const, label: 'Padrões', icon: <FlaskConical className="w-3.5 h-3.5" />, count: significantPatterns.length },
            { id: 'stats' as const, label: 'Stats', icon: <BarChart3 className="w-3.5 h-3.5" />, count: null },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveView(tab.id)}
              className={`flex-1 text-[8px] font-display font-bold uppercase tracking-wider py-3 rounded-xl transition-all flex items-center justify-center gap-1.5 relative ${
                activeView === tab.id 
                  ? 'glass text-primary shadow-[0_0_12px_hsl(var(--primary)/0.1)] border border-primary/20 bg-primary/5' 
                  : 'text-muted-foreground/40 hover:text-foreground/60'
              }`}
            >
              <span className={activeView === tab.id ? 'text-primary' : 'text-muted-foreground/30'}>{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.count !== null && (
                <span className={`text-[6px] font-mono px-1.5 py-0.5 rounded-lg ${
                  activeView === tab.id ? 'bg-primary/15 text-primary border border-primary/20' : 'bg-secondary/20 text-muted-foreground/30'
                }`}>{tab.count}</span>
              )}
              {activeView === tab.id && (
                <motion.div
                  layoutId="ensemble-tab"
                  className="absolute bottom-0.5 left-3 right-3 h-[2px] rounded-full"
                  style={{ background: 'linear-gradient(90deg, hsl(var(--neon-cyan)), hsl(var(--neon-pink)))' }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Ensemble Summary */}
      <div className={`glass rounded-2xl border overflow-hidden ${tc.bg}`}>
        <div className="relative p-4">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/4 via-transparent to-neon-pink/3" />
          <div className="relative flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/15 to-neon-purple/10 border border-primary/20 flex items-center justify-center text-lg shadow-[0_0_12px_hsl(var(--primary)/0.15)]">
                🤖
              </div>
              <div>
                <div className="text-[10px] font-display font-bold uppercase tracking-[0.12em] text-foreground">Ensemble Multi-Modelo</div>
                <div className="text-[7px] text-muted-foreground/50 font-mono">{totalModels} modelos • Feedback Loop ativo</div>
              </div>
            </div>
            <div className={`px-2.5 py-1 rounded-xl border text-[8px] font-display font-bold uppercase backdrop-blur-sm ${tc.bg} ${tc.color}`}>
              {tc.icon} {temperature}
            </div>
          </div>

          <div className="relative grid grid-cols-4 gap-2">
            {[
              { label: 'Confiança', value: `${ensembleConfidence}%`, color: 'text-primary' },
              { label: 'Consenso', value: `${ensembleConsensus}/${totalModels}`, color: 'text-foreground' },
              { label: 'WR Geral', value: `${overallWR}%`, color: Number(overallWR) >= 40 ? 'text-neon-green' : 'text-[hsl(var(--gold))]' },
              { label: 'Entrada', value: sniperData?.entryForce?.toUpperCase() || '—', color: sniperData?.entryForce === 'forte' ? 'text-neon-green' : sniperData?.entryForce === 'padrao' ? 'text-[hsl(var(--gold))]' : 'text-muted-foreground' },
            ].map((stat, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="text-center p-2.5 rounded-xl glass border border-border/10 hover:border-border/25 transition-all"
              >
                <div className="text-[7px] text-muted-foreground/40 uppercase font-display tracking-wider">{stat.label}</div>
                <div className={`text-[14px] font-black font-mono ${stat.color}`}>{stat.value}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* Models View */}
        {activeView === 'models' && (
          <motion.div key="models" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <div className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-wider font-display">Status dos {totalModels} Modelos</div>
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={triggerRecalibration} 
                className="text-[7px] text-primary font-bold px-2.5 py-1 rounded-lg glass border border-primary/15 hover:bg-primary/5 transition-all flex items-center gap-1"
              >
                <RefreshCw className="w-2.5 h-2.5" /> Recalibrar
              </motion.button>
            </div>
            {Object.entries(MODEL_META).map(([id, meta], idx) => {
              const perf = modelPerf[id];
              const wr = perf ? Math.round(perf.winRate * 100) : 0;
              const weight = perf?.weight ?? 1;
              const streak = perf?.streak ?? 0;
              const total = perf?.total ?? 0;
              const signal = modelSignals.find((s: any) => s.modelId === id);
              const isLeader = modelSignals.length > 0 && modelSignals[0]?.modelId === id;

              return (
                <motion.div
                  key={id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  className={`glass rounded-xl border p-3 transition-all ${
                    isLeader ? 'border-primary/25 ring-1 ring-primary/10 bg-primary/2' : 'border-border/15 hover:border-border/30'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm border ${
                      isLeader ? 'bg-primary/10 border-primary/20' : 'bg-secondary/40 border-border/10'
                    }`}>{meta.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[9px] font-black ${isLeader ? 'text-primary' : 'text-foreground'}`}>{meta.name}</span>
                        {isLeader && (
                          <span className="text-[6px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary font-bold border border-primary/20 flex items-center gap-0.5">
                            <Trophy className="w-2 h-2" /> LÍDER
                          </span>
                        )}
                      </div>
                      <span className="text-[7px] text-muted-foreground/50">{meta.desc}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`text-[11px] font-black font-mono ${
                        wr >= 50 ? 'text-neon-green' : wr >= 35 ? 'text-[hsl(var(--gold))]' : wr > 0 ? 'text-destructive' : 'text-muted-foreground/40'
                      }`}>{total > 0 ? `${wr}%` : 'N/A'}</div>
                      <div className="text-[6px] text-muted-foreground/40 font-mono">{total} pred.</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[7px] text-muted-foreground/40 w-8 shrink-0 font-mono">Peso</span>
                    <div className="flex-1"><Progress value={Math.min(100, weight * 35)} className="h-1.5" /></div>
                    <span className="text-[7px] font-mono text-muted-foreground/50 w-6 text-right">{weight.toFixed(1)}</span>
                    {streak !== 0 && (
                      <span className={`text-[7px] font-bold px-1.5 py-0.5 rounded-md ${
                        streak > 0 ? 'text-neon-green bg-neon-green/10' : 'text-destructive bg-destructive/10'
                      }`}>
                        {streak > 0 ? `+${streak}` : streak}
                      </span>
                    )}
                  </div>

                  {signal && (
                    <div className="mt-2 px-2.5 py-1.5 rounded-lg glass border border-border/10">
                      <div className="flex items-center justify-between">
                        <span className="text-[7px] text-foreground/80 truncate flex-1">{signal.label}</span>
                        <span className="text-[7px] font-mono text-primary ml-2 shrink-0">{signal.confidence}%</span>
                      </div>
                      <p className="text-[6px] text-muted-foreground/40 mt-0.5 line-clamp-2">{signal.reasoning}</p>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* Patterns View */}
        {activeView === 'patterns' && (
          <motion.div key="patterns" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <div className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-wider font-display">Descoberta de Padrões</div>
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={runPatternDiscovery} 
                disabled={isDiscovering} 
                className="text-[7px] text-primary font-bold disabled:opacity-50 px-2.5 py-1 rounded-lg glass border border-primary/15 hover:bg-primary/5 transition-all flex items-center gap-1"
              >
                <FlaskConical className="w-2.5 h-2.5" />
                {isDiscovering ? 'Analisando...' : 'Descobrir'}
              </motion.button>
            </div>

            <div className="text-[7px] text-muted-foreground/40 glass rounded-xl p-2.5 border border-border/10 font-mono">
              Testes: χ² Uniformidade, χ² Cores, Runs Test, Autocorrelação (Ljung-Box), Viés Setorial, Clustering K-Means, Ciclo Dúzias, Viés Horário
            </div>

            {discoveredPatterns.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-2xl opacity-30 mb-2">🔬</div>
                <p className="text-[9px] text-muted-foreground/50">Clique em "Descobrir" para executar testes estatísticos avançados</p>
              </div>
            ) : (
              discoveredPatterns.map((p, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={`glass rounded-xl border p-3 ${
                    p.significant ? 'border-primary/20 bg-primary/2' : 'border-border/15'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[8px] font-black ${p.significant ? 'text-primary' : 'text-muted-foreground/60'}`}>
                      {p.significant ? '✅' : '❌'} {p.test_name.replace(/_/g, ' ').toUpperCase()}
                    </span>
                    <span className={`text-[7px] font-mono font-bold px-1.5 py-0.5 rounded-md ${
                      p.significant ? 'text-neon-green bg-neon-green/10' : 'text-muted-foreground/50 bg-secondary/30'
                    }`}>{p.confidence}%</span>
                  </div>
                  <p className="text-[7px] text-foreground/70 leading-relaxed">{p.description}</p>
                  {p.recommendation && <p className="text-[7px] text-primary mt-1 font-bold">💡 {p.recommendation}</p>}
                </motion.div>
              ))
            )}
          </motion.div>
        )}

        {/* Stats View */}
        {activeView === 'stats' && (
          <motion.div key="stats" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-2">
            <div className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-wider px-1 font-display">Performance do Ensemble</div>

            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Total Predições', value: totalPreds, color: 'text-foreground' },
                { label: 'Total Acertos', value: totalHits, color: 'text-neon-green' },
                { label: 'Win Rate Global', value: `${overallWR}%`, color: Number(overallWR) >= 40 ? 'text-neon-green' : 'text-[hsl(var(--gold))]' },
                { label: 'Melhor Modelo', value: bestModel ? MODEL_META[bestModel[0]]?.name || bestModel[0] : 'N/A', color: 'text-primary', sub: bestModel ? `${(bestModel[1].winRate * 100).toFixed(0)}% WR` : '' },
              ].map((stat, i) => (
                <motion.div 
                  key={i} 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="glass rounded-xl border border-border/15 p-3 hover:border-border/30 transition-all"
                >
                  <div className="text-[7px] text-muted-foreground/40 uppercase font-bold font-display tracking-wider">{stat.label}</div>
                  <div className={`text-[15px] font-black font-mono ${stat.color}`}>{stat.value}</div>
                  {(stat as any).sub && <div className="text-[7px] text-muted-foreground/50 font-mono">{(stat as any).sub}</div>}
                </motion.div>
              ))}
            </div>

            <div className="glass rounded-xl border border-border/15 p-3">
              <div className="text-[8px] font-black text-muted-foreground/50 uppercase mb-2 font-display tracking-wider">Ranking por Win Rate</div>
              {Object.entries(modelPerf)
                .filter(([, p]) => p.total > 0)
                .sort(([, a], [, b]) => b.winRate - a.winRate)
                .map(([id, perf], i) => {
                  const medals = ['🥇', '🥈', '🥉'];
                  return (
                    <div key={id} className="flex items-center gap-2 py-1.5 border-b border-border/10 last:border-0">
                      <span className="text-[10px] w-5 text-center">{medals[i] || `${i + 1}.`}</span>
                      <span className="text-[9px]">{MODEL_META[id]?.icon || '❓'}</span>
                      <span className="text-[8px] font-bold text-foreground/80 flex-1">{MODEL_META[id]?.name || id}</span>
                      <span className={`text-[9px] font-mono font-bold ${
                        perf.winRate * 100 >= 50 ? 'text-neon-green' : perf.winRate * 100 >= 35 ? 'text-[hsl(var(--gold))]' : 'text-destructive'
                      }`}>{(perf.winRate * 100).toFixed(0)}%</span>
                      <span className="text-[7px] text-muted-foreground/40 font-mono">({perf.total})</span>
                    </div>
                  );
                })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Arbiter Log — premium */}
      {arbiterLog.length > 0 && (
        <div className="glass rounded-2xl border border-border/15 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/10 bg-gradient-to-r from-primary/[0.03] to-transparent">
            <div className="w-6 h-6 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Zap className="w-3 h-3 text-primary" />
            </div>
            <span className="text-[9px] font-display font-black text-primary/80 uppercase tracking-[0.15em]">Log do Árbitro</span>
            <span className="text-[6px] text-muted-foreground/30 font-mono ml-auto">{arbiterLog.length} entradas</span>
          </div>
          <div className="p-3 space-y-1 max-h-40 overflow-y-auto scrollbar-thin">
            {arbiterLog.map((line: string, i: number) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.02 }}
                className="text-[7px] text-foreground/60 font-mono leading-relaxed px-3 py-1.5 rounded-lg glass border border-border/5 hover:border-border/15 transition-all"
              >
                <span className="text-primary/40 mr-1.5">▸</span>{line}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Notice */}
      <div className="px-4 py-2.5 rounded-2xl glass border border-gold/10 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-gold/[0.02] to-transparent" />
        <p className="relative text-[7px] text-gold/50 leading-relaxed text-center font-mono">
          ⚠️ Roleta é um jogo de sorte; nenhum sistema garante lucro. Use apenas para entretenimento e estudo.
        </p>
      </div>
    </div>
  );
});

EnsembleDashboard.displayName = 'EnsembleDashboard';
export default EnsembleDashboard;
