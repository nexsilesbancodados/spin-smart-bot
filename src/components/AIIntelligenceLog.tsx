import { memo, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Zap, TrendingUp, TrendingDown, Minus, BarChart3, Activity, Cpu, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface LogEntry { step: string; detail: string; confidence: number; }
interface MarkovData { state: string; bestNext: string; bestProb: number; sampleSize: number; nextProbs: Record<string, number>; }
interface EngineData {
  status: string; dataPoints: number; analysisMs: number;
  markov?: { color: { order1: MarkovData | null; order2: MarkovData | null; order3: MarkovData | null }; dozen: { order1: MarkovData | null; order2: MarkovData | null }; };
  zones?: { short: { hotZone: { id: number; bias: number; numbers: number[] } | null } };
  reinforcement?: { strategies: { type: string; winRate: number; weight: number; recentTrend: string; shouldEmit: boolean }[]; suppressed: string[] };
  log: LogEntry[];
}

const trendIcon = (trend: string) => {
  if (trend === 'improving') return <TrendingUp className="w-3 h-3 text-neon-green" />;
  if (trend === 'declining') return <TrendingDown className="w-3 h-3 text-destructive" />;
  return <Minus className="w-3 h-3 text-muted-foreground/40" />;
};

const confidenceColor = (c: number) => c >= 80 ? 'text-neon-green' : c >= 60 ? 'text-gold' : 'text-muted-foreground/60';

const AIIntelligenceLog = memo(() => {
  const [data, setData] = useState<EngineData | null>(null);
  const [loading, setLoading] = useState(false);
  const [animStep, setAnimStep] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchEngine = async () => {
    setLoading(true); setAnimStep(0);
    try {
      const res = await supabase.functions.invoke('markov-engine');
      if (res.data) {
        setData(res.data);
        const entries = res.data.log?.length || 0;
        let step = 0;
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = setInterval(() => { step++; setAnimStep(step); if (step >= entries && intervalRef.current) clearInterval(intervalRef.current); }, 400);
      }
    } catch { /* silent */ } finally { setLoading(false); }
  };

  useEffect(() => {
    fetchEngine();
    const interval = setInterval(fetchEngine, 120_000);
    return () => { clearInterval(interval); if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  return (
    <div className="glass rounded-2xl overflow-hidden border border-border/20 space-y-0">
      {/* Header */}
      <div className="relative px-4 pt-4 pb-3">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-transparent to-neon-cyan/3" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/15 to-neon-cyan/10 border border-purple-500/20 flex items-center justify-center shadow-[0_0_15px_rgba(168,85,247,0.2)]">
              <Brain className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-display font-bold uppercase tracking-[0.15em] text-purple-400">Motor IA Markov</span>
                {data && (
                  <span className="text-[7px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400/70 font-mono border border-purple-500/15">
                    {data.analysisMs}ms
                  </span>
                )}
              </div>
              {data && (
                <div className="text-[8px] text-muted-foreground/50 font-mono mt-0.5">
                  <Cpu className="w-3 h-3 inline mr-1 text-muted-foreground/30" />
                  {data.dataPoints.toLocaleString()} giros processados
                </div>
              )}
            </div>
          </div>
          <motion.button
            onClick={fetchEngine}
            disabled={loading}
            whileTap={{ scale: 0.95 }}
            className="text-[9px] px-4 py-2 rounded-xl glass text-neon-cyan font-bold border border-neon-cyan/15 hover:bg-neon-cyan/10 transition-all disabled:opacity-30 flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Analisando...' : 'Atualizar'}
          </motion.button>
        </div>
      </div>

      <div className="px-4 pb-4 space-y-3">

      {/* Log entries */}
      {data?.log && (
        <div className="space-y-1.5">
          <AnimatePresence>
            {data.log.slice(0, animStep).map((entry, i) => (
              <motion.div key={`${entry.step}-${i}`} initial={{ opacity: 0, x: -20, height: 0 }} animate={{ opacity: 1, x: 0, height: 'auto' }} transition={{ duration: 0.3 }}
                className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl glass border border-border/15 hover:border-border/25 transition-all">
                <div className={`mt-0.5 w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                  entry.confidence >= 80 ? 'bg-neon-green/10 text-neon-green border border-neon-green/20' : entry.confidence >= 60 ? 'bg-gold/10 text-gold border border-gold/20' : 'bg-background/30 text-muted-foreground/40 border border-border/10'
                }`}>
                  {entry.confidence >= 80 ? <Zap className="w-3 h-3" /> : entry.confidence >= 60 ? <Activity className="w-3 h-3" /> : <BarChart3 className="w-3 h-3" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-foreground/80">{entry.step}</span>
                    <div className="flex items-center gap-1">
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        entry.confidence >= 80 ? 'bg-neon-green' : entry.confidence >= 60 ? 'bg-gold' : 'bg-muted-foreground/30'
                      }`} />
                      <span className={`text-[9px] font-bold font-mono ${confidenceColor(entry.confidence)}`}>{entry.confidence}%</span>
                    </div>
                  </div>
                  <p className="text-[9px] text-muted-foreground/60 leading-relaxed mt-0.5">{entry.detail}</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {animStep < (data.log.length || 0) && (
            <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.5, repeat: Infinity }}
              className="flex items-center gap-2 px-3 py-2.5 text-[9px] text-neon-cyan font-bold glass rounded-xl border border-neon-cyan/10">
              <div className="w-2 h-2 rounded-full bg-neon-cyan animate-pulse shadow-[0_0_8px_hsl(var(--neon-cyan)/0.5)]" />
              Processando padrão {animStep + 1} de {data.log.length}...
            </motion.div>
          )}
        </div>
      )}

      {/* Markov summary */}
      {data?.markov?.color?.order3 && (
        <div className="px-3 py-3 rounded-xl glass border border-purple-500/15 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/3 via-transparent to-transparent" />
          <div className="relative">
            <div className="text-[9px] font-bold text-purple-400/70 uppercase tracking-[0.15em] mb-2 font-display">Cadeia de Markov — Cor (3ª ordem)</div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[11px] font-mono text-foreground/80 bg-background/20 px-2 py-1 rounded-lg border border-border/10">[{data.markov.color.order3.state}]</span>
              <span className="text-[11px] text-muted-foreground/30">→</span>
              {Object.entries(data.markov.color.order3.nextProbs).sort(([,a], [,b]) => b - a).map(([color, prob]) => (
                <span key={color} className={`text-[11px] font-bold px-2 py-1 rounded-lg border ${
                  color === 'R' ? 'text-red-400 bg-red-500/8 border-red-500/15' : color === 'B' ? 'text-foreground/70 bg-zinc-600/10 border-zinc-600/15' : 'text-emerald-400 bg-emerald-500/8 border-emerald-500/15'
                }`}>
                  {color === 'R' ? 'Verm' : color === 'B' ? 'Preto' : 'Verde'}: {prob}%
                </span>
              ))}
            </div>
            <div className="text-[8px] text-muted-foreground/40 mt-2 font-mono">Baseado em {data.markov.color.order3.sampleSize} ocorrências reais</div>
          </div>
        </div>
      )}

      {/* Strategy weights */}
      {data?.reinforcement?.strategies && data.reinforcement.strategies.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Activity className="w-3 h-3 text-neon-cyan/50" />
            <div className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-[0.15em] font-display">Pesos das Estratégias</div>
          </div>
          {data.reinforcement.strategies.slice(0, 5).map((s) => (
            <div key={s.type} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border backdrop-blur-sm transition-all hover:scale-[1.01] ${
              s.shouldEmit ? 'glass border-border/15' : 'bg-destructive/3 border-destructive/10 opacity-50'
            }`}>
              {trendIcon(s.recentTrend)}
              <span className="text-[10px] font-bold text-foreground/80 flex-1">{s.type}</span>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-muted-foreground/50 font-mono">WR: {s.winRate}%</span>
                <div className="w-16 h-2 bg-background/30 rounded-full overflow-hidden border border-border/10">
                  <div className={`h-full rounded-full transition-all ${
                    s.weight >= 60 ? 'bg-gradient-to-r from-neon-green to-emerald-400' : s.weight >= 30 ? 'bg-gradient-to-r from-gold to-amber-400' : 'bg-gradient-to-r from-destructive to-red-400'
                  }`} style={{ width: `${s.weight}%` }} />
                </div>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                  s.shouldEmit ? 'text-neon-green bg-neon-green/8 border-neon-green/15' : 'text-destructive/60 bg-destructive/5 border-destructive/10'
                }`}>
                  {s.shouldEmit ? 'ATIVO' : 'OFF'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {!data && loading && (
        <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 2, repeat: Infinity }} className="py-10 text-center">
          <div className="w-14 h-14 rounded-2xl glass border border-purple-500/15 flex items-center justify-center mx-auto mb-3">
            <Brain className="w-7 h-7 text-purple-400/30 animate-pulse" />
          </div>
          <p className="text-xs font-bold text-muted-foreground/40 font-display tracking-wider">Carregando motor de aprendizado...</p>
          <p className="text-[9px] text-muted-foreground/25 mt-1">Analisando até 5.000 rodadas com Cadeias de Markov</p>
        </motion.div>
      )}

      {data && (
        <div className="text-[7px] text-muted-foreground/25 text-center font-mono pt-2 border-t border-border/10">
          Processado em {data.analysisMs}ms • {data.dataPoints.toLocaleString()} rodadas analisadas
        </div>
      )}
      </div>
    </div>
  );
});

AIIntelligenceLog.displayName = 'AIIntelligenceLog';
export default AIIntelligenceLog;
