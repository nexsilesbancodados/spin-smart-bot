import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createWorker, type Worker } from "tesseract.js";
import { useHonestStore } from "../lib/store";
import { Card, PageContainer, PageHeader, SectionHeader, Button, EmptyState } from "../components/ui";
import { captureFrameImageData, detectHistoryStrip } from "../lib/autoRoi";

interface ROI {
  x: number;
  y: number;
  w: number;
  h: number;
}

const ROI_KEY = "rv-capture-roi";
const INTERVAL_KEY = "rv-capture-interval";

const Captura = memo(() => {
  const addSpin = useHonestStore((s) => s.addSpin);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const drawingRef = useRef<{ x: number; y: number } | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [intervalMs, setIntervalMs] = useState(() => Number(localStorage.getItem(INTERVAL_KEY) || 4000));
  const [roi, setROI] = useState<ROI | null>(() => {
    const raw = localStorage.getItem(ROI_KEY);
    return raw ? (JSON.parse(raw) as ROI) : null;
  });
  const [logs, setLogs] = useState<Array<{ t: number; raw: string; nums: number[] }>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoInject, setAutoInject] = useState(true);
  const [recentSeen, setRecentSeen] = useState<number[]>([]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      workerRef.current?.terminate().catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    if (roi) localStorage.setItem(ROI_KEY, JSON.stringify(roi));
  }, [roi]);

  useEffect(() => {
    localStorage.setItem(INTERVAL_KEY, String(intervalMs));
  }, [intervalMs]);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 5 },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStreaming(true);
      stream.getVideoTracks()[0].addEventListener("ended", stop);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStreaming(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const getWorker = useCallback(async (): Promise<Worker> => {
    if (workerRef.current) return workerRef.current;
    const worker = await createWorker("eng");
    await worker.setParameters({
      tessedit_char_whitelist: "0123456789",
      preserve_interword_spaces: "1",
    });
    workerRef.current = worker;
    return worker;
  }, []);

  const captureAndOCR = useCallback(async () => {
    if (busy) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !roi) return;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;
    setBusy(true);
    try {
      const sx = roi.x * video.videoWidth;
      const sy = roi.y * video.videoHeight;
      const sw = roi.w * video.videoWidth;
      const sh = roi.h * video.videoHeight;
      canvas.width = Math.max(1, Math.floor(sw));
      canvas.height = Math.max(1, Math.floor(sh));
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = "source-over";
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < img.data.length; i += 4) {
        const r = img.data[i];
        const g = img.data[i + 1];
        const b = img.data[i + 2];
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        const v = gray > 140 ? 255 : 0;
        img.data[i] = v;
        img.data[i + 1] = v;
        img.data[i + 2] = v;
      }
      ctx.putImageData(img, 0, 0);
      const worker = await getWorker();
      const blob: Blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b as Blob), "image/png"));
      const { data } = await worker.recognize(blob);
      const raw = data.text;
      const matches = raw.match(/\d{1,2}/g) ?? [];
      const nums = matches
        .map((m) => parseInt(m, 10))
        .filter((n) => !isNaN(n) && n >= 0 && n <= 36);
      const dedupTail: number[] = [];
      for (const n of nums) {
        if (dedupTail[dedupTail.length - 1] !== n) dedupTail.push(n);
      }
      setLogs((prev) => [{ t: Date.now(), raw: raw.replace(/\s+/g, " ").trim(), nums: dedupTail }, ...prev].slice(0, 30));
      if (autoInject && dedupTail.length > 0) {
        const newestFirst = dedupTail;
        let injected = 0;
        const seen = new Set(recentSeen);
        for (const n of newestFirst) {
          if (!seen.has(n)) {
            addSpin(n, "extension");
            injected += 1;
          }
        }
        if (injected > 0) {
          setRecentSeen(newestFirst.slice(0, 10));
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [busy, roi, getWorker, autoInject, addSpin, recentSeen]);

  useEffect(() => {
    if (!streaming || !roi) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(captureAndOCR, intervalMs);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [streaming, roi, intervalMs, captureAndOCR]);

  const onMouseDown = (e: React.MouseEvent) => {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return;
    drawingRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setROI({
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
      w: 0,
      h: 0,
    });
  };
  const onMouseMove = (e: React.MouseEvent) => {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect || !drawingRef.current) return;
    const curX = e.clientX - rect.left;
    const curY = e.clientY - rect.top;
    const x = Math.min(drawingRef.current.x, curX) / rect.width;
    const y = Math.min(drawingRef.current.y, curY) / rect.height;
    const w = Math.abs(curX - drawingRef.current.x) / rect.width;
    const h = Math.abs(curY - drawingRef.current.y) / rect.height;
    setROI({ x, y, w, h });
  };
  const onMouseUp = () => {
    drawingRef.current = null;
  };

  const roiStyle = useMemo(() => {
    if (!roi) return undefined;
    return {
      left: `${roi.x * 100}%`,
      top: `${roi.y * 100}%`,
      width: `${roi.w * 100}%`,
      height: `${roi.h * 100}%`,
    };
  }, [roi]);

  return (
    <PageContainer>
      <PageHeader
        title="Captura por OCR"
        subtitle="Compartilhe a janela/aba da casa, desenhe um retângulo sobre o histórico de números e o app lê via Tesseract.js, injeta no feed."
        actions={
          !streaming ? (
            <Button variant="primary" onClick={start}>
              Iniciar captura
            </Button>
          ) : (
            <Button variant="danger" onClick={stop}>
              Parar
            </Button>
          )
        }
      />

      {error && (
        <div className="rounded-xl border border-red-700/50 bg-red-950/40 p-3 text-xs text-red-200">⚠ {error}</div>
      )}

      <Card>
        <SectionHeader
          title="Configuração"
          actions={
            <>
              <label className="flex items-center gap-2 text-xs">
                <span className="text-neutral-400">Intervalo</span>
                <select
                  value={intervalMs}
                  onChange={(e) => setIntervalMs(Number(e.target.value))}
                  className="bg-neutral-950 border border-neutral-700 rounded-md px-2 py-1"
                >
                  <option value={2000}>2s</option>
                  <option value={3000}>3s</option>
                  <option value={4000}>4s</option>
                  <option value={6000}>6s</option>
                  <option value={10000}>10s</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={autoInject}
                  onChange={(e) => setAutoInject(e.target.checked)}
                  className="accent-amber-500"
                />
                <span className="text-neutral-300">Auto-injetar</span>
              </label>
              {roi && (
                <Button size="sm" variant="ghost" onClick={() => setROI(null)}>
                  Limpar ROI
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => {
                  const v = videoRef.current;
                  if (!v) return;
                  const img = captureFrameImageData(v, 0.5);
                  if (!img) {
                    setError("Sem frame para analisar");
                    return;
                  }
                  const detected = detectHistoryStrip(img);
                  if (!detected) {
                    setError("Não consegui detectar área de histórico");
                    return;
                  }
                  setROI(detected);
                  setError(null);
                }}
                disabled={!streaming}
                title="Tenta encontrar a tira de histórico automaticamente"
              >
                ✨ Auto-detectar ROI
              </Button>
              <Button size="sm" variant="success" onClick={captureAndOCR} disabled={!streaming || !roi || busy}>
                {busy ? "Lendo…" : "Capturar agora"}
              </Button>
            </>
          }
        />

        <div
          ref={overlayRef}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          className="relative bg-black rounded-xl overflow-hidden border border-neutral-700"
          style={{ minHeight: 280, cursor: streaming ? "crosshair" : "default" }}
        >
          <video ref={videoRef} className="w-full h-auto block" muted playsInline />
          {!streaming && (
            <div className="absolute inset-0 flex items-center justify-center bg-neutral-950/80 pointer-events-none">
              <div className="text-center">
                <div className="text-4xl mb-2">🖥️</div>
                <p className="text-sm text-neutral-300">Clique em "Iniciar captura" para compartilhar tela</p>
                <p className="text-[10px] text-neutral-500 mt-2 max-w-md mx-auto">
                  O navegador vai pedir qual aba/janela compartilhar. Escolha a janela do navegador onde está a roleta.
                </p>
              </div>
            </div>
          )}
          {roi && (
            <div
              className="absolute border-2 border-amber-400 bg-amber-400/10 pointer-events-none"
              style={roiStyle}
            >
              <div className="absolute -top-5 left-0 text-[10px] text-amber-300 bg-neutral-900/80 px-1 rounded">
                ROI {(roi.w * 100).toFixed(0)}×{(roi.h * 100).toFixed(0)}%
              </div>
            </div>
          )}
        </div>
        <p className="text-[10px] text-neutral-500 mt-2">
          Após iniciar, arraste sobre a tira de histórico do casino para desenhar a área de leitura. Quanto mais
          apertado o retângulo, melhor a precisão do OCR.
        </p>
        <canvas ref={canvasRef} className="hidden" />
      </Card>

      <Card padding="sm">
        <SectionHeader title="Log de leituras" />
        {logs.length === 0 ? (
          <EmptyState
            icon="📋"
            title="Nada capturado ainda"
            description="Inicie o stream, desenhe um ROI, e clique em 'Capturar agora' ou aguarde o intervalo automático."
          />
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {logs.map((l, i) => (
              <div key={i} className="rounded-lg border border-neutral-800 bg-neutral-950/50 p-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono text-neutral-500">{new Date(l.t).toLocaleTimeString("pt-BR")}</span>
                  <span className="text-[10px] text-neutral-400">{l.nums.length} número(s)</span>
                </div>
                <div className="text-[11px] font-mono text-neutral-300 truncate">{l.raw || "(vazio)"}</div>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {l.nums.map((n, j) => (
                    <span
                      key={j}
                      className="bg-amber-500 text-black text-[10px] font-bold w-5 h-5 rounded-sm flex items-center justify-center"
                    >
                      {n}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </PageContainer>
  );
});
Captura.displayName = "Captura";

export default Captura;
