// Supabase Edge Function: feedback-adjust
// Recebe predictionId e feedback ('hit' ou 'miss'), ajusta peso da estratégia/modelo correspondente
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Método não permitido", { status: 405 });
  }
  try {
    const { predictionId, feedback } = await req.json();
    if (!predictionId || !['hit', 'miss'].includes(feedback)) {
      return new Response("Dados inválidos", { status: 400 });
    }
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    // Busca a previsão
    const { data: pred, error } = await supabase.from('prediction_history').select('id, strategy_type').eq('id', predictionId).single();
    if (error || !pred) {
      return new Response("Previsão não encontrada", { status: 404 });
    }
    // Busca peso atual
    const { data: weightRow } = await supabase.from('ensemble_weights').select('weight').eq('model_id', pred.strategy_type).single();
    let weight = weightRow?.weight ?? 1.0;
    // Ajuste simples: aumenta peso se acertou, reduz se errou
    if (feedback === 'hit') weight = Math.min(weight * 1.15, 3.0);
    else weight = Math.max(weight * 0.7, 0.1);
    // Atualiza peso
    await supabase.from('ensemble_weights').upsert({ model_id: pred.strategy_type, weight });
    // Opcional: logar feedback
    await supabase.from('prediction_feedback').insert({ prediction_id: predictionId, feedback, created_at: new Date().toISOString() });
    return new Response(JSON.stringify({ ok: true, newWeight: weight }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response("Erro interno", { status: 500 });
  }
});
