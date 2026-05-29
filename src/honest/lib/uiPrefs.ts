import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UiPrefsStore {
  compact: boolean;
  toolsAutoOpen: boolean;
  setCompact: (v: boolean) => void;
  toggleCompact: () => void;
  setToolsAutoOpen: (v: boolean) => void;
}

export const useUiPrefs = create<UiPrefsStore>()(
  persist(
    (set) => ({
      compact: false,
      toolsAutoOpen: false,
      setCompact: (v) => set({ compact: v }),
      toggleCompact: () => set((s) => ({ compact: !s.compact })),
      setToolsAutoOpen: (v) => set({ toolsAutoOpen: v }),
    }),
    { name: "rv-ui-prefs-v1" }
  )
);
