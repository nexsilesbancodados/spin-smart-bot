import { memo, useState } from "react";
import { useNotifications, requestBrowserNotificationPermission, playSignalChord, playHitSound } from "../lib/notifications";

const NotificationSettings = memo(() => {
  const soundEnabled = useNotifications((s) => s.soundEnabled);
  const browserEnabled = useNotifications((s) => s.browserNotificationEnabled);
  const threshold = useNotifications((s) => s.signalThresholdConfidence);
  const setSound = useNotifications((s) => s.setSoundEnabled);
  const setBrowser = useNotifications((s) => s.setBrowserNotificationEnabled);
  const setThreshold = useNotifications((s) => s.setSignalThresholdConfidence);
  const [permissionStatus, setPermissionStatus] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "denied"
  );

  const requestPermission = async () => {
    const ok = await requestBrowserNotificationPermission();
    setPermissionStatus(ok ? "granted" : "denied");
    if (ok) setBrowser(true);
  };

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
      <h3 className="text-sm font-bold mb-3">Alertas</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={soundEnabled}
              onChange={(e) => setSound(e.target.checked)}
              className="accent-amber-500"
            />
            <span className="text-xs">Som ao sinalizar / hit / miss</span>
          </label>
          <div className="flex gap-1.5">
            <button
              onClick={playSignalChord}
              className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-[10px]"
            >
              ▶ Sinal
            </button>
            <button
              onClick={playHitSound}
              className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-[10px]"
            >
              ▶ Hit
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={browserEnabled && permissionStatus === "granted"}
              onChange={(e) => {
                if (e.target.checked && permissionStatus !== "granted") {
                  requestPermission();
                } else {
                  setBrowser(e.target.checked);
                }
              }}
              className="accent-amber-500"
            />
            <span className="text-xs">Notificação do navegador</span>
          </label>
          {permissionStatus !== "granted" && (
            <button
              onClick={requestPermission}
              className="px-2 py-1 rounded bg-amber-700 hover:bg-amber-600 text-[10px] text-white"
            >
              Permitir notificações
            </button>
          )}
          <p className="text-[9px] text-neutral-500">
            {permissionStatus === "granted"
              ? "Permitido"
              : permissionStatus === "denied"
                ? "Negado nas configs do navegador"
                : "Aguardando permissão"}
          </p>
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
          <p className="text-[10px] text-neutral-400">
            Notificar quando confiança ≥ <span className="font-mono text-amber-300">{(threshold * 100).toFixed(0)}%</span>
          </p>
        </div>
      </div>
    </section>
  );
});
NotificationSettings.displayName = "NotificationSettings";
export default NotificationSettings;
