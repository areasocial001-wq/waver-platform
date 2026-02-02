import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface RenderNotification {
  id: string;
  user_id: string;
  project_id: string;
  render_project_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  video_url?: string;
  video_duration?: number;
  video_size?: number;
  error_message?: string;
  started_at: string;
  completed_at?: string;
  notified_at?: string;
}

interface UseJSON2VideoNotificationsOptions {
  onComplete?: (notification: RenderNotification) => void;
  onError?: (notification: RenderNotification) => void;
}

export function useJSON2VideoNotifications(options: UseJSON2VideoNotificationsOptions = {}) {
  const [notifications, setNotifications] = useState<RenderNotification[]>([]);
  const [isSubscribed, setIsSubscribed] = useState(false);

  // Load existing notifications
  const loadNotifications = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("json2video_render_notifications" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      setNotifications((data as unknown as RenderNotification[]) || []);
    } catch (error) {
      console.error("Error loading notifications:", error);
    }
  }, []);

  // Create a new notification and start render with webhook
  const createNotification = useCallback(async (projectId: string): Promise<string | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Devi essere autenticato");
        return null;
      }

      const { data, error } = await supabase
        .from("json2video_render_notifications" as any)
        .insert({
          user_id: user.id,
          project_id: projectId,
          render_project_id: '',
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;

      const notification = data as unknown as RenderNotification;
      setNotifications(prev => [notification, ...prev]);
      
      return notification.id;
    } catch (error) {
      console.error("Error creating notification:", error);
      toast.error("Errore nella creazione della notifica");
      return null;
    }
  }, []);

  // Subscribe to realtime updates
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const subscribe = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      channel = supabase
        .channel('json2video-notifications')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'json2video_render_notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const updated = payload.new as RenderNotification;
            console.log('Notification update received:', updated);

            setNotifications(prev => 
              prev.map(n => n.id === updated.id ? updated : n)
            );

            // Handle completion
            if (updated.status === 'completed' && updated.video_url) {
              toast.success("🎬 Video pronto!", {
                description: "Il rendering è completato",
                action: {
                  label: "Visualizza",
                  onClick: () => window.open(updated.video_url, '_blank'),
                },
              });
              options.onComplete?.(updated);
            }

            // Handle error
            if (updated.status === 'failed') {
              toast.error("Rendering fallito", {
                description: updated.error_message || "Errore sconosciuto",
              });
              options.onError?.(updated);
            }
          }
        )
        .subscribe((status) => {
          setIsSubscribed(status === 'SUBSCRIBED');
          console.log('Notification subscription status:', status);
        });
    };

    subscribe();
    loadNotifications();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [loadNotifications, options.onComplete, options.onError]);

  // Get pending notifications count
  const pendingCount = notifications.filter(
    n => n.status === 'pending' || n.status === 'processing'
  ).length;

  return {
    notifications,
    isSubscribed,
    pendingCount,
    createNotification,
    loadNotifications,
  };
}
