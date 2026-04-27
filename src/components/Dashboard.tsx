import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  Loader2,
  ArrowRight
} from "lucide-react";
import { ApiStatusWidget } from "./ApiStatusWidget";
import { useApiMonitoring } from "@/hooks/useApiMonitoring";
import { useUserRole } from "@/hooks/useUserRole";
import { useQuotas } from "@/hooks/useQuotas";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle } from "lucide-react";

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
  const { isAdmin } = useUserRole();
  const { quota, usedGenerations, remainingGenerations, isUnlimited } = useQuotas();
  
  const { apis, isRefreshing, checkApiStatus } = useApiMonitoring();

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

  const onlineApis = apis.filter(a => a.status === "online").length;
  const totalApis = apis.length;

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

        {/* Video Generation Quota */}
        <Card className={`bg-card/50 mb-6 ${
          !isUnlimited && remainingGenerations <= 2 
            ? "border-destructive/50" 
            : !isUnlimited && remainingGenerations <= Math.ceil(quota.max_video_generations_monthly * 0.2) 
              ? "border-yellow-500/50" 
              : "border-border/50"
        }`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">Generazioni Video</span>
              </div>
              {isUnlimited ? (
                <Badge className="bg-primary/10 text-primary border-primary/30 text-xs">Illimitate</Badge>
              ) : (
                <span className="text-sm font-bold">
                  {remainingGenerations} / {quota.max_video_generations_monthly}
                  <span className="text-xs text-muted-foreground ml-1">rimanenti</span>
                </span>
              )}
            </div>
            {!isUnlimited && (
              <>
                <Progress 
                  value={(usedGenerations / quota.max_video_generations_monthly) * 100} 
                  className="h-2"
                />
                {remainingGenerations <= 2 && remainingGenerations > 0 && (
                  <div className="flex items-center gap-1.5 mt-2 text-destructive">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium">
                      Attenzione: solo {remainingGenerations} generazion{remainingGenerations === 1 ? "e" : "i"} rimast{remainingGenerations === 1 ? "a" : "e"}!
                    </span>
                  </div>
                )}
                {remainingGenerations === 0 && (
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-destructive font-medium flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Limite raggiunto
                    </span>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>


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

        {/* API Monitoring Widget + Recent Activity */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* API Status Widget */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  Monitoraggio API in Tempo Reale
                </CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-xs h-7"
                  onClick={() => navigate("/api-monitoring")}
                >
                  Dettagli
                  <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </div>
              <CardDescription className="text-xs">
                Stato delle API e servizi esterni
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${onlineApis === totalApis ? 'bg-green-500' : onlineApis > 0 ? 'bg-yellow-500' : 'bg-destructive'} animate-pulse`} />
                  <span className="text-sm font-medium">
                    {onlineApis}/{totalApis} Online
                  </span>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-7 text-xs"
                  onClick={checkApiStatus}
                  disabled={isRefreshing}
                >
                  {isRefreshing ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    "Aggiorna"
                  )}
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {apis.map((api) => (
                  <div 
                    key={api.name}
                    className="flex items-center justify-between p-2 rounded-lg bg-background/50"
                  >
                    <span className="text-xs font-medium">{api.name}</span>
                    <div className="flex items-center gap-1.5">
                      {api.responseTime && (
                        <span className="text-[10px] text-muted-foreground">
                          {api.responseTime}ms
                        </span>
                      )}
                      <div className={`w-2 h-2 rounded-full ${
                        api.status === "online" ? "bg-green-500" :
                        api.status === "degraded" ? "bg-yellow-500" :
                        api.status === "offline" ? "bg-destructive" :
                        api.status === "retrying" ? "bg-orange-500" :
                        "bg-muted-foreground"
                      }`} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
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
        </div>

        

        {/* System Info */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Database className="w-4 h-4 text-primary" />
              Sistema
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
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
    </section>
  );
};
