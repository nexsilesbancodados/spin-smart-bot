import { motion } from 'framer-motion';
import {
  Crosshair, AlertTriangle, Eye, Clock, Shield, Zap, ShieldCheck, Sparkles
} from 'lucide-react';

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const colorClass = (n: number) => {
  if (n === 0) return 'bg-green-600 text-white ring-green-400/40';
  return RED_NUMBERS.includes(n) ? 'bg-red-600 text-white ring-red-400/30' : 'bg-zinc-800 text-white ring-zinc-500/30';
};

interface Props {
  sniperData: any;
  sniperCountdown: number;
  sniperStale: boolean;
  lastPredResult: { hit: boolean | null; hitType: string | null; predicted: number | null; actual: number | null; label: string } | null;
  confidenceFilter: boolean;
}

const SniperSignal = ({ sniperData, sniperCountdown, sniperStale, lastPredResult, confidenceFilter }: Props) => {
  if (!sniperData) {
    return (
      <div className="bg-card rounded-2xl border border-border p-8 h-full flex items-center justify-center">
        <div className="text-center">
          <Crosshair className="w-10 h-10 text-primary/30 mx-auto mb-3 animate-pulse" />
          <p className="text-sm text-muted-foreground font-medium">Carregando Sniper IA...</p>
        </div>
      </div>
    );
  }

  const probColor = (p: number) => p >= 85 ? 'text-primary' : p >= 70 ? 'text-yellow-400' : 'text-orange-400';

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border-2 h-full transition-all overflow-hidden"
      style={{
        background: sniperData.mode === 'sniper'
          ? 'linear-gradient(145deg, hsl(var(--card)) 0%, hsl(var(--primary) / 0.08) 100%)'
          : 'hsl(var(--card))',
        borderColor: sniperData.mode === 'sniper'
          ? 'hsl(var(--primary) / 0.5)'
          : sniperData.mode === 'alert'
          ? 'hsl(45 100% 50% / 0.4)'
          : 'hsl(var(--border))',
      }}
    >
      {/* Header Bar */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/50">
        {sniperData.mode === 'sniper' ? (
          <Crosshair className="w-4 h-4 text-primary animate-pulse" />
        ) : sniperData.mode === 'alert' ? (
          <AlertTriangle className="w-4 h-4 text-yellow-400" />
        ) : (
          <Eye className="w-4 h-4 text-muted-foreground" />
        )}
        <Sparkles className="w-3.5 h-3.5 text-primary/60" />
        <span className="font-bold text-xs tracking-wide text-foreground">
          {sniperData.strategy ? `${sniperData.strategy.emoji} ${sniperData.strategy.label}` : 'SNIPER IA'}
        </span>
        {sniperData.mesaMode && (
          <span className={`text-[9px] px-2 py-0.5 rounded-md font-bold border ${
            sniperData.mesaMode === 'fisico'
              ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
              : 'bg-blue-500/15 text-blue-400 border-blue-500/30'
          }`}>
            {sniperData.mesaMode === 'fisico' ? '🎰 FÍSICO' : '🧮 MATEMÁTICO'}
          </span>
        )}
        <div className="ml-auto">
          {sniperCountdown > 0 ? (
            <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-mono text-xs font-bold ${
              sniperCountdown <= 3 ? 'bg-destructive/20 text-destructive animate-pulse' : sniperCountdown <= 7 ? 'bg-yellow-500/15 text-yellow-400' : 'bg-secondary text-muted-foreground'
            }`}>
              <Clock className="w-3 h-3" />
              {sniperCountdown}s
            </div>
          ) : (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg font-mono text-[9px] font-bold bg-secondary/80 text-muted-foreground border border-border/50">
              <Clock className="w-3 h-3" />
              Aguardando giro...
            </div>
          )}
        </div>
      </div>

      <div className="p-4">
        {/* STALE RESULT */}
        {sniperStale && lastPredResult ? (
          <div className="flex flex-col items-center gap-3 py-8">
            {lastPredResult.hit === true ? (
              <>
                <div className="w-16 h-16 rounded-full bg-green-500/15 border-2 border-green-500/40 flex items-center justify-center shadow-lg shadow-green-500/10">
                  <ShieldCheck className="w-8 h-8 text-green-400" />
                </div>
                <span className="text-sm font-bold text-green-400">
                  {lastPredResult.hitType === 'exact' ? '🎯 ACERTO EXATO!' : '✅ ACERTO VIZINHO!'}
                </span>
              </>
            ) : lastPredResult.hit === false ? (
              <>
                <div className="w-16 h-16 rounded-full bg-destructive/15 border-2 border-destructive/40 flex items-center justify-center">
                  <AlertTriangle className="w-8 h-8 text-destructive" />
                </div>
                <span className="text-sm font-bold text-destructive">❌ ERRO NA ÚLTIMA PREVISÃO</span>
              </>
            ) : null}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>Previsto: <strong className="text-foreground">{lastPredResult.predicted}</strong></span>
              <span className="text-border">|</span>
              <span>Saiu: <strong className="text-foreground">{lastPredResult.actual}</strong></span>
            </div>
            <span className="text-[10px] text-muted-foreground/70 italic">{lastPredResult.label}</span>
            <span className="text-[9px] text-muted-foreground/50 mt-1">Aguardando nova jogada...</span>
          </div>
        ) : sniperData.signal && sniperData.strategy ? (
          <div className="space-y-4">
            {/* CONFIDENCE FILTER */}
            {confidenceFilter && sniperData.signal.probability < 70 && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 text-center">
                <Shield className="w-5 h-5 text-amber-400 mx-auto mb-1.5" />
                <span className="text-[10px] font-bold text-amber-400 block">FILTRO DE SEGURANÇA ATIVO</span>
                <span className="text-[9px] text-muted-foreground">Convergência {sniperData.signal.probability}% — abaixo do limiar 70%.</span>
              </div>
            )}

            {/* BET INSTRUCTIONS */}
            {(!confidenceFilter || sniperData.signal.probability >= 70) && sniperData.betInstructions?.bets?.length > 0 && (
              <div className="rounded-xl overflow-hidden border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-primary/20">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-primary" />
                    <span className="text-[10px] font-bold tracking-[0.18em] text-primary uppercase">Jogadas Recomendadas</span>
                  </div>
                  <span className={`text-xl font-black font-mono ${probColor(sniperData.signal.probability)}`}>
                    {sniperData.signal.probability}%
                  </span>
                </div>
                <div className="p-3 space-y-2">
                  {sniperData.betInstructions.bets.map((bet: any, i: number) => (
                    <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                      i === 0
                        ? 'bg-gradient-to-r from-primary/25 via-primary/15 to-primary/5 border border-primary/30 shadow-md shadow-primary/10'
                        : 'bg-secondary/40 border border-border/50 hover:border-primary/20'
                    }`}>
                      <span className="text-xl shrink-0">{bet.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <span className={`text-sm font-bold block ${i === 0 ? 'text-primary' : 'text-foreground'}`}>
                          + {bet.label}
                        </span>
                        <p className="text-[10px] text-muted-foreground truncate">Reforço: {bet.detail}</p>
                      </div>
                      <span className={`text-[8px] px-2 py-1 rounded-md font-black uppercase tracking-wider shrink-0 ${
                        i === 0
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'bg-secondary text-muted-foreground border border-border'
                      }`}>
                        {i === 0 ? 'Principal' : 'Reforço'}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-3 px-4 py-2 border-t border-primary/15 text-[9px] text-muted-foreground">
                  <span>Payout: <strong className="text-foreground">{sniperData.strategy.payout}x</strong></span>
                  <span className="text-border">•</span>
                  <span><strong className="text-foreground">{sniperData.strategy.numbers.length}</strong> números</span>
                  <span className="text-border">•</span>
                  <span><strong className="text-foreground">{sniperData.strategy.coverage}%</strong> cobertura</span>
                </div>
              </div>
            )}

            {/* NÚMEROS COBERTOS */}
            <div>
              <span className="text-[9px] text-muted-foreground font-bold block mb-2 tracking-wide">🎯 NÚMEROS COBERTOS:</span>
              <div className="flex flex-wrap gap-1.5">
                {sniperData.strategy.numbers.slice(0, 18).map((n: number, i: number) => (
                  <div key={i} className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ring-1 transition-transform hover:scale-110 ${
                    i === 0 && sniperData.strategy.type === 'sniper'
                      ? 'bg-primary text-primary-foreground ring-primary/50 ring-2 animate-pulse shadow-lg shadow-primary/30'
                      : colorClass(n)
                  }`}>
                    {n}
                  </div>
                ))}
              </div>
            </div>

            {/* JUSTIFICATIVA */}
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-3.5">
              <span className="text-[9px] text-muted-foreground font-bold tracking-wide">🧠 JUSTIFICATIVA:</span>
              <p className="text-[10px] text-primary/80 italic mt-1 leading-relaxed">{sniperData.strategy.justification}</p>
            </div>

            {/* ALTERNATIVES */}
            {sniperData.allStrategies?.length > 1 && (
              <div>
                <span className="text-[9px] text-muted-foreground font-bold block mb-2 tracking-wide">📋 ALTERNATIVAS:</span>
                <div className="flex flex-wrap gap-2">
                  {sniperData.allStrategies.slice(1, 5).map((alt: any, i: number) => {
                    const altColors = [
                      'bg-rose-500/10 border-rose-500/30 text-rose-400',
                      'bg-blue-500/10 border-blue-500/30 text-blue-400',
                      'bg-cyan-500/10 border-cyan-500/30 text-cyan-400',
                      'bg-purple-500/10 border-purple-500/30 text-purple-400',
                    ];
                    return (
                      <div key={i} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[9px] font-semibold transition-all hover:scale-105 ${altColors[i % altColors.length]}`}>
                        <span>{alt.emoji}</span>
                        <span className="truncate max-w-[110px]">{alt.label}</span>
                        <span className="font-mono text-[8px] opacity-80">{alt.probability}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* CONVERGENCE REASONS */}
            {sniperData.signal.convergenceReasons?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {sniperData.signal.convergenceReasons.slice(0, 6).map((r: string, i: number) => (
                  <span key={i} className="text-[8px] px-2 py-1 rounded-md bg-primary/8 text-primary border border-primary/15 font-semibold">
                    {r}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3 py-6">
            <p className={`text-sm font-semibold ${sniperData.mode === 'observing' ? 'text-orange-400' : 'text-muted-foreground'}`}>
              {sniperData.message}
            </p>
            {sniperData.convergenceScore !== undefined && (
              <span className="text-[9px] font-mono text-muted-foreground ml-auto">Camadas: {sniperData.convergenceScore}/{sniperData.layerResults?.max || 1000}</span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default SniperSignal;
