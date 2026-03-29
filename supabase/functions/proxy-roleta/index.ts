import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const RED_NUMBERS = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
const getColor = (n: number) => n === 0 ? 'green' : RED_NUMBERS.includes(n) ? 'red' : 'black';

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
      // Get last 20 stored numbers with timestamps for robust comparison
      const { data: lastStored } = await supabase
        .from('roulette_numbers')
        .select('number, fetched_at')
        .order('fetched_at', { ascending: false })
        .limit(20);

      const storedNums = (lastStored || []).map((r: any) => r.number);

      let newNumbers: number[] = [];

      if (storedNums.length === 0) {
        // First time: store all available
        newNumbers = numbers.slice(0, 200);
      } else {
        // Strategy: find where the API sequence aligns with stored sequence
        // The API returns numbers newest-first, same as our stored order
        // We need to find the offset where API[offset:] matches stored[0:]
        
        // Build a unique fingerprint using position-aware comparison
        // Look for the position in the API array where stored sequence starts
        const storedSig = storedNums.slice(0, 6).join(',');
        
        let matchAt = -1;
        for (let i = 0; i < Math.min(numbers.length - 5, 20); i++) {
          const apiSig = numbers.slice(i, i + 6).join(',');
          if (apiSig === storedSig) {
            matchAt = i;
            break;
          }
        }

        if (matchAt === -1) {
          // Try with fewer elements (4 match)
          const storedSig4 = storedNums.slice(0, 4).join(',');
          for (let i = 0; i < Math.min(numbers.length - 3, 20); i++) {
            const apiSig4 = numbers.slice(i, i + 4).join(',');
            if (apiSig4 === storedSig4) {
              matchAt = i;
              break;
            }
          }
        }

        if (matchAt > 0) {
          // Found alignment — everything before matchAt is new
          newNumbers = numbers.slice(0, matchAt);
        } else if (matchAt === 0) {
          // Perfect alignment — no new numbers
          newNumbers = [];
        } else {
          // No alignment found — only add first number if it differs from last stored
          // Use a stricter check: compare first 2 API nums vs first 2 stored
          if (numbers[0] !== storedNums[0] || (numbers.length > 1 && storedNums.length > 1 && numbers[1] !== storedNums[1])) {
            // Only the first number is new (conservative approach)
            newNumbers = [numbers[0]];
          }
        }
      }

      // Safety: never insert more than 5 at once (a real roulette spins every ~30-60s, 
      // with 3s polling we should get at most 1 new number per call)
      if (newNumbers.length > 5) {
        console.warn(`[proxy-roleta] Too many new numbers (${newNumbers.length}), capping to 5`);
        newNumbers = newNumbers.slice(0, 5);
      }

      if (newNumbers.length > 0) {
        // Double-check: make sure the most recent new number isn't already the latest stored
        if (storedNums.length > 0 && newNumbers.length === 1 && newNumbers[0] === storedNums[0]) {
          // Check timestamp — if last insert was < 10s ago, skip
          const lastTime = lastStored?.[0]?.fetched_at;
          if (lastTime) {
            const elapsed = Date.now() - new Date(lastTime).getTime();
            if (elapsed < 10000) {
              newNumbers = [];
              console.log('[proxy-roleta] Skipping duplicate within 10s window');
            }
          }
        }
      }

      if (newNumbers.length > 0) {
        const rows = newNumbers.map(n => ({ number: n, color: getColor(n) }));
        await supabase.from('roulette_numbers').insert(rows);

        const roletaRows = newNumbers.map(n => ({
          numero: String(n),
          mesa: 'Roleta Brasileira',
          provedor: 'Playtech',
        }));
        await supabase.from('resultados_roleta').insert(roletaRows);

        console.log(`[proxy-roleta] Inserted ${newNumbers.length} new: [${newNumbers.join(',')}]`);
      }

      // Update fingerprint after successful processing
      lastApiFingerprint = apiFingerprint;

      return new Response(JSON.stringify({ ...data, mesa: 'Roleta Brasileira', newCount: newNumbers.length }), {
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
