import { describe, it, expect } from 'vitest';
import { analyzeSpins, runFullAnalysis } from '../lib/analysis-engine';
import { runAllStrategies } from '../lib/strategy-system';

const mockHistory = [12, 8, 19, 32, 0, 7, 14, 21, 3, 18, 25, 36, 1, 9, 27, 30, 5, 16, 23, 34];

describe('analysis-engine', () => {
  it('deve analisar spins e retornar sinais', () => {
    const result = analyzeSpins(mockHistory);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('deve rodar análise completa', () => {
    const result = runFullAnalysis(mockHistory);
    expect(result).toBeTruthy();
    expect(result?.signals?.length).toBeGreaterThan(0);
  });
});

describe('strategy-system', () => {
  it('deve rodar todas as estratégias e retornar resultados', () => {
    const cfg = { history: mockHistory, balance: 1000, baseBet: 10 };
    const results = runAllStrategies(cfg as any);
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
  });
});
