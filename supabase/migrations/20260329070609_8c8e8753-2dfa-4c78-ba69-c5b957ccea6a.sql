
CREATE TABLE public.prediction_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  strategy_type TEXT NOT NULL,
  strategy_label TEXT NOT NULL,
  predicted_numbers INTEGER[] NOT NULL DEFAULT '{}',
  predicted_main INTEGER,
  probability INTEGER NOT NULL DEFAULT 0,
  convergence_score INTEGER NOT NULL DEFAULT 0,
  mesa_mode TEXT,
  actual_number INTEGER,
  hit BOOLEAN DEFAULT NULL,
  hit_type TEXT DEFAULT NULL,
  resolved_at TIMESTAMP WITH TIME ZONE,
  justification TEXT
);

ALTER TABLE public.prediction_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read prediction_history" ON public.prediction_history
  FOR SELECT TO public USING (true);

CREATE POLICY "Service role can manage prediction_history" ON public.prediction_history
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.prediction_history;
