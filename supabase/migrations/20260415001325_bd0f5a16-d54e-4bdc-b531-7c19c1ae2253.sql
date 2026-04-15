
ALTER TABLE public.plan_quotas
ADD COLUMN max_story_mode_monthly integer NOT NULL DEFAULT 0;

-- Set values per role
UPDATE public.plan_quotas SET max_story_mode_monthly = 1 WHERE role = 'user';
UPDATE public.plan_quotas SET max_story_mode_monthly = 5 WHERE role = 'premium';
UPDATE public.plan_quotas SET max_story_mode_monthly = 15 WHERE role = 'creator';
UPDATE public.plan_quotas SET max_story_mode_monthly = -1 WHERE role = 'business';
UPDATE public.plan_quotas SET max_story_mode_monthly = -1 WHERE role = 'admin';
