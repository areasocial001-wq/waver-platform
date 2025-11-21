-- Add columns for video generation results
alter table public.video_generations
add column if not exists prediction_id text,
add column if not exists video_url text,
add column if not exists error_message text;