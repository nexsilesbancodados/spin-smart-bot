import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Target, TrendingUp, BarChart3, Flame, Trophy, ArrowRight, ChevronDown, ChevronUp, Sparkles, Award, Zap } from 'lucide-react';

interface PredictionRecord {
  id: string;
  created_at: string;
  strategy_type: string;
  strategy_label: string;
  predicted_numbers: number[];
  predicted_main: number | null;
  probability: number;
  convergence_score: number;
  mesa_mode: string | null;
  actual_number: number | null;
  hit: boolean | null;
  hit_type: string | null;
  resolved_at: string | null;
  justification: string | null;
}

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const colorClass = (n: number) => {
  if (n === 0) return 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white';
  return RED_NUMBERS.includes(n)
    ? 'bg-gradient-to-br from-red-500 to-red-700 text-white'
    : 'bg-gradient-to-br from-zinc-600 to-zinc-900 text-white';
};

const STRATEGY_EMOJI: Record<string, string> = {
  sniper: '🎯', cavalos: '🐴', duzias: '📊', voisins: '🎰', setor_oposto: '🔄', quebra: '⚡',
  genetic_cluster: '🧬', cross_delay: '💥', insight_pattern: '🧬', cylinder_bias: '🔩',
  column_cycle: '📐', dozen_phase: '🎲', terminal_alternation: '🔢', numero_exato: '💎',
  ritmo_calibrado: '🎯', archetype_fusion: '🏛️', matrix_fusion: '🔮', cobertura_area: '🗺️',
  terminais_cruzados: '🐎', pressao_retorno: '🔥', cor: '🎨', paridade: '🔵', alto_baixo: '⬆️',
  coluna: '📐', duzia_unica: '🎲',
};

const STRATEGY_FRIENDLY: Record<string, string> = {
  sniper: 'Tiro Certeiro', cavalos: 'Cavalos', duzias: 'Dúzias', voisins: 'Vizinhos da Roleta',
  setor_oposto: 'Setor Oposto', quebra: 'Quebra de Padrão', genetic_cluster: 'Cluster Genético',
  cross_delay: 'Cruzamento de Atraso', insight_pattern: 'Padrão IA', cylinder_bias: 'Tendência Cilindro',
  column_cycle: 'Ciclo de Colunas', dozen_phase: 'Fase de Dúzias', terminal_alternation: 'Alternância Terminal',
  numero_exato: 'Número Exato', ritmo_calibrado: 'Ritmo Calibrado', archetype_fusion: 'Fusão Arquétipo',
  matrix_fusion: 'Fusão de Matrizes', cobertura_area: 'Cobertura de Área',
  terminais_cruzados: 'Terminais Cruzados', pressao_retorno: 'Pressão de Retorno',
  cor: 'Cor', paridade: 'Par/Ímpar', alto_baixo: 'Alto/Baixo', coluna: 'Coluna', duzia_unica: 'Dúzia Única',
};

type TabType = 'resumo' | 'todos' | 'acertos' | 'erros' | 'estrategias';

