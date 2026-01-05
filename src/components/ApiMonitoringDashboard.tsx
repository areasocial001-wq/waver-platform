import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Activity,
  Wifi, 
  WifiOff, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Loader2,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  Clock,
  Zap,
  Server,
  Globe
} from "lucide-react";
import { ApiStatus, ApiHistoryEntry } from "@/hooks/useApiMonitoring";
import { useMemo } from "react";

interface ApiMonitoringDashboardProps {
  apis: ApiStatus[];
  history: ApiHistoryEntry[];
  isRefreshing: boolean;
  onRefresh: () => void;
}

export const ApiMonitoringDashboard = ({ apis, history, isRefreshing, onRefresh }: ApiMonitoringDashboardProps) => {
  // Calculate uptime percentages
  const uptimeStats = useMemo(() => {
    const stats: Record<string, { uptime: number; avgResponseTime: number; checks: number }> = {};
    
    apis.forEach(api => {
      const apiHistory = history.filter(h => h.api_name === api.name);
      const onlineChecks = apiHistory.filter(h => h.status === "online").length;
      const totalChecks = apiHistory.length || 1;
      const avgTime = apiHistory.reduce((sum, h) => sum + (h.response_time || 0), 0) / totalChecks;
      
      stats[api.name] = {
        uptime: (onlineChecks / totalChecks) * 100,
        avgResponseTime: Math.round(avgTime),
        checks: totalChecks
      };
    });
    
    return stats;
  }, [apis, history]);

  // Overall system health
  const systemHealth = useMemo(() => {
    const online = apis.filter(a => a.status === "online").length;
    const total = apis.length;
    const percentage = (online / total) * 100;
    
    return {
      online,
      total,
      percentage,
      status: percentage === 100 ? "healthy" : percentage >= 50 ? "degraded" : "critical"
    };
  }, [apis]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online": return "text-green-500";
      case "offline": return "text-destructive";
      case "degraded": return "text-yellow-500";
      case "retrying": return "text-orange-500";
      default: return "text-muted-foreground";
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case "online": return "bg-green-500/10";
      case "offline": return "bg-destructive/10";
      case "degraded": return "bg-yellow-500/10";
      case "retrying": return "bg-orange-500/10";
      default: return "bg-muted/10";
    }
  };

  const getResponseTimeColor = (time: number) => {
    if (time < 500) return "text-green-500";
    if (time < 1500) return "text-yellow-500";
    return "text-destructive";
  };

  return (
    <div className="space-y-6">
      {/* System Health Overview */}
      <Card className="bg-gradient-to-br from-card via-card to-primary/5 border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                Monitoraggio API in Tempo Reale
              </CardTitle>
              <CardDescription className="mt-1">
                Stato di salute del sistema e performance delle API
              </CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onRefresh}
              disabled={isRefreshing}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
              Aggiorna
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Overall Status */}
            <div className={`p-4 rounded-xl ${
              systemHealth.status === "healthy" ? "bg-green-500/10 border border-green-500/30" :
              systemHealth.status === "degraded" ? "bg-yellow-500/10 border border-yellow-500/30" :
              "bg-destructive/10 border border-destructive/30"
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {systemHealth.status === "healthy" ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : systemHealth.status === "degraded" ? (
                  <AlertCircle className="w-5 h-5 text-yellow-500" />
                ) : (
                  <XCircle className="w-5 h-5 text-destructive" />
                )}
                <span className="text-sm font-medium">Stato Sistema</span>
              </div>
              <p className={`text-2xl font-bold ${
                systemHealth.status === "healthy" ? "text-green-500" :
                systemHealth.status === "degraded" ? "text-yellow-500" :
                "text-destructive"
              }`}>
                {systemHealth.status === "healthy" ? "Operativo" :
                 systemHealth.status === "degraded" ? "Degradato" : "Critico"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {systemHealth.online}/{systemHealth.total} servizi online
              </p>
            </div>

            {/* Uptime Average */}
            <div className="p-4 rounded-xl bg-primary/10 border border-primary/30">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium">Uptime Medio</span>
              </div>
              <p className="text-2xl font-bold text-primary">
                {(Object.values(uptimeStats).reduce((sum, s) => sum + s.uptime, 0) / apis.length || 0).toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">Ultime 24 ore</p>
            </div>

            {/* Average Response Time */}
            <div className="p-4 rounded-xl bg-secondary/10 border border-secondary/30">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-5 h-5 text-secondary" />
                <span className="text-sm font-medium">Tempo Medio</span>
              </div>
              <p className="text-2xl font-bold text-secondary">
                {Math.round(Object.values(uptimeStats).reduce((sum, s) => sum + s.avgResponseTime, 0) / apis.length) || 0}ms
              </p>
              <p className="text-xs text-muted-foreground mt-1">Response time</p>
            </div>

            {/* Total Checks */}
            <div className="p-4 rounded-xl bg-accent/10 border border-accent/30">
              <div className="flex items-center gap-2 mb-2">
                <Server className="w-5 h-5 text-accent" />
                <span className="text-sm font-medium">Controlli</span>
              </div>
              <p className="text-2xl font-bold text-accent">
                {history.length}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Health checks totali</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Individual API Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {apis.map((api) => {
          const stats = uptimeStats[api.name] || { uptime: 0, avgResponseTime: 0, checks: 0 };
          
          return (
            <Card key={api.name} className={`relative overflow-hidden transition-all duration-300 ${
              api.status === "retrying" ? "ring-1 ring-orange-500/50" : 
              api.status === "offline" ? "ring-1 ring-destructive/50" : 
              ""
            }`}>
              {/* Status indicator bar */}
              <div className={`absolute top-0 left-0 right-0 h-1 ${
                api.status === "online" ? "bg-green-500" :
                api.status === "offline" ? "bg-destructive" :
                api.status === "degraded" ? "bg-yellow-500" :
                api.status === "retrying" ? "bg-orange-500 animate-pulse" :
                "bg-muted"
              }`} />
              
              <CardHeader className="pb-2 pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${getStatusBgColor(api.status)}`}>
                      {api.status === "checking" ? (
                        <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
                      ) : api.status === "retrying" ? (
                        <RotateCcw className="w-5 h-5 text-orange-500 animate-spin" />
                      ) : api.status === "online" ? (
                        <Globe className="w-5 h-5 text-green-500" />
                      ) : api.status === "offline" ? (
                        <WifiOff className="w-5 h-5 text-destructive" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-yellow-500" />
                      )}
                    </div>
                    <div>
                      <CardTitle className="text-base">{api.name}</CardTitle>
                      <CardDescription className="text-xs">{api.description}</CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className={`${getStatusBgColor(api.status)} ${getStatusColor(api.status)} border-0`}>
                    {api.status === "online" ? "Online" :
                     api.status === "offline" ? "Offline" :
                     api.status === "degraded" ? "Lento" :
                     api.status === "retrying" ? `Retry ${api.retryCount + 1}` :
                     "Verifica..."}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Response Time */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Response Time</span>
                  <span className={`text-sm font-medium ${
                    api.responseTime ? getResponseTimeColor(api.responseTime) : "text-muted-foreground"
                  }`}>
                    {api.responseTime ? `${api.responseTime}ms` : "-"}
                  </span>
                </div>

                {/* Uptime Progress */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Uptime 24h</span>
                    <span className="text-xs font-medium">{stats.uptime.toFixed(1)}%</span>
                  </div>
                  <Progress 
                    value={stats.uptime} 
                    className="h-1.5"
                  />
                </div>

                {/* Stats Row */}
                <div className="flex items-center justify-between text-xs pt-2 border-t border-border/50">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>Avg: {stats.avgResponseTime}ms</span>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Activity className="w-3 h-3" />
                    <span>{stats.checks} controlli</span>
                  </div>
                </div>

                {/* Retry countdown */}
                {api.status === "retrying" && api.nextRetryIn && (
                  <div className="flex items-center justify-center gap-2 p-2 rounded-lg bg-orange-500/10 text-orange-500 text-xs">
                    <RotateCcw className="w-3 h-3 animate-spin" />
                    Prossimo tentativo in {api.nextRetryIn}s
                  </div>
                )}

                {/* Last check */}
                {api.lastCheck && (
                  <p className="text-[10px] text-muted-foreground text-center">
                    Ultimo controllo: {api.lastCheck.toLocaleTimeString("it-IT")}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Timeline of recent events */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Eventi Recenti
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {history.slice(-10).reverse().map((event, idx) => (
              <div key={idx} className="flex items-center gap-3 p-2 rounded-lg bg-background/50">
                <div className={`w-2 h-2 rounded-full ${
                  event.status === "online" ? "bg-green-500" :
                  event.status === "offline" ? "bg-destructive" :
                  "bg-yellow-500"
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{event.api_name}</p>
                </div>
                <Badge variant="outline" className={`text-xs ${
                  event.status === "online" ? "bg-green-500/10 text-green-500" :
                  event.status === "offline" ? "bg-destructive/10 text-destructive" :
                  "bg-yellow-500/10 text-yellow-500"
                } border-0`}>
                  {event.status}
                </Badge>
                {event.response_time && (
                  <span className="text-xs text-muted-foreground">
                    {event.response_time}ms
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {new Date(event.checked_at).toLocaleTimeString("it-IT", { 
                    hour: "2-digit", 
                    minute: "2-digit" 
                  })}
                </span>
              </div>
            ))}
            {history.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nessun evento registrato
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
