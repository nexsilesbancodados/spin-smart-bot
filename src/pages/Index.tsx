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
import DebugModal from '@/components/DebugModal';
import { CircleDot, ChevronDown, MonitorPlay, Flame, Snowflake, Play, Square, Zap, Timer, ExternalLink, Maximize2, Minimize2, Download, Copy, Check } from 'lucide-react';
import { motion } from 'framer-motion';

const PROVIDERS: Record<string, { label: string; tables: { name: string; defaultUrl?: string }[] }> = {
  Playtech: {
    label: 'Playtech',
    tables: [
      { name: 'Roleta Brasileira', defaultUrl: '' },
      { name: 'Mega Fire Blaze Roulette Live', defaultUrl: '' },
      { name: 'Roulette', defaultUrl: '' },
    ],
  },
  Evolution: {
    label: 'Evolution',
    tables: [
      { name: 'Roleta Immersiva', defaultUrl: '' },
      { name: 'Roulette Evo', defaultUrl: '' },
      { name: 'Roleta Relâmpago XXXtreme', defaultUrl: '' },
      { name: 'Roleta ao Vivo', defaultUrl: '' },
    ],
  },
  Pragmatic: {
    label: 'Pragmatic',
    tables: [
      { name: 'PowerUP Roulette', defaultUrl: '' },
      { name: 'Roulette Macao', defaultUrl: '' },
      { name: 'Brasileira Roleta', defaultUrl: '' },
    ],
  },
};

