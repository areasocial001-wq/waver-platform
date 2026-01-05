import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { 
  Video, 
  Image, 
  Layout, 
  History, 
  FileText, 
  Wand2,
  Activity,
  Database,
  Clock,
  CheckCircle,
  XCircle,
  Loader2
} from "lucide-react";
import { ApiStatusWidget } from "./ApiStatusWidget";
import { ApiUptimeChart } from "./ApiUptimeChart";
import { ApiThresholdSettings } from "./ApiThresholdSettings";
import { ApiMonitoringDashboard } from "./ApiMonitoringDashboard";
import { UsageCharts } from "./UsageCharts";
import { LogViewer } from "./LogViewer";
import { NotificationSettings } from "./NotificationSettings";
import { useApiMonitoring } from "@/hooks/useApiMonitoring";

interface Stats {
  totalVideos: number;
  completedVideos: number;
  pendingVideos: number;
  failedVideos: number;
  totalStoryboards: number;
  recentActivity: Array<{
    id: string;
    type: string;
    status: string;
    created_at: string;
    prompt?: string;
  }>;
}

export const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({
    totalVideos: 0,
    completedVideos: 0,
    pendingVideos: 0,
    failedVideos: 0,
    totalStoryboards: 0,
    recentActivity: []
  });
  const [loading, setLoading] = useState(true);
  
  const {
    apis,
    isRefreshing,
    thresholds,
    notifyOnChange,
    history,
    loadingHistory,
    checkApiStatus,
    saveSettings,
  } = useApiMonitoring();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: videos } = await supabase
          .from("video_generations")
          .select("id, status, type, created_at, prompt")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        const { count: storyboardCount } = await supabase
          .from("storyboards")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id);

        if (videos) {
          const completed = videos.filter(v => v.status === "completed").length;
          const pending = videos.filter(v => v.status === "pending" || v.status === "processing").length;
          const failed = videos.filter(v => v.status === "failed").length;

          setStats({
            totalVideos: videos.length,
            completedVideos: completed,
            pendingVideos: pending,
            failedVideos: failed,
            totalStoryboards: storyboardCount || 0,
            recentActivity: videos.slice(0, 5)
          });
        }
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "pending":
      case "processing":
        return <Loader2 className="w-4 h-4 text-yellow-500 animate-spin" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-destructive" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const quickActions = [
    { 
      icon: Video, 
      label: "Text to Video", 
      description: "Genera video da prompt",
      action: () => document.getElementById("generate")?.scrollIntoView({ behavior: "smooth" }),
      color: "text-primary"
    },
    { 
      icon: Image, 
      label: "Image to Video", 
      description: "Anima immagine",
      action: () => document.getElementById("generate")?.scrollIntoView({ behavior: "smooth" }),
      color: "text-secondary"
    },
    { 
      icon: Layout, 
      label: "Storyboard", 
      description: "Sequenze multi-scena",
      action: () => navigate("/my-storyboards"),
      color: "text-accent"
    },
    { 
      icon: Wand2, 
      label: "Workflow", 
      description: "Editor visuale",
      action: () => navigate("/freepik"),
      color: "text-primary"
    },
    { 
      icon: FileText, 
      label: "AI Content", 
      description: "Genera contenuti",
      action: () => navigate("/content-generator"),
      color: "text-secondary"
    },
    { 
      icon: History, 
      label: "Storico", 
      description: "Generazioni passate",
      action: () => navigate("/history"),
      color: "text-muted-foreground"
    }
  ];

  return (
    <section className="py-6">
      <div className="container mx-auto px-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-primary/10">
                  <Database className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-xl font-bold">{loading ? "-" : stats.totalVideos}</p>
                  <p className="text-xs text-muted-foreground">Video Totali</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-green-500/10">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                </div>
                <div>
                  <p className="text-xl font-bold">{loading ? "-" : stats.completedVideos}</p>
                  <p className="text-xs text-muted-foreground">Completati</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-yellow-500/10">
                  <Loader2 className="w-4 h-4 text-yellow-500" />
                </div>
                <div>
                  <p className="text-xl font-bold">{loading ? "-" : stats.pendingVideos}</p>
                  <p className="text-xs text-muted-foreground">In Corso</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-destructive/10">
                  <XCircle className="w-4 h-4 text-destructive" />
                </div>
                <div>
                  <p className="text-xl font-bold">{loading ? "-" : stats.failedVideos}</p>
                  <p className="text-xs text-muted-foreground">Falliti</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-accent/10">
                  <Layout className="w-4 h-4 text-accent" />
                </div>
                <div>
                  <p className="text-xl font-bold">{loading ? "-" : stats.totalStoryboards}</p>
                  <p className="text-xs text-muted-foreground">Storyboard</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="mb-6">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Azioni Rapide
          </h2>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {quickActions.map((action, index) => (
              <Card 
                key={index}
                className="bg-card/50 border-border/50 hover:border-primary/50 transition-all cursor-pointer group"
                onClick={action.action}
              >
                <CardContent className="p-3 text-center">
                  <action.icon className={`w-6 h-6 mx-auto mb-1 ${action.color} group-hover:scale-110 transition-transform`} />
                  <p className="font-medium text-xs">{action.label}</p>
                  <p className="text-[10px] text-muted-foreground">{action.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Full API Monitoring Dashboard */}
        <ApiMonitoringDashboard 
          apis={apis} 
          history={history} 
          isRefreshing={isRefreshing} 
          onRefresh={checkApiStatus} 
        />

        {/* Usage Charts and Threshold Settings */}
        <div className="grid lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2">
            <UsageCharts />
          </div>
          <ApiThresholdSettings 
            thresholds={thresholds} 
            notifyOnChange={notifyOnChange} 
            onSave={saveSettings} 
          />
        </div>

        {/* Logs and Notifications */}
        <div className="grid lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2">
            <LogViewer />
          </div>
          <NotificationSettings />
        </div>

        {/* Recent Activity and System Info */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                Attività Recente
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : stats.recentActivity.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">
                  Nessuna attività recente
                </p>
              ) : (
                <div className="space-y-2">
                  {stats.recentActivity.map((activity) => (
                    <div 
                      key={activity.id}
                      className="flex items-center gap-2 p-2 rounded-lg bg-background/50"
                    >
                      {getStatusIcon(activity.status)}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs truncate">
                          {activity.prompt?.substring(0, 35) || activity.type}...
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatDate(activity.created_at)}
                        </p>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        activity.status === "completed" ? "bg-green-500/10 text-green-500" :
                        activity.status === "failed" ? "bg-destructive/10 text-destructive" :
                        "bg-yellow-500/10 text-yellow-500"
                      }`}>
                        {activity.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Database className="w-4 h-4 text-primary" />
                Sistema
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between items-center p-2 rounded-lg bg-background/50">
                  <span className="text-xs">Provider Video</span>
                  <span className="text-xs font-medium text-primary">Replicate</span>
                </div>
                <div className="flex justify-between items-center p-2 rounded-lg bg-background/50">
                  <span className="text-xs">Modello AI</span>
                  <span className="text-xs font-medium text-primary">Waver 1.0</span>
                </div>
                <div className="flex justify-between items-center p-2 rounded-lg bg-background/50">
                  <span className="text-xs">Risoluzione Max</span>
                  <span className="text-xs font-medium">1080p</span>
                </div>
                <div className="flex justify-between items-center p-2 rounded-lg bg-background/50">
                  <span className="text-xs">Durata Max</span>
                  <span className="text-xs font-medium">10s</span>
                </div>
                <div className="flex justify-between items-center p-2 rounded-lg bg-background/50">
                  <span className="text-xs">Concat Engine</span>
                  <span className="text-xs font-medium text-primary">Shotstack</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};
