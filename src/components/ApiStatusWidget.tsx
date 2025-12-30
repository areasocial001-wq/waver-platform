import { useEffect, useState } from "react";
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
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ApiStatus {
  name: string;
  status: "online" | "offline" | "degraded" | "checking";
  lastCheck: Date | null;
  responseTime?: number;
  description: string;
}

export const ApiStatusWidget = () => {
  const [apis, setApis] = useState<ApiStatus[]>([
    { name: "Replicate", status: "checking", lastCheck: null, description: "Video AI Generation" },
    { name: "Freepik", status: "checking", lastCheck: null, description: "Image Generation" },
    { name: "Shotstack", status: "checking", lastCheck: null, description: "Video Concat" },
    { name: "ElevenLabs", status: "checking", lastCheck: null, description: "Audio/TTS" },
  ]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const checkApiStatus = async () => {
    setIsRefreshing(true);
    const startTime = Date.now();

    const updatedApis = await Promise.all(
      apis.map(async (api) => {
        try {
          let status: "online" | "offline" | "degraded" = "online";
          let responseTime = 0;

          const apiStartTime = Date.now();

          // Test each API with a lightweight request
          switch (api.name) {
            case "Replicate":
              try {
                const { data, error } = await supabase.functions.invoke("generate-video", {
                  body: { healthCheck: true }
                });
                responseTime = Date.now() - apiStartTime;
                status = error ? "degraded" : "online";
              } catch {
                status = "offline";
              }
              break;
            case "Freepik":
              try {
                const { data, error } = await supabase.functions.invoke("freepik-image", {
                  body: { healthCheck: true }
                });
                responseTime = Date.now() - apiStartTime;
                status = error ? "degraded" : "online";
              } catch {
                status = "offline";
              }
              break;
            case "Shotstack":
              try {
                const { data, error } = await supabase.functions.invoke("video-concat", {
                  body: { healthCheck: true }
                });
                responseTime = Date.now() - apiStartTime;
                status = error ? "degraded" : "online";
              } catch {
                status = "offline";
              }
              break;
            case "ElevenLabs":
              try {
                const { data, error } = await supabase.functions.invoke("elevenlabs-tts", {
                  body: { healthCheck: true }
                });
                responseTime = Date.now() - apiStartTime;
                status = error ? "degraded" : "online";
              } catch {
                status = "offline";
              }
              break;
          }

          return {
            ...api,
            status,
            responseTime,
            lastCheck: new Date()
          };
        } catch {
          return {
            ...api,
            status: "offline" as const,
            lastCheck: new Date()
          };
        }
      })
    );

    setApis(updatedApis);
    setIsRefreshing(false);
  };

  useEffect(() => {
    // Initial check
    checkApiStatus();
    
    // Check every 5 minutes
    const interval = setInterval(checkApiStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: ApiStatus["status"]) => {
    switch (status) {
      case "online":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "offline":
        return <XCircle className="w-4 h-4 text-destructive" />;
      case "degraded":
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case "checking":
        return <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />;
    }
  };

  const getStatusBadge = (status: ApiStatus["status"]) => {
    switch (status) {
      case "online":
        return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">Online</Badge>;
      case "offline":
        return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">Offline</Badge>;
      case "degraded":
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30">Degradato</Badge>;
      case "checking":
        return <Badge variant="outline" className="bg-muted text-muted-foreground">Verifica...</Badge>;
    }
  };

  const overallStatus = apis.every(a => a.status === "online") 
    ? "online" 
    : apis.some(a => a.status === "offline") 
      ? "offline" 
      : "degraded";

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              {overallStatus === "online" ? (
                <Wifi className="w-4 h-4 text-green-500" />
              ) : (
                <WifiOff className="w-4 h-4 text-destructive" />
              )}
              Stato API Esterne
            </CardTitle>
            <CardDescription>Monitoraggio servizi in tempo reale</CardDescription>
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
              className="flex items-center justify-between p-3 rounded-lg bg-background/50"
            >
              <div className="flex items-center gap-3">
                {getStatusIcon(api.status)}
                <div>
                  <p className="text-sm font-medium">{api.name}</p>
                  <p className="text-xs text-muted-foreground">{api.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {api.responseTime !== undefined && api.status !== "checking" && (
                  <span className="text-xs text-muted-foreground">
                    {api.responseTime}ms
                  </span>
                )}
                {getStatusBadge(api.status)}
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
