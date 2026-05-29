import { memo } from "react";
import { useHonestStore } from "../lib/store";

const OPTIONS: Array<{ value: 20 | 50 | 100 | 500; label: string }> = [
  { value: 20, label: "20" },
  { value: 50, label: "50" },
  { value: 100, label: "100" },
  { value: 500, label: "500" },
];

const WindowPicker = memo(() => {
  const windowSize = useHonestStore((s) => s.windowSize);
  const setWindow = useHonestStore((s) => s.setWindow);
  return (
    <div className="inline-flex rounded-md border border-neutral-700 overflow-hidden" role="group" aria-label="Janela de análise">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => setWindow(opt.value)}
          className={`px-3 py-1.5 text-xs font-semibold transition ${
            windowSize === opt.value ? "bg-amber-500 text-black" : "bg-neutral-900 text-neutral-300 hover:bg-neutral-800"
          }`}
          aria-pressed={windowSize === opt.value}
        >
          {opt.label} giros
        </button>
      ))}
    </div>
  );
});
WindowPicker.displayName = "WindowPicker";
export default WindowPicker;
