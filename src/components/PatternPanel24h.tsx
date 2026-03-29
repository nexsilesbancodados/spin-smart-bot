import { motion, AnimatePresence } from 'framer-motion';
import { Activity, TrendingUp, RefreshCw, Zap, Target, BarChart3, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

interface PatternPanel24hProps {
  sniperData: any;
}

const MODE_CONFIG: Record<string, { icon: string; color: string; bg: string; border: string }> = {
  'REPETIÇÃO': { icon: '🔁', color: 'text-blue-400', bg: 'bg-blue-500/15', border: 'border-blue-500/30' },
  'ALTERNÂNCIA': { icon: '🔄', color: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/30' },
  'CAOS': { icon: '🌪️', color: 'text-destructive', bg: 'bg-destructive/15', border: 'border-destructive/30' },
};

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  streak: { label: 'SEQUÊNCIA', color: 'text-red-400' },
  alternancia: { label: 'ALTERNÂNCIA', color: 'text-amber-400' },
  concentracao: { label: 'CONCENTRAÇÃO', color: 'text-blue-400' },
  gap: { label: 'AUSÊNCIA', color: 'text-cyan-400' },
  terminal: { label: 'TERMINAL', color: 'text-purple-400' },
  rotacao: { label: 'ROTAÇÃO', color: 'text-green-400' },
};

const PatternPanel24h = ({ sniperData }: PatternPanel24hProps) => {
  const tm = sniperData?.transitionMatrix;
  const [showAllFidelity, setShowAllFidelity] = useState(false);
  if (!tm) return null;

  const modeLabel = tm.mesaModeLabel || 'CAOS';
  const modeConf = MODE_CONFIG[modeLabel] || MODE_CONFIG['CAOS'];
  const fidelity = tm.patternsFidelity || [];
  const detectedPatterns = tm.detectedPatterns || [];

  // Show top 10 fidelity by default, rest on expand
  const sortedFidelity = [...fidelity].sort((a: any, b: any) => b.fidelity - a.fidelity);
  const visibleFidelity = showAllFidelity ? sortedFidelity : sortedFidelity.slice(0, 10);

  return (
    <motion.div
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-xl border border-border p-3 space-y-3"
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <Activity className="w-4 h-4 text-primary" />
        <span className="font-display text-[10px] tracking-[0.15em] font-bold text-primary">
          PADRÕES IDENTIFICADOS 24H
        </span>
        <div className={`ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border ${modeConf.bg} ${modeConf.border} ${modeConf.color}`}>
          <span className="text-sm">{modeConf.icon}</span>
          MODO {modeLabel}
          <span className="font-mono text-[8px] opacity-80">{tm.mesaModeStrength}%</span>
        </div>
      </div>

      {/* Detected Patterns — Real-time active patterns */}
      {detectedPatterns.length > 0 && (
        <div>
          <span className="text-[8px] font-bold text-muted-foreground block mb-1.5">
            🔍 PADRÕES ATIVOS ({detectedPatterns.length})
          </span>
          <div className="space-y-1.5">
            {detectedPatterns.slice(0, 8).map((dp: any, i: number) => {
              const catConf = CATEGORY_LABELS[dp.category] || { label: dp.category, color: 'text-muted-foreground' };
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`rounded-lg p-2 border ${
                    dp.confidence >= 80
                      ? 'bg-primary/10 border-primary/30'
                      : dp.confidence >= 60
                      ? 'bg-amber-500/10 border-amber-500/20'
                      : 'bg-secondary/40 border-border'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{dp.emoji}</span>
                    <span className="text-[9px] font-bold text-foreground flex-1">{dp.name}</span>
                    <span className={`text-[7px] font-bold px-1.5 py-0.5 rounded ${catConf.color} bg-secondary/60`}>
                      {catConf.label}
                    </span>
                    <span className={`text-[9px] font-mono font-bold ${
                      dp.confidence >= 80 ? 'text-primary' : dp.confidence >= 60 ? 'text-amber-400' : 'text-muted-foreground'
                    }`}>
                      {dp.confidence}%
                    </span>
                  </div>
                  <p className="text-[8px] text-muted-foreground mt-1 leading-relaxed">{dp.description}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <Target className="w-2.5 h-2.5 text-primary" />
                    <span className="text-[8px] font-bold text-primary">{dp.action}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Transition Predictions */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-secondary/40 rounded-lg p-2 border border-border text-center">
          <span className="text-[7px] text-muted-foreground font-bold block mb-1">PRÓXIMO SETOR</span>
          {tm.predictedSector ? (
            <span className="text-xs font-bold text-primary">{tm.predictedSector}</span>
          ) : (
            <span className="text-[9px] text-muted-foreground">—</span>
          )}
        </div>
        <div className="bg-secondary/40 rounded-lg p-2 border border-border text-center">
          <span className="text-[7px] text-muted-foreground font-bold block mb-1">PRÓXIMA DÚZIA</span>
          {tm.predictedDozen ? (
            <span className="text-xs font-bold text-primary">D{tm.predictedDozen}</span>
          ) : (
            <span className="text-[9px] text-muted-foreground">—</span>
          )}
        </div>
        <div className="bg-secondary/40 rounded-lg p-2 border border-border text-center">
          <span className="text-[7px] text-muted-foreground font-bold block mb-1">PRÓXIMO TERMINAL</span>
          {tm.predictedTerminal !== null && tm.predictedTerminal !== undefined ? (
            <span className="text-xs font-bold text-primary">T{tm.predictedTerminal}</span>
          ) : (
            <span className="text-[9px] text-muted-foreground">—</span>
          )}
        </div>
      </div>

      {/* Dozen Pressure Trigger */}
      {tm.dozenPressureTrigger?.active && (
        <div className="bg-gradient-to-r from-red-500/15 to-orange-500/10 border border-red-500/30 rounded-lg p-2.5">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-red-400" />
            <span className="text-[9px] font-bold text-red-400">🔥 GATILHO DE PRESSÃO DE RETORNO</span>
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-[9px]">
            <span className="text-muted-foreground">
              Dúzia <strong className="text-foreground">{tm.dozenPressureTrigger.dozen}</strong>
            </span>
            <span className="text-muted-foreground">•</span>
            <span className="text-red-400 font-bold">{tm.dozenPressureTrigger.delay} giros ausente</span>
            <span className="text-muted-foreground">•</span>
            <span className="text-muted-foreground">
              Dominou <strong className="text-foreground">{tm.dozenPressureTrigger.historicalDominance}%</strong> em 500
            </span>
          </div>
        </div>
      )}

      {/* Pattern Fidelity */}
      {visibleFidelity.length > 0 && (
        <div>
          <span className="text-[8px] font-bold text-muted-foreground block mb-1.5">
            FIDELIDADE DOS PADRÕES (últimas 50 rodadas)
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5">
            {visibleFidelity.map((pf: any, i: number) => (
              <div key={i} className={`rounded-lg p-2 border text-center ${
                pf.fidelity >= 40 ? 'bg-primary/10 border-primary/30' :
                pf.fidelity >= 25 ? 'bg-secondary/60 border-border' :
                'bg-secondary/30 border-border opacity-60'
              }`}>
                <span className="text-sm block">{pf.emoji}</span>
                <span className="text-[7px] font-bold text-foreground block truncate">{pf.name}</span>
                <div className="flex items-center gap-1 mt-1">
                  <div className="flex-1 h-1 bg-secondary rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        pf.fidelity >= 40 ? 'bg-primary' : pf.fidelity >= 25 ? 'bg-amber-400' : 'bg-muted-foreground'
                      }`}
                      style={{ width: `${Math.min(100, pf.fidelity)}%` }}
                    />
                  </div>
                  <span className="text-[7px] font-mono font-bold">{pf.fidelity}%</span>
                </div>
                <span className="text-[6px] text-muted-foreground">{pf.confirmed}/{pf.total}</span>
              </div>
            ))}
          </div>
          {sortedFidelity.length > 10 && (
            <button
              onClick={() => setShowAllFidelity(!showAllFidelity)}
              className="flex items-center gap-1 mx-auto mt-2 text-[8px] text-primary font-bold hover:underline"
            >
              {showAllFidelity ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {showAllFidelity ? 'Mostrar menos' : `Ver todos (${sortedFidelity.length})`}
            </button>
          )}
        </div>
      )}

      {/* Sector Transition Matrix mini-view */}
      {tm.sectorMatrix && (
        <div>
          <span className="text-[8px] font-bold text-muted-foreground block mb-1.5">MATRIZ DE TRANSIÇÃO (Setores)</span>
          <div className="overflow-x-auto">
            <table className="w-full text-[8px]">
              <thead>
                <tr>
                  <th className="text-left text-muted-foreground p-1">De ↓ / Para →</th>
                  <th className="text-center text-muted-foreground p-1">Voisins</th>
                  <th className="text-center text-muted-foreground p-1">Tiers</th>
                  <th className="text-center text-muted-foreground p-1">Orphelins</th>
                </tr>
              </thead>
              <tbody>
                {['Voisins', 'Tiers', 'Orphelins'].map(from => {
                  const row = tm.sectorMatrix[from] || {};
                  const total = Object.values(row).reduce((a: number, b: any) => a + (b as number), 0) as number;
                  return (
                    <tr key={from} className="border-t border-border/50">
                      <td className="p-1 font-bold text-foreground">{from}</td>
                      {['Voisins', 'Tiers', 'Orphelins'].map(to => {
                        const count = (row[to] as number) || 0;
                        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                        const isMax = total > 0 && count === Math.max(...Object.values(row).map(v => v as number));
                        return (
                          <td key={to} className={`p-1 text-center font-mono ${isMax ? 'text-primary font-bold' : 'text-foreground/70'}`}>
                            {pct}%
                          </td>
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
    </motion.div>
  );
};

export default PatternPanel24h;
