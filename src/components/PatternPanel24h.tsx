import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Zap, Target, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

interface PatternPanel24hProps { sniperData: any; }

const MODE_CONFIG: Record<string, { icon: string; color: string; bg: string; border: string }> = {
  'REPETIÇÃO': { icon: '🔁', color: 'text-neon-cyan', bg: 'bg-neon-cyan/8', border: 'border-neon-cyan/20' },
  'ALTERNÂNCIA': { icon: '🔄', color: 'text-gold', bg: 'bg-gold/8', border: 'border-gold/20' },
  'CAOS': { icon: '🌪️', color: 'text-destructive', bg: 'bg-destructive/8', border: 'border-destructive/20' },
};

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  streak: { label: 'SEQUÊNCIA', color: 'text-red-400' },
  alternancia: { label: 'ALTERNÂNCIA', color: 'text-gold' },
  concentracao: { label: 'CONCENTRAÇÃO', color: 'text-neon-cyan' },
  gap: { label: 'AUSÊNCIA', color: 'text-neon-cyan' },
  terminal: { label: 'TERMINAL', color: 'text-purple-400' },
  rotacao: { label: 'ROTAÇÃO', color: 'text-neon-green' },
};

const PatternPanel24h = ({ sniperData }: PatternPanel24hProps) => {
  const tm = sniperData?.transitionMatrix;
  const [showAllFidelity, setShowAllFidelity] = useState(false);
  if (!tm) return null;

  const modeLabel = tm.mesaModeLabel || 'CAOS';
  const modeConf = MODE_CONFIG[modeLabel] || MODE_CONFIG['CAOS'];
  const fidelity = tm.patternsFidelity || [];
  const detectedPatterns = tm.detectedPatterns || [];

  const sortedFidelity = [...fidelity].sort((a: any, b: any) => b.fidelity - a.fidelity);
  const visibleFidelity = showAllFidelity ? sortedFidelity : sortedFidelity.slice(0, 10);

  return (
    <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl overflow-hidden border border-border/20 space-y-0">
      {/* Header */}
      <div className="relative px-4 pt-4 pb-3">
        <div className="absolute inset-0 bg-gradient-to-r from-neon-cyan/4 via-transparent to-purple-500/3" />
        <div className="relative flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-neon-cyan/15 to-purple-500/10 border border-neon-cyan/20 flex items-center justify-center shadow-neon-cyan">
            <Activity className="w-4 h-4 text-neon-cyan" />
          </div>
          <div className="flex-1">
            <span className="font-display text-[10px] tracking-[0.15em] font-bold text-neon-cyan uppercase">Padrões 24H</span>
            <div className="text-[7px] text-muted-foreground/50 font-mono">Matriz de transição ativa</div>
          </div>
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-display font-bold border backdrop-blur-sm ${modeConf.bg} ${modeConf.border} ${modeConf.color}`}>
            <span className="text-sm">{modeConf.icon}</span>
            MODO {modeLabel}
            <span className="font-mono text-[8px] opacity-60">{tm.mesaModeStrength}%</span>
          </div>
        </div>
      </div>

      <div className="px-4 pb-4 space-y-3">

      {/* Detected Patterns */}
      {detectedPatterns.length > 0 && (
        <div>
          <span className="text-[8px] font-bold text-muted-foreground/50 block mb-1.5">🔍 PADRÕES ATIVOS ({detectedPatterns.length})</span>
          <div className="space-y-1.5">
            {detectedPatterns.slice(0, 8).map((dp: any, i: number) => {
              const catConf = CATEGORY_LABELS[dp.category] || { label: dp.category, color: 'text-muted-foreground/50' };
              return (
                <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                  className={`rounded-lg p-2.5 border backdrop-blur-sm ${
                    dp.confidence >= 80 ? 'bg-neon-cyan/5 border-neon-cyan/20' : dp.confidence >= 60 ? 'bg-gold/5 border-gold/15' : 'bg-background/15 border-border/15'
                  }`}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{dp.emoji}</span>
                    <span className="text-[9px] font-bold text-foreground/80 flex-1">{dp.name}</span>
                    <span className={`text-[7px] font-bold px-1.5 py-0.5 rounded ${catConf.color} bg-background/20`}>{catConf.label}</span>
                    <span className={`text-[9px] font-mono font-bold ${
                      dp.confidence >= 80 ? 'text-neon-cyan' : dp.confidence >= 60 ? 'text-gold' : 'text-muted-foreground/50'
                    }`}>{dp.confidence}%</span>
                  </div>
                  <p className="text-[8px] text-muted-foreground/50 mt-1 leading-relaxed">{dp.description}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <Target className="w-2.5 h-2.5 text-neon-cyan" />
                    <span className="text-[8px] font-bold text-neon-cyan">{dp.action}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Transition Predictions */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'PRÓXIMO SETOR', value: tm.predictedSector },
          { label: 'PRÓXIMA DÚZIA', value: tm.predictedDozen ? `D${tm.predictedDozen}` : null },
          { label: 'PRÓXIMO TERMINAL', value: tm.predictedTerminal !== null && tm.predictedTerminal !== undefined ? `T${tm.predictedTerminal}` : null },
        ].map(item => (
          <div key={item.label} className="bg-background/15 rounded-lg p-2.5 border border-border/10 text-center backdrop-blur-sm">
            <span className="text-[7px] text-muted-foreground/40 font-bold block mb-1">{item.label}</span>
            {item.value ? <span className="text-xs font-bold text-neon-cyan">{item.value}</span> : <span className="text-[9px] text-muted-foreground/30">—</span>}
          </div>
        ))}
      </div>

      {/* Dozen Pressure */}
      {tm.dozenPressureTrigger?.active && (
        <div className="bg-gradient-to-r from-destructive/8 to-orange-500/5 border border-destructive/20 rounded-lg p-2.5 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-destructive" />
            <span className="text-[9px] font-bold text-destructive">🔥 GATILHO DE PRESSÃO DE RETORNO</span>
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-[9px]">
            <span className="text-muted-foreground/50">Dúzia <strong className="text-foreground/70">{tm.dozenPressureTrigger.dozen}</strong></span>
            <span className="text-muted-foreground/20">•</span>
            <span className="text-destructive font-bold">{tm.dozenPressureTrigger.delay} giros ausente</span>
            <span className="text-muted-foreground/20">•</span>
            <span className="text-muted-foreground/50">Dominou <strong className="text-foreground/70">{tm.dozenPressureTrigger.historicalDominance}%</strong> em 500</span>
          </div>
        </div>
      )}

      {/* Pattern Fidelity */}
      {visibleFidelity.length > 0 && (
        <div>
          <span className="text-[8px] font-bold text-muted-foreground/50 block mb-1.5">FIDELIDADE DOS PADRÕES (últimas 50 rodadas)</span>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5">
            {visibleFidelity.map((pf: any, i: number) => (
              <div key={i} className={`rounded-lg p-2 border text-center backdrop-blur-sm ${
                pf.fidelity >= 40 ? 'bg-neon-cyan/5 border-neon-cyan/15' : pf.fidelity >= 25 ? 'bg-background/15 border-border/15' : 'bg-background/10 border-border/10 opacity-50'
              }`}>
                <span className="text-sm block">{pf.emoji}</span>
                <span className="text-[7px] font-bold text-foreground/70 block truncate">{pf.name}</span>
                <div className="flex items-center gap-1 mt-1">
                  <div className="flex-1 h-1 bg-background/20 rounded-full overflow-hidden border border-border/5">
                    <div className={`h-full rounded-full ${
                      pf.fidelity >= 40 ? 'bg-neon-cyan' : pf.fidelity >= 25 ? 'bg-gold' : 'bg-muted-foreground/30'
                    }`} style={{ width: `${Math.min(100, pf.fidelity)}%` }} />
                  </div>
                  <span className="text-[7px] font-mono font-bold text-foreground/60">{pf.fidelity}%</span>
                </div>
                <span className="text-[6px] text-muted-foreground/30">{pf.confirmed}/{pf.total}</span>
              </div>
            ))}
          </div>
          {sortedFidelity.length > 10 && (
            <button onClick={() => setShowAllFidelity(!showAllFidelity)}
              className="flex items-center gap-1 mx-auto mt-2 text-[8px] text-neon-cyan font-bold hover:underline">
              {showAllFidelity ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {showAllFidelity ? 'Mostrar menos' : `Ver todos (${sortedFidelity.length})`}
            </button>
          )}
        </div>
      )}

      {/* Sector Transition Matrix */}
      {tm.sectorMatrix && (
        <div>
          <span className="text-[8px] font-bold text-muted-foreground/50 block mb-1.5">MATRIZ DE TRANSIÇÃO (Setores)</span>
          <div className="overflow-x-auto">
            <table className="w-full text-[8px]">
              <thead>
                <tr>
                  <th className="text-left text-muted-foreground/40 p-1">De ↓ / Para →</th>
                  <th className="text-center text-muted-foreground/40 p-1">Voisins</th>
                  <th className="text-center text-muted-foreground/40 p-1">Tiers</th>
                  <th className="text-center text-muted-foreground/40 p-1">Orphelins</th>
                </tr>
              </thead>
              <tbody>
                {['Voisins', 'Tiers', 'Orphelins'].map(from => {
                  const row = tm.sectorMatrix[from] || {};
                  const total = Object.values(row).reduce((a: number, b: any) => a + (b as number), 0) as number;
                  return (
                    <tr key={from} className="border-t border-border/10">
                      <td className="p-1 font-bold text-foreground/60">{from}</td>
                      {['Voisins', 'Tiers', 'Orphelins'].map(to => {
                        const count = (row[to] as number) || 0;
                        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                        const isMax = total > 0 && count === Math.max(...Object.values(row).map(v => v as number));
                        return (
                          <td key={to} className={`p-1 text-center font-mono ${isMax ? 'text-neon-cyan font-bold' : 'text-foreground/40'}`}>{pct}%</td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </div>
    </motion.div>
  );
};

export default PatternPanel24h;
