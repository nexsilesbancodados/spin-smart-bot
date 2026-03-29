import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Edit3, X, Check } from 'lucide-react';

interface Props {
  onAddNumbers: (nums: number[]) => void;
}

const RED = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
const colorClass = (n: number) =>
  n === 0 ? 'bg-green-600 text-white border-green-400/40'
  : RED.includes(n) ? 'bg-red-600 text-white border-red-400/20'
  : 'bg-zinc-800 text-white border-zinc-600/20';

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
        className="flex items-center gap-1.5 text-[9px] px-2.5 py-1 rounded-lg font-bold bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-all">
        <Edit3 className="w-3 h-3" /> Manual
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={e => e.target === e.currentTarget && setOpen(false)}>
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="bg-card rounded-2xl border border-border p-4 w-full max-w-md shadow-xl">

              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-sm text-foreground">📝 Entrada Manual de Números</span>
                <button onClick={() => setOpen(false)} className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80">
                  <X className="w-3 h-3 text-muted-foreground" />
                </button>
              </div>

              {/* Grid 0-36 */}
              <div className="grid grid-cols-9 gap-1 mb-3">
                {Array.from({ length: 37 }, (_, n) => (
                  <button key={n} onClick={() => addNum(n)}
                    className={`w-full aspect-square rounded-full text-[9px] font-bold border transition-all hover:scale-110 active:scale-95 ${colorClass(n)}`}>
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
                  className="flex-1 text-xs px-3 py-1.5 rounded-lg bg-secondary border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50"
                />
                <button onClick={processText}
                  className="text-xs px-3 py-1.5 rounded-lg bg-primary/20 text-primary border border-primary/30 font-bold hover:bg-primary/30">
                  +
                </button>
              </div>

              {/* Fila de números adicionados */}
              {queue.length > 0 && (
                <div className="mb-3">
                  <div className="text-[8px] text-muted-foreground mb-1">{queue.length} número(s) na fila (mais recente primeiro):</div>
                  <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                    {queue.map((n, i) => (
                      <button key={i} onClick={() => removeNum(i)}
                        className={`w-6 h-6 rounded-full text-[7px] font-bold border hover:opacity-60 ${colorClass(n)}`}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => setQueue([])} className="flex-1 text-xs py-1.5 rounded-lg bg-destructive/10 text-destructive border border-destructive/20 font-bold hover:bg-destructive/20">
                  Limpar
                </button>
                <button onClick={confirm} disabled={queue.length === 0}
                  className="flex-1 text-xs py-1.5 rounded-lg bg-primary text-primary-foreground font-bold hover:bg-primary/90 disabled:opacity-40 flex items-center justify-center gap-1">
                  <Check className="w-3 h-3" /> Confirmar ({queue.length})
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
