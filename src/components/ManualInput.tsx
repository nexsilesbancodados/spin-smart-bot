import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Edit3, X, Check, Keyboard } from 'lucide-react';

interface Props {
  onAddNumbers: (nums: number[]) => void;
}

const RED = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
const colorClass = (n: number) =>
  n === 0 ? 'bg-roulette-green text-white border-emerald-400/30'
  : RED.includes(n) ? 'bg-roulette-red text-white border-red-400/20'
  : 'bg-roulette-black text-white border-zinc-600/20';

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
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-[9px] px-3.5 py-2 rounded-xl font-display font-bold bg-primary/8 text-primary border border-primary/20 hover:bg-primary/15 transition-all tracking-wider shadow-sm">
        <Edit3 className="w-3 h-3" /> MANUAL
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-md flex items-center justify-center p-4"
            onClick={e => e.target === e.currentTarget && setOpen(false)}>
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="glass-strong rounded-2xl border border-border/25 p-5 w-full max-w-md shadow-2xl shadow-primary/5">

              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/15 to-neon-pink/10 border border-primary/20 flex items-center justify-center shadow-neon-cyan">
                    <Keyboard className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <span className="font-display font-bold text-sm text-primary tracking-wider">ENTRADA MANUAL</span>
                    <div className="text-[7px] text-muted-foreground/50 font-mono">Adicione números manualmente</div>
                  </div>
                </div>
                <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-xl glass flex items-center justify-center hover:bg-secondary/80 border border-border/20 transition-all">
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>

              {/* Grid 0-36 */}
              <div className="grid grid-cols-9 gap-1.5 mb-4">
                {Array.from({ length: 37 }, (_, n) => (
                  <button key={n} onClick={() => addNum(n)}
                    className={`w-full aspect-square rounded-xl text-[10px] font-bold border transition-all hover:scale-110 active:scale-95 shadow-sm ${colorClass(n)}`}>
                    {n}
                  </button>
                ))}
              </div>

              {/* Input de texto */}
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  placeholder="Cole aqui: 32, 15, 0, 27..."
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && processText()}
                  className="flex-1 text-xs px-4 py-2.5 rounded-xl glass border border-border/25 text-foreground placeholder-muted-foreground/40 focus:outline-none focus:border-primary/40 font-mono"
                />
                <button onClick={processText}
                  className="text-xs px-4 py-2.5 rounded-xl bg-primary/15 text-primary border border-primary/25 font-bold hover:bg-primary/25 transition-all">
                  +
                </button>
              </div>

              {/* Fila de números */}
              {queue.length > 0 && (
                <div className="mb-4">
                  <div className="text-[8px] text-muted-foreground/50 mb-1.5 font-mono">{queue.length} número(s) na fila:</div>
                  <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto scrollbar-thin glass rounded-xl p-2 border border-border/15">
                    {queue.map((n, i) => (
                      <button key={i} onClick={() => removeNum(i)}
                        className={`w-8 h-8 rounded-xl text-[9px] font-bold border hover:opacity-60 transition-all shadow-sm ${colorClass(n)}`}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => setQueue([])} className="flex-1 text-xs py-2.5 rounded-xl glass text-destructive border border-destructive/15 font-display font-bold hover:bg-destructive/10 transition-all tracking-wider">
                  Limpar
                </button>
                <button onClick={confirm} disabled={queue.length === 0}
                  className="flex-1 text-xs py-2.5 rounded-xl bg-primary text-primary-foreground font-display font-bold hover:bg-primary/90 disabled:opacity-40 flex items-center justify-center gap-1.5 tracking-wider transition-all shadow-lg shadow-primary/20">
                  <Check className="w-3.5 h-3.5" /> Confirmar ({queue.length})
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ManualInput;
