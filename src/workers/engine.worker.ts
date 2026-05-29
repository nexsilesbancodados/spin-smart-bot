/// <reference lib="webworker" />
import { createEnsemble, type EnsembleEngine } from "../honest/lib/ensemble";
import { createLSTM, predict as lstmPredict, trainOnSequence, type LSTMModel } from "../honest/lib/lstm";

let ensemble: EnsembleEngine | null = null;
let lstm: LSTMModel | null = null;
let lastHash = "";

interface WorkerInMessage {
  id: number;
  type: "train-predict" | "lstm-train-predict" | "ensemble-observe" | "reset" | "ping";
  payload?: unknown;
}

interface TrainPredictPayload {
  spins: number[];
}

interface LstmPayload {
  spinsNewestFirst: number[];
  contextNewestFirst: number[];
  hiddenSize: number;
  trainSteps: number;
}

interface ObservePayload {
  actual: number;
}

const handleTrainPredict = (payload: TrainPredictPayload) => {
  if (!ensemble) ensemble = createEnsemble();
  const hash = `${payload.spins.length}:${payload.spins.slice(0, 5).join(",")}`;
  if (hash !== lastHash) {
    ensemble.train(payload.spins);
    lastHash = hash;
  }
  const r = ensemble.predict();
  return {
    combined: Array.from(r.combined),
    perModel: r.perModel.map((p) => ({
      id: p.model.id,
      name: p.model.name,
      weight: p.model.weight,
      probs: Array.from(p.probs),
    })),
    baselineLogLoss: r.baselineLogLoss,
  };
};

const handleLstmTrainPredict = (payload: LstmPayload) => {
  if (!lstm || lstm.hiddenSize !== payload.hiddenSize) {
    lstm = createLSTM(payload.hiddenSize);
  }
  if (payload.trainSteps > 0) {
    trainOnSequence(lstm, payload.spinsNewestFirst, payload.trainSteps);
  }
  const probs = lstmPredict(lstm, payload.contextNewestFirst);
  return {
    probs: Array.from(probs),
    trainedSteps: lstm.trainedSteps,
  };
};

const handleObserve = (payload: ObservePayload) => {
  if (!ensemble) return null;
  ensemble.observe(payload.actual);
  return { ok: true };
};

self.onmessage = (evt: MessageEvent<WorkerInMessage>) => {
  const { id, type, payload } = evt.data;
  try {
    let result: unknown;
    switch (type) {
      case "train-predict":
        result = handleTrainPredict(payload as TrainPredictPayload);
        break;
      case "lstm-train-predict":
        result = handleLstmTrainPredict(payload as LstmPayload);
        break;
      case "ensemble-observe":
        result = handleObserve(payload as ObservePayload);
        break;
      case "reset":
        ensemble = null;
        lstm = null;
        lastHash = "";
        result = { ok: true };
        break;
      case "ping":
        result = { pong: Date.now() };
        break;
    }
    (self as unknown as Worker).postMessage({ id, ok: true, result });
  } catch (e) {
    (self as unknown as Worker).postMessage({ id, ok: false, error: e instanceof Error ? e.message : String(e) });
  }
};
