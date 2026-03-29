import { useState, useEffect, useRef } from 'react';
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

const getBetTypeLabel = (type: string) => {
  switch (type) {
    case 'pleno': case 'numero_exato': return '💎 PLENO (35:1)';
    case 'terminal': case 'terminal_comp': case 'terminal_alternation': case 'duplo_terminal': case 'terminais_cruzados': case 'duzia_terminal_corr': return '🔢 TERMINAIS';
    case 'cavalos': case 'cavalos_comp': case 'cavalo_split': return '🐎 CAVALOS';
    case 'setor': case 'vizinhos': case 'sniper': case 'voisins': case 'setor_oposto': case 'cluster_regional': return '🎯 VIZINHOS/SETOR';
    case 'duzia': case 'duzia_unica': case 'dozen_phase': case 'duzias': case 'pressao_retorno': case 'duzia_progressiva': return '🎲 DÚZIA (2:1)';
    case 'coluna': case 'coluna_comp': case 'column_cycle': case 'coluna_fria': return '📐 COLUNA (2:1)';
    case 'cor': case 'cor_alternancia': case 'cor_reversa': return '🎨 COR (1:1)';
    case 'paridade': case 'paridade_reversa': return '🔄 PAR/ÍMPAR (1:1)';
    case 'alto_baixo': case 'alto_baixo_reversa': return '↕️ ALTO/BAIXO (1:1)';
    case 'ritmo_calibrado': return '🎯 RITMO CALIBRADO';
    case 'fusao_suprema': return '⚡ FUSÃO SUPREMA';
    case 'convergencia_absoluta': return '💠 CONVERGÊNCIA ABSOLUTA';
    case 'ultra_sniper': return '🔥 ULTRA SNIPER';
    case 'numeros_puxam': return '🧲 PUXADA';
    case 'pressao_zero': case 'jeu_zero': return '🟢 PRESSÃO ZERO';
    case 'crescente': return '📈 CRESCENTE';
    case 'poucas_fichas': return '💰 CONSERVADOR';
    case 'matrix_fusion': return '🔮 CONVERGÊNCIA MATRICIAL';
    case 'cobertura_area': case 'cluster_regional': return '🗺️ COBERTURA DE ÁREA';
    case 'archetype_fusion': return '🏛️ ARQUÉTIPOS';
    case 'genetic_cluster': return '🧬 CLUSTER GENÉTICO';
    case 'cylinder_bias': return '⚙️ VIÉS DO CILINDRO';
    case 'hot_phase': case 'hiper_quente': return '🔥 FASE QUENTE';
    case 'cold_phase': return '❄️ FASE FRIA';
    case 'terminal_alto_baixo': return '📊 TERMINAL ALTO/BAIXO';
    case 'rua': return '🛣️ RUA (11:1)';
    case 'multiplos_seq': return '🔢 MÚLTIPLOS';
    case 'diferenca_const': return '📏 DIFERENÇA CONSTANTE';
    case 'combo_ouro': return '👑 COMBO OURO';
    case 'combo_prata': return '🥈 COMBO PRATA';
    default: return `📌 ${type.replace(/_/g, ' ').toUpperCase()}`;
  }
};

const getBetTypeCategory = (type: string): string => {
  if (['sniper', 'voisins', 'setor_oposto', 'ultra_sniper', 'ritmo_calibrado', 'cylinder_bias', 'cluster_regional', 'jeu_zero'].includes(type)) return 'setor';
  if (['cavalos', 'cavalos_comp', 'cavalo_split'].includes(type)) return 'cavalos';
  if (['terminal_alternation', 'duplo_terminal', 'terminais_cruzados', 'poucas_fichas', 'terminal_alto_baixo', 'duzia_terminal_corr'].includes(type)) return 'terminal';
  if (['duzia_unica', 'dozen_phase', 'duzias', 'pressao_retorno', 'duzia_progressiva'].includes(type)) return 'duzia';
  if (['coluna', 'column_cycle', 'coluna_fria'].includes(type)) return 'coluna';
  if (['cor', 'cor_alternancia', 'cor_reversa'].includes(type)) return 'cor';
  if (['paridade', 'paridade_reversa'].includes(type)) return 'paridade';
  if (['alto_baixo', 'alto_baixo_reversa'].includes(type)) return 'alto_baixo';
  if (['fusao_suprema', 'convergencia_absoluta', 'matrix_fusion', 'archetype_fusion', 'combo_ouro', 'combo_prata'].includes(type)) return 'fusao';
  if (['numeros_puxam'].includes(type)) return 'puxada';
  if (['pressao_zero'].includes(type)) return 'zero';
  if (['rua'].includes(type)) return 'rua';
  if (['hiper_quente'].includes(type)) return 'hiper_quente';
  if (['multiplos_seq', 'diferenca_const'].includes(type)) return 'sequencia';
  return 'outro';
};

