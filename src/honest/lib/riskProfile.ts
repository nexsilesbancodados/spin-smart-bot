import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { RiskProfile } from "./betTypes";

interface RiskProfileStore {
  profile: RiskProfile;
  setProfile: (p: RiskProfile) => void;
}

export const useRiskProfile = create<RiskProfileStore>()(
  persist(
    (set) => ({
      profile: "balanced",
      setProfile: (profile) => set({ profile }),
    }),
    { name: "rv-risk-profile-v1" }
  )
);

export const RISK_LABELS: Record<RiskProfile, { label: string; emoji: string; description: string }> = {
  conservative: {
    label: "Conservador",
    emoji: "🛡",
    description: "Prefere alta hit rate e baixa variância. Aposta segura, payout menor.",
  },
  balanced: {
    label: "Balanceado",
    emoji: "⚖",
    description: "Equilíbrio entre EV, hit rate e confiança do modelo. Default.",
  },
  aggressive: {
    label: "Agressivo",
    emoji: "🔥",
    description: "Maximiza EV e confiança do modelo. Aceita variância alta.",
  },
};
