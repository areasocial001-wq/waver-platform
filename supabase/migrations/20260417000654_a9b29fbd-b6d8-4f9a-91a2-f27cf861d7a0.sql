-- Create RPC to run VACUUM ANALYZE on heavy public tables (admin only)
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
  duration_ms integer;
  total_freed bigint := 0;
  size_before bigint;
  size_after bigint;
BEGIN
  -- Admin-only
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  -- Iterate over the top heaviest public tables (by dead tuples or total size)
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

  RETURN jsonb_build_object(
    'success', true,
    'tables_processed', jsonb_array_length(results),
    'total_freed_pretty', pg_size_pretty(total_freed),
    'results', results,
    'completed_at', now()
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.run_db_maintenance() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.run_db_maintenance() TO authenticated;