import { memo, useState } from "react";
import { useAnnotations, type Annotation } from "../lib/annotations";
import { colorOf } from "../lib/wheel";
import { Button, Pill } from "./ui";

const ballBg = (n: number) => {
  const c = colorOf(n);
  if (c === "green") return "bg-emerald-600";
  if (c === "red") return "bg-red-600";
  return "bg-neutral-800";
};

const TAGS: Array<{ id: NonNullable<Annotation["tag"]>; label: string; emoji: string }> = [
  { id: "dealer-change", label: "Trocou dealer", emoji: "🎭" },
  { id: "lost-feed", label: "Feed caiu", emoji: "📡" },
  { id: "bet-placed", label: "Apostei aqui", emoji: "💰" },
  { id: "stop-recommended", label: "Deveria parar", emoji: "🛑" },
  { id: "note", label: "Nota geral", emoji: "📝" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  spin: { n: number; t: number } | null;
}

const AnnotationDialog = memo(({ open, onClose, spin }: Props) => {
  const annotations = useAnnotations((s) => s.annotations);
  const add = useAnnotations((s) => s.add);
  const remove = useAnnotations((s) => s.remove);
  const [text, setText] = useState("");
  const [tag, setTag] = useState<NonNullable<Annotation["tag"]>>("note");

  if (!open || !spin) return null;

  const forThisSpin = annotations.filter((a) => Math.abs(a.spinTimestamp - spin.t) < 30_000);

  const save = () => {
    if (!text.trim() && tag === "note") return;
    add({ spinTimestamp: spin.t, text: text.trim() || TAGS.find((t) => t.id === tag)?.label || "", tag });
    setText("");
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl max-w-md w-full p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className={`${ballBg(spin.n)} text-white text-2xl font-bold w-14 h-14 rounded-xl flex items-center justify-center`}>
            {spin.n}
          </div>
          <div>
            <h3 className="text-base font-bold">Anotação</h3>
            <p className="text-xs text-neutral-400 font-mono">{new Date(spin.t).toLocaleString("pt-BR")}</p>
          </div>
          <button onClick={onClose} className="ml-auto text-neutral-500 hover:text-neutral-200 text-xl">✕</button>
        </div>

        {forThisSpin.length > 0 && (
          <div className="mb-4 space-y-1.5">
            <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold">Anotações existentes</div>
            {forThisSpin.map((a) => (
              <div key={a.id} className="flex items-start gap-2 rounded-lg border border-neutral-800 bg-neutral-950/50 p-2">
                <span className="text-sm shrink-0">{TAGS.find((t) => t.id === a.tag)?.emoji ?? "📝"}</span>
                <span className="text-xs flex-1 leading-relaxed">{a.text}</span>
                <button onClick={() => remove(a.id)} className="text-[10px] text-red-400 hover:text-red-300">✕</button>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold block mb-1.5">Tag</label>
            <div className="flex flex-wrap gap-1.5">
              {TAGS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTag(t.id)}
                  className={`text-xs px-2 py-1 rounded-md border transition ${
                    tag === t.id
                      ? "bg-amber-500 text-black border-amber-500"
                      : "bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-700"
                  }`}
                >
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold block mb-1.5">Nota (opcional)</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              placeholder="WiFi caiu, mudou voz do dealer, decidi parar…"
              className="w-full bg-neutral-950 border border-neutral-700 rounded-lg p-2 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button variant="primary" onClick={save}>Salvar</Button>
          </div>
        </div>
      </div>
    </div>
  );
});
AnnotationDialog.displayName = "AnnotationDialog";

export const useAnnotationCountForSpin = (spinTimestamp: number): number => {
  const annotations = useAnnotations((s) => s.annotations);
  return annotations.filter((a) => Math.abs(a.spinTimestamp - spinTimestamp) < 30_000).length;
};

void Pill;
export default AnnotationDialog;
