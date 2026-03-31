import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 1. Deletar tudo exceto mesa_calibration_live
  const { error: delErr } = await sb
    .from("ai_learned_patterns")
    .delete()
    .neq("title", "mesa_calibration_live");

  // 2. Resetar calibração para reaprender
  const { error: updErr } = await sb
    .from("ai_learned_patterns")
    .update({
      data_points: 0,
      accuracy: 50,
      knowledge: "Reset completo. Reaprendendo do zero. Mapeamento mantido.",
      metadata: { reset_at: new Date().toISOString(), reason: "full_reset_keep_mapping" },
      updated_at: new Date().toISOString(),
    })
    .eq("title", "mesa_calibration_live");

  return new Response(
    JSON.stringify({
      status: "ok",
      deleted: delErr ? `error: ${delErr.message}` : "all_except_mapping",
      calibration_reset: updErr ? `error: ${updErr.message}` : "done",
    }),
    { headers: { ...cors, "Content-Type": "application/json" } }
  );
});
