import { getNumberColor, type RouletteNumber, type BotState } from '@/lib/roulette';

interface BetSuggestionProps {
  history: RouletteNumber[];
  bot: BotState;
}

const BetSuggestion = ({ history, bot }: BetSuggestionProps) => {
  if (history.length < 3) {
    return (
      <div className="bg-card rounded-lg p-4 border border-border">
        <h3 className="font-display text-sm text-primary mb-2 tracking-wider uppercase">Sinal de Aposta</h3>
        <p className="text-sm text-muted-foreground">Aguardando pelo menos 3 números para gerar sinais...</p>
      </div>
    );
  }

  // Analyze last numbers for patterns
  const last5 = history.slice(0, 5);
  const redCount = last5.filter(h => h.color === 'red').length;
  const blackCount = last5.filter(h => h.color === 'black').length;
  const lastColors = last5.map(h => h.color);

  // Streak detection
  const currentColor = lastColors[0];
  let streak = 0;
  for (const c of lastColors) {
    if (c === currentColor) streak++;
    else break;
  }

  // Simple signal generation
  let signal: 'red' | 'black' | 'skip' = 'skip';
  let confidence = 0;
  let reason = '';

  if (streak >= 3 && currentColor !== 'green') {
    // Bet against the streak
    signal = currentColor === 'red' ? 'black' : 'red';
    confidence = Math.min(85, 50 + streak * 10);
    reason = `Sequência de ${streak}x ${currentColor === 'red' ? 'vermelho' : 'preto'} — apostar contra`;
  } else if (redCount >= 4) {
    signal = 'black';
    confidence = 65;
    reason = 'Predominância de vermelho nos últimos 5';
  } else if (blackCount >= 4) {
    signal = 'red';
    confidence = 65;
    reason = 'Predominância de preto nos últimos 5';
  } else {
    signal = 'skip';
    confidence = 0;
    reason = 'Sem padrão claro — aguardar';
  }

  const signalColor = signal === 'red' ? 'bg-roulette-red' : signal === 'black' ? 'bg-roulette-black' : 'bg-muted';

  return (
    <div className="bg-card rounded-lg p-4 border border-border space-y-3">
      <h3 className="font-display text-sm text-primary tracking-wider uppercase">Sinal de Aposta</h3>

      <div className={`${signalColor} rounded-lg p-4 text-center`}>
        <p className="font-display text-lg text-foreground tracking-wider">
          {signal === 'skip' ? '⏸ AGUARDAR' : signal === 'red' ? '🔴 VERMELHO' : '⚫ PRETO'}
        </p>
        {signal !== 'skip' && (
          <p className="text-xs text-foreground/80 mt-1">
            Confiança: {confidence}% • Aposta: R$ {bot.currentBet.toFixed(2)}
          </p>
        )}
      </div>

      <p className="text-xs text-muted-foreground">{reason}</p>

      {streak >= 2 && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-accent font-semibold">🔥 Sequência:</span>
          <span className="text-foreground">{streak}x {currentColor === 'red' ? 'Vermelho' : currentColor === 'black' ? 'Preto' : 'Verde'}</span>
        </div>
      )}
    </div>
  );
};

export default BetSuggestion;
