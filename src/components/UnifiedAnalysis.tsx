import { memo, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { runFullAnalysis, type FullAnalysis } from '@/lib/analysis-engine';
import { TrendingUp, TrendingDown, Minus, Shield, AlertTriangle, Zap, BarChart3, Activity, Target, Eye } from 'lucide-react';

const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const numBg = (n: number) => n === 0 ? 'bg-emerald-600' : RED_NUMBERS.has(n) ? 'bg-red-600' : 'bg-zinc-800';

interface Props { sniperData: any; allNumbers: number[] }

const TrendArrow = ({ dir }: { dir: 'up' | 'down' | 'neutral' }) => {
  if (dir === 'up') return <TrendingUp className="w-3 h-3 text-neon-green" />;
  if (dir === 'down') return <TrendingDown className="w-3 h-3 text-destructive" />;
  return <Minus className="w-3 h-3 text-muted-foreground/30" />;
};

const ConfidenceBar = ({ value, size = 'sm' }: { value: number; size?: 'sm' | 'lg' }) => {
  const color = value >= 75 ? 'bg-neon-green' : value >= 50 ? 'bg-gold' : 'bg-destructive';
  const h = size === 'lg' ? 'h-2.5' : 'h-1.5';
  return (
    <div className={`w-full ${h} bg-background/20 rounded-full overflow-hidden border border-border/10`}>
      <motion.div initial={{ width: 0 }} animate={{ width: `${value}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} className={`h-full ${color} rounded-full`} />
    </div>
  );
};

const MomentumGauge = ({ value }: { value: number }) => {
  const rotation = (value / 100) * 90;
  const color = value > 20 ? 'text-neon-green' : value < -20 ? 'text-destructive' : 'text-gold';
  return (
    <div className="flex items-center gap-1.5">
      <div className="relative w-6 h-6">
        <div className="absolute inset-0 rounded-full border border-border/20" />
        <motion.div initial={{ rotate: 0 }} animate={{ rotate: rotation }}
          className={`absolute top-1/2 left-1/2 w-0.5 h-2.5 ${color.replace('text-', 'bg-')} rounded origin-bottom`}
          style={{ transformOrigin: 'bottom center', marginLeft: '-1px', marginTop: '-10px' }} />
      </div>
      <span className={`text-[8px] font-mono font-bold ${color}`}>{value > 0 ? '+' : ''}{value}</span>
    </div>
  );
};

const UnifiedAnalysis = memo(({ sniperData, allNumbers }: Props) => {
  const [expandedSection, setExpandedSection] = useState<string | null>('top5');
  const analysis = useMemo(() => runFullAnalysis(allNumbers), [allNumbers]);

  const finalTop5 = useMemo(() => {
    if (!analysis) return [];
    const engineTop5 = analysis.top5;
    if (sniperData?.fusionTop5?.length > 0) {
      const merged: Record<number, { score: number; sources: Set<string> }> = {};
      engineTop5.forEach(t => { merged[t.number] = { score: t.score, sources: new Set(t.sources) }; });
      sniperData.fusionTop5.forEach((t: any) => {
        if (!merged[t.number]) merged[t.number] = { score: 0, sources: new Set() };
        merged[t.number].score += (t.score || 3);
        merged[t.number].sources.add('IA Backend');
      });
      return Object.entries(merged).map(([n, d]) => ({ number: Number(n), score: Math.round(d.score * 10) / 10, sources: Array.from(d.sources) })).sort((a, b) => b.score - a.score).slice(0, 5);
    }
    return engineTop5;
  }, [analysis, sniperData?.fusionTop5]);

  if (!analysis) {
    return (
      <div className="glass rounded-xl p-6 text-center">
        <Activity className="w-5 h-5 text-muted-foreground/20 mx-auto mb-2 animate-pulse" />
        <p className="text-[10px] text-muted-foreground/40">Aguardando dados suficientes para análise completa...</p>
      </div>
    );
  }

  const toggle = (section: string) => setExpandedSection(expandedSection === section ? null : section);
  const pred = analysis.prediction;

  return (
    <div className="space-y-2">
      {/* ALERT */}
      {pred.alerta && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-destructive/6 border border-destructive/20 backdrop-blur-sm">
          <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
          <span className="text-[9px] font-bold text-destructive">{pred.alerta}</span>
        </motion.div>
      )}

      {/* TOP 5 */}
      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
        className="glass rounded-xl border border-neon-cyan/20 p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-neon-cyan/5 via-transparent to-neon-pink/3" />
        <button onClick={() => toggle('top5')} className="relative w-full flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-neon-cyan/15 to-neon-pink/10 border border-neon-cyan/20 flex items-center justify-center shadow-neon-cyan">
            <Target className="w-3.5 h-3.5 text-neon-cyan" />
          </div>
          <span className="text-[10px] font-black text-neon-cyan uppercase tracking-wider flex-1 text-left">TOP 5 — Convergência Final</span>
          <span className="text-[8px] font-mono text-neon-cyan bg-neon-cyan/8 px-2 py-0.5 rounded border border-neon-cyan/15">{pred.confianca}% conf</span>
        </button>

        <div className="relative flex justify-center gap-3 mb-3">
          {finalTop5.map((item, i) => (
            <motion.div key={item.number} initial={{ scale: 0, y: 10 }} animate={{ scale: 1, y: 0 }} transition={{ delay: i * 0.1, type: 'spring', stiffness: 200 }} className="text-center">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black text-white shadow-lg transition-all ${numBg(item.number)} ${
                i === 0 ? 'ring-2 ring-neon-cyan ring-offset-2 ring-offset-background scale-110 shadow-neon-cyan' : ''
              }`}>{item.number}</div>
              <div className="text-[8px] font-mono text-neon-cyan mt-1">{item.score}pts</div>
              <div className="text-[6px] text-muted-foreground/40">#{i + 1}</div>
            </motion.div>
          ))}
          {finalTop5.length === 0 && <div className="text-[9px] text-muted-foreground/30 py-4">Sem convergência suficiente</div>}
        </div>

        {finalTop5.length > 0 && expandedSection === 'top5' && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="relative space-y-1">
            {finalTop5.map(item => (
              <div key={item.number} className="flex items-center gap-2 text-[7px] text-muted-foreground/50">
                <div className={`w-5 h-5 rounded flex items-center justify-center text-[7px] font-bold text-white ${numBg(item.number)}`}>{item.number}</div>
                <span>←</span>
                <div className="flex gap-1 flex-wrap">
                  {item.sources.map(s => <span key={s} className="px-1.5 py-0.5 rounded bg-background/15 border border-border/10">{s}</span>)}
                </div>
              </div>
            ))}
          </motion.div>
        )}

        <div className="relative mt-2 text-[7px] text-muted-foreground/40 text-center">
          {pred.sugestao_aposta === 'AGRESSIVA' ? '🟢' : pred.sugestao_aposta === 'MODERADA' ? '🟡' : '🔴'} Aposta: {pred.sugestao_aposta} · Tendência: {pred.tendencia_atual}
        </div>
      </motion.div>

      {/* CONFIANÇA & RISCO */}
      <div className="grid grid-cols-2 gap-2">
        <div className="glass rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <Eye className="w-3 h-3 text-neon-cyan" />
            <span className="text-[8px] font-black text-muted-foreground/60 uppercase">Confiança</span>
          </div>
          <ConfidenceBar value={analysis.overallConfidence} size="lg" />
          <div className="grid grid-cols-2 gap-1">
            <div className="text-center">
              <div className="text-[7px] text-muted-foreground/40">Padrões</div>
              <div className="text-[10px] font-black text-foreground/80">{analysis.patternStrength}%</div>
            </div>
            <div className="text-center">
              <div className="text-[7px] text-muted-foreground/40">Consistência</div>
              <div className="text-[10px] font-black text-foreground/80">{analysis.dataConsistency}%</div>
            </div>
          </div>
        </div>

        <div className="glass rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <Shield className="w-3 h-3 text-gold" />
            <span className="text-[8px] font-black text-muted-foreground/60 uppercase">Risco</span>
          </div>
          <div className={`text-center py-1 rounded-lg text-[10px] font-black ${
            analysis.risk.suggestion === 'CONSERVADORA' ? 'bg-destructive/6 text-destructive border border-destructive/10' :
            analysis.risk.suggestion === 'AGRESSIVA' ? 'bg-neon-green/6 text-neon-green border border-neon-green/10' :
            'bg-gold/6 text-gold border border-gold/10'
          }`}>{analysis.risk.suggestion}</div>
          <div className="grid grid-cols-2 gap-1 text-center">
            <div><div className="text-[7px] text-muted-foreground/40">Kelly</div><div className="text-[9px] font-mono font-bold text-foreground/70">{(analysis.risk.kellyFraction * 100).toFixed(0)}%</div></div>
            <div><div className="text-[7px] text-muted-foreground/40">Martingale</div><div className="text-[9px] font-mono font-bold text-foreground/70">Nv.{analysis.risk.martingaleLevel}</div></div>
          </div>
        </div>
      </div>

      {/* ESTATÍSTICAS */}
      <div className="glass rounded-xl overflow-hidden">
        <button onClick={() => toggle('stats')} className="w-full flex items-center gap-2 p-3">
          <BarChart3 className="w-3.5 h-3.5 text-neon-cyan" />
          <span className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-wider flex-1 text-left">Estatísticas Avançadas</span>
          <span className="text-[7px] text-muted-foreground/30">{expandedSection === 'stats' ? '▲' : '▼'}</span>
        </button>
        <AnimatePresence>
          {expandedSection === 'stats' && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
              <div className="px-3 pb-3 space-y-3">
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { label: 'Volatilidade', value: `${analysis.volatilityIndex}`, color: analysis.volatilityIndex > 60 ? 'text-destructive' : 'text-neon-green' },
                    { label: 'Desvio Pad.', value: `${analysis.standardDeviation}`, color: 'text-foreground/70' },
                    { label: 'Média Móvel', value: `${analysis.movingAverage}`, color: 'text-foreground/70' },
                    { label: 'Streaks', value: `${analysis.streaks.length}`, color: analysis.streaks.length > 2 ? 'text-gold' : 'text-foreground/70' },
                  ].map(m => (
                    <div key={m.label} className="bg-background/15 rounded-lg p-2 text-center border border-border/10 backdrop-blur-sm">
                      <div className="text-[6px] text-muted-foreground/40 uppercase">{m.label}</div>
                      <div className={`text-[11px] font-black font-mono ${m.color}`}>{m.value}</div>
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5">
                  {[
                    { label: '🔴 Vermelho', a: analysis.colorDistribution.red, b: analysis.colorDistribution.black, bLabel: '⚫ Preto', aColor: 'bg-red-500', bColor: 'bg-zinc-700' },
                    { label: 'Par', a: analysis.parityDistribution.even, b: analysis.parityDistribution.odd, bLabel: 'Ímpar', aColor: 'bg-neon-cyan', bColor: 'bg-purple-500' },
                    { label: 'Alto', a: analysis.highLowDistribution.high, b: analysis.highLowDistribution.low, bLabel: 'Baixo', aColor: 'bg-gold', bColor: 'bg-neon-cyan' },
                  ].map(d => {
                    const total = d.a + d.b;
                    const pct = total > 0 ? Math.round(d.a / total * 100) : 50;
                    return (
                      <div key={d.label} className="flex items-center gap-2">
                        <span className="text-[7px] text-muted-foreground/50 w-12 text-right">{d.label}</span>
                        <div className="flex-1 h-3 bg-background/15 rounded-full overflow-hidden flex border border-border/5">
                          <div className={`${d.aColor} h-full transition-all`} style={{ width: `${pct}%` }} />
                          <div className={`${d.bColor} h-full transition-all`} style={{ width: `${100 - pct}%` }} />
                        </div>
                        <span className="text-[7px] text-muted-foreground/50 w-12">{d.bLabel}</span>
                        <span className="text-[7px] font-mono font-bold text-foreground/60 w-8">{pct}%</span>
                      </div>
                    );
                  })}
                </div>

                {analysis.streaks.length > 0 && (
                  <div>
                    <div className="text-[7px] font-bold text-muted-foreground/40 uppercase mb-1">Sequências Ativas</div>
                    <div className="flex gap-1 flex-wrap">
                      {analysis.streaks.map((s, i) => (
                        <span key={i} className="px-2 py-1 rounded-lg bg-gold/6 border border-gold/15 text-[8px] font-bold text-gold">{s.length}× {s.value} ({s.type})</span>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <div className="text-[7px] font-bold text-muted-foreground/40 uppercase mb-1">Números Atrasados (Overdue)</div>
                  <div className="flex gap-1 flex-wrap">
                    {analysis.gaps.filter(g => g.overdue).slice(0, 8).map(g => (
                      <div key={g.number} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-neon-cyan/5 border border-neon-cyan/10">
                        <div className={`w-5 h-5 rounded flex items-center justify-center text-[7px] font-bold text-white ${numBg(g.number)}`}>{g.number}</div>
                        <span className="text-[7px] font-mono text-neon-cyan">{g.gap}r</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* PADRÕES */}
      <div className="glass rounded-xl overflow-hidden">
        <button onClick={() => toggle('patterns')} className="w-full flex items-center gap-2 p-3">
          <Zap className="w-3.5 h-3.5 text-gold" />
          <span className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-wider flex-1 text-left">Padrões Detectados ({analysis.patterns.length})</span>
          <span className="text-[7px] text-muted-foreground/30">{expandedSection === 'patterns' ? '▲' : '▼'}</span>
        </button>
        <AnimatePresence>
          {expandedSection === 'patterns' && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
              <div className="px-3 pb-3 space-y-1.5">
                {analysis.patterns.map((p, i) => (
                  <motion.div key={p.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                    className={`rounded-lg border p-2.5 backdrop-blur-sm ${
                      p.strength >= 75 ? 'bg-neon-cyan/3 border-neon-cyan/15' : p.strength >= 50 ? 'bg-background/15 border-border/15' : 'bg-background/10 border-border/10'
                    }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold ${
                        p.type === 'recovery' ? 'bg-neon-green/8 text-neon-green' : p.type === 'cycle' ? 'bg-purple-500/8 text-purple-400' :
                        p.type === 'cluster' ? 'bg-neon-cyan/8 text-neon-cyan' : p.type === 'alternation' ? 'bg-gold/8 text-gold' : 'bg-background/15 text-muted-foreground/50'
                      }`}>{p.type}</span>
                      <span className="text-[9px] font-bold text-foreground/70 flex-1">{p.name}</span>
                      <span className={`text-[8px] font-mono font-bold ${p.strength >= 75 ? 'text-neon-green' : p.strength >= 50 ? 'text-gold' : 'text-muted-foreground/40'}`}>{p.strength}%</span>
                    </div>
                    <p className="text-[7px] text-muted-foreground/50 mb-1.5">{p.description}</p>
                    <div className="flex gap-0.5">
                      {p.suggestedNumbers.slice(0, 6).map(n => (
                        <div key={n} className={`w-5 h-5 rounded flex items-center justify-center text-[7px] font-bold text-white ${numBg(n)}`}>{n}</div>
                      ))}
                      {p.suggestedNumbers.length > 6 && <div className="w-5 h-5 rounded flex items-center justify-center text-[6px] font-bold text-muted-foreground/30 bg-background/10">+{p.suggestedNumbers.length - 6}</div>}
                    </div>
                  </motion.div>
                ))}
                {analysis.patterns.length === 0 && <div className="text-center py-4 text-[9px] text-muted-foreground/30">Nenhum padrão forte detectado</div>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* TENDÊNCIAS */}
      <div className="glass rounded-xl overflow-hidden">
        <button onClick={() => toggle('trends')} className="w-full flex items-center gap-2 p-3">
          <Activity className="w-3.5 h-3.5 text-neon-green" />
          <span className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-wider flex-1 text-left">Tendências</span>
          <span className="text-[7px] text-muted-foreground/30">{expandedSection === 'trends' ? '▲' : '▼'}</span>
        </button>
        <AnimatePresence>
          {expandedSection === 'trends' && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
              <div className="px-3 pb-3 space-y-2">
                {analysis.trends.map(t => (
                  <div key={t.category} className="flex items-center gap-2 p-2 rounded-lg bg-background/10 border border-border/10 backdrop-blur-sm">
                    <span className="text-[8px] font-bold text-foreground/60 w-20 truncate">{t.category}</span>
                    <div className="flex-1 flex items-center gap-3">
                      {['shortTerm', 'mediumTerm', 'longTerm'].map((term, i) => (
                        <div key={term} className="text-center">
                          <div className="text-[6px] text-muted-foreground/30">{['Curto', 'Médio', 'Longo'][i]}</div>
                          <TrendArrow dir={t[term as keyof typeof t] as 'up' | 'down' | 'neutral'} />
                        </div>
                      ))}
                    </div>
                    <MomentumGauge value={t.momentum} />
                    <div className="text-center">
                      <div className="text-[6px] text-muted-foreground/30">Reversão</div>
                      <div className={`text-[8px] font-mono font-bold ${t.reversalRisk > 50 ? 'text-destructive' : 'text-neon-green'}`}>{t.reversalRisk}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="text-[6px] text-muted-foreground/20 text-center px-4 leading-relaxed">
        ⚠️ Roleta é um jogo de sorte; nenhum sistema garante lucro. Use apenas para entretenimento e estudo.
      </div>
    </div>
  );
});

UnifiedAnalysis.displayName = 'UnifiedAnalysis';
export default UnifiedAnalysis;
