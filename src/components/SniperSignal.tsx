import { motion } from 'framer-motion';
import {
  Crosshair, AlertTriangle, Eye, Clock, Shield, Zap, ShieldCheck
} from 'lucide-react';

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const colorClass = (n: number) => {
  if (n === 0) return 'bg-roulette-green text-white';
  return RED_NUMBERS.includes(n) ? 'bg-roulette-red text-white' : 'bg-roulette-black text-white';
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
      <div className="bg-card rounded-xl border border-border p-6 h-full flex items-center justify-center">
        <div className="text-center">
          <Crosshair className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2 animate-pulse" />
          <p className="text-sm text-muted-foreground">Carregando Sniper IA...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border p-4 h-full transition-all ${
        sniperData.mode === 'sniper'
          ? 'bg-gradient-to-r from-primary/30 via-yellow-500/10 to-primary/20 border-primary shadow-lg shadow-primary/20'
          : sniperData.mode === 'alert'
          ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/10 border-yellow-500/50'
          : sniperData.mode === 'recalibrating'
          ? 'bg-gradient-to-r from-purple-500/20 to-blue-500/10 border-purple-500/50'
          : 'bg-card border-border'
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        {sniperData.mode === 'sniper' ? (
          <Crosshair className="w-5 h-5 text-primary animate-pulse" />
        ) : sniperData.mode === 'alert' ? (
          <AlertTriangle className="w-5 h-5 text-yellow-400" />
        ) : (
          <Eye className="w-5 h-5 text-muted-foreground" />
        )}
        <span className="font-display text-xs tracking-[0.2em] font-bold text-primary">
          {sniperData.strategy ? `${sniperData.strategy.emoji} ${sniperData.strategy.label}` : 'SNIPER IA'}
        </span>
        {sniperData.mesaMode && (
          <span className={`text-[7px] px-1.5 py-0.5 rounded font-bold ${
            sniperData.mesaMode === 'fisico' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
          }`}>
            {sniperData.mesaMode === 'fisico' ? '🎰 FÍSICO' : '🧮 MATEMÁTICO'}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {sniperCountdown > 0 ? (
            <div className={`flex items-center gap-1 px-2 py-1 rounded-lg font-mono text-xs font-bold ${
              sniperCountdown <= 3 ? 'bg-destructive/20 text-destructive animate-pulse' : sniperCountdown <= 7 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-secondary text-muted-foreground'
            }`}>
              <Clock className="w-3 h-3" />
              {sniperCountdown}s
            </div>
          ) : (
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg font-mono text-[9px] font-bold bg-secondary text-muted-foreground">
              <Clock className="w-3 h-3" />
              Aguardando giro...
            </div>
          )}
        </div>
      </div>

      {/* STALE */}
      {sniperStale && lastPredResult ? (
        <div className="flex flex-col items-center gap-3 py-6">
          {lastPredResult.hit === true ? (
            <>
              <div className="w-14 h-14 rounded-full bg-green-500/20 border-2 border-green-500/50 flex items-center justify-center">
                <ShieldCheck className="w-7 h-7 text-green-400" />
              </div>
              <span className="text-sm font-bold text-green-400">
                {lastPredResult.hitType === 'exact' ? '🎯 ACERTO EXATO!' : '✅ ACERTO VIZINHO!'}
              </span>
            </>
          ) : lastPredResult.hit === false ? (
            <>
              <div className="w-14 h-14 rounded-full bg-destructive/20 border-2 border-destructive/50 flex items-center justify-center">
                <AlertTriangle className="w-7 h-7 text-destructive" />
              </div>
              <span className="text-sm font-bold text-destructive">❌ ERRO NA ÚLTIMA PREVISÃO</span>
            </>
          ) : null}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>Previsto: <strong className="text-foreground">{lastPredResult.predicted}</strong></span>
            <span>•</span>
            <span>Saiu: <strong className="text-foreground">{lastPredResult.actual}</strong></span>
          </div>
          <span className="text-[9px] text-muted-foreground italic">{lastPredResult.label}</span>
          <span className="text-[8px] text-muted-foreground/60 mt-1">Aguardando nova jogada...</span>
        </div>
      ) : sniperData.signal && sniperData.strategy ? (
        <div className="space-y-3">
          {/* CONFIDENCE FILTER */}
          {confidenceFilter && sniperData.signal.probability < 85 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-center">
              <Shield className="w-5 h-5 text-amber-400 mx-auto mb-1" />
              <span className="text-[10px] font-bold text-amber-400 block">FILTRO DE SEGURANÇA ATIVO</span>
              <span className="text-[8px] text-muted-foreground">Convergência {sniperData.signal.probability}% — abaixo do limiar 85%.</span>
            </div>
          )}
          {/* BET INSTRUCTIONS */}
          {(!confidenceFilter || sniperData.signal.probability >= 85) && sniperData.betInstructions?.bets?.length > 0 && (
            <div className="bg-gradient-to-r from-primary/20 via-primary/10 to-transparent border-2 border-primary/40 rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                <span className="text-[10px] font-bold tracking-[0.15em] text-primary">JOGADAS RECOMENDADAS</span>
                <span className={`ml-auto text-lg font-bold font-mono ${sniperData.signal.probability >= 85 ? 'text-primary' : 'text-yellow-400'}`}>
                  {sniperData.signal.probability}%
                </span>
              </div>
              <div className="space-y-1.5">
                {sniperData.betInstructions.bets.map((bet: any, i: number) => (
                  <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                    i === 0 ? 'bg-primary/15 border-primary/30 shadow-sm shadow-primary/10' : 'bg-secondary/50 border-border'
                  }`}>
                    <span className="text-lg">{bet.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <span className={`text-xs font-bold ${i === 0 ? 'text-primary' : 'text-foreground'}`}>{bet.label}</span>
                      <p className="text-[9px] text-muted-foreground truncate">{bet.detail}</p>
                    </div>
                    <span className={`text-[7px] px-1.5 py-0.5 rounded-full font-bold border shrink-0 ${
                      i === 0 ? 'bg-primary/20 text-primary border-primary/30' : 'bg-secondary text-muted-foreground border-border'
                    }`}>
                      {i === 0 ? 'PRINCIPAL' : 'REFORÇO'}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 text-[8px] text-muted-foreground">
                <span>Payout: {sniperData.strategy.payout}x</span>
                <span>•</span>
                <span>{sniperData.strategy.numbers.length} números</span>
                <span>•</span>
                <span>{sniperData.strategy.coverage}% cobertura</span>
              </div>
            </div>
          )}

          {/* NÚMEROS */}
          <div>
            <span className="text-[8px] text-muted-foreground block mb-1">🎯 NÚMEROS COBERTOS:</span>
            <div className="flex flex-wrap gap-1">
              {sniperData.strategy.numbers.slice(0, 18).map((n: number, i: number) => (
                <div key={i} className={`w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold border ${
                  i === 0 && sniperData.strategy.type === 'sniper'
                    ? 'bg-primary text-primary-foreground border-primary/50 ring-2 ring-primary/30 animate-pulse'
                    : `${colorClass(n)} border-white/20`
                }`}>
                  {n}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-primary/5 border border-primary/20 rounded-lg p-2">
            <span className="text-[8px] text-muted-foreground">🧠 JUSTIFICATIVA:</span>
            <p className="text-[9px] text-primary/90 italic mt-0.5">{sniperData.strategy.justification}</p>
          </div>

          {/* ALTERNATIVES */}
          {sniperData.allStrategies?.length > 1 && (
            <div>
              <span className="text-[8px] text-muted-foreground block mb-1">📋 ALTERNATIVAS:</span>
              <div className="flex flex-wrap gap-1.5">
                {sniperData.allStrategies.slice(1, 5).map((alt: any, i: number) => (
                  <div key={i} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-secondary/70 border border-border text-[8px]">
                    <span>{alt.emoji}</span>
                    <span className="font-semibold text-foreground truncate max-w-[100px]">{alt.label}</span>
                    <span className="font-mono text-muted-foreground">{alt.probability}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-1">
            {sniperData.signal.convergenceReasons?.slice(0, 6).map((r: string, i: number) => (
              <span key={i} className="text-[7px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-semibold">{r}</span>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 py-4">
          <p className={`text-sm font-semibold ${sniperData.mode === 'observing' ? 'text-orange-400' : 'text-muted-foreground'}`}>
            {sniperData.message}
          </p>
          {sniperData.convergenceScore !== undefined && (
            <span className="text-[8px] font-mono text-muted-foreground ml-auto">Camadas: {sniperData.convergenceScore}/{sniperData.layerResults?.max || 1000}</span>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default SniperSignal;
