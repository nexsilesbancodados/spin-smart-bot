import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';

const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const numBg = (n: number) => n === 0 ? 'bg-emerald-600' : RED_NUMBERS.has(n) ? 'bg-red-600' : 'bg-zinc-800';

interface Props {
  sniperData: any;
  allNumbers: number[];
}

interface AnalysisRow {
  type: string;
  emoji: string;
  label: string;
  result: string;
  confidence: number;
  models: string[];
  numbers: number[];
}

const UnifiedAnalysis = memo(({ sniperData, allNumbers }: Props) => {
  const analyses = useMemo(() => {
    const rows: AnalysisRow[] = [];
    if (allNumbers.length < 10) return rows;

    const recent = allNumbers.slice(0, 50);

    // 1. COR
    const reds = recent.filter(n => RED_NUMBERS.has(n)).length;
    const blacks = recent.filter(n => n > 0 && !RED_NUMBERS.has(n)).length;
    const greens = recent.filter(n => n === 0).length;
    const colorBias = reds > blacks ? 'VERMELHO' : 'PRETO';
    const colorPct = Math.round((Math.max(reds, blacks) / Math.max(1, reds + blacks)) * 100);
    rows.push({
      type: 'cor', emoji: '🎨', label: 'Cor',
      result: `${colorBias} domina (${colorPct}%)`,
      confidence: Math.min(90, 50 + Math.abs(reds - blacks) * 3),
      models: ['Estatístico', 'Bayesiano', 'Markov'],
      numbers: colorBias === 'VERMELHO' 
        ? Array.from({ length: 37 }, (_, i) => i).filter(n => RED_NUMBERS.has(n))
        : Array.from({ length: 37 }, (_, i) => i).filter(n => n > 0 && !RED_NUMBERS.has(n)),
    });

    // 2. PAR/ÍMPAR
    const pares = recent.filter(n => n > 0 && n % 2 === 0).length;
    const impares = recent.filter(n => n > 0 && n % 2 === 1).length;
    const parBias = pares > impares ? 'PAR' : 'ÍMPAR';
    rows.push({
      type: 'paridade', emoji: '⚖️', label: 'Par/Ímpar',
      result: `${parBias} domina (${Math.round((Math.max(pares, impares) / Math.max(1, pares + impares)) * 100)}%)`,
      confidence: Math.min(85, 50 + Math.abs(pares - impares) * 2),
      models: ['Estatístico', 'Pattern Discovery'],
      numbers: parBias === 'PAR'
        ? Array.from({ length: 36 }, (_, i) => i + 1).filter(n => n % 2 === 0)
        : Array.from({ length: 36 }, (_, i) => i + 1).filter(n => n % 2 === 1),
    });

    // 3. ALTO/BAIXO
    const altos = recent.filter(n => n >= 19).length;
    const baixos = recent.filter(n => n >= 1 && n <= 18).length;
    const altoBias = altos > baixos ? 'ALTO (19-36)' : 'BAIXO (1-18)';
    rows.push({
      type: 'alto_baixo', emoji: '📏', label: 'Alto/Baixo',
      result: `${altoBias} domina`,
      confidence: Math.min(82, 50 + Math.abs(altos - baixos) * 2),
      models: ['Estatístico', 'Bayesiano'],
      numbers: altos > baixos
        ? Array.from({ length: 18 }, (_, i) => i + 19)
        : Array.from({ length: 18 }, (_, i) => i + 1),
    });

    // 4. DÚZIA
    const dz = [0, 0, 0, 0];
    recent.forEach(n => { if (n === 0) dz[0]++; else if (n <= 12) dz[1]++; else if (n <= 24) dz[2]++; else dz[3]++; });
    const bestDz = dz.indexOf(Math.max(dz[1], dz[2], dz[3]), 1);
    const coldDz = dz.indexOf(Math.min(dz[1], dz[2], dz[3]), 1);
    rows.push({
      type: 'duzia', emoji: '📊', label: 'Dúzia',
      result: `${bestDz}ª quente (${dz[bestDz]}×) | ${coldDz}ª fria (${dz[coldDz]}×)`,
      confidence: Math.min(88, 55 + (dz[bestDz] - dz[coldDz]) * 2),
      models: ['Gradient', 'Neural', 'Bayesiano'],
      numbers: Array.from({ length: 12 }, (_, i) => (coldDz - 1) * 12 + i + 1), // suggest cold (reversal)
    });

    // 5. COLUNA
    const col = [0, 0, 0, 0];
    recent.forEach(n => { if (n === 0) col[0]++; else col[((n - 1) % 3) + 1]++; });
    const bestCol = col.indexOf(Math.max(col[1], col[2], col[3]), 1);
    const coldCol = col.indexOf(Math.min(col[1], col[2], col[3]), 1);
    rows.push({
      type: 'coluna', emoji: '📐', label: 'Coluna',
      result: `${bestCol}ª quente (${col[bestCol]}×) | ${coldCol}ª fria (${col[coldCol]}×)`,
      confidence: Math.min(84, 52 + (col[bestCol] - col[coldCol]) * 2),
      models: ['Gradient', 'Estatístico'],
      numbers: Array.from({ length: 12 }, (_, i) => coldCol + i * 3).filter(n => n <= 36),
    });

    // 6. SETOR DO CILINDRO
    const VOISINS = new Set([22,18,29,7,28,12,35,3,26,0,32,15,19,4,21,2,25]);
    const TIERS = new Set([27,13,36,11,30,8,23,10,5,24,16,33]);
    const sectors: Record<string, number> = { voisins: 0, tiers: 0, orphelins: 0 };
    recent.forEach(n => {
      if (VOISINS.has(n)) sectors.voisins++;
      else if (TIERS.has(n)) sectors.tiers++;
      else if (n > 0) sectors.orphelins++;
    });
    const bestSec = Object.entries(sectors).sort(([,a],[,b]) => b - a)[0];
    rows.push({
      type: 'setor', emoji: '🌍', label: 'Setor',
      result: `${bestSec[0].charAt(0).toUpperCase() + bestSec[0].slice(1)} dominante (${bestSec[1]}×)`,
      confidence: Math.min(80, 50 + bestSec[1]),
      models: ['Neural Pattern', 'RL Optimizer'],
      numbers: bestSec[0] === 'voisins' ? Array.from(VOISINS) : bestSec[0] === 'tiers' ? Array.from(TIERS) : [1,20,14,31,9,17,34,6],
    });

    // 7. TERMINAL
    const terms: Record<number, number> = {};
    recent.forEach(n => { const t = n % 10; terms[t] = (terms[t] || 0) + 1; });
    const hotT = Object.entries(terms).sort(([,a],[,b]) => b - a)[0];
    rows.push({
      type: 'terminal', emoji: '🔢', label: 'Terminal',
      result: `T${hotT[0]} quente (${hotT[1]}× em 50)`,
      confidence: Math.min(82, 45 + Number(hotT[1]) * 3),
      models: ['Gradient', 'Pattern Discovery'],
      numbers: Array.from({ length: 37 }, (_, i) => i).filter(n => n % 10 === Number(hotT[0])),
    });

    // 8. FUSÃO TOP 5 (from backend)
    if (sniperData?.fusionTop5?.length > 0) {
      rows.push({
        type: 'fusao', emoji: '🧬', label: 'Fusão Top 5',
        result: `[${sniperData.fusionTop5.map((t: any) => t.number).join(', ')}] — ${sniperData.fusionConfidence || 0}%`,
        confidence: sniperData.fusionConfidence || 0,
        models: sniperData.fusionTop5[0]?.voters || [],
        numbers: sniperData.fusionTop5.map((t: any) => t.number),
      });
    }

    // Sort by confidence
    rows.sort((a, b) => b.confidence - a.confidence);
    return rows;
  }, [allNumbers, sniperData?.fusionTop5, sniperData?.fusionConfidence]);

  if (analyses.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-6 text-center">
        <p className="text-xs text-muted-foreground">Aguardando dados suficientes para análise unificada...</p>
      </div>
    );
  }

  // Find top 5 numbers across ALL analyses
  const globalScores: Record<number, number> = {};
  for (const a of analyses) {
    for (const n of a.numbers.slice(0, 10)) {
      globalScores[n] = (globalScores[n] || 0) + a.confidence * 0.01;
    }
  }
  const globalTop5 = Object.entries(globalScores)
    .sort(([,a],[,b]) => b - a)
    .slice(0, 5)
    .map(([n, score]) => ({ number: Number(n), score: Math.round(score * 10) / 10 }));

  return (
    <div className="space-y-3">
      {/* Global Top 5 — Convergência de TODAS as análises */}
      <div className="bg-gradient-to-br from-primary/10 via-card to-card rounded-xl border-2 border-primary/30 p-4">
        <div className="text-[9px] font-black text-primary uppercase tracking-wider mb-3">
          🎯 TOP 5 — Convergência de {analyses.length} Análises
        </div>
        <div className="flex justify-center gap-3 mb-3">
          {globalTop5.map((item, i) => (
            <motion.div
              key={item.number}
              initial={{ scale: 0, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="text-center"
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black text-white shadow-lg ${numBg(item.number)} ${i === 0 ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-110' : ''}`}>
                {item.number}
              </div>
              <div className="text-[8px] font-mono text-primary mt-1">{item.score}</div>
              <div className="text-[6px] text-muted-foreground">#{i + 1}</div>
            </motion.div>
          ))}
        </div>
        <div className="text-[7px] text-muted-foreground text-center">
          Baseado em: Cor, Par/Ímpar, Alto/Baixo, Dúzia, Coluna, Setor, Terminal, Fusão
        </div>
      </div>

      {/* All analyses */}
      <div className="space-y-1.5">
        {analyses.map((a, i) => (
          <motion.div
            key={a.type}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
            className={`rounded-xl border p-3 ${
              a.confidence >= 80 ? 'bg-primary/5 border-primary/25' :
              a.confidence >= 60 ? 'bg-card border-border/60' :
              'bg-card border-border/30'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">{a.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-foreground">{a.label}</span>
                  <span className={`text-[8px] font-mono font-bold ${
                    a.confidence >= 80 ? 'text-green-400' : a.confidence >= 60 ? 'text-amber-400' : 'text-muted-foreground'
                  }`}>{a.confidence}%</span>
                </div>
                <p className="text-[8px] text-muted-foreground truncate">{a.result}</p>
              </div>
              <div className="flex gap-0.5">
                {a.numbers.slice(0, 4).map(n => (
                  <div key={n} className={`w-6 h-6 rounded flex items-center justify-center text-[8px] font-bold text-white ${numBg(n)}`}>
                    {n}
                  </div>
                ))}
                {a.numbers.length > 4 && (
                  <div className="w-6 h-6 rounded flex items-center justify-center text-[7px] font-bold text-muted-foreground bg-secondary">
                    +{a.numbers.length - 4}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-1.5 flex gap-1 flex-wrap">
              {a.models.slice(0, 4).map(m => (
                <span key={m} className="text-[6px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground border border-border/30">
                  {m}
                </span>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
});

UnifiedAnalysis.displayName = 'UnifiedAnalysis';
export default UnifiedAnalysis;
