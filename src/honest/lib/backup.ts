import { useHonestStore } from "./store";
import { useSignalAgent } from "./signalAgent";
import { useEntryFilter } from "./entryFilter";
import { useNotifications } from "./notifications";
import { useWebhook } from "./webhook";
import { useFeedStatus } from "./feedStatus";

export interface FullBackup {
  version: 1;
  exportedAt: number;
  spins: ReturnType<typeof useHonestStore.getState>["spins"];
  session: ReturnType<typeof useHonestStore.getState>["session"];
  history: ReturnType<typeof useHonestStore.getState>["history"];
  windowSize: ReturnType<typeof useHonestStore.getState>["windowSize"];
  signalAgentConfig: ReturnType<typeof useSignalAgent.getState>["config"];
  signalHistory: ReturnType<typeof useSignalAgent.getState>["history"];
  entryFilter: ReturnType<typeof useEntryFilter.getState>;
  notifications: ReturnType<typeof useNotifications.getState>;
  webhook: ReturnType<typeof useWebhook.getState>["config"];
  pollInterval: number;
  customPatterns: unknown;
  multiMesa: unknown;
  jogarUrl: string | null;
  captureRoi: unknown;
}

export const buildBackup = (): FullBackup => {
  const honest = useHonestStore.getState();
  const agent = useSignalAgent.getState();
  const filter = useEntryFilter.getState();
  const notif = useNotifications.getState();
  const webhook = useWebhook.getState();
  const feed = useFeedStatus.getState();
  return {
    version: 1,
    exportedAt: Date.now(),
    spins: honest.spins,
    session: honest.session,
    history: honest.history,
    windowSize: honest.windowSize,
    signalAgentConfig: agent.config,
    signalHistory: agent.history,
    entryFilter: filter,
    notifications: notif,
    webhook: webhook.config,
    pollInterval: feed.pollInterval,
    customPatterns: JSON.parse(localStorage.getItem("rv-custom-patterns-v1") ?? "null"),
    multiMesa: JSON.parse(localStorage.getItem("rv-multi-mesa-v1") ?? "null"),
    jogarUrl: localStorage.getItem("rv-jogar-url"),
    captureRoi: JSON.parse(localStorage.getItem("rv-capture-roi") ?? "null"),
  };
};

export const exportBackupJson = () => {
  const backup = buildBackup();
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `roleta-vision-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const importBackupJson = async (file: File): Promise<{ ok: boolean; message: string }> => {
  try {
    const text = await file.text();
    const backup = JSON.parse(text) as Partial<FullBackup>;
    if (backup.version !== 1) {
      return { ok: false, message: "Versão de backup incompatível" };
    }
    if (backup.spins) useHonestStore.setState({ spins: backup.spins });
    if (backup.session) useHonestStore.setState({ session: backup.session });
    if (backup.history) useHonestStore.setState({ history: backup.history });
    if (backup.windowSize) useHonestStore.setState({ windowSize: backup.windowSize });
    if (backup.signalAgentConfig)
      useSignalAgent.setState((s) => ({ config: { ...s.config, ...backup.signalAgentConfig } }));
    if (backup.signalHistory) useSignalAgent.setState({ history: backup.signalHistory });
    if (backup.entryFilter)
      useEntryFilter.setState((s) => ({
        enabled: backup.entryFilter!.enabled,
        combinator: backup.entryFilter!.combinator,
        conditions: backup.entryFilter!.conditions ?? s.conditions,
      }));
    if (backup.notifications)
      useNotifications.setState({
        soundEnabled: backup.notifications.soundEnabled,
        browserNotificationEnabled: backup.notifications.browserNotificationEnabled,
        signalThresholdConfidence: backup.notifications.signalThresholdConfidence,
      });
    if (backup.webhook) useWebhook.setState((s) => ({ config: { ...s.config, ...backup.webhook } }));
    if (backup.pollInterval) useFeedStatus.getState().setPollInterval(backup.pollInterval);
    if (backup.customPatterns)
      localStorage.setItem("rv-custom-patterns-v1", JSON.stringify(backup.customPatterns));
    if (backup.multiMesa) localStorage.setItem("rv-multi-mesa-v1", JSON.stringify(backup.multiMesa));
    if (backup.jogarUrl) localStorage.setItem("rv-jogar-url", backup.jogarUrl);
    if (backup.captureRoi) localStorage.setItem("rv-capture-roi", JSON.stringify(backup.captureRoi));
    return { ok: true, message: `Backup de ${new Date(backup.exportedAt ?? Date.now()).toLocaleString("pt-BR")} restaurado` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
};
