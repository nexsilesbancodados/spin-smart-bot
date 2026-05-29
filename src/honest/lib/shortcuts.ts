import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ingestProxyNumbers } from "./useLiveFeed";
import { useSignalAgent } from "./signalAgent";
import { useFeedStatus } from "./feedStatus";

const ROUTES = [
  "/",
  "/jogar",
  "/sinais",
  "/filtros",
  "/backtest",
  "/captura",
  "/roda",
  "/analise",
  "/padroes",
];

const isInputFocused = (): boolean => {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (el as HTMLElement).isContentEditable;
};

export const useShortcuts = () => {
  const navigate = useNavigate();
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isInputFocused()) return;
      if ((e.ctrlKey || e.metaKey) && e.key >= "1" && e.key <= "9") {
        const idx = parseInt(e.key, 10) - 1;
        if (ROUTES[idx]) {
          e.preventDefault();
          navigate(ROUTES[idx]);
        }
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      switch (e.key.toLowerCase()) {
        case "r":
          e.preventDefault();
          ingestProxyNumbers();
          break;
        case " ":
          e.preventDefault();
          useSignalAgent.getState().setConfig({ enabled: !useSignalAgent.getState().config.enabled });
          break;
        case "p":
          e.preventDefault();
          useFeedStatus.getState().setPollEnabled(!useFeedStatus.getState().pollEnabled);
          break;
        case "?":
          e.preventDefault();
          alert(
            "Atalhos:\nCtrl+1..9: navegar entre rotas\nR: forçar refresh do feed\nEspaço: ligar/pausar agente\nP: ligar/pausar polling\n?: esta ajuda"
          );
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);
};
