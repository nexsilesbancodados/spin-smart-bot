import { useState } from 'react';
import { useRoulette } from '@/contexts/RouletteContext';
import { ClipboardPaste, ChevronDown, Trash2 } from 'lucide-react';

const PasteHistory = () => {
  const { addNumbers, clearHistory, history } = useRoulette();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');

  const detectedCount = text.match(/\d+/g)?.filter(n => {
    const v = parseInt(n);
    return v >= 0 && v <= 36;
  }).length || 0;

  const handleImport = () => {
    const numbers = text.match(/\d+/g);
    if (!numbers) return;
    const valid = numbers.map(n => parseInt(n)).filter(n => n >= 0 && n <= 36);
    if (valid.length > 0) {
      addNumbers(valid);
      setText('');
      setOpen(false);
    }
  };

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className="flex">
        <button
          onClick={() => setOpen(!open)}
          className="flex-1 flex items-center gap-2 px-3 py-2 hover:bg-secondary/50 transition-colors"
        >
          <ClipboardPaste className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold text-foreground">Colar Histórico</span>
          <ChevronDown className={`w-3 h-3 text-muted-foreground ml-auto transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {history.length > 0 && (
          <button
            onClick={clearHistory}
            className="px-3 border-l border-border text-muted-foreground hover:text-destructive transition-colors"
            title="Limpar histórico"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {open && (
        <div className="p-3 border-t border-border space-y-2">
          <p className="text-[10px] text-muted-foreground">
            Cole os números da roleta: <span className="text-primary">32, 15, 0, 26, 3</span>
          </p>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Cole aqui..."
            className="w-full bg-secondary border border-border rounded-md p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary min-h-[60px] resize-y font-mono"
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">{detectedCount} números</span>
            <button
              onClick={handleImport}
              disabled={detectedCount === 0}
              className="px-3 py-1 text-[10px] font-bold rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
            >
              Importar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PasteHistory;
