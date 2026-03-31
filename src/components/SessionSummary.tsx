import { useMemo } from 'react';
import { motion } from 'framer-motion';

const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

interface Props { allNumbers: number[] }

const SessionSummary = ({ allNumbers }: Props) => {
  const stats = useMemo(() => {
    const s50 = allNumbers.slice(0, 50);
    if (s50.length < 10) return null;

    const freq: Record<number, number> = {};
    s50.forEach(n => { freq[n] = (freq[n] || 0) + 1; });

    const hot = Object.entries(freq).filter(([,c]) => c >= 3).map(([n]) => Number(n)).slice(0, 5);
    const cold = Array.from({length: 37}, (_, i) => i).filter(n => !freq[n]).slice(0, 5);

    const reds = s50.filter(n => RED.has(n)).length;
    const blacks = s50.filter(n => !RED.has(n) && n !== 0).length;
    const corDom = reds > blacks * 1.2 ? '🔴' : blacks > reds * 1.2 ? '⚫' : '⚖️';

    const termFreq: Record<number,number> = {};
    s50.forEach(n => { const t = n%10; termFreq[t] = (termFreq[t]||0)+1; });
    const hotTerminal = Object.entries(termFreq).sort(([,a],[,b])=>b-a)[0];

    const zeroIdx = s50.indexOf(0);
    const zeroDelay = zeroIdx === -1 ? s50.length : zeroIdx;

    const distintos = new Set(s50.slice(0,15).map(n=>n%10)).size;

    let recomendacao = '';
    let recColor = 'text-muted-foreground';
    if (distintos <= 4 && zeroDelay < 40) {
      recomendacao = '✅ ENTRAR — Entropia baixa, sessão concentrada';
      recColor = 'text-neon-green';
    } else if (zeroDelay > 40) {
      recomendacao = '🚨 PRESSÃO ZERO CRÍTICA — priorizar Vizinhos do Zero';
      recColor = 'text-destructive';
    } else if (distintos >= 8) {
      recomendacao = '⏸ AGUARDAR — Alta dispersão, sem padrão claro';
      recColor = 'text-amber-400';
    } else if (hot.length >= 3) {
      recomendacao = '🔥 MODO QUENTE — múltiplos números repetindo';
      recColor = 'text-amber-400';
    } else {
      recomendacao = '👁️ OBSERVAR — Sessão neutra';
      recColor = 'text-primary/70';
    }

    return { hot, cold, corDom, reds, blacks, hotTerminal, zeroDelay, distintos, total: s50.length, recomendacao, recColor };
  }, [allNumbers[0], allNumbers.length]);

  if (!stats) return null;

  const numBg = (n: number) => n === 0 ? 'bg-emerald-600' : RED.has(n) ? 'bg-red-600' : 'bg-zinc-800';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-xl p-3.5 card-hover">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/15 flex items-center justify-center text-sm">📋</div>
        <div className="flex-1">
          <span className="font-display text-[10px] tracking-[0.12em] font-bold text-foreground uppercase">Resumo da Sessão</span>
          <div className="text-[7px] text-muted-foreground">{stats.total} rodadas analisadas</div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-secondary/30 rounded-lg p-2.5 border border-border/20 text-center">
          <div className="text-lg mb-0.5">{stats.corDom}</div>
          <div className="text-[7px] text-muted-foreground/60">Cor</div>
          <div className="text-[8px] font-bold text-foreground/80">{stats.reds}V / {stats.blacks}P</div>
        </div>

        <div className="bg-secondary/30 rounded-lg p-2.5 border border-border/20 text-center">
          <div className="text-[14px] font-mono font-black text-primary mb-0.5">T{stats.hotTerminal?.[0]}</div>
          <div className="text-[7px] text-muted-foreground/60">Terminal Hot</div>
          <div className="text-[8px] font-bold text-foreground/80">{stats.hotTerminal?.[1]}× / 50</div>
        </div>

        <div className={`rounded-lg p-2.5 border text-center ${
          stats.distintos <= 4 ? 'bg-green-500/8 border-green-500/15' :
          stats.distintos <= 6 ? 'bg-amber-500/8 border-amber-500/15' :
          'bg-secondary/30 border-border/20'
        }`}>
          <div className="text-[14px] font-mono font-black mb-0.5 text-foreground">{stats.distintos}</div>
          <div className="text-[7px] text-muted-foreground/60">T distintos/15</div>
          <div className={`text-[8px] font-bold ${
            stats.distintos <= 4 ? 'text-neon-green' : stats.distintos <= 6 ? 'text-amber-400' : 'text-muted-foreground'
          }`}>
            {stats.distintos <= 4 ? 'ENTRAR' : stats.distintos <= 6 ? 'CAUTELA' : 'AGUARDAR'}
          </div>
        </div>

        <div className={`rounded-lg p-2.5 border text-center ${
          stats.zeroDelay > 40 ? 'bg-red-500/8 border-red-500/15' :
          stats.zeroDelay > 25 ? 'bg-amber-500/8 border-amber-500/15' :
          'bg-secondary/30 border-border/20'
        }`}>
          <div className={`text-[14px] font-mono font-black mb-0.5 ${
            stats.zeroDelay > 40 ? 'text-destructive' : stats.zeroDelay > 25 ? 'text-amber-400' : 'text-foreground'
          }`}>{stats.zeroDelay}</div>
          <div className="text-[7px] text-muted-foreground/60">Zero ausente</div>
          <div className={`text-[8px] font-bold ${
            stats.zeroDelay > 40 ? 'text-destructive' : stats.zeroDelay > 25 ? 'text-amber-400' : 'text-muted-foreground'
          }`}>
            {stats.zeroDelay > 40 ? '🚨 CRÍTICO' : stats.zeroDelay > 25 ? '⚠️ PRESSÃO' : 'Normal'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-2.5">
        <div>
          <span className="text-[7px] font-bold text-amber-400 block mb-1.5">🔥 Hot (≥3×/50)</span>
          <div className="flex gap-1 flex-wrap">
            {stats.hot.length > 0 ? stats.hot.map(n => (
              <div key={n} className={`w-7 h-7 rounded-lg flex items-center justify-center text-[9px] font-bold border border-white/10 shadow-sm ${numBg(n)} text-white`}>{n}</div>
            )) : <span className="text-[7px] text-muted-foreground/50">Distribuição normal</span>}
          </div>
        </div>
        <div>
          <span className="text-[7px] font-bold text-blue-400 block mb-1.5">❄️ Cold (0×/50)</span>
          <div className="flex gap-1 flex-wrap">
            {stats.cold.slice(0,5).map(n => (
              <div key={n} className={`w-7 h-7 rounded-lg flex items-center justify-center text-[9px] font-bold border border-white/5 opacity-50 ${numBg(n)} text-white`}>{n}</div>
            ))}
          </div>
        </div>
      </div>

      {stats.recomendacao && (
        <div className={`text-[9px] font-bold text-center mt-3 pt-2.5 border-t border-border/20 ${stats.recColor}`}>
          {stats.recomendacao}
        </div>
      )}
    </motion.div>
  );
};

export default SessionSummary;
