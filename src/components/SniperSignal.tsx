import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Crosshair, AlertTriangle, Eye, Clock, Shield, Zap, ShieldCheck, Sparkles, Target, TrendingUp
} from 'lucide-react';


const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const PROTECTION_NUMBERS = [24, 29, 35, 11];
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
    case 'ensemble_supremo': return '🌟 ENSEMBLE SUPREMO';
    case 'matriz_numerica': return '🔢 MATRIZ NUMÉRICA';
    case 'auto_repeticao': return '🔁 AUTO-REPETIÇÃO';
    default: return `📌 ${type.replace(/_/g, ' ').toUpperCase()}`;
  }
};

// Explica em linguagem simples COMO apostar cada tipo
const getHowToBet = (type: string, numbers: number[], mainNumber?: number): string => {
  const cat = getBetTypeCategory(type);
  switch (cat) {
    case 'setor':
      return `Aposte nos VIZINHOS do ${mainNumber ?? numbers[0]} na roleta. Peça ao dealer: "${mainNumber ?? numbers[0]} e vizinhos" ou coloque fichas direto nos números mostrados.`;
    case 'cavalos':
      return `Coloque fichas NO MEIO entre dois números (split). Cada ficha cobre 2 números de uma vez. Payout 17:1.`;
    case 'terminal':
      return `Aposte em todos os números que TERMINAM com o mesmo dígito. Ex: terminal 5 = 5, 15, 25, 35. Coloque 1 ficha em cada.`;
    case 'duzia':
      if (numbers.length > 0) {
        const d1 = numbers.some(n => n >= 1 && n <= 12);
        const d2 = numbers.some(n => n >= 13 && n <= 24);
        const d3 = numbers.some(n => n >= 25 && n <= 36);
        const duzias = [];
        if (d1) duzias.push('1ª (1-12)');
        if (d2) duzias.push('2ª (13-24)');
        if (d3) duzias.push('3ª (25-36)');
        return `Coloque fichas na(s) DÚZIA(S): ${duzias.join(' e ')}. Área marcada "1st 12", "2nd 12" ou "3rd 12" na mesa. Payout 2:1.`;
      }
      return 'Coloque fichas na área de DÚZIA na mesa. Payout 2:1.';
    case 'coluna':
      return `Coloque fichas no final da COLUNA (embaixo da mesa). Cada coluna cobre 12 números. Payout 2:1.`;
    case 'cor':
      const isRed = numbers.some(n => [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(n));
      return `Aposte em ${isRed ? '🔴 VERMELHO' : '⚫ PRETO'} — área grande no meio da mesa. Payout 1:1 (dobra a aposta).`;
    case 'paridade':
      const isEven = numbers.length > 0 && numbers[0] % 2 === 0;
      return `Aposte em ${isEven ? 'PAR (EVEN)' : 'ÍMPAR (ODD)'} — área grande no meio da mesa. Payout 1:1.`;
    case 'alto_baixo':
      const isHigh = numbers.some(n => n >= 19);
      return `Aposte em ${isHigh ? 'ALTO (19-36) / MANQUE' : 'BAIXO (1-18) / PASSE'} — área no meio da mesa. Payout 1:1.`;
    case 'zero':
      return `Aposte nos números próximos ao ZERO: 0, 3, 12, 15, 26, 32, 35. Peça "Jeu Zéro" ao dealer.`;
    case 'rua':
      return `Coloque a ficha NA BORDA da linha de 3 números (rua). Cada ficha cobre 3 números. Payout 11:1.`;
    case 'puxada':
      return `O último número "puxa" estes. Coloque 1 ficha em cada número mostrado. Baseado em padrão histórico.`;
    case 'fusao':
      return `Jogada especial — múltiplas análises convergem nos mesmos números. Coloque 1 ficha em cada número mostrado abaixo.`;
    case 'hiper_quente':
      return `Números que estão SAINDO MUITO agora. Coloque fichas diretas (pleno) nos números mostrados. Payout até 35:1.`;
    default:
      return `Coloque 1 ficha em cada número mostrado abaixo. Os números em destaque têm maior probabilidade.`;
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
  if (['fusao_suprema', 'convergencia_absoluta', 'matrix_fusion', 'archetype_fusion', 'combo_ouro', 'combo_prata', 'ensemble_supremo'].includes(type)) return 'fusao';
  if (['matriz_numerica', 'auto_repeticao'].includes(type)) return 'outro';
  if (['numeros_puxam'].includes(type)) return 'puxada';
  if (['pressao_zero'].includes(type)) return 'zero';
  if (['rua'].includes(type)) return 'rua';
  if (['hiper_quente'].includes(type)) return 'hiper_quente';
  if (['multiplos_seq', 'diferenca_const'].includes(type)) return 'sequencia';
  return 'outro';
};

const SniperSignal = ({ sniperData, sniperCountdown, sniperStale, lastPredResult, confidenceFilter: confidenceFilterProp }: Props) => {
  const [reedCount, setReedCount] = useState(0);
  const [confidenceFilter, setConfidenceFilter] = useState(confidenceFilterProp);
  const prevSignalRef = useRef<number | null>(null);
  const prevHitRef = useRef<boolean | null>(null);

  useEffect(() => { setConfidenceFilter(confidenceFilterProp); }, [confidenceFilterProp]);

  useEffect(() => {
    const currentSignal = sniperData?.signal?.number ?? null;
    if (currentSignal !== null && currentSignal !== prevSignalRef.current) {
      prevSignalRef.current = currentSignal;
      setReedCount(0);
      return;
    }
    if (!lastPredResult || lastPredResult.hit === null) return;
    if (lastPredResult.hit === prevHitRef.current) return;
    prevHitRef.current = lastPredResult.hit;
    if (lastPredResult.hit === true) {
      setReedCount(0);
    } else if (lastPredResult.hit === false) {
      setReedCount(prev => Math.min(prev + 1, 4));
    }
  }, [sniperData?.signal?.number, lastPredResult?.hit]);

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-card overflow-hidden"
    >
      {/* ── HEADER ─────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-card/80">
        <div className="flex items-center gap-2">
          <Crosshair className="w-4 h-4 text-primary" />
          <span className="font-display text-[11px] tracking-[0.2em] font-black text-primary uppercase">
            Sniper IA
          </span>
          {sniperData?.trendEngine && Number(sniperData.trendEngine.confidence) > 30 && (
            <div className="flex gap-1 ml-1">
              {sniperData.trendEngine.colorTrend?.direction && (
                <span className={`text-[7px] px-1.5 py-0.5 rounded font-bold border ${
                  sniperData.trendEngine.colorTrend.direction === 'red'
                    ? 'bg-red-500/15 text-red-400 border-red-500/20'
                    : 'bg-secondary text-muted-foreground border-border'
                }`}>
                  {sniperData.trendEngine.colorTrend.direction === 'red' ? '🔴' : '⚫'}
                </span>
              )}
              {sniperData.trendEngine.dozenTrend?.direction && (
                <span className="text-[7px] px-1.5 py-0.5 rounded font-bold bg-amber-500/15 text-amber-400 border border-amber-500/20">
                  D{sniperData.trendEngine.dozenTrend.direction}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {sniperData?.ultraConservadorMode && (
            <span className="text-[7px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 font-bold">🛡️ CONSERVADOR</span>
          )}
          {sniperData?.dealerShift?.detected && (
            <span className="text-[7px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30 font-bold">🎭 NOVO DEALER</span>
          )}
          <button onClick={() => setConfidenceFilter(f => !f)}
            className={`text-[8px] px-2 py-1 rounded-lg border font-bold transition-all ${
              confidenceFilter
                ? 'bg-primary/15 text-primary border-primary/30'
                : 'bg-secondary text-muted-foreground border-border'
            }`}>
            {confidenceFilter ? '🔒 Filtro ON' : '🔓 Filtro OFF'}
          </button>
        </div>
      </div>

      {/* ── REED STOP ───────────────────────────────────── */}
      {reedStopped && (
        <div className="mx-4 mt-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-center animate-pulse">
          <span className="text-xs font-black text-red-400">⛔ REED STOP — Pause e reanalise</span>
        </div>
      )}

      {/* ── DEALER SHIFT ───────────────────────────────── */}
      {sniperData?.dealerShift?.detected && (
        <div className="mx-4 mt-2 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center gap-2">
          <span className="text-[8px] text-purple-400 font-bold">
            🎭 Arco mudou {sniperData.dealerShift.oldArc} → {sniperData.dealerShift.newArc} — padrão reiniciando
          </span>
        </div>
      )}

      <div className={`p-4 transition-opacity ${reedStopped ? 'opacity-40 pointer-events-none' : ''}`}>

        {/* ── AGUARDANDO RESULTADO ───────────────────────── */}
        {sniperStale && lastPredResult ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg border-2 ${
              lastPredResult.hit
                ? 'bg-green-500/15 border-green-500/40 shadow-green-500/10'
                : 'bg-destructive/15 border-destructive/40'
            }`}>
              {lastPredResult.hit
                ? <ShieldCheck className="w-8 h-8 text-green-400" />
                : <AlertTriangle className="w-8 h-8 text-destructive" />}
            </div>
            <span className={`text-sm font-bold ${lastPredResult.hit ? 'text-green-400' : 'text-destructive'}`}>
              {lastPredResult.hit
                ? (lastPredResult.hitType === 'exact' ? '🎯 ACERTO EXATO!' : '✅ ACERTO!')
                : '❌ ERRO'}
            </span>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>Previsto: <strong className="text-foreground">{lastPredResult.predicted}</strong></span>
              <span>|</span>
              <span>Saiu: <strong className="text-foreground">{lastPredResult.actual}</strong></span>
            </div>
            <span className="text-[9px] text-muted-foreground/50">Aguardando nova jogada...</span>
          </div>

        ) : !sniperData?.signal || !sniperData?.strategy ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Clock className="w-8 h-8 text-muted-foreground/40" />
            <p className="text-sm font-semibold text-muted-foreground">
              {sniperData?.message || 'Aguardando dados...'}
            </p>
            {sniperData?.mode === 'calibrating' && (
              <span className="text-[9px] text-blue-400">🔄 Calibrando padrões...</span>
            )}
          </div>

        ) : (() => {
          const ensTop1: number = sniperData.ensemble?.top1 ?? sniperData.topCandidates?.[0]?.num ?? sniperData.strategy.numbers[0];

          const supportPool: number[] = [
            ...(sniperData.ensemble?.top5 || []),
            ...(sniperData.strategy.numbers || []),
            ...(sniperData.topCandidates?.slice(0, 5).map((c: any) => c.num) || []),
          ].filter((n: number) => n !== ensTop1 && n >= 0 && n <= 36);

          const scoreCount: Record<number, number> = {};
          supportPool.forEach((n: number) => { scoreCount[n] = (scoreCount[n] || 0) + 1; });
          const sortedSupport = [...new Set(supportPool)].sort((a, b) => (scoreCount[b] || 0) - (scoreCount[a] || 0));

          const PROT = PROTECTION_NUMBERS.filter(n => n !== ensTop1);
          const support = sortedSupport.slice(0, 8);
          const finalNumbers: number[] = [...new Set([ensTop1, ...support, ...PROT])].slice(0, 12);

          const highConviction: number[] = finalNumbers.filter(n => {
            const inEnsemble = (sniperData.ensemble?.top5 || []).includes(n);
            const inWinner = (sniperData.strategy.numbers || []).includes(n);
            const inCandidates = (sniperData.topCandidates || []).slice(0, 3).some((c: any) => c.num === n);
            return (inEnsemble ? 1 : 0) + (inWinner ? 1 : 0) + (inCandidates ? 1 : 0) >= 2;
          });

          const rawProb = sniperData.signal.probability || 0;
          const coverage = (finalNumbers.length / 37) * 100;
          const displayProb = Math.min(rawProb, Math.round(coverage + 20));

          const isHot = displayProb >= 65;
          const isMed = displayProb >= 45;

          return (
            <div className="space-y-4">

              {confidenceFilter && displayProb < 50 && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-center">
                  <Shield className="w-5 h-5 text-amber-400 mx-auto mb-1" />
                  <span className="text-[10px] font-bold text-amber-400 block">SINAL FRACO — AGUARDAR</span>
                  <span className="text-[9px] text-muted-foreground">{displayProb}% — abaixo de 50%. Não entrar.</span>
                </div>
              )}

              {(!confidenceFilter || displayProb >= 50) && (
                <div className={`rounded-2xl overflow-hidden border-2 shadow-lg ${
                  isHot
                    ? 'border-green-500/50 shadow-green-500/10 bg-gradient-to-br from-green-500/10 via-card to-card'
                    : isMed
                    ? 'border-primary/40 shadow-primary/10 bg-gradient-to-br from-primary/10 via-card to-card'
                    : 'border-border bg-card'
                }`}>

                  <div className={`flex items-center gap-3 px-4 py-3 border-b ${
                    isHot ? 'border-green-500/20 bg-green-500/8' : 'border-primary/15 bg-primary/5'
                  }`}>
                    <span className="text-[9px] font-black tracking-[0.2em] text-muted-foreground uppercase">
                      JOGAR AGORA
                    </span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
                      isHot
                        ? 'bg-green-500/15 text-green-400 border-green-500/30'
                        : 'bg-primary/10 text-primary border-primary/20'
                    }`}>
                      {sniperData.strategy.emoji} {sniperData.strategy.label}
                    </span>
                    {sniperData?.recentWinRate !== undefined && (
                      <span className={`ml-auto text-[7px] font-bold font-mono ${
                        sniperData.recentWinRate >= 0.5 ? 'text-green-400' :
                        sniperData.recentWinRate < 0.25 ? 'text-red-400' : 'text-muted-foreground'
                      }`}>
                        WR {(sniperData.recentWinRate * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-5 px-5 py-5">
                    <div className="relative flex-shrink-0">
                      <div className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-black shadow-2xl ring-4 ${
                        ensTop1 === 0
                          ? 'bg-emerald-600 text-white ring-emerald-400/50 shadow-emerald-500/30'
                          : RED_NUMBERS.includes(ensTop1)
                          ? 'bg-red-600 text-white ring-red-400/60 shadow-red-500/30'
                          : 'bg-zinc-800 text-white ring-zinc-500/50 shadow-zinc-600/30'
                      } ${isHot ? 'animate-pulse' : ''}`}>
                        {ensTop1}
                      </div>
                      <div className="absolute -bottom-1 -right-1 bg-card border border-border rounded-full px-1.5 py-0.5">
                        <span className="text-[8px] font-black text-primary">#1</span>
                      </div>
                    </div>

                    <div className="flex-1">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className={`text-4xl font-black font-mono leading-none ${
                          isHot ? 'text-green-400' : isMed ? 'text-primary' : 'text-muted-foreground'
                        }`}>
                          {displayProb}%
                        </span>
                        <span className="text-[9px] text-muted-foreground font-bold">confiança</span>
                      </div>

                      <div className="w-full h-2 bg-secondary/60 rounded-full overflow-hidden mb-2">
                        <motion.div
                          className={`h-full rounded-full ${
                            isHot ? 'bg-gradient-to-r from-green-500 to-emerald-400'
                            : isMed ? 'bg-gradient-to-r from-primary to-primary/70'
                            : 'bg-muted-foreground/40'
                          }`}
                          animate={{ width: `${displayProb}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                        />
                      </div>

                      <div className={`text-[11px] font-black ${
                        isHot ? 'text-green-400' : isMed ? 'text-primary' : 'text-muted-foreground'
                      }`}>
                        {displayProb >= 65 ? '⚡ ENTRAR FORTE — 8-12 fichas'
                         : displayProb >= 50 ? '✅ ENTRAR — 5-7 fichas'
                         : displayProb >= 35 ? '⚠️ ENTRAR LEVE — 3 fichas'
                         : '⏸ AGUARDAR'}
                      </div>
                    </div>
                  </div>

                  <div className="px-4 pb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[8px] font-black text-muted-foreground uppercase tracking-wider">
                        👆 Apostar nestes {finalNumbers.length} números:
                      </span>
                      <span className="text-[7px] text-muted-foreground">
                        {(finalNumbers.length / 37 * 100).toFixed(0)}% da mesa · paga {36 - finalNumbers.length}x
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {finalNumbers.map((n: number) => {
                        const isMain = n === ensTop1;
                        const isHC = highConviction.includes(n) && !isMain;
                        const isProt = PROTECTION_NUMBERS.includes(n) && !isMain && !isHC;
                        return (
                          <motion.div
                            key={n}
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className={`relative flex items-center justify-center rounded-full font-black
                              ${isMain ? 'w-10 h-10 text-sm ring-2 shadow-lg' : 'w-8 h-8 text-[10px] ring-1'}
                              ${n === 0 ? 'bg-emerald-600 text-white'
                                : RED_NUMBERS.includes(n) ? 'bg-red-600 text-white'
                                : 'bg-zinc-800 text-white'}
                              ${isMain ? (isHot ? 'ring-green-400 shadow-green-400/30' : 'ring-primary shadow-primary/20')
                                : isHC ? 'ring-yellow-400/60'
                                : isProt ? 'ring-yellow-600/40 opacity-70'
                                : 'ring-white/10 opacity-85'}
                            `}
                          >
                            {n}
                            {isMain && (
                              <span className="absolute -top-1 -right-1 text-[7px] bg-primary text-primary-foreground rounded-full w-3.5 h-3.5 flex items-center justify-center font-black">1</span>
                            )}
                            {isHC && !isMain && (
                              <span className="absolute -top-0.5 -right-0.5 text-[5px]">⭐</span>
                            )}
                            {isProt && (
                              <span className="absolute -top-0.5 -right-0.5 text-[5px]">🛡️</span>
                            )}
                          </motion.div>
                        );
                      })}
                    </div>

                    <div className="flex gap-3 mt-2">
                      <span className="text-[7px] text-muted-foreground flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-primary inline-block" /> Principal
                      </span>
                      <span className="text-[7px] text-muted-foreground flex items-center gap-1">
                        ⭐ Alta convicção
                      </span>
                      <span className="text-[7px] text-muted-foreground flex items-center gap-1">
                        🛡️ Proteção
                      </span>
                    </div>
                  </div>

                  <div className="px-4 pb-3 border-t border-border/30 pt-2">
                    <p className="text-[9px] text-muted-foreground/80 leading-relaxed line-clamp-2">
                      🧠 {sniperData.strategy.justification}
                    </p>
                  </div>

                </div>
              )}

              {sniperData.signal.convergenceReasons?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {sniperData.signal.convergenceReasons.slice(0, 4).map((r: string, i: number) => (
                    <span key={i} className="text-[7px] px-2 py-0.5 rounded bg-primary/8 text-primary border border-primary/15 font-semibold">
                      {r}
                    </span>
                  ))}
                </div>
              )}

            </div>
          );
        })()}
      </div>
    </motion.div>
  );
};

export default SniperSignal;
