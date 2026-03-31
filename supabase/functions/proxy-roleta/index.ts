import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const RED_NUMBERS = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
const getColor = (n: number) => n === 0 ? 'green' : RED_NUMBERS.includes(n) ? 'red' : 'black';
const RECENT_DUPLICATE_WINDOW_MS = 12000;

// Simple in-memory lock to prevent concurrent inserts
let isProcessing = false;
let lastApiFingerprint = '';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    let data: any = null;
    let numbers: number[] = [];
    let apiError: string | null = null;

    try {
      const response = await fetch('https://www.iamonstro.com.br/apicurso/roleta.php');
      data = await response.json();
      numbers = (data.results || []).map(Number).filter((n: number) => !isNaN(n) && n >= 0 && n <= 36);
    } catch (fetchErr: any) {
      apiError = fetchErr?.message || 'API external unavailable';
      console.error('External API error (using cached data):', apiError);
    }

    // If API failed, return cached data from DB
    if (!data || numbers.length === 0) {
      const { data: cached } = await supabase
        .from('roulette_numbers')
        .select('number')
        .order('fetched_at', { ascending: false })
        .limit(200);

      return new Response(JSON.stringify({
        results: (cached || []).map((r: any) => r.number),
        mesa: 'Roleta Brasileira',
        cached: true,
        apiError: apiError || 'No data from API',
        newCount: 0,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const mesa = data.mesa || data.table || 'Roleta Brasileira';
    const isRoletaBrasileira = /brasil|brazilian/i.test(String(mesa)) || !data.mesa;

    if (!isRoletaBrasileira) {
      return new Response(JSON.stringify({ error: 'Fonte não é Roleta Brasileira', results: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create a fingerprint of the first 5 API numbers to detect changes
    const apiFingerprint = numbers.slice(0, 5).join(',');

    // If fingerprint hasn't changed since last call, skip insertion entirely
    if (apiFingerprint === lastApiFingerprint) {
      return new Response(JSON.stringify({ ...data, mesa: 'Roleta Brasileira', newCount: 0, skipped: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Prevent concurrent processing
    if (isProcessing) {
      return new Response(JSON.stringify({ ...data, mesa: 'Roleta Brasileira', newCount: 0, busy: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    isProcessing = true;

    try {
      const latestNumber = numbers[0];

      if (typeof latestNumber !== 'number' || latestNumber < 0 || latestNumber > 36) {
        return new Response(JSON.stringify({ ...data, mesa: 'Roleta Brasileira', newCount: 0, skipped: true, reason: 'invalid_head' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: lastStored } = await supabase
        .from('roulette_numbers')
        .select('number, fetched_at')
        .order('fetched_at', { ascending: false })
        .limit(6);

      const now = Date.now();
      const recentDuplicate = (lastStored || []).find((row: any) => {
        if (row.number !== latestNumber || !row.fetched_at) return false;
        return now - new Date(row.fetched_at).getTime() < RECENT_DUPLICATE_WINDOW_MS;
      });

      if (recentDuplicate) {
        lastApiFingerprint = apiFingerprint;
        return new Response(JSON.stringify({
          ...data,
          mesa: 'Roleta Brasileira',
          newCount: 0,
          skipped: true,
          reason: 'recent_duplicate_head',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      await Promise.all([
        supabase.from('roulette_numbers').insert([{ number: latestNumber, color: getColor(latestNumber) }]),
        supabase.from('resultados_roleta').insert([{
          numero: String(latestNumber),
          mesa: 'Roleta Brasileira',
          provedor: 'Playtech',
        }]),
      ]);

      console.log(`[proxy-roleta] Inserted latest number: ${latestNumber}`);

      // Update fingerprint after successful processing
      lastApiFingerprint = apiFingerprint;

      return new Response(JSON.stringify({ ...data, mesa: 'Roleta Brasileira', newCount: 1, latestNumber }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } finally {
      isProcessing = false;
    }
  } catch (error) {
    isProcessing = false;
    try {
      const { data: cached } = await supabase
        .from('roulette_numbers')
        .select('number')
        .order('fetched_at', { ascending: false })
        .limit(200);
      return new Response(JSON.stringify({
        results: (cached || []).map((r: any) => r.number),
        mesa: 'Roleta Brasileira',
        cached: true,
        apiError: (error as Error).message,
        newCount: 0,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch {
      return new Response(JSON.stringify({ error: (error as Error).message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }
});
