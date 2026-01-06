import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertTriangle, CheckCircle, XCircle, RefreshCw, ChevronDown, Bug, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface DiagnosticEntry {
  id: string;
  timestamp: Date;
  type: "success" | "error" | "warning" | "info";
  service: string;
  message: string;
  details?: string;
}

interface PiAPIBalance {
  credits: number;
  equivalent_in_usd: number;
  account_name: string;
}

export const DiagnosticsPanel = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [entries, setEntries] = useState<DiagnosticEntry[]>([]);
  const [piapiBalance, setPiapiBalance] = useState<PiAPIBalance | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchPiapiBalance = async () => {
    setIsLoadingBalance(true);
    try {
      const { data, error } = await supabase.functions.invoke('piapi-balance');
      if (error) throw error;
      setPiapiBalance(data);
    } catch (error) {
      console.error("Error fetching PiAPI balance:", error);
      addEntry({
        type: "error",
        service: "piapi-balance",
        message: "Errore nel recupero saldo PiAPI",
        details: error instanceof Error ? error.message : "Errore sconosciuto"
      });
    } finally {
      setIsLoadingBalance(false);
    }
  };

  const addEntry = (entry: Omit<DiagnosticEntry, "id" | "timestamp">) => {
    const newEntry: DiagnosticEntry = {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: new Date()
    };
    setEntries(prev => [newEntry, ...prev].slice(0, 50)); // Keep last 50 entries
  };

  // Intercept fetch errors for specific endpoints
  useEffect(() => {
    const originalFetch = window.fetch;
    
    window.fetch = async (...args) => {
      const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;
      const startTime = Date.now();
      
      try {
        const response = await originalFetch(...args);
        const duration = Date.now() - startTime;
        
        // Only log for our edge functions
        if (url.includes('/functions/v1/generate-video') || 
            url.includes('/functions/v1/video-proxy') ||
            url.includes('/functions/v1/piapi-')) {
          
          const service = url.includes('generate-video') ? 'generate-video' :
                         url.includes('video-proxy') ? 'video-proxy' :
                         url.includes('piapi-balance') ? 'piapi-balance' :
                         url.includes('piapi-') ? 'piapi' : 'unknown';
          
          if (!response.ok) {
            let errorDetails = `Status: ${response.status}`;
            try {
              const clone = response.clone();
              const body = await clone.text();
              if (body) {
                const parsed = JSON.parse(body);
                errorDetails = parsed.error || parsed.message || body.slice(0, 200);
              }
            } catch {}
            
            addEntry({
              type: "error",
              service,
              message: `Errore ${response.status}`,
              details: errorDetails
            });
          } else if (duration > 5000) {
            addEntry({
              type: "warning",
              service,
              message: `Risposta lenta (${(duration/1000).toFixed(1)}s)`,
            });
          }
        }
        
        return response;
      } catch (error) {
        if (url.includes('/functions/v1/')) {
          const service = url.includes('generate-video') ? 'generate-video' :
                         url.includes('video-proxy') ? 'video-proxy' :
                         url.includes('piapi-') ? 'piapi' : 'edge-function';
          
          addEntry({
            type: "error",
            service,
            message: "Errore di rete",
            details: error instanceof Error ? error.message : "Impossibile raggiungere il server"
          });
        }
        throw error;
      }
    };
    
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  // Initial balance fetch
  useEffect(() => {
    if (isOpen) {
      fetchPiapiBalance();
    }
  }, [isOpen]);

  const refreshAll = async () => {
    setIsRefreshing(true);
    await fetchPiapiBalance();
    
    // Health check generate-video
    try {
      const { data, error } = await supabase.functions.invoke('generate-video', {
        body: { healthCheck: true }
      });
      
      if (error) throw error;
      
      addEntry({
        type: "success",
        service: "generate-video",
        message: "Servizio operativo",
        details: `PiAPI Key: ${data.hasPiAPIKey ? '✓' : '✗'}`
      });
    } catch (error) {
      addEntry({
        type: "error",
        service: "generate-video",
        message: "Servizio non raggiungibile",
        details: error instanceof Error ? error.message : "Errore sconosciuto"
      });
    }
    
    setIsRefreshing(false);
  };

  const getIcon = (type: DiagnosticEntry["type"]) => {
    switch (type) {
      case "success": return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "error": return <XCircle className="h-4 w-4 text-destructive" />;
      case "warning": return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default: return <Bug className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getBadgeVariant = (type: DiagnosticEntry["type"]) => {
    switch (type) {
      case "success": return "default";
      case "error": return "destructive";
      case "warning": return "secondary";
      default: return "outline";
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full flex items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2">
            <Bug className="h-4 w-4" />
            <span>Diagnostica</span>
            {entries.filter(e => e.type === "error").length > 0 && (
              <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                {entries.filter(e => e.type === "error").length}
              </Badge>
            )}
          </div>
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </Button>
      </CollapsibleTrigger>
      
      <CollapsibleContent>
        <Card className="mt-2 border-dashed">
          <CardHeader className="pb-2 pt-3 px-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Status Servizi</CardTitle>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={refreshAll}
                disabled={isRefreshing}
                className="h-7 px-2"
              >
                <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardHeader>
          
          <CardContent className="px-3 pb-3 space-y-3">
            {/* PiAPI Balance */}
            <div className={`flex items-center justify-between p-2 rounded-md text-sm ${
              piapiBalance && piapiBalance.equivalent_in_usd < 1 
                ? 'bg-destructive/10 border border-destructive/30' 
                : 'bg-muted/50'
            }`}>
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                <span>Saldo PiAPI</span>
              </div>
              {isLoadingBalance ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
              ) : piapiBalance ? (
                <span className={`font-mono font-medium ${
                  piapiBalance.equivalent_in_usd < 1 ? 'text-destructive' : 'text-green-600'
                }`}>
                  ${piapiBalance.equivalent_in_usd.toFixed(2)}
                </span>
              ) : (
                <span className="text-muted-foreground">N/A</span>
              )}
            </div>

            {/* Error Log */}
            {entries.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium">Log recenti</p>
                <ScrollArea className="h-32 rounded-md border">
                  <div className="p-2 space-y-1">
                    {entries.map((entry) => (
                      <div 
                        key={entry.id} 
                        className="flex items-start gap-2 text-xs p-1.5 rounded hover:bg-muted/50"
                      >
                        {getIcon(entry.type)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant={getBadgeVariant(entry.type)} className="text-[10px] px-1 py-0">
                              {entry.service}
                            </Badge>
                            <span className="text-muted-foreground">
                              {format(entry.timestamp, "HH:mm:ss")}
                            </span>
                          </div>
                          <p className="text-foreground truncate">{entry.message}</p>
                          {entry.details && (
                            <p className="text-muted-foreground truncate text-[10px]">{entry.details}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {entries.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">
                Nessun evento registrato
              </p>
            )}
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
};
