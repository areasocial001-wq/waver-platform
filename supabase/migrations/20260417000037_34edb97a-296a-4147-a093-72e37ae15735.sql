-- Table for historical DB health metrics
CREATE TABLE IF NOT EXISTS public.db_health_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  db_size_bytes bigint NOT NULL,
  table_stats jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_rows bigint NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_db_health_snapshots_recorded
  ON public.db_health_snapshots (recorded_at DESC);

ALTER TABLE public.db_health_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view db health snapshots"
  ON public.db_health_snapshots FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Server-only writes via SECURITY DEFINER function — no client INSERT/UPDATE/DELETE policies

-- Function: live stats (admin only)
CREATE OR REPLACE FUNCTION public.get_db_health_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  SELECT jsonb_build_object(
    'db_size_bytes', pg_database_size(current_database()),
    'db_size_pretty', pg_size_pretty(pg_database_size(current_database())),
    'tables', (
      SELECT COALESCE(jsonb_agg(t ORDER BY (t->>'total_size_bytes')::bigint DESC), '[]'::jsonb)
      FROM (
        SELECT jsonb_build_object(
          'name', relname,
          'total_size_bytes', pg_total_relation_size(relid),
          'total_size_pretty', pg_size_pretty(pg_total_relation_size(relid)),
          'table_size_pretty', pg_size_pretty(pg_relation_size(relid)),
          'live_rows', n_live_tup,
          'dead_rows', n_dead_tup,
          'seq_scan', seq_scan,
          'seq_tup_read', seq_tup_read,
          'idx_scan', COALESCE(idx_scan, 0),
          'idx_tup_fetch', COALESCE(idx_tup_fetch, 0)
        ) AS t
        FROM pg_stat_user_tables
        WHERE schemaname = 'public'
      ) sub
    ),
    'unused_indexes', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'index', indexrelname,
        'table', relname,
        'size_pretty', pg_size_pretty(pg_relation_size(indexrelid))
      )), '[]'::jsonb)
      FROM pg_stat_user_indexes
      WHERE schemaname = 'public'
        AND idx_scan = 0
        AND indexrelname NOT LIKE '%_pkey'
        AND indexrelname NOT LIKE '%_key'
    ),
    'cron_jobs', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'jobname', jobname,
        'schedule', schedule,
        'active', active,
        'last_run', (
          SELECT MAX(start_time) FROM cron.job_run_details d WHERE d.jobid = j.jobid
        ),
        'last_status', (
          SELECT status FROM cron.job_run_details d
          WHERE d.jobid = j.jobid
          ORDER BY start_time DESC LIMIT 1
        )
      )), '[]'::jsonb)
      FROM cron.job j
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- Function: record a snapshot (called by cron, runs as definer)
CREATE OR REPLACE FUNCTION public.record_db_health_snapshot()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  total_rows_count bigint;
  table_stats_data jsonb;
BEGIN
  SELECT COALESCE(SUM(n_live_tup), 0) INTO total_rows_count
  FROM pg_stat_user_tables
  WHERE schemaname = 'public';

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'name', relname,
    'rows', n_live_tup,
    'size_bytes', pg_total_relation_size(relid)
  ) ORDER BY pg_total_relation_size(relid) DESC), '[]'::jsonb)
  INTO table_stats_data
  FROM pg_stat_user_tables
  WHERE schemaname = 'public';

  INSERT INTO public.db_health_snapshots (db_size_bytes, total_rows, table_stats)
  VALUES (
    pg_database_size(current_database()),
    total_rows_count,
    table_stats_data
  );

  -- Keep only last 90 days of snapshots
  DELETE FROM public.db_health_snapshots
  WHERE recorded_at < now() - interval '90 days';
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_db_health_stats() TO authenticated;