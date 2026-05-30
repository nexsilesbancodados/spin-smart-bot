import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UiPrefsStore {
  compact: boolean;
  toolsAutoOpen: boolean;
  honestMode: boolean;
  strictValidation: boolean;
  setCompact: (v: boolean) => void;
  toggleCompact: () => void;
  setToolsAutoOpen: (v: boolean) => void;
  setHonestMode: (v: boolean) => void;
  toggleHonestMode: () => void;
  toggleStrictValidation: () => void;
}

export const useUiPrefs = create<UiPrefsStore>()(
  persist(
    (set) => ({
      compact: false,
      toolsAutoOpen: false,
      honestMode: false,
      strictValidation: true,
      setCompact: (v) => set({ compact: v }),
      toggleCompact: () => set((s) => ({ compact: !s.compact })),
      setToolsAutoOpen: (v) => set({ toolsAutoOpen: v }),
      setHonestMode: (v) => set({ honestMode: v }),
      toggleHonestMode: () => set((s) => ({ honestMode: !s.honestMode })),
      toggleStrictValidation: () => set((s) => ({ strictValidation: !s.strictValidation })),
    }),
    { name: "rv-ui-prefs-v1" }
  )
);
