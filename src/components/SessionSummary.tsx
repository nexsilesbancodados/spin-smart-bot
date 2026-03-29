import { useMemo } from 'react';
import { motion } from 'framer-motion';

const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const VOISINS = new Set([22,18,29,7,28,12,35,3,26,0,32,15,19,4,21,2,25]);
const TIERS = new Set([27,13,36,11,30,8,23,10,5,24,16,33]);

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

    return { hot, cold, corDom, reds, blacks, hotTerminal, zeroDelay, distintos, total: s50.length };
  }, [allNumbers[0], allNumbers.length]);

  if (!stats) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-card rounded-xl border border-border p-3"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm">📋</span>
        <span className="font-display text-[10px] tracking-[0.15em] font-bold text-foreground uppercase">
          Resumo da Sessão
        </span>
        <span className="text-[7px] text-muted-foreground ml-auto">{stats.total} rodadas</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-secondary/40 rounded-lg p-2 border border-border text-center">
          <div className="text-lg mb-0.5">{stats.corDom}</div>
          <div className="text-[7px] text-muted-foreground">Cor</div>
          <div className="text-[8px] font-bold text-foreground">{stats.reds}V / {stats.blacks}P</div>
        </div>

        <div className="bg-secondary/40 rounded-lg p-2 border border-border text-center">
          <div className="text-[14px] font-mono font-black text-primary mb-0.5">
            T{stats.hotTerminal?.[0]}
          </div>
          <div className="text-[7px] text-muted-foreground">Terminal Hot</div>
          <div className="text-[8px] font-bold text-foreground">{stats.hotTerminal?.[1]}x / 50</div>
        </div>

        <div className={`rounded-lg p-2 border text-center ${
          stats.distintos <= 4 ? 'bg-green-500/10 border-green-500/20' :
          stats.distintos <= 6 ? 'bg-yellow-500/10 border-yellow-500/20' :
          'bg-secondary/40 border-border'
        }`}>
          <div className="text-[14px] font-mono font-black mb-0.5 text-foreground">{stats.distintos}</div>
          <div className="text-[7px] text-muted-foreground">T distintos/15</div>
          <div className={`text-[8px] font-bold ${
            stats.distintos <= 4 ? 'text-green-400' :
            stats.distintos <= 6 ? 'text-yellow-400' : 'text-muted-foreground'
          }`}>
            {stats.distintos <= 4 ? 'ENTRAR' : stats.distintos <= 6 ? 'CAUTELA' : 'AGUARDAR'}
          </div>
        </div>

        <div className={`rounded-lg p-2 border text-center ${
          stats.zeroDelay > 40 ? 'bg-red-500/10 border-red-500/20' :
          stats.zeroDelay > 25 ? 'bg-orange-500/10 border-orange-500/20' :
          'bg-secondary/40 border-border'
        }`}>
          <div className={`text-[14px] font-mono font-black mb-0.5 ${
            stats.zeroDelay > 40 ? 'text-red-400' :
            stats.zeroDelay > 25 ? 'text-orange-400' : 'text-foreground'
          }`}>{stats.zeroDelay}</div>
          <div className="text-[7px] text-muted-foreground">Zero ausente</div>
          <div className={`text-[8px] font-bold ${
            stats.zeroDelay > 40 ? 'text-red-400' :
            stats.zeroDelay > 25 ? 'text-orange-400' : 'text-muted-foreground'
          }`}>
            {stats.zeroDelay > 40 ? '🚨 CRÍTICO' : stats.zeroDelay > 25 ? '⚠️ PRESSÃO' : 'Normal'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-2">
        <div>
          <span className="text-[7px] font-bold text-orange-400 block mb-1">🔥 Hot (≥3x/50)</span>
          <div className="flex gap-1 flex-wrap">
            {stats.hot.length > 0 ? stats.hot.map(n => (
              <div key={n} className={`w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold border border-white/10 ${
                n===0?'bg-emerald-600 text-white':RED.has(n)?'bg-red-600 text-white':'bg-zinc-800 text-white'
              }`}>{n}</div>
            )) : <span className="text-[7px] text-muted-foreground">Distribuição normal</span>}
          </div>
        </div>
        <div>
          <span className="text-[7px] font-bold text-blue-400 block mb-1">❄️ Cold (0x/50)</span>
          <div className="flex gap-1 flex-wrap">
            {stats.cold.slice(0,5).map(n => (
              <div key={n} className={`w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold border border-white/10 opacity-60 ${
                n===0?'bg-emerald-600 text-white':RED.has(n)?'bg-red-600 text-white':'bg-zinc-800 text-white'
              }`}>{n}</div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default SessionSummary;
