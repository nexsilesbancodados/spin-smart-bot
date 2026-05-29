import { memo, useState } from "react";
import { useProfiles } from "../lib/profiles";
import { Button, Pill } from "./ui";

const ProfileSwitcher = memo(() => {
  const profiles = useProfiles((s) => s.profiles);
  const activeId = useProfiles((s) => s.activeId);
  const save = useProfiles((s) => s.save);
  const load = useProfiles((s) => s.load);
  const remove = useProfiles((s) => s.remove);
  const rename = useProfiles((s) => s.rename);
  const [name, setName] = useState("");

  const handleSave = () => {
    const n = name.trim() || `Perfil ${profiles.length + 1}`;
    save(n);
    setName("");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome do perfil (ex: 'Agressivo', 'Conservador')"
          className="flex-1 min-w-48 bg-neutral-950 border border-neutral-700 rounded-md px-3 py-1.5 text-sm"
        />
        <Button variant="primary" onClick={handleSave}>
          💾 Salvar atual como perfil
        </Button>
      </div>

      {profiles.length === 0 ? (
        <p className="text-xs text-neutral-500">Nenhum perfil salvo. Crie um snapshot da config atual acima.</p>
      ) : (
        <div className="space-y-1.5">
          {profiles.map((p) => (
            <div
              key={p.id}
              className={`flex items-center gap-3 rounded-lg border p-2.5 ${
                activeId === p.id ? "border-amber-500/50 bg-amber-500/5" : "border-neutral-700 bg-neutral-900/40"
              }`}
            >
              <input
                value={p.name}
                onChange={(e) => rename(p.id, e.target.value)}
                className="flex-1 bg-transparent text-sm font-semibold outline-none"
              />
              <span className="text-[10px] text-neutral-500 font-mono">
                {new Date(p.createdAt).toLocaleDateString("pt-BR")}
              </span>
              {activeId === p.id && <Pill accent="warn">ATIVO</Pill>}
              <Button size="sm" onClick={() => load(p.id)}>
                Carregar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => confirm(`Remover "${p.name}"?`) && remove(p.id)}>
                ✕
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
ProfileSwitcher.displayName = "ProfileSwitcher";
export default ProfileSwitcher;
