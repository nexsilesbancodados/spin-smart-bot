import { memo, useMemo, useState } from "react";
import { useHonestStore } from "../lib/store";
import { colorOf, SLOTS } from "../lib/wheel";
import { Card, SectionHeader } from "./ui";

type Sort = "z" | "count" | "number";

interface NumStat {
  n: number;
  count: number;
  expected: number;
  z: number;
  lastIdx: number | null;
}

const NumberFrequency = memo(() => {
  const spins = useHonestStore((s) => s.spins);
  const windowSize = useHonestStore((s) => s.windowSize);
  const [sort, setSort] = useState<Sort>("z");
  const [limit, setLimit] = useState<number>(50);

  const recent = useMemo(() => spins.slice(0, limit), [spins, limit]);

  const stats = useMemo(() => {
    const counts = new Array(37).fill(0);
    const lastSeen = new Array(37).fill(-1);
    recent.forEach((s, i) => {
      counts[s.n]++;
      if (lastSeen[s.n] === -1) lastSeen[s.n] = i;
    });
    const expected = recent.length / 37;
    const p = 1 / SLOTS;
    const variance = recent.length * p * (1 - p);
    const stddev = Math.sqrt(Math.max(0.001, variance));
    const out: NumStat[] = [];
    for (let n = 0; n < 37; n++) {
      out.push({
        n,
        count: counts[n],
        expected,
        z: stddev > 0 ? (counts[n] - expected) / stddev : 0,
        lastIdx: lastSeen[n] >= 0 ? lastSeen[n] : null,
      });
    }
    return out;
  }, [recent]);

  const sorted = useMemo(() => {
    const copy = [...stats];
    if (sort === "z") copy.sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
    else if (sort === "count") copy.sort((a, b) => b.count - a.count);
    return copy;
  }, [stats, sort]);

  const cellColor = (n: NumStat) => {
    if (Math.abs(n.z) < 1) return "border-neutral-700 bg-neutral-900/50";
    if (n.z > 2) return "border-amber-500/70 bg-amber-950/40";
    if (n.z > 1) return "border-amber-700/40 bg-amber-950/20";
    if (n.z < -1.5) return "border-sky-700/40 bg-sky-950/30";
    return "border-neutral-700 bg-neutral-900/50";
  };

  const ballBg = (num: number) => {
    const c = colorOf(num);
    if (c === "green") return "text-emerald-300";
    if (c === "red") return "text-red-300";
    return "text-neutral-200";
  };

  return (
    <Card padding="sm">
      <SectionHeader
        title="Frequência por número"
        eyebrow="Ferramenta"
        subtitle={
          <span className="text-[10px] text-neutral-500">
            z-score em {recent.length} giros · esperado {(recent.length / 37).toFixed(1)}× cada
          </span>
        }
        actions={
          <div className="flex items-center gap-1">
            {([
              { id: "z" as const, label: "z" },
              { id: "count" as const, label: "n" },
              { id: "number" as const, label: "#" },
            ]).map((opt) => (
              <button
                key={opt.id}
                onClick={() => setSort(opt.id)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  sort === opt.id ? "bg-amber-500 text-black" : "bg-neutral-800 text-neutral-400"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="flex items-center gap-1 mb-2">
        {[30, 50, 100, 200].map((v) => (
          <button
            key={v}
            onClick={() => setLimit(v)}
            disabled={spins.length < v && v !== 30}
            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              limit === v
                ? "bg-cyan-600 text-white"
                : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
            } disabled:opacity-40`}
          >
            últimos {v}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-7 sm:grid-cols-10 gap-1">
        {sorted.map((s) => (
          <div
            key={s.n}
            className={`border rounded p-1 text-center transition ${cellColor(s)}`}
            title={`${s.n}: ${s.count} vezes (esperado ${s.expected.toFixed(1)}, z=${s.z.toFixed(2)}) · último há ${s.lastIdx === null ? "—" : s.lastIdx} giros`}
          >
            <div className={`text-[12px] font-black ${ballBg(s.n)} leading-none`}>{s.n}</div>
            <div className="text-[8px] text-neutral-500 font-mono leading-tight">
              {s.count}×
            </div>
            <div
              className={`text-[9px] font-mono font-bold leading-tight ${
                Math.abs(s.z) < 1 ? "text-neutral-600" : s.z > 0 ? "text-amber-400" : "text-sky-400"
              }`}
            >
              {s.z >= 0 ? "+" : ""}
              {s.z.toFixed(1)}
            </div>
          </div>
        ))}
      </div>

      <div className="text-[9px] text-neutral-600 italic mt-2 text-center">
        |z| &lt; 1 dentro do esperado · &gt; 2 desvio incomum · não é previsão
      </div>
    </Card>
  );
});
NumberFrequency.displayName = "NumberFrequency";

export default NumberFrequency;
