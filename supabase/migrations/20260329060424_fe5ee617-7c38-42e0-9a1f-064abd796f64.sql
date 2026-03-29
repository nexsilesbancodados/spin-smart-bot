CREATE TABLE public.pattern_insights (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  pattern_type text NOT NULL,
  description text NOT NULL,
  confidence numeric(5,2) DEFAULT 0,
  numbers_involved integer[] DEFAULT '{}',
  recommendation text,
  source_data jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.pattern_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read pattern_insights"
ON public.pattern_insights FOR SELECT TO public
USING (true);

CREATE POLICY "Service role can insert pattern_insights"
ON public.pattern_insights FOR INSERT TO service_role
WITH CHECK (true);

CREATE POLICY "Service role can delete pattern_insights"
ON public.pattern_insights FOR DELETE TO service_role
USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.pattern_insights;