-- Maintenance log table
CREATE TABLE IF NOT EXISTS public.maintenance_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation text NOT NULL,
  status text NOT NULL DEFAULT 'success',
  triggered_by text NOT NULL DEFAULT 'manual',
  tables_processed integer NOT NULL DEFAULT 0,
  total_freed_bytes bigint NOT NULL DEFAULT 0,
  duration_ms integer NOT NULL DEFAULT 0,
  details jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.maintenance_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view maintenance log"
  ON public.maintenance_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_maintenance_log_created_at
  ON public.maintenance_log (created_at DESC);

-- Replace run_db_maintenance to also log
CREATE OR REPLACE FUNCTION public.run_db_maintenance()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  tbl record;
  results jsonb := '[]'::jsonb;
  start_time timestamptz;
  global_start timestamptz := clock_timestamp();
  duration_ms integer;
  total_freed bigint := 0;
  size_before bigint;
  size_after bigint;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  FOR tbl IN
    SELECT relname, relid
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
      AND (n_dead_tup > 100 OR pg_total_relation_size(relid) > 1024 * 1024)
    ORDER BY n_dead_tup DESC, pg_total_relation_size(relid) DESC
    LIMIT 15
  LOOP
    start_time := clock_timestamp();
    size_before := pg_total_relation_size(tbl.relid);

    EXECUTE format('VACUUM (ANALYZE) public.%I', tbl.relname);

    size_after := pg_total_relation_size(tbl.relid);
    duration_ms := EXTRACT(MILLISECONDS FROM (clock_timestamp() - start_time))::integer;
    total_freed := total_freed + GREATEST(size_before - size_after, 0);

    results := results || jsonb_build_object(
      'table', tbl.relname,
      'size_before', pg_size_pretty(size_before),
      'size_after', pg_size_pretty(size_after),
      'freed_bytes', GREATEST(size_before - size_after, 0),
      'duration_ms', duration_ms
    );
  END LOOP;

  INSERT INTO public.maintenance_log
    (operation, status, triggered_by, tables_processed, total_freed_bytes, duration_ms, details)
  VALUES (
    'vacuum_analyze', 'success', 'manual',
    jsonb_array_length(results),
    total_freed,
    EXTRACT(MILLISECONDS FROM (clock_timestamp() - global_start))::integer,
    results
  );

  RETURN jsonb_build_object(
    'success', true,
    'tables_processed', jsonb_array_length(results),
    'total_freed_pretty', pg_size_pretty(total_freed),
    'results', results,
    'completed_at', now()
  );
END;
$function$;

-- REINDEX function (admin only)
CREATE OR REPLACE FUNCTION public.run_db_reindex()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  tbl record;
  results jsonb := '[]'::jsonb;
  start_time timestamptz;
  global_start timestamptz := clock_timestamp();
  duration_ms integer;
  size_before bigint;
  size_after bigint;
  total_freed bigint := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  -- Top 10 most-used tables (by total scan activity)
  FOR tbl IN
    SELECT relname, relid
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
      AND pg_total_relation_size(relid) > 256 * 1024
    ORDER BY (COALESCE(seq_scan,0) + COALESCE(idx_scan,0)) DESC
    LIMIT 10
  LOOP
    start_time := clock_timestamp();
    size_before := pg_total_relation_size(tbl.relid);

    BEGIN
      EXECUTE format('REINDEX TABLE public.%I', tbl.relname);
    EXCEPTION WHEN OTHERS THEN
      results := results || jsonb_build_object(
        'table', tbl.relname,
        'error', SQLERRM,
        'duration_ms', EXTRACT(MILLISECONDS FROM (clock_timestamp() - start_time))::integer
      );
      CONTINUE;
    END;

    size_after := pg_total_relation_size(tbl.relid);
    duration_ms := EXTRACT(MILLISECONDS FROM (clock_timestamp() - start_time))::integer;
    total_freed := total_freed + GREATEST(size_before - size_after, 0);

    results := results || jsonb_build_object(
      'table', tbl.relname,
      'size_before', pg_size_pretty(size_before),
      'size_after', pg_size_pretty(size_after),
      'freed_bytes', GREATEST(size_before - size_after, 0),
      'duration_ms', duration_ms
    );
  END LOOP;

  INSERT INTO public.maintenance_log
    (operation, status, triggered_by, tables_processed, total_freed_bytes, duration_ms, details)
  VALUES (
    'reindex', 'success', 'manual',
    jsonb_array_length(results),
    total_freed,
    EXTRACT(MILLISECONDS FROM (clock_timestamp() - global_start))::integer,
    results
  );

  RETURN jsonb_build_object(
    'success', true,
    'tables_processed', jsonb_array_length(results),
    'total_freed_pretty', pg_size_pretty(total_freed),
    'results', results,
    'completed_at', now()
  );
END;
$function$;

-- Function used by weekly cron job (no auth check, runs as superuser via cron)
CREATE OR REPLACE FUNCTION public.run_scheduled_maintenance()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  tbl record;
  results jsonb := '[]'::jsonb;
  start_time timestamptz;
  global_start timestamptz := clock_timestamp();
  duration_ms integer;
  total_freed bigint := 0;
  size_before bigint;
  size_after bigint;
BEGIN
  FOR tbl IN
    SELECT relname, relid
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
      AND (n_dead_tup > 100 OR pg_total_relation_size(relid) > 1024 * 1024)
    ORDER BY n_dead_tup DESC, pg_total_relation_size(relid) DESC
    LIMIT 20
  LOOP
    start_time := clock_timestamp();
    size_before := pg_total_relation_size(tbl.relid);

    BEGIN
      EXECUTE format('VACUUM (ANALYZE) public.%I', tbl.relname);
    EXCEPTION WHEN OTHERS THEN
      results := results || jsonb_build_object('table', tbl.relname, 'error', SQLERRM);
      CONTINUE;
    END;

    size_after := pg_total_relation_size(tbl.relid);
    duration_ms := EXTRACT(MILLISECONDS FROM (clock_timestamp() - start_time))::integer;
    total_freed := total_freed + GREATEST(size_before - size_after, 0);

    results := results || jsonb_build_object(
      'table', tbl.relname,
      'size_before', pg_size_pretty(size_before),
      'size_after', pg_size_pretty(size_after),
      'freed_bytes', GREATEST(size_before - size_after, 0),
      'duration_ms', duration_ms
    );
  END LOOP;

  INSERT INTO public.maintenance_log
    (operation, status, triggered_by, tables_processed, total_freed_bytes, duration_ms, details)
  VALUES (
    'vacuum_analyze', 'success', 'cron_weekly',
    jsonb_array_length(results),
    total_freed,
    EXTRACT(MILLISECONDS FROM (clock_timestamp() - global_start))::integer,
    results
  );

  -- Keep only last 90 days of maintenance logs
  DELETE FROM public.maintenance_log WHERE created_at < now() - interval '90 days';
END;
$function$;

REVOKE ALL ON FUNCTION public.run_db_maintenance() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.run_db_maintenance() TO authenticated;
REVOKE ALL ON FUNCTION public.run_db_reindex() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.run_db_reindex() TO authenticated;
REVOKE ALL ON FUNCTION public.run_scheduled_maintenance() FROM PUBLIC, anon, authenticated;

-- Schedule weekly job (Sunday 05:00 UTC)
SELECT cron.unschedule('weekly-vacuum-analyze') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'weekly-vacuum-analyze'
);
SELECT cron.schedule(
  'weekly-vacuum-analyze',
  '0 5 * * 0',
  $$ SELECT public.run_scheduled_maintenance(); $$
);