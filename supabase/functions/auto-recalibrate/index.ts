import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const WHEEL = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];

// ═══════════════════════════════════════════════════════════════════
// AUTO-RECALIBRATE: Resolve pending predictions, recalibrate weights,
// clean old data, and log learning
// ═══════════════════════════════════════════════════════════════════
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const results: Record<string, unknown> = {};

    // ── 1. Get recent actual numbers ──────────────────────────
    const { data: recentNumbers } = await supabase
      .from('roulette_numbers')
      .select('number, fetched_at')
      .order('fetched_at', { ascending: false })
      .limit(50);

    const actualNums = (recentNumbers || []).map((r: any) => ({ number: r.number as number, at: r.fetched_at }));
    results.actual_numbers_fetched = actualNums.length;

    // ── 2. Resolve pending model_predictions ──────────────────
    const { data: pendingPreds } = await supabase
      .from('model_predictions')
      .select('*')
      .is('hit', null)
      .order('created_at', { ascending: false })
      .limit(200);

    let resolved = 0;
    if (pendingPreds && pendingPreds.length > 0 && actualNums.length > 0) {
      for (const pred of pendingPreds) {
        // Find the first actual number that came AFTER this prediction
        const predTime = new Date(pred.created_at).getTime();
        const nextActual = actualNums.find((a: any) => new Date(a.at).getTime() > predTime);

        if (nextActual) {
          const actualNum = nextActual.number;
          const predictedNums = pred.predicted_numbers as number[];
          const exactHit = pred.predicted_main === actualNum;
          const neighborHit = !exactHit && predictedNums.includes(actualNum);
          const isHit = exactHit || neighborHit;

          // Wheel distance check for near-misses
          const wheelDist = (a: number, b: number) => {
            const ia = WHEEL.indexOf(a), ib = WHEEL.indexOf(b);
            if (ia < 0 || ib < 0) return 99;
            const d = Math.abs(ia - ib);
            return Math.min(d, WHEEL.length - d);
          };

          const nearMiss = !isHit && pred.predicted_main !== null && wheelDist(pred.predicted_main, actualNum) <= 2;

          await supabase.from('model_predictions').update({
            actual_number: actualNum,
            hit: isHit,
            hit_type: exactHit ? 'exact' : neighborHit ? 'neighbor' : nearMiss ? 'near_miss' : 'miss',
            resolved_at: new Date().toISOString(),
          }).eq('id', pred.id);

          resolved++;
        }
      }
    }
    results.predictions_resolved = resolved;

    // ── 3. Also resolve prediction_history ─────────────────────
    const { data: pendingHistory } = await supabase
      .from('prediction_history')
      .select('*')
      .is('hit', null)
      .order('created_at', { ascending: false })
      .limit(100);

    let historyResolved = 0;
    if (pendingHistory && pendingHistory.length > 0 && actualNums.length > 0) {
      for (const pred of pendingHistory) {
        const predTime = new Date(pred.created_at).getTime();
        const nextActual = actualNums.find((a: any) => new Date(a.at).getTime() > predTime);

        if (nextActual) {
          const actualNum = nextActual.number;
          const predictedNums = pred.predicted_numbers as number[];
          const exactHit = pred.predicted_main === actualNum;
          const neighborHit = !exactHit && predictedNums.includes(actualNum);
          const isHit = exactHit || neighborHit;

          await supabase.from('prediction_history').update({
            actual_number: actualNum,
            hit: isHit,
            hit_type: exactHit ? 'exact' : neighborHit ? 'neighbor' : 'miss',
            resolved_at: new Date().toISOString(),
          }).eq('id', pred.id);

          historyResolved++;
        }
      }
    }
    results.history_resolved = historyResolved;

    // ── 4. Recalibrate ensemble weights (UCB1 + Thompson) ─────
    const { data: resolvedPreds } = await supabase
      .from('model_predictions')
      .select('model_id, hit, confidence, created_at')
      .not('hit', 'is', null)
      .order('created_at', { ascending: false })
      .limit(300);

    if (resolvedPreds && resolvedPreds.length >= 5) {
      const modelStats: Record<string, { hits: number; total: number; exactHits: number; streak: number; bestStreak: number; recentHits: number; recentTotal: number }> = {};

      for (const pred of resolvedPreds) {
        if (!modelStats[pred.model_id]) {
          modelStats[pred.model_id] = { hits: 0, total: 0, exactHits: 0, streak: 0, bestStreak: 0, recentHits: 0, recentTotal: 0 };
        }
        const s = modelStats[pred.model_id];
        s.total++;
        if (pred.hit) s.hits++;
      }

      // Compute streaks from most recent
      const modelRecent: Record<string, boolean[]> = {};
      for (const pred of resolvedPreds) {
        if (!modelRecent[pred.model_id]) modelRecent[pred.model_id] = [];
        if (modelRecent[pred.model_id].length < 30) {
          modelRecent[pred.model_id].push(pred.hit);
        }
      }

      // Recent performance (last 50)
      for (const pred of resolvedPreds.slice(0, 50)) {
        if (modelStats[pred.model_id]) {
          modelStats[pred.model_id].recentTotal++;
          if (pred.hit) modelStats[pred.model_id].recentHits++;
        }
      }

      for (const [modelId, results] of Object.entries(modelRecent)) {
        if (results.length > 0 && modelStats[modelId]) {
          let streak = results[0] ? 1 : -1;
          let bestStreak = results[0] ? 1 : 0;
          for (let i = 1; i < results.length; i++) {
            if (results[i] === results[0]) {
              streak += results[0] ? 1 : -1;
              if (results[0]) bestStreak = Math.max(bestStreak, streak);
            } else break;
          }
          modelStats[modelId].streak = streak;
          modelStats[modelId].bestStreak = bestStreak;
        }
      }

      // UCB1 + Thompson Sampling inspired weight
      const totalPreds = resolvedPreds.length;
      for (const [modelId, stats] of Object.entries(modelStats)) {
        const winRate = stats.total > 0 ? stats.hits / stats.total : 0.5;
        const recentWinRate = stats.recentTotal > 0 ? stats.recentHits / stats.recentTotal : winRate;
        const exploration = stats.total > 0 ? Math.sqrt(2 * Math.log(totalPreds) / stats.total) : 1;

        // Blend overall and recent performance (70% recent, 30% overall)
        const blendedRate = recentWinRate * 0.7 + winRate * 0.3;
        let weight = blendedRate + exploration * 0.15;

        // Streak adjustments
        if (stats.streak >= 4) weight *= 1.4;
        else if (stats.streak >= 2) weight *= 1.15;
        if (stats.streak <= -3) weight *= 0.4;
        else if (stats.streak <= -1) weight *= 0.7;

        weight = Math.max(0.1, Math.min(3.0, weight));

        await supabase.from('ensemble_weights').upsert({
          model_id: modelId,
          weight,
          win_rate: winRate,
          total_predictions: stats.total,
          total_hits: stats.hits,
          exact_hits: stats.exactHits,
          current_streak: stats.streak,
          best_streak: stats.bestStreak,
          last_recalibrated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          metadata: { recent_win_rate: recentWinRate, exploration, blended_rate: blendedRate },
        }, { onConflict: 'model_id' });
      }

      results.models_recalibrated = Object.keys(modelStats).length;
      results.model_stats = Object.fromEntries(
        Object.entries(modelStats).map(([id, s]) => [id, { winRate: (s.hits / s.total * 100).toFixed(1) + '%', total: s.total, streak: s.streak }])
      );
    }

    // ── 5. Update strategy_stats ──────────────────────────────
    const { data: resolvedHistory } = await supabase
      .from('prediction_history')
      .select('strategy_type, strategy_label, hit, hit_type')
      .not('hit', 'is', null)
      .order('created_at', { ascending: false })
      .limit(500);

    if (resolvedHistory && resolvedHistory.length > 0) {
      const stratStats: Record<string, { type: string; label: string; total: number; hits: number; exact: number; neighbor: number; streak: number }> = {};

      for (const r of resolvedHistory) {
        const key = `${r.strategy_type}__${r.strategy_label}`;
        if (!stratStats[key]) {
          stratStats[key] = { type: r.strategy_type, label: r.strategy_label, total: 0, hits: 0, exact: 0, neighbor: 0, streak: 0 };
        }
        const s = stratStats[key];
        s.total++;
        if (r.hit) { s.hits++; if (r.hit_type === 'exact') s.exact++; if (r.hit_type === 'neighbor') s.neighbor++; }
      }

      for (const [, stats] of Object.entries(stratStats)) {
        if (stats.total >= 3) {
          await supabase.from('strategy_stats').upsert({
            strategy_type: stats.type,
            strategy_label: stats.label,
            total_predictions: stats.total,
            total_hits: stats.hits,
            exact_hits: stats.exact,
            neighbor_hits: stats.neighbor,
            win_rate: stats.hits / stats.total,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'strategy_type,strategy_label' });
        }
      }
      results.strategies_updated = Object.keys(stratStats).length;
    }

    // ── 6. Log learning ───────────────────────────────────────
    const totalResolved = resolved + historyResolved;
    if (totalResolved > 0) {
      await supabase.from('ai_learned_patterns').upsert({
        learning_type: 'auto_recalibration',
        title: `Recalibração: ${totalResolved} predições resolvidas`,
        knowledge: JSON.stringify(results),
        accuracy: 0,
        data_points: totalResolved,
        metadata: { timestamp: new Date().toISOString(), results },
      }, { onConflict: 'learning_type' });
    }

    return new Response(JSON.stringify({
      status: 'complete',
      ...results,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[auto-recalibrate] Error:', error);
    return new Response(JSON.stringify({
      status: 'error',
      message: (error as Error).message,
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
