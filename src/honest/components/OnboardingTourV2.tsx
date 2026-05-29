import { memo, useEffect, useLayoutEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

const STORAGE_KEY = "rv-onboarding-v2-done";

interface Step {
  selector?: string;
  route?: string;
  title: string;
  body: string;
  position?: "top" | "bottom" | "left" | "right" | "center";
}

const steps: Step[] = [
  { title: "Tour rápido", body: "16 rotas, agente de IA + filtro probabilístico, captura OCR, replay, correlações. ESC pula a qualquer momento.", position: "center" },
  { route: "/", selector: "[data-tour='live-summary']", title: "Mesa ao vivo", body: "Roleta Brasileira via API direta. Os 30 mais recentes + distribuição de setores/cores/dúzias com observado vs esperado.", position: "bottom" },
  { route: "/", selector: "[data-tour='signal-panel']", title: "Agente de Sinais", body: "Ensemble 6 modelos + LSTM. Mostra pick principal, top 5, raciocínio, status do filtro. Botão de pausar à direita.", position: "bottom" },
  { route: "/", selector: "[data-tour='anomaly']", title: "Anomalias", body: "Banner que aparece automaticamente quando χ², concentração ou drift de dealer disparam.", position: "bottom" },
  { route: "/filtros", title: "Filtros", body: "13 condições probabilísticas. Quanto mais ativas, menos sinais — mas idealmente com hit rate mais alto.", position: "center" },
  { route: "/correlacoes", title: "Correlações", body: "Matriz 37×37 de transições A→B + heatmap por hora do dia.", position: "center" },
  { route: "/replay", title: "Replay", body: "Roda histórico passado em 0,5×–20× pra treinar/auditar. Pausa polling enquanto roda.", position: "center" },
  { route: "/estrategia", title: "Editor de Estratégia", body: "Crie estratégias com seleção customizada + gatilhos. Backteste no histórico.", position: "center" },
  { route: "/config", title: "Configuração", body: "Hub centralizado. Voz, notificações, polling, agente, webhook, backup, tema.", position: "center" },
  { title: "Atalhos", body: "Ctrl+1..9 navega · R refresh · Espaço pausa agente · P pausa polling · ? esta ajuda", position: "center" },
];

const OnboardingTourV2 = memo(() => {
  const navigate = useNavigate();
  const location = useLocation();
  const [idx, setIdx] = useState(0);
  const [open, setOpen] = useState(() => !localStorage.getItem(STORAGE_KEY));
  const [rect, setRect] = useState<DOMRect | null>(null);

  const cur = steps[idx];

  useEffect(() => {
    if (!open) return;
    if (cur.route && location.pathname !== cur.route) {
      navigate(cur.route);
    }
  }, [idx, open, cur.route, location.pathname, navigate]);

  useLayoutEffect(() => {
    if (!open) return;
    if (!cur.selector) {
      setRect(null);
      return;
    }
    let raf = 0;
    const measure = () => {
      const el = document.querySelector(cur.selector!);
      if (!el) {
        raf = requestAnimationFrame(measure);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect(r);
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    };
    raf = requestAnimationFrame(measure);
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [idx, open, cur.selector, location.pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight" || e.key === "Enter") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, idx]);

  const finish = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  };
  const next = () => {
    if (idx + 1 >= steps.length) finish();
    else setIdx(idx + 1);
  };
  const prev = () => idx > 0 && setIdx(idx - 1);

  if (!open) return null;

  const hasTarget = !!rect && !!cur.selector;
  const padding = 8;
  const spotlight = hasTarget && rect
    ? {
        left: Math.max(0, rect.left - padding),
        top: Math.max(0, rect.top - padding),
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
      }
    : null;

  const tooltipStyle: React.CSSProperties = (() => {
    if (!hasTarget || !rect) return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
    const tipW = 340;
    const tipH = 200;
    const margin = 16;
    let top = rect.bottom + margin;
    let left = rect.left + rect.width / 2 - tipW / 2;
    if (cur.position === "top") top = rect.top - tipH - margin;
    if (cur.position === "left") {
      top = rect.top;
      left = rect.left - tipW - margin;
    }
    if (cur.position === "right") {
      top = rect.top;
      left = rect.right + margin;
    }
    if (top + tipH > window.innerHeight) top = window.innerHeight - tipH - margin;
    if (top < margin) top = margin;
    if (left + tipW > window.innerWidth) left = window.innerWidth - tipW - margin;
    if (left < margin) left = margin;
    return { top, left };
  })();

  return (
    <>
      <div className="fixed inset-0 z-50 pointer-events-auto" onClick={finish}>
        {spotlight ? (
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            <defs>
              <mask id="spotlight-mask">
                <rect width="100%" height="100%" fill="white" />
                <rect
                  x={spotlight.left}
                  y={spotlight.top}
                  width={spotlight.width}
                  height={spotlight.height}
                  rx={12}
                  fill="black"
                />
              </mask>
            </defs>
            <rect width="100%" height="100%" fill="rgba(0,0,0,0.7)" mask="url(#spotlight-mask)" />
            <rect
              x={spotlight.left}
              y={spotlight.top}
              width={spotlight.width}
              height={spotlight.height}
              rx={12}
              fill="none"
              stroke="#fbbf24"
              strokeWidth={2}
              className="animate-pulse"
            />
          </svg>
        ) : (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
        )}
      </div>

      <div
        className="fixed z-[60] w-[340px] bg-neutral-900 border border-amber-500/40 rounded-2xl shadow-2xl p-5 pointer-events-auto"
        style={tooltipStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-wider text-amber-400 font-bold">
            Passo {idx + 1} de {steps.length}
          </span>
          <button onClick={finish} className="text-neutral-500 hover:text-neutral-200 text-xs">
            Pular ✕
          </button>
        </div>
        <h2 className="text-lg font-bold mb-2">{cur.title}</h2>
        <p className="text-sm text-neutral-300 mb-4 leading-relaxed">{cur.body}</p>
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={prev}
            disabled={idx === 0}
            className="px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-300 disabled:opacity-30 text-sm"
          >
            ← Voltar
          </button>
          <div className="flex gap-1">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full ${i === idx ? "bg-amber-400" : "bg-neutral-700"}`}
              />
            ))}
          </div>
          <button
            onClick={next}
            className="px-4 py-1.5 rounded-lg bg-amber-400 text-neutral-950 font-bold text-sm hover:bg-amber-300"
          >
            {idx + 1 >= steps.length ? "Concluir" : "Próximo →"}
          </button>
        </div>
      </div>
    </>
  );
});
OnboardingTourV2.displayName = "OnboardingTourV2";
export default OnboardingTourV2;