const Index = () => {
  const { history, provider, table, setProvider, setTable, addNumber, autoMode, autoSpeed, toggleAutoMode, setAutoSpeed } = useRoulette();
  const DEFAULT_IFRAME_URL = 'https://ona.bet.br/live-casino/game/3782786?provider=Playtech&from=%2Flive-casino';
  const [iframeUrl, setIframeUrl] = useState(DEFAULT_IFRAME_URL);
  const [urlInput, setUrlInput] = useState(DEFAULT_IFRAME_URL);
  const [activeTab, setActiveTab] = useState<'roleta' | 'aulas' | 'bacbo'>('roleta');
  const [iframeExpanded, setIframeExpanded] = useState(false);
  const [showPremium, setShowPremium] = useState(false);

  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook-roulette`;

  const downloadExtension = () => {
    fetch('/roulette-tracker-extension.zip')
      .then(res => {
        if (!res.ok) throw new Error(`Download failed: ${res.status}`);
        return res.blob();
      })
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'roulette-tracker-extension.zip';
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch(err => alert(err.message));
  };

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  const hotNumbers = getHotNumbers(history, 8);
  const coldNumbers = getColdNumbers(history, 8);

  const redCount = history.filter(h => h.color === 'red').length;
  const blackCount = history.filter(h => h.color === 'black').length;
  const greenCount = history.filter(h => h.color === 'green').length;
  const total = history.length || 1;

  const handleLoadUrl = () => {
    if (urlInput.trim()) {
      setIframeUrl(urlInput.trim());
    }
  };

  return (
    <div className="h-screen bg-gradient-casino flex flex-col overflow-hidden">
      {/* Compact Navbar */}
      <nav className="bg-secondary/90 backdrop-blur-md border-b border-border px-3 py-1.5 z-50 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CircleDot className="w-4 h-4 text-primary animate-spin-slow" />
            <span className="font-display text-[10px] tracking-widest text-glow-green">ROULETTE ANALYTICS</span>
          </div>
          <div className="flex items-center gap-3">
            {/* Auto mode toggle inline */}
            <button
              onClick={toggleAutoMode}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold transition-all ${
                autoMode
                  ? 'bg-destructive text-destructive-foreground'
                  : 'bg-primary/20 text-primary hover:bg-primary/30'
              }`}
            >
              {autoMode ? <Square className="w-2.5 h-2.5" /> : <Play className="w-2.5 h-2.5" />}
              {autoMode ? 'PARAR' : 'AUTO'}
            </button>
            {autoMode && (
              <div className="flex gap-0.5">
                {[3, 5, 8].map(s => (
                  <button
                    key={s}
                    onClick={() => setAutoSpeed(s)}
                    className={`px-1.5 py-0.5 rounded text-[8px] font-semibold ${
                      autoSpeed === s ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
                    }`}
                  >
                    {s}s
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={downloadExtension}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-accent/20 text-accent hover:bg-accent/30 transition-all"
              title="Baixar extensão Chrome"
            >
              <Download className="w-2.5 h-2.5" />
              EXT
            </button>
            <span className="text-[9px] px-1.5 py-0.5 bg-accent/20 rounded text-accent font-bold">PRO</span>
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          </div>
        </div>
      </nav>

      {/* Main Split Layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* LEFT PANEL - Analysis & Controls */}
        <div className={`${iframeExpanded ? 'hidden lg:flex' : 'flex'} flex-col ${iframeExpanded ? 'lg:w-[280px]' : 'lg:w-[340px]'} border-r border-border overflow-y-auto transition-all`}>
          {/* Provider/Table Selectors */}
          <div className="shrink-0 border-b border-border">
            <div className="flex">
              <div className="flex-1 relative border-r border-border">
                <select
                  value={provider}
                  onChange={e => {
                    setProvider(e.target.value);
                    setTable(PROVIDERS[e.target.value].tables[0].name);
                  }}
                  className="w-full bg-card text-foreground text-[11px] font-semibold px-2 py-1.5 appearance-none cursor-pointer focus:outline-none"
                >
                  {Object.entries(PROVIDERS).map(([key, p]) => (
                    <option key={key} value={key}>{p.label}</option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 text-muted-foreground absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <div className="flex-1 relative">
                <select
                  value={table}
                  onChange={e => setTable(e.target.value)}
                  className="w-full bg-card text-foreground text-[11px] font-semibold px-2 py-1.5 appearance-none cursor-pointer focus:outline-none"
                >
                  {PROVIDERS[provider]?.tables.map(t => (
                    <option key={t.name} value={t.name}>{t.name}</option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 text-muted-foreground absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
            {/* Premium toggle */}
            <div className="flex items-center justify-between px-2 py-1 bg-primary/5 border-t border-primary/10">
              <span className="text-[9px] font-bold text-primary tracking-wider font-display">
                ⚡ {PROVIDERS[provider]?.label} • {table}
              </span>
              <label className="flex items-center gap-1 cursor-pointer">
                <span className="text-[8px] text-muted-foreground">Tabela Premium</span>
                <input
                  type="checkbox"
                  checked={showPremium}
                  onChange={e => setShowPremium(e.target.checked)}
                  className="w-3 h-3 accent-primary"
                />
              </label>
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {/* Alerts */}
            <AlertBanner />

            {/* History */}
            <AnimatedHistory />

            {/* Color Bar */}
            {history.length > 0 && (
              <div className="bg-card rounded-lg border border-border p-2">
                <div className="flex gap-0.5 h-2.5 rounded overflow-hidden">
                  <motion.div animate={{ width: `${(redCount / total) * 100}%` }} className="bg-roulette-red rounded-l" transition={{ duration: 0.5 }} />
                  <motion.div animate={{ width: `${(blackCount / total) * 100}%` }} className="bg-roulette-black" transition={{ duration: 0.5 }} />
                  <motion.div animate={{ width: `${(greenCount / total) * 100}%` }} className="bg-roulette-green rounded-r" transition={{ duration: 0.5 }} />
                </div>
                <div className="flex justify-between mt-1 text-[8px] font-mono text-muted-foreground">
                  <span className="text-roulette-red">🔴 {((redCount / total) * 100).toFixed(0)}%</span>
                  <span>⚫ {((blackCount / total) * 100).toFixed(0)}%</span>
                  <span className="text-roulette-green">🟢 {((greenCount / total) * 100).toFixed(0)}%</span>
                </div>
              </div>
            )}

            {/* Hot & Cold */}
            {history.length > 0 && (
              <div className="grid grid-cols-2 gap-1.5">
                <div className="bg-card rounded-lg border border-border p-2">
                  <div className="flex items-center gap-1 mb-1.5">
                    <Flame className="w-3 h-3 text-destructive" />
                    <span className="font-display text-[8px] text-destructive tracking-widest">QUENTES</span>
                  </div>
                  <div className="flex flex-wrap gap-0.5">
                    {hotNumbers.map(h => {
                      const color = getNumberColor(h.number);
                      const cls = color === 'red' ? 'bg-roulette-red' : color === 'black' ? 'bg-roulette-black' : 'bg-roulette-green';
                      return (
                        <div key={h.number} className={`${cls} w-6 h-6 rounded flex items-center justify-center text-[9px] font-bold text-white relative`}>
                          {h.number}
                          <span className="absolute -top-0.5 -right-0.5 bg-destructive text-white text-[6px] rounded-full w-2.5 h-2.5 flex items-center justify-center">
                            {h.freq}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="bg-card rounded-lg border border-border p-2">
                  <div className="flex items-center gap-1 mb-1.5">
                    <Snowflake className="w-3 h-3 text-blue-400" />
                    <span className="font-display text-[8px] text-blue-400 tracking-widest">FRIOS</span>
                  </div>
                  <div className="flex flex-wrap gap-0.5">
                    {coldNumbers.map(h => {
                      const color = getNumberColor(h.number);
                      const cls = color === 'red' ? 'bg-roulette-red' : color === 'black' ? 'bg-roulette-black' : 'bg-roulette-green';
                      return (
                        <div key={h.number} className={`${cls} w-6 h-6 rounded flex items-center justify-center text-[9px] font-bold text-white opacity-60`}>
                          {h.number}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Números Puxados (Quick Pad) */}
            <QuickNumberPad onAddNumber={addNumber} />

            {/* Live Stats */}
            <LiveStats />

            {/* AI Analysis */}
            <AIAnalysis />

            {/* Premium Table (toggled) */}
            {showPremium && <PremiumTable history={history} />}

            {/* Paste History */}
            <PasteHistory />
          </div>
        </div>

        {/* RIGHT PANEL - Casino Iframe */}
        <div className="flex-1 flex flex-col bg-secondary/20 min-h-0">
          {/* Iframe toolbar */}
          <div className="shrink-0 flex items-center gap-2 px-2 py-1 bg-card border-b border-border">
            <input
              type="text"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLoadUrl()}
              placeholder="Cole a URL do cassino aqui..."
              className="flex-1 bg-secondary border border-border rounded px-2 py-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              onClick={handleLoadUrl}
              className="px-2 py-1 bg-primary text-primary-foreground rounded text-[9px] font-bold hover:bg-primary/90 flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" />
              ABRIR
            </button>
            <button
              onClick={() => setIframeExpanded(!iframeExpanded)}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
              title={iframeExpanded ? 'Reduzir' : 'Expandir'}
            >
              {iframeExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Iframe */}
          <div className="flex-1 relative min-h-0">
            {iframeUrl ? (
              <iframe
                src={iframeUrl}
                className="absolute inset-0 w-full h-full border-0"
                allowFullScreen
                allow="autoplay; fullscreen; microphone; camera"
                sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-top-navigation"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4">
                <MonitorPlay className="w-16 h-16 text-muted-foreground/20" />
                <div className="text-center space-y-2">
                  <p className="text-sm text-muted-foreground font-semibold">Cassino ao Vivo</p>
                  <p className="text-[10px] text-muted-foreground/60 max-w-xs">
                    Cole a URL do cassino na barra acima para jogar aqui dentro enquanto acompanha as estatísticas ao lado
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center mt-4">
                  {['🎰 Roleta Brasileira', '⚡ Immersiva', '🔥 XXXtreme'].map(name => (
                    <div key={name} className="px-3 py-1.5 bg-card border border-border rounded-lg text-[10px] text-muted-foreground">
                      {name}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer Navigation */}
      <footer className="shrink-0 bg-secondary/90 backdrop-blur border-t border-border z-50">
        <div className="flex justify-around">
          {[
            { id: 'aulas' as const, icon: '📚', label: 'Aulas' },
            { id: 'roleta' as const, icon: '🎰', label: 'Roleta' },
            { id: 'bacbo' as const, icon: '🎲', label: 'BacBo' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center py-1 text-[9px] transition-colors ${
                activeTab === tab.id ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <span className="text-sm">{tab.icon}</span>
              <span className="font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </footer>

      <DebugModal />
    </div>
  );
};

export default Index;
