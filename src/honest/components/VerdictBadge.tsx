import { memo } from "react";
import type { Verdict } from "../lib/stats";

const styles: Record<Verdict, string> = {
  aleatorio: "bg-neutral-800 text-neutral-300 border-neutral-600/40",
  leve: "bg-amber-900/40 text-amber-200 border-amber-600/40",
  incomum: "bg-orange-900/40 text-orange-200 border-orange-600/40",
};

const labels: Record<Verdict, string> = {
  aleatorio: "Aleatório",
  leve: "Desvio leve",
  incomum: "Desvio incomum",
};

const VerdictBadge = memo(({ verdict }: { verdict: Verdict }) => (
  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${styles[verdict]}`}>
    {labels[verdict]}
  </span>
));
VerdictBadge.displayName = "VerdictBadge";
export default VerdictBadge;
