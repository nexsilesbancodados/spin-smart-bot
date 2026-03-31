import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, Play, Square, TrendingUp, TrendingDown, DollarSign, 
  Target, Shield, Settings, RotateCcw, AlertTriangle, ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BetPanelProps {
  sniperData: any;
  allNumbers: number[];
}

interface AutoBetState {
  enabled: boolean;
  betValue: number;
  stopLoss: number;
  stopWin: number;
  useGale: boolean;
  maxGaleSteps: number;
  galeFactor: number;
  minProbability: number;
}

interface BetResult {
  won: boolean;
  numbers: number[];
  actual: number;
  amount: number;
  profit: number;
  timestamp: number;
}

interface BetStats {
  totalBets: number;
  wins: number;
  losses: number;
  profit: number;
  currentGaleStep: number;
  consecutiveLosses: number;
  lastBetNumbers: number[];
  lastBetAmount: number;
  waitingResult: boolean;
  stopped: boolean;
  stopReason: string;
  history: BetResult[];
}

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const getColor = (n: number) => n === 0 ? 'green' : RED_NUMBERS.includes(n) ? 'red' : 'black';

const MANUAL_BET_TYPES = [
  { id: 'auto', label: '🤖 Auto (IA)', desc: 'Sinal da IA' },
  { id: 'vermelho', label: '🔴 Vermelho', desc: '18 números', numbers: RED_NUMBERS },
  { id: 'preto', label: '⚫ Preto', desc: '18 números', numbers: [2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35] },
  { id: 'par', label: '⚖️ Par', desc: '18 números', numbers: Array.from({length:18},(_,i)=>(i+1)*2) },
  { id: 'impar', label: '⚖️ Ímpar', desc: '18 números', numbers: Array.from({length:18},(_,i)=>i*2+1) },
  { id: 'alto', label: '📏 Alto', desc: '19-36', numbers: Array.from({length:18},(_,i)=>i+19) },
  { id: 'baixo', label: '📏 Baixo', desc: '1-18', numbers: Array.from({length:18},(_,i)=>i+1) },
  { id: 'dz1', label: '1ª Dúzia', desc: '1-12', numbers: Array.from({length:12},(_,i)=>i+1) },
  { id: 'dz2', label: '2ª Dúzia', desc: '13-24', numbers: Array.from({length:12},(_,i)=>i+13) },
  { id: 'dz3', label: '3ª Dúzia', desc: '25-36', numbers: Array.from({length:12},(_,i)=>i+25) },
  { id: 'col1', label: 'Col 1', desc: '1,4,7...34', numbers: [1,4,7,10,13,16,19,22,25,28,31,34] },
  { id: 'col2', label: 'Col 2', desc: '2,5,8...35', numbers: [2,5,8,11,14,17,20,23,26,29,32,35] },
  { id: 'col3', label: 'Col 3', desc: '3,6,9...36', numbers: [3,6,9,12,15,18,21,24,27,30,33,36] },
];

