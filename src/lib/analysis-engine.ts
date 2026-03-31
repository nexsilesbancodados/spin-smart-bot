/**
 * AnalysisEngine — Pattern detection for roulette signals
 * Processes last 50 spins to detect streaks, cold zones, and entry signals
 */

const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

type Color = 'red' | 'black' | 'green';
const getColor = (n: number): Color => n === 0 ? 'green' : RED.has(n) ? 'red' : 'black';
const getDozen = (n: number) => n === 0 ? 0 : n <= 12 ? 1 : n <= 24 ? 2 : 3;
const getColumn = (n: number) => n === 0 ? 0 : ((n - 1) % 3) + 1;

export interface EngineSignal {
  id: string;
  type: 'streak_break' | 'cold_dozen' | 'cold_column' | 'pattern';
  action: string;           // e.g. "ENTRAR NO PRETO"
  actionColor: 'red' | 'black' | 'green' | 'dozen' | 'column';
  confidence: number;       // 0-100
  detail: string;
  protection: string;       // always includes zero
  numbers?: number[];
  urgency: 'high' | 'medium' | 'low';
  streakLength?: number;
  absentRounds?: number;
}

export function analyzeSpins(history: number[]): EngineSignal[] {
  const h = history.slice(0, 50);
  if (h.length < 5) return [];

  const signals: EngineSignal[] = [];

  // ── 1. Streak Break (color) ────────────────────────────
  const colors = h.map(getColor);
  let colorStreak = 1;
  for (let i = 1; i < colors.length; i++) {
    if (colors[i] === colors[0] && colors[0] !== 'green') colorStreak++;
    else break;
  }
  if (colorStreak >= 5) {
    const opposite = colors[0] === 'red' ? 'black' : 'red';
    const conf = Math.min(95, 75 + (colorStreak - 5) * 5);
    signals.push({
      id: `streak-color-${opposite}`,
      type: 'streak_break',
      action: `ENTRAR NO ${opposite === 'red' ? 'VERMELHO' : 'PRETO'}`,
      actionColor: opposite,
      confidence: conf,
      detail: `${colors[0] === 'red' ? 'Vermelho' : 'Preto'} saiu ${colorStreak}× seguidas — quebra iminente`,
      protection: '🛡️ Cobrir o Zero (Proteção obrigatória)',
      urgency: colorStreak >= 7 ? 'high' : 'medium',
      streakLength: colorStreak,
    });
  }

  // ── 2. Streak Break (dozen) ────────────────────────────
  const dozens = h.filter(n => n > 0).map(getDozen);
  if (dozens.length >= 5) {
    let dzStreak = 1;
    for (let i = 1; i < dozens.length; i++) {
      if (dozens[i] === dozens[0]) dzStreak++;
      else break;
    }
    if (dzStreak >= 5) {
      const missing = [1, 2, 3].filter(d => d !== dozens[0]);
      const conf = Math.min(92, 78 + (dzStreak - 5) * 4);
      signals.push({
        id: `streak-dozen-${dozens[0]}`,
        type: 'streak_break',
        action: `ENTRAR NA ${missing.length === 2 ? `${missing[0]}ª ou ${missing[1]}ª` : `${missing[0]}ª`} DÚZIA`,
        actionColor: 'dozen',
        confidence: conf,
        detail: `${dozens[0]}ª Dúzia saiu ${dzStreak}× seguidas — quebra provável`,
        protection: '🛡️ Cobrir o Zero (Proteção obrigatória)',
        urgency: 'high',
        streakLength: dzStreak,
      });
    }
  }

  // ── 3. Cold Dozen Detection ────────────────────────────
  for (let dz = 1; dz <= 3; dz++) {
    let absence = 0;
    for (const n of h) {
      if (n === 0) { absence++; continue; }
      if (getDozen(n) === dz) break;
      absence++;
    }
    if (absence >= 7) {
      const conf = Math.min(88, 65 + Math.min(absence - 7, 8) * 3);
      signals.push({
        id: `cold-dozen-${dz}`,
        type: 'cold_dozen',
        action: `ENTRAR NA ${dz}ª DÚZIA`,
        actionColor: 'dozen',
        confidence: conf,
        detail: `${dz}ª Dúzia ausente há ${absence} rodadas — retorno estatístico provável`,
        protection: '🛡️ Cobrir o Zero (Proteção obrigatória)',
        urgency: absence >= 12 ? 'high' : 'medium',
        absentRounds: absence,
      });
    }
  }

  // ── 4. Cold Column Detection ───────────────────────────
  for (let col = 1; col <= 3; col++) {
    let absence = 0;
    for (const n of h) {
      if (n === 0) { absence++; continue; }
      if (getColumn(n) === col) break;
      absence++;
    }
    if (absence >= 7) {
      const conf = Math.min(85, 62 + Math.min(absence - 7, 8) * 3);
      signals.push({
        id: `cold-column-${col}`,
        type: 'cold_column',
        action: `ENTRAR NA ${col}ª COLUNA`,
        actionColor: 'column',
        confidence: conf,
        detail: `${col}ª Coluna ausente há ${absence} rodadas`,
        protection: '🛡️ Cobrir o Zero (Proteção obrigatória)',
        urgency: absence >= 12 ? 'high' : 'medium',
        absentRounds: absence,
      });
    }
  }

  // Sort by confidence desc
  signals.sort((a, b) => b.confidence - a.confidence);
  return signals;
}
