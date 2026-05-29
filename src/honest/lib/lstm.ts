import { SLOTS } from "./wheel";

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
const tanh = (x: number) => Math.tanh(x);
const dtanh = (y: number) => 1 - y * y;
const dsigmoid = (y: number) => y * (1 - y);

const seed = (s: number) => {
  let z = s | 0;
  return () => {
    z = (z * 1664525 + 1013904223) | 0;
    return ((z >>> 0) / 0xffffffff) * 2 - 1;
  };
};

const makeMatrix = (rows: number, cols: number, rng: () => number, scale = 0.1): Float32Array[] => {
  const m: Float32Array[] = [];
  for (let i = 0; i < rows; i++) {
    const r = new Float32Array(cols);
    for (let j = 0; j < cols; j++) r[j] = rng() * scale;
    m.push(r);
  }
  return m;
};

const matVec = (m: Float32Array[], v: Float32Array): Float32Array => {
  const out = new Float32Array(m.length);
  for (let i = 0; i < m.length; i++) {
    let s = 0;
    const row = m[i];
    for (let j = 0; j < row.length; j++) s += row[j] * v[j];
    out[i] = s;
  }
  return out;
};

const addInPlace = (a: Float32Array, b: Float32Array): void => {
  for (let i = 0; i < a.length; i++) a[i] += b[i];
};

const oneHot = (n: number, size: number): Float32Array => {
  const v = new Float32Array(size);
  if (n >= 0 && n < size) v[n] = 1;
  return v;
};

const softmax = (logits: Float32Array): Float32Array => {
  let max = -Infinity;
  for (let i = 0; i < logits.length; i++) if (logits[i] > max) max = logits[i];
  const out = new Float32Array(logits.length);
  let sum = 0;
  for (let i = 0; i < logits.length; i++) {
    out[i] = Math.exp(logits[i] - max);
    sum += out[i];
  }
  for (let i = 0; i < logits.length; i++) out[i] /= sum;
  return out;
};

export interface LSTMModel {
  hiddenSize: number;
  inputSize: number;
  outputSize: number;
  Wi: Float32Array[]; bi: Float32Array;
  Wf: Float32Array[]; bf: Float32Array;
  Wo: Float32Array[]; bo: Float32Array;
  Wc: Float32Array[]; bc: Float32Array;
  Wy: Float32Array[]; by: Float32Array;
  h: Float32Array;
  c: Float32Array;
  learningRate: number;
  trainedSteps: number;
}

export const createLSTM = (hiddenSize = 24, inputSize = SLOTS, outputSize = SLOTS): LSTMModel => {
  const rng = seed(7);
  const combined = hiddenSize + inputSize;
  return {
    hiddenSize,
    inputSize,
    outputSize,
    Wi: makeMatrix(hiddenSize, combined, rng, 0.2),
    bi: new Float32Array(hiddenSize),
    Wf: makeMatrix(hiddenSize, combined, rng, 0.2),
    bf: (() => {
      const b = new Float32Array(hiddenSize);
      b.fill(1);
      return b;
    })(),
    Wo: makeMatrix(hiddenSize, combined, rng, 0.2),
    bo: new Float32Array(hiddenSize),
    Wc: makeMatrix(hiddenSize, combined, rng, 0.2),
    bc: new Float32Array(hiddenSize),
    Wy: makeMatrix(outputSize, hiddenSize, rng, 0.2),
    by: new Float32Array(outputSize),
    h: new Float32Array(hiddenSize),
    c: new Float32Array(hiddenSize),
    learningRate: 0.05,
    trainedSteps: 0,
  };
};

const concat = (a: Float32Array, b: Float32Array): Float32Array => {
  const out = new Float32Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
};

interface StepState {
  x: Float32Array;
  combined: Float32Array;
  i: Float32Array;
  f: Float32Array;
  o: Float32Array;
  cTilde: Float32Array;
  c: Float32Array;
  cPrev: Float32Array;
  hPrev: Float32Array;
  h: Float32Array;
  logits: Float32Array;
  probs: Float32Array;
}

