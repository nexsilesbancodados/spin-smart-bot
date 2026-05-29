import { memo, useEffect, useState } from "react";
import { colorOf, VOISINS, TIERS, ORPHELINS } from "../lib/wheel";
import { Card, PageContainer, PageHeader, Button, EmptyState } from "../components/ui";

interface MesaConfig {
  id: string;
  name: string;
  url: string;
  intervalMs: number;
  enabled: boolean;
}

interface MesaState {
  numbers: number[];
  lastUpdate: number | null;
  totalPolls: number;
  error: string | null;
}

const STORAGE_KEY = "rv-multi-mesa-v1";

const loadConfigs = (): MesaConfig[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as MesaConfig[];
  } catch {
    /* noop */
  }
  return [
    {
      id: "principal",
      name: "Roleta Brasileira",
      url: "https://www.iamonstro.com.br/apicurso/roleta.php",
      intervalMs: 4000,
      enabled: true,
    },
  ];
};

const ballBg = (n: number) => {
  const c = colorOf(n);
  if (c === "green") return "bg-emerald-600";
  if (c === "red") return "bg-red-600";
  return "bg-neutral-900";
};

const fetchMesa = async (url: string): Promise<number[]> => {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const arr = data.results || data.numbers || [];
    if (!Array.isArray(arr)) return [];
    return arr
      .map((v: unknown) => (typeof v === "string" ? parseInt(v, 10) : (v as number)))
      .filter((n: number) => typeof n === "number" && !isNaN(n) && n >= 0 && n <= 36);
  } finally {
    clearTimeout(t);
  }
};

