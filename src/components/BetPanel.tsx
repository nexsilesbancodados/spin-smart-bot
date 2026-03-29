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
  });

  const [showSettings, setShowSettings] = useState(false);
  const [betFlash, setBetFlash] = useState(false);
  const prevNumberRef = useRef<number | null>(null);
  const autoBetRef = useRef(false);

  // Resolve the last bet when a new number comes in
  useEffect(() => {
    if (allNumbers.length === 0) return;
    const latestNumber = allNumbers[0];
    
    if (prevNumberRef.current !== null && prevNumberRef.current !== latestNumber && stats.waitingResult) {
      // New number arrived — resolve bet
      const won = stats.lastBetNumbers.includes(latestNumber);
      
      setStats(prev => {
        const updated = { ...prev, waitingResult: false };
        
        if (won) {
          const payout = prev.lastBetAmount * 35;
          const cost = prev.lastBetAmount * prev.lastBetNumbers.length;
          updated.wins = prev.wins + 1;
          updated.profit = prev.profit + (payout - cost);
          updated.currentGaleStep = 0;
          updated.consecutiveLosses = 0;
        } else {
          const cost = prev.lastBetAmount * prev.lastBetNumbers.length;
          updated.losses = prev.losses + 1;
          updated.profit = prev.profit - cost;
          updated.consecutiveLosses = prev.consecutiveLosses + 1;
          
          if (config.useGale && prev.currentGaleStep < config.maxGaleSteps) {
            updated.currentGaleStep = prev.currentGaleStep + 1;
          } else {
            updated.currentGaleStep = 0;
          }
        }

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
    }
    
    prevNumberRef.current = latestNumber;
  }, [allNumbers, stats.waitingResult, stats.lastBetNumbers, stats.lastBetAmount, config]);

  // Calculate current bet amount
  const getCurrentBetAmount = useCallback(() => {
    let amount = config.betValue;
    if (config.useGale && stats.currentGaleStep > 0) {
      amount = config.betValue * Math.pow(config.galeFactor, stats.currentGaleStep);
    }
    return amount;
  }, [config, stats.currentGaleStep]);

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

    // Send to extension via postMessage (if iframe is open)
    try {
      window.postMessage({
        type: 'roulette_place_bet',
        numbers,
        betAmount,
        probability: sniperData.signal.probability,
      }, '*');
    } catch (e) {
      console.log('[BetPanel] PostMessage sent');
    }

    console.log(`[BetPanel] 🎯 Aposta: R$${betAmount.toFixed(2)} em [${numbers.join(',')}]`);
  }, [sniperData, stats.waitingResult, stats.stopped, getCurrentBetAmount]);

  // Auto-bet: place bet when sniper signal is strong enough
  useEffect(() => {
    autoBetRef.current = config.enabled;
  }, [config.enabled]);

  useEffect(() => {
    if (!autoBetRef.current || stats.stopped || stats.waitingResult) return;
    if (!sniperData?.signal || sniperData.mode !== 'sniper') return;
    if (sniperData.signal.probability < config.minProbability) return;

    // Auto place
    const timer = setTimeout(() => {
      if (autoBetRef.current && !stats.waitingResult && !stats.stopped) {
        placeBet();
      }
    }, 1500); // Small delay before auto-betting

    return () => clearTimeout(timer);
  }, [sniperData, stats.waitingResult, stats.stopped, config.minProbability, placeBet]);

  const resetStats = () => {
    setStats({
      totalBets: 0, wins: 0, losses: 0, profit: 0,
      currentGaleStep: 0, consecutiveLosses: 0,
      lastBetNumbers: [], lastBetAmount: 0,
      waitingResult: false, stopped: false, stopReason: '',
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
      className={`rounded-xl border p-4 transition-all ${
        betFlash
          ? 'bg-gradient-to-r from-primary/40 to-yellow-500/20 border-primary shadow-lg shadow-primary/30'
          : config.enabled
          ? 'bg-gradient-to-r from-green-500/10 to-primary/10 border-green-500/50'
          : 'bg-card border-border'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Zap className={`w-5 h-5 ${config.enabled ? 'text-green-400 animate-pulse' : 'text-primary'}`} />
          <span className="font-display text-xs tracking-[0.15em] font-bold text-primary">CENTRAL DE APOSTAS</span>
          {config.enabled && (
            <span className="text-[7px] px-1.5 py-0.5 bg-green-500/20 rounded-full text-green-400 font-bold border border-green-500/30 animate-pulse">
              AUTO-BET ATIVO
            </span>
          )}
          {stats.waitingResult && (
            <span className="text-[7px] px-1.5 py-0.5 bg-yellow-500/20 rounded-full text-yellow-400 font-bold border border-yellow-500/30">
              AGUARDANDO...
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setShowSettings(!showSettings)}
            className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
            <Settings className="w-3.5 h-3.5" />
          </button>
          <button onClick={resetStats}
            className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Stop alert */}
      {stats.stopped && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-2.5 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
          <div>
            <p className="text-[10px] font-bold text-destructive">{stats.stopReason}</p>
            <p className="text-[8px] text-muted-foreground">Clique em "Reset" ou ligue o Auto-Bet novamente para continuar.</p>
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
            className="overflow-hidden mb-3"
          >
            <div className="bg-secondary/50 rounded-lg border border-border p-3 space-y-3">
              {/* Bet value */}
              <div>
                <label className="text-[9px] text-muted-foreground mb-1 block font-bold">VALOR DA APOSTA (R$)</label>
                <div className="flex gap-1.5">
                  {[0.5, 1, 2, 5, 10, 25].map(v => (
                    <button key={v} onClick={() => setConfig(prev => ({ ...prev, betValue: v }))}
                      className={`flex-1 py-1.5 rounded-md text-[10px] font-bold transition-all ${
                        config.betValue === v
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'bg-secondary text-muted-foreground hover:bg-muted'
                      }`}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {/* Min probability */}
              <div>
                <label className="text-[9px] text-muted-foreground mb-1 block font-bold">PROBABILIDADE MÍNIMA (%)</label>
                <div className="flex gap-1.5">
                  {[70, 75, 80, 85, 90].map(v => (
                    <button key={v} onClick={() => setConfig(prev => ({ ...prev, minProbability: v }))}
                      className={`flex-1 py-1.5 rounded-md text-[10px] font-bold transition-all ${
                        config.minProbability === v
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'bg-secondary text-muted-foreground hover:bg-muted'
                      }`}>
                      {v}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Gale toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-bold text-foreground">MARTINGALE (GALE)</span>
                  <p className="text-[8px] text-muted-foreground">Dobra aposta após perda</p>
                </div>
                <button onClick={() => setConfig(prev => ({ ...prev, useGale: !prev.useGale }))}
                  className={`w-10 h-5 rounded-full transition-all relative ${
                    config.useGale ? 'bg-primary' : 'bg-secondary border border-border'
                  }`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow-sm absolute top-0.5 transition-all ${
                    config.useGale ? 'left-5.5' : 'left-0.5'
                  }`} style={{ left: config.useGale ? '22px' : '2px' }} />
                </button>
              </div>

              {config.useGale && (
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[8px] text-muted-foreground block mb-0.5">Max Gale Steps</label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map(v => (
                        <button key={v} onClick={() => setConfig(prev => ({ ...prev, maxGaleSteps: v }))}
                          className={`flex-1 py-1 rounded text-[9px] font-bold ${
                            config.maxGaleSteps === v ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
                          }`}>{v}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Stop Loss / Win */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[8px] text-muted-foreground block mb-0.5">STOP LOSS (R$)</label>
                  <div className="flex gap-1">
                    {[-20, -50, -100, -200].map(v => (
                      <button key={v} onClick={() => setConfig(prev => ({ ...prev, stopLoss: v }))}
                        className={`flex-1 py-1 rounded text-[8px] font-bold ${
                          config.stopLoss === v ? 'bg-destructive text-destructive-foreground' : 'bg-secondary text-muted-foreground'
                        }`}>{v}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[8px] text-muted-foreground block mb-0.5">STOP WIN (R$)</label>
                  <div className="flex gap-1">
                    {[50, 100, 200, 500].map(v => (
                      <button key={v} onClick={() => setConfig(prev => ({ ...prev, stopWin: v }))}
                        className={`flex-1 py-1 rounded text-[8px] font-bold ${
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

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        <div className="bg-secondary/50 rounded-lg p-2 text-center">
          <DollarSign className="w-3 h-3 text-muted-foreground mx-auto mb-0.5" />
          <p className={`font-display text-sm font-bold ${stats.profit >= 0 ? 'text-green-400' : 'text-destructive'}`}>
            R${stats.profit.toFixed(2)}
          </p>
          <span className="text-[7px] text-muted-foreground">Lucro</span>
        </div>
        <div className="bg-secondary/50 rounded-lg p-2 text-center">
          <Target className="w-3 h-3 text-muted-foreground mx-auto mb-0.5" />
          <p className="font-display text-sm font-bold text-foreground">{winRate}%</p>
          <span className="text-[7px] text-muted-foreground">Acerto</span>
        </div>
        <div className="bg-secondary/50 rounded-lg p-2 text-center">
          <TrendingUp className="w-3 h-3 text-green-400 mx-auto mb-0.5" />
          <p className="font-display text-sm font-bold text-green-400">{stats.wins}</p>
          <span className="text-[7px] text-muted-foreground">Wins</span>
        </div>
        <div className="bg-secondary/50 rounded-lg p-2 text-center">
          <TrendingDown className="w-3 h-3 text-destructive mx-auto mb-0.5" />
          <p className="font-display text-sm font-bold text-destructive">{stats.losses}</p>
          <span className="text-[7px] text-muted-foreground">Losses</span>
        </div>
      </div>

      {/* Current bet info */}
      <div className="flex items-center gap-2 mb-3 text-[9px]">
        <span className="text-muted-foreground">Aposta atual:</span>
        <span className="font-bold text-accent">R${getCurrentBetAmount().toFixed(2)}</span>
        {config.useGale && stats.currentGaleStep > 0 && (
          <span className="text-[7px] px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded font-bold">
            GALE {stats.currentGaleStep}/{config.maxGaleSteps}
          </span>
        )}
        <span className="text-muted-foreground ml-auto">Total: {stats.totalBets} apostas</span>
      </div>

      {/* Waiting result indicator */}
      {stats.waitingResult && stats.lastBetNumbers.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2 mb-3">
          <span className="text-[8px] text-yellow-400 font-bold block mb-1">⏳ APOSTA ATIVA — Aguardando resultado...</span>
          <div className="flex flex-wrap gap-1">
            {stats.lastBetNumbers.map((n, i) => (
              <div key={i} className={`w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold border ${
                getColor(n) === 'red' ? 'bg-red-600 text-white border-red-500/50' :
                getColor(n) === 'black' ? 'bg-gray-800 text-white border-gray-600/50' :
                'bg-green-600 text-white border-green-500/50'
              }`}>{n}</div>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          onClick={placeBet}
          disabled={!canBet}
          className={`flex-1 font-display tracking-wider text-sm ${
            canBet
              ? 'bg-gradient-to-r from-primary to-green-500 hover:from-primary/90 hover:to-green-500/90 text-primary-foreground shadow-lg shadow-primary/30'
              : 'bg-secondary text-muted-foreground'
          }`}
        >
          <Zap className="w-4 h-4 mr-1" />
          {stats.waitingResult ? 'AGUARDANDO...' : !hasSignal ? 'SEM SINAL' : 'APOSTAR AGORA'}
        </Button>

        <Button
          onClick={toggleAutoBet}
          className={`px-4 font-display tracking-wider text-sm ${
            config.enabled
              ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'
              : 'bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/30'
          }`}
        >
          {config.enabled ? <Square className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
          {config.enabled ? 'PARAR' : 'AUTO'}
        </Button>
      </div>
    </motion.div>
  );
};

export default BetPanel;
