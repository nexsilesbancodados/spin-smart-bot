-- Create historico_roleta table
CREATE TABLE public.historico_roleta (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  number INTEGER NOT NULL CHECK (number >= 0 AND number <= 36),
  color TEXT NOT NULL CHECK (color IN ('red', 'black', 'green')),
  table_id TEXT NOT NULL DEFAULT 'default',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.historico_roleta ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read (dashboard is public)
CREATE POLICY "Anyone can read historico_roleta"
ON public.historico_roleta FOR SELECT USING (true);

-- Allow inserts to historico_roleta
CREATE POLICY "Allow inserts to historico_roleta"
ON public.historico_roleta FOR INSERT WITH CHECK (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.historico_roleta;

-- Index for fast queries
CREATE INDEX idx_historico_roleta_created_at ON public.historico_roleta (created_at DESC);
CREATE INDEX idx_historico_roleta_table_id ON public.historico_roleta (table_id);