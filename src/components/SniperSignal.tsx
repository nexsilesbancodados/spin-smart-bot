import { motion } from 'framer-motion';
import {
  Crosshair, AlertTriangle, Eye, Clock, Shield, Zap, ShieldCheck, Sparkles, Target, TrendingUp
} from 'lucide-react';

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const PROTECTION_NUMBERS = [0, 26, 32];
const colorClass = (n: number, isProtection = false) => {
  const base = n === 0 ? 'bg-green-600 text-white ring-green-400/40' 
    : RED_NUMBERS.includes(n) ? 'bg-red-600 text-white ring-red-400/30' 
    : 'bg-zinc-800 text-white ring-zinc-500/30';
  return isProtection ? `${base} ring-2 ring-yellow-400/70` : base;
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

  // Get the SINGLE best bet instruction (first non-protection bet)
  const primaryBet = sniperData.betInstructions?.bets?.find((b: any) => b.type !== 'protecao');
  const mainNumber = sniperData.signal?.number;
  const probability = sniperData.signal?.probability || 0;

  // Determine bet type label for clarity
  const getBetTypeLabel = (bet: any) => {
    if (!bet) return '';
    switch (bet.type) {
      case 'pleno': return 'PLENO (35:1)';
      case 'terminal': case 'terminal_comp': return 'TERMINAIS';
      case 'cavalos': case 'cavalos_comp': return 'CAVALOS';
      case 'setor': case 'vizinhos': return 'VIZINHOS NA RODA';
      case 'duzia': return 'DÚZIA (2:1)';
      case 'coluna': case 'coluna_comp': return 'COLUNA (2:1)';
      case 'cor': return 'COR (1:1)';
      case 'paridade': return 'PAR/ÍMPAR (1:1)';
      case 'alto_baixo': return 'ALTO/BAIXO (1:1)';
      case 'ritmo': return 'RITMO CALIBRADO';
      case 'fusao': return 'FUSÃO DE PADRÕES';
      case 'matriz': return 'CONVERGÊNCIA';
      default: return bet.type?.toUpperCase() || 'JOGADA';
    }
  };

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
          JOGADA ÚNICA — MELHOR OPORTUNIDADE
        </span>
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
                <span className="text-sm font-bold text-destructive">❌ ERRO NA ÚLTIMA</span>
              </>
            ) : null}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>Previsto: <strong className="text-foreground">{lastPredResult.predicted}</strong></span>
              <span className="text-border">|</span>
              <span>Saiu: <strong className="text-foreground">{lastPredResult.actual}</strong></span>
            </div>
            <span className="text-[9px] text-muted-foreground/50 mt-1">Aguardando nova jogada...</span>
          </div>
        ) : sniperData.signal && sniperData.strategy ? (
          <div className="space-y-4">
            {/* CONFIDENCE FILTER */}
            {confidenceFilter && probability < 70 && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 text-center">
                <Shield className="w-5 h-5 text-amber-400 mx-auto mb-1.5" />
                <span className="text-[10px] font-bold text-amber-400 block">FILTRO DE SEGURANÇA ATIVO</span>
                <span className="text-[9px] text-muted-foreground">Convergência {probability}% — abaixo do limiar 70%. AGUARDAR.</span>
              </div>
            )}

            {/* ===== SINGLE BEST BET — HERO SECTION ===== */}
            {(!confidenceFilter || probability >= 70) && (
              <div className="rounded-xl overflow-hidden border-2 border-primary/40 bg-gradient-to-br from-primary/15 via-primary/8 to-transparent shadow-lg shadow-primary/10">
                
                {/* Main number highlight */}
                <div className="flex flex-col items-center py-5 border-b border-primary/20">
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="w-4 h-4 text-primary" />
                    <span className="text-[10px] font-black tracking-[0.25em] text-primary uppercase">
                      {primaryBet ? getBetTypeLabel(primaryBet) : sniperData.strategy.emoji + ' ' + sniperData.strategy.label}
                    </span>
                  </div>

                  {/* NÚMERO EXATO — biggest highlight */}
                  <div className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-black shadow-xl ring-4 mb-3 ${
                    mainNumber === 0 ? 'bg-green-600 text-white ring-green-400/50 shadow-green-500/30'
                    : RED_NUMBERS.includes(mainNumber) ? 'bg-red-600 text-white ring-red-400/50 shadow-red-500/30'
                    : 'bg-zinc-800 text-white ring-zinc-500/50 shadow-zinc-600/30'
                  }`}>
                    {mainNumber}
                  </div>

                  <span className={`text-3xl font-black font-mono ${probColor(probability)}`}>
                    {probability}%
                  </span>
                  <span className="text-[9px] text-muted-foreground mt-0.5">convergência</span>
                </div>

                {/* Single bet instruction */}
                {primaryBet && (
                  <div className="px-4 py-3 bg-primary/5">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{primaryBet.emoji}</span>
                      <div className="flex-1">
                        <span className="text-sm font-bold text-primary block">{primaryBet.label}</span>
                        <p className="text-[10px] text-muted-foreground">{primaryBet.detail}</p>
                      </div>
                    </div>
                    {/* Vizinhos info */}
                    {(() => {
                      const numCount = sniperData.strategy?.numbers?.length || 0;
                      const neighborsCount = numCount > 1 ? Math.floor((numCount - 1) / 2) : 0;
                      return neighborsCount > 0 ? (
                        <div className="mt-2 flex items-center gap-2 bg-accent/30 rounded-lg px-3 py-1.5">
                          <span className="text-lg">🎡</span>
                          <span className="text-xs font-bold text-accent-foreground">
                            Jogue <span className="text-primary text-sm">{neighborsCount}</span> vizinhos de cada lado
                          </span>
                          <span className="text-[9px] text-muted-foreground ml-auto">({numCount} números total)</span>
                        </div>
                      ) : null;
                    })()}
                  </div>
                )}

                {/* Números cobertos — compact */}
                <div className="px-4 py-3 border-t border-primary/15">
                  <span className="text-[9px] text-muted-foreground font-bold block mb-2 tracking-wide">🎯 NÚMEROS COBERTOS:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {sniperData.strategy.numbers.slice(0, 14).map((n: number, i: number) => {
                      const isProt = PROTECTION_NUMBERS.includes(n);
                      return (
                        <div key={i} className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ring-1 transition-transform hover:scale-110 relative ${
                          n === mainNumber
                            ? 'bg-primary text-primary-foreground ring-primary/50 ring-2 animate-pulse shadow-lg shadow-primary/30'
                            : colorClass(n, isProt)
                        }`}>
                          {n}
                          {isProt && <span className="absolute -top-1 -right-1 text-[7px]">🛡️</span>}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="text-[8px]">🛡️</span>
                    <span className="text-[8px] text-yellow-400/80 font-semibold">Proteção: 0, 26, 32 (sempre)</span>
                  </div>
                </div>

                {/* Stats row */}
                <div className="flex items-center gap-3 px-4 py-2 border-t border-primary/15 text-[9px] text-muted-foreground">
                  <span>Payout: <strong className="text-foreground">{sniperData.strategy.payout}x</strong></span>
                  <span className="text-border">•</span>
                  <span><strong className="text-foreground">{sniperData.strategy.numbers.length}</strong> números</span>
                  <span className="text-border">•</span>
                  <span><strong className="text-foreground">{sniperData.strategy.coverage}%</strong> cobertura</span>
                  {sniperData.mesaMode && (
                    <>
                      <span className="text-border">•</span>
                      <span className={`font-bold ${sniperData.mesaMode === 'fisico' ? 'text-purple-400' : 'text-blue-400'}`}>
                        {sniperData.mesaMode === 'fisico' ? '🎰 Físico' : '🧮 Matemático'}
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* JUSTIFICATIVA */}
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-3.5">
              <span className="text-[9px] text-muted-foreground font-bold tracking-wide">🧠 POR QUE ESTA JOGADA:</span>
              <p className="text-[10px] text-primary/80 italic mt-1 leading-relaxed">{sniperData.strategy.justification}</p>
            </div>

            {/* CONVERGENCE REASONS — compact tags */}
            {sniperData.signal.convergenceReasons?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {sniperData.signal.convergenceReasons.slice(0, 5).map((r: string, i: number) => (
                  <span key={i} className="text-[8px] px-2 py-1 rounded-md bg-primary/8 text-primary border border-primary/15 font-semibold">
                    {r}
                  </span>
                ))}
              </div>
            )}

            {/* TOP CANDIDATES — just 3 numbers as secondary options */}
            {sniperData.topCandidates?.length > 1 && (
              <div className="flex items-center gap-2 pt-1">
                <TrendingUp className="w-3 h-3 text-muted-foreground" />
                <span className="text-[8px] text-muted-foreground font-bold">TOP ALVOS:</span>
                {sniperData.topCandidates.slice(0, 4).map((c: any, i: number) => (
                  <div key={i} className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[9px] font-bold ${
                    i === 0 ? 'border-primary/30 text-primary bg-primary/5' : 'border-border/50 text-muted-foreground bg-secondary/30'
                  }`}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold ${
                      c.num === 0 ? 'bg-green-600 text-white' : RED_NUMBERS.includes(c.num) ? 'bg-red-600 text-white' : 'bg-zinc-700 text-white'
                    }`}>{c.num}</span>
                    <span className="font-mono">{c.score.toFixed(0)}pts</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3 py-6">
            <p className={`text-sm font-semibold ${sniperData.mode === 'observing' ? 'text-orange-400' : 'text-muted-foreground'}`}>
              {sniperData.message}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default SniperSignal;