import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ClipboardList, Flame, Snowflake, Activity, TrendingUp, Gauge } from 'lucide-react';

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
    let recBg = 'bg-muted/5 border-border/15';
    let recIcon = '👁️';
    if (distintos <= 4 && zeroDelay < 40) {
      recomendacao = 'ENTRAR — Entropia baixa, sessão concentrada';
      recColor = 'text-neon-green';
      recBg = 'bg-neon-green/5 border-neon-green/20';
      recIcon = '✅';
    } else if (zeroDelay > 40) {
      recomendacao = 'PRESSÃO ZERO CRÍTICA — priorizar Vizinhos do Zero';
      recColor = 'text-destructive';
      recBg = 'bg-destructive/5 border-destructive/20';
      recIcon = '🚨';
    } else if (distintos >= 8) {
      recomendacao = 'AGUARDAR — Alta dispersão, sem padrão claro';
      recColor = 'text-gold';
      recBg = 'bg-gold/5 border-gold/20';
      recIcon = '⏸';
    } else if (hot.length >= 3) {
      recomendacao = 'MODO QUENTE — múltiplos números repetindo';
      recColor = 'text-gold';
      recBg = 'bg-gold/5 border-gold/20';
      recIcon = '🔥';
    } else {
      recomendacao = 'OBSERVAR — Sessão neutra';
      recColor = 'text-neon-cyan/70';
      recBg = 'bg-neon-cyan/3 border-neon-cyan/10';
      recIcon = '👁️';
    }

    // Entropy score (0-100, lower = more concentrated)
    const entropy = Math.round(distintos / 10 * 100);

    return { hot, cold, corDom, reds, blacks, hotTerminal, zeroDelay, distintos, total: s50.length, recomendacao, recColor, recBg, recIcon, entropy };
  }, [allNumbers[0], allNumbers.length]);

  if (!stats) return null;

  const numBg = (n: number) => n === 0 ? 'bg-emerald-600' : RED.has(n) ? 'bg-red-600' : 'bg-zinc-800';

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl overflow-hidden border border-border/20">
      {/* Header */}
      <div className="relative px-4 pt-4 pb-3">
        <div className="absolute inset-0 bg-gradient-to-r from-neon-cyan/5 via-transparent to-neon-pink/4" />
        <div className="relative flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-neon-cyan/15 to-neon-pink/10 border border-neon-cyan/20 flex items-center justify-center shadow-[0_0_12px_hsl(var(--neon-cyan)/0.15)]">
            <ClipboardList className="w-4 h-4 text-[hsl(var(--neon-cyan))]" />
          </div>
          <div className="flex-1">
            <span className="font-display text-[10px] tracking-[0.15em] font-bold text-[hsl(var(--neon-cyan))] uppercase">Resumo da Sessão</span>
            <div className="text-[7px] text-muted-foreground/50 font-mono">{stats.total} rodadas analisadas</div>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg glass border border-border/15">
            <Activity className="w-3 h-3 text-[hsl(var(--neon-cyan))]/60" />
            <span className="text-[7px] font-bold text-muted-foreground/60 font-mono">LIVE</span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="px-4 pb-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {/* Cor Dominante */}
          <div className="glass rounded-xl p-3 border border-border/15 text-center relative overflow-hidden group hover:border-border/30 transition-all">
            <div className="absolute inset-0 bg-gradient-to-br from-transparent to-primary/3 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <div className="text-xl mb-0.5">{stats.corDom}</div>
              <div className="text-[7px] text-muted-foreground/40 font-display tracking-wider uppercase">Cor</div>
              <div className="text-[9px] font-bold text-foreground/70 font-mono mt-0.5">
                <span className="text-red-400">{stats.reds}V</span>
                <span className="text-muted-foreground/30 mx-0.5">/</span>
                <span className="text-foreground/60">{stats.blacks}P</span>
              </div>
            </div>
          </div>

          {/* Terminal Hot */}
          <div className="glass rounded-xl p-3 border border-border/15 text-center relative overflow-hidden group hover:border-[hsl(var(--neon-cyan))]/20 transition-all">
            <div className="absolute inset-0 bg-gradient-to-br from-transparent to-[hsl(var(--neon-cyan))]/3 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <div className="text-[16px] font-mono font-black text-[hsl(var(--neon-cyan))] mb-0.5">T{stats.hotTerminal?.[0]}</div>
              <div className="text-[7px] text-muted-foreground/40 font-display tracking-wider uppercase">Terminal Hot</div>
              <div className="text-[9px] font-bold text-foreground/70 font-mono mt-0.5">{stats.hotTerminal?.[1]}× / 50</div>
            </div>
          </div>

          {/* Terminais Distintos */}
          <div className={`glass rounded-xl p-3 border text-center relative overflow-hidden ${
            stats.distintos <= 4 ? 'border-neon-green/20 bg-neon-green/3' :
            stats.distintos <= 6 ? 'border-gold/15 bg-gold/3' :
            'border-border/15'
          }`}>
            <div className="text-[16px] font-mono font-black mb-0.5 text-foreground">{stats.distintos}</div>
            <div className="text-[7px] text-muted-foreground/40 font-display tracking-wider uppercase">Terminais</div>
            <div className={`text-[9px] font-bold mt-0.5 ${
              stats.distintos <= 4 ? 'text-neon-green' : stats.distintos <= 6 ? 'text-gold' : 'text-muted-foreground/50'
            }`}>
              {stats.distintos <= 4 ? '🎯 ENTRAR' : stats.distintos <= 6 ? '⚠️ CAUTELA' : '⏸ AGUARDAR'}
            </div>
          </div>

          {/* Zero Ausente */}
          <div className={`glass rounded-xl p-3 border text-center relative overflow-hidden ${
            stats.zeroDelay > 40 ? 'border-destructive/20 bg-destructive/3' :
            stats.zeroDelay > 25 ? 'border-gold/15 bg-gold/3' :
            'border-border/15'
          }`}>
            <div className={`text-[16px] font-mono font-black mb-0.5 ${
              stats.zeroDelay > 40 ? 'text-destructive' : stats.zeroDelay > 25 ? 'text-gold' : 'text-foreground'
            }`}>{stats.zeroDelay}</div>
            <div className="text-[7px] text-muted-foreground/40 font-display tracking-wider uppercase">Zero Ausente</div>
            <div className={`text-[9px] font-bold mt-0.5 ${
              stats.zeroDelay > 40 ? 'text-destructive' : stats.zeroDelay > 25 ? 'text-gold' : 'text-muted-foreground/50'
            }`}>
              {stats.zeroDelay > 40 ? '🚨 CRÍTICO' : stats.zeroDelay > 25 ? '⚠️ PRESSÃO' : 'Normal'}
            </div>
          </div>
        </div>
      </div>

      {/* Entropy Bar */}
      <div className="px-4 pb-3">
        <div className="glass rounded-xl p-3 border border-border/15">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Gauge className="w-3 h-3 text-primary/60" />
              <span className="text-[8px] font-bold text-muted-foreground/60 font-display tracking-wider uppercase">Entropia da Sessão</span>
            </div>
            <span className={`text-[9px] font-mono font-bold ${
              stats.entropy <= 40 ? 'text-neon-green' : stats.entropy <= 70 ? 'text-gold' : 'text-destructive'
            }`}>
              {stats.entropy <= 40 ? 'BAIXA' : stats.entropy <= 70 ? 'MÉDIA' : 'ALTA'}
            </span>
          </div>
          <div className="w-full h-2 bg-background/20 rounded-full overflow-hidden border border-border/10">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${stats.entropy}%` }}
              transition={{ duration: 0.8 }}
              className={`h-full rounded-full bg-gradient-to-r ${
                stats.entropy <= 40 ? 'from-neon-green to-emerald-400' : 
                stats.entropy <= 70 ? 'from-gold to-amber-400' : 
                'from-destructive to-rose-400'
              }`}
            />
          </div>
        </div>
      </div>

      {/* Hot & Cold */}
      <div className="px-4 pb-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="glass rounded-xl p-3 border border-border/15">
            <div className="flex items-center gap-1.5 mb-2">
              <Flame className="w-3 h-3 text-[hsl(var(--gold))]" />
              <span className="text-[8px] font-bold text-[hsl(var(--gold))] font-display tracking-wider">HOT (≥3×/50)</span>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {stats.hot.length > 0 ? stats.hot.map(n => (
                <motion.div
                  key={n}
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold border border-white/15 shadow-sm ${numBg(n)} text-white`}
                >
                  {n}
                </motion.div>
              )) : <span className="text-[8px] text-muted-foreground/30">Distribuição normal</span>}
            </div>
          </div>
          <div className="glass rounded-xl p-3 border border-border/15">
            <div className="flex items-center gap-1.5 mb-2">
              <Snowflake className="w-3 h-3 text-[hsl(var(--neon-cyan))]/60" />
              <span className="text-[8px] font-bold text-[hsl(var(--neon-cyan))]/60 font-display tracking-wider">COLD (0×/50)</span>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {stats.cold.slice(0,5).map(n => (
                <div key={n} className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold border border-white/5 opacity-35 ${numBg(n)} text-white`}>{n}</div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recommendation — premium */}
      {stats.recomendacao && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mx-4 mb-4 rounded-2xl border p-4 relative overflow-hidden ${stats.recBg}`}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/[0.02] to-transparent" />
          {/* Shimmer for green/positive */}
          {stats.recIcon === '✅' && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-neon-green/[0.03] to-transparent animate-shimmer bg-[length:200%_100%]" />
          )}
          <div className="relative flex items-center gap-3">
            <motion.div
              animate={stats.recIcon === '🚨' ? { scale: [1, 1.1, 1], rotate: [0, 3, -3, 0] } : {}}
              transition={{ repeat: Infinity, duration: 2 }}
              className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 border backdrop-blur-sm ${stats.recBg}`}
            >
              {stats.recIcon}
            </motion.div>
            <div className="flex-1 min-w-0">
              <div className="text-[7px] text-muted-foreground/40 font-display tracking-[0.2em] uppercase mb-0.5">RECOMENDAÇÃO IA</div>
              <span className={`text-[11px] font-black font-display tracking-wide leading-tight ${stats.recColor}`}>
                {stats.recomendacao}
              </span>
            </div>
            <TrendingUp className={`w-5 h-5 shrink-0 ${stats.recColor} opacity-30`} />
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default SessionSummary;
