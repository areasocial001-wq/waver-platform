
-- Add 'creator' and 'business' to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'creator';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'business';

-- Update premium quota: reduce from 50 to 30 videos/month
UPDATE public.plan_quotas SET max_video_generations_monthly = 30 WHERE role = 'premium';
