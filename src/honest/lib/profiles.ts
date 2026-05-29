import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useSignalAgent, type SignalAgentConfig } from "./signalAgent";
import { useEntryFilter, type ActiveCondition } from "./entryFilter";
import { useNotifications } from "./notifications";
import { useFeedStatus } from "./feedStatus";
import { useTheme } from "./theme";

export interface Profile {
  id: string;
  name: string;
  createdAt: number;
  agentConfig: SignalAgentConfig;
  filterEnabled: boolean;
  filterCombinator: "AND" | "OR";
  filterConditions: ActiveCondition[];
  soundEnabled: boolean;
  voiceEnabled: boolean;
  signalThreshold: number;
  pollInterval: number;
  theme: "dark" | "light";
  accent: "amber" | "sky" | "emerald" | "pink" | "purple";
}

interface ProfilesStore {
  profiles: Profile[];
  activeId: string | null;
  save: (name: string) => void;
  load: (id: string) => void;
  remove: (id: string) => void;
  rename: (id: string, name: string) => void;
}

const snapshot = (name: string): Profile => {
  const agent = useSignalAgent.getState().config;
  const filter = useEntryFilter.getState();
  const notif = useNotifications.getState();
  const feed = useFeedStatus.getState();
  const theme = useTheme.getState();
  return {
    id: `prof_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    name,
    createdAt: Date.now(),
    agentConfig: { ...agent },
    filterEnabled: filter.enabled,
    filterCombinator: filter.combinator,
    filterConditions: filter.conditions.map((c) => ({ ...c })),
    soundEnabled: notif.soundEnabled,
    voiceEnabled: notif.voiceEnabled,
    signalThreshold: notif.signalThresholdConfidence,
    pollInterval: feed.pollInterval,
    theme: theme.theme,
    accent: theme.accent,
  };
};

const apply = (p: Profile) => {
  useSignalAgent.setState({ config: p.agentConfig });
  useEntryFilter.setState({
    enabled: p.filterEnabled,
    combinator: p.filterCombinator,
    conditions: p.filterConditions,
  });
  useNotifications.setState({
    soundEnabled: p.soundEnabled,
    voiceEnabled: p.voiceEnabled,
    signalThresholdConfidence: p.signalThreshold,
  });
  useFeedStatus.getState().setPollInterval(p.pollInterval);
  useTheme.setState({ theme: p.theme, accent: p.accent });
};

export const useProfiles = create<ProfilesStore>()(
  persist(
    (set) => ({
      profiles: [],
      activeId: null,
      save: (name) =>
        set((s) => {
          const p = snapshot(name);
          return { profiles: [...s.profiles, p], activeId: p.id };
        }),
      load: (id) =>
        set((s) => {
          const p = s.profiles.find((x) => x.id === id);
          if (!p) return s;
          apply(p);
          return { activeId: id };
        }),
      remove: (id) =>
        set((s) => ({
          profiles: s.profiles.filter((p) => p.id !== id),
          activeId: s.activeId === id ? null : s.activeId,
        })),
      rename: (id, name) =>
        set((s) => ({ profiles: s.profiles.map((p) => (p.id === id ? { ...p, name } : p)) })),
    }),
    { name: "rv-profiles-v1" }
  )
);
