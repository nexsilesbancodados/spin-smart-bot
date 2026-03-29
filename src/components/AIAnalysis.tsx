import { useState, useEffect, useRef } from 'react';
import { useRoulette } from '@/contexts/RouletteContext';
import { getHotNumbers, getColdNumbers, getColorStats } from '@/lib/roulette';
import { supabase } from '@/integrations/supabase/client';
import { Brain, TrendingUp, AlertTriangle, Target, Loader2, RefreshCw, Sparkles, Shield, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AIPattern {
  name: string;
  description: string;
  confidence: number;
}

interface AISuggestion {
  bet: string;
  reason: string;
  risk: 'baixo' | 'médio' | 'alto';
}

interface AIAlert {
  message: string;
  severity: 'info' | 'warning' | 'critical';
}

interface AIAnalysisResult {
  patterns: AIPattern[];
  suggestions: AISuggestion[];
  alerts: AIAlert[];
  summary: string;
}

const AIAnalysis = () => {
  const { history } = useRoulette();
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAnalyzedCount, setLastAnalyzedCount] = useState(0);
  const [autoAnalyze, setAutoAnalyze] = useState(true);
  const analyzeInterval = useRef(5); // analyze every N new numbers

  const runAnalysis = async () => {
    if (history.length < 5) return;
    
    setLoading(true);
    setError(null);

    try {
      const numbers = history.map(h => h.value);
      const hotNumbers = getHotNumbers(history, 8);
      const coldNumbers = getColdNumbers(history, 8);
      const colorStats = getColorStats(history);

      const { data, error: fnError } = await supabase.functions.invoke('analyze-roulette', {
        body: { numbers, hotNumbers, coldNumbers, colorStats },
      });

      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);

      setAnalysis(data.analysis);
      setLastAnalyzedCount(history.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao analisar');
    } finally {
      setLoading(false);
    }
  };

  // Auto-analyze every N new numbers
  useEffect(() => {
    if (!autoAnalyze || loading) return;
    if (history.length >= 5 && history.length - lastAnalyzedCount >= analyzeInterval.current) {
      runAnalysis();
    }
  }, [history.length, autoAnalyze]);

  const riskColor = (risk: string) => {
    switch (risk) {
      case 'baixo': return 'text-green-400 bg-green-400/10 border-green-400/20';
      case 'médio': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      case 'alto': return 'text-red-400 bg-red-400/10 border-red-400/20';
      default: return 'text-muted-foreground bg-muted/10';
    }
  };

  const severityStyle = (severity: string) => {
    switch (severity) {
      case 'critical': return 'border-destructive/50 bg-destructive/10 text-destructive';
      case 'warning': return 'border-yellow-500/50 bg-yellow-500/10 text-yellow-400';
      default: return 'border-primary/50 bg-primary/10 text-primary';
    }
  };

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-secondary/30">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-purple-400" />
          <span className="font-display text-[10px] tracking-widest text-purple-400">ANÁLISE IA • DEEPSEEK</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoAnalyze(!autoAnalyze)}
            className={`text-[9px] px-2 py-0.5 rounded font-semibold transition-all ${
              autoAnalyze
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                : 'bg-secondary text-muted-foreground border border-border'
            }`}
          >
            {autoAnalyze ? '🔄 AUTO' : '⏸ MANUAL'}
          </button>
          <button
            onClick={runAnalysis}
            disabled={loading || history.length < 5}
            className="text-[9px] px-2 py-0.5 rounded bg-purple-600 text-white font-semibold hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-all"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            ANALISAR
          </button>
        </div>
      </div>

      <div className="p-3 space-y-3">
        {/* Status */}
        {history.length < 5 && (
          <div className="text-center py-4 text-muted-foreground text-xs">
            <Brain className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>Mínimo de 5 números para análise IA</p>
            <p className="text-[10px] mt-1">Números atuais: {history.length}/5</p>
          </div>
        )}

        {error && (
          <div className="bg-destructive/10 border border-destructive/30 rounded p-2 text-xs text-destructive flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {loading && !analysis && (
          <div className="text-center py-6">
            <Loader2 className="w-6 h-6 mx-auto animate-spin text-purple-400 mb-2" />
            <p className="text-xs text-muted-foreground">DeepSeek analisando padrões...</p>
          </div>
        )}

        <AnimatePresence mode="wait">
          {analysis && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {/* Summary */}
              <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-2.5">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Sparkles className="w-3 h-3 text-purple-400" />
                  <span className="text-[10px] font-bold text-purple-400 tracking-wider">RESUMO ESTRATÉGICO</span>
                </div>
                <p className="text-[11px] text-foreground/80 leading-relaxed">{analysis.summary}</p>
              </div>

              {/* Alerts */}
              {analysis.alerts?.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="w-3 h-3 text-yellow-400" />
                    <span className="text-[10px] font-bold text-yellow-400 tracking-wider">ALERTAS</span>
                  </div>
                  {analysis.alerts.map((alert, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className={`rounded p-2 text-[10px] font-medium border ${severityStyle(alert.severity)}`}
                    >
                      {alert.severity === 'critical' ? '🚨' : alert.severity === 'warning' ? '⚠️' : 'ℹ️'} {alert.message}
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Patterns */}
              {analysis.patterns?.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="w-3 h-3 text-primary" />
                    <span className="text-[10px] font-bold text-primary tracking-wider">PADRÕES DETECTADOS</span>
                  </div>
                  {analysis.patterns.map((pattern, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="bg-secondary/30 rounded p-2 flex items-start justify-between gap-2"
                    >
                      <div>
                        <p className="text-[10px] font-bold text-foreground">{pattern.name}</p>
                        <p className="text-[9px] text-muted-foreground mt-0.5">{pattern.description}</p>
                      </div>
                      <div className="shrink-0">
                        <div className="text-[9px] font-mono text-primary">
                          {(pattern.confidence * 100).toFixed(0)}%
                        </div>
                        <div className="w-10 h-1 bg-secondary rounded-full overflow-hidden mt-0.5">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${pattern.confidence * 100}%` }}
                          />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Suggestions */}
              {analysis.suggestions?.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Target className="w-3 h-3 text-accent" />
                    <span className="text-[10px] font-bold text-accent tracking-wider">SUGESTÕES DE APOSTA</span>
                  </div>
                  {analysis.suggestions.map((sug, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.15 }}
                      className="bg-secondary/30 rounded p-2 space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-foreground flex items-center gap-1">
                          <Zap className="w-3 h-3" />
                          {sug.bet}
                        </span>
                        <span className={`text-[8px] px-1.5 py-0.5 rounded border font-bold uppercase ${riskColor(sug.risk)}`}>
                          <Shield className="w-2.5 h-2.5 inline mr-0.5" />
                          {sug.risk}
                        </span>
                      </div>
                      <p className="text-[9px] text-muted-foreground">{sug.reason}</p>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Footer */}
              <div className="text-[8px] text-muted-foreground text-center pt-1 border-t border-border">
                Analisado com {history.length} números • DeepSeek AI • Última: {new Date().toLocaleTimeString('pt-BR')}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AIAnalysis;