const PredictionHistory = () => {
  const [predictions, setPredictions] = useState<PredictionRecord[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('resumo');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadPredictions = useCallback(async () => {
    const { data } = await supabase
      .from('prediction_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (data) setPredictions(data as PredictionRecord[]);
  }, []);

  useEffect(() => {
    loadPredictions();
    const ch = supabase
      .channel('prediction_history_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prediction_history' }, () => loadPredictions())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadPredictions]);

  const resolved = predictions.filter(p => p.hit !== null);
  const hits = resolved.filter(p => p.hit === true);
  const misses = resolved.filter(p => p.hit === false);
  const exactHits = resolved.filter(p => p.hit_type === 'exact');
  const winRate = resolved.length > 0 ? ((hits.length / resolved.length) * 100).toFixed(1) : '0.0';

  const strategyStats: Record<string, { hits: number; total: number }> = {};
  resolved.forEach(p => {
    if (!strategyStats[p.strategy_type]) strategyStats[p.strategy_type] = { hits: 0, total: 0 };
    strategyStats[p.strategy_type].total++;
    if (p.hit) strategyStats[p.strategy_type].hits++;
  });

  let currentStreak = 0;
  let streakType: 'hit' | 'miss' | null = null;
  for (const p of resolved) {
    if (streakType === null) {
      streakType = p.hit ? 'hit' : 'miss';
      currentStreak = 1;
    } else if ((p.hit && streakType === 'hit') || (!p.hit && streakType === 'miss')) {
      currentStreak++;
    } else break;
  }

  const bestStrategy = Object.entries(strategyStats)
    .filter(([, s]) => s.total >= 3)
    .sort(([, a], [, b]) => (b.hits / b.total) - (a.hits / a.total))[0];

  const filteredPredictions = activeTab === 'acertos' ? hits
    : activeTab === 'erros' ? misses
    : activeTab === 'todos' ? resolved
    : activeTab === 'estrategias' ? [] as PredictionRecord[]
    : resolved.slice(0, 15);

  const tabs: { key: TabType; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: 'resumo', label: 'Resumo', icon: <BarChart3 className="w-3 h-3" /> },
    { key: 'todos', label: 'Todos', icon: <Target className="w-3 h-3" />, count: resolved.length },
    { key: 'acertos', label: 'Acertos', icon: <CheckCircle2 className="w-3 h-3" />, count: hits.length },
    { key: 'erros', label: 'Erros', icon: <XCircle className="w-3 h-3" />, count: misses.length },
    { key: 'estrategias', label: 'Estratégias', icon: <Award className="w-3 h-3" />, count: Object.keys(strategyStats).length },
  ];

  const winRateNum = parseFloat(winRate);

  return (
    <div className="glass rounded-2xl overflow-hidden border border-border/20">
      {/* Header */}
      <div className="relative p-4 border-b border-border/10">
        <div className="absolute inset-0 bg-gradient-to-r from-neon-cyan/5 via-transparent to-neon-pink/5" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-cyan/30 to-transparent" />
        <div className="relative flex items-center gap-2.5 mb-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neon-cyan/20 to-neon-pink/10 border border-neon-cyan/25 flex items-center justify-center shadow-[0_0_15px_hsl(var(--neon-cyan)/0.2)]">
            <BarChart3 className="w-5 h-5 text-neon-cyan" />
          </div>
          <div className="flex-1">
            <h3 className="font-display text-xs font-bold tracking-[0.15em] text-neon-cyan">HISTÓRICO DE PREVISÕES</h3>
            <p className="text-[8px] text-muted-foreground/50 font-mono mt-0.5">Resultado de todas as previsões da IA</p>
          </div>
          {currentStreak >= 3 && streakType === 'hit' && (
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="flex items-center gap-1.5 bg-neon-green/10 border border-neon-green/25 rounded-xl px-3 py-1.5 shadow-[0_0_12px_hsl(var(--neon-green)/0.15)]"
            >
              <Flame className="w-3.5 h-3.5 text-neon-green" />
              <span className="text-[9px] font-bold text-neon-green font-display tracking-wider">{currentStreak}× SEGUIDOS</span>
            </motion.div>
          )}
        </div>

        {/* Hero Stats */}
        <div className="relative grid grid-cols-4 gap-2">
          <StatCard value={resolved.length.toString()} label="Previsões" variant="default" icon={<Target className="w-3.5 h-3.5" />} />
          <StatCard value={`${winRate}%`} label="Win Rate" variant={winRateNum >= 50 ? 'success' : winRateNum >= 35 ? 'warning' : 'danger'} icon={<TrendingUp className="w-3.5 h-3.5" />} />
          <StatCard value={hits.length.toString()} label="Acertos" variant="success" icon={<CheckCircle2 className="w-3.5 h-3.5" />} />
          <StatCard value={exactHits.length.toString()} label="Exatos" variant="primary" icon={<Trophy className="w-3.5 h-3.5" />} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border/10 bg-background/10">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-3 text-[9px] font-bold tracking-wider transition-all relative flex items-center justify-center gap-1.5 ${
              activeTab === tab.key ? 'text-neon-cyan' : 'text-muted-foreground/50 hover:text-foreground/70'
            }`}
          >
            <span className={activeTab === tab.key ? 'text-neon-cyan' : 'text-muted-foreground/30'}>{tab.icon}</span>
            <span className="hidden sm:inline">{tab.label}</span>
            {tab.count !== undefined && (
              <span className={`text-[7px] px-1.5 py-0.5 rounded-full font-mono ${
                activeTab === tab.key ? 'bg-neon-cyan/15 text-neon-cyan' : 'bg-secondary/30 text-muted-foreground/40'
              }`}>
                {tab.count}
              </span>
            )}
            {activeTab === tab.key && (
              <motion.div
                layoutId="hist-tab-indicator"
                className="absolute bottom-0 left-3 right-3 h-[2px] bg-gradient-to-r from-neon-cyan to-neon-pink rounded-full shadow-[0_0_8px_hsl(var(--neon-cyan)/0.4)]"
              />
            )}
          </button>
        ))}
      </div>

      <div className="p-3">
        {/* Best Strategy Badge */}
        {activeTab === 'resumo' && bestStrategy && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 glass rounded-xl p-3 mb-3 border border-gold/20 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-gold/5 via-transparent to-gold/3" />
            <div className="relative w-10 h-10 rounded-xl bg-gold/10 border border-gold/25 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-gold" />
            </div>
            <div className="relative flex-1 min-w-0">
              <span className="text-[7px] text-gold/60 font-display tracking-[0.2em] block uppercase">MELHOR ESTRATÉGIA</span>
              <span className="text-[11px] font-bold text-foreground">
                {STRATEGY_EMOJI[bestStrategy[0]] || '📌'} {STRATEGY_FRIENDLY[bestStrategy[0]] || bestStrategy[0]}
              </span>
            </div>
            <div className="relative text-right">
              <span className="text-lg font-black font-mono text-gold">
                {((bestStrategy[1].hits / bestStrategy[1].total) * 100).toFixed(0)}%
              </span>
              <span className="text-[8px] text-muted-foreground/50 block font-mono">
                {bestStrategy[1].hits}/{bestStrategy[1].total}
              </span>
            </div>
          </motion.div>
        )}

        {/* Strategy Performance */}
        {activeTab === 'resumo' && Object.keys(strategyStats).length > 0 && (
          <div className="mb-3 space-y-1.5">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-3 h-3 text-neon-purple/60" />
              <span className="text-[8px] text-muted-foreground/60 font-display tracking-[0.15em] uppercase">Performance por Estratégia</span>
            </div>
            {Object.entries(strategyStats)
              .sort(([, a], [, b]) => (b.hits / b.total) - (a.hits / a.total))
              .map(([type, { hits: h, total: t }], idx) => {
                const rate = (h / t) * 100;
                return (
                  <motion.div
                    key={type}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="flex items-center gap-2 group py-1 px-2 rounded-lg hover:bg-background/20 transition-all"
                  >
                    <span className="text-[10px] w-5 text-center">{STRATEGY_EMOJI[type] || '📌'}</span>
                    <span className="text-[9px] text-foreground/80 font-medium w-28 truncate">{STRATEGY_FRIENDLY[type] || type}</span>
                    <div className="flex-1 h-2.5 bg-background/30 rounded-full overflow-hidden border border-border/10">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${rate}%` }}
                        transition={{ duration: 0.6, delay: idx * 0.05 }}
                        className={`h-full rounded-full ${
                          rate >= 60 ? 'bg-gradient-to-r from-neon-green to-emerald-400'
                            : rate >= 40 ? 'bg-gradient-to-r from-gold to-amber-400'
                            : 'bg-gradient-to-r from-destructive to-red-400'
                        }`}
                      />
                    </div>
                    <span className={`text-[10px] font-bold font-mono w-12 text-right ${
                      rate >= 60 ? 'text-neon-green' : rate >= 40 ? 'text-gold' : 'text-destructive'
                    }`}>
                      {rate.toFixed(0)}%
                    </span>
                    <span className="text-[8px] text-muted-foreground/40 font-mono w-10 text-right">{h}/{t}</span>
                  </motion.div>
                );
              })}
          </div>
        )}

        {/* Streak indicator */}
        {currentStreak >= 2 && streakType && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl mb-2.5 backdrop-blur-sm ${
              streakType === 'hit'
                ? 'bg-neon-green/6 border border-neon-green/20'
                : 'bg-destructive/6 border border-destructive/20'
            }`}
          >
            {streakType === 'hit' ? <Flame className="w-3.5 h-3.5 text-neon-green" /> : <XCircle className="w-3.5 h-3.5 text-destructive" />}
            <span className={`text-[10px] font-bold ${streakType === 'hit' ? 'text-neon-green' : 'text-destructive'}`}>
              {streakType === 'hit' ? `${currentStreak}× acertos seguidos — IA em boa fase!` : `${currentStreak}× erros seguidos — IA recalibrando...`}
            </span>
          </motion.div>
        )}

        {/* Estratégias Tab */}
        {activeTab === 'estrategias' && (
          <div className="space-y-1.5 mt-2">
            {Object.entries(strategyStats)
              .sort(([,a],[,b]) => (b.hits/b.total) - (a.hits/a.total))
              .map(([type, s], i) => {
                const wr = s.total > 0 ? (s.hits/s.total*100) : 0;
                const isHot = wr >= 45;
                const medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':`${i+1}.`;
                return (
                  <motion.div
                    key={type}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-[9px] backdrop-blur-sm transition-all hover:scale-[1.01] ${
                      isHot ? 'bg-neon-green/5 border-neon-green/15' : 'bg-background/15 border-border/15'
                    }`}
                  >
                    <span className="text-sm">{medal}</span>
                    <span className="flex-1 truncate font-medium text-foreground/80">{STRATEGY_FRIENDLY[type] || type.replace(/_/g,' ')}</span>
                    <span className={`font-mono font-bold text-[10px] ${isHot ? 'text-neon-green' : 'text-muted-foreground'}`}>{wr.toFixed(0)}%</span>
                    <span className="text-muted-foreground/50 font-mono">{s.hits}/{s.total}</span>
                  </motion.div>
                );
              })}
          </div>
        )}

        {/* Prediction List */}
        {activeTab !== 'estrategias' && filteredPredictions.length === 0 ? (
          <div className="text-center py-10">
            <div className="w-14 h-14 rounded-2xl glass border border-border/15 flex items-center justify-center mx-auto mb-3">
              <Target className="w-7 h-7 text-muted-foreground/15" />
            </div>
            <p className="text-xs text-muted-foreground/50">Nenhuma previsão registrada.</p>
            <p className="text-[9px] text-muted-foreground/30 mt-1">Aguarde a IA gerar sinais...</p>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1 scrollbar-thin">
            <AnimatePresence initial={false}>
              {filteredPredictions.map((p, idx) => {
                const isExpanded = expandedId === p.id;
                return (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ delay: idx * 0.015 }}
                    className={`rounded-xl border transition-all cursor-pointer backdrop-blur-sm ${
                      p.hit === true
                        ? 'bg-neon-green/3 border-neon-green/15 hover:border-neon-green/30'
                        : 'bg-destructive/3 border-destructive/10 hover:border-destructive/20'
                    }`}
                    onClick={() => setExpandedId(isExpanded ? null : p.id)}
                  >
                    <div className="flex items-center gap-2.5 p-2.5">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        p.hit_type === 'exact'
                          ? 'bg-neon-cyan/15 border border-neon-cyan/30 shadow-[0_0_10px_hsl(var(--neon-cyan)/0.2)]'
                          : p.hit
                          ? 'bg-neon-green/10 border border-neon-green/25'
                          : 'bg-destructive/8 border border-destructive/15'
                      }`}>
                        {p.hit_type === 'exact' ? (
                          <Trophy className="w-4 h-4 text-neon-cyan" />
                        ) : p.hit ? (
                          <CheckCircle2 className="w-4 h-4 text-neon-green" />
                        ) : (
                          <XCircle className="w-4 h-4 text-destructive/60" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-bold text-foreground/90">
                            {STRATEGY_EMOJI[p.strategy_type] || ''} {STRATEGY_FRIENDLY[p.strategy_type] || p.strategy_label}
                          </span>
                          <span className={`text-[7px] px-2 py-0.5 rounded-full font-bold ${
                            p.hit_type === 'exact' ? 'bg-neon-cyan/15 text-neon-cyan'
                              : p.hit ? 'bg-neon-green/15 text-neon-green'
                              : 'bg-destructive/10 text-destructive/70'
                          }`}>
                            {p.hit_type === 'exact' ? '💎 EXATO' : p.hit ? '✅ ACERTOU' : '✗ ERROU'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[7px] text-muted-foreground/40">Previu:</span>
                          {p.predicted_main !== null && (
                            <div className={`w-5.5 h-5.5 rounded-full flex items-center justify-center text-[8px] font-bold shadow-sm ${colorClass(p.predicted_main)} border border-white/15`}>
                              {p.predicted_main}
                            </div>
                          )}
                          {p.actual_number !== null && (
                            <>
                              <ArrowRight className="w-2.5 h-2.5 text-muted-foreground/30" />
                              <span className="text-[7px] text-muted-foreground/40">Saiu:</span>
                              <div className={`w-5.5 h-5.5 rounded-full flex items-center justify-center text-[8px] font-bold shadow-sm ${colorClass(p.actual_number)} border border-white/15`}>
                                {p.actual_number}
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-[7px] text-muted-foreground/40 font-mono">
                          {new Date(p.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className={`text-[9px] font-mono font-bold ${
                          p.probability >= 70 ? 'text-neon-green' : p.probability >= 50 ? 'text-gold' : 'text-muted-foreground/50'
                        }`}>
                          {p.probability}%
                        </span>
                        {isExpanded ? <ChevronUp className="w-3 h-3 text-muted-foreground/30" /> : <ChevronDown className="w-3 h-3 text-muted-foreground/30" />}
                      </div>
                    </div>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-3 pb-3 pt-1 border-t border-border/10 space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-[8px] text-muted-foreground/50 w-16">Confiança:</span>
                              <div className="flex-1 h-2 bg-background/30 rounded-full overflow-hidden border border-border/10">
                                <div className={`h-full rounded-full ${
                                  p.probability >= 70 ? 'bg-gradient-to-r from-neon-green to-emerald-400' : p.probability >= 50 ? 'bg-gradient-to-r from-gold to-amber-400' : 'bg-gradient-to-r from-destructive to-red-400'
                                }`} style={{ width: `${p.probability}%` }} />
                              </div>
                              <span className="text-[8px] font-mono text-muted-foreground/50">{p.probability}%</span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-[8px] text-muted-foreground/50 w-16">Convergência:</span>
                              <div className="flex-1 h-2 bg-background/30 rounded-full overflow-hidden border border-border/10">
                                <div className="h-full rounded-full bg-gradient-to-r from-neon-cyan to-primary" style={{ width: `${Math.min(100, (p.convergence_score / 1700) * 100)}%` }} />
                              </div>
                              <span className="text-[8px] font-mono text-muted-foreground/50">{p.convergence_score}/1700</span>
                            </div>

                            {p.predicted_numbers.length > 1 && (
                              <div>
                                <span className="text-[8px] text-muted-foreground/50 block mb-1">Números cobertos:</span>
                                <div className="flex flex-wrap gap-1">
                                  {p.predicted_numbers.map((n, i) => (
                                    <div key={i} className={`w-5.5 h-5.5 rounded-full flex items-center justify-center text-[7px] font-bold ${
                                      n === p.actual_number ? 'ring-2 ring-neon-cyan ring-offset-1 ring-offset-background ' + colorClass(n) : colorClass(n)
                                    } border border-white/10`}>
                                      {n}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {p.justification && (
                              <div className="bg-background/20 rounded-xl p-2.5 border border-border/10">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <Zap className="w-3 h-3 text-neon-cyan/60" />
                                  <span className="text-[7px] text-neon-cyan/60 font-display tracking-wider">JUSTIFICATIVA IA</span>
                                </div>
                                <span className="text-[9px] text-foreground/70 leading-relaxed">{p.justification}</span>
                              </div>
                            )}

                            {p.mesa_mode && (
                              <span className="text-[8px] text-muted-foreground/40 font-mono">Modo mesa: {p.mesa_mode}</span>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};

const StatCard = ({ value, label, variant, icon }: {
  value: string;
  label: string;
  variant: 'default' | 'success' | 'danger' | 'warning' | 'primary';
  icon?: React.ReactNode;
}) => {
  const styles = {
    default: 'bg-background/15 border-border/15 text-foreground',
    success: 'bg-neon-green/6 border-neon-green/20 text-neon-green',
    danger: 'bg-destructive/6 border-destructive/20 text-destructive',
    warning: 'bg-gold/6 border-gold/20 text-gold',
    primary: 'bg-neon-cyan/6 border-neon-cyan/20 text-neon-cyan',
  };

  const glows: Record<string, string> = {
    success: 'shadow-[0_0_12px_hsl(var(--neon-green)/0.1)]',
    primary: 'shadow-[0_0_12px_hsl(var(--neon-cyan)/0.1)]',
    warning: 'shadow-[0_0_12px_hsl(var(--gold)/0.1)]',
    danger: '',
    default: '',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl p-3 text-center border backdrop-blur-sm transition-all hover:scale-[1.03] group relative overflow-hidden ${styles[variant]} ${glows[variant] || ''}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-transparent to-primary/[0.02] opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="relative">
        <div className="flex items-center justify-center gap-1.5 opacity-50 mb-0.5">
          {icon}
        </div>
        <span className="text-xl font-black font-mono leading-none">{value}</span>
        <span className="text-[6px] text-muted-foreground/40 block mt-1 font-display tracking-[0.2em] uppercase">{label}</span>
      </div>
    </motion.div>
  );
};

export default PredictionHistory;
