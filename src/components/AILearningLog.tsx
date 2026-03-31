import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Activity } from 'lucide-react';

interface LogEntry {
  id: number;
  text: string;
  type: 'info' | 'alert' | 'pattern' | 'calibration';
  timestamp: Date;
}

const WHEEL = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const VOISINS_NUMS = [22,18,29,7,28,12,35,3,26,0,32,15,19,4,21,2,25];
const TIERS_NUMS = [27,13,36,11,30,8,23,10,5,24,16,33];
const ORPHELINS_NUMS = [1,20,14,31,9,17,34,6];

const getSector = (n: number) => VOISINS_NUMS.includes(n) ? 'Voisins' : TIERS_NUMS.includes(n) ? 'Tiers' : ORPHELINS_NUMS.includes(n) ? 'Orphelins' : 'Zero';

const wheelDist = (a: number, b: number) => {
  const ia = WHEEL.indexOf(a), ib = WHEEL.indexOf(b);
  if (ia === -1 || ib === -1) return 99;
  const d = Math.abs(ia - ib);
  return Math.min(d, WHEEL.length - d);
};

interface Props {
  allNumbers: number[];
  sniperData: any;
  autoLearnStatus: 'idle' | 'learning' | 'analyzing' | 'backtesting';
  rtInsights?: { type: string; numbers: number[]; score: number; reason: string; confidence: number }[];
}

