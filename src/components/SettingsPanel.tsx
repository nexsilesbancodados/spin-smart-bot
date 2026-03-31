import { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, X } from 'lucide-react';

interface SettingsConfig {
  sensitivity: 'curto' | 'medio' | 'longo';
  riskLevel: 'conservador' | 'moderado' | 'agressivo';
  betTypes: string[];
}

interface Props {
  config: SettingsConfig;
  onChange: (config: SettingsConfig) => void;
}

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
    if (updated.length === 0) return; // must have at least one
    onChange({ ...config, betTypes: updated });
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-2.5 py-1.5 rounded-lg text-[9px] font-bold text-muted-foreground border border-border/50 bg-secondary/30 hover:bg-secondary/60 transition-all flex items-center gap-1"
      >
        <Settings className="w-3 h-3" /> Config
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm overflow-y-auto"
          >
            <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-black text-lg text-foreground">⚙️ Configurações</h2>
                <button onClick={() => setOpen(false)} className="p-2 rounded-lg bg-secondary/50 text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Sensibilidade */}
              <div className="bg-card rounded-xl border border-border p-4 space-y-3">
                <div>
                  <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">📡 Sensibilidade da Análise</h3>
                  <p className="text-[9px] text-muted-foreground mt-0.5">Janela temporal para detecção de padrões</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'curto' as const, label: 'Curto', desc: '20 giros', emoji: '⚡' },
                    { id: 'medio' as const, label: 'Médio', desc: '50 giros', emoji: '📊' },
                    { id: 'longo' as const, label: 'Longo', desc: '200 giros', emoji: '🔬' },
                  ].map(s => (
                    <button
                      key={s.id}
                      onClick={() => onChange({ ...config, sensitivity: s.id })}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        config.sensitivity === s.id
                          ? 'bg-primary/10 border-primary/40 ring-1 ring-primary/30'
                          : 'bg-secondary/30 border-border/50 hover:border-border'
                      }`}
                    >
                      <div className="text-lg">{s.emoji}</div>
                      <div className={`text-[11px] font-black mt-1 ${config.sensitivity === s.id ? 'text-primary' : 'text-foreground'}`}>{s.label}</div>
                      <div className="text-[8px] text-muted-foreground">{s.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Nível de Risco */}
              <div className="bg-card rounded-xl border border-border p-4 space-y-3">
                <div>
                  <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">🛡️ Nível de Risco</h3>
                  <p className="text-[9px] text-muted-foreground mt-0.5">Agressividade dos sinais emitidos</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'conservador' as const, label: 'Conservador', desc: 'Só sinais 75%+', color: 'text-blue-400', emoji: '🔵' },
                    { id: 'moderado' as const, label: 'Moderado', desc: 'Sinais 55%+', color: 'text-primary', emoji: '🟡' },
                    { id: 'agressivo' as const, label: 'Agressivo', desc: 'Todos os sinais', color: 'text-amber-400', emoji: '🔴' },
                  ].map(r => (
                    <button
                      key={r.id}
                      onClick={() => onChange({ ...config, riskLevel: r.id })}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        config.riskLevel === r.id
                          ? 'bg-primary/10 border-primary/40 ring-1 ring-primary/30'
                          : 'bg-secondary/30 border-border/50 hover:border-border'
                      }`}
                    >
                      <div className="text-lg">{r.emoji}</div>
                      <div className={`text-[11px] font-black mt-1 ${config.riskLevel === r.id ? r.color : 'text-foreground'}`}>{r.label}</div>
                      <div className="text-[8px] text-muted-foreground">{r.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tipos de Aposta */}
              <div className="bg-card rounded-xl border border-border p-4 space-y-3">
                <div>
                  <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">🎰 Tipos de Aposta</h3>
                  <p className="text-[9px] text-muted-foreground mt-0.5">Selecione quais a IA deve priorizar</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {ALL_BET_TYPES.map(bt => {
                    const active = config.betTypes.includes(bt.id);
                    return (
                      <button
                        key={bt.id}
                        onClick={() => toggleBetType(bt.id)}
                        className={`px-3 py-2.5 rounded-xl border text-left transition-all ${
                          active
                            ? 'bg-primary/10 border-primary/30'
                            : 'bg-secondary/20 border-border/40 opacity-50 hover:opacity-80'
                        }`}
                      >
                        <div className="text-[10px] font-bold text-foreground">{bt.label}</div>
                        {bt.desc && <div className="text-[8px] text-muted-foreground">{bt.desc}</div>}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={() => setOpen(false)}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-black text-sm"
              >
                ✓ Salvar e Fechar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});

SettingsPanel.displayName = 'SettingsPanel';
export default SettingsPanel;