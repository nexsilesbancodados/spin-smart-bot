import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Edit3, X, Check } from 'lucide-react';

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
        className="flex items-center gap-1.5 text-[9px] px-3 py-1.5 rounded-lg font-bold bg-primary/8 text-primary border border-primary/20 hover:bg-primary/15 transition-all font-display tracking-wider">
        <Edit3 className="w-3 h-3" /> MANUAL
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-md flex items-center justify-center p-4"
            onClick={e => e.target === e.currentTarget && setOpen(false)}>
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="glass-strong rounded-2xl border border-border/30 p-4 w-full max-w-md shadow-2xl shadow-primary/5">

              <div className="flex items-center justify-between mb-3">
                <span className="font-display font-bold text-sm text-primary tracking-wider">📝 ENTRADA MANUAL</span>
                <button onClick={() => setOpen(false)} className="w-7 h-7 rounded-full glass flex items-center justify-center hover:bg-secondary/80 border border-border/20">
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>

              {/* Grid 0-36 */}
              <div className="grid grid-cols-9 gap-1 mb-3">
                {Array.from({ length: 37 }, (_, n) => (
                  <button key={n} onClick={() => addNum(n)}
                    className={`w-full aspect-square rounded-lg text-[9px] font-bold border transition-all hover:scale-110 active:scale-95 ${colorClass(n)}`}>
                    {n}
                  </button>
                ))}
              </div>

              {/* Input de texto */}
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  placeholder="Cole aqui: 32, 15, 0, 27..."
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && processText()}
                  className="flex-1 text-xs px-3 py-2 rounded-xl glass border border-border/30 text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-primary/40 font-mono"
                />
                <button onClick={processText}
                  className="text-xs px-3 py-2 rounded-xl bg-primary/15 text-primary border border-primary/25 font-bold hover:bg-primary/25 transition-all">
                  +
                </button>
              </div>

              {/* Fila de números adicionados */}
              {queue.length > 0 && (
                <div className="mb-3">
                  <div className="text-[8px] text-muted-foreground mb-1 font-mono">{queue.length} número(s) na fila:</div>
                  <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto scrollbar-thin">
                    {queue.map((n, i) => (
                      <button key={i} onClick={() => removeNum(i)}
                        className={`w-7 h-7 rounded-lg text-[8px] font-bold border hover:opacity-60 transition-all ${colorClass(n)}`}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => setQueue([])} className="flex-1 text-xs py-2 rounded-xl glass text-destructive border border-destructive/15 font-bold hover:bg-destructive/10 transition-all font-display tracking-wider">
                  Limpar
                </button>
                <button onClick={confirm} disabled={queue.length === 0}
                  className="flex-1 text-xs py-2 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 disabled:opacity-40 flex items-center justify-center gap-1 font-display tracking-wider transition-all">
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
