import { useState, useEffect, useRef, memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Crosshair, AlertTriangle, Clock, ShieldCheck, Zap, Brain, TrendingUp } from 'lucide-react';

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

const numColor = (n: number) =>
  n === 0 ? 'bg-emerald-600 text-white' : RED_NUMBERS.has(n) ? 'bg-red-600 text-white' : 'bg-zinc-800 text-white';

const getBetLabel = (type: string) => {
  const map: Record<string, string> = {
    pleno: '💎 PLENO', numero_exato: '💎 PLENO',
    terminal: '🔢 TERMINAIS', terminal_comp: '🔢 TERMINAIS', terminal_alternation: '🔢 TERMINAIS',
    duplo_terminal: '🔢 TERMINAIS', terminais_cruzados: '🔢 TERMINAIS',
    cavalos: '🐎 CAVALOS', cavalos_comp: '🐎 CAVALOS', cavalo_split: '🐎 CAVALOS',
    setor: '🎯 SETOR', vizinhos: '🎯 VIZINHOS', sniper: '🎯 SNIPER', voisins: '🎯 VOISINS',
    duzia: '🎲 DÚZIA', duzia_unica: '🎲 DÚZIA', dozen_phase: '🎲 DÚZIA', duzias: '🎲 DÚZIAS',
    coluna: '📐 COLUNA', column_cycle: '📐 COLUNA',
    cor: '🎨 COR', paridade: '🔄 PAR/ÍMPAR', alto_baixo: '↕️ ALTO/BAIXO',
    fusao_suprema: '⚡ FUSÃO', convergencia_absoluta: '💠 CONVERGÊNCIA',
    ultra_sniper: '🔥 ULTRA SNIPER', numeros_puxam: '🧲 PUXADA',
    pressao_zero: '🟢 ZERO', jeu_zero: '🟢 ZERO',
    ensemble_supremo: '🌟 ENSEMBLE', matrix_fusion: '🔮 MATRIZ',
    combo_ouro: '👑 COMBO OURO', combo_prata: '🥈 COMBO PRATA',
    ritmo_calibrado: '🎯 RITMO',
  };
  return map[type] || `📌 ${type.replace(/_/g, ' ').toUpperCase()}`;
};

const getActionLevel = (prob: number) => {
  if (prob >= 85) return { label: '🔥 ENTRAR FORTE', color: 'text-neon-green', borderClass: 'border-neon-green/50' };
  if (prob >= 65) return { label: '✅ ENTRAR', color: 'text-primary', borderClass: 'border-primary/40' };
  if (prob >= 45) return { label: '⚠️ SINAL MODERADO', color: 'text-yellow-400', borderClass: 'border-yellow-400/30' };
  return { label: '⏸ AGUARDAR', color: 'text-muted-foreground', borderClass: 'border-border' };
};

interface Props {
  sniperData: any;
  sniperCountdown: number;
  sniperStale: boolean;
  lastPredResult: { hit: boolean | null; hitType: string | null; predicted: number | null; actual: number | null; label: string } | null;
  confidenceFilter: boolean;
  rtInsights?: any[];
  allNumbers?: number[];
}