const AILearningLog = ({ allNumbers, sniperData, autoLearnStatus, rtInsights = [] }: Props) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const logIdRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevLatestRef = useRef<number | null>(null);

  const addLog = (text: string, type: LogEntry['type'] = 'info') => {
    logIdRef.current++;
    setLogs(prev => [...prev.slice(-19), { id: logIdRef.current, text, type, timestamp: new Date() }]);
  };

  useEffect(() => {
    const latest = allNumbers[0];
    if (latest === undefined || latest === prevLatestRef.current) return;
    prevLatestRef.current = latest;

    setScanning(true);
    setScanProgress(0);

    const timers: NodeJS.Timeout[] = [];

    timers.push(setTimeout(() => { setScanProgress(20); addLog(`Analisando ${Math.min(500, allNumbers.length)} rodadas... processando.`, 'info'); }, 200));

    timers.push(setTimeout(() => {
      setScanProgress(40);
      const terminal = latest % 10;
      const termCount = allNumbers.slice(0, 50).filter(n => n % 10 === terminal).length;
      if (termCount >= 4) addLog(`Detectada Puxada Crítica: Terminal ${terminal} → Setor ${getSector(latest)} (${Math.min(95, 60 + termCount * 4)}% precisão).`, 'alert');
      else addLog(`Terminal ${terminal} verificado — ${termCount} ocorrências nas últimas 50 rodadas.`, 'info');
    }, 600));

    timers.push(setTimeout(() => {
      setScanProgress(60);
      if (allNumbers.length >= 3) {
        const dist1 = wheelDist(allNumbers[0], allNumbers[1]);
        const dist2 = wheelDist(allNumbers[1], allNumbers[2]);
        if (Math.abs(dist1 - dist2) <= 2) addLog(`Atenção: Dealer mantém arco estável (~${dist1} casas). Padrão de Força Estática.`, 'calibration');
        else if (Math.abs(dist1 - dist2) > 8) addLog(`Atenção: Dealer mudou o ritmo de lançamento. Recalibrando Arco...`, 'calibration');
      }
    }, 1000));

    timers.push(setTimeout(() => {
      setScanProgress(80);
      const last12 = allNumbers.slice(0, 12);
      const sectorCount: Record<string, number> = { Voisins: 0, Tiers: 0, Orphelins: 0, Zero: 0 };
      last12.forEach(n => sectorCount[getSector(n)]++);
      const sorted = Object.entries(sectorCount).sort(([,a],[,b]) => b - a);
      const [topSec, topCnt] = sorted[0];
      if (topCnt >= 6) addLog(`Padrão Gangorra identificado nas últimas 12 rodadas. ${topSec} dominante.`, 'pattern');
      else {
        const last6sectors = allNumbers.slice(0, 6).map(getSector);
        const alternating = last6sectors.every((s, i) => i === 0 || s !== last6sectors[i - 1]);
        if (alternating) addLog(`Alternância de setores detectada: ${last6sectors.slice(0, 4).join(' → ')}`, 'pattern');
      }
    }, 1300));

    timers.push(setTimeout(() => {
      const PULL_UI: Record<number,number[]> = {
        0:[10,20,30,32,15],1:[11,35,16,4,18],2:[14,1,13,18,35],3:[13,27,6,11,30],
        4:[26,15,18,32,33],5:[3,33,16,24,10],6:[8,15,31,21,22],7:[16,18,17,30,31],
        8:[11,9,10],9:[34,35,36,3,16],10:[20,5,18,11,14],20:[4,14],27:[28,29,24,22],36:[3,10,27]
      };
      const puxados = PULL_UI[latest] || [];
      if (puxados.length > 0) {
        setScanProgress(prev => Math.min(prev + 15, 85));
        addLog(`🧲 ${latest} puxa → [${puxados.slice(0,5).join(',')}...] — próximas 4 rodadas`, 'pattern');
      }
    }, 850));

    timers.push(setTimeout(() => {
      if (allNumbers.length >= 15) {
        setScanProgress(prev => Math.min(prev + 8, 93));
        const last15 = allNumbers.slice(0,15);
        const distintos = new Set(last15.map(n => n%10)).size;
        const label = distintos <= 4 ? '🎯 BAIXA — Entrar forte!' : distintos <= 6 ? '⚠️ Média — Cautela' : '🔀 Alta — Aguardar';
        const type: LogEntry['type'] = distintos <= 4 ? 'alert' : 'info';
        addLog(`📊 Entropia: ${distintos}/10 terminais distintos → ${label}`, type);
      }
    }, 1050));

    timers.push(setTimeout(() => {
      setScanProgress(90);
      const RED = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
      const colors = allNumbers.slice(0, 10).map(n => n === 0 ? 'G' : RED.includes(n) ? 'R' : 'B');
      let streak = 1;
      for (let i = 1; i < colors.length; i++) { if (colors[i] === colors[0] && colors[0] !== 'G') streak++; else break; }
      if (streak >= 4) addLog(`🔥 Quebra de Entropia: ${streak}x ${colors[0] === 'R' ? 'Vermelho' : 'Preto'} seguidos. Reversão iminente.`, 'alert');
    }, 1500));

    timers.push(setTimeout(() => {
      setScanProgress(95);
      if (allNumbers.length >= 50) {
        const seq3 = allNumbers.slice(0, 3);
        for (let i = 10; i < Math.min(allNumbers.length - 2, 200); i++) {
          if (allNumbers[i] === seq3[0] && allNumbers[i + 1] === seq3[1] && allNumbers[i + 2] === seq3[2]) {
            addLog(`👻 Espelhamento Temporal: Sequência ${seq3.join(',')} repetida (há ${i} rodadas). Próximo provável: ${allNumbers[i + 3] !== undefined ? allNumbers[i + 3] : '?'}`, 'pattern');
            break;
          }
        }
      }
    }, 1700));

    timers.push(setTimeout(() => {
      const last5 = allNumbers.slice(0, 5);
      const repCount: Record<number,number> = {};
      last5.forEach(n => { repCount[n] = (repCount[n]||0)+1; });
      const hotRep = Object.entries(repCount).find(([,c]) => Number(c) >= 2);
      if (hotRep) {
        const rn = Number(hotRep[0]);
        const cnt = Number(hotRep[1]);
        addLog(`🔁 AUTO-REPETIÇÃO: ${rn} saiu ${cnt}x em 5 — padrão FORTE desta mesa (13→13→13: 15x em 500)`, 'alert');
      }
    }, 1350));

    timers.push(setTimeout(() => {
      setScanProgress(100);
      const score = sniperData?.signal?.probability || 0;
      const confirmations = sniperData?.signal?.confirmations || 0;
      const num1 = sniperData?.signal?.number;
      const action = score >= 65 ? '⚡ ENTRAR FORTE' : score >= 50 ? '✅ ENTRAR' : score >= 35 ? '⚠️ AGUARDAR' : '⏸ NÃO ENTRAR';
      const fichas = score >= 65 ? ` (${Math.round(8 + (score-65)/5)} fichas)` : score >= 50 ? ' (5 fichas)' : '';
      const confStr = confirmations >= 3 ? ` | ${confirmations} fontes ✅` : '';
      addLog(`🎯 #${num1} → ${score}% ${action}${fichas}${confStr}`, score >= 55 ? 'alert' : 'info');
      setScanning(false);
    }, 2000));

    return () => timers.forEach(clearTimeout);
  }, [allNumbers[0]]);

  useEffect(() => {
    if (!rtInsights || rtInsights.length === 0) return;
    const top = rtInsights[0];
    if (top.confidence >= 70) {
      const typeLabels: Record<string, string> = {
        auto_repeticao_rt: '🔁 AUTO-REPETIÇÃO', streak_consecutivo: '🔥 STREAK', triple_pull: '🔱 TRIPLE PULL',
        double_pull: '🔗 DOUBLE PULL', puxada_momento: '🧲 PUXADA', terminal_dominante_rt: '🔢 TERMINAL',
        zero_pressao_rt: '🟢 ZERO', combo_ouro_rt: '👑 COMBO OURO', matriz_momento: '🔮 MATRIZ',
        near_miss_rt: '📍 NEAR MISS', hot_momento: '🔥 HOT', setor_dominante_rt: '🎯 SETOR',
      };
      const label = typeLabels[top.type] || `⚡ ${top.type}`;
      addLog(`${label}: ${top.reason.slice(0, 80)} → apostar [${top.numbers.slice(0,5).join(',')}]`, 'alert');
    }
  }, [rtInsights]);

  useEffect(() => {
    if (!sniperData?.strategy?.type) return;
    const learnedTypes = ['realtime_aprendido','pull_confirmado_aprendido','heat_cluster_ia','pattern_consensus','realtime_insight'];
    if (learnedTypes.includes(sniperData.strategy.type)) {
      addLog(`🧠 IA ESCOLHEU estratégia aprendida: ${sniperData.strategy.label} → [${(sniperData.strategy.numbers||[]).slice(0,5).join(',')}]`, 'alert');
    }
  }, [sniperData?.strategy?.type, sniperData?.signal?.number]);

  useEffect(() => {
    if (!sniperData?.signal?.confirmations) return;
    const c = sniperData.signal.confirmations;
    const cd = sniperData.signal.confirmationDetail;
    const num = sniperData.signal.number;
    if (c >= 3) {
      const srcs = [cd?.pull && 'Puxada', cd?.autoRep && `Rep${cd.recentCount}x`, cd?.matriz && 'Matriz', cd?.ensemble && 'Ensemble', cd?.winner && 'Estrat.'].filter(Boolean).join('+');
      addLog(`💎 ${c} confirmações em #${num}: ${srcs} — CONFIANÇA MÁXIMA`, 'alert');
    }
  }, [sniperData?.signal?.number]);

  useEffect(() => {
    if (!sniperData?.archetypes) return;
    const active = sniperData.archetypes.filter((a: any) => a.active);
    if (active.length > 0) { const top = active[0]; addLog(`${top.emoji} ${top.name}: ${top.detail}`, 'pattern'); }
  }, [sniperData?.archetypes]);

  useEffect(() => {
    if (autoLearnStatus === 'learning') addLog('🧠 Motor de auto-aprendizado ativado...', 'calibration');
    else if (autoLearnStatus === 'analyzing') addLog('🔍 Análise profunda de padrões em andamento...', 'info');
    else if (autoLearnStatus === 'backtesting') addLog('🎯 Backtesting de estratégias concluído.', 'info');
  }, [autoLearnStatus]);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [logs]);

  const typeStyles: Record<string, string> = {
    info: 'text-muted-foreground/70',
    alert: 'text-gold font-semibold',
    pattern: 'text-neon-cyan',
    calibration: 'text-neon-pink',
  };

  const typeIcons: Record<string, string> = { info: '📡', alert: '⚡', pattern: '🔍', calibration: '⚙️' };

  return (
    <div className="glass rounded-xl p-3.5">
      <div className="flex items-center gap-2 mb-2.5">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-neon-pink/15 to-purple-500/10 border border-neon-pink/20 flex items-center justify-center shadow-neon-pink">
          <Brain className="w-3.5 h-3.5 text-neon-pink" />
        </div>
        <span className="font-display text-[10px] tracking-[0.2em] font-bold text-neon-pink">LOG DE APRENDIZADO</span>
        {scanning && <Activity className="w-3 h-3 text-neon-cyan animate-pulse ml-auto" />}
        {!scanning && <span className="text-[7px] text-muted-foreground/40 ml-auto font-mono">{logs.length} entradas</span>}
      </div>

      {/* Scan progress bar */}
      <div className="w-full h-1 bg-background/30 rounded-full overflow-hidden mb-2.5 border border-border/10">
        <motion.div
          className="h-full bg-gradient-to-r from-neon-cyan to-neon-pink rounded-full"
          animate={{ width: `${scanProgress}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Log entries */}
      <div ref={scrollRef} className="space-y-1 max-h-[220px] overflow-y-auto scrollbar-thin pr-1">
        <AnimatePresence initial={false}>
          {logs.map(log => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, x: -10, height: 0 }}
              animate={{ opacity: 1, x: 0, height: 'auto' }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-start gap-1.5 py-0.5"
            >
              <span className="text-[8px] shrink-0 mt-0.5">{typeIcons[log.type]}</span>
              <span className="text-[7px] font-mono text-muted-foreground/30 shrink-0 mt-0.5">
                {log.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span className={`text-[9px] leading-tight ${typeStyles[log.type]}`}>
                "{log.text}"
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
        {logs.length === 0 && (
          <div className="text-[9px] text-muted-foreground/30 italic py-2 text-center">Aguardando próximo giro...</div>
        )}
      </div>
    </div>
  );
};

export default AILearningLog;