const MultiMesa = memo(() => {
  const [configs, setConfigs] = useState<MesaConfig[]>(loadConfigs);
  const [states, setStates] = useState<Record<string, MesaState>>({});
  const [editing, setEditing] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
  }, [configs]);

  useEffect(() => {
    const timers: Record<string, ReturnType<typeof setInterval>> = {};
    for (const c of configs) {
      if (!c.enabled) continue;
      const tick = async () => {
        try {
          const nums = await fetchMesa(c.url);
          setStates((prev) => ({
            ...prev,
            [c.id]: {
              numbers: nums.slice(0, 50),
              lastUpdate: Date.now(),
              totalPolls: (prev[c.id]?.totalPolls ?? 0) + 1,
              error: null,
            },
          }));
        } catch (e) {
          setStates((prev) => ({
            ...prev,
            [c.id]: {
              numbers: prev[c.id]?.numbers ?? [],
              lastUpdate: prev[c.id]?.lastUpdate ?? null,
              totalPolls: (prev[c.id]?.totalPolls ?? 0) + 1,
              error: e instanceof Error ? e.message : String(e),
            },
          }));
        }
      };
      tick();
      timers[c.id] = setInterval(tick, c.intervalMs);
    }
    return () => {
      for (const id of Object.keys(timers)) clearInterval(timers[id]);
    };
  }, [configs]);

  const addMesa = () => {
    setConfigs((prev) => [
      ...prev,
      {
        id: `m_${Date.now()}`,
        name: "Nova mesa",
        url: "",
        intervalMs: 5000,
        enabled: false,
      },
    ]);
  };

  const update = (id: string, patch: Partial<MesaConfig>) =>
    setConfigs((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const remove = (id: string) => {
    setConfigs((prev) => prev.filter((c) => c.id !== id));
    setStates((prev) => {
      const { [id]: _removed, ...rest } = prev;
      void _removed;
      return rest;
    });
  };

  return (
    <PageContainer>
      <PageHeader
        title="Multi-mesa"
        subtitle="Acompanhe várias roletas em paralelo. Cada mesa tem URL + intervalo configuráveis."
        actions={<Button variant="primary" onClick={addMesa}>+ Adicionar mesa</Button>}
      />

      {configs.length === 0 ? (
        <EmptyState
          icon="📡"
          title="Nenhuma mesa configurada"
          description="Adicione URLs que retornam JSON com { results: [números] } para monitorar múltiplas roletas simultaneamente."
          action={<Button variant="primary" onClick={addMesa}>+ Adicionar mesa</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {configs.map((c) => {
            const st = states[c.id];
            return (
              <MesaCard
                key={c.id}
                cfg={c}
                state={st}
                isEditing={editing === c.id}
                onToggleEdit={() => setEditing(editing === c.id ? null : c.id)}
                onUpdate={(patch) => update(c.id, patch)}
                onRemove={() => remove(c.id)}
              />
            );
          })}
        </div>
      )}
    </PageContainer>
  );
});
MultiMesa.displayName = "MultiMesa";

interface MesaCardProps {
  cfg: MesaConfig;
  state: MesaState | undefined;
  isEditing: boolean;
  onToggleEdit: () => void;
  onUpdate: (patch: Partial<MesaConfig>) => void;
  onRemove: () => void;
}

const MesaCard = memo(({ cfg, state, isEditing, onToggleEdit, onUpdate, onRemove }: MesaCardProps) => {
  const nums = state?.numbers ?? [];
  const dist = {
    voisins: nums.filter((n) => VOISINS.has(n)).length,
    tiers: nums.filter((n) => TIERS.has(n)).length,
    orphelins: nums.filter((n) => ORPHELINS.has(n)).length,
  };
  const total = nums.length || 1;
  const ago = state?.lastUpdate ? Math.floor((Date.now() - state.lastUpdate) / 1000) : null;

  return (
    <Card padding="sm">
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span
            className={`w-2 h-2 rounded-full ${
              cfg.enabled
                ? state?.error
                  ? "bg-red-500"
                  : ago !== null && ago < 30
                    ? "bg-emerald-400 animate-pulse"
                    : "bg-amber-400"
                : "bg-neutral-600"
            }`}
          />
          {isEditing ? (
            <input
              value={cfg.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              className="flex-1 min-w-0 bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-sm font-bold"
            />
          ) : (
            <span className="font-bold text-sm truncate">{cfg.name}</span>
          )}
          <span className="text-[10px] text-neutral-500 font-mono shrink-0">#{state?.totalPolls ?? 0}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <label className="flex items-center gap-1 cursor-pointer text-[10px]">
            <input
              type="checkbox"
              checked={cfg.enabled}
              onChange={(e) => onUpdate({ enabled: e.target.checked })}
              className="accent-amber-500"
            />
            on
          </label>
          <Button size="sm" variant="ghost" onClick={onToggleEdit}>
            {isEditing ? "ok" : "edit"}
          </Button>
          <Button size="sm" variant="danger" onClick={onRemove}>
            ✕
          </Button>
        </div>
      </div>

      {isEditing && (
        <div className="space-y-1.5 mb-2 text-xs">
          <input
            value={cfg.url}
            onChange={(e) => onUpdate({ url: e.target.value })}
            placeholder="https://… (JSON com results: [...])"
            className="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 font-mono text-[11px]"
          />
          <label className="flex items-center gap-2">
            <span className="text-neutral-400 text-[10px]">Intervalo</span>
            <select
              value={cfg.intervalMs}
              onChange={(e) => onUpdate({ intervalMs: Number(e.target.value) })}
              className="bg-neutral-950 border border-neutral-700 rounded px-1.5 py-0.5 text-[11px]"
            >
              <option value={3000}>3s</option>
              <option value={5000}>5s</option>
              <option value={10000}>10s</option>
              <option value={30000}>30s</option>
            </select>
          </label>
        </div>
      )}

      {state?.error && (
        <div className="text-[10px] text-red-300 font-mono mb-2 truncate">⚠ {state.error}</div>
      )}

      {nums.length > 0 ? (
        <>
          <div className="grid grid-cols-10 gap-0.5 mb-2">
            {nums.slice(0, 30).map((n, i) => (
              <div
                key={i}
                className={`${ballBg(n)} text-white text-[10px] font-bold h-6 rounded-sm flex items-center justify-center ${
                  i === 0 ? "ring-1 ring-amber-400" : ""
                }`}
              >
                {n}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-1 text-[10px]">
            <SectorBar label="Voisins" pct={(dist.voisins / total) * 100} expected={(17 / 37) * 100} />
            <SectorBar label="Tiers" pct={(dist.tiers / total) * 100} expected={(12 / 37) * 100} />
            <SectorBar label="Orphelins" pct={(dist.orphelins / total) * 100} expected={(8 / 37) * 100} />
          </div>
        </>
      ) : (
        <div className="text-center text-xs text-neutral-500 py-6">
          {cfg.enabled ? "Aguardando primeiro poll…" : "Mesa desativada"}
        </div>
      )}
    </Card>
  );
});
MesaCard.displayName = "MesaCard";

const SectorBar = memo(({ label, pct, expected }: { label: string; pct: number; expected: number }) => {
  const ratio = expected > 0 ? pct / expected : 1;
  const accent = ratio > 1.3 ? "bg-amber-500" : ratio < 0.7 ? "bg-sky-500" : "bg-neutral-500";
  return (
    <div className="rounded border border-neutral-700 bg-neutral-950/60 p-1.5">
      <div className="text-[9px] text-neutral-400 mb-0.5">{label}</div>
      <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
        <div className={`h-1.5 ${accent}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <div className="text-[9px] font-mono mt-0.5 text-neutral-300">
        {pct.toFixed(0)}% / esp {expected.toFixed(0)}%
      </div>
    </div>
  );
});
SectorBar.displayName = "MultiMesaSectorBar";

export default MultiMesa;
