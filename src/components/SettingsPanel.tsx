import { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, X, Sparkles } from 'lucide-react';

interface SettingsConfig {
  sensitivity: 'curto' | 'medio' | 'longo';
  riskLevel: 'conservador' | 'moderado' | 'agressivo';
  betTypes: string[];
}

interface Props { config: SettingsConfig; onChange: (config: SettingsConfig) => void }

const ALL_BET_TYPES = [
  { id: 'cor', label: '🎨 Cores', desc: 'Vermelho / Preto' },
  { id: 'duzia', label: '📊 Dúzias', desc: '1ª, 2ª, 3ª' },
  { id: 'coluna', label: '📐 Colunas', desc: '1ª, 2ª, 3ª' },
  { id: 'setor', label: '🌍 Setores', desc: 'Voisins, Tiers, Orphelins' },
  { id: 'vizinhos', label: '🎯 Vizinhos', desc: 'Números vizinhos no cilindro' },
  { id: 'terminal', label: '🔢 Terminais', desc: 'Números com mesmo final' },
  { id: 'paridade', label: '⚖️ Par/Ímpar', desc: '' },
  { id: 'alto_baixo', label: '📏 Alto/Baixo', desc: '' },
  { id: 'pleno', label: '💎 Plenos', desc: 'Número cheio' },
];

