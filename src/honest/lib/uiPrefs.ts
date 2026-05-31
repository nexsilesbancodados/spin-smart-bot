import { create } from "zustand";
import { persist } from "zustand/middleware";

export type BetScope = "color" | "parity" | "highlow" | "dozen" | "column" | "sector" | "terminal" | "neighbors" | "number" | "pleno";

interface UiPrefsStore {
  compact: boolean;
  toolsAutoOpen: boolean;
  honestMode: boolean;
  strictValidation: boolean;
  focusedScope: BetScope[];
  setCompact: (v: boolean) => void;
  toggleCompact: () => void;
  setToolsAutoOpen: (v: boolean) => void;
  setHonestMode: (v: boolean) => void;
  toggleHonestMode: () => void;
  toggleStrictValidation: () => void;
  setFocusedScope: (scope: BetScope[]) => void;
  toggleScope: (kind: BetScope) => void;
}

const DEFAULT_FOCUSED: BetScope[] = ["color", "parity", "highlow", "dozen", "column", "sector"];
const ALL_SCOPES: BetScope[] = [
  "color", "parity", "highlow", "dozen", "column", "sector",
  "terminal", "neighbors", "number", "pleno",
];
void ALL_SCOPES;

export const useUiPrefs = create<UiPrefsStore>()(
  persist(
    (set) => ({
      compact: false,
      toolsAutoOpen: false,
      honestMode: false,
      strictValidation: true,
      focusedScope: DEFAULT_FOCUSED,
      setCompact: (v) => set({ compact: v }),
      toggleCompact: () => set((s) => ({ compact: !s.compact })),
      setToolsAutoOpen: (v) => set({ toolsAutoOpen: v }),
      setHonestMode: (v) => set({ honestMode: v }),
      toggleHonestMode: () => set((s) => ({ honestMode: !s.honestMode })),
      toggleStrictValidation: () => set((s) => ({ strictValidation: !s.strictValidation })),
      setFocusedScope: (scope) => set({ focusedScope: scope }),
      toggleScope: (kind) =>
        set((s) => {
          const has = s.focusedScope.includes(kind);
          return {
            focusedScope: has
              ? s.focusedScope.filter((k) => k !== kind)
              : [...s.focusedScope, kind],
          };
        }),
    }),
    { name: "rv-ui-prefs-v1" }
  )
);
