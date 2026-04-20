CREATE OR REPLACE FUNCTION public.check_story_mode_scenes_no_large_base64()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  scene_item jsonb;
  scene_idx int := 0;
  field_key text;
  field_value text;
  max_bytes int := 500 * 1024; -- 500 KB
BEGIN
  IF NEW.scenes IS NULL OR jsonb_typeof(NEW.scenes) <> 'array' THEN
    RETURN NEW;
  END IF;

  FOR scene_item IN SELECT * FROM jsonb_array_elements(NEW.scenes)
  LOOP
    scene_idx := scene_idx + 1;
    IF jsonb_typeof(scene_item) <> 'object' THEN
      CONTINUE;
    END IF;

    FOR field_key, field_value IN
      SELECT key, value::text FROM jsonb_each(scene_item)
    LOOP
      -- Only check string fields that look like data URLs
      IF field_value LIKE '"data:%' AND length(field_value) > max_bytes THEN
        RAISE EXCEPTION
          'Scene % field "%" contains an inline base64 asset larger than 500KB (% bytes). Upload it to Storage and save only the URL instead.',
          scene_idx, field_key, length(field_value)
          USING ERRCODE = 'check_violation';
      END IF;
    END LOOP;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_story_mode_no_large_base64 ON public.story_mode_projects;

CREATE TRIGGER trg_story_mode_no_large_base64
BEFORE INSERT OR UPDATE OF scenes ON public.story_mode_projects
FOR EACH ROW
EXECUTE FUNCTION public.check_story_mode_scenes_no_large_base64();