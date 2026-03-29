import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Shuffle, Wifi, WifiOff, Zap } from 'lucide-react';
import { getNumberColor } from '@/lib/roulette';

interface ManualInputProps {
  onAddNumber: (n: number) => void;
  onRandomNumber: () => void;
}

const QUICK_NUMBERS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36];

const ManualInput = ({ onAddNumber, onRandomNumber }: ManualInputProps) => {
  const [value, setValue] = useState('');
  const [wsUrl, setWsUrl] = useState('');
  const [wsConnected, setWsConnected] = useState(false);
  const [wsConnecting, setWsConnecting] = useState(false);
  const [showQuickPad, setShowQuickPad] = useState(false);
  const [showWsConfig, setShowWsConfig] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseInt(value);
    if (!isNaN(n) && n >= 0 && n <= 36) {
      onAddNumber(n);
      setValue('');
      inputRef.current?.focus();
    }
  };

  const handleQuickAdd = (n: number) => {
    onAddNumber(n);
  };

  // WebSocket connection
  const connectWs = () => {
    if (!wsUrl) return;
    setWsConnecting(true);
    try {
      const ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        setWsConnected(true);
        setWsConnecting(false);
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Try common field names for the result number
          const number = data.number ?? data.result ?? data.value ?? data.n ?? data.resultado;
          if (typeof number === 'number' && number >= 0 && number <= 36) {
            onAddNumber(number);
          }
        } catch {
          // Try plain number
          const n = parseInt(event.data);
          if (!isNaN(n) && n >= 0 && n <= 36) {
            onAddNumber(n);
          }
        }
      };
      ws.onclose = () => {
        setWsConnected(false);
        setWsConnecting(false);
      };
      ws.onerror = () => {
        setWsConnected(false);
        setWsConnecting(false);
      };
      wsRef.current = ws;
    } catch {
      setWsConnecting(false);
    }
  };

  const disconnectWs = () => {
    wsRef.current?.close();
    wsRef.current = null;
    setWsConnected(false);
  };

  useEffect(() => {
    return () => {
      wsRef.current?.close();
    };
  }, []);

  // Keyboard shortcuts: press number keys to quickly input
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (document.activeElement === inputRef.current) return;
      if (e.key === 'Enter' && value) {
        const n = parseInt(value);
        if (!isNaN(n) && n >= 0 && n <= 36) {
          onAddNumber(n);
          setValue('');
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [value, onAddNumber]);

  return (
    <div className="bg-card rounded-lg p-4 border border-border space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm text-primary tracking-wider uppercase">Entrada ao Vivo</h3>
        <div className="flex gap-1.5">
          <button
            onClick={() => setShowQuickPad(!showQuickPad)}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${showQuickPad ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-muted'}`}
          >
            <Zap className="w-3 h-3 inline mr-1" />
            Teclado Rápido
          </button>
          <button
            onClick={() => setShowWsConfig(!showWsConfig)}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${wsConnected ? 'bg-primary text-primary-foreground shadow-neon-green' : 'bg-secondary text-secondary-foreground hover:bg-muted'}`}
          >
            {wsConnected ? <Wifi className="w-3 h-3 inline mr-1" /> : <WifiOff className="w-3 h-3 inline mr-1" />}
            WebSocket
          </button>
        </div>
      </div>

      {/* Manual input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          ref={inputRef}
          type="number"
          min={0}
          max={36}
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="Digite 0-36 e Enter"
          className="bg-secondary border-border text-foreground text-lg font-display"
        />
        <Button type="submit" size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="w-4 h-4" />
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onRandomNumber} className="border-border text-primary hover:bg-primary/10">
          <Shuffle className="w-4 h-4" />
        </Button>
      </form>

      {/* Quick number pad */}
      {showQuickPad && (
        <div className="grid grid-cols-10 gap-1">
          {QUICK_NUMBERS.map(n => {
            const color = getNumberColor(n);
            const colorClass = color === 'red' ? 'bg-roulette-red hover:bg-roulette-red/80' : color === 'black' ? 'bg-roulette-black hover:bg-roulette-black/80' : 'bg-roulette-green hover:bg-roulette-green/80';
            return (
              <button
                key={n}
                onClick={() => handleQuickAdd(n)}
                className={`${colorClass} w-full aspect-square rounded flex items-center justify-center text-xs font-bold text-foreground transition-all hover:scale-110 active:scale-95`}
              >
                {n}
              </button>
            );
          })}
        </div>
      )}

      {/* WebSocket config */}
      {showWsConfig && (
        <div className="bg-secondary rounded-md p-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            Para conectar à roleta real: abra a Onabet → F12 → Network → WS → copie a URL do WebSocket aqui.
          </p>
          <div className="flex gap-2">
            <Input
              value={wsUrl}
              onChange={e => setWsUrl(e.target.value)}
              placeholder="wss://exemplo.com/ws/roleta"
              className="bg-card border-border text-foreground text-xs"
              disabled={wsConnected}
            />
            {wsConnected ? (
              <Button size="sm" variant="destructive" onClick={disconnectWs} className="text-xs">
                Desconectar
              </Button>
            ) : (
              <Button size="sm" onClick={connectWs} disabled={!wsUrl || wsConnecting} className="bg-primary text-primary-foreground text-xs">
                {wsConnecting ? 'Conectando...' : 'Conectar'}
              </Button>
            )}
          </div>
          {wsConnected && (
            <p className="text-xs text-primary flex items-center gap-1">
              <Wifi className="w-3 h-3" /> Conectado — recebendo números automaticamente
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default ManualInput;
