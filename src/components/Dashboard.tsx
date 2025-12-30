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
  Loader2
} from "lucide-react";

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

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch video stats
        const { data: videos } = await supabase
          .from("video_generations")
          .select("id, status, type, created_at, prompt")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        // Fetch storyboard count
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
      description: "Genera video da prompt testuale",
      action: () => document.getElementById("generate")?.scrollIntoView({ behavior: "smooth" }),
      color: "text-primary"
    },
    { 
      icon: Image, 
      label: "Image to Video", 
      description: "Anima un'immagine statica",
      action: () => document.getElementById("generate")?.scrollIntoView({ behavior: "smooth" }),
      color: "text-secondary"
    },
    { 
      icon: Layout, 
      label: "Storyboard", 
      description: "Crea sequenze multi-scena",
      action: () => navigate("/my-storyboards"),
      color: "text-accent"
    },
    { 
      icon: Wand2, 
      label: "Workflow Editor", 
      description: "Editor visuale avanzato",
      action: () => navigate("/freepik"),
      color: "text-primary"
    },
    { 
      icon: FileText, 
      label: "AI Content", 
      description: "Genera contenuti con AI",
      action: () => navigate("/content-generator"),
      color: "text-secondary"
    },
    { 
      icon: History, 
      label: "Storico", 
      description: "Visualizza generazioni passate",
      action: () => navigate("/history"),
      color: "text-muted-foreground"
    }
  ];

  return (
    <section className="py-8">
      <div className="container mx-auto px-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Database className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{loading ? "-" : stats.totalVideos}</p>
                  <p className="text-xs text-muted-foreground">Video Totali</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{loading ? "-" : stats.completedVideos}</p>
                  <p className="text-xs text-muted-foreground">Completati</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-500/10">
                  <Loader2 className="w-5 h-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{loading ? "-" : stats.pendingVideos}</p>
                  <p className="text-xs text-muted-foreground">In Corso</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <XCircle className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{loading ? "-" : stats.failedVideos}</p>
                  <p className="text-xs text-muted-foreground">Falliti</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent/10">
                  <Layout className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{loading ? "-" : stats.totalStoryboards}</p>
                  <p className="text-xs text-muted-foreground">Storyboard</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Azioni Rapide
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {quickActions.map((action, index) => (
              <Card 
                key={index}
                className="bg-card/50 border-border/50 hover:border-primary/50 transition-all cursor-pointer group"
                onClick={action.action}
              >
                <CardContent className="p-4 text-center">
                  <action.icon className={`w-8 h-8 mx-auto mb-2 ${action.color} group-hover:scale-110 transition-transform`} />
                  <p className="font-medium text-sm">{action.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{action.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                Attività Recente
              </CardTitle>
              <CardDescription>Ultime 5 generazioni video</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : stats.recentActivity.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nessuna attività recente
                </p>
              ) : (
                <div className="space-y-3">
                  {stats.recentActivity.map((activity) => (
                    <div 
                      key={activity.id}
                      className="flex items-center gap-3 p-2 rounded-lg bg-background/50"
                    >
                      {getStatusIcon(activity.status)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">
                          {activity.prompt?.substring(0, 40) || activity.type}
                          {activity.prompt && activity.prompt.length > 40 ? "..." : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(activity.created_at)}
                        </p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${
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
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="w-4 h-4 text-primary" />
                Informazioni Sistema
              </CardTitle>
              <CardDescription>Stato della piattaforma</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-2 rounded-lg bg-background/50">
                  <span className="text-sm">Provider Video</span>
                  <span className="text-sm font-medium text-primary">Replicate API</span>
                </div>
                <div className="flex justify-between items-center p-2 rounded-lg bg-background/50">
                  <span className="text-sm">Modello AI</span>
                  <span className="text-sm font-medium text-primary">Waver 1.0</span>
                </div>
                <div className="flex justify-between items-center p-2 rounded-lg bg-background/50">
                  <span className="text-sm">Risoluzione Max</span>
                  <span className="text-sm font-medium">1080p</span>
                </div>
                <div className="flex justify-between items-center p-2 rounded-lg bg-background/50">
                  <span className="text-sm">Durata Max</span>
                  <span className="text-sm font-medium">10 secondi</span>
                </div>
                <div className="flex justify-between items-center p-2 rounded-lg bg-background/50">
                  <span className="text-sm">Workflow Engine</span>
                  <span className="text-sm font-medium text-primary">React Flow</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};
