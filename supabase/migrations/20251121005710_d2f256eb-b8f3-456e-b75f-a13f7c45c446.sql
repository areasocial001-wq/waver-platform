-- Create enum for generation type
create type public.generation_type as enum ('text_to_video', 'image_to_video');

-- Create table for video generation parameters
create table public.video_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  type generation_type not null,
  prompt text,
  duration integer not null,
  resolution text,
  motion_intensity text,
  image_url text,
  image_name text,
  status text default 'pending',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.video_generations enable row level security;

-- Create policies
create policy "Users can view their own generations"
  on public.video_generations
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can create their own generations"
  on public.video_generations
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own generations"
  on public.video_generations
  for update
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can delete their own generations"
  on public.video_generations
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- Create function to update timestamps
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Create trigger for automatic timestamp updates
create trigger update_video_generations_updated_at
  before update on public.video_generations
  for each row
  execute function public.handle_updated_at();