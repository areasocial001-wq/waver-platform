import { useEffect, useState, useCallback, useRef } from "react";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ApiStatus {
  name: string;
  status: "online" | "offline" | "degraded" | "checking" | "retrying";
  lastCheck: Date | null;
  responseTime?: number;
  description: string;
  retryCount: number;
  nextRetryIn?: number;
}

const MAX_RETRIES = 3;
const BASE_DELAY = 2000; // 2 seconds

export const ApiStatusWidget = () => {
  const [apis, setApis] = useState<ApiStatus[]>([
    { name: "Replicate", status: "checking", lastCheck: null, description: "Video AI Generation", retryCount: 0 },
    { name: "Freepik", status: "checking", lastCheck: null, description: "Image Generation", retryCount: 0 },
    { name: "Shotstack", status: "checking", lastCheck: null, description: "Video Concat", retryCount: 0 },
    { name: "ElevenLabs", status: "checking", lastCheck: null, description: "Audio/TTS", retryCount: 0 },
  ]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const retryTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Exponential backoff delay calculation
  const getBackoffDelay = (retryCount: number): number => {
    return Math.min(BASE_DELAY * Math.pow(2, retryCount), 30000); // Max 30 seconds
  };

  const checkSingleApi = useCallback(async (apiName: string): Promise<Partial<ApiStatus>> => {
    const apiStartTime = Date.now();
    let status: "online" | "offline" | "degraded" = "online";
    let responseTime = 0;

    try {
      let result;
      switch (apiName) {
        case "Replicate":
          result = await supabase.functions.invoke("generate-video", {
            body: { healthCheck: true }
          });
          break;
        case "Freepik":
          result = await supabase.functions.invoke("freepik-image", {
            body: { healthCheck: true }
          });
          break;
        case "Shotstack":
          result = await supabase.functions.invoke("video-concat", {
            body: { healthCheck: true }
          });
          break;
        case "ElevenLabs":
          result = await supabase.functions.invoke("elevenlabs-tts", {
            body: { healthCheck: true }
          });
          break;
      }
      
      responseTime = Date.now() - apiStartTime;
      status = result?.error ? "degraded" : "online";
    } catch {
      status = "offline";
      responseTime = Date.now() - apiStartTime;
    }

    return { status, responseTime, lastCheck: new Date() };
  }, []);

  const retryApiCheck = useCallback(async (apiName: string, currentRetryCount: number) => {
    if (currentRetryCount >= MAX_RETRIES) {
      // Max retries reached, mark as offline
      setApis(prev => prev.map(api => 
        api.name === apiName 
          ? { ...api, status: "offline" as const, retryCount: currentRetryCount, nextRetryIn: undefined }
          : api
      ));
      toast.error(`${apiName}: Connessione fallita dopo ${MAX_RETRIES} tentativi`);
      return;
    }

    const delay = getBackoffDelay(currentRetryCount);
    
    // Update status to retrying with countdown
    setApis(prev => prev.map(api => 
      api.name === apiName 
        ? { ...api, status: "retrying" as const, retryCount: currentRetryCount, nextRetryIn: delay / 1000 }
        : api
    ));

    // Countdown timer
    let remainingTime = delay / 1000;
    const countdownInterval = setInterval(() => {
      remainingTime -= 1;
      if (remainingTime > 0) {
        setApis(prev => prev.map(api => 
          api.name === apiName 
            ? { ...api, nextRetryIn: remainingTime }
            : api
        ));
      }
    }, 1000);

    // Schedule retry
    const timeout = setTimeout(async () => {
      clearInterval(countdownInterval);
      
      setApis(prev => prev.map(api => 
        api.name === apiName 
          ? { ...api, status: "checking" as const, nextRetryIn: undefined }
          : api
      ));

      const result = await checkSingleApi(apiName);
      
      if (result.status === "offline" || result.status === "degraded") {
        // Retry again with incremented count
        retryApiCheck(apiName, currentRetryCount + 1);
      } else {
        // Success!
        setApis(prev => prev.map(api => 
          api.name === apiName 
            ? { ...api, ...result, retryCount: 0, nextRetryIn: undefined }
            : api
        ));
        if (currentRetryCount > 0) {
          toast.success(`${apiName}: Connessione ripristinata`);
        }
      }
    }, delay);

    retryTimeouts.current.set(apiName, timeout);
  }, [checkSingleApi]);

  const checkApiStatus = useCallback(async () => {
    // Clear any pending retries
    retryTimeouts.current.forEach(timeout => clearTimeout(timeout));
    retryTimeouts.current.clear();

    setIsRefreshing(true);
    
    // Set all to checking
    setApis(prev => prev.map(api => ({ 
      ...api, 
      status: "checking" as const, 
      retryCount: 0, 
      nextRetryIn: undefined 
    })));

    const results = await Promise.all(
      apis.map(async (api) => {
        const result = await checkSingleApi(api.name);
        return { name: api.name, ...result };
      })
    );

    // Update with results and start retries for failed ones
    setApis(prev => prev.map(api => {
      const result = results.find(r => r.name === api.name);
      return {
        ...api,
        status: result?.status || "offline",
        responseTime: result?.responseTime,
        lastCheck: result?.lastCheck || new Date(),
        retryCount: 0,
        nextRetryIn: undefined
      };
    }));

    // Start retry for failed APIs
    results.forEach(result => {
      if (result.status === "offline" || result.status === "degraded") {
        retryApiCheck(result.name, 0);
      }
    });

    setIsRefreshing(false);
  }, [apis, checkSingleApi, retryApiCheck]);

  useEffect(() => {
    // Initial check
    checkApiStatus();
    
    // Check every 5 minutes
    const interval = setInterval(checkApiStatus, 5 * 60 * 1000);
    
    return () => {
      clearInterval(interval);
      retryTimeouts.current.forEach(timeout => clearTimeout(timeout));
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      retryTimeouts.current.forEach(timeout => clearTimeout(timeout));
    };
  }, []);

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
            onClick={checkApiStatus}
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
