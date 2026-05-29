export interface ROI {
  x: number;
  y: number;
  w: number;
  h: number;
}

const luminance = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

export const detectHistoryStrip = (imgData: ImageData): ROI | null => {
  const { data, width, height } = imgData;
  const rowVariances = new Array<number>(height).fill(0);

  for (let y = 0; y < height; y++) {
    let sum = 0;
    let count = 0;
    for (let x = 0; x < width; x += 2) {
      const i = (y * width + x) * 4;
      const l = luminance(data[i], data[i + 1], data[i + 2]);
      sum += l;
      count += 1;
    }
    const mean = sum / Math.max(1, count);
    let varSum = 0;
    for (let x = 0; x < width; x += 2) {
      const i = (y * width + x) * 4;
      const l = luminance(data[i], data[i + 1], data[i + 2]);
      varSum += (l - mean) * (l - mean);
    }
    rowVariances[y] = varSum / Math.max(1, count);
  }

  const maxVar = Math.max(...rowVariances);
  if (maxVar < 100) return null;
  const threshold = maxVar * 0.35;

  const regions: Array<{ start: number; end: number; score: number }> = [];
  let curStart = -1;
  let curScore = 0;
  for (let y = 0; y < height; y++) {
    if (rowVariances[y] >= threshold) {
      if (curStart === -1) curStart = y;
      curScore += rowVariances[y];
    } else {
      if (curStart !== -1 && y - curStart >= 8) {
        regions.push({ start: curStart, end: y, score: curScore });
      }
      curStart = -1;
      curScore = 0;
    }
  }
  if (curStart !== -1 && height - curStart >= 8) {
    regions.push({ start: curStart, end: height, score: curScore });
  }

  if (regions.length === 0) return null;

  regions.sort((a, b) => {
    const heightA = a.end - a.start;
    const heightB = b.end - b.start;
    if (heightA < 18 || heightB < 18) return heightB - heightA;
    return b.score - a.score;
  });

  const best = regions[0];
  if (best.end - best.start < 12) return null;

  const padY = Math.floor((best.end - best.start) * 0.1);
  return {
    x: 0,
    y: Math.max(0, (best.start - padY) / height),
    w: 1,
    h: Math.min(1 - (best.start - padY) / height, (best.end - best.start + padY * 2) / height),
  };
};

export const captureFrameImageData = (video: HTMLVideoElement, scale = 0.5): ImageData | null => {
  if (video.videoWidth === 0 || video.videoHeight === 0) return null;
  const w = Math.floor(video.videoWidth * scale);
  const h = Math.floor(video.videoHeight * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
};
