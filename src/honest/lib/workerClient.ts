import EngineWorker from "../../workers/engine.worker?worker";

interface PendingRequest {
  resolve: (result: unknown) => void;
  reject: (err: Error) => void;
}

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, PendingRequest>();
let available = true;

const getWorker = (): Worker | null => {
  if (worker) return worker;
  try {
    worker = new EngineWorker();
    worker.onmessage = (evt: MessageEvent<{ id: number; ok: boolean; result?: unknown; error?: string }>) => {
      const { id, ok, result, error } = evt.data;
      const p = pending.get(id);
      if (!p) return;
      pending.delete(id);
      if (ok) p.resolve(result);
      else p.reject(new Error(error ?? "worker error"));
    };
    worker.onerror = () => {
      available = false;
    };
  } catch {
    available = false;
    worker = null;
  }
  return worker;
};

const call = <T,>(type: string, payload?: unknown, timeoutMs = 8000): Promise<T> => {
  return new Promise((resolve, reject) => {
    const w = getWorker();
    if (!w || !available) {
      reject(new Error("Worker indisponível"));
      return;
    }
    const id = nextId++;
    pending.set(id, { resolve: resolve as (r: unknown) => void, reject });
    w.postMessage({ id, type, payload });
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error("Worker timeout"));
      }
    }, timeoutMs);
  });
};

export interface WorkerEnsembleResult {
  combined: number[];
  perModel: Array<{ id: string; name: string; weight: number; probs: number[] }>;
  baselineLogLoss: number;
}

export interface WorkerLstmResult {
  probs: number[];
  trainedSteps: number;
}

export const workerTrainPredict = (spins: number[]) =>
  call<WorkerEnsembleResult>("train-predict", { spins });

export const workerLstmTrainPredict = (
  spinsNewestFirst: number[],
  contextNewestFirst: number[],
  hiddenSize: number,
  trainSteps: number
) =>
  call<WorkerLstmResult>("lstm-train-predict", {
    spinsNewestFirst,
    contextNewestFirst,
    hiddenSize,
    trainSteps,
  });

export const workerObserve = (actual: number) => call<{ ok: boolean }>("ensemble-observe", { actual });

export const workerReset = () => call<{ ok: boolean }>("reset");

export const isWorkerAvailable = () => {
  getWorker();
  return available;
};
