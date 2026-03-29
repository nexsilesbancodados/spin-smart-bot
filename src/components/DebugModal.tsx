import { useState } from 'react';
import { useRoulette } from '@/contexts/RouletteContext';
import { supabase } from '@/integrations/supabase/client';
import { Bug, X, Send, Clipboard, Terminal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

const DebugModal = () => {
  const [open, setOpen] = useState(false);
  const { addNumber, addNumbers } = useRoulette();
  const [jsonInput, setJsonInput] = useState('');
  const [directInput, setDirectInput] = useState('');
  const [clickCount, setClickCount] = useState(0);

  // Hidden trigger: triple-click the PRO badge area
  const handleSecretClick = () => {
    const count = clickCount + 1;
    setClickCount(count);
    if (count >= 5) {
      setOpen(true);
      setClickCount(0);
    }
    setTimeout(() => setClickCount(0), 2000);
  };

  const handleJsonSubmit = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      const entries = Array.isArray(parsed) ? parsed : [parsed];
      const numbers: number[] = [];

      for (const entry of entries) {
        const num = entry.number ?? entry.n ?? entry.value ?? entry.result;
        if (typeof num === 'number' && num >= 0 && num <= 36) {
          numbers.push(num);
        }
      }

      if (numbers.length === 0) {
        toast.error('Nenhum número válido encontrado no JSON');
        return;
      }

      addNumbers(numbers);
      toast.success(`${numbers.length} número(s) adicionado(s) ao histórico`);
      setJsonInput('');
    } catch {
      toast.error('JSON inválido');
    }
  };

  const handleDirectSubmit = () => {
    const nums = directInput
      .split(/[,\s]+/)
      .map(s => parseInt(s.trim()))
      .filter(n => !isNaN(n) && n >= 0 && n <= 36);

    if (nums.length === 0) {
      toast.error('Nenhum número válido');
      return;
    }

    addNumbers(nums);
    toast.success(`${nums.length} número(s) adicionado(s)`);
    setDirectInput('');
  };

  const handleWebhookTest = async () => {
    try {
      const testNumber = Math.floor(Math.random() * 37);
      const { data, error } = await supabase.functions.invoke('webhook-roulette', {
        body: { number: testNumber, table_id: 'test' },
      });

      if (error) throw error;
      toast.success(`Webhook testado! Número ${testNumber} enviado ao banco.`);
    } catch (err) {
      toast.error(`Erro no webhook: ${err instanceof Error ? err.message : 'Erro'}`);
    }
  };

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook-roulette`;

  return (
    <>
      {/* Secret trigger area */}
      <button
        onClick={handleSecretClick}
        className="fixed bottom-16 right-2 w-8 h-8 z-50 opacity-0"
        aria-label="Debug"
      />

      {/* Floating debug button (visible in dev) */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-16 left-2 z-50 w-8 h-8 rounded-full bg-purple-600/80 text-white flex items-center justify-center hover:bg-purple-500 transition-all shadow-lg"
        title="Debug Console"
      >
        <Bug className="w-4 h-4" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="bg-card border border-border rounded-xl w-full max-w-lg max-h-[80vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-purple-400" />
                  <span className="font-display text-xs tracking-widest text-purple-400">DEBUG CONSOLE</span>
                </div>
                <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 space-y-4">
                {/* Direct number input */}
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground tracking-wider mb-1 block">
                    NÚMEROS DIRETOS (separados por vírgula)
                  </label>
                  <div className="flex gap-2">
                    <input
                      value={directInput}
                      onChange={e => setDirectInput(e.target.value)}
                      placeholder="5, 12, 0, 36, 23..."
                      className="flex-1 bg-secondary border border-border rounded px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-purple-500"
                    />
                    <button
                      onClick={handleDirectSubmit}
                      className="px-3 py-2 bg-purple-600 text-white rounded text-xs font-bold hover:bg-purple-500"
                    >
                      <Send className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* JSON input */}
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground tracking-wider mb-1 block">
                    JSON DE TESTE
                  </label>
                  <textarea
                    value={jsonInput}
                    onChange={e => setJsonInput(e.target.value)}
                    placeholder={`{"number": 17, "color": "black", "table_id": "test"}\n\nou array:\n[{"number": 5}, {"number": 12}, {"number": 0}]`}
                    rows={5}
                    className="w-full bg-secondary border border-border rounded px-3 py-2 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                  <button
                    onClick={handleJsonSubmit}
                    className="mt-1 w-full px-3 py-2 bg-purple-600 text-white rounded text-xs font-bold hover:bg-purple-500"
                  >
                    Processar JSON
                  </button>
                </div>

                {/* Webhook test */}
                <div className="border-t border-border pt-4">
                  <label className="text-[10px] font-bold text-muted-foreground tracking-wider mb-2 block">
                    WEBHOOK ENDPOINT
                  </label>
                  <div className="bg-secondary/50 rounded p-2 mb-2">
                    <code className="text-[9px] text-primary break-all font-mono">{webhookUrl}</code>
                    <button
                      onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success('URL copiada!'); }}
                      className="mt-1 flex items-center gap-1 text-[9px] text-muted-foreground hover:text-foreground"
                    >
                      <Clipboard className="w-3 h-3" /> Copiar URL
                    </button>
                  </div>
                  <p className="text-[9px] text-muted-foreground mb-2">
                    Use esta URL no seu scraper/Tampermonkey para enviar números automaticamente.
                  </p>
                  <button
                    onClick={handleWebhookTest}
                    className="w-full px-3 py-2 bg-accent text-accent-foreground rounded text-xs font-bold hover:opacity-90"
                  >
                    🧪 Testar Webhook (número aleatório)
                  </button>
                </div>

                {/* Scraper example */}
                <div className="border-t border-border pt-4">
                  <label className="text-[10px] font-bold text-muted-foreground tracking-wider mb-2 block">
                    EXEMPLO DE SCRAPER (Tampermonkey)
                  </label>
                  <pre className="bg-secondary/50 rounded p-2 text-[8px] text-foreground/70 font-mono overflow-x-auto whitespace-pre-wrap">
{`// Tampermonkey Script
setInterval(() => {
  let el = document.querySelector('.resultado');
  if (el) {
    fetch('${webhookUrl}', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}'
      },
      body: JSON.stringify({ 
        number: parseInt(el.innerText) 
      })
    });
  }
}, 3000);`}
                  </pre>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default DebugModal;
