
-- Insert creator quota
INSERT INTO public.plan_quotas (role, max_video_generations_monthly, max_resolution, max_storyboards, can_clone_voice, can_use_timeline, can_use_api_access, can_use_multi_provider)
VALUES ('creator', 100, '1080p', -1, true, true, true, true);

-- Insert business quota  
INSERT INTO public.plan_quotas (role, max_video_generations_monthly, max_resolution, max_storyboards, can_clone_voice, can_use_timeline, can_use_api_access, can_use_multi_provider)
VALUES ('business', 200, '4k', -1, true, true, true, true);
