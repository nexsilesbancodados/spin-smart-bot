import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const RED_NUMBERS = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
const getColor = (n: number) => n === 0 ? 'green' : RED_NUMBERS.includes(n) ? 'red' : 'black';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const response = await fetch('https://www.iamonstro.com.br/apicurso/roleta.php');
    const data = await response.json();
    const numbers: number[] = (data.results || []).map(Number).filter((n: number) => !isNaN(n) && n >= 0 && n <= 36);

    const mesa = data.mesa || data.table || 'Roleta Brasileira';
    const isRoletaBrasileira = /brasil|brazilian/i.test(String(mesa)) || !data.mesa;

    if (!isRoletaBrasileira) {
      return new Response(JSON.stringify({ error: 'Fonte não é Roleta Brasileira', results: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Improved deduplication: compare sequences using a fingerprint of last 10 stored
    const { data: lastStored } = await supabase
      .from('roulette_numbers')
      .select('number')
      .order('fetched_at', { ascending: false })
      .limit(10);

    const lastStoredNums = (lastStored || []).map((r: any) => r.number);
    
    let newNumbers: number[] = [];
    if (lastStoredNums.length === 0) {
      // First time: store all available
      newNumbers = numbers.slice(0, 200);
    } else {
      // Find where the API sequence matches our stored sequence
      // We look for the longest matching subsequence starting from position 0 of stored
      let matchAt = -1;
      for (let i = 0; i < Math.min(numbers.length, 30); i++) {
        // Check if numbers[i..i+3] matches lastStoredNums[0..3]
        let seqMatch = 0;
        for (let j = 0; j < Math.min(4, lastStoredNums.length); j++) {
          if (i + j < numbers.length && numbers[i + j] === lastStoredNums[j]) seqMatch++;
          else break;
        }
        // Require at least 3 consecutive matches for confidence
        if (seqMatch >= Math.min(3, lastStoredNums.length)) {
          matchAt = i;
          break;
        }
      }

      if (matchAt > 0) {
        newNumbers = numbers.slice(0, matchAt);
      } else if (matchAt === -1 && numbers.length > 0) {
        // No match found — API might have shifted significantly
        // Only add first number to avoid mass duplicates
        if (numbers[0] !== lastStoredNums[0]) {
          newNumbers = [numbers[0]];
        }
      }
      // matchAt === 0 means no new numbers
    }

    if (newNumbers.length > 0 && newNumbers.length <= 30) {
      // Safety cap: never insert more than 30 at once (prevents data pollution)
      const rows = newNumbers.map(n => ({
        number: n,
        color: getColor(n),
      }));
      await supabase.from('roulette_numbers').insert(rows);

      const roletaRows = newNumbers.map(n => ({
        numero: String(n),
        mesa: 'Roleta Brasileira',
        provedor: 'Playtech',
      }));
      await supabase.from('resultados_roleta').insert(roletaRows);
    }

    return new Response(JSON.stringify({ ...data, mesa: 'Roleta Brasileira', newCount: newNumbers.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