const forwardStep = (m: LSTMModel, x: Float32Array): StepState => {
  const combined = concat(m.h, x);
  const i = matVec(m.Wi, combined);
  addInPlace(i, m.bi);
  for (let k = 0; k < i.length; k++) i[k] = sigmoid(i[k]);
  const f = matVec(m.Wf, combined);
  addInPlace(f, m.bf);
  for (let k = 0; k < f.length; k++) f[k] = sigmoid(f[k]);
  const o = matVec(m.Wo, combined);
  addInPlace(o, m.bo);
  for (let k = 0; k < o.length; k++) o[k] = sigmoid(o[k]);
  const cTilde = matVec(m.Wc, combined);
  addInPlace(cTilde, m.bc);
  for (let k = 0; k < cTilde.length; k++) cTilde[k] = tanh(cTilde[k]);

  const cPrev = m.c;
  const c = new Float32Array(m.hiddenSize);
  for (let k = 0; k < c.length; k++) c[k] = f[k] * cPrev[k] + i[k] * cTilde[k];
  const hPrev = m.h;
  const h = new Float32Array(m.hiddenSize);
  for (let k = 0; k < h.length; k++) h[k] = o[k] * tanh(c[k]);
  const logits = matVec(m.Wy, h);
  addInPlace(logits, m.by);
  const probs = softmax(logits);
  return { x, combined, i, f, o, cTilde, c, cPrev, hPrev, h, logits, probs };
};

export const predict = (m: LSTMModel, contextNewestFirst: number[]): Float32Array => {
  const seq = contextNewestFirst.slice(0, 20).reverse();
  m.h = new Float32Array(m.hiddenSize);
  m.c = new Float32Array(m.hiddenSize);
  let last: StepState | null = null;
  for (const n of seq) {
    last = forwardStep(m, oneHot(n, m.inputSize));
    m.h = last.h;
    m.c = last.c;
  }
  if (!last) {
    const p = new Float32Array(m.outputSize);
    p.fill(1 / m.outputSize);
    return p;
  }
  return last.probs;
};

const updateMatrix = (W: Float32Array[], grad: Float32Array[], lr: number): void => {
  for (let i = 0; i < W.length; i++) {
    const r = W[i];
    const g = grad[i];
    for (let j = 0; j < r.length; j++) r[j] -= lr * g[j];
  }
};

const updateVector = (b: Float32Array, grad: Float32Array, lr: number): void => {
  for (let i = 0; i < b.length; i++) b[i] -= lr * grad[i];
};

const zeroMatrix = (rows: number, cols: number): Float32Array[] =>
  Array.from({ length: rows }, () => new Float32Array(cols));

const outerProduct = (a: Float32Array, b: Float32Array, out: Float32Array[]): void => {
  for (let i = 0; i < a.length; i++) {
    const row = out[i];
    const ai = a[i];
    for (let j = 0; j < b.length; j++) row[j] += ai * b[j];
  }
};

