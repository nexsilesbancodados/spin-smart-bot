-- Table to store all fetched roulette numbers persistently
CREATE TABLE public.roulette_numbers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  number integer NOT NULL CHECK (number >= 0 AND number <= 36),
  color text NOT NULL,
  fetched_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX idx_roulette_numbers_fetched_at ON public.roulette_numbers(fetched_at DESC);
CREATE INDEX idx_roulette_numbers_number ON public.roulette_numbers(number);

ALTER TABLE public.roulette_numbers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read roulette_numbers"
ON public.roulette_numbers FOR SELECT TO public
USING (true);

CREATE POLICY "Service role can insert roulette_numbers"
ON public.roulette_numbers FOR INSERT TO service_role
WITH CHECK (true);

CREATE POLICY "Service role can delete roulette_numbers"
ON public.roulette_numbers FOR DELETE TO service_role
USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.roulette_numbers;

-- Table for AI learned knowledge (persistent memory)
CREATE TABLE public.ai_learned_patterns (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  learning_type text NOT NULL,
  title text NOT NULL,
  knowledge text NOT NULL,
  data_points integer DEFAULT 0,
  accuracy numeric(5,2) DEFAULT 0,
  metadata jsonb DEFAULT '{}',
  learned_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX idx_ai_learned_patterns_type ON public.ai_learned_patterns(learning_type);

ALTER TABLE public.ai_learned_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read ai_learned_patterns"
ON public.ai_learned_patterns FOR SELECT TO public
USING (true);

CREATE POLICY "Service role can manage ai_learned_patterns"
ON public.ai_learned_patterns FOR ALL TO service_role
USING (true) WITH CHECK (true);