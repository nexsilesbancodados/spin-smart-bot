import { memo, useRef, useState } from "react";
import { Card, PageContainer, PageHeader, SectionHeader, Button, Pill } from "../components/ui";
import { useNotifications, requestBrowserNotificationPermission, playSignalChord, playHitSound } from "../lib/notifications";
import { useFeedStatus } from "../lib/feedStatus";
import { useSignalAgent } from "../lib/signalAgent";
import { useEntryFilter } from "../lib/entryFilter";
import { useWebhook } from "../lib/webhook";
import { useTheme, ACCENTS } from "../lib/theme";
import { exportBackupJson, importBackupJson } from "../lib/backup";
import { useDigest } from "../lib/digest";
import ProfileSwitcher from "../components/ProfileSwitcher";

const Config = memo(() => {
  const theme = useTheme((s) => s.theme);
  const accent = useTheme((s) => s.accent);
  const toggleTheme = useTheme((s) => s.toggle);
  const setAccent = useTheme((s) => s.setAccent);

  return (
    <PageContainer>
      <PageHeader title="Configuração" subtitle="Todos os ajustes em um só lugar." />

      <TabSection
        title="Aparência"
        actions={
          <Button onClick={toggleTheme}>
            {theme === "dark" ? "☀ Tema claro" : "🌙 Tema escuro"}
          </Button>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-neutral-400">
            Tema atual: <strong>{theme === "dark" ? "Escuro" : "Claro"}</strong>.
          </p>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-neutral-500 block mb-2">
              Cor de destaque
            </label>
            <div className="flex gap-2 flex-wrap">
              {ACCENTS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setAccent(a.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${
                    accent === a.id ? "border-neutral-300 bg-neutral-800" : "border-neutral-700 hover:bg-neutral-800/50"
                  }`}
                >
                  <span className={`w-4 h-4 rounded-full ${a.cls}`} />
                  <span className="text-xs">{a.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </TabSection>

      <NotificationsSection />
      <PollingSection />
      <AgentSection />
      <FilterSection />
      <WebhookSection />
      <ProfilesSection />
      <DigestSection />
      <BackupSection />
      <ShortcutsSection />
    </PageContainer>
  );
});
Config.displayName = "Config";

const TabSection = memo(
  ({ title, actions, children }: { title: string; actions?: React.ReactNode; children: React.ReactNode }) => (
    <Card>
      <SectionHeader title={title} actions={actions} />
      {children}
    </Card>
  )
);
TabSection.displayName = "ConfigTabSection";

const NotificationsSection = memo(() => {
  const soundEnabled = useNotifications((s) => s.soundEnabled);
  const browserEnabled = useNotifications((s) => s.browserNotificationEnabled);
  const threshold = useNotifications((s) => s.signalThresholdConfidence);
  const setSound = useNotifications((s) => s.setSoundEnabled);
  const setBrowser = useNotifications((s) => s.setBrowserNotificationEnabled);
  const setThreshold = useNotifications((s) => s.setSignalThresholdConfidence);
  const [permissionStatus, setPermissionStatus] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "denied"
  );

  return (
    <TabSection title="Notificações">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={soundEnabled}
              onChange={(e) => setSound(e.target.checked)}
              className="accent-amber-500"
            />
            Som ao sinalizar / hit / miss
          </label>
          <div className="flex gap-1.5">
            <Button size="sm" variant="ghost" onClick={playSignalChord}>
              ▶ Sinal
            </Button>
            <Button size="sm" variant="ghost" onClick={playHitSound}>
              ▶ Hit
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={browserEnabled && permissionStatus === "granted"}
              onChange={async (e) => {
                if (e.target.checked && permissionStatus !== "granted") {
                  const ok = await requestBrowserNotificationPermission();
                  setPermissionStatus(ok ? "granted" : "denied");
                  if (ok) setBrowser(true);
                } else {
                  setBrowser(e.target.checked);
                }
              }}
              className="accent-amber-500"
            />
            Notificação do navegador
          </label>
          <Pill accent={permissionStatus === "granted" ? "good" : permissionStatus === "denied" ? "bad" : "warn"}>
            {permissionStatus}
          </Pill>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-wider text-neutral-500 block">
            Limiar de notificação
          </label>
          <input
            type="range"
            min={0.1}
            max={0.95}
            step={0.05}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="w-full accent-amber-500"
          />
          <p className="text-xs text-neutral-400">
            Notificar quando confiança ≥ <span className="font-mono text-amber-300">{(threshold * 100).toFixed(0)}%</span>
          </p>
        </div>
      </div>
      <VoiceSubSection />
    </TabSection>
  );
});
NotificationsSection.displayName = "ConfigNotifications";

const VoiceSubSection = memo(() => {
  const voiceEnabled = useNotifications((s) => s.voiceEnabled);
  const voiceVolume = useNotifications((s) => s.voiceVolume);
  const setVoiceEnabled = useNotifications((s) => s.setVoiceEnabled);
  const setVoiceVolume = useNotifications((s) => s.setVoiceVolume);
  const test = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance("Sinal: vinte e três. Setor Voisins. Probabilidade cinco por cento.");
    u.lang = "pt-BR";
    u.volume = voiceVolume;
    window.speechSynthesis.speak(u);
  };
  return (
    <div className="mt-4 pt-4 border-t border-neutral-800/60 grid grid-cols-1 sm:grid-cols-3 gap-4">
      <label className="flex items-center gap-2 cursor-pointer text-sm">
        <input
          type="checkbox"
          checked={voiceEnabled}
          onChange={(e) => setVoiceEnabled(e.target.checked)}
          className="accent-amber-500"
        />
        🔊 Voz pt-BR (Web Speech)
      </label>
      <div>
        <label className="text-[10px] uppercase tracking-wider text-neutral-500 block mb-1">Volume</label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={voiceVolume}
          onChange={(e) => setVoiceVolume(Number(e.target.value))}
          className="w-full accent-amber-500"
          disabled={!voiceEnabled}
        />
        <p className="text-[10px] text-neutral-500 mt-1">{(voiceVolume * 100).toFixed(0)}%</p>
      </div>
      <div>
        <Button size="sm" onClick={test} disabled={!voiceEnabled}>
          ▶ Testar voz
        </Button>
      </div>
    </div>
  );
});
VoiceSubSection.displayName = "ConfigVoice";

const PollingSection = memo(() => {
  const interval = useFeedStatus((s) => s.pollInterval);
  const setInterval = useFeedStatus((s) => s.setPollInterval);
  const enabled = useFeedStatus((s) => s.pollEnabled);
  const setEnabled = useFeedStatus((s) => s.setPollEnabled);
  return (
    <TabSection title="Feed e Polling">
      <div className="flex items-center gap-3 flex-wrap text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="accent-amber-500"
          />
          Polling ativo
        </label>
        <label className="flex items-center gap-2">
          Intervalo
          <select
            value={interval}
            onChange={(e) => setInterval(Number(e.target.value))}
            className="bg-neutral-950 border border-neutral-700 rounded-md px-2 py-1 text-xs"
          >
            <option value={2000}>2s</option>
            <option value={3000}>3s</option>
            <option value={5000}>5s</option>
            <option value={10000}>10s</option>
            <option value={30000}>30s</option>
            <option value={60000}>60s</option>
          </select>
        </label>
      </div>
    </TabSection>
  );
});
PollingSection.displayName = "ConfigPolling";

const AgentSection = memo(() => {
  const config = useSignalAgent((s) => s.config);
  const setConfig = useSignalAgent((s) => s.setConfig);
  const toggleHour = (h: number) => {
    const set = new Set(config.hoursAllowed);
    if (set.has(h)) set.delete(h);
    else set.add(h);
    setConfig({ hoursAllowed: Array.from(set).sort((a, b) => a - b) });
  };
  return (
    <TabSection title="Agente">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-neutral-500">Limiar de probabilidade</span>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0.028}
              max={0.15}
              step={0.005}
              value={config.threshold}
              onChange={(e) => setConfig({ threshold: Number(e.target.value) })}
              className="flex-1 accent-amber-500"
            />
            <span className="text-xs font-mono w-12 text-right">{(config.threshold * 100).toFixed(1)}%</span>
          </div>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-neutral-500">Janela de treino</span>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={30}
              max={1000}
              step={20}
              value={config.trainingWindow}
              onChange={(e) => setConfig({ trainingWindow: Number(e.target.value) })}
              className="flex-1 accent-amber-500"
            />
            <span className="text-xs font-mono w-16 text-right">{config.trainingWindow} giros</span>
          </div>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={config.lstmEnabled}
            onChange={(e) => setConfig({ lstmEnabled: e.target.checked })}
            className="accent-amber-500"
          />
          LSTM ativo
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={config.trainOnEverySpin}
            onChange={(e) => setConfig({ trainOnEverySpin: e.target.checked })}
            className="accent-amber-500"
          />
          Treinar a cada giro
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={config.useWorker}
            onChange={(e) => setConfig({ useWorker: e.target.checked })}
            className="accent-amber-500"
          />
          🧵 Web Worker (não bloqueia UI)
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={config.dynamicThreshold}
            onChange={(e) => setConfig({ dynamicThreshold: e.target.checked })}
            className="accent-amber-500"
          />
          📈 Limiar dinâmico (auto-ajusta)
        </label>
      </div>

      <div className="mt-4 pt-4 border-t border-neutral-800/60">
        <label className="flex items-center gap-2 mb-2">
          <input
            type="checkbox"
            checked={config.hourFilterEnabled}
            onChange={(e) => setConfig({ hourFilterEnabled: e.target.checked })}
            className="accent-amber-500"
          />
          <span className="text-sm">🕐 Filtrar por hora do dia</span>
        </label>
        {config.hourFilterEnabled && (
          <>
            <p className="text-[11px] text-neutral-400 mb-2">
              Agente só emite sinais nas horas selecionadas. Útil pra evitar madrugada ou horários de mesa vazia.
            </p>
            <div className="grid grid-cols-6 sm:grid-cols-12 gap-1">
              {Array.from({ length: 24 }, (_, h) => (
                <button
                  key={h}
                  onClick={() => toggleHour(h)}
                  className={`text-[11px] font-mono py-1.5 rounded ${
                    config.hoursAllowed.includes(h)
                      ? "bg-amber-500 text-black font-bold"
                      : "bg-neutral-800 text-neutral-500"
                  }`}
                >
                  {h.toString().padStart(2, "0")}h
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => setConfig({ hoursAllowed: Array.from({ length: 24 }, (_, h) => h) })}
                className="text-[10px] text-amber-300 hover:underline"
              >
                Todas
              </button>
              <button
                onClick={() => setConfig({ hoursAllowed: [] })}
                className="text-[10px] text-neutral-400 hover:underline"
              >
                Nenhuma
              </button>
              <button
                onClick={() => setConfig({ hoursAllowed: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22] })}
                className="text-[10px] text-amber-300 hover:underline"
              >
                Só horário comercial
              </button>
            </div>
          </>
        )}
      </div>
    </TabSection>
  );
});
AgentSection.displayName = "ConfigAgent";

const FilterSection = memo(() => {
  const enabled = useEntryFilter((s) => s.enabled);
  const setEnabled = useEntryFilter((s) => s.setEnabled);
  const combinator = useEntryFilter((s) => s.combinator);
  const setCombinator = useEntryFilter((s) => s.setCombinator);
  const activeConditions = useEntryFilter((s) => s.conditions.filter((c) => c.enabled).length);

  return (
    <TabSection title="Filtro Probabilístico">
      <div className="flex items-center gap-3 flex-wrap text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="accent-amber-500"
          />
          Filtro ativo
        </label>
        <label className="flex items-center gap-2">
          Combinator
          <select
            value={combinator}
            onChange={(e) => setCombinator(e.target.value as "AND" | "OR")}
            className="bg-neutral-950 border border-neutral-700 rounded-md px-2 py-1 text-xs"
          >
            <option value="AND">AND (todas)</option>
            <option value="OR">OR (qualquer)</option>
          </select>
        </label>
        <span className="text-xs text-neutral-400">{activeConditions} condições ativas</span>
        <a href="/filtros" className="text-xs text-amber-300 hover:underline">
          Editar condições →
        </a>
      </div>
    </TabSection>
  );
});
FilterSection.displayName = "ConfigFilter";

const WebhookSection = memo(() => {
  const config = useWebhook((s) => s.config);
  const setConfig = useWebhook((s) => s.setConfig);

  return (
    <TabSection title="Webhook">
      <div className="space-y-3 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => setConfig({ enabled: e.target.checked })}
            className="accent-amber-500"
          />
          Ativar webhook para sinais
        </label>
        <input
          value={config.url}
          onChange={(e) => setConfig({ url: e.target.value })}
          placeholder="https://… (Discord, Slack, n8n, Zapier, etc.)"
          className="w-full bg-neutral-950 border border-neutral-700 rounded-md px-2 py-1.5 text-sm font-mono"
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-neutral-400">Formato</span>
            <select
              value={config.format}
              onChange={(e) => setConfig({ format: e.target.value as "json" | "discord" | "slack" })}
              className="bg-neutral-950 border border-neutral-700 rounded-md px-2 py-1.5"
            >
              <option value="json">JSON cru</option>
              <option value="discord">Discord embed</option>
              <option value="slack">Slack message</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-neutral-400">Confiança mínima</span>
            <input
              type="number"
              value={config.minConfidence}
              min={0}
              max={1}
              step={0.05}
              onChange={(e) => setConfig({ minConfidence: Number(e.target.value) })}
              className="bg-neutral-950 border border-neutral-700 rounded-md px-2 py-1.5 font-mono"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-neutral-400">Bearer token (opcional)</span>
            <input
              value={config.bearerToken ?? ""}
              onChange={(e) => setConfig({ bearerToken: e.target.value })}
              className="bg-neutral-950 border border-neutral-700 rounded-md px-2 py-1.5 font-mono"
            />
          </label>
        </div>
        <div className="flex items-center gap-3 text-xs text-neutral-400 flex-wrap">
          <span>Enviados: <strong className="text-emerald-300">{config.totalSent}</strong></span>
          <span>Erros: <strong className={config.totalErrors > 0 ? "text-red-300" : "text-neutral-300"}>{config.totalErrors}</strong></span>
          {config.lastError && <span className="text-red-300 font-mono">⚠ {config.lastError}</span>}
        </div>
      </div>
    </TabSection>
  );
});
WebhookSection.displayName = "ConfigWebhook";

const BackupSection = memo(() => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm("Importar backup vai SOBRESCREVER os dados atuais. Continuar?")) return;
    const r = await importBackupJson(file);
    setStatus(r.message);
    if (r.ok) {
      setTimeout(() => location.reload(), 1500);
    }
  };

  return (
    <TabSection
      title="Backup"
      actions={
        <>
          <Button onClick={exportBackupJson}>Exportar JSON</Button>
          <Button variant="ghost" onClick={() => inputRef.current?.click()}>
            Importar JSON
          </Button>
          <input ref={inputRef} type="file" accept=".json" className="hidden" onChange={onImport} />
        </>
      }
    >
      <p className="text-xs text-neutral-400">
        Exporta histórico, sessões, configs do agente, filtro, notificações, webhook, mesas, regras, ROI. Para mover
        para outro dispositivo ou backup local.
      </p>
      {status && <p className="text-xs text-amber-300 mt-2">{status}</p>}
    </TabSection>
  );
});
BackupSection.displayName = "ConfigBackup";

const ShortcutsSection = memo(() => (
  <TabSection title="Atalhos de teclado">
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
      <Shortcut keys="Ctrl+K" desc="Command palette" />
      <Shortcut keys="Ctrl+F" desc="Busca global" />
      <Shortcut keys="Ctrl+1..9" desc="Navegar rotas" />
      <Shortcut keys="R" desc="Refresh forçado do feed" />
      <Shortcut keys="Espaço" desc="Pausar/ativar agente" />
      <Shortcut keys="P" desc="Pausar/ativar polling" />
      <Shortcut keys="?" desc="Esta ajuda" />
    </div>
  </TabSection>
));
ShortcutsSection.displayName = "ConfigShortcuts";

const ProfilesSection = memo(() => (
  <TabSection title="Perfis / Presets">
    <ProfileSwitcher />
  </TabSection>
));
ProfilesSection.displayName = "ConfigProfiles";

const DigestSection = memo(() => {
  const enabled = useDigest((s) => s.enabled);
  const intervalMinutes = useDigest((s) => s.intervalMinutes);
  const setEnabled = useDigest((s) => s.setEnabled);
  const setInterval = useDigest((s) => s.setInterval);
  return (
    <TabSection title="Digest periódico">
      <div className="flex items-center gap-3 flex-wrap text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="accent-amber-500"
          />
          Mostrar resumo periódico
        </label>
        <label className="flex items-center gap-2">
          A cada
          <select
            value={intervalMinutes}
            onChange={(e) => setInterval(Number(e.target.value))}
            className="bg-neutral-950 border border-neutral-700 rounded-md px-2 py-1 text-xs"
            disabled={!enabled}
          >
            <option value={5}>5min</option>
            <option value={15}>15min</option>
            <option value={30}>30min</option>
            <option value={60}>1h</option>
          </select>
        </label>
      </div>
      <p className="text-[11px] text-neutral-500 mt-2">
        Popup discreto no canto com sinais emitidos + hit rate na janela. Aparece apenas se houve atividade.
      </p>
    </TabSection>
  );
});
DigestSection.displayName = "ConfigDigest";

const Shortcut = memo(({ keys, desc }: { keys: string; desc: string }) => (
  <div className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-950/50 p-2">
    <kbd className="px-2 py-0.5 rounded bg-neutral-800 border border-neutral-700 font-mono text-[10px]">{keys}</kbd>
    <span className="text-neutral-400">{desc}</span>
  </div>
));
Shortcut.displayName = "ConfigShortcut";

export default Config;
