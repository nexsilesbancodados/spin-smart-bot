import { memo } from "react";
import { colorOf } from "../lib/wheel";

const colorClass = (n: number) => {
  const c = colorOf(n);
  if (c === "green") return "bg-emerald-700 hover:bg-emerald-600 border-emerald-500/40";
  if (c === "red") return "bg-red-700 hover:bg-red-600 border-red-500/40";
  return "bg-neutral-800 hover:bg-neutral-700 border-neutral-600/40";
};

const NumberKeypad = memo(({ onPick }: { onPick: (n: number) => void }) => (
  <div className="grid grid-cols-10 gap-1.5" role="group" aria-label="Teclado de números 0 a 36">
    {Array.from({ length: 37 }, (_, n) => (
      <button
        key={n}
        type="button"
        onClick={() => onPick(n)}
        className={`aspect-square rounded-md text-sm font-bold text-white border transition active:scale-95 ${colorClass(n)}`}
        aria-label={`Registrar número ${n}`}
      >
        {n}
      </button>
    ))}
  </div>
));
NumberKeypad.displayName = "NumberKeypad";
export default NumberKeypad;
