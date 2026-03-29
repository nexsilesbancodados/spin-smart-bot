WITH ranked AS (
  SELECT id, number, fetched_at,
    ROW_NUMBER() OVER (
      PARTITION BY number, date_trunc('minute', fetched_at)
      ORDER BY fetched_at ASC
    ) as rn
  FROM roulette_numbers
)
DELETE FROM roulette_numbers WHERE id IN (SELECT id FROM ranked WHERE rn > 1);