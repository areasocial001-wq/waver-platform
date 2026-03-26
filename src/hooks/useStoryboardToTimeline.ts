import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TimelineItem } from '@/components/timeline/types';

interface StoryboardVideo {
  id: string;
  video_url: string | null;
  prompt: string | null;
  duration: number;
  sequence_order: number | null;
}

export function useStoryboardToTimeline(storyboardId?: string) {
  const [videoItems, setVideoItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!storyboardId) return;
    loadStoryboardVideos(storyboardId);
  }, [storyboardId]);

  const loadStoryboardVideos = async (sbId: string) => {
    setLoading(true);
    try {
      // Get batches for this storyboard
      const { data: batches } = await supabase
        .from('storyboard_video_batches')
        .select('id')
        .eq('storyboard_id', sbId);

      if (!batches?.length) {
        setLoading(false);
        return;
      }

      const batchIds = batches.map(b => b.id);

      // Get all completed videos
      const { data: videos } = await supabase
        .from('video_generations')
        .select('id, video_url, prompt, duration, sequence_order')
        .in('batch_id', batchIds)
        .eq('status', 'completed')
        .order('sequence_order', { ascending: true });

      if (!videos?.length) {
        setLoading(false);
        return;
      }

      // Convert to timeline items
      let currentTime = 0;
      const items: TimelineItem[] = videos
        .filter((v): v is StoryboardVideo & { video_url: string } => !!v.video_url)
        .map((video, i) => {
          const item: TimelineItem = {
            id: `sb-${video.id}`,
            name: video.prompt?.slice(0, 30) || `Clip ${i + 1}`,
            startTime: currentTime,
            duration: video.duration || 5,
            url: video.video_url,
            color: 'hsl(var(--primary))',
            volume: 100,
            sourceType: 'storyboard',
            sourceId: video.id,
          };
          currentTime += item.duration;
          return item;
        });

      setVideoItems(items);
    } catch (err) {
      console.error('Error loading storyboard videos:', err);
    }
    setLoading(false);
  };

  const importToTimeline = async () => {
    if (!storyboardId) return [];

    // Get user's storyboards with completed videos
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user) return [];

    const { data: batches } = await supabase
      .from('storyboard_video_batches')
      .select('id, storyboard_id, storyboards!inner(title)')
      .eq('user_id', session.session.user.id)
      .eq('status', 'completed');

    return batches || [];
  };

  return { videoItems, loading, loadStoryboardVideos, importToTimeline };
}
