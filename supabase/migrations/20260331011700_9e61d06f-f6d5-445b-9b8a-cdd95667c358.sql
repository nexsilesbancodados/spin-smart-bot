DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'resultados_roleta'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.resultados_roleta;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'roulette_numbers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.roulette_numbers;
  END IF;
END $$;