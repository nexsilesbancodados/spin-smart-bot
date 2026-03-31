import { memo, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Zap, TrendingUp, TrendingDown, Minus, BarChart3, Activity } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface LogEntry {
  step: string;
  detail: string;
  confidence: number;
}

interface MarkovData {
  state: string;
  bestNext: string;
  bestProb: number;
  sampleSize: number;
  nextProbs: Record<string, number>;
}

interface EngineData {
  status: string;
  dataPoints: number;
  analysisMs: number;
  markov?: {
    color: { order1: MarkovData | null; order2: MarkovData | null; order3: MarkovData | null };
    dozen: { order1: MarkovData | null; order2: MarkovData | null };
  };
  zones?: {
    short: { hotZone: { id: number; bias: number; numbers: number[] } | null };
  };
  reinforcement?: {
    strategies: { type: string; winRate: number; weight: number; recentTrend: string; shouldEmit: boolean }[];
    suppressed: string[];
  };
  log: LogEntry[];
}

const trendIcon = (trend: string) => {
  if (trend === 'improving') return <TrendingUp className="w-3 h-3 text-green-400" />;
  if (trend === 'declining') return <TrendingDown className="w-3 h-3 text-destructive" />;
  return <Minus className="w-3 h-3 text-muted-foreground" />;
};

const confidenceColor = (c: number) => {
  if (c >= 80) return 'text-green-400';
  if (c >= 60) return 'text-yellow-400';
  return 'text-muted-foreground';
};

const AIIntelligenceLog = memo(() => {
  const [data, setData] = useState<EngineData | null>(null);
  const [loading, setLoading] = useState(false);
  const [animStep, setAnimStep] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchEngine = async () => {
    setLoading(true);
    setAnimStep(0);
    try {
      const res = await supabase.functions.invoke('markov-engine');
      if (res.data) {
        setData(res.data);
        // Animate log entries appearing one by one
        const entries = res.data.log?.length || 0;
        let step = 0;
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = setInterval(() => {
          step++;
          setAnimStep(step);
          if (step >= entries) {
            if (intervalRef.current) clearInterval(intervalRef.current);
          }
        }, 400);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEngine();
    const interval = setInterval(fetchEngine, 120_000); // refresh every 2 min
    return () => {
      clearInterval(interval);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-primary" />
          <span className="text-[11px] font-black uppercase tracking-[0.15em] text-primary">Motor IA Markov</span>
          {data && (
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold border border-primary/20">
              {data.dataPoints.toLocaleString()} giros
            </span>
          )}
        </div>
        <button
          onClick={fetchEngine}
          disabled={loading}
          className="text-[9px] px-3 py-1 rounded-lg bg-primary/10 text-primary font-bold border border-primary/20 hover:bg-primary/20 transition-all disabled:opacity-40"
        >
          {loading ? '⏳ Analisando...' : '🔄 Atualizar'}
        </button>
      </div>

      {/* Log entries — animated */}
      {data?.log && (
        <div className="space-y-1.5">
          <AnimatePresence>
            {data.log.slice(0, animStep).map((entry, i) => (
              <motion.div
                key={`${entry.step}-${i}`}
                initial={{ opacity: 0, x: -20, height: 0 }}
                animate={{ opacity: 1, x: 0, height: 'auto' }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-card border border-border/40"
              >
                <div className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                  entry.confidence >= 80 ? 'bg-green-500/15 text-green-400' :
                  entry.confidence >= 60 ? 'bg-yellow-500/15 text-yellow-400' :
                  'bg-secondary text-muted-foreground'
                }`}>
                  {entry.confidence >= 80 ? <Zap className="w-3 h-3" /> :
                   entry.confidence >= 60 ? <Activity className="w-3 h-3" /> :
                   <BarChart3 className="w-3 h-3" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-foreground">{entry.step}</span>
                    <span className={`text-[9px] font-bold ${confidenceColor(entry.confidence)}`}>
                      {entry.confidence}%
                    </span>
                  </div>
                  <p className="text-[9px] text-muted-foreground leading-relaxed mt-0.5">
                    {entry.detail}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Still animating indicator */}
          {animStep < (data.log.length || 0) && (
            <motion.div
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="flex items-center gap-2 px-3 py-2 text-[9px] text-primary font-bold"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Processando padrão {animStep + 1} de {data.log.length}...
            </motion.div>
          )}
        </div>
      )}

      {/* Markov summary */}
      {data?.markov?.color?.order3 && (
        <div className="px-3 py-2.5 rounded-xl bg-secondary/20 border border-border/30">
          <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Cadeia de Markov — Cor (3ª ordem)</div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono text-foreground">[{data.markov.color.order3.state}]</span>
            <span className="text-[11px] text-muted-foreground">→</span>
            {Object.entries(data.markov.color.order3.nextProbs).sort(([,a], [,b]) => b - a).map(([color, prob]) => (
              <span key={color} className={`text-[11px] font-bold ${
                color === 'R' ? 'text-red-400' : color === 'B' ? 'text-foreground' : 'text-emerald-400'
              }`}>
                {color === 'R' ? 'Verm' : color === 'B' ? 'Preto' : 'Verde'}: {prob}%
              </span>
            ))}
          </div>
          <div className="text-[8px] text-muted-foreground mt-1">
            Baseado em {data.markov.color.order3.sampleSize} ocorrências reais
          </div>
        </div>
      )}

      {/* Strategy weights (reinforcement) */}
      {data?.reinforcement?.strategies && data.reinforcement.strategies.length > 0 && (
        <div className="space-y-1">
          <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Pesos das Estratégias (Autoajuste)</div>
          {data.reinforcement.strategies.slice(0, 5).map((s) => (
            <div key={s.type} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
              s.shouldEmit ? 'bg-card border-border/40' : 'bg-destructive/5 border-destructive/20 opacity-60'
            }`}>
              {trendIcon(s.recentTrend)}
              <span className="text-[10px] font-bold text-foreground flex-1">{s.type}</span>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-muted-foreground">WR: {s.winRate}%</span>
                <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      s.weight >= 60 ? 'bg-green-500' : s.weight >= 30 ? 'bg-yellow-500' : 'bg-destructive'
                    }`}
                    style={{ width: `${s.weight}%` }}
                  />
                </div>
                <span className={`text-[9px] font-bold ${s.shouldEmit ? 'text-green-400' : 'text-destructive'}`}>
                  {s.shouldEmit ? 'ATIVO' : 'OFF'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Loading state */}
      {!data && loading && (
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="py-8 text-center"
        >
          <Brain className="w-8 h-8 text-primary/30 mx-auto mb-3 animate-pulse" />
          <p className="text-[11px] font-bold text-muted-foreground">
            Carregando motor de aprendizado...
          </p>
          <p className="text-[9px] text-muted-foreground/60 mt-1">
            Analisando até 5.000 rodadas com Cadeias de Markov
          </p>
        </motion.div>
      )}

      {data && (
        <div className="text-[8px] text-muted-foreground/50 text-center">
          Processado em {data.analysisMs}ms • {data.dataPoints.toLocaleString()} rodadas analisadas
        </div>
      )}
    </div>
  );
});

AIIntelligenceLog.displayName = 'AIIntelligenceLog';
export default AIIntelligenceLog;