export const trainOnSequence = (m: LSTMModel, sequenceNewestFirst: number[], maxSteps = 64): number => {
  const seq = sequenceNewestFirst.slice(0, maxSteps + 1).reverse();
  if (seq.length < 2) return 0;
  m.h = new Float32Array(m.hiddenSize);
  m.c = new Float32Array(m.hiddenSize);
  const states: StepState[] = [];
  for (let t = 0; t < seq.length - 1; t++) {
    const x = oneHot(seq[t], m.inputSize);
    const s = forwardStep(m, x);
    states.push(s);
    m.h = s.h;
    m.c = s.c;
  }
  let totalLoss = 0;
  const lr = m.learningRate;
  const combinedSize = m.hiddenSize + m.inputSize;
  const dWi = zeroMatrix(m.hiddenSize, combinedSize);
  const dWf = zeroMatrix(m.hiddenSize, combinedSize);
  const dWo = zeroMatrix(m.hiddenSize, combinedSize);
  const dWc = zeroMatrix(m.hiddenSize, combinedSize);
  const dWy = zeroMatrix(m.outputSize, m.hiddenSize);
  const dbi = new Float32Array(m.hiddenSize);
  const dbf = new Float32Array(m.hiddenSize);
  const dbo = new Float32Array(m.hiddenSize);
  const dbc = new Float32Array(m.hiddenSize);
  const dby = new Float32Array(m.outputSize);

  let dhNext = new Float32Array(m.hiddenSize);
  let dcNext = new Float32Array(m.hiddenSize);

  for (let t = states.length - 1; t >= 0; t--) {
    const s = states[t];
    const target = seq[t + 1];
    totalLoss += -Math.log(Math.max(s.probs[target], 1e-9));

    const dLogits = s.probs.slice();
    dLogits[target] -= 1;

    outerProduct(dLogits, s.h, dWy);
    addInPlace(dby, dLogits);

    const dh = new Float32Array(m.hiddenSize);
    for (let i = 0; i < m.outputSize; i++) {
      const row = m.Wy[i];
      const grad = dLogits[i];
      for (let j = 0; j < m.hiddenSize; j++) dh[j] += row[j] * grad;
    }
    for (let i = 0; i < dh.length; i++) dh[i] += dhNext[i];

    const dO = new Float32Array(m.hiddenSize);
    const tanhC = new Float32Array(m.hiddenSize);
    for (let k = 0; k < m.hiddenSize; k++) {
      tanhC[k] = tanh(s.c[k]);
      dO[k] = dh[k] * tanhC[k] * dsigmoid(s.o[k]);
    }
    const dc = new Float32Array(m.hiddenSize);
    for (let k = 0; k < m.hiddenSize; k++) {
      dc[k] = dh[k] * s.o[k] * dtanh(tanhC[k]) + dcNext[k];
    }
    const dF = new Float32Array(m.hiddenSize);
    const dI = new Float32Array(m.hiddenSize);
    const dCTilde = new Float32Array(m.hiddenSize);
    for (let k = 0; k < m.hiddenSize; k++) {
      dF[k] = dc[k] * s.cPrev[k] * dsigmoid(s.f[k]);
      dI[k] = dc[k] * s.cTilde[k] * dsigmoid(s.i[k]);
      dCTilde[k] = dc[k] * s.i[k] * dtanh(s.cTilde[k]);
    }
    outerProduct(dI, s.combined, dWi);
    outerProduct(dF, s.combined, dWf);
    outerProduct(dO, s.combined, dWo);
    outerProduct(dCTilde, s.combined, dWc);
    addInPlace(dbi, dI);
    addInPlace(dbf, dF);
    addInPlace(dbo, dO);
    addInPlace(dbc, dCTilde);

    const dCombined = new Float32Array(m.hiddenSize + m.inputSize);
    const gates: Array<[Float32Array[], Float32Array]> = [
      [m.Wi, dI],
      [m.Wf, dF],
      [m.Wo, dO],
      [m.Wc, dCTilde],
    ];
    for (const [W, dg] of gates) {
      for (let i = 0; i < W.length; i++) {
        const row = W[i];
        const g = dg[i];
        for (let j = 0; j < row.length; j++) dCombined[j] += row[j] * g;
      }
    }
    const dhPrev = new Float32Array(m.hiddenSize);
    for (let k = 0; k < m.hiddenSize; k++) dhPrev[k] = dCombined[k];
    const dcPrev = new Float32Array(m.hiddenSize);
    for (let k = 0; k < m.hiddenSize; k++) dcPrev[k] = dc[k] * s.f[k];

    dhNext = dhPrev;
    dcNext = dcPrev;
  }

  const clip = (g: Float32Array, max = 5) => {
    for (let i = 0; i < g.length; i++) {
      if (g[i] > max) g[i] = max;
      else if (g[i] < -max) g[i] = -max;
    }
  };
  for (const g of [dWi, dWf, dWo, dWc, dWy]) for (const r of g) clip(r);
  clip(dbi);
  clip(dbf);
  clip(dbo);
  clip(dbc);
  clip(dby);

  updateMatrix(m.Wi, dWi, lr);
  updateMatrix(m.Wf, dWf, lr);
  updateMatrix(m.Wo, dWo, lr);
  updateMatrix(m.Wc, dWc, lr);
  updateMatrix(m.Wy, dWy, lr);
  updateVector(m.bi, dbi, lr);
  updateVector(m.bf, dbf, lr);
  updateVector(m.bo, dbo, lr);
  updateVector(m.bc, dbc, lr);
  updateVector(m.by, dby, lr);

  m.trainedSteps += states.length;
  return totalLoss / states.length;
};
