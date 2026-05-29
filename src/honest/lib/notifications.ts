import { create } from "zustand";
import { persist } from "zustand/middleware";

interface NotificationStore {
  soundEnabled: boolean;
  browserNotificationEnabled: boolean;
  voiceEnabled: boolean;
  voiceVolume: number;
  signalThresholdConfidence: number;
  setSoundEnabled: (v: boolean) => void;
  setBrowserNotificationEnabled: (v: boolean) => void;
  setVoiceEnabled: (v: boolean) => void;
  setVoiceVolume: (v: number) => void;
  setSignalThresholdConfidence: (v: number) => void;
}

export const useNotifications = create<NotificationStore>()(
  persist(
    (set) => ({
      soundEnabled: true,
      browserNotificationEnabled: false,
      voiceEnabled: false,
      voiceVolume: 0.8,
      signalThresholdConfidence: 0.5,
      setSoundEnabled: (v) => set({ soundEnabled: v }),
      setBrowserNotificationEnabled: (v) => set({ browserNotificationEnabled: v }),
      setVoiceEnabled: (v) => set({ voiceEnabled: v }),
      setVoiceVolume: (v) => set({ voiceVolume: Math.max(0, Math.min(1, v)) }),
      setSignalThresholdConfidence: (v) => set({ signalThresholdConfidence: v }),
    }),
    { name: "rv-notifications-v1" }
  )
);

let ctx: AudioContext | null = null;

const getCtx = (): AudioContext => {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
  }
  return ctx;
};

export const playSignalBeep = (frequency = 880, durationMs = 220, type: OscillatorType = "sine") => {
  const settings = useNotifications.getState();
  if (!settings.soundEnabled) return;
  try {
    const c = getCtx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, c.currentTime);
    gain.gain.setValueAtTime(0, c.currentTime);
    gain.gain.linearRampToValueAtTime(0.18, c.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + durationMs / 1000);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + durationMs / 1000);
  } catch {
    /* noop */
  }
};

export const playSignalChord = () => {
  playSignalBeep(880, 180, "sine");
  setTimeout(() => playSignalBeep(1175, 200, "sine"), 90);
  setTimeout(() => playSignalBeep(1568, 260, "sine"), 200);
};

export const playHitSound = () => {
  playSignalBeep(523, 120, "triangle");
  setTimeout(() => playSignalBeep(784, 200, "triangle"), 100);
};

export const playMissSound = () => {
  playSignalBeep(220, 280, "sawtooth");
};

export const requestBrowserNotificationPermission = async (): Promise<boolean> => {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const r = await Notification.requestPermission();
  return r === "granted";
};

const NUMBER_WORDS: Record<number, string> = {
  0: "zero", 1: "um", 2: "dois", 3: "três", 4: "quatro", 5: "cinco",
  6: "seis", 7: "sete", 8: "oito", 9: "nove", 10: "dez",
  11: "onze", 12: "doze", 13: "treze", 14: "quatorze", 15: "quinze",
  16: "dezesseis", 17: "dezessete", 18: "dezoito", 19: "dezenove", 20: "vinte",
  21: "vinte e um", 22: "vinte e dois", 23: "vinte e três", 24: "vinte e quatro",
  25: "vinte e cinco", 26: "vinte e seis", 27: "vinte e sete", 28: "vinte e oito",
  29: "vinte e nove", 30: "trinta", 31: "trinta e um", 32: "trinta e dois",
  33: "trinta e três", 34: "trinta e quatro", 35: "trinta e cinco", 36: "trinta e seis",
};

const numberPt = (n: number) => NUMBER_WORDS[n] ?? String(n);

export const speak = (text: string) => {
  const settings = useNotifications.getState();
  if (!settings.voiceEnabled) return;
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "pt-BR";
    utter.volume = settings.voiceVolume;
    utter.rate = 1.05;
    utter.pitch = 1.0;
    window.speechSynthesis.speak(utter);
  } catch {
    /* noop */
  }
};

export const speakSignal = (mainPick: number, sector: string, prob: number) => {
  const txt = `Sinal: ${numberPt(mainPick)}. Setor ${sector}. Probabilidade ${(prob * 100).toFixed(0)} por cento.`;
  speak(txt);
};

export const showBrowserNotification = (title: string, body: string, icon?: string) => {
  const settings = useNotifications.getState();
  if (!settings.browserNotificationEnabled) return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, icon, silent: false });
  } catch {
    /* noop */
  }
};
