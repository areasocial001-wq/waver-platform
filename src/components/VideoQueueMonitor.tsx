import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  TrendingUp,
  Activity,
  Timer,
  Zap
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
  avgProcessingTime: number;
  retrying: number;
}

export const VideoQueueMonitor = () => {
  const [stats, setStats] = useState<QueueStats>({
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    total: 0,
    avgProcessingTime: 0,
    retrying: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = async () => {
    try {
      // Fetch counts for each status
      const { data, error } = await supabase
        .from("video_generations")
        .select("status, created_at, updated_at, next_retry_at");

      if (error) throw error;

      const pending = data?.filter(v => v.status === "pending" && !v.next_retry_at).length || 0;
      const processing = data?.filter(v => v.status === "processing").length || 0;
      const completed = data?.filter(v => v.status === "completed").length || 0;
      const failed = data?.filter(v => v.status === "failed").length || 0;
      const retrying = data?.filter(v => v.status === "pending" && v.next_retry_at).length || 0;

      // Calculate average processing time for completed videos
      const completedVideos = data?.filter(v => v.status === "completed" && v.created_at && v.updated_at) || [];
      let avgTime = 0;
      if (completedVideos.length > 0) {
        const totalTime = completedVideos.reduce((acc, v) => {
          const created = new Date(v.created_at).getTime();
          const updated = new Date(v.updated_at).getTime();
          return acc + (updated - created);
        }, 0);
        avgTime = Math.round(totalTime / completedVideos.length / 1000); // Convert to seconds
      }

      setStats({
        pending,
        processing,
        completed,
        failed,
        total: data?.length || 0,
        avgProcessingTime: avgTime,
        retrying
      });
    } catch (error) {
      console.error("Error fetching queue stats:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    
    // Poll for updates every 10 seconds
    const interval = setInterval(fetchStats, 10000);
    
    // Subscribe to realtime changes
    const channel = supabase
      .channel('video-generations-stats')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'video_generations'
        },
        () => {
          fetchStats();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  const successRate = stats.total > 0 
    ? Math.round((stats.completed / (stats.completed + stats.failed)) * 100) || 0
    : 0;

  const activeCount = stats.pending + stats.processing + stats.retrying;

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  if (isLoading) {
    return (
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardContent className="p-4 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
      <CardContent className="p-0">
        {/* Header with live indicator */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-muted/30">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-accent" />
            <span className="font-medium text-sm">Monitor Coda Video</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-xs text-muted-foreground">Live</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-px bg-border/50">
          {/* In coda */}
          <div className="bg-card p-4 space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span className="text-xs">In coda</span>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-bold text-blue-500">{stats.pending}</span>
              {stats.pending > 0 && (
                <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-500 border-blue-500/30">
                  attesa
                </Badge>
              )}
            </div>
          </div>

          {/* In elaborazione */}
          <div className="bg-card p-4 space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs">In elaborazione</span>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-bold text-accent">{stats.processing}</span>
              {stats.processing > 0 && (
                <Badge variant="outline" className="text-xs bg-accent/10 text-accent border-accent/30">
                  attivo
                </Badge>
              )}
            </div>
          </div>

          {/* Retry in corso */}
          <div className="bg-card p-4 space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Timer className="w-4 h-4" />
              <span className="text-xs">Retry</span>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-bold text-yellow-500">{stats.retrying}</span>
              {stats.retrying > 0 && (
                <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-500 border-yellow-500/30">
                  backoff
                </Badge>
              )}
            </div>
          </div>

          {/* Completati */}
          <div className="bg-card p-4 space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle className="w-4 h-4" />
              <span className="text-xs">Completati</span>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-bold text-green-500">{stats.completed}</span>
            </div>
          </div>

          {/* Falliti */}
          <div className="bg-card p-4 space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <XCircle className="w-4 h-4" />
              <span className="text-xs">Falliti</span>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-bold text-destructive">{stats.failed}</span>
            </div>
          </div>

          {/* Success Rate */}
          <div className="bg-card p-4 space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs">Successo</span>
            </div>
            <div className="flex items-end gap-2">
              <span className={`text-2xl font-bold ${successRate >= 80 ? 'text-green-500' : successRate >= 50 ? 'text-yellow-500' : 'text-destructive'}`}>
                {successRate}%
              </span>
            </div>
          </div>

          {/* Tempo medio */}
          <div className="bg-card p-4 space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Zap className="w-4 h-4" />
              <span className="text-xs">Tempo medio</span>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-lg font-bold text-foreground">
                {stats.avgProcessingTime > 0 ? formatTime(stats.avgProcessingTime) : "N/A"}
              </span>
            </div>
          </div>
        </div>

        {/* Progress bar for active work */}
        {activeCount > 0 && (
          <div className="px-4 py-3 border-t border-border/50 bg-muted/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">
                {activeCount} video in lavorazione
              </span>
              <span className="text-xs text-muted-foreground">
                {stats.completed} / {stats.total} completati
              </span>
            </div>
            <Progress 
              value={stats.total > 0 ? (stats.completed / stats.total) * 100 : 0} 
              className="h-2" 
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};