const SniperSignal = ({ sniperData, sniperCountdown, sniperStale, lastPredResult, confidenceFilter }: Props) => {
  const [reedCount, setReedCount] = useState(0);
  const prevSignalRef = useRef<number | null>(null);
  const prevHitRef = useRef<boolean | null>(null);

  // Track signal changes and hit results for REED
  useEffect(() => {
    const currentSignal = sniperData?.signal?.number ?? null;
    
    // Reset on new signal
    if (currentSignal !== null && currentSignal !== prevSignalRef.current) {
      prevSignalRef.current = currentSignal;
      setReedCount(0);
      return;
    }

    if (!lastPredResult || lastPredResult.hit === null) return;
    
    // Only process when hit status changes
    if (lastPredResult.hit === prevHitRef.current) return;
    prevHitRef.current = lastPredResult.hit;

    if (lastPredResult.hit === true) {
      setReedCount(0);
    } else if (lastPredResult.hit === false) {
      setReedCount(prev => Math.min(prev + 1, 4));
    }
  }, [sniperData?.signal?.number, lastPredResult?.hit]);

  const reedColor = reedCount >= 4 ? 'bg-red-500/20 text-red-400 border-red-500/50' 
    : reedCount >= 2 ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/40' 
    : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40';
  const reedStopped = reedCount >= 4;

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
  const primaryBet = sniperData.betInstructions?.bets?.find((b: any) => b.type !== 'protecao');
  const mainNumber = sniperData.signal?.number;
  const probability = sniperData.signal?.probability || 0;


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
          ANÁLISE MULTI-JOGADA
        </span>
        
        {/* REED Badge */}
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-black ${reedColor} ${reedStopped ? 'animate-pulse' : ''}`}>
          <span>REED: {reedCount}/4</span>
          {reedStopped && <span>⛔</span>}
          {reedCount > 0 && (
            <button 
              onClick={() => setReedCount(0)} 
              className="ml-1 text-[9px] opacity-70 hover:opacity-100 transition-opacity"
              title="Reset REED"
            >↺</button>
          )}
        </div>

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

      {/* REED STOP warning */}
      {reedStopped && (
        <div className="mx-4 mt-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-center animate-pulse">
          <span className="text-xs font-black text-red-400">⛔ REED — Pause e reanalise</span>
        </div>
      )}

      <div className={`p-4 transition-opacity ${reedStopped ? 'opacity-50 pointer-events-none' : ''}`}>
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
          <div className="space-y-3">
            {/* CONFIDENCE FILTER */}
            {confidenceFilter && probability < 70 && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 text-center">
                <Shield className="w-5 h-5 text-amber-400 mx-auto mb-1.5" />
                <span className="text-[10px] font-bold text-amber-400 block">FILTRO DE SEGURANÇA ATIVO</span>
                <span className="text-[9px] text-muted-foreground">Convergência {probability}% — abaixo do limiar 70%. AGUARDAR.</span>
              </div>
            )}

            {/* ===== JOGADA #1 — MELHOR ===== */}
            {(!confidenceFilter || probability >= 70) && (
              <>
                {/* MAIN BET */}
                <div className="rounded-xl overflow-hidden border-2 border-primary/40 bg-gradient-to-br from-primary/15 via-primary/8 to-transparent shadow-lg shadow-primary/10">
                  <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 border-b border-primary/20">
                    <span className="text-[9px] font-black tracking-[0.2em] text-primary bg-primary/15 px-2 py-0.5 rounded">
                      #1 MELHOR JOGADA
                    </span>
                    <span className="text-[10px] font-bold text-primary/80">
                      {getBetTypeLabel(sniperData.strategy.type)}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 px-4 py-4">
                    {/* Número principal */}
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-black shadow-xl ring-4 flex-shrink-0 ${
                      mainNumber === 0 ? 'bg-green-600 text-white ring-green-400/50 shadow-green-500/30'
                      : RED_NUMBERS.includes(mainNumber) ? 'bg-red-600 text-white ring-red-400/50 shadow-red-500/30'
                      : 'bg-zinc-800 text-white ring-zinc-500/50 shadow-zinc-600/30'
                    }`}>
                      {mainNumber}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-2xl font-black font-mono ${probColor(probability)}`}>
                          {probability}%
                        </span>
                        <span className="text-[9px] text-muted-foreground">conv.</span>
                      </div>
                      <span className="text-sm font-bold text-primary block truncate">
                        {sniperData.strategy.emoji} {sniperData.strategy.label}
                      </span>
                      {primaryBet && (
                        <p className="text-[10px] text-muted-foreground truncate">{primaryBet.detail}</p>
                      )}
                    </div>
                  </div>

                  {/* Números cobertos */}
                  <div className="px-4 py-2.5 border-t border-primary/15">
                    <div className="flex flex-wrap gap-1">
                      {sniperData.strategy.numbers.slice(0, 14).map((n: number, i: number) => {
                        const isProt = PROTECTION_NUMBERS.includes(n);
                        return (
                          <div key={i} className={`w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold ring-1 relative ${
                            n === mainNumber
                              ? 'bg-primary text-primary-foreground ring-primary/50 ring-2 shadow-lg shadow-primary/30'
                              : colorClass(n, isProt)
                          }`}>
                            {n}
                            {isProt && n !== mainNumber && <span className="absolute -top-0.5 -right-0.5 text-[6px]">🛡️</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Stats compactos */}
                  <div className="flex items-center gap-2 px-4 py-1.5 border-t border-primary/15 text-[9px] text-muted-foreground">
                    <span>Payout: <strong className="text-foreground">{sniperData.strategy.payout}x</strong></span>
                    <span className="text-border">•</span>
                    <span><strong className="text-foreground">{sniperData.strategy.numbers.length}</strong> núm.</span>
                    <span className="text-border">•</span>
                    <span><strong className="text-foreground">{sniperData.strategy.coverage}%</strong> cob.</span>
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

                {/* ===== JOGADA COMBINADA — Fusão das alternativas ===== */}
                {(() => {
                  const cb = sniperData.combinedBet;
                  if (!cb || !cb.numbers?.length) return null;
                  const highlighted: number[] = cb.highlighted || [];
                  const strats: any[] = cb.strategiesUsed || [];

                  return (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-xl border border-yellow-500/30 bg-gradient-to-br from-yellow-500/8 via-card to-card overflow-hidden"
                    >
                      <div className="flex items-center gap-2 px-3 py-2 bg-yellow-500/10 border-b border-yellow-500/20">
                        <Zap className="w-3.5 h-3.5 text-yellow-400" />
                        <span className="text-[10px] font-black tracking-wide text-yellow-400">
                          JOGADA COMBINADA — {strats.length} ESTRATÉGIAS DIVERSAS
                        </span>
                        <span className={`ml-auto text-sm font-black font-mono ${probColor(cb.avgProbability)}`}>
                          {cb.avgProbability}%
                        </span>
                      </div>

                      {/* Tags das estratégias */}
                      <div className="flex flex-wrap gap-1.5 px-3 pt-2.5">
                        {strats.map((s: any, i: number) => (
                          <span key={i} className="text-[8px] px-2 py-0.5 rounded-md bg-secondary/60 text-foreground/80 border border-border/40 font-bold">
                            {s.emoji} {s.label}
                          </span>
                        ))}
                      </div>

                      {/* Números — destacar os que aparecem em 2+ estratégias */}
                      <div className="px-3 py-2.5">
                        {highlighted.length > 0 && (
                          <span className="text-[9px] text-yellow-400 font-bold block mb-1">⭐ {highlighted.length} números em múltiplas estratégias:</span>
                        )}
                        <div className="flex flex-wrap gap-1">
                          {cb.numbers.map((n: number, i: number) => {
                            const isProt = PROTECTION_NUMBERS.includes(n);
                            const isHighlighted = highlighted.includes(n);
                            return (
                              <div key={i} className={`w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold ring-1 relative ${
                                isHighlighted
                                  ? 'ring-2 ring-yellow-400 shadow-md shadow-yellow-400/30 ' + (n === 0 ? 'bg-green-600 text-white' : RED_NUMBERS.includes(n) ? 'bg-red-600 text-white' : 'bg-zinc-800 text-white')
                                  : colorClass(n, isProt)
                              }`}>
                                {n}
                                {isProt && !isHighlighted && <span className="absolute -top-0.5 -right-0.5 text-[6px]">🛡️</span>}
                                {isHighlighted && <span className="absolute -top-0.5 -right-0.5 text-[6px]">⭐</span>}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 px-3 py-1.5 border-t border-yellow-500/15 text-[9px] text-muted-foreground">
                        <span><strong className="text-foreground">{cb.numbers.length}</strong> números</span>
                        <span className="text-border">•</span>
                        <span><strong className="text-foreground">{cb.coverage}%</strong> cobertura</span>
                        <span className="text-border">•</span>
                        <span>Payout: <strong className="text-foreground">{cb.payout}x</strong></span>
                        {highlighted.length > 0 && (
                          <>
                            <span className="text-border">•</span>
                            <span className="text-yellow-400 font-bold">⭐ {highlighted.length} convergentes</span>
                          </>
                        )}
                      </div>
                    </motion.div>
                  );
                })()}

                {/* JUSTIFICATIVA */}
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
                  <span className="text-[9px] text-muted-foreground font-bold tracking-wide">🧠 POR QUE ESTA JOGADA:</span>
                  <p className="text-[10px] text-primary/80 italic mt-1 leading-relaxed">{sniperData.strategy.justification}</p>
                </div>

                {/* CONVERGENCE REASONS */}
                {sniperData.signal.convergenceReasons?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {sniperData.signal.convergenceReasons.slice(0, 5).map((r: string, i: number) => (
                      <span key={i} className="text-[8px] px-2 py-1 rounded-md bg-primary/8 text-primary border border-primary/15 font-semibold">
                        {r}
                      </span>
                    ))}
                  </div>
                )}

                {/* Proteção */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[8px]">🛡️</span>
                  <span className="text-[8px] text-yellow-400/80 font-semibold">Proteção em TODAS jogadas: 0, 26, 32</span>
                </div>

                {/* TOP CANDIDATES */}
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
              </>
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
