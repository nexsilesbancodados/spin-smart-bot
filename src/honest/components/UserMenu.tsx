import { memo, useState } from "react";
import { signOut, useAuth } from "../lib/auth";

const UserMenu = memo(() => {
  const user = useAuth((s) => s.user);
  const [open, setOpen] = useState(false);

  if (!user) return null;

  const initial = (user.email ?? "?").charAt(0).toUpperCase();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 px-1.5 py-1 rounded-md bg-neutral-800 hover:bg-neutral-700 text-xs"
        title={user.email ?? "Usuário"}
      >
        <span className="w-5 h-5 rounded-full bg-amber-500 text-black flex items-center justify-center text-[10px] font-black">
          {initial}
        </span>
        <span className="text-[10px] text-neutral-400 hidden sm:inline">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 min-w-[200px] bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl p-2 z-50">
          <div className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold mb-0.5">
            Logado como
          </div>
          <div className="text-[11px] text-neutral-200 truncate mb-2 font-mono">
            {user.email}
          </div>
          <button
            onClick={async () => {
              await signOut();
              setOpen(false);
            }}
            className="w-full text-left px-2 py-1 rounded text-xs text-red-300 hover:bg-red-950/40"
          >
            🚪 Sair
          </button>
        </div>
      )}
    </div>
  );
});
UserMenu.displayName = "UserMenu";

export default UserMenu;
