// Roulette number colors
const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const BLACK_NUMBERS = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];

export type RouletteColor = 'red' | 'black' | 'green';

export interface RouletteNumber {
  value: number;
  color: RouletteColor;
  timestamp: Date;
}

export interface Strategy {
  id: string;
  name: string;
  description: string;
  type: 'martingale' | 'fibonacci' | 'dalembert' | 'pattern';
}

export interface BotState {
  isRunning: boolean;
  strategy: string;
  currentBet: number;
  baseBet: number;
  balance: number;
  totalBets: number;
  wins: number;
  losses: number;
  profitLoss: number;
  sequence: number[];
}

export const getNumberColor = (n: number): RouletteColor => {
  if (n === 0) return 'green';
  if (RED_NUMBERS.includes(n)) return 'red';
  return 'black';
};

export const STRATEGIES: Strategy[] = [
  { id: 'martingale', name: 'Martingale', description: 'Dobra a aposta após cada perda', type: 'martingale' },
  { id: 'fibonacci', name: 'Fibonacci', description: 'Segue a sequência de Fibonacci', type: 'fibonacci' },
  { id: 'dalembert', name: "D'Alembert", description: 'Aumenta +1 na perda, diminui -1 na vitória', type: 'dalembert' },
  { id: 'pattern', name: 'Análise de Padrões', description: 'Detecta sequências e aposta contra', type: 'pattern' },
];

export const getSection = (n: number): string => {
  if (n === 0) return 'Zero';
  if (n <= 12) return '1ª Dúzia';
  if (n <= 24) return '2ª Dúzia';
  return '3ª Dúzia';
};

export const getColumn = (n: number): number => {
  if (n === 0) return 0;
  return ((n - 1) % 3) + 1;
};

export const isEven = (n: number): boolean => n > 0 && n % 2 === 0;
export const isLow = (n: number): boolean => n >= 1 && n <= 18;

export const generateRandomNumber = (): number => Math.floor(Math.random() * 37);

export const calculateFrequency = (history: RouletteNumber[]): Map<number, number> => {
  const freq = new Map<number, number>();
  for (let i = 0; i <= 36; i++) freq.set(i, 0);
  history.forEach(h => freq.set(h.value, (freq.get(h.value) || 0) + 1));
  return freq;
};

export const getHotNumbers = (history: RouletteNumber[], count = 5): { number: number; freq: number }[] => {
  const freq = calculateFrequency(history);
  return Array.from(freq.entries())
    .map(([number, f]) => ({ number, freq: f }))
    .sort((a, b) => b.freq - a.freq)
    .slice(0, count);
};

export const getColdNumbers = (history: RouletteNumber[], count = 5): { number: number; freq: number }[] => {
  const freq = calculateFrequency(history);
  return Array.from(freq.entries())
    .map(([number, f]) => ({ number, freq: f }))
    .sort((a, b) => a.freq - b.freq)
    .slice(0, count);
};

export const getColorStats = (history: RouletteNumber[]) => {
  const red = history.filter(h => h.color === 'red').length;
  const black = history.filter(h => h.color === 'black').length;
  const green = history.filter(h => h.color === 'green').length;
  return { red, black, green };
};
