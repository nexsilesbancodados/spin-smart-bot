import { memo, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { runFullAnalysis, type FullAnalysis } from '@/lib/analysis-engine';
import { TrendingUp, TrendingDown, Minus, Shield, AlertTriangle, Zap, BarChart3, Activity, Target, Eye } from 'lucide-react';

const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const numBg = (n: number) => n === 0 ? 'bg-emerald-600' : RED_NUMBERS.has(n) ? 'bg-red-600' : 'bg-zinc-800';

interface Props {
  sniperData: any;
  allNumbers: number[];
}

const TrendArrow = ({ dir }: { dir: 'up' | 'down' | 'neutral' }) => {
  if (dir === 'up') return <TrendingUp className="w-3 h-3 text-green-400" />;
  if (dir === 'down') return <TrendingDown className="w-3 h-3 text-red-400" />;
  return <Minus className="w-3 h-3 text-muted-foreground" />;
};

const ConfidenceBar = ({ value, size = 'sm' }: { value: number; size?: 'sm' | 'lg' }) => {
  const color = value >= 75 ? 'bg-green-500' : value >= 50 ? 'bg-amber-500' : 'bg-red-500';
  const h = size === 'lg' ? 'h-2.5' : 'h-1.5';
  return (
    <div className={`w-full ${h} bg-secondary rounded-full overflow-hidden`}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className={`h-full ${color} rounded-full`}
      />
    </div>
  );
};

const MomentumGauge = ({ value }: { value: number }) => {
  const rotation = (value / 100) * 90; // -90 to +90
  const color = value > 20 ? 'text-green-400' : value < -20 ? 'text-red-400' : 'text-amber-400';
  return (
    <div className="flex items-center gap-1.5">
      <div className="relative w-6 h-6">
        <div className="absolute inset-0 rounded-full border border-border" />
        <motion.div
          initial={{ rotate: 0 }}
          animate={{ rotate: rotation }}
          className={`absolute top-1/2 left-1/2 w-0.5 h-2.5 ${color.replace('text-', 'bg-')} rounded origin-bottom`}
          style={{ transformOrigin: 'bottom center', marginLeft: '-1px', marginTop: '-10px' }}
        />
      </div>
      <span className={`text-[8px] font-mono font-bold ${color}`}>{value > 0 ? '+' : ''}{value}</span>
    </div>
  );
};

const UnifiedAnalysis = memo(({ sniperData, allNumbers }: Props) => {
  const [expandedSection, setExpandedSection] = useState<string | null>('top5');
  
  const analysis = useMemo(() => runFullAnalysis(allNumbers), [allNumbers]);

  // Merge backend top5 if available
  const finalTop5 = useMemo(() => {
    if (!analysis) return [];
    const engineTop5 = analysis.top5;
    if (sniperData?.fusionTop5?.length > 0) {
      // Merge scores: add backend scores to engine scores
      const merged: Record<number, { score: number; sources: Set<string> }> = {};
      engineTop5.forEach(t => {
        merged[t.number] = { score: t.score, sources: new Set(t.sources) };
      });
      sniperData.fusionTop5.forEach((t: any) => {
        if (!merged[t.number]) merged[t.number] = { score: 0, sources: new Set() };
        merged[t.number].score += (t.score || 3);
        merged[t.number].sources.add('IA Backend');
      });
      return Object.entries(merged)
        .map(([n, d]) => ({ number: Number(n), score: Math.round(d.score * 10) / 10, sources: Array.from(d.sources) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
    }
    return engineTop5;
  }, [analysis, sniperData?.fusionTop5]);

  if (!analysis) {
    return (
      <div className="bg-card rounded-xl border border-border p-6 text-center">
        <Activity className="w-5 h-5 text-muted-foreground mx-auto mb-2 animate-pulse" />
        <p className="text-[10px] text-muted-foreground">Aguardando dados suficientes para análise completa...</p>
      </div>
    );
  }

  const toggle = (section: string) => setExpandedSection(expandedSection === section ? null : section);
  const pred = analysis.prediction;

  return (
    <div className="space-y-2">

      {/* ══ ALERT BANNER ═══════════════════════════════════════════════ */}
      {pred.alerta && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-destructive/10 border border-destructive/30"
        >
          <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
          <span className="text-[9px] font-bold text-destructive">{pred.alerta}</span>
        </motion.div>
      )}

      {/* ══ TOP 5 CONVERGÊNCIA ═════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gradient-to-br from-primary/10 via-card to-card rounded-xl border-2 border-primary/30 p-4"
      >
        <button onClick={() => toggle('top5')} className="w-full flex items-center gap-2 mb-3">
          <Target className="w-4 h-4 text-primary" />
          <span className="text-[10px] font-black text-primary uppercase tracking-wider flex-1 text-left">
            TOP 5 — Convergência Final
          </span>
          <span className="text-[8px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded">
            {pred.confianca}% conf
          </span>
        </button>

        <div className="flex justify-center gap-3 mb-3">
          {finalTop5.map((item, i) => (
            <motion.div
              key={item.number}
              initial={{ scale: 0, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ delay: i * 0.1, type: 'spring', stiffness: 200 }}
              className="text-center"
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black text-white shadow-lg transition-all ${numBg(item.number)} ${
                i === 0 ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-110' : ''
              }`}>
                {item.number}
              </div>
              <div className="text-[8px] font-mono text-primary mt-1">{item.score}pts</div>
              <div className="text-[6px] text-muted-foreground">#{i + 1}</div>
            </motion.div>
          ))}
          {finalTop5.length === 0 && (
            <div className="text-[9px] text-muted-foreground py-4">Sem convergência suficiente</div>
          )}
        </div>

        {/* Sources */}
        {finalTop5.length > 0 && expandedSection === 'top5' && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-1">
            {finalTop5.map(item => (
              <div key={item.number} className="flex items-center gap-2 text-[7px] text-muted-foreground">
                <div className={`w-5 h-5 rounded flex items-center justify-center text-[7px] font-bold text-white ${numBg(item.number)}`}>{item.number}</div>
                <span>←</span>
                <div className="flex gap-1 flex-wrap">
                  {item.sources.map(s => (
                    <span key={s} className="px-1.5 py-0.5 rounded bg-secondary border border-border/30">{s}</span>
                  ))}
                </div>
              </div>
            ))}
          </motion.div>
        )}

        <div className="mt-2 text-[7px] text-muted-foreground text-center">
          {pred.sugestao_aposta === 'AGRESSIVA' ? '🟢' : pred.sugestao_aposta === 'MODERADA' ? '🟡' : '🔴'} Aposta: {pred.sugestao_aposta} · Tendência: {pred.tendencia_atual}
        </div>
      </motion.div>

      {/* ══ CONFIANÇA & RISCO ══════════════════════════════════════════ */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-card rounded-xl border border-border p-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <Eye className="w-3 h-3 text-primary" />
            <span className="text-[8px] font-black text-muted-foreground uppercase">Confiança</span>
          </div>
          <ConfidenceBar value={analysis.overallConfidence} size="lg" />
          <div className="grid grid-cols-2 gap-1">
            <div className="text-center">
              <div className="text-[7px] text-muted-foreground">Padrões</div>
              <div className="text-[10px] font-black text-foreground">{analysis.patternStrength}%</div>
            </div>
            <div className="text-center">
              <div className="text-[7px] text-muted-foreground">Consistência</div>
              <div className="text-[10px] font-black text-foreground">{analysis.dataConsistency}%</div>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <Shield className="w-3 h-3 text-amber-400" />
            <span className="text-[8px] font-black text-muted-foreground uppercase">Risco</span>
          </div>
          <div className={`text-center py-1 rounded-lg text-[10px] font-black ${
            analysis.risk.suggestion === 'CONSERVADORA' ? 'bg-red-500/10 text-red-400' :
            analysis.risk.suggestion === 'AGRESSIVA' ? 'bg-green-500/10 text-green-400' :
            'bg-amber-500/10 text-amber-400'
          }`}>{analysis.risk.suggestion}</div>
          <div className="grid grid-cols-2 gap-1 text-center">
            <div>
              <div className="text-[7px] text-muted-foreground">Kelly</div>
              <div className="text-[9px] font-mono font-bold text-foreground">{(analysis.risk.kellyFraction * 100).toFixed(0)}%</div>
            </div>
            <div>
              <div className="text-[7px] text-muted-foreground">Martingale</div>
              <div className="text-[9px] font-mono font-bold text-foreground">Nv.{analysis.risk.martingaleLevel}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ══ ESTATÍSTICAS AVANÇADAS ═════════════════════════════════════ */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <button onClick={() => toggle('stats')} className="w-full flex items-center gap-2 p-3">
          <BarChart3 className="w-3.5 h-3.5 text-primary" />
          <span className="text-[9px] font-black text-muted-foreground uppercase tracking-wider flex-1 text-left">Estatísticas Avançadas</span>
          <span className="text-[7px] text-muted-foreground">{expandedSection === 'stats' ? '▲' : '▼'}</span>
        </button>
        <AnimatePresence>
          {expandedSection === 'stats' && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
              <div className="px-3 pb-3 space-y-3">
                {/* Key metrics */}
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { label: 'Volatilidade', value: `${analysis.volatilityIndex}`, color: analysis.volatilityIndex > 60 ? 'text-red-400' : 'text-green-400' },
                    { label: 'Desvio Pad.', value: `${analysis.standardDeviation}`, color: 'text-foreground' },
                    { label: 'Média Móvel', value: `${analysis.movingAverage}`, color: 'text-foreground' },
                    { label: 'Streaks', value: `${analysis.streaks.length}`, color: analysis.streaks.length > 2 ? 'text-amber-400' : 'text-foreground' },
                  ].map(m => (
                    <div key={m.label} className="bg-secondary/50 rounded-lg p-2 text-center">
                      <div className="text-[6px] text-muted-foreground uppercase">{m.label}</div>
                      <div className={`text-[11px] font-black font-mono ${m.color}`}>{m.value}</div>
                    </div>
                  ))}
                </div>

                {/* Distribution bars */}
                <div className="space-y-1.5">
                  {[
                    { label: '🔴 Vermelho', a: analysis.colorDistribution.red, b: analysis.colorDistribution.black, bLabel: '⚫ Preto', aColor: 'bg-red-500', bColor: 'bg-zinc-700' },
                    { label: 'Par', a: analysis.parityDistribution.even, b: analysis.parityDistribution.odd, bLabel: 'Ímpar', aColor: 'bg-blue-500', bColor: 'bg-purple-500' },
                    { label: 'Alto', a: analysis.highLowDistribution.high, b: analysis.highLowDistribution.low, bLabel: 'Baixo', aColor: 'bg-amber-500', bColor: 'bg-cyan-500' },
                  ].map(d => {
                    const total = d.a + d.b;
                    const pct = total > 0 ? Math.round(d.a / total * 100) : 50;
                    return (
                      <div key={d.label} className="flex items-center gap-2">
                        <span className="text-[7px] text-muted-foreground w-12 text-right">{d.label}</span>
                        <div className="flex-1 h-3 bg-secondary rounded-full overflow-hidden flex">
                          <div className={`${d.aColor} h-full transition-all`} style={{ width: `${pct}%` }} />
                          <div className={`${d.bColor} h-full transition-all`} style={{ width: `${100 - pct}%` }} />
                        </div>
                        <span className="text-[7px] text-muted-foreground w-12">{d.bLabel}</span>
                        <span className="text-[7px] font-mono font-bold text-foreground w-8">{pct}%</span>
                      </div>
                    );
                  })}
                </div>

                {/* Active streaks */}
                {analysis.streaks.length > 0 && (
                  <div>
                    <div className="text-[7px] font-bold text-muted-foreground uppercase mb-1">Sequências Ativas</div>
                    <div className="flex gap-1 flex-wrap">
                      {analysis.streaks.map((s, i) => (
                        <span key={i} className="px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[8px] font-bold text-amber-400">
                          {s.length}× {s.value} ({s.type})
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Top overdue numbers */}
                <div>
                  <div className="text-[7px] font-bold text-muted-foreground uppercase mb-1">Números Atrasados (Overdue)</div>
                  <div className="flex gap-1 flex-wrap">
                    {analysis.gaps.filter(g => g.overdue).slice(0, 8).map(g => (
                      <div key={g.number} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">
                        <div className={`w-5 h-5 rounded flex items-center justify-center text-[7px] font-bold text-white ${numBg(g.number)}`}>{g.number}</div>
                        <span className="text-[7px] font-mono text-blue-400">{g.gap}r</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ══ PADRÕES DETECTADOS ═════════════════════════════════════════ */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <button onClick={() => toggle('patterns')} className="w-full flex items-center gap-2 p-3">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[9px] font-black text-muted-foreground uppercase tracking-wider flex-1 text-left">
            Padrões Detectados ({analysis.patterns.length})
          </span>
          <span className="text-[7px] text-muted-foreground">{expandedSection === 'patterns' ? '▲' : '▼'}</span>
        </button>
        <AnimatePresence>
          {expandedSection === 'patterns' && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
              <div className="px-3 pb-3 space-y-1.5">
                {analysis.patterns.map((p, i) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`rounded-lg border p-2.5 ${
                      p.strength >= 75 ? 'bg-primary/5 border-primary/25' :
                      p.strength >= 50 ? 'bg-card border-border/60' :
                      'bg-card border-border/30'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold ${
                        p.type === 'recovery' ? 'bg-green-500/10 text-green-400' :
                        p.type === 'cycle' ? 'bg-purple-500/10 text-purple-400' :
                        p.type === 'cluster' ? 'bg-blue-500/10 text-blue-400' :
                        p.type === 'alternation' ? 'bg-amber-500/10 text-amber-400' :
                        'bg-secondary text-muted-foreground'
                      }`}>{p.type}</span>
                      <span className="text-[9px] font-bold text-foreground flex-1">{p.name}</span>
                      <span className={`text-[8px] font-mono font-bold ${
                        p.strength >= 75 ? 'text-green-400' : p.strength >= 50 ? 'text-amber-400' : 'text-muted-foreground'
                      }`}>{p.strength}%</span>
                    </div>
                    <p className="text-[7px] text-muted-foreground mb-1.5">{p.description}</p>
                    <div className="flex gap-0.5">
                      {p.suggestedNumbers.slice(0, 6).map(n => (
                        <div key={n} className={`w-5 h-5 rounded flex items-center justify-center text-[7px] font-bold text-white ${numBg(n)}`}>{n}</div>
                      ))}
                      {p.suggestedNumbers.length > 6 && (
                        <div className="w-5 h-5 rounded flex items-center justify-center text-[6px] font-bold text-muted-foreground bg-secondary">+{p.suggestedNumbers.length - 6}</div>
                      )}
                    </div>
                  </motion.div>
                ))}
                {analysis.patterns.length === 0 && (
                  <div className="text-center py-4 text-[9px] text-muted-foreground">Nenhum padrão forte detectado no momento</div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ══ TENDÊNCIAS ═════════════════════════════════════════════════ */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <button onClick={() => toggle('trends')} className="w-full flex items-center gap-2 p-3">
          <Activity className="w-3.5 h-3.5 text-green-400" />
          <span className="text-[9px] font-black text-muted-foreground uppercase tracking-wider flex-1 text-left">Tendências</span>
          <span className="text-[7px] text-muted-foreground">{expandedSection === 'trends' ? '▲' : '▼'}</span>
        </button>
        <AnimatePresence>
          {expandedSection === 'trends' && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
              <div className="px-3 pb-3 space-y-2">
                {analysis.trends.map(t => (
                  <div key={t.category} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/30">
                    <span className="text-[8px] font-bold text-foreground w-20 truncate">{t.category}</span>
                    <div className="flex-1 flex items-center gap-3">
                      <div className="text-center">
                        <div className="text-[6px] text-muted-foreground">Curto</div>
                        <TrendArrow dir={t.shortTerm} />
                      </div>
                      <div className="text-center">
                        <div className="text-[6px] text-muted-foreground">Médio</div>
                        <TrendArrow dir={t.mediumTerm} />
                      </div>
                      <div className="text-center">
                        <div className="text-[6px] text-muted-foreground">Longo</div>
                        <TrendArrow dir={t.longTerm} />
                      </div>
                    </div>
                    <MomentumGauge value={t.momentum} />
                    <div className="text-center">
                      <div className="text-[6px] text-muted-foreground">Reversão</div>
                      <div className={`text-[8px] font-mono font-bold ${t.reversalRisk > 50 ? 'text-red-400' : 'text-green-400'}`}>{t.reversalRisk}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ══ DISCLAIMER ═════════════════════════════════════════════════ */}
      <div className="text-[6px] text-muted-foreground/50 text-center px-4 leading-relaxed">
        ⚠️ Roleta é um jogo de sorte; nenhum sistema garante lucro. Use apenas para entretenimento e estudo.
      </div>
    </div>
  );
});

UnifiedAnalysis.displayName = 'UnifiedAnalysis';
export default UnifiedAnalysis;