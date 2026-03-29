import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, Play, Square, TrendingUp, TrendingDown, DollarSign, 
  Target, Shield, Settings, RotateCcw, AlertTriangle
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
  const prevNumberRef = useRef<number | null>(null);
  const autoBetRef = useRef(false);
  const [extStatus, setExtStatus] = useState<{
    lastAction: string;
    lastNumber: number | null;
    extConnected: boolean;
  } | null>(null);

  // Escutar mensagens da extensão
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const d = event.data;
      if (!d || typeof d !== 'object') return;
      if (d.type === 'AUTOBET_STATUS') {
        setExtStatus({
          lastAction: d.status,
          lastNumber: d.number || null,
          extConnected: true,
        });
      }
      if (d.type === 'NUMBER_FROM_EXTENSION') {
        setExtStatus(prev => prev ? { ...prev, lastNumber: d.number } : null);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

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

  // Place a bet (manual or auto)
  const placeBet = useCallback(() => {
    if (!sniperData?.signal || !sniperData?.strategy?.numbers || stats.waitingResult || stats.stopped) return;

    const numbers = sniperData.strategy.numbers.slice(0, 12);
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
  const hasSignal = sniperData?.signal && sniperData?.strategy?.numbers?.length > 0;
  const canBet = hasSignal && !stats.waitingResult && !stats.stopped;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border-2 transition-all overflow-hidden ${
        betFlash
          ? 'border-primary shadow-lg shadow-primary/30'
          : config.enabled
          ? 'border-green-500/50'
          : 'border-border'
      }`}
      style={{
        background: betFlash
          ? 'linear-gradient(145deg, hsl(var(--primary) / 0.15), hsl(var(--card)))'
          : config.enabled
          ? 'linear-gradient(145deg, rgba(34,197,94,0.06), hsl(var(--card)))'
          : 'hsl(var(--card))',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Zap className={`w-5 h-5 ${config.enabled ? 'text-green-400 animate-pulse' : 'text-primary'}`} />
          <span className="font-bold text-xs tracking-[0.15em] text-primary">CENTRAL DE APOSTAS</span>
          {config.enabled && (
            <span className="text-[8px] px-2 py-0.5 bg-green-500/15 rounded-md text-green-400 font-bold border border-green-500/30 animate-pulse">
              AUTO
            </span>
          )}
          {stats.waitingResult && (
            <span className="text-[8px] px-2 py-0.5 bg-yellow-500/15 rounded-md text-yellow-400 font-bold border border-yellow-500/30">
              ⏳
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setSimMode(prev => !prev)}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[8px] font-bold border transition-all ${
              simMode
                ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                : 'bg-secondary text-muted-foreground border-border hover:text-foreground'
            }`}
            title="Modo Simulação — apostas virtuais sem dinheiro real"
          >
            🧪 {simMode ? 'SIM' : 'REAL'}
          </button>
          <button onClick={() => setShowSettings(!showSettings)}
            className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
            <Settings className="w-4 h-4" />
          </button>
          <button onClick={resetStats}
            className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Stop alert */}
        {stats.stopped && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
            <div>
              <p className="text-[10px] font-bold text-destructive">{stats.stopReason}</p>
              <p className="text-[8px] text-muted-foreground">Reset ou ligue Auto-Bet para continuar.</p>
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
              <div className="bg-secondary/40 rounded-xl border border-border/50 p-3.5 space-y-3">
                <div>
                  <label className="text-[9px] text-muted-foreground mb-1.5 block font-bold tracking-wide">VALOR DA APOSTA (R$)</label>
                  <div className="flex gap-1.5">
                    {[0.5, 1, 2, 5, 10, 25].map(v => (
                      <button key={v} onClick={() => setConfig(prev => ({ ...prev, betValue: v }))}
                        className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all ${
                          config.betValue === v
                            ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                            : 'bg-secondary text-muted-foreground hover:bg-muted'
                        }`}>
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[9px] text-muted-foreground mb-1.5 block font-bold tracking-wide">PROBABILIDADE MÍNIMA (%)</label>
                  <div className="flex gap-1.5">
                    {[70, 75, 80, 85, 90].map(v => (
                      <button key={v} onClick={() => setConfig(prev => ({ ...prev, minProbability: v }))}
                        className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all ${
                          config.minProbability === v
                            ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                            : 'bg-secondary text-muted-foreground hover:bg-muted'
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
                    className={`w-11 h-6 rounded-full transition-all relative ${
                      config.useGale ? 'bg-primary' : 'bg-secondary border border-border'
                    }`}>
                    <div className="w-4.5 h-4.5 rounded-full bg-white shadow-sm absolute top-[3px] transition-all"
                      style={{ left: config.useGale ? '22px' : '3px', width: '18px', height: '18px' }} />
                  </button>
                </div>

                {config.useGale && (
                  <div>
                    <label className="text-[8px] text-muted-foreground block mb-1">Max Gale Steps</label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map(v => (
                        <button key={v} onClick={() => setConfig(prev => ({ ...prev, maxGaleSteps: v }))}
                          className={`flex-1 py-1.5 rounded-lg text-[9px] font-bold ${
                            config.maxGaleSteps === v ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
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
                          className={`flex-1 py-1.5 rounded-lg text-[8px] font-bold ${
                            config.stopLoss === v ? 'bg-destructive text-destructive-foreground' : 'bg-secondary text-muted-foreground'
                          }`}>{v}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[8px] text-muted-foreground block mb-1">STOP WIN (R$)</label>
                    <div className="flex gap-1">
                      {[50, 100, 200, 500].map(v => (
                        <button key={v} onClick={() => setConfig(prev => ({ ...prev, stopWin: v }))}
                          className={`flex-1 py-1.5 rounded-lg text-[8px] font-bold ${
                            config.stopWin === v ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
                          }`}>+{v}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats grid — with gradient borders */}
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-secondary/40 rounded-xl p-2.5 text-center border border-border/30">
            <DollarSign className="w-3.5 h-3.5 text-muted-foreground mx-auto mb-1" />
            <p className={`font-bold text-base font-mono ${stats.profit >= 0 ? 'text-green-400' : 'text-destructive'}`}>
              R${stats.profit.toFixed(2)}
            </p>
            <span className="text-[8px] text-muted-foreground">Lucro</span>
          </div>
          <div className="bg-secondary/40 rounded-xl p-2.5 text-center border border-border/30">
            <Target className="w-3.5 h-3.5 text-muted-foreground mx-auto mb-1" />
            <p className="font-bold text-base font-mono text-foreground">{winRate}%</p>
            <span className="text-[8px] text-muted-foreground">Acerto</span>
          </div>
          <div className="bg-secondary/40 rounded-xl p-2.5 text-center border border-border/30">
            <TrendingUp className="w-3.5 h-3.5 text-green-400 mx-auto mb-1" />
            <p className="font-bold text-base font-mono text-green-400">{stats.wins}</p>
            <span className="text-[8px] text-muted-foreground">Wins</span>
          </div>
          <div className="bg-secondary/40 rounded-xl p-2.5 text-center border border-border/30">
            <TrendingDown className="w-3.5 h-3.5 text-destructive mx-auto mb-1" />
            <p className="font-bold text-base font-mono text-destructive">{stats.losses}</p>
            <span className="text-[8px] text-muted-foreground">Losses</span>
          </div>
        </div>

        {/* Current bet info */}
        <div className="flex items-center gap-2 text-[10px] px-1">
          <span className="text-muted-foreground">Aposta atual:</span>
          <span className="font-bold text-primary font-mono">R${getCurrentBetAmount().toFixed(2)}</span>
          {config.useGale && stats.currentGaleStep > 0 && (
            <span className="text-[8px] px-2 py-0.5 bg-yellow-500/15 text-yellow-400 rounded-md font-bold border border-yellow-500/30">
              GALE {stats.currentGaleStep}/{config.maxGaleSteps}
            </span>
          )}
          <span className="text-muted-foreground ml-auto">Total: {stats.totalBets} apostas</span>
        </div>

        {/* Waiting result */}
        {stats.waitingResult && stats.lastBetNumbers.length > 0 && (
          <div className="bg-yellow-500/8 border border-yellow-500/25 rounded-xl p-3">
            <span className="text-[9px] text-yellow-400 font-bold block mb-1.5">⏳ APOSTA ATIVA — Aguardando resultado...</span>
            <div className="flex flex-wrap gap-1.5">
              {stats.lastBetNumbers.map((n, i) => (
                <div key={i} className={`w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold ring-1 ${
                  getColor(n) === 'red' ? 'bg-red-600 text-white ring-red-400/30' :
                  getColor(n) === 'black' ? 'bg-zinc-800 text-white ring-zinc-500/30' :
                  'bg-green-600 text-white ring-green-400/30'
                }`}>{n}</div>
              ))}
            </div>
          </div>
        )}

        {/* Scoreboard */}
        {stats.history.length > 0 && (
          <div className="bg-secondary/30 border border-border/40 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-bold text-primary tracking-wider">📊 PLACAR</span>
              <span className="text-[8px] text-muted-foreground">{stats.history.length} resultado{stats.history.length > 1 ? 's' : ''}</span>
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
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2 mt-2">
            <p className="text-[8px] font-bold text-blue-400 mb-1">🧪 MODO SIMULAÇÃO</p>
            <div className="flex gap-3 text-[8px]">
              <span className="text-muted-foreground">Total: <strong className="text-foreground">{simTotal}</strong></span>
              <span className="text-muted-foreground">P&L: <strong className={simProfit >= 0 ? 'text-green-400' : 'text-red-400'}>R${simProfit.toFixed(2)}</strong></span>
              <span className="text-muted-foreground">Win: <strong className="text-foreground">{simTotal > 0 ? ((simWins/simTotal)*100).toFixed(0) : 0}%</strong></span>
            </div>
            <p className="text-[7px] text-muted-foreground mt-1">Apostas virtuais — sem dinheiro real</p>
          </div>
        )}

        {/* Status da extensão */}
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[8px] border ${
          extStatus?.extConnected
            ? 'bg-green-500/10 text-green-400 border-green-500/20'
            : 'bg-secondary/60 text-muted-foreground border-border'
        }`}>
          <div className={`w-1.5 h-1.5 rounded-full ${extStatus?.extConnected ? 'bg-green-400 animate-pulse' : 'bg-muted-foreground/40'}`} />
          <span>{extStatus?.extConnected ? '🔌 Extensão ativa' : '🔌 Instale a extensão'}</span>
        </div>

        {extStatus?.lastAction === 'bet_placed' && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-primary/15 border border-primary/30 rounded-lg px-3 py-2 text-center"
          >
            <span className="text-[9px] font-bold text-primary">🎰 APOSTA COLOCADA NO CASSINO</span>
          </motion.div>
        )}

        {/* Action buttons — bold gradient style */}
        <div className="flex gap-2.5 pt-1">
          <Button
            onClick={placeBet}
            disabled={!canBet}
            className={`flex-1 h-12 font-bold tracking-wider text-sm rounded-xl transition-all ${
              canBet
                ? 'bg-gradient-to-r from-primary via-pink-500 to-primary hover:opacity-90 text-primary-foreground shadow-lg shadow-primary/30'
                : 'bg-secondary text-muted-foreground'
            }`}
          >
            <Zap className="w-4 h-4 mr-1.5" />
            {stats.waitingResult ? 'AGUARDANDO...' : !hasSignal ? 'SEM SINAL' : 'APOSTAR AGORA'}
          </Button>

          <Button
            onClick={toggleAutoBet}
            className={`px-5 h-12 font-bold tracking-wider text-sm rounded-xl transition-all ${
              config.enabled
                ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'
                : 'bg-gradient-to-r from-green-600 to-emerald-500 hover:opacity-90 text-white shadow-lg shadow-green-600/30'
            }`}
          >
            {config.enabled ? <Square className="w-4 h-4 mr-1.5" /> : <Play className="w-4 h-4 mr-1.5" />}
            {config.enabled ? 'PARAR' : 'AUTO'}
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default BetPanel;
