import { SLOTS, sectorOf, colorOf, VOISINS, TIERS, ORPHELINS } from "./wheel";

export interface DealerDriftReport {
  spinsAnalyzed: number;
  windowSize: number;
  metrics: Array<{
    name: string;
    earlier: number;
    recent: number;
    z: number;
    direction: "up" | "down" | "stable";
  }>;
  alertLevel: "ok" | "watch" | "alert";
  message: string;
}

const ratioInGroup = (spins: number[], members: Set<number>): number => {
  if (spins.length === 0) return 0;
  let c = 0;
  for (const n of spins) if (members.has(n)) c += 1;
  return c / spins.length;
};

const sd = (n: number, p: number): number => Math.sqrt(Math.max(1e-9, (p * (1 - p)) / n));

export const detectDealerChange = (spins: number[], windowSize = 30): DealerDriftReport => {
  if (spins.length < windowSize * 2) {
    return {
      spinsAnalyzed: spins.length,
      windowSize,
      metrics: [],
      alertLevel: "ok",
      message: `Aguardando mais giros (${spins.length}/${windowSize * 2}) para comparar janelas.`,
    };
  }
  const recent = spins.slice(0, windowSize);
  const earlier = spins.slice(windowSize, windowSize * 2);

  const make = (name: string, members: Set<number>) => {
    const rE = ratioInGroup(earlier, members);
    const rR = ratioInGroup(recent, members);
    const pPooled = (rE * windowSize + rR * windowSize) / (windowSize * 2);
    const stderr = sd(windowSize, pPooled) * Math.SQRT2;
    const z = stderr > 0 ? (rR - rE) / stderr : 0;
    const dir = Math.abs(z) < 0.4 ? "stable" : z > 0 ? "up" : "down";
    return { name, earlier: rE, recent: rR, z, direction: dir as "up" | "down" | "stable" };
  };

  const colorRed = new Set<number>();
  const colorBlack = new Set<number>();
  for (let n = 0; n < SLOTS; n++) {
    if (colorOf(n) === "red") colorRed.add(n);
    else if (colorOf(n) === "black") colorBlack.add(n);
  }

  const metrics = [
    make("Voisins", VOISINS),
    make("Tiers", TIERS),
    make("Orphelins", ORPHELINS),
    make("Vermelho", colorRed),
    make("Preto", colorBlack),
    make("Par", new Set(Array.from({ length: SLOTS }, (_, i) => i).filter((n) => n !== 0 && n % 2 === 0))),
    make("Baixo (1-18)", new Set(Array.from({ length: 18 }, (_, i) => i + 1))),
  ];

  const maxZ = Math.max(...metrics.map((m) => Math.abs(m.z)));
  let alertLevel: DealerDriftReport["alertLevel"] = "ok";
  let message = "Distribuições nas duas janelas similares — sem drift detectado.";
  if (maxZ >= 2.5) {
    alertLevel = "alert";
    message = `Mudança significativa entre as últimas duas janelas de ${windowSize} giros (|z|=${maxZ.toFixed(1)}). Pode indicar troca de dealer, mudança de mesa ou simplesmente variância forte.`;
  } else if (maxZ >= 1.8) {
    alertLevel = "watch";
    message = `Drift moderado entre janelas (|z|=${maxZ.toFixed(1)}). Observe a próxima dezena de giros.`;
  }
  return { spinsAnalyzed: spins.length, windowSize, metrics, alertLevel, message };
};

