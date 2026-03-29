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

    // Store new numbers in DB (deduplicate by checking latest stored)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the last stored number to detect new ones
    const { data: lastStored } = await supabase
      .from('roulette_numbers')
      .select('number')
      .order('fetched_at', { ascending: false })
      .limit(5);

    const lastStoredNums = (lastStored || []).map((r: any) => r.number);
    
    // Find new numbers (ones at the start that don't match recent stored)
    let newNumbers: number[] = [];
    if (lastStoredNums.length === 0) {
      // First run: store all
      newNumbers = numbers.slice(0, 100);
    } else {
      // Find where the overlap starts
      for (let i = 0; i < Math.min(numbers.length, 20); i++) {
        if (numbers[i] === lastStoredNums[0] && 
            (i + 1 >= numbers.length || numbers[i + 1] === lastStoredNums[1])) {
          break;
        }
        newNumbers.push(numbers[i]);
      }
    }

    if (newNumbers.length > 0) {
      const rows = newNumbers.map(n => ({
        number: n,
        color: getColor(n),
      }));
      await supabase.from('roulette_numbers').insert(rows);
    }

    // Return all numbers from API
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
