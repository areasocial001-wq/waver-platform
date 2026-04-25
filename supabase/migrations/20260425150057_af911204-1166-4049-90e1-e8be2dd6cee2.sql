-- Drop the ElevenLabs cloned voices table.
-- Voice cloning is migrating to Inworld (IVC) which manages voices in its own service,
-- so we no longer need a local mapping table. Existing rows are discarded as agreed.
DROP TABLE IF EXISTS public.cloned_voices;