import { useState, useEffect, useRef, memo, useMemo } from 'react';
import { getPredictionExplanation } from '@/lib/getPredictionExplanation';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';

const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const numBg = (n: number) => n === 0 ? 'bg-emerald-600' : RED.has(n) ? 'bg-red-600' : 'bg-zinc-700';

interface BetSignal {
  recommendation: string;
  numbers: number[];
  confidence: number;
  reasoning: string;
  emoji: string;
  payout: string;
}

interface Props {
  sniperData: any;
  sniperCountdown: number;
  sniperStale: boolean;
  lastPredResult: { hit: boolean | null; hitType: string | null; predicted: number | null; actual: number | null; label: string } | null;
  confidenceFilter: boolean;
  rtInsights?: any[];
  allNumbers?: number[];
  autoLearnStatus?: 'idle' | 'learning' | 'analyzing' | 'backtesting';
  strategyFilter?: string;
  setStrategyFilter?: (s: string) => void;
  spinTimestamp?: number;
}

const BET_ORDER = ['cor','paridade','alto_baixo','duzia','coluna','terminal','setor','vizinhos','cavalos','rua','pleno'] as const;

const BET_META: Record<string, { label: string; cat: 'S' | 'M' | 'A' }> = {
  cor: { label: 'Cor', cat: 'S' }, paridade: { label: 'Par/Ímpar', cat: 'S' }, alto_baixo: { label: 'Alto/Baixo', cat: 'S' },
  duzia: { label: 'Dúzia', cat: 'M' }, coluna: { label: 'Coluna', cat: 'M' }, terminal: { label: 'Terminal', cat: 'M' },
  setor: { label: 'Setor', cat: 'A' }, vizinhos: { label: 'Vizinhos', cat: 'A' }, cavalos: { label: 'Cavalos', cat: 'A' },
  rua: { label: 'Rua', cat: 'A' }, pleno: { label: 'Pleno', cat: 'A' },
};

const confColor = (c: number) => c >= 70 ? 'text-primary' : c >= 55 ? 'text-accent' : c >= 40 ? 'text-muted-foreground' : 'text-muted-foreground/50';
const confBg = (c: number) => c >= 70 ? 'bg-primary/12 border-primary/25' : c >= 55 ? 'bg-accent/10 border-accent/20' : 'bg-secondary/50 border-border/30';
const confLabel = (c: number) => c >= 70 ? '🔥' : c >= 55 ? '✅' : c >= 40 ? '⚡' : '👁️';

