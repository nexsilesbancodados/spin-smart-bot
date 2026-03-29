import { useState } from 'react';
import { useRoulette } from '@/contexts/RouletteContext';
import { getNumberColor, getHotNumbers, getColdNumbers } from '@/lib/roulette';
import AnimatedHistory from '@/components/AnimatedHistory';
import AlertBanner from '@/components/AlertBanner';
import PasteHistory from '@/components/PasteHistory';
import LiveStats from '@/components/LiveStats';
import PremiumTable from '@/components/PremiumTable';
import QuickNumberPad from '@/components/QuickNumberPad';
import AIAnalysis from '@/components/AIAnalysis';
import { CircleDot, ChevronDown, MonitorPlay, BarChart3, Flame, Snowflake, Play, Square, Zap, Timer } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const PROVIDERS: Record<string, { label: string; tables: { name: string; iframeUrl?: string }[] }> = {
  Playtech: {
    label: 'Playtech',
    tables: [
      { name: 'Roleta Brasileira', iframeUrl: '' },
      { name: 'Mega Fire Blaze Roulette Live', iframeUrl: '' },
      { name: 'Roulette', iframeUrl: '' },
    ],
  },
  Evolution: {
    label: 'Evolution',
    tables: [
      { name: 'Roleta Immersiva', iframeUrl: '' },
      { name: 'Roulette Evo', iframeUrl: '' },
      { name: 'Roleta Relâmpago XXXtreme', iframeUrl: '' },
      { name: 'Roleta ao Vivo', iframeUrl: '' },
    ],
  },
  Pragmatic: {
    label: 'Pragmatic',
    tables: [
      { name: 'PowerUP Roulette', iframeUrl: '' },
      { name: 'Roulette Macao', iframeUrl: '' },
      { name: 'Brasileira Roleta', iframeUrl: '' },
    ],
  },
};

