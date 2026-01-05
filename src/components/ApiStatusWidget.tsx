import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Loader2,
  RotateCcw
} from "lucide-react";
import { ApiStatus } from "@/hooks/useApiMonitoring";

const MAX_RETRIES = 3;

interface ApiStatusWidgetProps {
  apis: ApiStatus[];
  isRefreshing: boolean;
  onRefresh: () => void;
}

export const ApiStatusWidget = ({ apis, isRefreshing, onRefresh }: ApiStatusWidgetProps) => {
  const getStatusIcon = (api: ApiStatus) => {
    switch (api.status) {
      case "online":
        return (
          <div className="relative">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          </div>
        );
      case "offline":
        return (
          <div className="relative">
            <XCircle className="w-4 h-4 text-destructive" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-destructive rounded-full" />
          </div>
        );
      case "degraded":
        return (
          <div className="relative">
            <AlertCircle className="w-4 h-4 text-yellow-500" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
          </div>
        );
      case "checking":
        return <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />;
      case "retrying":
        return (
          <div className="relative">
            <RotateCcw className="w-4 h-4 text-orange-500 animate-spin" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-orange-500 rounded-full animate-ping" />
          </div>
        );
    }
  };

  const getStatusBadge = (api: ApiStatus) => {
    switch (api.status) {
      case "online":
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30 gap-1">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            Online
          </Badge>
        );
      case "offline":
        return (
          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 gap-1">
            <span className="w-1.5 h-1.5 bg-destructive rounded-full" />
            Offline
          </Badge>
        );
      case "degraded":
        return (
          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30 gap-1">
            <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse" />
            Degradato
          </Badge>
        );
      case "checking":
        return (
          <Badge variant="outline" className="bg-muted text-muted-foreground">
            Verifica...
          </Badge>
        );
      case "retrying":
        return (
          <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/30 gap-1">
            <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-ping" />
            Retry {api.nextRetryIn ? `in ${api.nextRetryIn}s` : "..."}
          </Badge>
        );
    }
  };

  const getConnectionBar = (api: ApiStatus) => {
    const baseClasses = "h-1 rounded-full transition-all duration-500";
    switch (api.status) {
      case "online":
        return <div className={`${baseClasses} bg-green-500 w-full`} />;
      case "offline":
        return <div className={`${baseClasses} bg-destructive w-1/4`} />;
      case "degraded":
        return <div className={`${baseClasses} bg-yellow-500 w-3/4`} />;
      case "checking":
        return <div className={`${baseClasses} bg-muted-foreground w-1/2 animate-pulse`} />;
      case "retrying":
        return (
          <div className={`${baseClasses} bg-orange-500 animate-pulse`} 
               style={{ width: `${((MAX_RETRIES - api.retryCount) / MAX_RETRIES) * 100}%` }} />
        );
    }
  };

  const overallStatus = apis.every(a => a.status === "online") 
    ? "online" 
    : apis.some(a => a.status === "offline") 
      ? "offline" 
      : apis.some(a => a.status === "retrying")
        ? "retrying"
        : "degraded";

  const onlineCount = apis.filter(a => a.status === "online").length;

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              {overallStatus === "online" ? (
                <div className="relative">
                  <Wifi className="w-4 h-4 text-green-500" />
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                </div>
              ) : overallStatus === "retrying" ? (
                <div className="relative">
                  <Wifi className="w-4 h-4 text-orange-500" />
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-orange-500 rounded-full animate-ping" />
                </div>
              ) : (
                <WifiOff className="w-4 h-4 text-destructive" />
              )}
              Stato API Esterne
            </CardTitle>
            <CardDescription className="flex items-center gap-2">
              <span>Monitoraggio in tempo reale</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {onlineCount}/{apis.length} online
              </Badge>
            </CardDescription>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {apis.map((api) => (
            <div 
              key={api.name}
              className={`p-3 rounded-lg bg-background/50 transition-all duration-300 ${
                api.status === "retrying" ? "ring-1 ring-orange-500/30" : 
                api.status === "offline" ? "ring-1 ring-destructive/30" : ""
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  {getStatusIcon(api)}
                  <div>
                    <p className="text-sm font-medium">{api.name}</p>
                    <p className="text-xs text-muted-foreground">{api.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {api.responseTime !== undefined && (api.status === "online" || api.status === "degraded") && (
                    <span className={`text-xs ${
                      api.responseTime < 500 ? "text-green-500" :
                      api.responseTime < 1500 ? "text-yellow-500" :
                      "text-destructive"
                    }`}>
                      {api.responseTime}ms
                    </span>
                  )}
                  {api.retryCount > 0 && api.status === "retrying" && (
                    <span className="text-xs text-orange-500">
                      Tentativo {api.retryCount + 1}/{MAX_RETRIES + 1}
                    </span>
                  )}
                  {getStatusBadge(api)}
                </div>
              </div>
              {/* Connection strength bar */}
              <div className="h-1 bg-muted/30 rounded-full overflow-hidden">
                {getConnectionBar(api)}
              </div>
            </div>
          ))}
        </div>
        {apis[0]?.lastCheck && (
          <p className="text-xs text-muted-foreground mt-4 text-center">
            Ultimo controllo: {apis[0].lastCheck.toLocaleTimeString("it-IT")}
          </p>
        )}
      </CardContent>
    </Card>
  );
};
