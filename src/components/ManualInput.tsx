import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Edit3, X, Check, Keyboard, Trash2, Hash } from 'lucide-react';

interface Props {
  onAddNumbers: (nums: number[]) => void;
}

const RED = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
const colorClass = (n: number) =>
  n === 0 ? 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white border-emerald-400/30'
  : RED.includes(n) ? 'bg-gradient-to-br from-red-500 to-red-700 text-white border-red-400/20'
  : 'bg-gradient-to-br from-zinc-600 to-zinc-900 text-white border-zinc-500/20';

const ManualInput = ({ onAddNumbers }: Props) => {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [queue, setQueue] = useState<number[]>([]);

  const addNum = (n: number) => setQueue(prev => [n, ...prev].slice(0, 50));
  const removeNum = (i: number) => setQueue(prev => prev.filter((_, idx) => idx !== i));

  const processText = () => {
    const nums = text.split(/[,\s]+/).map(Number).filter(n => !isNaN(n) && n >= 0 && n <= 36);
    setQueue(prev => [...nums, ...prev].slice(0, 50));
    setText('');
  };

  const confirm = () => {
    if (queue.length > 0) { onAddNumbers(queue); setQueue([]); setOpen(false); }
  };

  return (
    <>
      <motion.button
        onClick={() => setOpen(true)}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        className="flex items-center gap-1.5 text-[9px] px-3.5 py-2 rounded-xl font-display font-bold bg-primary/8 text-primary border border-primary/20 hover:bg-primary/15 transition-all tracking-wider shadow-sm hover:shadow-[0_0_12px_hsl(var(--primary)/0.15)]"
      >
        <Edit3 className="w-3 h-3" /> MANUAL
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/85 backdrop-blur-xl flex items-center justify-center p-4"
            onClick={e => e.target === e.currentTarget && setOpen(false)}>
            <motion.div initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 30 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="glass-strong rounded-2xl border border-primary/15 p-5 w-full max-w-md shadow-2xl shadow-primary/10 relative overflow-hidden">

              {/* Decorative background */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] via-transparent to-neon-pink/[0.02]" />
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

              {/* Header */}
              <div className="relative flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/15 to-neon-pink/10 border border-primary/20 flex items-center justify-center shadow-[0_0_15px_hsl(var(--primary)/0.2)]">
                    <Keyboard className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <span className="font-display font-bold text-sm text-primary tracking-[0.12em]">ENTRADA MANUAL</span>
                    <div className="text-[7px] text-muted-foreground/50 font-mono">Toque nos números ou cole uma sequência</div>
                  </div>
                </div>
                <motion.button
                  onClick={() => setOpen(false)}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="w-8 h-8 rounded-xl glass flex items-center justify-center hover:bg-destructive/10 border border-border/20 transition-all"
                >
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </motion.button>
              </div>

              {/* Grid 0-36 */}
              <div className="relative grid grid-cols-9 gap-1.5 mb-4">
                {Array.from({ length: 37 }, (_, n) => (
                  <motion.button key={n} onClick={() => addNum(n)}
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.85 }}
                    className={`w-full aspect-square rounded-xl text-[10px] font-bold border transition-all shadow-sm hover:shadow-md ${colorClass(n)}`}>
                    {n}
                  </motion.button>
                ))}
              </div>

              {/* Input de texto */}
              <div className="relative flex gap-2 mb-4">
                <div className="relative flex-1">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/30" />
                  <input
                    type="text"
                    placeholder="Cole aqui: 32, 15, 0, 27..."
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && processText()}
                    className="w-full text-xs pl-8 pr-4 py-2.5 rounded-xl glass border border-border/25 text-foreground placeholder-muted-foreground/40 focus:outline-none focus:border-primary/40 focus:shadow-[0_0_10px_hsl(var(--primary)/0.1)] font-mono transition-all"
                  />
                </div>
                <motion.button
                  onClick={processText}
                  whileTap={{ scale: 0.95 }}
                  className="text-xs px-4 py-2.5 rounded-xl bg-primary/15 text-primary border border-primary/25 font-bold hover:bg-primary/25 transition-all"
                >
                  +
                </motion.button>
              </div>

              {/* Fila de números */}
              <AnimatePresence>
                {queue.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-4 overflow-hidden"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="text-[8px] text-muted-foreground/50 font-mono flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                        {queue.length} número(s) na fila
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto scrollbar-thin glass rounded-xl p-2.5 border border-primary/10">
                      {queue.map((n, i) => (
                        <motion.button
                          key={i}
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          onClick={() => removeNum(i)}
                          whileHover={{ scale: 1.1 }}
                          className={`w-8 h-8 rounded-xl text-[9px] font-bold border transition-all shadow-sm ${colorClass(n)}`}
                        >
                          {n}
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="relative flex gap-2">
                <motion.button
                  onClick={() => setQueue([])}
                  whileTap={{ scale: 0.95 }}
                  className="flex-1 text-xs py-2.5 rounded-xl glass text-destructive border border-destructive/15 font-display font-bold hover:bg-destructive/10 transition-all tracking-wider flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3 h-3" /> Limpar
                </motion.button>
                <motion.button
                  onClick={confirm}
                  disabled={queue.length === 0}
                  whileTap={{ scale: 0.95 }}
                  className="flex-1 text-xs py-2.5 rounded-xl bg-gradient-to-r from-primary to-neon-cyan text-primary-foreground font-display font-bold disabled:opacity-40 flex items-center justify-center gap-1.5 tracking-wider transition-all shadow-lg shadow-primary/25 hover:shadow-primary/35"
                >
                  <Check className="w-3.5 h-3.5" /> Confirmar ({queue.length})
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ManualInput;
