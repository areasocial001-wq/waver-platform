import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Activity,
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Loader2,
  Clock,
  Zap,
  Video,
  TrendingUp,
  TrendingDown,
  BarChart3,
  FileVideo
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { VIDEO_PROVIDERS } from "@/lib/videoProviderConfig";

interface ModelStats {
  modelId: string;
  modelName: string;
  provider: string;
  totalCalls: number;
  successCount: number;
  errorCount: number;
  avgDuration: number;
  lastCall: Date | null;
  lastStatus: "success" | "error" | "pending";
  recentErrors: string[];
}

interface AIMLLogEntry {
  id: string;
  timestamp: Date;
  modelId: string;
  modelName: string;
  status: "success" | "error" | "pending";
  duration: number;
  errorMessage?: string;
  prompt?: string;
}

export const AIMLApiMonitor = () => {
  const [logs, setLogs] = useState<AIMLLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Get AI/ML API providers from config
  const aimlProviders = useMemo(() => {
    return Object.entries(VIDEO_PROVIDERS)
      .filter(([_, config]) => config.group === "aiml")
      .map(([id, config]) => ({
        id,
        name: config.name,
        modelId: config.modelId
      }));
  }, []);

  const fetchLogs = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      // Fetch API logs related to AI/ML API
      const { data, error } = await supabase
        .from("api_logs")
        .select("*")
        .eq("user_id", userData.user.id)
        .eq("api_name", "AI/ML API")
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;

      const parsedLogs: AIMLLogEntry[] = (data || []).map(log => {
        const details = log.details as Record<string, unknown> || {};
        return {
          id: log.id,
          timestamp: new Date(log.created_at),
          modelId: (details.modelId as string) || "unknown",
          modelName: (details.modelName as string) || log.operation || "Unknown Model",
          status: log.status === "success" ? "success" : log.status === "error" ? "error" : "pending",
          duration: log.duration_ms || 0,
          errorMessage: log.status === "error" ? log.message : undefined,
          prompt: (details.prompt as string) || undefined
        };
      });

      setLogs(parsedLogs);
    } catch (error) {
      console.error("Error fetching AI/ML logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchLogs();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // Calculate stats per model
  const modelStats = useMemo((): ModelStats[] => {
    const statsMap = new Map<string, ModelStats>();

    // Initialize with all known AI/ML providers
    aimlProviders.forEach(provider => {
      statsMap.set(provider.modelId || provider.id, {
        modelId: provider.modelId || provider.id,
        modelName: provider.name,
        provider: "AI/ML API",
        totalCalls: 0,
        successCount: 0,
        errorCount: 0,
        avgDuration: 0,
        lastCall: null,
        lastStatus: "pending",
        recentErrors: []
      });
    });

    // Process logs
    logs.forEach(log => {
      const key = log.modelId || log.modelName;
      let stats = statsMap.get(key);
      
      if (!stats) {
        stats = {
          modelId: key,
          modelName: log.modelName,
          provider: "AI/ML API",
          totalCalls: 0,
          successCount: 0,
          errorCount: 0,
          avgDuration: 0,
          lastCall: null,
          lastStatus: "pending",
          recentErrors: []
        };
        statsMap.set(key, stats);
      }

      stats.totalCalls++;
      if (log.status === "success") {
        stats.successCount++;
      } else if (log.status === "error") {
        stats.errorCount++;
        if (log.errorMessage && stats.recentErrors.length < 3) {
          stats.recentErrors.push(log.errorMessage);
        }
      }

      stats.avgDuration = ((stats.avgDuration * (stats.totalCalls - 1)) + log.duration) / stats.totalCalls;

      if (!stats.lastCall || log.timestamp > stats.lastCall) {
        stats.lastCall = log.timestamp;
        stats.lastStatus = log.status;
      }
    });

    return Array.from(statsMap.values()).sort((a, b) => b.totalCalls - a.totalCalls);
  }, [logs, aimlProviders]);

  // Overall stats
  const overallStats = useMemo(() => {
    const total = logs.length;
    const success = logs.filter(l => l.status === "success").length;
    const errors = logs.filter(l => l.status === "error").length;
    const avgDuration = logs.reduce((sum, l) => sum + l.duration, 0) / (total || 1);
    
    return {
      total,
      success,
      errors,
      successRate: total > 0 ? (success / total) * 100 : 0,
      avgDuration: Math.round(avgDuration)
    };
  }, [logs]);

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 90) return "text-green-500";
    if (rate >= 70) return "text-yellow-500";
    return "text-destructive";
  };

  const getSuccessRateBg = (rate: number) => {
    if (rate >= 90) return "bg-green-500/10";
    if (rate >= 70) return "bg-yellow-500/10";
    return "bg-destructive/10";
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <Video className="w-5 h-5 text-primary" />
              Monitor AI/ML API
            </CardTitle>
            <CardDescription className="mt-1">
              Statistiche di successo/errore per ogni modello video AI/ML
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={refreshing}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            Aggiorna
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Overall Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-primary/10 border border-primary/30">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium">Chiamate Totali</span>
            </div>
            <p className="text-2xl font-bold text-primary">{overallStats.total}</p>
          </div>

          <div className={`p-4 rounded-xl ${getSuccessRateBg(overallStats.successRate)} border ${
            overallStats.successRate >= 90 ? "border-green-500/30" :
            overallStats.successRate >= 70 ? "border-yellow-500/30" :
            "border-destructive/30"
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5" />
              <span className="text-sm font-medium">Success Rate</span>
            </div>
            <p className={`text-2xl font-bold ${getSuccessRateColor(overallStats.successRate)}`}>
              {overallStats.successRate.toFixed(1)}%
            </p>
          </div>

          <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-sm font-medium">Successi</span>
            </div>
            <p className="text-2xl font-bold text-green-500">{overallStats.success}</p>
          </div>

          <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="w-5 h-5 text-destructive" />
              <span className="text-sm font-medium">Errori</span>
            </div>
            <p className="text-2xl font-bold text-destructive">{overallStats.errors}</p>
          </div>
        </div>

        <Tabs defaultValue="models" className="space-y-4">
          <TabsList className="grid w-full max-w-sm grid-cols-2">
            <TabsTrigger value="models">Per Modello</TabsTrigger>
            <TabsTrigger value="logs">Log Recenti</TabsTrigger>
          </TabsList>

          <TabsContent value="models" className="space-y-4">
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {modelStats.map((stats) => {
                  const successRate = stats.totalCalls > 0 
                    ? (stats.successCount / stats.totalCalls) * 100 
                    : 0;

                  return (
                    <Card key={stats.modelId} className="bg-card/50 border-border/50">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${
                              stats.lastStatus === "success" ? "bg-green-500/10" :
                              stats.lastStatus === "error" ? "bg-destructive/10" :
                              "bg-muted/10"
                            }`}>
                              <FileVideo className={`w-5 h-5 ${
                                stats.lastStatus === "success" ? "text-green-500" :
                                stats.lastStatus === "error" ? "text-destructive" :
                                "text-muted-foreground"
                              }`} />
                            </div>
                            <div>
                              <h4 className="font-medium">{stats.modelName}</h4>
                              <p className="text-xs text-muted-foreground">{stats.modelId}</p>
                            </div>
                          </div>
                          <Badge variant="outline" className={`${
                            stats.totalCalls === 0 ? "bg-muted/10 text-muted-foreground" :
                            successRate >= 90 ? "bg-green-500/10 text-green-500" :
                            successRate >= 70 ? "bg-yellow-500/10 text-yellow-500" :
                            "bg-destructive/10 text-destructive"
                          } border-0`}>
                            {stats.totalCalls === 0 ? "Non usato" : `${successRate.toFixed(0)}%`}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-4 gap-3 mb-3">
                          <div className="text-center p-2 rounded-lg bg-background/50">
                            <p className="text-lg font-bold">{stats.totalCalls}</p>
                            <p className="text-[10px] text-muted-foreground">Totali</p>
                          </div>
                          <div className="text-center p-2 rounded-lg bg-green-500/5">
                            <p className="text-lg font-bold text-green-500">{stats.successCount}</p>
                            <p className="text-[10px] text-muted-foreground">Successi</p>
                          </div>
                          <div className="text-center p-2 rounded-lg bg-destructive/5">
                            <p className="text-lg font-bold text-destructive">{stats.errorCount}</p>
                            <p className="text-[10px] text-muted-foreground">Errori</p>
                          </div>
                          <div className="text-center p-2 rounded-lg bg-primary/5">
                            <p className="text-lg font-bold text-primary">{Math.round(stats.avgDuration)}ms</p>
                            <p className="text-[10px] text-muted-foreground">Media</p>
                          </div>
                        </div>

                        {stats.totalCalls > 0 && (
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Success Rate</span>
                              <span className={getSuccessRateColor(successRate)}>
                                {successRate.toFixed(1)}%
                              </span>
                            </div>
                            <Progress 
                              value={successRate} 
                              className="h-1.5"
                            />
                          </div>
                        )}

                        {stats.recentErrors.length > 0 && (
                          <div className="mt-3 p-2 rounded-lg bg-destructive/5 border border-destructive/20">
                            <p className="text-xs font-medium text-destructive mb-1">Errori recenti:</p>
                            {stats.recentErrors.map((err, idx) => (
                              <p key={idx} className="text-[10px] text-muted-foreground truncate">
                                • {err}
                              </p>
                            ))}
                          </div>
                        )}

                        {stats.lastCall && (
                          <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Ultima chiamata: {stats.lastCall.toLocaleString("it-IT")}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}

                {modelStats.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Video className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Nessun dato disponibile</p>
                    <p className="text-sm">Genera qualche video per vedere le statistiche</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="logs">
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-2">
                {logs.slice(0, 50).map((log) => (
                  <div 
                    key={log.id} 
                    className="flex items-center gap-3 p-3 rounded-lg bg-background/50 hover:bg-background/80 transition-colors"
                  >
                    <div className={`w-2 h-2 rounded-full ${
                      log.status === "success" ? "bg-green-500" :
                      log.status === "error" ? "bg-destructive" :
                      "bg-yellow-500"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{log.modelName}</p>
                      {log.prompt && (
                        <p className="text-xs text-muted-foreground truncate max-w-[300px]">
                          {log.prompt}
                        </p>
                      )}
                      {log.errorMessage && (
                        <p className="text-xs text-destructive truncate">
                          {log.errorMessage}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline" className={`text-xs ${
                      log.status === "success" ? "bg-green-500/10 text-green-500" :
                      log.status === "error" ? "bg-destructive/10 text-destructive" :
                      "bg-yellow-500/10 text-yellow-500"
                    } border-0`}>
                      {log.status === "success" ? "OK" : log.status === "error" ? "ERR" : "..."}
                    </Badge>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {log.duration}ms
                    </span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {log.timestamp.toLocaleTimeString("it-IT", { 
                        hour: "2-digit", 
                        minute: "2-digit" 
                      })}
                    </span>
                  </div>
                ))}

                {logs.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Nessun log disponibile</p>
                    <p className="text-sm">I log appariranno qui dopo le chiamate API</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
