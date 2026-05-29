import { memo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSignalAgent } from "../lib/signalAgent";
import { useFeedStatus } from "../lib/feedStatus";
import { useHonestStore } from "../lib/store";
import { colorOf } from "../lib/wheel";
import { ingestProxyNumbers } from "../lib/useLiveFeed";

const ballBg = (n: number) => {
  const c = colorOf(n);
  if (c === "green") return "bg-emerald-600";
  if (c === "red") return "bg-red-600";
  return "bg-neutral-800";
};

const SignalFAB = memo(() => {
  const navigate = useNavigate();
  const location = useLocation();
  const latest = useSignalAgent((s) => s.latest);
  const enabled = useSignalAgent((s) => s.config.enabled);
  const setConfig = useSignalAgent((s) => s.setConfig);
  const pollEnabled = useFeedStatus((s) => s.pollEnabled);
  const setPollEnabled = useFeedStatus((s) => s.setPollEnabled);
  const lastSpin = useHonestStore((s) => s.spins[0]);
  const [open, setOpen] = useState(false);

  if (location.pathname === "/jogar") return null;

  return (
    <>
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
        {open && (
          <div
            className="bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl p-3 min-w-[240px] space-y-2"
            onMouseLeave={() => setOpen(false)}
          >
            {latest ? (
              <div className="flex items-center gap-2 pb-2 border-b border-neutral-800">
                <div className={`${ballBg(latest.mainPick)} text-white text-base font-bold w-9 h-9 rounded-md flex items-center justify-center ring-2 ring-amber-400`}>
                  {latest.mainPick}
                </div>
                <div className="text-xs leading-tight">
                  <div className="text-amber-300 font-mono">{(latest.mainProb * 100).toFixed(2)}%</div>
                  <div className="text-neutral-500 text-[10px]">{latest.sector} · {latest.color}</div>
                </div>
                <button onClick={() => navigate("/sinais")} className="ml-auto text-[10px] text-amber-300 hover:underline">
                  ver →
                </button>
              </div>
            ) : (
              <div className="text-xs text-neutral-500 pb-2 border-b border-neutral-800">Sem sinal ainda</div>
            )}
            {lastSpin && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-neutral-500">Último giro:</span>
                <div className={`${ballBg(lastSpin.n)} text-white text-[11px] font-bold w-6 h-6 rounded flex items-center justify-center`}>
                  {lastSpin.n}
                </div>
                <span className="text-neutral-400 font-mono text-[10px] ml-auto">
                  {new Date(lastSpin.t).toLocaleTimeString("pt-BR")}
                </span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-1.5 pt-1">
              <button
                onClick={() => setConfig({ enabled: !enabled })}
                className={`text-[11px] rounded-md px-2 py-1.5 ${enabled ? "bg-emerald-900/40 text-emerald-300 border border-emerald-700/40" : "bg-neutral-800 text-neutral-400 border border-neutral-700"}`}
              >
                {enabled ? "Agente ON" : "Agente OFF"}
              </button>
              <button
                onClick={() => setPollEnabled(!pollEnabled)}
                className={`text-[11px] rounded-md px-2 py-1.5 ${pollEnabled ? "bg-emerald-900/40 text-emerald-300 border border-emerald-700/40" : "bg-neutral-800 text-neutral-400 border border-neutral-700"}`}
              >
                {pollEnabled ? "Poll ON" : "Poll OFF"}
              </button>
              <button
                onClick={() => { ingestProxyNumbers(); }}
                className="text-[11px] rounded-md px-2 py-1.5 bg-amber-900/40 text-amber-300 border border-amber-700/40 col-span-2"
              >
                ↻ Forçar refresh
              </button>
            </div>
          </div>
        )}
        <button
          onClick={() => setOpen((v) => !v)}
          className={`w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110 ${
            latest ? `${ballBg(latest.mainPick)} ring-4 ring-amber-400/50` : "bg-neutral-800 border border-neutral-700"
          }`}
          title="Sinal ao vivo"
        >
          {latest ? (
            <span className="text-white text-xl font-bold">{latest.mainPick}</span>
          ) : (
            <span className="text-neutral-400 text-2xl">🎯</span>
          )}
        </button>
      </div>
    </>
  );
});
SignalFAB.displayName = "SignalFAB";
export default SignalFAB;