// ── Compact signal row ──
const SignalRow = memo(({ type, signal }: { type: string; signal: BetSignal }) => {
  const [open, setOpen] = useState(false);
  const meta = BET_META[type] || { label: type, cat: 'A' as const };
  const hasNums = signal.numbers.length > 0 && signal.numbers.length <= 18;

  return (
    <div className={`rounded-xl border ${confBg(signal.confidence)} overflow-hidden transition-all`}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 px-3 py-2 text-left">
        <span className="text-base leading-none">{signal.emoji}</span>
        <div className="flex-1 min-w-0">
          <span className={`text-[11px] font-extrabold ${confColor(signal.confidence)}`}>{signal.recommendation}</span>
          <span className="text-[8px] text-muted-foreground/40 ml-2 font-mono">{meta.label}</span>
        </div>
        <span className={`text-[10px] font-black tabular-nums ${confColor(signal.confidence)}`}>{signal.confidence}%</span>
        <span className="text-[9px]">{confLabel(signal.confidence)}</span>
        {hasNums && (open ? <ChevronUp className="w-3 h-3 text-muted-foreground/30" /> : <ChevronDown className="w-3 h-3 text-muted-foreground/30" />)}
      </button>
      <AnimatePresence>
        {open && hasNums && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-3 pb-2.5 space-y-1">
              <p className="text-[8px] text-muted-foreground/50 leading-relaxed">{signal.reasoning}</p>
              <div className="flex flex-wrap gap-1">
                {signal.numbers.slice(0, 12).map((n, i) => (
                  <span key={`${n}-${i}`} className={`w-6 h-6 rounded text-[8px] font-black text-white flex items-center justify-center ${numBg(n)} ${i === 0 ? 'ring-1 ring-primary/50' : ''}`}>{n}</span>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
SignalRow.displayName = 'SignalRow';

// ── Main Component ──
const SniperSignal = memo(({ sniperData, sniperCountdown, sniperStale, lastPredResult }: Props) => {
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

  // Kill switch
  if (sniperData?.killSwitch) {
    return (
      <div className="rounded-2xl border-2 border-destructive/30 bg-destructive/5 p-6 text-center">
        <div className="text-4xl mb-2">🛡️</div>
        <p className="text-sm font-extrabold text-destructive tracking-wide">PROTEÇÃO ATIVA</p>
        <p className="text-[10px] text-muted-foreground/60 mt-1">{sniperData.killReason || 'Mesa desfavorável — sinais pausados'}</p>
      </div>
    );
  }

  // Loading
  if (!sniperData) {
    return (
      <div className="rounded-2xl border border-border/30 bg-card/50 p-8 text-center">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
          className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary mx-auto" />
        <p className="text-[10px] text-muted-foreground/50 mt-3 font-medium">Inicializando IA...</p>
      </div>
    );
  }

  // No signal
  if (!sniperData?.signal || !sniperData?.strategy) {
    return (
      <div className="rounded-2xl border border-border/20 bg-card/40 p-8 text-center">
        <motion.div animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ repeat: Infinity, duration: 2.5 }}>
          <div className="text-3xl mb-2">⏳</div>
        </motion.div>
        <p className="text-[10px] text-muted-foreground/50">{sniperData?.message || 'Aguardando dados...'}</p>
      </div>
    );
  }

  const allBets: Record<string, BetSignal> = sniperData?.allBetSignals || {};
  const displayProb = sniperData?.signal?.probability || 0;
  const ai = sniperData?.aiReasoning;

  const sorted = BET_ORDER.filter(t => allBets[t]).sort((a, b) => (allBets[b]?.confidence || 0) - (allBets[a]?.confidence || 0));
  const best = sorted[0] ? allBets[sorted[0]] : null;
  const bestType = sorted[0];

  const simples = sorted.filter(t => BET_META[t]?.cat === 'S');
  const medio = sorted.filter(t => BET_META[t]?.cat === 'M');
  const avancado = sorted.filter(t => BET_META[t]?.cat === 'A');

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
      {/* Reed stop */}
      {reedStopped && (
        <div className="rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-2.5 text-center">
          <span className="text-[10px] font-extrabold text-destructive">⛔ 4 erros seguidos — aguarde tendência</span>
        </div>
      )}

      <div className={reedStopped ? 'opacity-25 pointer-events-none space-y-3' : 'space-y-3'}>
        {/* ── HERO SIGNAL ── */}
        {best && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-primary/20 bg-gradient-to-b from-primary/[0.06] to-card/80 p-4 relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

            {/* Countdown */}
            {sniperCountdown > 0 && (
              <div className="absolute top-2 right-3 flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                <span className="text-[9px] font-mono text-primary/60 tabular-nums">{sniperCountdown}s</span>
              </div>
            )}

            <div className="flex items-start gap-3">
              <div className="text-[32px] leading-none mt-0.5">{best.emoji}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[8px] font-bold text-primary/60 uppercase tracking-[0.15em]">ENTRADA</span>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${confBg(best.confidence)} ${confColor(best.confidence)}`}>
                    {best.confidence}% {confLabel(best.confidence)}
                  </span>
                </div>
                <p className="text-lg font-extrabold text-foreground leading-tight tracking-tight">{best.recommendation}</p>
                <p className="text-[9px] text-muted-foreground/50 mt-1 leading-relaxed line-clamp-2">{getPredictionExplanation(best)}</p>

                {/* Numbers */}
                {best.numbers.length > 0 && best.numbers.length <= 18 && (
                  <div className="flex flex-wrap gap-1 mt-2.5">
                    {best.numbers.slice(0, 10).map((n, i) => (
                      <span key={`hero-${n}-${i}`} className={`w-7 h-7 rounded-lg text-[10px] font-black text-white flex items-center justify-center ${numBg(n)} ${i === 0 ? 'ring-2 ring-primary/50 ring-offset-1 ring-offset-background' : ''}`}>{n}</span>
                    ))}
                    {best.numbers.length > 10 && (
                      <span className="w-7 h-7 rounded-lg text-[8px] font-bold flex items-center justify-center bg-secondary text-muted-foreground border border-border/30">+{best.numbers.length - 10}</span>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-3 mt-2 text-[8px] text-muted-foreground/40 font-mono">
                  <span>{BET_META[bestType]?.label}</span>
                  <span>·</span>
                  <span>Paga {best.payout}</span>
                  {displayProb > 0 && <><span>·</span><span>Prob {displayProb}%</span></>}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── ALL SIGNALS ── */}
        {simples.length > 0 && (
          <Section label="Simples · 1:1">
            {simples.map(t => <SignalRow key={t} type={t} signal={allBets[t]} />)}
          </Section>
        )}
        {medio.length > 0 && (
          <Section label="Dúzia · Coluna · Terminal">
            {medio.map(t => <SignalRow key={t} type={t} signal={allBets[t]} />)}
          </Section>
        )}
        {avancado.length > 0 && (
          <Section label="Setor · Vizinhos · Pleno">
            {avancado.filter(t => t !== bestType).map(t => <SignalRow key={t} type={t} signal={allBets[t]} />)}
          </Section>
        )}

        {/* ── AI REASONING ── */}
        {ai?.suggestedBet && (
          <div className="rounded-xl border border-border/20 bg-card/40 px-3.5 py-2.5">
            <p className="text-[8px] text-muted-foreground/50 leading-relaxed">🧠 {ai.suggestedBet.slice(0, 200)}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
});

const Section = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <span className="text-[7px] font-bold text-muted-foreground/35 uppercase tracking-[0.2em] px-0.5">{label}</span>
    <div className="space-y-1.5 mt-1">{children}</div>
  </div>
);

SniperSignal.displayName = 'SniperSignal';
export default SniperSignal;
