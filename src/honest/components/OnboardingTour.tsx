import { memo, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const STORAGE_KEY = "rv-onboarding-done-v1";

interface Step {
  title: string;
  body: string;
  route?: string;
}

const steps: Step[] = [
  {
    title: "Bem-vindo ao Roleta Vision AI",
    body: "Tour rápido pelas 16 páginas. Você pode pular a qualquer momento (clique fora ou ESC).",
  },
  {
    title: "Dashboard",
    body: "Painel principal. Mesa ativa + 30 últimos giros + distribuição de setores + agente de sinais + alertas.",
    route: "/",
  },
  {
    title: "Jogar",
    body: "Iframe da casa de apostas com painel de análise lateral. Se a casa bloquear o embed, abre em nova aba.",
    route: "/jogar",
  },
  {
    title: "Sinais",
    body: "Histórico completo dos sinais do agente com hit rate, calibração e configuração avançada.",
    route: "/sinais",
  },
  {
    title: "Filtros",
    body: "Filtro probabilístico — 13 condições configuráveis. Bots sérios não acertam mais, eles entram menos.",
    route: "/filtros",
  },
  {
    title: "Backtester",
    body: "Roda 8 estratégias no histórico. Leaderboard mostra qual converge mais perto/longe da borda esperada.",
    route: "/backtest",
  },
  {
    title: "Captura OCR",
    body: "Compartilha a tela do casino, desenha ROI, Tesseract.js extrai números e injeta no feed.",
    route: "/captura",
  },
  {
    title: "Padrões",
    body: "13 painéis de agrupamentos clássicos com z-score: setores, dúzias, terminais, vizinhos, arcos, junto/separado, quente/frio, streaks.",
    route: "/padroes",
  },
  {
    title: "Regras",
    body: 'Crie regras "X consecutivos → próximo deve ser Y". O app mede no histórico real e mostra z-score.',
    route: "/regras",
  },
  {
    title: "Multi-mesa",
    body: "Acompanhe várias roletas simultaneamente, cada uma com URL e intervalo próprios.",
    route: "/multi",
  },
  {
    title: "Banca",
    body: "Configuração de stake, stop loss, meta, máx. rodadas + simulação Monte Carlo da banca contra a casa.",
    route: "/banca",
  },
  {
    title: "Rede de Aprendizado",
    body: "Grafo de conhecimento + memória Markov + falsificador estatístico (real vs embaralhado vs ruído).",
    route: "/rede",
  },
  {
    title: "Análise",
    body: "Setores, dúzias, colunas, cores, terminais com z-score e qui-quadrado de uniformidade.",
    route: "/analise",
  },
  {
    title: "Mapa da roda",
    body: "Sequência física europeia com calor por casa na janela selecionada.",
    route: "/roda",
  },
  {
    title: "Diário",
    body: "Histórico permanente das sessões + medidor de borda EV + export CSV.",
    route: "/diario",
  },
  {
    title: "Configuração",
    body: "Hub centralizado de todos os settings: notificações, polling, agente, filtro, webhook, backup, tema.",
    route: "/config",
  },
  {
    title: "Atalhos",
    body: "Ctrl+1..9 navega rotas, R refresh, Espaço pausa agente, P pausa polling, ? ajuda. Pronto pra usar.",
  },
];

const OnboardingTour = memo(() => {
  const navigate = useNavigate();
  const [idx, setIdx] = useState(0);
  const [open, setOpen] = useState(() => !localStorage.getItem(STORAGE_KEY));

  useEffect(() => {
    if (!open) return;
    const cur = steps[idx];
    if (cur.route) navigate(cur.route);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight" || e.key === "Enter") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx, open, navigate]);

  const finish = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  };
  const next = () => {
    if (idx + 1 >= steps.length) finish();
    else setIdx(idx + 1);
  };
  const prev = () => {
    if (idx > 0) setIdx(idx - 1);
  };

  if (!open) return null;
  const cur = steps[idx];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={finish}
    >
      <div
        className="bg-neutral-900 border border-amber-500/40 rounded-2xl shadow-2xl max-w-md w-[calc(100%-2rem)] m-4 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] uppercase tracking-wider text-amber-400 font-bold">
            Passo {idx + 1} de {steps.length}
          </span>
          <button onClick={finish} className="text-neutral-500 hover:text-neutral-200 text-sm">
            Pular ✕
          </button>
        </div>
        <h2 className="text-xl font-bold mb-2">{cur.title}</h2>
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
    </div>
  );
});
OnboardingTour.displayName = "OnboardingTour";
export default OnboardingTour;
