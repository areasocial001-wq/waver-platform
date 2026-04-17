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
  caller_uid uuid := auth.uid();
  trigger_source text;
BEGIN
  -- Allow either cron (no auth context) OR admins
  IF caller_uid IS NOT NULL AND NOT public.has_role(caller_uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;
  trigger_source := CASE WHEN caller_uid IS NULL THEN 'cron_weekly' ELSE 'cron_manual' END;

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
    'vacuum_analyze', 'success', trigger_source,
    jsonb_array_length(results),
    total_freed,
    EXTRACT(MILLISECONDS FROM (clock_timestamp() - global_start))::integer,
    results
  );

  DELETE FROM public.maintenance_log WHERE created_at < now() - interval '90 days';
END;
$function$;

REVOKE ALL ON FUNCTION public.run_scheduled_maintenance() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.run_scheduled_maintenance() TO authenticated;