
-- Auto-assign 'user' role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_assign_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- Create profiles table for admin user management
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    avatar_url TEXT,
    is_blocked BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all profiles"
ON public.profiles FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "System can insert profiles"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Allow service role to insert (for trigger)
CREATE POLICY "Service can insert profiles"
ON public.profiles FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can delete profiles"
ON public.profiles FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();

-- Create plan_quotas table
CREATE TABLE public.plan_quotas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role app_role NOT NULL UNIQUE,
    max_video_generations_monthly INTEGER NOT NULL DEFAULT 5,
    max_resolution TEXT NOT NULL DEFAULT '720p',
    max_storyboards INTEGER NOT NULL DEFAULT 1,
    can_clone_voice BOOLEAN NOT NULL DEFAULT false,
    can_use_timeline BOOLEAN NOT NULL DEFAULT false,
    can_use_api_access BOOLEAN NOT NULL DEFAULT false,
    can_use_multi_provider BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.plan_quotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view quotas"
ON public.plan_quotas FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage quotas"
ON public.plan_quotas FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Insert default quotas
INSERT INTO public.plan_quotas (role, max_video_generations_monthly, max_resolution, max_storyboards, can_clone_voice, can_use_timeline, can_use_api_access, can_use_multi_provider) VALUES
('user', 5, '720p', 1, false, false, false, false),
('premium', 50, '1080p', -1, true, true, false, false),
('admin', -1, '4k', -1, true, true, true, true);

-- Insert profile for existing admin user
INSERT INTO public.profiles (id, email, full_name)
SELECT id, email, ''
FROM auth.users
WHERE id = 'aa18b536-a595-4f10-bf50-8a1f3f5550e1'
ON CONFLICT (id) DO NOTHING;
