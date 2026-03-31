import { memo, useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface ModelPerf {
  winRate: number;
  total: number;
  hits: number;
  streak: number;
  weight: number;
}

interface EnsembleDashboardProps {
  sniperData: any;
}

const MODEL_META: Record<string, { name: string; icon: string; desc: string }> = {
  markov: { name: 'Markov Chain', icon: '🔗', desc: 'Cadeias de transição sequencial' },
  neural_pattern: { name: 'Neural Pattern', icon: '🧠', desc: 'Padrões temporais complexos' },
  gradient: { name: 'Gradient Boost', icon: '📈', desc: 'Feature scoring multi-dimensional' },
  bayesian: { name: 'Bayesiano', icon: '🎲', desc: 'Probabilidades condicionais dinâmicas' },
  statistical: { name: 'Estatístico', icon: '📊', desc: 'Desvios, streaks, setores' },
};

const EnsembleDashboard = memo(({ sniperData }: EnsembleDashboardProps) => {
  const [dbWeights, setDbWeights] = useState<any[]>([]);

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

  const modelPerf: Record<string, ModelPerf> = useMemo(() => {
    // Prefer live sniperData, fallback to DB
    if (sniperData?.modelPerformance) return sniperData.modelPerformance;
    const result: Record<string, ModelPerf> = {};
    for (const row of dbWeights) {
      result[row.model_id] = {
        winRate: Number(row.win_rate) || 0,
        total: row.total_predictions || 0,
        hits: row.total_hits || 0,
        streak: row.current_streak || 0,
        weight: Number(row.weight) || 1,
      };
    }
    return result;
  }, [sniperData?.modelPerformance, dbWeights]);

  const modelSignals = sniperData?.modelSignals || [];
  const temperature = sniperData?.temperature || 'morna';
  const ensembleConsensus = sniperData?.ensembleConsensus || 0;
  const ensembleConfidence = sniperData?.ensembleConfidence || 0;
  const arbiterLog = sniperData?.arbiterLog || [];

  const tempColor = temperature === 'quente' ? 'text-amber-400' : temperature === 'fria' ? 'text-blue-400' : temperature === 'caotica' ? 'text-red-400' : 'text-muted-foreground';
  const tempBg = temperature === 'quente' ? 'bg-amber-500/10 border-amber-500/20' : temperature === 'fria' ? 'bg-blue-500/10 border-blue-500/20' : temperature === 'caotica' ? 'bg-red-500/10 border-red-500/20' : 'bg-card border-border';

  return (
    <div className="space-y-3">
      {/* Ensemble Summary */}
      <div className={`rounded-xl border p-4 ${tempBg}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🤖</span>
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-foreground">Ensemble Multi-Modelo</div>
              <div className="text-[7px] text-muted-foreground">5 modelos competindo em paralelo</div>
            </div>
          </div>
          <div className={`px-2.5 py-1 rounded-full border text-[8px] font-black uppercase ${tempBg} ${tempColor}`}>
            🌡️ {temperature}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="text-center">
            <div className="text-[8px] text-muted-foreground uppercase font-bold">Confiança</div>
            <div className="text-[14px] font-black text-primary font-mono">{ensembleConfidence}%</div>
          </div>
          <div className="text-center">
            <div className="text-[8px] text-muted-foreground uppercase font-bold">Consenso</div>
            <div className="text-[14px] font-black text-foreground font-mono">{ensembleConsensus}/5</div>
          </div>
          <div className="text-center">
            <div className="text-[8px] text-muted-foreground uppercase font-bold">Entrada</div>
            <div className={`text-[14px] font-black font-mono ${
              sniperData?.entryForce === 'forte' ? 'text-green-400' :
              sniperData?.entryForce === 'padrao' ? 'text-amber-400' : 'text-muted-foreground'
            }`}>
              {sniperData?.entryForce?.toUpperCase() || '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Model Status Grid */}
      <div className="space-y-2">
        <div className="text-[9px] font-black text-muted-foreground uppercase tracking-wider px-1">Status dos Modelos</div>
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
              transition={{ delay: idx * 0.05 }}
              className={`rounded-xl border p-3 transition-all ${
                isLeader ? 'bg-primary/8 border-primary/30 ring-1 ring-primary/20' : 'bg-card border-border/60'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm">{meta.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[9px] font-black ${isLeader ? 'text-primary' : 'text-foreground'}`}>{meta.name}</span>
                    {isLeader && <span className="text-[6px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-bold">LÍDER</span>}
                  </div>
                  <span className="text-[7px] text-muted-foreground">{meta.desc}</span>
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-[10px] font-black font-mono ${
                    wr >= 50 ? 'text-green-400' : wr >= 35 ? 'text-amber-400' : wr > 0 ? 'text-red-400' : 'text-muted-foreground'
                  }`}>{total > 0 ? `${wr}%` : 'N/A'}</div>
                  <div className="text-[6px] text-muted-foreground">{total} pred.</div>
                </div>
              </div>

              {/* Weight bar */}
              <div className="flex items-center gap-2">
                <span className="text-[7px] text-muted-foreground w-8 shrink-0">Peso</span>
                <div className="flex-1">
                  <Progress value={Math.min(100, weight * 40)} className="h-1.5" />
                </div>
                <span className="text-[7px] font-mono text-muted-foreground w-6 text-right">{weight.toFixed(1)}</span>
                {streak !== 0 && (
                  <span className={`text-[7px] font-bold ${
                    streak > 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {streak > 0 ? `+${streak}` : streak}
                  </span>
                )}
              </div>

              {/* Signal from this model */}
              {signal && (
                <div className="mt-2 px-2 py-1.5 rounded-lg bg-secondary/40 border border-border/30">
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
      </div>

      {/* Arbiter Log */}
      {arbiterLog.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-3">
          <div className="text-[9px] font-black text-muted-foreground uppercase tracking-wider mb-2">Log do Árbitro</div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {arbiterLog.map((line: string, i: number) => (
              <div key={i} className="text-[7px] text-foreground/70 font-mono leading-relaxed px-2 py-1 rounded bg-secondary/20">
                {line}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ethical Notice */}
      <div className="px-3 py-2.5 rounded-xl bg-amber-500/5 border border-amber-500/15">
        <p className="text-[7px] text-amber-400/80 leading-relaxed text-center">
          ⚠️ Nenhum modelo pode garantir lucro a longo prazo. A roleta é um jogo estocástico. Este sistema é uma ferramenta de estudo e entretenimento.
        </p>
      </div>
    </div>
  );
});

EnsembleDashboard.displayName = 'EnsembleDashboard';
export default EnsembleDashboard;
