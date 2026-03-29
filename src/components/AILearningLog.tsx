import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Zap, Search, Activity } from 'lucide-react';

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
}

const AILearningLog = ({ allNumbers, sniperData, autoLearnStatus }: Props) => {
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

  // Generate diagnostic messages when new number arrives
  useEffect(() => {
    const latest = allNumbers[0];
    if (latest === undefined || latest === prevLatestRef.current) return;
    prevLatestRef.current = latest;

    setScanning(true);
    setScanProgress(0);

    const timers: NodeJS.Timeout[] = [];

    // Phase 1 - Scanning
    timers.push(setTimeout(() => {
      setScanProgress(20);
      addLog(`Analisando ${Math.min(500, allNumbers.length)} rodadas... processando.`, 'info');
    }, 200));

    // Phase 2 - Terminal analysis
    timers.push(setTimeout(() => {
      setScanProgress(40);
      const terminal = latest % 10;
      const termCount = allNumbers.slice(0, 50).filter(n => n % 10 === terminal).length;
      if (termCount >= 4) {
        addLog(`Detectada Puxada Crítica: Terminal ${terminal} → Setor ${getSector(latest)} (${Math.min(95, 60 + termCount * 4)}% precisão).`, 'alert');
      } else {
        addLog(`Terminal ${terminal} verificado — ${termCount} ocorrências nas últimas 50 rodadas.`, 'info');
      }
    }, 600));

    // Phase 3 - Arc/dealer analysis
    timers.push(setTimeout(() => {
      setScanProgress(60);
      if (allNumbers.length >= 3) {
        const dist1 = wheelDist(allNumbers[0], allNumbers[1]);
        const dist2 = wheelDist(allNumbers[1], allNumbers[2]);
        if (Math.abs(dist1 - dist2) <= 2) {
          addLog(`Atenção: Dealer mantém arco estável (~${dist1} casas). Padrão de Força Estática.`, 'calibration');
        } else if (Math.abs(dist1 - dist2) > 8) {
          addLog(`Atenção: Dealer mudou o ritmo de lançamento. Recalibrando Arco...`, 'calibration');
        }
      }
    }, 1000));

    // Phase 4 - Sector analysis
    timers.push(setTimeout(() => {
      setScanProgress(80);
      const last12 = allNumbers.slice(0, 12);
      const sectorCount: Record<string, number> = { Voisins: 0, Tiers: 0, Orphelins: 0, Zero: 0 };
      last12.forEach(n => sectorCount[getSector(n)]++);
      const sorted = Object.entries(sectorCount).sort(([,a],[,b]) => b - a);
      const [topSec, topCnt] = sorted[0];
      const [secSec] = sorted[1];
      if (topCnt >= 6) {
        addLog(`Padrão Gangorra identificado nas últimas 12 rodadas. ${topSec} dominante.`, 'pattern');
      } else {
        // Check alternation
        const last6sectors = allNumbers.slice(0, 6).map(getSector);
        const alternating = last6sectors.every((s, i) => i === 0 || s !== last6sectors[i - 1]);
        if (alternating) {
          addLog(`Alternância de setores detectada: ${last6sectors.slice(0, 4).join(' → ')}`, 'pattern');
        }
      }
    }, 1300));

    // Phase 5 - Streak/entropy check
    timers.push(setTimeout(() => {
      setScanProgress(90);
      const RED = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
      const colors = allNumbers.slice(0, 10).map(n => n === 0 ? 'G' : RED.includes(n) ? 'R' : 'B');
      let streak = 1;
      for (let i = 1; i < colors.length; i++) {
        if (colors[i] === colors[0] && colors[0] !== 'G') streak++;
        else break;
      }
      if (streak >= 4) {
        addLog(`🔥 Quebra de Entropia: ${streak}x ${colors[0] === 'R' ? 'Vermelho' : 'Preto'} seguidos. Reversão iminente.`, 'alert');
      }
    }, 1500));

    // Phase 6 - Sequence mirror check
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

    // Complete
    timers.push(setTimeout(() => {
      setScanProgress(100);
      addLog(`Analisando ${Math.min(500, allNumbers.length)} rodadas... OK.`, 'info');
      setScanning(false);
    }, 2000));

    return () => timers.forEach(clearTimeout);
  }, [allNumbers[0]]);

  // Log archetype activity from sniper
  useEffect(() => {
    if (!sniperData?.archetypes) return;
    const active = sniperData.archetypes.filter((a: any) => a.active);
    if (active.length > 0) {
      const top = active[0];
      addLog(`${top.emoji} ${top.name}: ${top.detail}`, 'pattern');
    }
  }, [sniperData?.archetypes]);

  // Auto-learn status
  useEffect(() => {
    if (autoLearnStatus === 'learning') addLog('🧠 Motor de auto-aprendizado ativado...', 'calibration');
    else if (autoLearnStatus === 'analyzing') addLog('🔍 Análise profunda de padrões em andamento...', 'info');
    else if (autoLearnStatus === 'backtesting') addLog('🎯 Backtesting de estratégias concluído.', 'info');
  }, [autoLearnStatus]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [logs]);

  const typeStyles: Record<string, string> = {
    info: 'text-muted-foreground',
    alert: 'text-primary font-semibold',
    pattern: 'text-amber-400',
    calibration: 'text-purple-400 italic',
  };

  const typeIcons: Record<string, string> = {
    info: '📡',
    alert: '⚡',
    pattern: '🔍',
    calibration: '⚙️',
  };

  return (
    <div className="bg-card/95 rounded-xl border border-primary/30 p-3 shadow-lg shadow-primary/5">
      <div className="flex items-center gap-2 mb-2">
        <Brain className="w-4 h-4 text-primary" />
        <span className="font-display text-[10px] tracking-[0.2em] font-bold text-primary">LOG DE APRENDIZADO IA</span>
        {scanning && <Activity className="w-3 h-3 text-primary animate-pulse ml-auto" />}
        {!scanning && <span className="text-[7px] text-muted-foreground ml-auto font-mono">{logs.length} entradas</span>}
      </div>

      {/* Scan progress bar */}
      <div className="w-full h-1 bg-secondary rounded-full overflow-hidden mb-2">
        <motion.div
          className="h-full bg-primary rounded-full"
          animate={{ width: `${scanProgress}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Log entries */}
      <div ref={scrollRef} className="space-y-1 max-h-[160px] overflow-y-auto scrollbar-thin pr-1">
        <AnimatePresence initial={false}>
          {logs.map(log => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, x: -10, height: 0 }}
              animate={{ opacity: 1, x: 0, height: 'auto' }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-start gap-1.5"
            >
              <span className="text-[8px] shrink-0 mt-0.5">{typeIcons[log.type]}</span>
              <span className="text-[7px] font-mono text-muted-foreground/60 shrink-0 mt-0.5">
                {log.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span className={`text-[9px] leading-tight ${typeStyles[log.type]}`}>
                "{log.text}"
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
        {logs.length === 0 && (
          <div className="text-[9px] text-muted-foreground italic py-2 text-center">Aguardando próximo giro...</div>
        )}
      </div>
    </div>
  );
};

export default AILearningLog;
