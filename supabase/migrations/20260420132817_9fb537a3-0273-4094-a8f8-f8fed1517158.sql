-- Generic helper to scan a JSONB value for inline data: URLs > 500KB
CREATE OR REPLACE FUNCTION public.check_jsonb_no_large_base64(
  _data jsonb,
  _table_label text,
  _column_label text
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  item jsonb;
  field_key text;
  field_value text;
  max_bytes int := 500 * 1024; -- 500 KB
BEGIN
  IF _data IS NULL THEN
    RETURN;
  END IF;

  -- Walk arrays of objects
  IF jsonb_typeof(_data) = 'array' THEN
    FOR item IN SELECT * FROM jsonb_array_elements(_data)
    LOOP
      IF jsonb_typeof(item) = 'object' THEN
        FOR field_key, field_value IN SELECT key, value::text FROM jsonb_each(item)
        LOOP
          IF field_value LIKE '"data:%' AND length(field_value) > max_bytes THEN
            RAISE EXCEPTION
              '% column "%" contains an inline base64 asset (field "%") larger than 500KB (% bytes). Upload it to Storage and save only the URL instead.',
              _table_label, _column_label, field_key, length(field_value)
              USING ERRCODE = 'check_violation';
          END IF;
        END LOOP;
      END IF;
    END LOOP;
  -- Walk single object
  ELSIF jsonb_typeof(_data) = 'object' THEN
    FOR field_key, field_value IN SELECT key, value::text FROM jsonb_each(_data)
    LOOP
      IF field_value LIKE '"data:%' AND length(field_value) > max_bytes THEN
        RAISE EXCEPTION
          '% column "%" contains an inline base64 asset (field "%") larger than 500KB (% bytes). Upload it to Storage and save only the URL instead.',
          _table_label, _column_label, field_key, length(field_value)
          USING ERRCODE = 'check_violation';
      END IF;
    END LOOP;
  END IF;
END;
$$;

-- Trigger function for talking_avatar_projects (checks scenes, timeline_clips, reference_images, settings)
CREATE OR REPLACE FUNCTION public.check_talking_avatar_no_large_base64()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM public.check_jsonb_no_large_base64(NEW.scenes, 'talking_avatar_projects', 'scenes');
  PERFORM public.check_jsonb_no_large_base64(NEW.timeline_clips, 'talking_avatar_projects', 'timeline_clips');
  PERFORM public.check_jsonb_no_large_base64(NEW.reference_images, 'talking_avatar_projects', 'reference_images');
  PERFORM public.check_jsonb_no_large_base64(NEW.settings, 'talking_avatar_projects', 'settings');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_talking_avatar_no_large_base64 ON public.talking_avatar_projects;
CREATE TRIGGER trg_talking_avatar_no_large_base64
BEFORE INSERT OR UPDATE ON public.talking_avatar_projects
FOR EACH ROW EXECUTE FUNCTION public.check_talking_avatar_no_large_base64();

-- Trigger function for storyboards (checks panels)
CREATE OR REPLACE FUNCTION public.check_storyboards_no_large_base64()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM public.check_jsonb_no_large_base64(NEW.panels, 'storyboards', 'panels');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_storyboards_no_large_base64 ON public.storyboards;
CREATE TRIGGER trg_storyboards_no_large_base64
BEFORE INSERT OR UPDATE ON public.storyboards
FOR EACH ROW EXECUTE FUNCTION public.check_storyboards_no_large_base64();