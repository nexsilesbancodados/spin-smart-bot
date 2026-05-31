import { memo, useMemo } from "react";
import { useHonestStore } from "../lib/store";
import { colorOf, RED, BLACK, DOZEN_1, DOZEN_2, DOZEN_3, COLUMN_1, COLUMN_2, COLUMN_3 } from "../lib/wheel";

interface Streak {
  label: string;
  count: number;
  probContinue: number;
  emoji: string;
  variant: "warn" | "alert" | "hot";
}

const inSet = (n: number, set: Set<number>) => set.has(n);

const detectStreaks = (spins: number[]): Streak[] => {
  if (spins.length < 3) return [];
  const out: Streak[] = [];

  let red = 0, black = 0;
  for (const n of spins) {
    if (colorOf(n) === "red") {
      red++;
      if (black > 0) break;
    } else if (colorOf(n) === "black") {
      black++;
      if (red > 0) break;
    } else break;
  }
  const colorStreak = Math.max(red, black);
  if (colorStreak >= 4) {
    const winner = red > black ? "Vermelhos" : "Pretos";
    out.push({
      label: `${colorStreak}× ${winner} seguidos`,
      count: colorStreak,
      probContinue: 18 / 37,
      emoji: red > black ? "🔴" : "⚫",
      variant: colorStreak >= 7 ? "hot" : colorStreak >= 5 ? "alert" : "warn",
    });
  }

  let even = 0, odd = 0;
  for (const n of spins) {
    if (n === 0) break;
    if (n % 2 === 0) {
      even++;
      if (odd > 0) break;
    } else {
      odd++;
      if (even > 0) break;
    }
  }
  const parityStreak = Math.max(even, odd);
  if (parityStreak >= 5) {
    out.push({
      label: `${parityStreak}× ${even > odd ? "Pares" : "Ímpares"} seguidos`,
      count: parityStreak,
      probContinue: 18 / 37,
      emoji: "⚖",
      variant: parityStreak >= 7 ? "alert" : "warn",
    });
  }

  const dozenSets = [
    { label: "1ª dúzia (1-12)", set: DOZEN_1 },
    { label: "2ª dúzia (13-24)", set: DOZEN_2 },
    { label: "3ª dúzia (25-36)", set: DOZEN_3 },
  ];
  for (const d of dozenSets) {
    let s = 0;
    for (const n of spins) {
      if (inSet(n, d.set)) s++;
      else break;
    }
    if (s >= 4) {
      out.push({
        label: `${s}× ${d.label}`,
        count: s,
        probContinue: 12 / 37,
        emoji: "🎯",
        variant: s >= 6 ? "alert" : "warn",
      });
      break;
    }
  }

  const colSets = [
    { label: "Coluna 1", set: COLUMN_1 },
    { label: "Coluna 2", set: COLUMN_2 },
    { label: "Coluna 3", set: COLUMN_3 },
  ];
  for (const c of colSets) {
    let s = 0;
    for (const n of spins) {
      if (inSet(n, c.set)) s++;
      else break;
    }
    if (s >= 4) {
      out.push({
        label: `${s}× ${c.label}`,
        count: s,
        probContinue: 12 / 37,
        emoji: "📊",
        variant: s >= 6 ? "alert" : "warn",
      });
      break;
    }
  }

  let zeroes = 0;
  for (let i = 0; i < Math.min(spins.length, 50); i++) {
    if (spins[i] === 0) zeroes++;
  }
  const zerosWindow = Math.min(spins.length, 50);
  let lastZeroIdx = -1;
  for (let i = 0; i < spins.length; i++) {
    if (spins[i] === 0) { lastZeroIdx = i; break; }
  }
  if (lastZeroIdx === -1 && spins.length >= 30) {
    out.push({
      label: `Zero ausente há ${spins.length}+ giros`,
      count: spins.length,
      probContinue: 36 / 37,
      emoji: "0️⃣",
      variant: spins.length >= 50 ? "alert" : "warn",
    });
  } else if (zeroes >= 3 && zerosWindow <= 30) {
    out.push({
      label: `${zeroes}× zeros em ${zerosWindow} giros`,
      count: zeroes,
      probContinue: 1 / 37,
      emoji: "0️⃣",
      variant: "hot",
    });
  }

  return out;
};

const StreakAlerts = memo(() => {
  const spins = useHonestStore((s) => s.spins);
  const recent = useMemo(() => spins.slice(0, 50).map((s) => s.n), [spins]);
  const streaks = useMemo(() => detectStreaks(recent), [recent]);

  if (streaks.length === 0) return null;

  const cls = (v: Streak["variant"]) => {
    if (v === "hot") return "border-red-500/60 bg-red-950/40 text-red-200";
    if (v === "alert") return "border-amber-500/60 bg-amber-950/40 text-amber-200";
    return "border-neutral-700 bg-neutral-900/40 text-neutral-300";
  };

  return (
    <div className="space-y-1">
      {streaks.map((s, i) => (
        <div
          key={i}
          className={`border rounded-lg px-2.5 py-1.5 flex items-center gap-2 text-[11px] ${cls(s.variant)}`}
        >
          <span className="text-base shrink-0">{s.emoji}</span>
          <span className="flex-1 font-bold truncate">{s.label}</span>
          <span className="text-[10px] font-mono opacity-70 shrink-0">
            p(continuar)={(s.probContinue * 100).toFixed(1)}%
          </span>
        </div>
      ))}
      <div className="text-[9px] text-neutral-600 text-center italic">
        Sequências são informativas — cada giro continua independente
      </div>
    </div>
  );
});
StreakAlerts.displayName = "StreakAlerts";

export default StreakAlerts;
