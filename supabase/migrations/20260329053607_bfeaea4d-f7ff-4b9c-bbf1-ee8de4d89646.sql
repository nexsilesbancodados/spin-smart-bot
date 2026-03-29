-- Drop the overly permissive insert policy
DROP POLICY "Allow inserts to historico_roleta" ON public.historico_roleta;

-- Create a restricted insert policy (only service_role can insert)
CREATE POLICY "Service role can insert historico_roleta"
ON public.historico_roleta FOR INSERT TO service_role WITH CHECK (true);