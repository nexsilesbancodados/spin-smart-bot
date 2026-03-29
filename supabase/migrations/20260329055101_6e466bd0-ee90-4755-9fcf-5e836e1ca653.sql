
-- Create resultados_roleta table
CREATE TABLE public.resultados_roleta (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  numero text NOT NULL,
  mesa text DEFAULT 'default',
  provedor text DEFAULT 'Playtech',
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.resultados_roleta ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Anyone can read resultados_roleta"
ON public.resultados_roleta FOR SELECT TO public
USING (true);

-- Service role can insert
CREATE POLICY "Service role can insert resultados_roleta"
ON public.resultados_roleta FOR INSERT TO service_role
WITH CHECK (true);

-- Anon can also insert (for the console script bridge)
CREATE POLICY "Anon can insert resultados_roleta"
ON public.resultados_roleta FOR INSERT TO anon
WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.resultados_roleta;