const SniperSignal = memo(({ sniperData, sniperStale, lastPredResult, allNumbers = [] }: Props) => {
  const [reedCount, setReedCount] = useState(0);
  const prevHitRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (!lastPredResult || lastPredResult.hit === null) return;
    if (lastPredResult.hit === prevHitRef.current) return;
    prevHitRef.current = lastPredResult.hit;
    if (lastPredResult.hit) setReedCount(0);
    else setReedCount(prev => Math.min(prev + 1, 4));
  }, [lastPredResult?.hit]);

  const reedStopped = reedCount >= 4;

  const { ensTop1, finalNumbers, displayProb } = useMemo(() => {
    if (!sniperData?.signal || !sniperData?.strategy) {
      return { ensTop1: 0, finalNumbers: [], displayProb: 0 };
    }
    const top1 = sniperData.ensemble?.top1 ?? sniperData.topCandidates?.[0]?.num ?? sniperData.strategy.numbers[0];
    const nums: number[] = sniperData.strategy.numbers || [];
    const rawProb = sniperData.signal.probability || 0;
    return { ensTop1: top1, finalNumbers: nums, displayProb: rawProb };
  }, [sniperData]);

  const gapInfo = useMemo(() => {
    if (!ensTop1 || allNumbers.length < 10) return null;
    const lastIdx = allNumbers.indexOf(ensTop1);
    if (lastIdx < 0) return { delay: allNumbers.length };
    if (lastIdx === 0) return { delay: 0 };
    const positions = allNumbers.reduce((acc: number[], n, i) => { if (n === ensTop1) acc.push(i); return acc; }, []);
    const gaps = positions.slice(0, -1).map((p, i) => positions[i + 1] - p);
    const avgGap = gaps.length > 0 ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : 37;
    const progress = Math.min(100, Math.round((lastIdx / avgGap) * 100));
    return { delay: lastIdx, avgGap, progress, isNear: lastIdx >= avgGap * 0.7 };
  }, [ensTop1, allNumbers]);

  // Loading
  if (!sniperData) {
    return (
      <div className="bg-card rounded-2xl border border-border p-12 flex items-center justify-center">
        <div className="text-center">
          <Crosshair className="w-8 h-8 text-primary/30 mx-auto mb-3 animate-pulse" />
          <p className="text-sm text-muted-foreground">Carregando IA...</p>
        </div>
      </div>
    );
  }

  // Stale — show last result
  if (sniperStale && lastPredResult) {
    return (
      <div className="bg-card rounded-2xl border border-border p-6">
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center border-2 ${
            lastPredResult.hit ? 'bg-green-500/15 border-green-500/40' : 'bg-destructive/15 border-destructive/40'
          }`}>
            {lastPredResult.hit
              ? <ShieldCheck className="w-7 h-7 text-green-400" />
              : <AlertTriangle className="w-7 h-7 text-destructive" />}
          </div>
          <div>
            <span className={`text-lg font-black ${lastPredResult.hit ? 'text-green-400' : 'text-destructive'}`}>
              {lastPredResult.hit
                ? (lastPredResult.hitType === 'exact' ? '🎯 ACERTO EXATO!' : '✅ ACERTO!')
                : '❌ ERRO'}
            </span>
            <div className="flex gap-3 text-xs text-muted-foreground mt-1">
              <span>Previsto: <strong className="text-foreground">{lastPredResult.predicted}</strong></span>
              <span>Saiu: <strong className="text-foreground">{lastPredResult.actual}</strong></span>
            </div>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground/50 mt-3 text-center">⏳ Aguardando próximo giro...</p>
      </div>
    );
  }

  // No signal
  if (!sniperData?.signal || !sniperData?.strategy) {
    return (
      <div className="bg-card rounded-2xl border border-border p-8 text-center">
        <Clock className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">{sniperData?.message || 'Aguardando dados...'}</p>
      </div>
    );
  }

  const action = getActionLevel(displayProb);
  const betType = getBetLabel(sniperData.strategy.type);
  const ai = sniperData?.aiReasoning;
  const lastNumber = allNumbers?.[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border-2 overflow-hidden shadow-xl bg-card ${action.borderClass}`}
    >
      {/* REED STOP */}
      {reedStopped && (
        <div className="bg-destructive/10 border-b border-destructive/30 p-3 text-center">
          <span className="text-xs font-black text-destructive">⛔ PAUSE — 4 erros seguidos</span>
        </div>
      )}

      <div className={reedStopped ? 'opacity-30 pointer-events-none' : ''}>

        {/* ═══ PROTOCOLO ESTRUTURADO ═══ */}

        {/* 1. ENTRADA — Último número */}
        {lastNumber !== undefined && (
          <div className="flex items-center gap-3 px-5 py-3 border-b border-border/20 bg-secondary/20">
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Entrada</span>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black ${numColor(lastNumber)}`}>
              {lastNumber}
            </div>
            {ai?.feedbackAction && (
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ml-auto ${
                ai.feedbackAction === 'reforçar' ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                : ai.feedbackAction === 'ajustar' ? 'bg-yellow-400/10 text-yellow-400 border border-yellow-400/20'
                : 'bg-secondary text-muted-foreground border border-border/30'
              }`}>
                {ai.feedbackAction === 'reforçar' ? '✅ Reforçar' : ai.feedbackAction === 'ajustar' ? '🔄 Ajustando' : '➡️ Manter'}
              </span>
            )}
          </div>
        )}

        {/* 2. ANÁLISE DE PADRÃO */}
        {ai?.patternAnalysis && (
          <div className="px-5 py-3 border-b border-border/20">
            <div className="flex items-center gap-2 mb-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-[9px] font-black text-cyan-400 uppercase tracking-wider">Análise de Padrão</span>
              {ai.sectorFocus && ai.sectorFocus !== 'misto' && (
                <span className="text-[8px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-bold ml-auto">
                  Foco: {ai.sectorFocus}
                </span>
              )}
            </div>
            <p className="text-[10px] text-foreground/80 leading-relaxed">{ai.patternAnalysis}</p>
          </div>
        )}

        {/* 3. PRÓXIMA JOGADA */}
        <div className="p-5">
          {/* Header: bet type */}
          <div className="flex items-center justify-between mb-4">
            <span className="font-display text-xs tracking-widest font-black uppercase text-foreground">
              {betType}
            </span>
            {sniperData?.recentWinRate !== undefined && (
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                sniperData.recentWinRate >= 0.5 ? 'bg-neon-green/10 text-neon-green'
                : sniperData.recentWinRate < 0.25 ? 'bg-destructive/10 text-destructive'
                : 'bg-secondary text-muted-foreground'
              }`}>
                WR {(sniperData.recentWinRate * 100).toFixed(0)}%
              </span>
            )}
          </div>

          {/* Hero: Number + Assertiveness */}
          <div className="flex items-center gap-5 mb-4">
            <div className="relative shrink-0">
              <motion.div
                animate={displayProb >= 85 ? { scale: [1, 1.05, 1] } : {}}
                transition={{ duration: 1.5, repeat: Infinity }}
                className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl font-black shadow-2xl ring-4 ${numColor(ensTop1)} ${
                  displayProb >= 85 ? 'ring-neon-green/60 shadow-neon-green/30' : 'ring-primary/30'
                }`}
              >
                {ensTop1}
              </motion.div>
            </div>

            <div className="flex-1 min-w-0">
              {/* 4. ASSERTIVIDADE */}
              <div className="flex items-baseline gap-2 mb-1">
                <span className={`text-4xl font-black font-mono leading-none ${action.color}`}>
                  {displayProb}%
                </span>
              </div>

              <div className="flex items-center gap-2 mb-2">
                <Zap className={`w-4 h-4 ${action.color}`} />
                <span className={`text-sm font-black ${action.color}`}>{action.label}</span>
              </div>

              {/* Gap */}
              {gapInfo && gapInfo.avgGap && (
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>#{ensTop1} ausente há {gapInfo.delay} giros</span>
                  <div className="w-14 h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${gapInfo.isNear ? 'bg-neon-green' : 'bg-primary/50'}`}
                      style={{ width: `${gapInfo.progress}%` }} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* AI Reasoning */}
          {ai?.reasoning && (
            <div className="mb-4 p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/15">
              <div className="flex items-center gap-2 mb-1.5">
                <Brain className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-[9px] font-black text-cyan-400 uppercase tracking-wider">Raciocínio IA</span>
                {ai.confidence !== null && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 font-bold ml-auto">
                    {ai.confidence}% confiança
                  </span>
                )}
              </div>
              <p className="text-[10px] text-cyan-300/80 leading-relaxed">{ai.reasoning}</p>
            </div>
          )}

          {/* Learned */}
          {ai?.learned && (
            <div className="mb-4 p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/15">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[8px]">📚</span>
                <span className="text-[8px] font-black text-amber-400 uppercase tracking-wider">Aprendizado Aplicado</span>
              </div>
              <p className="text-[9px] text-amber-300/70 leading-relaxed">{ai.learned}</p>
            </div>
          )}

          {/* Numbers to bet */}
          <div className="border-t border-border/20 pt-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                Apostar → {finalNumbers.length} números
              </span>
              <span className="text-[9px] text-muted-foreground font-mono">
                paga {Math.max(1, 36 - finalNumbers.length)}x
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {finalNumbers.map((n: number, i: number) => {
                const isMain = i === 0 || n === ensTop1;
                return (
                  <motion.div
                    key={n}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className={`flex items-center justify-center rounded-full font-black shadow-md
                      ${isMain ? 'w-11 h-11 text-sm ring-2' : 'w-9 h-9 text-xs ring-1'}
                      ${numColor(n)}
                      ${isMain ? (displayProb >= 85 ? 'ring-neon-green' : 'ring-primary') : 'ring-white/10 opacity-80'}
                    `}
                  >
                    {n}
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
});

SniperSignal.displayName = 'SniperSignal';
export default SniperSignal;
