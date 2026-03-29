CREATE TABLE IF NOT EXISTS public.strategy_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_type text NOT NULL,
  strategy_label text NOT NULL,
  total_predictions integer NOT NULL DEFAULT 0,
  total_hits integer NOT NULL DEFAULT 0,
  exact_hits integer NOT NULL DEFAULT 0,
  neighbor_hits integer NOT NULL DEFAULT 0,
  win_rate numeric NOT NULL DEFAULT 0,
  avg_probability numeric NOT NULL DEFAULT 0,
  avg_coverage numeric NOT NULL DEFAULT 0,
  avg_payout numeric NOT NULL DEFAULT 0,
  best_streak integer NOT NULL DEFAULT 0,
  current_streak integer NOT NULL DEFAULT 0,
  last_hit_at timestamp with time zone,
  last_miss_at timestamp with time zone,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(strategy_type)
);

ALTER TABLE public.strategy_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read strategy_stats" ON public.strategy_stats
  FOR SELECT TO public USING (true);

CREATE POLICY "Service role can manage strategy_stats" ON public.strategy_stats
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.strategy_stats;