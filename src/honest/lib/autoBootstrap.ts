import { useSignalAgent } from "./signalAgent";
import { useEntryFilter } from "./entryFilter";
import { useNotifications } from "./notifications";
import { useFeedStatus } from "./feedStatus";
import { useAutoTuner } from "./autoTuner";
import { useDigest } from "./digest";
import { useAutoPause } from "./autoPause";

const BOOTSTRAP_KEY = "rv-bootstrap-v2";

export const runAutoBootstrap = () => {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(BOOTSTRAP_KEY) === "1") return;

  useSignalAgent.getState().setConfig({
    enabled: true,
    threshold: 0.045,
    lstmEnabled: true,
    lstmHiddenSize: 24,
    trainOnEverySpin: true,
    trainingWindow: 300,
    ensembleWeight: 0.7,
    lstmWeight: 0.3,
    useWorker: false,
    dynamicThreshold: true,
    hourFilterEnabled: false,
    hoursAllowed: Array.from({ length: 24 }, (_, h) => h),
  });

  const conditionDefaults: Record<string, { enabled: boolean; param: number }> = {
    "agent-confidence-min": { enabled: true, param: 0.4 },
    "agent-mainprob-min": { enabled: true, param: 0.045 },
    "no-dealer-drift": { enabled: true, param: 30 },
    "min-history": { enabled: true, param: 50 },
    "no-zero-recent": { enabled: false, param: 2 },
    "sector-dominance": { enabled: true, param: 8 },
    "lstm-agrees": { enabled: true, param: 0 },
    "model-min-contributors": { enabled: true, param: 3 },
  };
  useEntryFilter.setState((s) => ({
    enabled: true,
    combinator: "AND",
    conditions: s.conditions.map((c) => {
      const d = conditionDefaults[c.id];
      return d ? { ...c, enabled: d.enabled, param: d.param } : c;
    }),
  }));

  useNotifications.getState().setSoundEnabled(true);
  useNotifications.getState().setSignalThresholdConfidence(0.4);

  useFeedStatus.getState().setPollEnabled(true);
  useFeedStatus.getState().setPollInterval(5000);

  useAutoTuner.getState().setEnabled(true);
  useAutoTuner.getState().setInterval(25);
  useAutoTuner.getState().setSignalsRequired(20);

  useDigest.getState().setEnabled(true);
  useDigest.getState().setInterval(15);

  useAutoPause.getState().setConfig({
    enabled: true,
    pauseOnCriticalTilt: true,
    pauseOnSessionLimits: true,
    pauseOnConsecutiveMisses: true,
    maxConsecutiveMisses: 8,
  });

  localStorage.setItem(BOOTSTRAP_KEY, "1");
  console.log("[Auto-bootstrap] Configuração máxima ativada");
};