const Index = () => {
  const { history, provider, table, setProvider, setTable, addNumber, autoMode, autoSpeed, toggleAutoMode, setAutoSpeed } = useRoulette();
  const [showIframe, setShowIframe] = useState(false);
  const [iframeUrl, setIframeUrl] = useState('');
  const [activeTab, setActiveTab] = useState<'roleta' | 'aulas' | 'bacbo'>('roleta');

  const hotNumbers = getHotNumbers(history, 8);
  const coldNumbers = getColdNumbers(history, 8);

  // Color stats
  const redCount = history.filter(h => h.color === 'red').length;
  const blackCount = history.filter(h => h.color === 'black').length;
  const greenCount = history.filter(h => h.color === 'green').length;
  const total = history.length || 1;

  return (
    <div className="min-h-screen bg-gradient-casino flex flex-col">
      {/* Navbar */}
      <nav className="bg-secondary/80 backdrop-blur-md border-b border-border px-3 py-2 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CircleDot className="w-5 h-5 text-primary animate-spin-slow" />
            <span className="font-display text-xs tracking-widest text-glow-green">ROULETTE ANALYTICS</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground px-2 py-0.5 bg-accent/20 rounded text-accent font-bold">
              PRO
            </span>
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" title="Online" />
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-2 pb-14">
        <div className="flex flex-col lg:flex-row gap-2">
          {/* LEFT: Iframe / Video Area */}
          <div className="lg:w-[55%] space-y-2">
            {/* Provider/Table */}
            <div className="bg-card rounded-lg border border-border overflow-hidden">
              <div className="flex">
                <div className="flex-1 relative border-r border-border">
                  <select
                    value={provider}
                    onChange={e => {
                      setProvider(e.target.value);
                      setTable(PROVIDERS[e.target.value].tables[0].name);
                    }}
                    className="w-full bg-card text-foreground text-xs font-semibold px-3 py-2 appearance-none cursor-pointer focus:outline-none"
                  >
                    {Object.entries(PROVIDERS).map(([key, p]) => (
                      <option key={key} value={key}>{p.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-3 h-3 text-muted-foreground absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <div className="flex-1 relative">
                  <select
                    value={table}
                    onChange={e => setTable(e.target.value)}
                    className="w-full bg-card text-foreground text-xs font-semibold px-3 py-2 appearance-none cursor-pointer focus:outline-none"
                  >
                    {PROVIDERS[provider]?.tables.map(t => (
                      <option key={t.name} value={t.name}>{t.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-3 h-3 text-muted-foreground absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
              <div className="bg-primary/10 border-t border-primary/20 text-center py-1 text-[10px] font-bold text-primary tracking-widest font-display">
                ⚡ {PROVIDERS[provider]?.label} • {table}
              </div>
            </div>

            {/* Iframe Area */}
            <div className="bg-card rounded-lg border border-border overflow-hidden">
              {iframeUrl ? (
                <iframe src={iframeUrl} className="w-full aspect-video" allowFullScreen />
              ) : (
                <div className="aspect-video flex flex-col items-center justify-center bg-secondary/30 space-y-3">
                  <MonitorPlay className="w-12 h-12 text-muted-foreground/30" />
                  <p className="text-xs text-muted-foreground text-center px-4">
                    Cole a URL do iframe da mesa aqui para visualizar ao vivo
                  </p>
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder="https://..."
                      value={iframeUrl}
                      onChange={e => setIframeUrl(e.target.value)}
                      className="bg-card border border-border rounded px-3 py-1.5 text-xs text-foreground w-64 focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Alerts */}
            <AlertBanner />

            {/* Auto Mode Controls */}
            <div className="bg-card rounded-lg border border-border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className={`w-4 h-4 ${autoMode ? 'text-primary animate-pulse' : 'text-muted-foreground'}`} />
                  <span className="font-display text-xs tracking-widest text-foreground uppercase">Modo Automático</span>
                </div>
                <button
                  onClick={toggleAutoMode}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                    autoMode
                      ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-neon-green'
                  }`}
                >
                  {autoMode ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                  {autoMode ? 'PARAR' : 'INICIAR'}
                </button>
              </div>
              {autoMode && (
                <div className="flex items-center gap-2">
                  <Timer className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">Intervalo:</span>
                  <div className="flex gap-1">
                    {[3, 5, 8, 12, 20].map(s => (
                      <button
                        key={s}
                        onClick={() => setAutoSpeed(s)}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                          autoSpeed === s
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-secondary text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        {s}s
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {autoMode && (
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  <span className="text-[10px] text-primary font-mono">
                    Gerando números a cada {autoSpeed}s • {history.length} resultados
                  </span>
                </div>
              )}
            </div>

            {/* Paste / Number Pad */}
            <PasteHistory />
            <QuickNumberPad onAddNumber={addNumber} />
          </div>

          {/* RIGHT: Analytics Panel */}
          <div className="lg:w-[45%] space-y-2">
            {/* Animated History */}
            <AnimatedHistory />

            {/* Color Distribution Mini Bar */}
            {history.length > 0 && (
              <div className="bg-card rounded-lg border border-border p-2.5">
                <div className="flex gap-0.5 h-3 rounded overflow-hidden">
                  <motion.div
                    animate={{ width: `${(redCount / total) * 100}%` }}
                    className="bg-roulette-red rounded-l"
                    transition={{ duration: 0.5 }}
                  />
                  <motion.div
                    animate={{ width: `${(blackCount / total) * 100}%` }}
                    className="bg-roulette-black"
                    transition={{ duration: 0.5 }}
                  />
                  <motion.div
                    animate={{ width: `${(greenCount / total) * 100}%` }}
                    className="bg-roulette-green rounded-r"
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <div className="flex justify-between mt-1.5 text-[9px] font-mono text-muted-foreground">
                  <span className="text-red-400">🔴 {((redCount / total) * 100).toFixed(0)}%</span>
                  <span>⚫ {((blackCount / total) * 100).toFixed(0)}%</span>
                  <span className="text-green-400">🟢 {((greenCount / total) * 100).toFixed(0)}%</span>
                </div>
              </div>
            )}

            {/* Hot & Cold Numbers */}
            {history.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-card rounded-lg border border-border p-2.5">
                  <div className="flex items-center gap-1 mb-2">
                    <Flame className="w-3 h-3 text-destructive" />
                    <span className="font-display text-[9px] text-destructive tracking-widest">QUENTES</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {hotNumbers.map(h => {
                      const color = getNumberColor(h.number);
                      const cls = color === 'red' ? 'bg-roulette-red' : color === 'black' ? 'bg-roulette-black' : 'bg-roulette-green';
                      return (
                        <div key={h.number} className={`${cls} w-7 h-7 rounded flex items-center justify-center text-[10px] font-bold text-white relative`}>
                          {h.number}
                          <span className="absolute -top-1 -right-1 bg-destructive text-white text-[7px] rounded-full w-3 h-3 flex items-center justify-center">
                            {h.freq}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="bg-card rounded-lg border border-border p-2.5">
                  <div className="flex items-center gap-1 mb-2">
                    <Snowflake className="w-3 h-3 text-blue-400" />
                    <span className="font-display text-[9px] text-blue-400 tracking-widest">FRIOS</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {coldNumbers.map(h => {
                      const color = getNumberColor(h.number);
                      const cls = color === 'red' ? 'bg-roulette-red' : color === 'black' ? 'bg-roulette-black' : 'bg-roulette-green';
                      return (
                        <div key={h.number} className={`${cls} w-7 h-7 rounded flex items-center justify-center text-[10px] font-bold text-white opacity-60`}>
                          {h.number}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Live Stats */}
            <LiveStats />

            {/* Premium Table */}
            <PremiumTable history={history} />
          </div>
        </div>
      </main>

      {/* Footer Navigation */}
      <footer className="fixed bottom-0 left-0 right-0 bg-secondary/90 backdrop-blur border-t border-border z-50">
        <div className="max-w-7xl mx-auto flex justify-around">
          {[
            { id: 'aulas' as const, icon: '📚', label: 'Aulas' },
            { id: 'roleta' as const, icon: '🎰', label: 'Roleta' },
            { id: 'bacbo' as const, icon: '🎲', label: 'BacBo' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center py-1.5 text-[10px] transition-colors ${
                activeTab === tab.id ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <span className="text-base">{tab.icon}</span>
              <span className="font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </footer>
    </div>
  );
};

export default Index;
