import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Target, TrendingUp, BarChart3, Flame, Trophy, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';

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
    : 'bg-gradient-to-br from-gray-600 to-gray-900 text-white';
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

  // Strategy breakdown
  const strategyStats: Record<string, { hits: number; total: number }> = {};
  resolved.forEach(p => {
    if (!strategyStats[p.strategy_type]) strategyStats[p.strategy_type] = { hits: 0, total: 0 };
    strategyStats[p.strategy_type].total++;
    if (p.hit) strategyStats[p.strategy_type].hits++;
  });

  // Recent streak
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

  // Best strategy
  const bestStrategy = Object.entries(strategyStats)
    .filter(([, s]) => s.total >= 3)
    .sort(([, a], [, b]) => (b.hits / b.total) - (a.hits / a.total))[0];

  const filteredPredictions = activeTab === 'acertos' ? hits
    : activeTab === 'erros' ? misses
    : activeTab === 'todos' ? resolved
    : activeTab === 'estrategias' ? [] as PredictionRecord[]
    : resolved.slice(0, 15);

  const tabs: { key: TabType; label: string; count?: number }[] = [
    { key: 'resumo', label: 'Resumo' },
    { key: 'todos', label: 'Todos', count: resolved.length },
    { key: 'acertos', label: 'Acertos', count: hits.length },
    { key: 'erros', label: 'Erros', count: misses.length },
    { key: 'estrategias', label: 'Estratégias', count: Object.keys(strategyStats).length },
  ];

  const winRateNum = parseFloat(winRate);
  const winRateColor = winRateNum >= 60 ? 'text-emerald-400' : winRateNum >= 40 ? 'text-amber-400' : 'text-destructive';

  return (
    <div className="bg-card/95 rounded-xl border border-primary/20 shadow-lg shadow-primary/5 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 border-b border-primary/15">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="font-display text-sm font-bold tracking-wider text-primary">HISTÓRICO</h3>
            <p className="text-[8px] text-muted-foreground">Resultado de todas as previsões da IA</p>
          </div>
          {currentStreak >= 3 && streakType === 'hit' && (
            <div className="ml-auto flex items-center gap-1 bg-emerald-500/15 border border-emerald-500/30 rounded-full px-2.5 py-1">
              <Flame className="w-3 h-3 text-emerald-400" />
              <span className="text-[9px] font-bold text-emerald-400">{currentStreak}x SEGUIDOS</span>
            </div>
          )}
        </div>

        {/* Hero Stats */}
        <div className="grid grid-cols-4 gap-2">
          <StatCard
            value={resolved.length.toString()}
            label="Previsões"
            variant="default"
          />
          <StatCard
            value={`${winRate}%`}
            label="Win Rate"
            variant={winRateNum >= 50 ? 'success' : winRateNum >= 35 ? 'warning' : 'danger'}
            icon={<TrendingUp className="w-3 h-3" />}
          />
          <StatCard
            value={hits.length.toString()}
            label="Acertos"
            variant="success"
            icon={<CheckCircle2 className="w-3 h-3" />}
          />
          <StatCard
            value={exactHits.length.toString()}
            label="Exatos"
            variant="primary"
            icon={<Trophy className="w-3 h-3" />}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border/60">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2 text-[9px] font-bold tracking-wider transition-all relative ${
              activeTab === tab.key
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className={`ml-1 text-[7px] px-1 py-px rounded-full ${
                activeTab === tab.key ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'
              }`}>
                {tab.count}
              </span>
            )}
            {activeTab === tab.key && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full"
              />
            )}
          </button>
        ))}
      </div>

      <div className="p-3">
        {/* Best Strategy Badge */}
        {activeTab === 'resumo' && bestStrategy && (
          <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg p-2 mb-3">
            <Trophy className="w-4 h-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-[8px] text-muted-foreground block">MELHOR ESTRATÉGIA</span>
              <span className="text-[10px] font-bold text-foreground">
                {STRATEGY_EMOJI[bestStrategy[0]] || '📌'} {STRATEGY_FRIENDLY[bestStrategy[0]] || bestStrategy[0]}
              </span>
            </div>
            <div className="text-right">
              <span className="text-sm font-bold font-mono text-primary">
                {((bestStrategy[1].hits / bestStrategy[1].total) * 100).toFixed(0)}%
              </span>
              <span className="text-[7px] text-muted-foreground block">
                {bestStrategy[1].hits}/{bestStrategy[1].total}
              </span>
            </div>
          </div>
        )}

        {/* Strategy Performance (resumo tab) */}
        {activeTab === 'resumo' && Object.keys(strategyStats).length > 0 && (
          <div className="mb-3 space-y-1">
            <span className="text-[8px] text-muted-foreground font-bold tracking-wider block mb-1.5">PERFORMANCE POR ESTRATÉGIA</span>
            {Object.entries(strategyStats)
              .sort(([, a], [, b]) => (b.hits / b.total) - (a.hits / a.total))
              .map(([type, { hits: h, total: t }]) => {
                const rate = (h / t) * 100;
                return (
                  <div key={type} className="flex items-center gap-2 group">
                    <span className="text-[9px] w-4 text-center">{STRATEGY_EMOJI[type] || '📌'}</span>
                    <span className="text-[9px] text-foreground font-medium w-28 truncate">
                      {STRATEGY_FRIENDLY[type] || type}
                    </span>
                    <div className="flex-1 h-2 bg-secondary/60 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${rate}%` }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className={`h-full rounded-full ${
                          rate >= 60 ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                            : rate >= 40 ? 'bg-gradient-to-r from-amber-500 to-amber-400'
                            : 'bg-gradient-to-r from-red-500 to-red-400'
                        }`}
                      />
                    </div>
                    <span className={`text-[9px] font-bold font-mono w-12 text-right ${
                      rate >= 60 ? 'text-emerald-400' : rate >= 40 ? 'text-amber-400' : 'text-destructive'
                    }`}>
                      {rate.toFixed(0)}%
                    </span>
                    <span className="text-[7px] text-muted-foreground/60 font-mono w-8 text-right">
                      {h}/{t}
                    </span>
                  </div>
                );
              })}
          </div>
        )}

        {/* Streak indicator */}
        {currentStreak >= 2 && streakType && (
          <div className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg mb-2 ${
            streakType === 'hit'
              ? 'bg-emerald-500/10 border border-emerald-500/25'
              : 'bg-destructive/10 border border-destructive/25'
          }`}>
            {streakType === 'hit' ? (
              <Flame className="w-3 h-3 text-emerald-400" />
            ) : (
              <XCircle className="w-3 h-3 text-destructive" />
            )}
            <span className={`text-[9px] font-bold ${
              streakType === 'hit' ? 'text-emerald-400' : 'text-destructive'
            }`}>
              {streakType === 'hit'
                ? `${currentStreak}x acertos seguidos — IA em boa fase!`
                : `${currentStreak}x erros seguidos — IA recalibrando...`
              }
            </span>
          </div>
        )}

        {/* Prediction List */}
        {filteredPredictions.length === 0 ? (
          <div className="text-center py-8">
            <Target className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-xs text-muted-foreground">Nenhuma previsão registrada.</p>
            <p className="text-[9px] text-muted-foreground/60 mt-1">Aguarde a IA gerar sinais...</p>
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
                    className={`rounded-lg border transition-all cursor-pointer ${
                      p.hit === true
                        ? 'bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40'
                        : 'bg-destructive/5 border-destructive/15 hover:border-destructive/30'
                    }`}
                    onClick={() => setExpandedId(isExpanded ? null : p.id)}
                  >
                    {/* Main Row */}
                    <div className="flex items-center gap-2 p-2">
                      {/* Result Badge */}
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        p.hit_type === 'exact'
                          ? 'bg-primary/20 border border-primary/40'
                          : p.hit
                          ? 'bg-emerald-500/15 border border-emerald-500/30'
                          : 'bg-destructive/10 border border-destructive/20'
                      }`}>
                        {p.hit_type === 'exact' ? (
                          <Trophy className="w-4 h-4 text-primary" />
                        ) : p.hit ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-destructive/70" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-bold text-foreground">
                            {STRATEGY_EMOJI[p.strategy_type] || ''} {STRATEGY_FRIENDLY[p.strategy_type] || p.strategy_label}
                          </span>
                          <span className={`text-[7px] px-1.5 py-0.5 rounded-full font-bold ${
                            p.hit_type === 'exact'
                              ? 'bg-primary/20 text-primary'
                              : p.hit
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-destructive/15 text-destructive'
                          }`}>
                            {p.hit_type === 'exact' ? '💎 EXATO' : p.hit ? '✅ ACERTOU' : '✗ ERROU'}
                          </span>
                        </div>

                        {/* Numbers row */}
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[7px] text-muted-foreground/60">Previu:</span>
                          {p.predicted_main !== null && (
                            <div className={`w-5.5 h-5.5 rounded-full flex items-center justify-center text-[8px] font-bold shadow-sm ${colorClass(p.predicted_main)} border border-white/10`}>
                              {p.predicted_main}
                            </div>
                          )}
                          {p.actual_number !== null && (
                            <>
                              <ArrowRight className="w-2.5 h-2.5 text-muted-foreground/40" />
                              <span className="text-[7px] text-muted-foreground/60">Saiu:</span>
                              <div className={`w-5.5 h-5.5 rounded-full flex items-center justify-center text-[8px] font-bold shadow-sm ${colorClass(p.actual_number)} border border-white/10`}>
                                {p.actual_number}
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Right side */}
                      <div className="flex flex-col items-end gap-0.5 shrink-0">
                        <span className="text-[7px] text-muted-foreground/50 font-mono">
                          {new Date(p.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <div className="flex items-center gap-1">
                          <span className={`text-[8px] font-mono font-bold ${
                            p.probability >= 70 ? 'text-emerald-400' : p.probability >= 50 ? 'text-amber-400' : 'text-muted-foreground'
                          }`}>
                            {p.probability}%
                          </span>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="w-3 h-3 text-muted-foreground/40" />
                        ) : (
                          <ChevronDown className="w-3 h-3 text-muted-foreground/40" />
                        )}
                      </div>
                    </div>

                    {/* Expanded Details */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-3 pb-2.5 pt-0.5 border-t border-border/30 space-y-1.5">
                            {/* Convergence + probability bar */}
                            <div className="flex items-center gap-2">
                              <span className="text-[7px] text-muted-foreground w-16">Confiança:</span>
                              <div className="flex-1 h-1.5 bg-secondary/60 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    p.probability >= 70 ? 'bg-emerald-500' : p.probability >= 50 ? 'bg-amber-500' : 'bg-red-500'
                                  }`}
                                  style={{ width: `${p.probability}%` }}
                                />
                              </div>
                              <span className="text-[8px] font-mono text-muted-foreground">{p.probability}%</span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-[7px] text-muted-foreground w-16">Convergência:</span>
                              <div className="flex-1 h-1.5 bg-secondary/60 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-primary"
                                  style={{ width: `${Math.min(100, (p.convergence_score / 1700) * 100)}%` }}
                                />
                              </div>
                              <span className="text-[8px] font-mono text-muted-foreground">{p.convergence_score}/1700</span>
                            </div>

                            {/* All predicted numbers */}
                            {p.predicted_numbers.length > 1 && (
                              <div>
                                <span className="text-[7px] text-muted-foreground block mb-1">Números cobertos:</span>
                                <div className="flex flex-wrap gap-1">
                                  {p.predicted_numbers.map((n, i) => (
                                    <div key={i} className={`w-5 h-5 rounded-full flex items-center justify-center text-[7px] font-bold ${
                                      n === p.actual_number
                                        ? 'ring-2 ring-primary ring-offset-1 ring-offset-background ' + colorClass(n)
                                        : colorClass(n)
                                    } border border-white/10`}>
                                      {n}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Justification */}
                            {p.justification && (
                              <div className="bg-secondary/30 rounded-md p-1.5">
                                <span className="text-[7px] text-muted-foreground/60 block mb-0.5">Justificativa da IA:</span>
                                <span className="text-[8px] text-foreground/80 leading-relaxed">{p.justification}</span>
                              </div>
                            )}

                            {p.mesa_mode && (
                              <span className="text-[7px] text-muted-foreground/50">Modo mesa: {p.mesa_mode}</span>
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
    default: 'bg-secondary/50 border-border text-foreground',
    success: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400',
    danger: 'bg-destructive/10 border-destructive/25 text-destructive',
    warning: 'bg-amber-500/10 border-amber-500/25 text-amber-400',
    primary: 'bg-primary/10 border-primary/25 text-primary',
  };

  return (
    <div className={`rounded-lg p-2 text-center border ${styles[variant]}`}>
      <div className="flex items-center justify-center gap-1">
        {icon}
        <span className="text-base font-bold font-mono">{value}</span>
      </div>
      <span className="text-[7px] text-muted-foreground block mt-0.5">{label}</span>
    </div>
  );
};

export default PredictionHistory;