const SettingsPanel = memo(({ config, onChange }: Props) => {
  const [open, setOpen] = useState(false);

  const toggleBetType = (id: string) => {
    const current = config.betTypes;
    const updated = current.includes(id) ? current.filter(t => t !== id) : [...current, id];
    if (updated.length === 0) return;
    onChange({ ...config, betTypes: updated });
  };

  return (
    <>
      <motion.button 
        whileTap={{ scale: 0.9 }}
        onClick={() => setOpen(true)}
        className="px-2.5 py-1.5 rounded-xl text-[9px] font-bold text-muted-foreground/50 border border-border/15 glass hover:border-primary/20 hover:text-primary transition-all flex items-center gap-1 backdrop-blur-sm"
      >
        <Settings className="w-3 h-3" /> Config
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-xl overflow-y-auto">
            <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neon-cyan/20 to-neon-pink/15 border border-neon-cyan/25 flex items-center justify-center shadow-[0_0_15px_hsl(var(--neon-cyan)/0.2)]">
                    <Settings className="w-5 h-5 text-neon-cyan" />
                  </div>
                  <div>
                    <h2 className="font-display font-black text-base tracking-wider">
                      <span className="text-neon-cyan">CONFIG</span><span className="text-neon-pink">URAÇÕES</span>
                    </h2>
                    <p className="text-[8px] text-muted-foreground/40 font-mono">Personalize a IA ao seu estilo</p>
                  </div>
                </div>
                <motion.button 
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setOpen(false)} 
                  className="w-9 h-9 rounded-xl glass flex items-center justify-center hover:bg-destructive/10 border border-border/20 transition-all"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </motion.button>
              </div>

              {/* Sensibilidade */}
              <div className="glass rounded-2xl p-4 space-y-3 border border-border/15 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-cyan/30 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-br from-neon-cyan/[0.02] to-transparent pointer-events-none" />
                <div className="relative">
                  <h3 className="text-[10px] font-black text-neon-cyan uppercase tracking-[0.15em] font-display flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5" /> Sensibilidade da Análise
                  </h3>
                  <p className="text-[8px] text-muted-foreground/40 mt-0.5">Janela temporal para detecção de padrões</p>
                </div>
                <div className="relative grid grid-cols-3 gap-2">
                  {[
                    { id: 'curto' as const, label: 'Curto', desc: '20 giros', emoji: '⚡' },
                    { id: 'medio' as const, label: 'Médio', desc: '50 giros', emoji: '📊' },
                    { id: 'longo' as const, label: 'Longo', desc: '200 giros', emoji: '🔬' },
                  ].map(s => (
                    <motion.button key={s.id} 
                      whileTap={{ scale: 0.95 }}
                      onClick={() => onChange({ ...config, sensitivity: s.id })}
                      className={`p-3 rounded-xl border text-center transition-all backdrop-blur-sm ${
                        config.sensitivity === s.id 
                          ? 'bg-neon-cyan/8 border-neon-cyan/25 ring-1 ring-neon-cyan/15 shadow-[0_0_12px_hsl(var(--neon-cyan)/0.1)]' 
                          : 'glass border-border/15 hover:border-border/30'
                      }`}>
                      <div className="text-xl mb-1">{s.emoji}</div>
                      <div className={`text-[11px] font-black ${config.sensitivity === s.id ? 'text-neon-cyan' : 'text-foreground/60'}`}>{s.label}</div>
                      <div className="text-[8px] text-muted-foreground/30 font-mono">{s.desc}</div>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Risco */}
              <div className="glass rounded-2xl p-4 space-y-3 border border-border/15 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-br from-gold/[0.02] to-transparent pointer-events-none" />
                <div className="relative">
                  <h3 className="text-[10px] font-black text-gold uppercase tracking-[0.15em] font-display">🛡️ Nível de Risco</h3>
                  <p className="text-[8px] text-muted-foreground/40 mt-0.5">Agressividade dos sinais emitidos</p>
                </div>
                <div className="relative grid grid-cols-3 gap-2">
                  {[
                    { id: 'conservador' as const, label: 'Conservador', desc: 'Só sinais 75%+', activeColor: 'text-neon-cyan', activeBg: 'bg-neon-cyan/8 border-neon-cyan/25 ring-neon-cyan/15 shadow-[0_0_12px_hsl(var(--neon-cyan)/0.1)]', emoji: '🔵' },
                    { id: 'moderado' as const, label: 'Moderado', desc: 'Sinais 55%+', activeColor: 'text-gold', activeBg: 'bg-gold/8 border-gold/25 ring-gold/15 shadow-[0_0_12px_hsl(var(--gold)/0.1)]', emoji: '🟡' },
                    { id: 'agressivo' as const, label: 'Agressivo', desc: 'Todos os sinais', activeColor: 'text-destructive', activeBg: 'bg-destructive/8 border-destructive/25 ring-destructive/15 shadow-[0_0_12px_hsl(var(--destructive)/0.1)]', emoji: '🔴' },
                  ].map(r => (
                    <motion.button key={r.id} 
                      whileTap={{ scale: 0.95 }}
                      onClick={() => onChange({ ...config, riskLevel: r.id })}
                      className={`p-3 rounded-xl border text-center transition-all backdrop-blur-sm ${
                        config.riskLevel === r.id ? `${r.activeBg} ring-1` : 'glass border-border/15 hover:border-border/30'
                      }`}>
                      <div className="text-xl mb-1">{r.emoji}</div>
                      <div className={`text-[11px] font-black ${config.riskLevel === r.id ? r.activeColor : 'text-foreground/60'}`}>{r.label}</div>
                      <div className="text-[8px] text-muted-foreground/30 font-mono">{r.desc}</div>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Tipos de Aposta */}
              <div className="glass rounded-2xl p-4 space-y-3 border border-border/15 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-pink/30 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-br from-neon-pink/[0.02] to-transparent pointer-events-none" />
                <div className="relative">
                  <h3 className="text-[10px] font-black text-neon-pink uppercase tracking-[0.15em] font-display">🎰 Tipos de Aposta</h3>
                  <p className="text-[8px] text-muted-foreground/40 mt-0.5">Selecione quais a IA deve priorizar</p>
                </div>
                <div className="relative grid grid-cols-2 gap-2">
                  {ALL_BET_TYPES.map(bt => {
                    const active = config.betTypes.includes(bt.id);
                    return (
                      <motion.button key={bt.id} 
                        whileTap={{ scale: 0.95 }}
                        onClick={() => toggleBetType(bt.id)}
                        className={`px-3 py-2.5 rounded-xl border text-left transition-all backdrop-blur-sm ${
                          active 
                            ? 'bg-neon-pink/6 border-neon-pink/20 shadow-[0_0_8px_hsl(var(--neon-pink)/0.08)]' 
                            : 'glass border-border/10 opacity-35 hover:opacity-60'
                        }`}>
                        <div className={`text-[10px] font-bold ${active ? 'text-foreground/80' : 'text-foreground/50'}`}>{bt.label}</div>
                        {bt.desc && <div className="text-[8px] text-muted-foreground/30">{bt.desc}</div>}
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              <motion.button 
                whileTap={{ scale: 0.97 }}
                onClick={() => setOpen(false)}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-neon-cyan to-neon-pink text-white font-black text-sm shadow-lg shadow-primary/20 font-display tracking-wider relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-pulse" />
                <span className="relative">✓ Salvar e Fechar</span>
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});

SettingsPanel.displayName = 'SettingsPanel';
export default SettingsPanel;
