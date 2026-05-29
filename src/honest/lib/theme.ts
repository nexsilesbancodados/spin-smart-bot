import { useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

type Theme = "dark" | "light";
type Accent = "amber" | "sky" | "emerald" | "pink" | "purple";

const ACCENT_HUES: Record<Accent, string> = {
  amber: "38 92% 50%",
  sky: "199 89% 48%",
  emerald: "160 84% 39%",
  pink: "330 81% 60%",
  purple: "270 91% 65%",
};

interface ThemeStore {
  theme: Theme;
  accent: Accent;
  setTheme: (t: Theme) => void;
  setAccent: (a: Accent) => void;
  toggle: () => void;
}

export const useTheme = create<ThemeStore>()(
  persist(
    (set) => ({
      theme: "dark",
      accent: "amber",
      setTheme: (theme) => set({ theme }),
      setAccent: (accent) => set({ accent }),
      toggle: () => set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),
    }),
    { name: "rv-theme-v1" }
  )
);

export const ACCENTS: Array<{ id: Accent; label: string; cls: string }> = [
  { id: "amber", label: "Amber", cls: "bg-amber-400" },
  { id: "sky", label: "Sky", cls: "bg-sky-400" },
  { id: "emerald", label: "Emerald", cls: "bg-emerald-400" },
  { id: "pink", label: "Pink", cls: "bg-pink-400" },
  { id: "purple", label: "Purple", cls: "bg-purple-400" },
];

export const useApplyTheme = () => {
  const theme = useTheme((s) => s.theme);
  const accent = useTheme((s) => s.accent);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.accent = accent;
    document.documentElement.classList.toggle("theme-light", theme === "light");
    document.documentElement.style.setProperty("--rv-accent-hsl", ACCENT_HUES[accent]);
  }, [theme, accent]);
};

void ACCENT_HUES;
