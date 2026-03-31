
-- Table to store per-model predictions for feedback loop and weight recalibration
CREATE TABLE public.model_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  model_id text NOT NULL, -- 'markov', 'neural_pattern', 'gradient', 'bayesian', 'statistical'
  predicted_numbers integer[] NOT NULL DEFAULT '{}',
  predicted_main integer,
  confidence numeric NOT NULL DEFAULT 0,
  bet_type text NOT NULL DEFAULT 'unknown',
  reasoning text,
  actual_number integer,
  hit boolean,
  hit_type text, -- 'exact', 'neighbor', 'group'
  resolved_at timestamptz,
  ensemble_weight numeric DEFAULT 1.0,
  spin_context jsonb DEFAULT '{}'
);

-- Index for fast lookups by model and recency
CREATE INDEX idx_model_predictions_model_created ON public.model_predictions (model_id, created_at DESC);
CREATE INDEX idx_model_predictions_unresolved ON public.model_predictions (resolved_at) WHERE resolved_at IS NULL;

-- RLS
ALTER TABLE public.model_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read model_predictions" ON public.model_predictions FOR SELECT TO public USING (true);
CREATE POLICY "Service role can manage model_predictions" ON public.model_predictions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Enable realtime for model_predictions
ALTER PUBLICATION supabase_realtime ADD TABLE public.model_predictions;

-- Table to store ensemble model weights and performance metrics
CREATE TABLE public.ensemble_weights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id text NOT NULL UNIQUE,
  weight numeric NOT NULL DEFAULT 1.0,
  win_rate numeric NOT NULL DEFAULT 0,
  total_predictions integer NOT NULL DEFAULT 0,
  total_hits integer NOT NULL DEFAULT 0,
  exact_hits integer NOT NULL DEFAULT 0,
  current_streak integer NOT NULL DEFAULT 0,
  best_streak integer NOT NULL DEFAULT 0,
  last_recalibrated_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'
);

ALTER TABLE public.ensemble_weights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read ensemble_weights" ON public.ensemble_weights FOR SELECT TO public USING (true);
CREATE POLICY "Service role can manage ensemble_weights" ON public.ensemble_weights FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Seed initial weights for all 5 models
INSERT INTO public.ensemble_weights (model_id, weight) VALUES
  ('markov', 1.0),
  ('neural_pattern', 1.0),
  ('gradient', 1.0),
  ('bayesian', 1.0),
  ('statistical', 1.0);

ALTER PUBLICATION supabase_realtime ADD TABLE public.ensemble_weights;
