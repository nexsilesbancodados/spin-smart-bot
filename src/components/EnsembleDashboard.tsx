import { memo, useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Progress } from '@/components/ui/progress';

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
    quente: { color: 'text-amber-400', bg: 'bg-amber-500/8 border-amber-500/15', icon: '🔥' },
    fria: { color: 'text-blue-400', bg: 'bg-blue-500/8 border-blue-500/15', icon: '❄️' },
    caotica: { color: 'text-red-400', bg: 'bg-red-500/8 border-red-500/15', icon: '🌪️' },
    morna: { color: 'text-muted-foreground', bg: 'bg-secondary/40 border-border/30', icon: '🌡️' },
  };
  const tc = tempConfig[temperature as keyof typeof tempConfig] || tempConfig.morna;

  return (
    <div className="space-y-3">
      {/* Tab Selector */}
      <div className="flex gap-1 glass rounded-2xl p-1.5 border border-border/20">
        {[
          { id: 'models' as const, label: '🤖 Modelos', count: totalModels },
          { id: 'patterns' as const, label: '🔬 Padrões', count: significantPatterns.length },
          { id: 'stats' as const, label: '📊 Stats', count: null },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveView(tab.id)}
            className={`flex-1 text-[8px] font-display font-bold uppercase tracking-wider py-2.5 rounded-xl transition-all ${
              activeView === tab.id ? 'glass text-primary shadow-sm border border-primary/15' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}{tab.count !== null ? ` (${tab.count})` : ''}
          </button>
        ))}
      </div>

      {/* Ensemble Summary */}
      <div className={`glass rounded-xl border p-4 ${tc.bg}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/15 flex items-center justify-center text-lg">🤖</div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-foreground">Ensemble Multi-Modelo v2</div>
              <div className="text-[7px] text-muted-foreground">{totalModels} modelos competindo • Feedback Loop ativo</div>
            </div>
          </div>
          <div className={`px-2.5 py-1 rounded-full border text-[8px] font-black uppercase ${tc.bg} ${tc.color}`}>
            {tc.icon} {temperature}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Confiança', value: `${ensembleConfidence}%`, color: 'text-primary' },
            { label: 'Consenso', value: `${ensembleConsensus}/${totalModels}`, color: 'text-foreground' },
            { label: 'WR Geral', value: `${overallWR}%`, color: Number(overallWR) >= 40 ? 'text-green-400' : 'text-amber-400' },
            { label: 'Entrada', value: sniperData?.entryForce?.toUpperCase() || '—', color: sniperData?.entryForce === 'forte' ? 'text-green-400' : sniperData?.entryForce === 'padrao' ? 'text-amber-400' : 'text-muted-foreground' },
          ].map((stat, i) => (
            <div key={i} className="text-center p-2 rounded-lg bg-background/30">
              <div className="text-[7px] text-muted-foreground uppercase font-bold">{stat.label}</div>
              <div className={`text-[13px] font-black font-mono ${stat.color}`}>{stat.value}</div>
            </div>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* Models View */}
        {activeView === 'models' && (
          <motion.div key="models" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <div className="text-[9px] font-black text-muted-foreground uppercase tracking-wider">Status dos {totalModels} Modelos</div>
              <button onClick={triggerRecalibration} className="text-[7px] text-primary font-bold hover:underline px-2 py-1 rounded-md hover:bg-primary/8 transition-all">⚡ Recalibrar</button>
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
                    isLeader ? 'border-primary/25 ring-1 ring-primary/15' : 'border-border/30'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-lg bg-secondary/60 flex items-center justify-center text-sm">{meta.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[9px] font-black ${isLeader ? 'text-primary' : 'text-foreground'}`}>{meta.name}</span>
                        {isLeader && <span className="text-[6px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-bold">LÍDER</span>}
                      </div>
                      <span className="text-[7px] text-muted-foreground/70">{meta.desc}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`text-[10px] font-black font-mono ${
                        wr >= 50 ? 'text-green-400' : wr >= 35 ? 'text-amber-400' : wr > 0 ? 'text-red-400' : 'text-muted-foreground'
                      }`}>{total > 0 ? `${wr}%` : 'N/A'}</div>
                      <div className="text-[6px] text-muted-foreground">{total} pred.</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[7px] text-muted-foreground w-8 shrink-0">Peso</span>
                    <div className="flex-1"><Progress value={Math.min(100, weight * 35)} className="h-1.5" /></div>
                    <span className="text-[7px] font-mono text-muted-foreground w-6 text-right">{weight.toFixed(1)}</span>
                    {streak !== 0 && (
                      <span className={`text-[7px] font-bold ${streak > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {streak > 0 ? `+${streak}` : streak}
                      </span>
                    )}
                  </div>

                  {signal && (
                    <div className="mt-2 px-2.5 py-1.5 rounded-lg bg-secondary/30 border border-border/20">
                      <div className="flex items-center justify-between">
                        <span className="text-[7px] text-foreground/80 truncate flex-1">{signal.label}</span>
                        <span className="text-[7px] font-mono text-primary ml-2 shrink-0">{signal.confidence}%</span>
                      </div>
                      <p className="text-[6px] text-muted-foreground mt-0.5 line-clamp-2">{signal.reasoning}</p>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* Patterns View */}
        {activeView === 'patterns' && (
          <motion.div key="patterns" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <div className="text-[9px] font-black text-muted-foreground uppercase tracking-wider">Descoberta de Padrões</div>
              <button onClick={runPatternDiscovery} disabled={isDiscovering} className="text-[7px] text-primary font-bold hover:underline disabled:opacity-50 px-2 py-1 rounded-md hover:bg-primary/8 transition-all">
                {isDiscovering ? '⏳ Analisando...' : '🔬 Descobrir'}
              </button>
            </div>

            <div className="text-[7px] text-muted-foreground glass rounded-lg p-2.5">
              Testes: χ² Uniformidade, χ² Cores, Runs Test, Autocorrelação (Ljung-Box), Viés Setorial, Clustering K-Means, Ciclo Dúzias, Viés Horário
            </div>

            {discoveredPatterns.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-2xl opacity-30 mb-2">🔬</div>
                <p className="text-[9px] text-muted-foreground">Clique em "Descobrir" para executar testes estatísticos avançados</p>
              </div>
            ) : (
              discoveredPatterns.map((p, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={`glass rounded-xl border p-3 ${
                    p.significant ? 'border-primary/20' : 'border-border/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[8px] font-black ${p.significant ? 'text-primary' : 'text-muted-foreground'}`}>
                      {p.significant ? '✅' : '❌'} {p.test_name.replace(/_/g, ' ').toUpperCase()}
                    </span>
                    <span className={`text-[7px] font-mono ${p.significant ? 'text-green-400' : 'text-muted-foreground'}`}>{p.confidence}%</span>
                  </div>
                  <p className="text-[7px] text-foreground/80 leading-relaxed">{p.description}</p>
                  {p.recommendation && <p className="text-[7px] text-primary mt-1 font-bold">💡 {p.recommendation}</p>}
                </motion.div>
              ))
            )}
          </motion.div>
        )}

        {/* Stats View */}
        {activeView === 'stats' && (
          <motion.div key="stats" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
            <div className="text-[9px] font-black text-muted-foreground uppercase tracking-wider px-1">Performance do Ensemble</div>

            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Total Predições', value: totalPreds, color: 'text-foreground' },
                { label: 'Total Acertos', value: totalHits, color: 'text-green-400' },
                { label: 'Win Rate Global', value: `${overallWR}%`, color: Number(overallWR) >= 40 ? 'text-green-400' : 'text-amber-400' },
                { label: 'Melhor Modelo', value: bestModel ? MODEL_META[bestModel[0]]?.name || bestModel[0] : 'N/A', color: 'text-primary', sub: bestModel ? `${(bestModel[1].winRate * 100).toFixed(0)}% WR` : '' },
              ].map((stat, i) => (
                <div key={i} className="glass rounded-xl border border-border/20 p-3">
                  <div className="text-[7px] text-muted-foreground uppercase font-bold">{stat.label}</div>
                  <div className={`text-[15px] font-black font-mono ${stat.color}`}>{stat.value}</div>
                  {(stat as any).sub && <div className="text-[7px] text-muted-foreground">{(stat as any).sub}</div>}
                </div>
              ))}
            </div>

            <div className="glass rounded-xl border border-border/20 p-3">
              <div className="text-[8px] font-black text-muted-foreground uppercase mb-2">Ranking por Win Rate</div>
              {Object.entries(modelPerf)
                .filter(([, p]) => p.total > 0)
                .sort(([, a], [, b]) => b.winRate - a.winRate)
                .map(([id, perf], i) => (
                  <div key={id} className="flex items-center gap-2 py-1.5 border-b border-border/10 last:border-0">
                    <span className="text-[8px] font-black text-muted-foreground w-5">#{i + 1}</span>
                    <span className="text-[9px]">{MODEL_META[id]?.icon || '❓'}</span>
                    <span className="text-[8px] font-bold text-foreground flex-1">{MODEL_META[id]?.name || id}</span>
                    <span className={`text-[8px] font-mono font-bold ${
                      perf.winRate * 100 >= 50 ? 'text-green-400' : perf.winRate * 100 >= 35 ? 'text-amber-400' : 'text-red-400'
                    }`}>{(perf.winRate * 100).toFixed(0)}%</span>
                    <span className="text-[7px] text-muted-foreground/60">({perf.total})</span>
                  </div>
                ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Arbiter Log */}
      {arbiterLog.length > 0 && (
        <div className="glass rounded-xl border border-border/20 p-3">
          <div className="text-[9px] font-black text-muted-foreground uppercase tracking-wider mb-2">Log do Árbitro</div>
          <div className="space-y-1 max-h-40 overflow-y-auto scrollbar-thin">
            {arbiterLog.map((line: string, i: number) => (
              <div key={i} className="text-[7px] text-foreground/70 font-mono leading-relaxed px-2.5 py-1 rounded-md bg-secondary/20">{line}</div>
            ))}
          </div>
        </div>
      )}

      {/* Notice */}
      <div className="px-3 py-2 rounded-xl bg-amber-500/5 border border-amber-500/10">
        <p className="text-[7px] text-amber-400/70 leading-relaxed text-center">
          ⚠️ Roleta é um jogo de sorte; nenhum sistema garante lucro. Use apenas para entretenimento e estudo.
        </p>
      </div>
    </div>
  );
});

EnsembleDashboard.displayName = 'EnsembleDashboard';
export default EnsembleDashboard;
