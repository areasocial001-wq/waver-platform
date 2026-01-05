import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  Wifi, 
  WifiOff, 
  AlertCircle, 
  Loader2,
  ChevronDown,
  Server
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface ApiStatus {
  name: string;
  status: "online" | "offline" | "degraded" | "checking";
  responseTime?: number;
}

const API_LIST = [
  { name: "Replicate", endpoint: "generate-video" },
  { name: "Freepik", endpoint: "freepik-image" },
  { name: "ElevenLabs", endpoint: "elevenlabs-tts" },
  { name: "PIAPI", endpoint: "piapi-image" },
];

export const ApiStatusNavWidget = () => {
  const [apis, setApis] = useState<ApiStatus[]>(
    API_LIST.map(a => ({ name: a.name, status: "checking" as const }))
  );
  const [isOpen, setIsOpen] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const checkAllApis = useCallback(async () => {
    setApis(prev => prev.map(a => ({ ...a, status: "checking" as const })));
    
    const results = await Promise.all(
      API_LIST.map(async (api) => {
        const startTime = Date.now();
        try {
          const { error } = await supabase.functions.invoke(api.endpoint, {
            body: { healthCheck: true }
          });
          const responseTime = Date.now() - startTime;
          return {
            name: api.name,
            status: error ? "degraded" as const : "online" as const,
            responseTime
          };
        } catch {
          return {
            name: api.name,
            status: "offline" as const,
            responseTime: Date.now() - startTime
          };
        }
      })
    );
    
    setApis(results);
    setLastCheck(new Date());
  }, []);

  useEffect(() => {
    checkAllApis();
    const interval = setInterval(checkAllApis, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [checkAllApis]);

  const onlineCount = apis.filter(a => a.status === "online").length;
  const totalCount = apis.length;
  const allOnline = onlineCount === totalCount;
  const anyOffline = apis.some(a => a.status === "offline");
  const isChecking = apis.some(a => a.status === "checking");

  const getOverallIcon = () => {
    if (isChecking) return <Loader2 className="w-3.5 h-3.5 animate-spin" />;
    if (allOnline) return <Wifi className="w-3.5 h-3.5 text-green-500" />;
    if (anyOffline) return <WifiOff className="w-3.5 h-3.5 text-destructive" />;
    return <AlertCircle className="w-3.5 h-3.5 text-yellow-500" />;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online": return "bg-green-500";
      case "offline": return "bg-destructive";
      case "degraded": return "bg-yellow-500";
      default: return "bg-muted-foreground animate-pulse";
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button 
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all hover:bg-accent/50 ${
            allOnline ? "border-green-500/30 bg-green-500/5" :
            anyOffline ? "border-destructive/30 bg-destructive/5" :
            "border-yellow-500/30 bg-yellow-500/5"
          }`}
        >
          {getOverallIcon()}
          <span className={`text-xs font-medium ${
            allOnline ? "text-green-500" :
            anyOffline ? "text-destructive" :
            "text-yellow-500"
          }`}>
            {isChecking ? "..." : `${onlineCount}/${totalCount}`}
          </span>
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end">
        <div className="p-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Stato Servizi</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  checkAllApis();
                }}
                disabled={isChecking}
                className="p-1 rounded hover:bg-accent transition-colors disabled:opacity-50"
                title="Aggiorna stato"
              >
                <Loader2 className={`w-3.5 h-3.5 text-muted-foreground ${isChecking ? "animate-spin" : ""}`} />
              </button>
              <Badge variant="outline" className={`text-[10px] ${
                allOnline ? "bg-green-500/10 text-green-500 border-green-500/30" :
                anyOffline ? "bg-destructive/10 text-destructive border-destructive/30" :
                "bg-yellow-500/10 text-yellow-500 border-yellow-500/30"
              }`}>
                {allOnline ? "Tutto OK" : anyOffline ? "Problemi" : "Degradato"}
              </Badge>
            </div>
          </div>
          <Progress 
            value={(onlineCount / totalCount) * 100} 
            className="h-1 mt-2"
          />
        </div>
        
        <div className="p-2 space-y-1">
          {apis.map((api) => (
            <div 
              key={api.name}
              className="flex items-center justify-between p-2 rounded-md hover:bg-accent/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${getStatusColor(api.status)}`} />
                <span className="text-sm">{api.name}</span>
              </div>
              <div className="flex items-center gap-2">
                {api.responseTime && api.status !== "checking" && (
                  <span className={`text-[10px] ${
                    api.responseTime < 500 ? "text-green-500" :
                    api.responseTime < 1500 ? "text-yellow-500" :
                    "text-destructive"
                  }`}>
                    {api.responseTime}ms
                  </span>
                )}
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${
                  api.status === "online" ? "bg-green-500/10 text-green-500 border-0" :
                  api.status === "offline" ? "bg-destructive/10 text-destructive border-0" :
                  api.status === "degraded" ? "bg-yellow-500/10 text-yellow-500 border-0" :
                  "bg-muted text-muted-foreground border-0"
                }`}>
                  {api.status === "online" ? "OK" :
                   api.status === "offline" ? "OFF" :
                   api.status === "degraded" ? "SLOW" :
                   "..."}
                </Badge>
              </div>
            </div>
          ))}
        </div>
        
        {lastCheck && (
          <div className="px-3 py-2 border-t border-border bg-muted/30">
            <p className="text-[10px] text-muted-foreground text-center">
              Ultimo controllo: {lastCheck.toLocaleTimeString("it-IT")}
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
