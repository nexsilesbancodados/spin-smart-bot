import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, Target, TrendingUp, BarChart3, Clock } from 'lucide-react';

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
}

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const colorClass = (n: number) => {
  if (n === 0) return 'bg-roulette-green text-white';
  return RED_NUMBERS.includes(n) ? 'bg-roulette-red text-white' : 'bg-roulette-black text-white';
};

const STRATEGY_EMOJI: Record<string, string> = {
  sniper: '🎯', cavalos: '🐴', duzias: '📊', voisins: '🎰', setor_oposto: '🔄', quebra: '⚡',
  genetic_cluster: '🧬', cross_delay: '💥', insight_pattern: '🧬', cylinder_bias: '🔩',
  column_cycle: '📐', dozen_phase: '🎲', terminal_alternation: '🔢', numero_exato: '💎',
  ritmo_calibrado: '🎯', archetype_fusion: '🏛️', matrix_fusion: '🔮', cobertura_area: '🗺️',
  terminais_cruzados: '🐎', pressao_retorno: '🔥', cor: '🎨', paridade: '🔵', alto_baixo: '⬆️',
  coluna: '📐', duzia_unica: '🎲',
};

const PredictionHistory = () => {
  const [predictions, setPredictions] = useState<PredictionRecord[]>([]);
  const [showAll, setShowAll] = useState(false);

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

  const displayPredictions = showAll ? resolved : resolved.slice(0, 20);

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          <span className="font-display text-sm text-primary tracking-widest font-bold">HISTÓRICO DE PREVISÕES</span>
        </div>
        <button
          onClick={() => setShowAll(!showAll)}
          className={`text-[9px] px-2 py-1 rounded-lg font-bold transition-all ${
            showAll ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-secondary text-muted-foreground border border-border'
          }`}
        >
          {showAll ? `TODOS (${resolved.length})` : 'ÚLTIMOS 20'}
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
        <div className="bg-secondary/50 rounded-lg p-2 text-center border border-border">
          <span className="text-lg font-bold font-mono text-foreground">{resolved.length}</span>
          <span className="text-[7px] text-muted-foreground block">PREVISÕES</span>
        </div>
        <div className={`rounded-lg p-2 text-center border ${
          parseFloat(winRate) >= 50 ? 'bg-green-500/10 border-green-500/30' : 'bg-destructive/10 border-destructive/30'
        }`}>
          <span className={`text-lg font-bold font-mono ${parseFloat(winRate) >= 50 ? 'text-green-400' : 'text-destructive'}`}>
            {winRate}%
          </span>
          <span className="text-[7px] text-muted-foreground block">WIN RATE</span>
        </div>
        <div className="bg-green-500/10 rounded-lg p-2 text-center border border-green-500/30">
          <span className="text-lg font-bold font-mono text-green-400">{hits.length}</span>
          <span className="text-[7px] text-muted-foreground block">ACERTOS</span>
        </div>
        <div className="bg-destructive/10 rounded-lg p-2 text-center border border-destructive/30">
          <span className="text-lg font-bold font-mono text-destructive">{misses.length}</span>
          <span className="text-[7px] text-muted-foreground block">ERROS</span>
        </div>
        <div className="bg-primary/10 rounded-lg p-2 text-center border border-primary/30">
          <span className="text-lg font-bold font-mono text-primary">{exactHits.length}</span>
          <span className="text-[7px] text-muted-foreground block">EXATOS</span>
        </div>
      </div>

      {/* Streak indicator */}
      {currentStreak >= 2 && streakType && (
        <div className={`text-center text-[9px] font-bold px-2 py-1 rounded-lg mb-2 ${
          streakType === 'hit' ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-destructive/10 text-destructive border border-destructive/30'
        }`}>
          {streakType === 'hit' ? `🔥 ${currentStreak}x ACERTOS SEGUIDOS!` : `⚠️ ${currentStreak}x erros seguidos`}
        </div>
      )}

      {/* Strategy Performance */}
      {Object.keys(strategyStats).length > 0 && (
        <div className="mb-3">
          <span className="text-[8px] text-muted-foreground block mb-1">PERFORMANCE POR ESTRATÉGIA:</span>
          <div className="flex flex-wrap gap-1">
            {Object.entries(strategyStats).sort(([,a],[,b]) => (b.hits/b.total) - (a.hits/a.total)).map(([type, { hits: h, total: t }]) => {
              const rate = ((h / t) * 100).toFixed(0);
              return (
                <span key={type} className={`text-[8px] px-2 py-1 rounded-lg font-bold border ${
                  parseFloat(rate) >= 50 ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-destructive/10 text-destructive border-destructive/30'
                }`}>
                  {STRATEGY_EMOJI[type] || '📌'} {type}: {h}/{t} ({rate}%)
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Prediction List */}
      {displayPredictions.length === 0 ? (
        <div className="text-center py-6">
          <Target className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-[10px] text-muted-foreground">Nenhuma previsão registrada ainda. Aguarde sinais do sistema.</p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
          {displayPredictions.map((p, idx) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.02 }}
              className={`flex items-center gap-2 p-2 rounded-lg border ${
                p.hit === true
                  ? 'bg-green-500/5 border-green-500/20'
                  : 'bg-destructive/5 border-destructive/20'
              }`}
            >
              {/* Hit/Miss icon */}
              {p.hit ? (
                <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-destructive shrink-0" />
              )}

              {/* Strategy info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-bold text-foreground">
                    {STRATEGY_EMOJI[p.strategy_type] || ''} {p.strategy_label}
                  </span>
                  <span className={`text-[7px] px-1 py-0.5 rounded font-bold ${
                    p.hit_type === 'exact' ? 'bg-primary/20 text-primary' : p.hit ? 'bg-green-500/20 text-green-400' : 'bg-destructive/20 text-destructive'
                  }`}>
                    {p.hit_type === 'exact' ? '🎯 EXATO' : p.hit ? '✅ VIZINHO' : '❌ ERRO'}
                  </span>
                  <span className="text-[7px] text-muted-foreground ml-auto font-mono">
                    {p.probability}% • {p.convergence_score}/1500
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-[7px] text-muted-foreground">Previsto:</span>
                  {p.predicted_main !== null && (
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[7px] font-bold ${colorClass(p.predicted_main)} border border-white/20`}>
                      {p.predicted_main}
                    </div>
                  )}
                  {p.actual_number !== null && (
                    <>
                      <span className="text-[7px] text-muted-foreground">→ Saiu:</span>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[7px] font-bold ${colorClass(p.actual_number)} border border-white/20`}>
                        {p.actual_number}
                      </div>
                    </>
                  )}
                  <span className="text-[6px] text-muted-foreground/60 ml-auto">
                    {new Date(p.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PredictionHistory;