const BetPanel = ({ sniperData, allNumbers }: BetPanelProps) => {
  const [config, setConfig] = useState<AutoBetState>({
    enabled: false,
    betValue: 1,
    stopLoss: -50,
    stopWin: 100,
    useGale: false,
    maxGaleSteps: 3,
    galeFactor: 2,
    minProbability: 80,
  });

  const [stats, setStats] = useState<BetStats>({
    totalBets: 0, wins: 0, losses: 0, profit: 0,
    currentGaleStep: 0, consecutiveLosses: 0,
    lastBetNumbers: [], lastBetAmount: 0,
    waitingResult: false, stopped: false, stopReason: '',
    history: [],
  });

  const [showSettings, setShowSettings] = useState(false);
  const [betFlash, setBetFlash] = useState(false);
  const [simMode, setSimMode] = useState(false);
  const [simProfit, setSimProfit] = useState(0);
  const [simTotal, setSimTotal] = useState(0);
  const [simWins, setSimWins] = useState(0);
  const [manualBetType, setManualBetType] = useState('auto');
  const [customNumbers, setCustomNumbers] = useState('');
  const [showBetTypes, setShowBetTypes] = useState(false);
  const prevNumberRef = useRef<number | null>(null);
  const autoBetRef = useRef(false);
  const [extStatus, setExtStatus] = useState<{
    lastAction: string;
    lastNumber: number | null;
    extConnected: boolean;
    bettingPhase: 'open' | 'closed' | 'unknown';
    extProfit: number;
    extWins: number;
    extLosses: number;
  } | null>(null);

  // Escutar mensagens da extensão
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const d = event.data;
      if (!d || typeof d !== 'object') return;

      if (d.type === 'AUTOBET_STATUS') {
        setExtStatus(prev => ({
          lastAction: d.status,
          lastNumber: d.resultNumber || d.number || prev?.lastNumber || null,
          extConnected: true,
          bettingPhase: prev?.bettingPhase || 'unknown',
          extProfit: d.stats?.profit ?? prev?.extProfit ?? 0,
          extWins: d.stats?.wins ?? prev?.extWins ?? 0,
          extLosses: d.stats?.losses ?? prev?.extLosses ?? 0,
        }));
        // Resolver bet local baseado no retorno da extensão
        if (d.status === 'win' && d.resultNumber !== null && stats.waitingResult) {
          setStats(prev => ({
            ...prev, waitingResult: false, wins: prev.wins + 1,
            profit: prev.profit + (d.profit || 0),
            currentGaleStep: 0, consecutiveLosses: 0,
          }));
        }
        if (d.status === 'loss' && d.resultNumber !== null && stats.waitingResult) {
          setStats(prev => ({
            ...prev, waitingResult: false, losses: prev.losses + 1,
            profit: prev.profit + (d.profit || 0),
            consecutiveLosses: prev.consecutiveLosses + 1,
          }));
        }
      }

      if (d.type === 'BETTING_PHASE') {
        setExtStatus(prev => prev ? { ...prev, bettingPhase: d.phase, extConnected: true } : {
          lastAction: '', lastNumber: null, extConnected: true,
          bettingPhase: d.phase, extProfit: 0, extWins: 0, extLosses: 0,
        });
      }

      if (d.type === 'NUMBER_FROM_EXTENSION') {
        setExtStatus(prev => prev ? { ...prev, lastNumber: d.number, extConnected: true } : null);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [stats.waitingResult]);

  // Auto-reset waitingResult after 60s to prevent stuck state
  useEffect(() => {
    if (!stats.waitingResult) return;
    const timeout = setTimeout(() => {
      setStats(prev => prev.waitingResult ? { ...prev, waitingResult: false } : prev);
    }, 60000);
    return () => clearTimeout(timeout);
  }, [stats.waitingResult]);

  // Resolve the last bet when a new number comes in
  useEffect(() => {
    if (allNumbers.length === 0) return;
    const latestNumber = allNumbers[0];
    
    if (prevNumberRef.current !== null && prevNumberRef.current !== latestNumber && stats.waitingResult) {
      // New number arrived — resolve bet
      const won = stats.lastBetNumbers.includes(latestNumber);
      
      setStats(prev => {
        const updated = { ...prev, waitingResult: false };
        let resultProfit = 0;
        
        if (won) {
          // Payout correto: ganhou 35:1 em 1 número, perdeu lastBetAmount nos outros N-1 números
          const payout = prev.lastBetAmount * 35; // recebe 35x a ficha vencedora
          const costOthers = prev.lastBetAmount * (prev.lastBetNumbers.length - 1); // perde os outros
          resultProfit = payout - costOthers; // lucro real
          updated.wins = prev.wins + 1;
          updated.profit = prev.profit + resultProfit;
          updated.currentGaleStep = 0;
          updated.consecutiveLosses = 0;
        } else {
          const cost = prev.lastBetAmount * prev.lastBetNumbers.length;
          resultProfit = -cost;
          updated.losses = prev.losses + 1;
          updated.profit = prev.profit - cost;
          updated.consecutiveLosses = prev.consecutiveLosses + 1;
          
          if (config.useGale && prev.currentGaleStep < config.maxGaleSteps) {
            updated.currentGaleStep = prev.currentGaleStep + 1;
          } else {
            updated.currentGaleStep = 0;
          }
        }

        // Add to history (keep last 20)
        const entry: BetResult = {
          won,
          numbers: prev.lastBetNumbers,
          actual: latestNumber,
          amount: prev.lastBetAmount,
          profit: resultProfit,
          timestamp: Date.now(),
        };
        updated.history = [entry, ...prev.history].slice(0, 20);

        // Check stop conditions
        if (updated.profit <= config.stopLoss) {
          updated.stopped = true;
          updated.stopReason = `Stop Loss: R$${updated.profit.toFixed(2)}`;
        }
        if (updated.profit >= config.stopWin) {
          updated.stopped = true;
          updated.stopReason = `Stop Win: R$${updated.profit.toFixed(2)}`;
        }

        return updated;
      });

      // Atualizar contadores de simulação se estiver em modo sim
      if (simMode) {
        const won = stats.lastBetNumbers.includes(latestNumber);
        const betAmt = stats.lastBetAmount;
        const n = stats.lastBetNumbers.length;
        const resultProfit = won
          ? betAmt * 35 - betAmt * (n - 1)
          : -(betAmt * n);
        if (won) setSimWins(prev => prev + 1);
        setSimProfit(prev => prev + resultProfit);
      }
    }
    
    prevNumberRef.current = latestNumber;
  }, [allNumbers, stats.waitingResult, stats.lastBetNumbers, stats.lastBetAmount, config, simMode]);

  // Calculate current bet amount
  const getCurrentBetAmount = useCallback(() => {
    let amount = config.betValue;
    if (config.useGale && stats.currentGaleStep > 0) {
      amount = config.betValue * Math.pow(config.galeFactor, stats.currentGaleStep);
    }
    return amount;
  }, [config, stats.currentGaleStep]);

  // Quando vai apostar, enviar para extensão E para iframe
  const sendBetToExtension = useCallback((numbers: number[], betAmount: number, probability: number) => {
    window.postMessage({
      type: 'SNIPER_BET_SIGNAL',
      numbers,
      betAmount,
      probability,
      timestamp: Date.now(),
    }, '*');
    try {
      const iframes = document.querySelectorAll('iframe');
      iframes.forEach(iframe => {
        try {
          (iframe as HTMLIFrameElement).contentWindow?.postMessage({
            type: 'PLACE_BET',
            numbers,
            betAmount,
          }, '*');
        } catch { /* cross-origin, extensão vai tratar */ }
      });
    } catch { /* ignore */ }
  }, []);

  // Get bet numbers based on manual type or AI signal
  const getBetNumbers = useCallback((): number[] => {
    if (manualBetType === 'auto') {
      return sniperData?.strategy?.numbers?.slice(0, 12) || [];
    }
    if (manualBetType === 'custom') {
      return customNumbers.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n >= 0 && n <= 36).slice(0, 15);
    }
    const found = MANUAL_BET_TYPES.find(t => t.id === manualBetType);
    return found?.numbers || [];
  }, [manualBetType, customNumbers, sniperData?.strategy?.numbers]);

  // Place a bet (manual or auto)
  const placeBet = useCallback(() => {
    const numbers = getBetNumbers();
    if (numbers.length === 0 || stats.waitingResult || stats.stopped) return;
    if (manualBetType === 'auto' && (!sniperData?.signal || !sniperData?.strategy?.numbers)) return;
    const betAmount = getCurrentBetAmount();

    setStats(prev => ({
      ...prev,
      totalBets: prev.totalBets + 1,
      lastBetNumbers: numbers,
      lastBetAmount: betAmount,
      waitingResult: true,
    }));

    setBetFlash(true);
    setTimeout(() => setBetFlash(false), 600);

    if (simMode) {
      // Simulação: não envia para extensão
      setSimTotal(prev => prev + 1);
      console.log(`[BetPanel] 🧪 Simulação: R$${betAmount.toFixed(2)} em [${numbers.join(',')}]`);
      return;
    }

    // Enviar para extensão E para iframe
    sendBetToExtension(numbers, betAmount, sniperData.signal.probability);

    console.log(`[BetPanel] 🎯 Aposta: R$${betAmount.toFixed(2)} em [${numbers.join(',')}]`);
  }, [sniperData, stats.waitingResult, stats.stopped, getCurrentBetAmount]);

  // Auto-bet: place bet when sniper signal is strong enough
  useEffect(() => {
    autoBetRef.current = config.enabled;
  }, [config.enabled]);

  useEffect(() => {
    if (!autoBetRef.current || stats.stopped || stats.waitingResult) return;
    if (!sniperData?.signal || !sniperData?.strategy?.numbers?.length) return;
    // Accept both 'sniper' and 'alert' modes
    if (sniperData.mode !== 'sniper' && sniperData.mode !== 'alert') return;
    if (sniperData.signal.probability < config.minProbability) return;

    // Auto place
    const timer = setTimeout(() => {
      if (autoBetRef.current && !stats.waitingResult && !stats.stopped) {
        placeBet();
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [sniperData, stats.waitingResult, stats.stopped, config.minProbability, placeBet]);

  const resetStats = () => {
    setStats({
      totalBets: 0, wins: 0, losses: 0, profit: 0,
      currentGaleStep: 0, consecutiveLosses: 0,
      lastBetNumbers: [], lastBetAmount: 0,
      waitingResult: false, stopped: false, stopReason: '',
      history: [],
    });
  };

  const toggleAutoBet = () => {
    if (stats.stopped) {
      resetStats();
    }
    setConfig(prev => ({ ...prev, enabled: !prev.enabled }));
  };

  const winRate = stats.totalBets > 0 ? ((stats.wins / stats.totalBets) * 100).toFixed(1) : '0.0';
  const hasSignal = manualBetType !== 'auto' ? getBetNumbers().length > 0 : (sniperData?.signal && sniperData?.strategy?.numbers?.length > 0);
  const canBet = hasSignal && !stats.waitingResult && !stats.stopped;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass rounded-2xl border transition-all overflow-hidden ${
        betFlash
          ? 'border-primary/50 shadow-[0_0_20px_hsl(var(--primary)/0.15)]'
          : config.enabled
          ? 'border-neon-green/30 shadow-[0_0_15px_hsl(var(--neon-green)/0.08)]'
          : 'border-border/15'
      }`}
    >
      {/* Header */}
      <div className="relative flex items-center justify-between px-4 py-3 border-b border-border/10">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/3 via-transparent to-neon-pink/3" />
        <div className="relative flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center border transition-all ${
            config.enabled 
              ? 'bg-neon-green/10 border-neon-green/25 shadow-[0_0_8px_hsl(var(--neon-green)/0.2)]' 
              : 'bg-gradient-to-br from-primary/15 to-neon-pink/10 border-primary/20 shadow-[0_0_8px_hsl(var(--primary)/0.1)]'
          }`}>
            <Zap className={`w-4 h-4 ${config.enabled ? 'text-neon-green animate-pulse' : 'text-primary'}`} />
          </div>
          <div>
            <span className="font-display font-bold text-[10px] tracking-[0.15em] text-primary">CENTRAL DE APOSTAS</span>
            <div className="flex items-center gap-1.5">
              {config.enabled && (
                <span className="text-[7px] px-1.5 py-0.5 bg-neon-green/10 rounded-md text-neon-green font-bold border border-neon-green/20 animate-pulse">
                  AUTO
                </span>
              )}
              {stats.waitingResult && (
                <span className="text-[7px] px-1.5 py-0.5 bg-[hsl(var(--gold))]/10 rounded-md text-[hsl(var(--gold))] font-bold border border-[hsl(var(--gold))]/20">
                  ⏳ ATIVA
                </span>
              )}
              {simMode && (
                <span className="text-[7px] px-1.5 py-0.5 bg-[hsl(var(--neon-cyan))]/10 rounded-md text-[hsl(var(--neon-cyan))] font-bold border border-[hsl(var(--neon-cyan))]/20">
                  🧪 SIM
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="relative flex items-center gap-1.5">
          <button
            onClick={() => setSimMode(prev => !prev)}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[8px] font-bold border transition-all ${
              simMode
                ? 'bg-[hsl(var(--neon-cyan))]/10 text-[hsl(var(--neon-cyan))] border-[hsl(var(--neon-cyan))]/20'
                : 'glass text-muted-foreground/50 border-border/10 hover:text-foreground'
            }`}
          >
            🧪 {simMode ? 'SIM' : 'REAL'}
          </button>
          <button onClick={() => setShowSettings(!showSettings)}
            className="p-1.5 rounded-lg glass border border-border/10 hover:border-primary/15 transition-colors text-muted-foreground/40 hover:text-primary">
            <Settings className="w-4 h-4" />
          </button>
          <button onClick={resetStats}
            className="p-1.5 rounded-lg glass border border-border/10 hover:border-primary/15 transition-colors text-muted-foreground/40 hover:text-primary">
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Stop alert */}
        {stats.stopped && (
          <div className="bg-destructive/8 border border-destructive/20 rounded-xl p-3 flex items-center gap-2.5 backdrop-blur-sm">
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
            <div>
              <p className="text-[10px] font-bold text-destructive">{stats.stopReason}</p>
              <p className="text-[8px] text-muted-foreground/50">Reset ou ligue Auto-Bet para continuar.</p>
            </div>
          </div>
        )}

        {/* Settings panel */}
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="glass rounded-xl border border-border/15 p-3.5 space-y-3 backdrop-blur-sm">
                <div>
                  <label className="text-[9px] text-muted-foreground/60 mb-1.5 block font-bold tracking-wider">VALOR DA APOSTA (R$)</label>
                  <div className="flex gap-1.5">
                    {[0.5, 1, 2, 5, 10, 25].map(v => (
                      <button key={v} onClick={() => setConfig(prev => ({ ...prev, betValue: v }))}
                        className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all border backdrop-blur-sm ${
                          config.betValue === v
                            ? 'bg-primary/15 text-primary border-primary/25 shadow-neon-cyan'
                            : 'bg-background/15 text-muted-foreground/50 border-border/10 hover:text-foreground'
                        }`}>
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[9px] text-muted-foreground/60 mb-1.5 block font-bold tracking-wider">PROBABILIDADE MÍNIMA (%)</label>
                  <div className="flex gap-1.5">
                    {[70, 75, 80, 85, 90].map(v => (
                      <button key={v} onClick={() => setConfig(prev => ({ ...prev, minProbability: v }))}
                        className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all border backdrop-blur-sm ${
                          config.minProbability === v
                            ? 'bg-primary/15 text-primary border-primary/25 shadow-neon-cyan'
                            : 'bg-background/15 text-muted-foreground/50 border-border/10 hover:text-foreground'
                        }`}>
                        {v}%
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between py-1">
                  <div>
                    <span className="text-[9px] font-bold text-foreground">MARTINGALE (GALE)</span>
                    <p className="text-[8px] text-muted-foreground">Dobra aposta após perda</p>
                  </div>
                  <button onClick={() => setConfig(prev => ({ ...prev, useGale: !prev.useGale }))}
                    className={`w-11 h-6 rounded-full transition-all relative border ${
                      config.useGale ? 'bg-primary/30 border-primary/40' : 'bg-background/20 border-border/20'
                    }`}>
                    <div className={`w-[18px] h-[18px] rounded-full shadow-sm absolute top-[3px] transition-all ${config.useGale ? 'bg-primary' : 'bg-muted-foreground/40'}`}
                      style={{ left: config.useGale ? '22px' : '3px' }} />
                  </button>
                </div>

                {config.useGale && (
                  <div>
                    <label className="text-[8px] text-muted-foreground block mb-1">Max Gale Steps</label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map(v => (
                        <button key={v} onClick={() => setConfig(prev => ({ ...prev, maxGaleSteps: v }))}
                          className={`flex-1 py-1.5 rounded-lg text-[9px] font-bold border transition-all ${
                            config.maxGaleSteps === v ? 'bg-primary/15 text-primary border-primary/25' : 'bg-background/15 text-muted-foreground/50 border-border/10'
                          }`}>{v}</button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[8px] text-muted-foreground block mb-1">STOP LOSS (R$)</label>
                    <div className="flex gap-1">
                      {[-20, -50, -100, -200].map(v => (
                        <button key={v} onClick={() => setConfig(prev => ({ ...prev, stopLoss: v }))}
                          className={`flex-1 py-1.5 rounded-lg text-[8px] font-bold border transition-all ${
                            config.stopLoss === v ? 'bg-destructive/15 text-destructive border-destructive/25' : 'bg-background/15 text-muted-foreground/50 border-border/10'
                          }`}>{v}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[8px] text-muted-foreground block mb-1">STOP WIN (R$)</label>
                    <div className="flex gap-1">
                      {[50, 100, 200, 500].map(v => (
                        <button key={v} onClick={() => setConfig(prev => ({ ...prev, stopWin: v }))}
                          className={`flex-1 py-1.5 rounded-lg text-[8px] font-bold border transition-all ${
                            config.stopWin === v ? 'bg-neon-green/10 text-neon-green border-neon-green/20' : 'bg-background/15 text-muted-foreground/50 border-border/10'
                          }`}>+{v}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bet Type Selector */}
        <div>
          <button
            onClick={() => setShowBetTypes(!showBetTypes)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl glass border border-border/15 text-[9px] font-bold text-foreground/80 hover:border-primary/20 transition-all backdrop-blur-sm"
          >
            <span>
              {manualBetType === 'auto' ? '🤖 Auto (Sinal da IA)' : 
               manualBetType === 'custom' ? '✏️ Números personalizados' :
               MANUAL_BET_TYPES.find(t => t.id === manualBetType)?.label || manualBetType}
            </span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showBetTypes ? 'rotate-180' : ''}`} />
          </button>
          <AnimatePresence>
            {showBetTypes && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="grid grid-cols-3 gap-1 mt-2">
                  {MANUAL_BET_TYPES.map(bt => (
                    <button
                      key={bt.id}
                      onClick={() => { setManualBetType(bt.id); setShowBetTypes(false); }}
                      className={`py-2 px-1.5 rounded-lg text-[8px] font-bold transition-all text-center border backdrop-blur-sm ${
                        manualBetType === bt.id
                          ? 'bg-primary/10 text-primary border-primary/25'
                          : 'bg-background/10 text-muted-foreground/60 border-border/10 hover:text-foreground'
                      }`}
                    >
                      {bt.label}
                      <div className="text-[6px] opacity-50">{bt.desc}</div>
                    </button>
                  ))}
                  <button
                    onClick={() => { setManualBetType('custom'); setShowBetTypes(false); }}
                    className={`py-2 px-1.5 rounded-lg text-[8px] font-bold transition-all text-center border backdrop-blur-sm ${
                      manualBetType === 'custom'
                        ? 'bg-primary/10 text-primary border-primary/25'
                        : 'bg-background/10 text-muted-foreground/60 border-border/10 hover:text-foreground'
                    }`}
                  >
                    ✏️ Personalizar
                    <div className="text-[6px] opacity-50">Seus números</div>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {manualBetType === 'custom' && (
            <div className="mt-2">
              <input
                type="text"
                value={customNumbers}
                onChange={e => setCustomNumbers(e.target.value)}
                placeholder="Ex: 0, 3, 7, 12, 26, 32"
                className="w-full px-3 py-2 rounded-lg glass border border-border/15 text-[10px] text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-primary/40 font-mono"
              />
              <p className="text-[7px] text-muted-foreground mt-1">Separe os números por vírgula (0 a 36)</p>
            </div>
          )}
        </div>

        {/* Stats grid — premium */}
        <div className="grid grid-cols-4 gap-2">
          {[
            {
              icon: <DollarSign className="w-4 h-4" />,
              value: `R$${stats.profit.toFixed(2)}`,
              label: 'LUCRO',
              color: stats.profit >= 0 ? 'text-neon-green' : 'text-destructive',
              border: stats.profit >= 0 ? 'border-neon-green/20 bg-neon-green/[0.03]' : 'border-destructive/20 bg-destructive/[0.03]',
              glow: stats.profit > 0 ? 'shadow-[0_0_12px_hsl(var(--neon-green)/0.1)]' : '',
              delay: 0,
            },
            {
              icon: <Target className="w-4 h-4" />,
              value: `${winRate}%`,
              label: 'ACERTO',
              color: parseFloat(winRate) >= 50 ? 'text-neon-green' : parseFloat(winRate) >= 35 ? 'text-gold' : 'text-foreground/80',
              border: 'border-primary/10 hover:border-primary/25',
              glow: '',
              delay: 0.05,
            },
            {
              icon: <TrendingUp className="w-4 h-4" />,
              value: String(stats.wins),
              label: 'WINS',
              color: 'text-neon-green',
              border: 'border-neon-green/15 bg-neon-green/[0.02]',
              glow: '',
              delay: 0.1,
            },
            {
              icon: <TrendingDown className="w-4 h-4" />,
              value: String(stats.losses),
              label: 'LOSSES',
              color: 'text-destructive',
              border: 'border-destructive/15 bg-destructive/[0.02]',
              glow: '',
              delay: 0.15,
            },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: s.delay }}
              className={`glass rounded-xl p-3 text-center border transition-all group relative overflow-hidden hover:scale-[1.02] ${s.border} ${s.glow}`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-transparent to-primary/[0.015] opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className={`mx-auto mb-1 ${s.color} opacity-40`}>{s.icon}</div>
              <p className={`font-black text-lg font-mono leading-none ${s.color}`}>{s.value}</p>
              <span className="text-[6px] text-muted-foreground/40 font-display tracking-[0.2em] block mt-1">{s.label}</span>
            </motion.div>
          ))}
        </div>

        {/* Current bet info */}
        <div className="flex items-center gap-2 text-[10px] px-1">
          <span className="text-muted-foreground/50">Aposta:</span>
          <span className="font-bold text-primary font-mono">R${getCurrentBetAmount().toFixed(2)}</span>
          {config.useGale && stats.currentGaleStep > 0 && (
            <span className="text-[8px] px-2 py-0.5 bg-[hsl(var(--gold))]/10 text-[hsl(var(--gold))] rounded-md font-bold border border-[hsl(var(--gold))]/20">
              GALE {stats.currentGaleStep}/{config.maxGaleSteps}
            </span>
          )}
          <span className="text-muted-foreground/30 ml-auto font-mono">Total: {stats.totalBets}</span>
        </div>

        {/* Waiting result */}
        {stats.waitingResult && stats.lastBetNumbers.length > 0 && (
          <div className="bg-gold/5 border border-gold/15 rounded-xl p-3 backdrop-blur-sm">
            <span className="text-[9px] text-gold font-bold block mb-1.5">⏳ APOSTA ATIVA — Aguardando resultado...</span>
            <div className="flex flex-wrap gap-1.5">
              {stats.lastBetNumbers.map((n, i) => (
                <div key={i} className={`w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold ring-1 ${
                  getColor(n) === 'red' ? 'bg-red-600 text-white ring-red-400/25' :
                  getColor(n) === 'black' ? 'bg-zinc-800 text-white ring-zinc-500/25' :
                  'bg-emerald-600 text-white ring-emerald-400/25'
                }`}>{n}</div>
              ))}
            </div>
          </div>
        )}

        {/* Scoreboard */}
        {stats.history.length > 0 && (
          <div className="glass rounded-xl border border-border/15 p-3 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-bold text-primary tracking-wider">📊 PLACAR</span>
              <span className="text-[7px] text-muted-foreground/40 font-mono">{stats.history.length} resultado{stats.history.length > 1 ? 's' : ''}</span>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {stats.history.slice(0, 15).map((r) => (
                <motion.div
                  key={r.timestamp}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold ring-1 ${
                    r.won
                      ? 'bg-green-500/15 ring-green-500/40 text-green-400'
                      : 'bg-destructive/15 ring-destructive/40 text-destructive'
                  }`}
                  title={r.won ? `✅ Nº ${r.actual}` : `❌ Nº ${r.actual}`}
                >
                  {r.won ? '✓' : '✗'}
                </motion.div>
              ))}
            </div>
            <div className={`rounded-lg p-2.5 text-[9px] flex items-center gap-2.5 ${
              stats.history[0].won
                ? 'bg-green-500/8 border border-green-500/25'
                : 'bg-destructive/8 border border-destructive/25'
            }`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold ring-1 ${
                getColor(stats.history[0].actual) === 'red' ? 'bg-red-600 text-white ring-red-400/30' :
                getColor(stats.history[0].actual) === 'black' ? 'bg-zinc-800 text-white ring-zinc-500/30' :
                'bg-green-600 text-white ring-green-400/30'
              }`}>
                {stats.history[0].actual}
              </div>
              <div className="flex-1">
                <span className={`font-bold ${stats.history[0].won ? 'text-green-400' : 'text-destructive'}`}>
                  {stats.history[0].won ? '✅ ACERTOU!' : '❌ ERROU'}
                </span>
                <span className="text-muted-foreground ml-2 font-mono">
                  {stats.history[0].profit >= 0 ? '+' : ''}R${stats.history[0].profit.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Sim mode summary */}
        {simMode && simTotal > 0 && (
          <div className="bg-neon-cyan/5 border border-neon-cyan/15 rounded-lg p-2.5 mt-2 backdrop-blur-sm">
            <p className="text-[8px] font-bold text-neon-cyan mb-1">🧪 MODO SIMULAÇÃO</p>
            <div className="flex gap-3 text-[8px]">
              <span className="text-muted-foreground/50">Total: <strong className="text-foreground/70">{simTotal}</strong></span>
              <span className="text-muted-foreground/50">P&L: <strong className={simProfit >= 0 ? 'text-neon-green' : 'text-destructive'}>R${simProfit.toFixed(2)}</strong></span>
              <span className="text-muted-foreground/50">Win: <strong className="text-foreground/70">{simTotal > 0 ? ((simWins/simTotal)*100).toFixed(0) : 0}%</strong></span>
            </div>
            <p className="text-[7px] text-muted-foreground/30 mt-1">Apostas virtuais — sem dinheiro real</p>
          </div>
        )}

        {/* Status da extensão + fase do jogo */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[8px] border flex-1 ${
              extStatus?.extConnected
                ? 'bg-green-500/10 text-green-400 border-green-500/20'
                : 'bg-secondary/60 text-muted-foreground border-border'
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${extStatus?.extConnected ? 'bg-green-400 animate-pulse' : 'bg-muted-foreground/40'}`} />
              <span>{extStatus?.extConnected ? '🔌 Extensão ativa' : '🔌 Instale a extensão'}</span>
            </div>

            {/* Fase do jogo */}
            {extStatus?.extConnected && (
              <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[8px] border font-bold ${
                extStatus.bettingPhase === 'open'
                  ? 'bg-green-500/15 text-green-400 border-green-500/30 animate-pulse'
                  : extStatus.bettingPhase === 'closed'
                  ? 'bg-red-500/10 text-red-400 border-red-500/20'
                  : 'bg-secondary/60 text-muted-foreground border-border'
              }`}>
                {extStatus.bettingPhase === 'open'   ? '🟢 APOSTAS ABERTAS'
                 : extStatus.bettingPhase === 'closed' ? '🔴 APOSTAS FECHADAS'
                 : '⚪ Aguardando...'}
              </div>
            )}
          </div>

          {/* Resultado da última aposta na roleta */}
          {extStatus?.lastAction === 'win' && (
            <motion.div initial={{ opacity:0, scale:0.95 }} animate={{ opacity:1, scale:1 }}
              className="bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2 flex items-center gap-2">
              <span className="text-base">🟢</span>
              <div>
                <span className="text-[9px] font-black text-green-400 block">ACERTO NA ROLETA!</span>
                <span className="text-[8px] text-green-400/70">
                  Nº {extStatus.lastNumber} | +R${extStatus.extProfit?.toFixed(2)} total
                </span>
              </div>
            </motion.div>
          )}
          {extStatus?.lastAction === 'loss' && (
            <motion.div initial={{ opacity:0, scale:0.95 }} animate={{ opacity:1, scale:1 }}
              className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 flex items-center gap-2">
              <span className="text-base">🔴</span>
              <div>
                <span className="text-[9px] font-black text-red-400 block">Saiu {extStatus.lastNumber}</span>
                <span className="text-[8px] text-muted-foreground">
                  {extStatus.extWins}✅ {extStatus.extLosses}❌ | R${extStatus.extProfit?.toFixed(2)}
                </span>
              </div>
            </motion.div>
          )}
          {extStatus?.lastAction === 'bet_placed' && (
            <motion.div initial={{ opacity:0, y:-5 }} animate={{ opacity:1, y:0 }}
              className="bg-primary/15 border border-primary/30 rounded-lg px-3 py-2 text-center">
              <span className="text-[9px] font-bold text-primary">🎰 APOSTANDO NA ROLETA...</span>
            </motion.div>
          )}
          {extStatus?.lastAction === 'pending' && (
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
              className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2 text-center">
              <span className="text-[9px] font-bold text-yellow-400">⏳ Aguardando apostas abrirem...</span>
            </motion.div>
          )}
          {extStatus?.lastAction === 'error' && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-center">
              <span className="text-[8px] text-red-400">⚠️ Erro na extensão — verifique os seletores</span>
            </div>
          )}
        </div>

        {/* Action buttons — premium */}
        <div className="flex gap-2.5 pt-1">
          <motion.div className="flex-1" whileHover={{ scale: canBet ? 1.01 : 1 }} whileTap={{ scale: canBet ? 0.95 : 1 }}>
            <Button
              onClick={placeBet}
              disabled={!canBet}
              className={`w-full h-14 font-bold tracking-wider text-sm rounded-2xl transition-all font-display relative overflow-hidden ${
                canBet
                  ? 'bg-gradient-to-r from-primary via-neon-pink to-primary text-primary-foreground shadow-[0_6px_30px_hsl(var(--primary)/0.3)]'
                  : 'bg-secondary/60 text-muted-foreground/50 border border-border/10'
              }`}
            >
              {canBet && (
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
                />
              )}
              <span className="relative flex items-center gap-2">
                <Zap className="w-5 h-5" />
                <span className="text-[13px]">
                  {stats.waitingResult ? '⏳ AGUARDANDO...' : !hasSignal ? 'SEM SINAL' : 'APOSTAR AGORA'}
                </span>
              </span>
            </Button>
          </motion.div>

          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.93 }}>
            <Button
              onClick={toggleAutoBet}
              className={`px-6 h-14 font-bold tracking-wider text-sm rounded-2xl transition-all font-display relative overflow-hidden ${
                config.enabled
                  ? 'bg-gradient-to-r from-destructive to-red-600 text-destructive-foreground shadow-[0_6px_20px_rgba(239,68,68,0.3)]'
                  : 'bg-gradient-to-r from-neon-green to-emerald-500 text-white shadow-[0_6px_20px_hsl(var(--neon-green)/0.3)]'
              }`}
            >
              {config.enabled ? <Square className="w-5 h-5 mr-1.5" /> : <Play className="w-5 h-5 mr-1.5" />}
              <span className="text-[13px]">{config.enabled ? 'STOP' : 'AUTO'}</span>
            </Button>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};

export default BetPanel;
