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
        
        {/* Ultra Conservador Badge */}
        {sniperData?.ultraConservadorMode && (
          <span className="text-[7px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 font-bold">
            🛡️ CONSERVADOR
          </span>
        )}

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

      {/* Barra de Score de Confiança */}
      {sniperData && probability > 0 && (
        <div className="px-4 pt-2 pb-1 border-b border-border/30">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest">
              Score de Confiança
            </span>
            <div className="flex items-center gap-2">
              <span className={`text-[9px] font-bold ${
                probability >= 75 ? 'text-yellow-400' :
                probability >= 50 ? 'text-green-400' :
                probability >= 25 ? 'text-orange-400' : 'text-muted-foreground'
              }`}>
                {probability >= 75 ? '⚡ SINAL FORTE' :
                 probability >= 50 ? '✅ MODERADO' :
                 probability >= 25 ? '⚠️ FRACO' : '⏸ AGUARDAR'}
              </span>
              <span className={`text-sm font-mono font-black ${probColor(probability)}`}>{probability}%</span>
            </div>
          </div>
          <div className="w-full h-2 bg-secondary/60 rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${
                probability >= 75 ? 'bg-gradient-to-r from-yellow-500 to-amber-400 shadow-[0_0_8px_rgba(234,179,8,0.4)]' :
                probability >= 50 ? 'bg-gradient-to-r from-green-500 to-emerald-400' :
                probability >= 25 ? 'bg-gradient-to-r from-orange-500 to-amber-400' :
                'bg-gradient-to-r from-muted-foreground/40 to-muted-foreground/20'
              }`}
              animate={{ width: `${probability}%` }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
            />
          </div>
          <div className="flex items-center justify-between mt-0.5">
            <span className="text-[7px] text-muted-foreground">Fichas sugeridas:</span>
            <span className="text-[8px] font-bold text-foreground">
              {probability >= 75 ? '8-12 fichas' :
               probability >= 50 ? '5-7 fichas' :
               probability >= 25 ? '3-4 fichas' : 'Não entrar'}
            </span>
          </div>
          {/* Win Rate Recente */}
          {sniperData?.recentWinRate !== undefined && (
            <div className="flex items-center justify-between mt-1">
              <span className="text-[7px] text-muted-foreground">Win rate recente (10):</span>
              <span className={`text-[8px] font-mono font-bold ${
                sniperData.recentWinRate >= 0.5 ? 'text-green-400' :
                sniperData.recentWinRate >= 0.3 ? 'text-yellow-400' :
                'text-red-400'
              }`}>
                {(sniperData.recentWinRate * 100).toFixed(0)}%
                {sniperData.recentWinRate >= 0.5 ? ' 🔥' :
                 sniperData.recentWinRate < 0.25 ? ' 🛡️' : ''}
              </span>
            </div>
          )}
        </div>
      )}

      {/* TREND ENGINE */}
      {sniperData?.trendEngine && Number(sniperData.trendEngine.confidence) > 30 && (
        <div className="px-4 py-2 border-b border-border/30">
          <div className="flex items-center gap-2 mb-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[9px] font-bold text-cyan-400 tracking-widest uppercase">
              Tendências Ativas
            </span>
            <span className={`ml-auto text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border ${
              sniperData.trendEngine.confidence >= 70 ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30' :
              'bg-secondary text-muted-foreground border-border'
            }`}>{Number(sniperData.trendEngine.confidence)}%</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {sniperData.trendEngine.colorTrend?.direction && (
              <span className={`text-[8px] px-1.5 py-0.5 rounded-full border font-bold ${
                sniperData.trendEngine.colorTrend.direction === 'red'
                  ? 'bg-red-500/15 text-red-400 border-red-500/30'
                  : 'bg-secondary/60 text-muted-foreground border-border'
              }`}>
                {sniperData.trendEngine.colorTrend.direction === 'red' ? '🔴 Vermelho' : '⚫ Preto'}
              </span>
            )}
            {sniperData.trendEngine.parityTrend?.direction && (
              <span className="text-[8px] px-1.5 py-0.5 rounded-full border font-bold bg-purple-500/15 text-purple-400 border-purple-500/30">
                {sniperData.trendEngine.parityTrend.direction === 'par' ? 'PAR' : 'ÍMPAR'}
              </span>
            )}
            {sniperData.trendEngine.highLowTrend?.direction && (
              <span className="text-[8px] px-1.5 py-0.5 rounded-full border font-bold bg-blue-500/15 text-blue-400 border-blue-500/30">
                {sniperData.trendEngine.highLowTrend.direction === 'alto' ? '↑ ALTO' : '↓ BAIXO'}
              </span>
            )}
            {sniperData.trendEngine.dozenTrend?.direction && (
              <span className="text-[8px] px-1.5 py-0.5 rounded-full border font-bold bg-amber-500/15 text-amber-400 border-amber-500/30">
                D{sniperData.trendEngine.dozenTrend.direction}
              </span>
            )}
            {sniperData.trendEngine.sectorTrend?.direction && (
              <span className="text-[8px] px-1.5 py-0.5 rounded-full border font-bold bg-green-500/15 text-green-400 border-green-500/30">
                {sniperData.trendEngine.sectorTrend.direction}
              </span>
            )}
            {sniperData.trendEngine.mode && sniperData.trendEngine.mode !== 'NEUTRO' && (
              <span className="text-[8px] px-1.5 py-0.5 rounded-full border font-bold bg-primary/15 text-primary border-primary/30">
                {sniperData.trendEngine.mode === 'TENDENCIA' ? '🔁 Tendência' :
                 sniperData.trendEngine.mode === 'REVERSAO' ? '🔄 Reversão' : ''}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Dealer Shift Alert */}
      {sniperData?.dealerShift?.detected && (
        <div className="mx-4 mt-2 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center gap-2">
          <span className="text-sm">🎭</span>
          <span className="text-[8px] text-purple-400 font-bold">
            DEALER SHIFT — Arco {sniperData.dealerShift.oldArc} → {sniperData.dealerShift.newArc} | Padrão reiniciando
          </span>
        </div>
      )}

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
                    <span className="text-[8px] text-muted-foreground font-bold uppercase tracking-wider block mb-1.5">📍 Números para apostar:</span>
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

                  {/* TOP CANDIDATOS */}
                  {sniperData?.topCandidates?.length > 0 && (
                    <div className="px-4 py-2 border-t border-primary/10">
                      <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-wide block mb-1">
                        🏆 Top Candidatos (Score IA)
                      </span>
                      <div className="flex gap-1.5 flex-wrap">
                        {sniperData.topCandidates.slice(0, 5).map((c: any, i: number) => (
                          <div key={c.num} className={`flex flex-col items-center gap-0.5 ${i === 0 ? 'opacity-100' : 'opacity-70'}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold border-2 ${
                              c.num === 0 ? 'bg-emerald-600 text-white border-emerald-400/50' :
                              RED_NUMBERS.includes(c.num) ? 'bg-red-600 text-white border-red-400/50' :
                              'bg-zinc-800 text-white border-zinc-500/50'
                            } ${i === 0 ? 'ring-2 ring-yellow-400/50 shadow-md shadow-yellow-400/20' : ''}`}>
                              {c.num}
                            </div>
                            <span className={`text-[6px] font-mono font-bold ${i === 0 ? 'text-yellow-400' : 'text-muted-foreground'}`}>
                              {c.score.toFixed(0)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* COMO APOSTAR — Instrução clara */}
                  <div className="px-4 py-2.5 border-t border-primary/15 bg-primary/5">
                    <div className="flex items-start gap-2">
                      <span className="text-base mt-0.5">👆</span>
                      <div>
                        <span className="text-[9px] font-black text-primary tracking-wide block mb-0.5">COMO APOSTAR:</span>
                        <p className="text-[10px] text-foreground/90 leading-relaxed">
                          {getHowToBet(sniperData.strategy.type, sniperData.strategy.numbers, mainNumber)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Stats compactos */}
                  <div className="flex items-center gap-2 px-4 py-2 border-t border-primary/15 text-[9px] text-muted-foreground">
                    <span>💰 Ganho: <strong className="text-primary">{sniperData.strategy.payout}x</strong> sua aposta</span>
                    <span className="text-border">•</span>
                    <span>🎯 <strong className="text-foreground">{sniperData.strategy.numbers.length}</strong> números</span>
                    <span className="text-border">•</span>
                    <span>📊 <strong className="text-foreground">{sniperData.strategy.coverage}%</strong> da mesa</span>
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
                      <div className="flex items-center gap-2 px-3 py-2.5 bg-yellow-500/10 border-b border-yellow-500/20">
                        <Zap className="w-3.5 h-3.5 text-yellow-400" />
                        <div>
                          <span className="text-[10px] font-black tracking-wide text-yellow-400 block">
                            JOGADA COMBINADA
                          </span>
                          <span className="text-[8px] text-yellow-400/60">
                            {strats.length} análises diferentes concordam nestes números
                          </span>
                        </div>
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
                        <span className="text-[8px] text-muted-foreground font-bold block mb-1.5">📍 Coloque 1 ficha em cada número:</span>
                        {highlighted.length > 0 && (
                          <span className="text-[9px] text-yellow-400 font-bold block mb-1">⭐ Priorize os {highlighted.length} números com estrela (aparecem em várias análises):</span>
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

                      <div className="flex items-center gap-2 px-3 py-2 border-t border-yellow-500/15 text-[9px] text-muted-foreground">
                        <span>💰 Ganho: <strong className="text-foreground">{cb.payout}x</strong></span>
                        <span className="text-border">•</span>
                        <span>🎯 <strong className="text-foreground">{cb.numbers.length}</strong> números</span>
                        <span className="text-border">•</span>
                        <span>📊 <strong className="text-foreground">{cb.coverage}%</strong> mesa</span>
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
                  <span className="text-[9px] text-muted-foreground font-bold tracking-wide">🧠 POR QUE A IA ESCOLHEU ESTA JOGADA:</span>
                  <p className="text-[10px] text-foreground/80 mt-1 leading-relaxed">{sniperData.strategy.justification}</p>
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
