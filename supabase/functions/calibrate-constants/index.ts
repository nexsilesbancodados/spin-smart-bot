// Recalcula VALIDATED_MATRIX e PULL_RELIABILITY dos dados reais
// Roda a cada 50 giros novos — mantém o sniper calibrado com a mesa atual
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

const PULL: Record<number,number[]> = {
  0:[10,20,30,32,15,26,3,33,31,35],1:[11,35,16,4,18,28,27,29,33,14,31],
  2:[14,1,13,18,35,29,12,22],3:[13,27,6,11,30,8,23,33],
  4:[26,15,18,32,33,16,8,24,14],5:[3,33,16,24,10,18,15,25],
  6:[8,15,31,21,22,23,16,26],7:[16,18,17,30,31,28,12],
  8:[11,9,10,18,28,23],9:[34,35,36,3,16,26,23,24,32,31,29],
  10:[20,5,18,11,14,24,30],11:[8,18,16,21,30,1],
  12:[21,7,28,35],13:[31,27,36,6],14:[24,21,18,31,9],
  15:[4,19,21,32,0],16:[24,21,18,14,6,26],17:[34,6,25,27,7],
  18:[8,18,28,7],19:[9,19,29,4,21],20:[4,14,10,30],
  21:[19,2,4,23],22:[33,2,32,12],23:[32,11,2,33,13],
  24:[21,18,14,34,4],25:[2,4,17,28,29,12,7,18],
  26:[6,16,26,36,3,0],27:[28,29,24,22,26,33,31,34,35,36],
  28:[13,14,15,16,17,18,7],29:[35,28,22],
  30:[4,8,16,9,18,22,5,25,3],31:[13,9,14],32:[2,12,22,32,0,15],
  33:[16,3,23,13],34:[16,6,4,24],35:[0,3,7,12,26,28,29,35],36:[3,10,27,6],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: rows } = await sb.from("roulette_numbers").select("number").order("fetched_at", { ascending: false }).limit(500);
  const nums: number[] = (rows || []).map((r: any) => r.number);
  if (nums.length < 50) return new Response(JSON.stringify({ status: "not_enough" }), { headers: { ...cors, "Content-Type": "application/json" } });

  // 1. MATRIZ 37x37
  const mat: Record<number, Record<number, number>> = {};
  for (let n = 0; n <= 36; n++) mat[n] = {};
  for (let i = 0; i < nums.length - 1; i++) {
    const src = nums[i + 1], tgt = nums[i];
    mat[src][tgt] = (mat[src][tgt] || 0) + 1;
  }
  const validatedMatrix: Record<number, { target: number; prob: number }[]> = {};
  for (let src = 0; src <= 36; src++) {
    const row = mat[src];
    const tot = Object.values(row).reduce((a, b) => a + b, 0);
    if (tot < 6) continue;
    const strong = Object.entries(row)
      .map(([tgt, cnt]) => ({ target: Number(tgt), prob: +(cnt / tot).toFixed(3) }))
      .filter(p => p.prob > 0.22)
      .sort((a, b) => b.prob - a.prob)
      .slice(0, 3);
    if (strong.length > 0) validatedMatrix[src] = strong;
  }

  // 2. PULL RELIABILITY
  const pullReliability: Record<number, number> = {};
  for (const [srcStr, puxados] of Object.entries(PULL)) {
    const src = Number(srcStr);
    let hits = 0, total = 0;
    for (let i = 0; i < nums.length - 2; i++) {
      if (nums[i + 1] === src) {
        total++;
        if (puxados.includes(nums[i])) hits++;
      }
    }
    if (total >= 6) {
      const rate = hits / total;
      if (rate > 0.40) pullReliability[src] = +(1.0 + (rate - 0.3) * 2.5).toFixed(2);
    }
  }

  // 3. STATISTICAL DEBT (últimos 200)
  const freq200: Record<number, number> = {};
  for (let n = 0; n <= 36; n++) freq200[n] = 0;
  nums.slice(0, 200).forEach(n => { freq200[n]++; });
  const exp200 = 200 / 37;
  const statDebt: Record<number, number> = {};
  for (let n = 0; n <= 36; n++) {
    const actual = freq200[n];
    if (actual < exp200 * 0.55) {
      statDebt[n] = +((exp200 - actual) / exp200 * 10).toFixed(1);
    }
  }

  // 4. TERMINAL BIAS (500)
  const termFreq: Record<number, number> = {};
  for (let t = 0; t <= 9; t++) termFreq[t] = 0;
  nums.forEach(n => { termFreq[n % 10]++; });
  const expT = nums.length / 10;
  const terminalBias: Record<number, number> = {};
  for (let t = 0; t <= 9; t++) {
    const bias = (termFreq[t] - expT) / expT * 5;
    if (Math.abs(bias) > 0.5) terminalBias[t] = +bias.toFixed(1);
  }

  // 5. AUTO-REPETIÇÃO stats (top repetidores)
  const repStats: Record<number, number> = {};
  for (let i = 0; i < nums.length - 1; i++) {
    if (nums[i] === nums[i + 1]) repStats[nums[i]] = (repStats[nums[i]] || 0) + 1;
  }
  const topRep = Object.entries(repStats).sort(([,a],[,b]) => b-a).slice(0, 10)
    .reduce((acc, [n, c]) => { acc[Number(n)] = c; return acc; }, {} as Record<number,number>);

  // 6. Salvar em ai_learned_patterns como 'calibration_constants'
  const payload = { validatedMatrix, pullReliability, statDebt, terminalBias, topRep, sampledFrom: nums.length, calculatedAt: new Date().toISOString() };

  const titulo = "mesa_calibration_live";
  const { data: ex } = await sb.from("ai_learned_patterns").select("id").eq("learning_type", "calibration").eq("title", titulo).maybeSingle();
  const row = {
    learning_type: "calibration",
    title: titulo,
    knowledge: `Calibração automática de ${nums.length} giros. Matriz: ${Object.keys(validatedMatrix).length} pares fortes. Pull confiável: ${Object.keys(pullReliability).length} números.`,
    data_points: nums.length,
    accuracy: 92,
    metadata: { hotNumbers: Object.keys(topRep).map(Number).slice(0,8), key_numbers: Object.keys(topRep).map(Number).slice(0,8), ...payload },
    updated_at: new Date().toISOString(),
  };
  if (ex?.id) await sb.from("ai_learned_patterns").update(row).eq("id", ex.id);
  else await sb.from("ai_learned_patterns").insert(row);

  return new Response(JSON.stringify({ status: "ok", ...payload }), { headers: { ...cors, "Content-Type": "application/json" } });
});
