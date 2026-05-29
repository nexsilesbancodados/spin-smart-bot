import { create } from "zustand";

export type ToastKind = "hit" | "miss" | "signal" | "info" | "warn";

export interface Toast {
  id: string;
  kind: ToastKind;
  title: string;
  body?: string;
  at: number;
  ttl: number;
}

interface ToastStore {
  toasts: Toast[];
  push: (t: Omit<Toast, "id" | "at" | "ttl"> & { ttl?: number }) => void;
  dismiss: (id: string) => void;
  clear: () => void;
}

let seq = 0;

export const useToast = create<ToastStore>((set) => ({
  toasts: [],
  push: (t) =>
    set((s) => {
      const id = `t-${Date.now()}-${seq++}`;
      const at = Date.now();
      const ttl = t.ttl ?? 4500;
      const next: Toast = { id, at, ttl, kind: t.kind, title: t.title, body: t.body };
      return { toasts: [next, ...s.toasts].slice(0, 6) };
    }),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

export const toastSignal = (mainPick: number, mainProb: number, sector: string) =>
  useToast.getState().push({
    kind: "signal",
    title: `🎯 Sinal: ${mainPick}`,
    body: `${(mainProb * 100).toFixed(1)}% · setor ${sector}`,
    ttl: 5000,
  });

export const toastHit = (predicted: number, actual: number, exact: boolean) =>
  useToast.getState().push({
    kind: "hit",
    title: exact ? `✓✓ ACERTO EXATO no ${actual}` : `✓ Top-5 hit (saiu ${actual})`,
    body: exact ? "Predito = saiu" : `Predito ${predicted}, dentro do top-5`,
    ttl: 4500,
  });

export const toastMiss = (predicted: number, actual: number) =>
  useToast.getState().push({
    kind: "miss",
    title: `✗ Errou`,
    body: `Predito ${predicted} · saiu ${actual}`,
    ttl: 3500,
  });
