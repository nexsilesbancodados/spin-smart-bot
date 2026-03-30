import { useState, useEffect, useRef, memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Crosshair, AlertTriangle, Clock, ShieldCheck, Zap } from 'lucide-react';

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

  // Compute final numbers
  const { ensTop1, finalNumbers, highConviction, displayProb, dynamicProtection } = useMemo(() => {
    if (!sniperData?.signal || !sniperData?.strategy) {
      return { ensTop1: 0, finalNumbers: [], highConviction: [], displayProb: 0, dynamicProtection: [] };
    }

    const top1 = sniperData.ensemble?.top1 ?? sniperData.topCandidates?.[0]?.num ?? sniperData.strategy.numbers[0];
    const supportPool: number[] = [
      ...(sniperData.ensemble?.top5 || []),
      ...(sniperData.strategy.numbers || []),
      ...(sniperData.topCandidates?.slice(0, 5).map((c: any) => c.num) || []),
    ].filter((n: number) => n !== top1 && n >= 0 && n <= 36);

    const scoreCount: Record<number, number> = {};
    supportPool.forEach((n: number) => { scoreCount[n] = (scoreCount[n] || 0) + 1; });
    const sortedSupport = [...new Set(supportPool)].sort((a, b) => (scoreCount[b] || 0) - (scoreCount[a] || 0));

    const prot: number[] = sniperData?.signal?.protection || sniperData?.strategy?.protection || [];
    const protFiltered = prot.filter((n: number) => n !== top1);
    const support = sortedSupport.slice(0, 8);
    const final: number[] = [...new Set([top1, ...support, ...protFiltered])].slice(0, 12);

    const hc = final.filter(n => {
      const inE = (sniperData.ensemble?.top5 || []).includes(n);
      const inW = (sniperData.strategy.numbers || []).includes(n);
      const inC = (sniperData.topCandidates || []).slice(0, 3).some((c: any) => c.num === n);
      return (inE ? 1 : 0) + (inW ? 1 : 0) + (inC ? 1 : 0) >= 2;
    });

    const rawProb = sniperData.signal.probability || 0;
    const coverage = (final.length / 37) * 100;
    const prob = Math.min(rawProb, Math.round(coverage + 20));

    return { ensTop1: top1, finalNumbers: final, highConviction: hc, displayProb: prob, dynamicProtection: protFiltered };
  }, [sniperData]);

  // Gap info
  const gapInfo = useMemo(() => {
    if (!ensTop1 || allNumbers.length < 10) return null;
    const lastIdx = allNumbers.indexOf(ensTop1);
    if (lastIdx < 0) return { delay: allNumbers.length, label: `>${allNumbers.length}`, hot: false };
    if (lastIdx === 0) return { delay: 0, label: 'agora', hot: true };
    const positions = allNumbers.reduce((acc: number[], n, i) => { if (n === ensTop1) acc.push(i); return acc; }, []);
    const gaps = positions.slice(0, -1).map((p, i) => positions[i + 1] - p);
    const avgGap = gaps.length > 0 ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : 37;
    const progress = Math.min(100, Math.round((lastIdx / avgGap) * 100));
    return { delay: lastIdx, avgGap, progress, isNear: lastIdx >= avgGap * 0.7 };
  }, [ensTop1, allNumbers]);

  // Loading state
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

  // Waiting for result
  if (sniperStale && lastPredResult) {
    return (
      <div className="bg-card rounded-2xl border border-border p-8">
        <div className="flex flex-col items-center gap-3">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center border-2 ${
            lastPredResult.hit
              ? 'bg-green-500/15 border-green-500/40'
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
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>Previsto: <strong className="text-foreground">{lastPredResult.predicted}</strong></span>
            <span>Saiu: <strong className="text-foreground">{lastPredResult.actual}</strong></span>
          </div>
          <span className="text-[9px] text-muted-foreground/50">Aguardando nova jogada...</span>
        </div>
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

  const isHot = displayProb >= 90;
  const isMed = displayProb >= 60;
  const confs = sniperData?.signal?.confirmations || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border-2 overflow-hidden shadow-xl bg-card"
      style={{
        borderColor: reedStopped ? 'hsl(var(--destructive) / 0.5)'
          : isHot ? 'hsl(var(--neon-green) / 0.5)'
          : isMed ? 'hsl(var(--primary) / 0.4)'
          : 'hsl(var(--border))',
      }}
    >
      {/* REED STOP */}
      {reedStopped && (
        <div className="bg-destructive/10 border-b border-destructive/30 p-3 text-center">
          <span className="text-xs font-black text-destructive">⛔ REED STOP — 4 erros seguidos, pause</span>
        </div>
      )}

      {/* Header */}
      <div className={`flex items-center justify-between px-5 py-3 border-b ${
        isHot ? 'bg-neon-green/5 border-neon-green/20' : 'bg-primary/5 border-border/40'
      }`}>
        <div className="flex items-center gap-2">
          <Crosshair className={`w-4 h-4 ${isHot ? 'text-neon-green' : 'text-primary'}`} />
          <span className="font-display text-[11px] tracking-[0.2em] font-black uppercase text-foreground">
            {getBetLabel(sniperData.strategy.type)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {sniperData?.recentWinRate !== undefined && (
            <span className={`text-[9px] font-mono font-bold ${
              sniperData.recentWinRate >= 0.5 ? 'text-neon-green' : sniperData.recentWinRate < 0.25 ? 'text-destructive' : 'text-muted-foreground'
            }`}>
              WR {(sniperData.recentWinRate * 100).toFixed(0)}%
            </span>
          )}
          {confs > 0 && (
            <span className="text-[8px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-bold">
              {confs} confirmações
            </span>
          )}
        </div>
      </div>

      <div className={`p-5 ${reedStopped ? 'opacity-30 pointer-events-none' : ''}`}>
        {/* Main signal */}
        <div className="flex items-center gap-6 mb-5">
          {/* Big number */}
          <div className="relative shrink-0">
            <div className={`w-24 h-24 rounded-full flex items-center justify-center text-3xl font-black shadow-2xl ring-4 ${
              ensTop1 === 0
                ? 'bg-emerald-600 text-white ring-emerald-400/50'
                : RED_NUMBERS.has(ensTop1)
                ? 'bg-red-600 text-white ring-red-400/60'
                : 'bg-zinc-800 text-white ring-zinc-500/50'
            } ${isHot ? 'animate-pulse shadow-neon-green' : ''}`}>
              {ensTop1}
            </div>
            <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-[9px] font-black border-2 border-card">
              #1
            </div>
          </div>

          {/* Probability + level */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 mb-2">
              <span className={`text-5xl font-black font-mono leading-none ${
                isHot ? 'text-neon-green' : isMed ? 'text-primary' : 'text-muted-foreground'
              }`}>
                {displayProb}%
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full h-2.5 bg-secondary/60 rounded-full overflow-hidden mb-3">
              <motion.div
                className={`h-full rounded-full ${
                  isHot ? 'bg-gradient-to-r from-green-500 to-emerald-400'
                  : isMed ? 'bg-gradient-to-r from-primary to-primary/70'
                  : 'bg-muted-foreground/40'
                }`}
                animate={{ width: `${displayProb}%` }}
                transition={{ duration: 0.6 }}
              />
            </div>

            {/* Action level */}
            {confs >= 3 || displayProb >= 65 ? (
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-neon-green" />
                <span className="text-sm font-black text-neon-green">ENTRAR FORTE — {finalNumbers.length} fichas</span>
              </div>
            ) : confs >= 2 || displayProb >= 50 ? (
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                <span className="text-sm font-black text-primary">ENTRAR — top 5 números</span>
              </div>
            ) : confs >= 1 || displayProb >= 35 ? (
              <span className="text-sm font-black text-yellow-400">⚠️ SINAL FRACO — 1-2 fichas no #{ensTop1}</span>
            ) : (
              <span className="text-sm font-black text-muted-foreground">⏸ AGUARDAR</span>
            )}

            {/* Gap indicator */}
            {gapInfo && gapInfo.avgGap && (
              <div className="flex items-center gap-2 mt-2 text-[9px]">
                <span className="text-muted-foreground">
                  #{ensTop1} ausente {gapInfo.delay}/{gapInfo.avgGap} giros
                </span>
                <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${gapInfo.isNear ? 'bg-neon-green' : 'bg-primary/50'}`}
                    style={{ width: `${gapInfo.progress}%` }} />
                </div>
                {gapInfo.isNear && <span className="text-neon-green font-bold">🎯 NA HORA</span>}
              </div>
            )}

            {/* Confirmations */}
            {sniperData?.signal?.confirmationDetail && confs > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {sniperData.signal.confirmationDetail.pull && (
                  <span className="text-[8px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-bold">🧲 Puxada</span>
                )}
                {sniperData.signal.confirmationDetail.autoRep && (
                  <span className="text-[8px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/30 font-bold">🔁 Repetiu</span>
                )}
                {sniperData.signal.confirmationDetail.matriz && (
                  <span className="text-[8px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/30 font-bold">🔢 Matriz</span>
                )}
                {sniperData.signal.confirmationDetail.ensemble && (
                  <span className="text-[8px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 font-bold">🌟 Ensemble</span>
                )}
                {sniperData.signal.confirmationDetail.winner && (
                  <span className="text-[8px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-bold">⚡ Estratégia</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bet numbers */}
        <div className="border-t border-border/40 pt-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">
              👆 Apostar nestes {finalNumbers.length} números
            </span>
            <span className="text-[9px] text-muted-foreground font-mono">
              {(finalNumbers.length / 37 * 100).toFixed(0)}% da mesa · paga {36 - finalNumbers.length}x
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {finalNumbers.map((n: number) => {
              const isMain = n === ensTop1;
              const isHC = highConviction.includes(n) && !isMain;
              const isProt = dynamicProtection.includes(n) && !isMain && !isHC;
              return (
                <motion.div
                  key={n}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className={`relative flex items-center justify-center rounded-full font-black shadow-md
                    ${isMain ? 'w-12 h-12 text-base ring-3' : 'w-9 h-9 text-xs ring-1'}
                    ${numColor(n)}
                    ${isMain ? (isHot ? 'ring-neon-green shadow-neon-green' : 'ring-primary shadow-primary/20')
                      : isHC ? 'ring-yellow-400/60'
                      : isProt ? 'ring-yellow-600/40 opacity-70'
                      : 'ring-white/10 opacity-85'}
                  `}
                >
                  {n}
                  {isMain && (
                    <span className="absolute -top-1 -right-1 text-[7px] bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center font-black">1</span>
                  )}
                  {isHC && !isMain && <span className="absolute -top-0.5 -right-0.5 text-[6px]">⭐</span>}
                  {isProt && <span className="absolute -top-0.5 -right-0.5 text-[6px]">🛡️</span>}
                </motion.div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex gap-4 mt-3 text-[8px] text-muted-foreground/60">
            <span>🔴 = #1 alvo</span>
            <span>⭐ = alta convicção</span>
            <span>🛡️ = proteção</span>
          </div>
        </div>

        {/* Justification */}
        {sniperData?.strategy?.justification && (
          <div className="mt-4 p-3 rounded-lg bg-secondary/30 border border-border/40">
            <span className="text-[9px] text-muted-foreground leading-relaxed">{sniperData.strategy.justification}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
});

SniperSignal.displayName = 'SniperSignal';
export default SniperSignal;
