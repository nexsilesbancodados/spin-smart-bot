import { useState } from 'react';
import { useRoulette } from '@/contexts/RouletteContext';
import { getNumberColor, getHotNumbers, getColdNumbers } from '@/lib/roulette';
import { getTerminal, getDozen, getColumnLabel, getSector, getSide } from '@/lib/roulette-analysis';
import AnimatedHistory from '@/components/AnimatedHistory';
import AlertBanner from '@/components/AlertBanner';
import PremiumTable from '@/components/PremiumTable';
import QuickNumberPad from '@/components/QuickNumberPad';
import AIAnalysis from '@/components/AIAnalysis';
import DebugModal from '@/components/DebugModal';
import {
  CircleDot, ChevronDown, MonitorPlay, Flame, Snowflake,
  Play, Square, ExternalLink, Maximize2, Minimize2,
  Download, Copy, Check, Layers, Hash, Activity, Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const PROVIDERS: Record<string, { label: string; tables: string[] }> = {
  Playtech: {
    label: 'Playtech',
    tables: ['Roleta Brasileira', 'Mega Fire Blaze Roulette Live', 'Roulette'],
  },
  Evolution: {
    label: 'Evolution',
    tables: ['Roleta Immersiva', 'Roulette Evo', 'Roleta Relâmpago XXXtreme', 'Roleta ao Vivo'],
  },
  Pragmatic: {
    label: 'Pragmatic',
    tables: ['PowerUP Roulette', 'Roulette Macao', 'Brasileira Roleta'],
  },
};

const Index = () => {
  const { history, provider, table, setProvider, setTable, addNumber, autoMode, autoSpeed, toggleAutoMode, setAutoSpeed } = useRoulette();
  const DEFAULT_IFRAME_URL = 'https://ona.bet.br/live-casino/game/3782786?provider=Playtech&from=%2Flive-casino';
  const [iframeUrl, setIframeUrl] = useState(DEFAULT_IFRAME_URL);
  const [urlInput, setUrlInput] = useState(DEFAULT_IFRAME_URL);
  const [iframeExpanded, setIframeExpanded] = useState(false);
  const [showPremium, setShowPremium] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook-roulette`;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const hotNumbers = getHotNumbers(history, 8);
  const coldNumbers = getColdNumbers(history, 8);
  const redCount = history.filter(h => h.color === 'red').length;
  const blackCount = history.filter(h => h.color === 'black').length;
  const greenCount = history.filter(h => h.color === 'green').length;
  const total = history.length || 1;

  const handleLoadUrl = () => {
    if (urlInput.trim()) setIframeUrl(urlInput.trim());
  };

  const downloadExtension = () => {
    fetch('/roulette-tracker-extension.zip')
      .then(res => { if (!res.ok) throw new Error(`${res.status}`); return res.blob(); })
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

  const consoleScript = `// Script de Ponte - Cole no Console do navegador na página da Onabet
(function() {
  const originalLog = console.log;
  console.log = function(...args) {
    if (!isNaN(args[0]) && args[0] !== "") {
      const n = parseInt(args[0]);
      if (n >= 0 && n <= 36) {
        fetch('${supabaseUrl}/rest/v1/resultados_roleta', {
          method: 'POST',
          headers: {
            'apikey': '${anonKey}',
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({ numero: n.toString(), mesa: "Roleta Brasileira" })
        });
        originalLog("%c[Tracker] Número enviado: " + n, "color: #00E5FF; font-weight: bold;");
      }
    }
    originalLog.apply(console, args);
  };
  console.log("%c[Tracker] Ponte ativa!", "color: #FF00E5; font-weight: bold; font-size: 14px;");
})();`;

  const copyScript = () => {
    navigator.clipboard.writeText(consoleScript);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  // Terminal grouping for "Números Puxados" panel
  const terminalGroups = history.slice(0, 30).reduce<Record<number, number[]>>((acc, h) => {
    const t = h.value % 10;
    if (!acc[t]) acc[t] = [];
    acc[t].push(h.value);
    return acc;
  }, {});

  return (
    <div className="h-screen bg-gradient-casino flex flex-col overflow-hidden">
      {/* Top Navbar */}
      <nav className="bg-card/90 backdrop-blur-md border-b border-border px-4 py-2 z-50 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CircleDot className="w-5 h-5 text-primary animate-spin-slow" />
            <span className="font-display text-xs tracking-widest text-glow-cyan">ROULETTE ANALYTICS</span>
            <span className="text-[9px] px-2 py-0.5 bg-accent/20 rounded-full text-accent font-bold border border-accent/30">PRO</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleAutoMode}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-bold transition-all ${
                autoMode ? 'bg-destructive text-destructive-foreground shadow-lg' : 'bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30'
              }`}
            >
              {autoMode ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              {autoMode ? 'PARAR' : 'AUTO'}
            </button>
            {autoMode && (
              <div className="flex gap-1">
                {[3, 5, 8].map(s => (
                  <button
                    key={s}
                    onClick={() => setAutoSpeed(s)}
                    className={`px-2 py-1 rounded text-[9px] font-semibold transition-all ${
                      autoSpeed === s ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
                    }`}
                  >
                    {s}s
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={downloadExtension}
              className="flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-bold bg-accent/20 text-accent hover:bg-accent/30 transition-all border border-accent/30"
              title="Baixar extensão Chrome"
            >
              <Download className="w-3 h-3" />
              EXTENSÃO
            </button>
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-neon-cyan" />
          </div>
        </div>
      </nav>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT SIDEBAR */}
        {showSidebar && (
          <motion.aside
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            className={`flex flex-col ${iframeExpanded ? 'w-[280px]' : 'w-[360px]'} border-r border-border bg-card/50 backdrop-blur-sm shrink-0 transition-all`}
          >
            {/* Provider/Table Selectors */}
            <div className="shrink-0 border-b border-border">
              <div className="flex">
                <div className="flex-1 relative border-r border-border">
                  <select
                    value={provider}
                    onChange={e => {
                      setProvider(e.target.value);
                      setTable(PROVIDERS[e.target.value].tables[0]);
                    }}
                    className="w-full bg-transparent text-foreground text-[11px] font-semibold px-3 py-2 appearance-none cursor-pointer focus:outline-none"
                  >
                    {Object.entries(PROVIDERS).map(([key, p]) => (
                      <option key={key} value={key} className="bg-card">{p.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-3 h-3 text-muted-foreground absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <div className="flex-1 relative">
                  <select
                    value={table}
                    onChange={e => setTable(e.target.value)}
                    className="w-full bg-transparent text-foreground text-[11px] font-semibold px-3 py-2 appearance-none cursor-pointer focus:outline-none"
                  >
                    {PROVIDERS[provider]?.tables.map(t => (
                      <option key={t} value={t} className="bg-card">{t}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-3 h-3 text-muted-foreground absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Status bar */}
              <div className="flex items-center justify-between px-3 py-1.5 bg-primary/5 border-t border-primary/10">
                <div className="flex items-center gap-2">
                  <Zap className="w-3 h-3 text-primary" />
                  <span className="text-[9px] font-bold text-primary tracking-wider font-display">
                    {PROVIDERS[provider]?.label} • {table}
                  </span>
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <span className="text-[9px] text-muted-foreground">Premium</span>
                  <div
                    onClick={() => setShowPremium(!showPremium)}
                    className={`w-8 h-4 rounded-full transition-colors relative cursor-pointer ${showPremium ? 'bg-primary' : 'bg-muted'}`}
                  >
                    <div className={`w-3 h-3 rounded-full bg-foreground absolute top-0.5 transition-transform ${showPremium ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                </label>
              </div>
            </div>

            {/* Scrollable sidebar content */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {/* Alerts */}
              <AlertBanner />

              {/* History Grid */}
              <AnimatedHistory />

              {/* Color Distribution */}
              {history.length > 0 && (
                <div className="bg-card rounded-lg border border-border p-3">
                  <div className="flex gap-1 h-3 rounded-full overflow-hidden mb-2">
                    <motion.div animate={{ width: `${(redCount / total) * 100}%` }} className="bg-roulette-red" transition={{ duration: 0.5 }} />
                    <motion.div animate={{ width: `${(blackCount / total) * 100}%` }} className="bg-roulette-black" transition={{ duration: 0.5 }} />
                    <motion.div animate={{ width: `${(greenCount / total) * 100}%` }} className="bg-roulette-green" transition={{ duration: 0.5 }} />
                  </div>
                  <div className="flex justify-between text-[9px] font-mono text-muted-foreground">
                    <span className="text-roulette-red">🔴 {redCount} ({((redCount / total) * 100).toFixed(0)}%)</span>
                    <span>⚫ {blackCount} ({((blackCount / total) * 100).toFixed(0)}%)</span>
                    <span className="text-roulette-green">🟢 {greenCount}</span>
                  </div>
                </div>
              )}

              {/* Hot & Cold Numbers */}
              {history.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-card rounded-lg border border-border p-2.5">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Flame className="w-3.5 h-3.5 text-destructive" />
                      <span className="font-display text-[9px] text-destructive tracking-widest">QUENTES</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {hotNumbers.map(h => {
                        const color = getNumberColor(h.number);
                        const cls = color === 'red' ? 'bg-roulette-red' : color === 'black' ? 'bg-roulette-black' : 'bg-roulette-green';
                        return (
                          <div key={h.number} className={`${cls} w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold text-foreground relative`}>
                            {h.number}
                            <span className="absolute -top-1 -right-1 bg-destructive text-foreground text-[7px] rounded-full w-3 h-3 flex items-center justify-center font-bold">
                              {h.freq}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="bg-card rounded-lg border border-border p-2.5">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Snowflake className="w-3.5 h-3.5 text-primary" />
                      <span className="font-display text-[9px] text-primary tracking-widest">FRIOS</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {coldNumbers.map(h => {
                        const color = getNumberColor(h.number);
                        const cls = color === 'red' ? 'bg-roulette-red' : color === 'black' ? 'bg-roulette-black' : 'bg-roulette-green';
                        return (
                          <div key={h.number} className={`${cls} w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold text-foreground opacity-50`}>
                            {h.number}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Números Puxados — Terminal grouping */}
              {history.length > 0 && (
                <div className="bg-card rounded-lg border border-border p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Hash className="w-3.5 h-3.5 text-accent" />
                    <span className="font-display text-[9px] text-accent tracking-widest">NÚMEROS PUXADOS</span>
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {Object.entries(terminalGroups).sort(([a], [b]) => Number(a) - Number(b)).map(([terminal, nums]) => (
                      <div key={terminal} className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-accent w-8 shrink-0 font-display">T{terminal}</span>
                        <div className="flex flex-wrap gap-0.5">
                          {nums.slice(0, 8).map((n, i) => {
                            const color = getNumberColor(n);
                            const cls = color === 'red' ? 'bg-roulette-red' : color === 'black' ? 'bg-roulette-black' : 'bg-roulette-green';
                            return (
                              <span key={`${n}-${i}`} className={`${cls} w-6 h-6 rounded text-[9px] font-bold text-foreground flex items-center justify-center`}>
                                {n}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Number Pad */}
              <QuickNumberPad onAddNumber={addNumber} />

              {/* AI Analysis */}
              <AIAnalysis />

              {/* Premium Table */}
              {showPremium && <PremiumTable history={history} />}

              {/* Webhook & Script Section */}
              <div className="bg-card rounded-lg border border-border p-3 space-y-3">
                <div className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-primary" />
                  <span className="font-display text-[9px] text-primary tracking-widest">INTEGRAÇÃO</span>
                </div>

                {/* Webhook URL */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] font-semibold text-muted-foreground">WEBHOOK URL</span>
                    <button onClick={copyWebhook} className="flex items-center gap-1 text-[9px] text-primary hover:text-primary/80 transition-colors">
                      {copiedWebhook ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copiedWebhook ? 'Copiado!' : 'Copiar'}
                    </button>
                  </div>
                  <div className="text-[8px] text-muted-foreground bg-secondary rounded-md px-2 py-1.5 font-mono truncate select-all border border-border">
                    {webhookUrl}
                  </div>
                </div>

                {/* Console Script */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] font-semibold text-muted-foreground">SCRIPT CONSOLE</span>
                    <button onClick={copyScript} className="flex items-center gap-1 text-[9px] text-accent hover:text-accent/80 transition-colors">
                      {copiedScript ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copiedScript ? 'Copiado!' : 'Copiar'}
                    </button>
                  </div>
                  <p className="text-[8px] text-muted-foreground mb-1">
                    Cole no console do navegador na página da Onabet para captura automática
                  </p>
                </div>
              </div>
            </div>
          </motion.aside>
        )}

        {/* CENTER - Casino Iframe */}
        <div className="flex-1 flex flex-col bg-secondary/10 min-h-0">
          {/* Iframe toolbar */}
          <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 bg-card/80 border-b border-border backdrop-blur-sm">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-secondary"
              title={showSidebar ? 'Esconder sidebar' : 'Mostrar sidebar'}
            >
              <Layers className="w-4 h-4" />
            </button>
            <input
              type="text"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLoadUrl()}
              placeholder="Cole a URL do cassino aqui..."
              className="flex-1 bg-secondary border border-border rounded-md px-3 py-1.5 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              onClick={handleLoadUrl}
              className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-[10px] font-bold hover:bg-primary/90 flex items-center gap-1.5 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              ABRIR
            </button>
            <button
              onClick={() => setIframeExpanded(!iframeExpanded)}
              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-secondary"
            >
              {iframeExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>

          {/* Iframe content */}
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
              <div className="absolute inset-0 flex flex-col items-center justify-center space-y-6">
                <div className="relative">
                  <MonitorPlay className="w-20 h-20 text-primary/20" />
                  <div className="absolute inset-0 animate-pulse-neon">
                    <MonitorPlay className="w-20 h-20 text-primary/10" />
                  </div>
                </div>
                <div className="text-center space-y-2">
                  <p className="text-sm text-foreground/80 font-semibold font-display tracking-wider">Cassino ao Vivo</p>
                  <p className="text-[11px] text-muted-foreground max-w-sm">
                    Cole a URL do cassino na barra acima para jogar aqui dentro enquanto acompanha as estatísticas ao lado
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {['🎰 Roleta Brasileira', '⚡ Immersiva', '🔥 XXXtreme'].map(name => (
                    <div key={name} className="px-4 py-2 bg-card border border-border rounded-lg text-[11px] text-muted-foreground hover:border-primary/30 transition-colors cursor-default">
                      {name}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <DebugModal />
    </div>
  );
};

export default Index;
