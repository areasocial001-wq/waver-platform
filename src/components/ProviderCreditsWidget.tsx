import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RefreshCw, AlertTriangle, CheckCircle, XCircle, DollarSign, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ProviderStatus {
  name: string;
  hasKey: boolean;
  status: "active" | "exhausted" | "error" | "unknown" | "loading";
  credits?: number;
  creditsUsd?: number;
  usagePercent?: number;
  details?: string;
}

export const ProviderCreditsWidget = () => {
  const [providers, setProviders] = useState<ProviderStatus[]>([
    { name: "AIML API", hasKey: false, status: "loading" },
    { name: "PiAPI", hasKey: false, status: "loading" },
    { name: "ElevenLabs", hasKey: false, status: "loading" },
    { name: "Freepik", hasKey: false, status: "loading" },
    { name: "Google AI", hasKey: false, status: "loading" },
  ]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchAllBalances = useCallback(async () => {
    setIsRefreshing(true);
    
    const results: ProviderStatus[] = [];

    // Fetch health check for key status
    try {
      const { data: healthData } = await supabase.functions.invoke('generate-video', {
        body: { healthCheck: true }
      });

      // AIML API Balance
      try {
        const { data: aimlData } = await supabase.functions.invoke('aiml-balance');
        results.push({
          name: "AIML API",
          hasKey: healthData?.hasAIMLKey || false,
          status: aimlData?.status === "exhausted" ? "exhausted" : 
                  aimlData?.status === "active" ? "active" : "unknown",
          credits: aimlData?.credits,
          details: aimlData?.status === "exhausted" ? "Crediti esauriti" : undefined
        });
      } catch {
        results.push({ name: "AIML API", hasKey: healthData?.hasAIMLKey || false, status: "error" });
      }

      // PiAPI Balance
      try {
        const { data: piapiData } = await supabase.functions.invoke('piapi-balance');
        results.push({
          name: "PiAPI",
          hasKey: healthData?.hasPiAPIKey || false,
          status: piapiData?.equivalent_in_usd > 0 ? "active" : "exhausted",
          credits: piapiData?.credits,
          creditsUsd: piapiData?.equivalent_in_usd,
          details: `$${piapiData?.equivalent_in_usd?.toFixed(2) || '0.00'} disponibili`
        });
      } catch {
        results.push({ name: "PiAPI", hasKey: healthData?.hasPiAPIKey || false, status: "error" });
      }

      // ElevenLabs Balance
      try {
        const { data: elevenData } = await supabase.functions.invoke('elevenlabs-balance');
        results.push({
          name: "ElevenLabs",
          hasKey: elevenData?.hasKey || false,
          status: elevenData?.status === "active" ? "active" : "error",
          usagePercent: elevenData?.usage_percentage,
          details: elevenData?.characters_remaining 
            ? `${elevenData.characters_remaining.toLocaleString()} caratteri rimanenti`
            : undefined
        });
      } catch {
        results.push({ name: "ElevenLabs", hasKey: false, status: "error" });
      }

      // Freepik
      results.push({
        name: "Freepik",
        hasKey: healthData?.hasFreepikKey || false,
        status: healthData?.hasFreepikKey ? "active" : "unknown",
        details: healthData?.hasFreepikKey ? "Chiave configurata" : "Non configurato"
      });

      // Google AI
      results.push({
        name: "Google AI",
        hasKey: healthData?.hasGoogleKey || false,
        status: healthData?.hasGoogleKey ? "active" : "unknown",
        details: healthData?.hasGoogleKey ? "Chiave configurata" : "Non configurato"
      });

    } catch (error) {
      console.error("Error fetching provider balances:", error);
    }

    setProviders(results);
    setLastUpdate(new Date());
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    fetchAllBalances();
    // Refresh every 5 minutes
    const interval = setInterval(fetchAllBalances, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchAllBalances]);

  const getStatusIcon = (status: ProviderStatus["status"]) => {
    switch (status) {
      case "active":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "exhausted":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "error":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "loading":
        return <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: ProviderStatus["status"]) => {
    switch (status) {
      case "active":
        return <Badge variant="default" className="bg-green-500/20 text-green-500 border-green-500/30">Attivo</Badge>;
      case "exhausted":
        return <Badge variant="destructive">Esaurito</Badge>;
      case "error":
        return <Badge variant="outline" className="text-yellow-500 border-yellow-500/30">Errore</Badge>;
      case "loading":
        return <Badge variant="outline">Caricamento...</Badge>;
      default:
        return <Badge variant="secondary">Sconosciuto</Badge>;
    }
  };

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              Stato Crediti Provider
            </CardTitle>
            <CardDescription>
              Monitoraggio in tempo reale
              {lastUpdate && (
                <span className="ml-2 text-xs">
                  (Aggiornato: {lastUpdate.toLocaleTimeString('it-IT')})
                </span>
              )}
            </CardDescription>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={fetchAllBalances}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {providers.map((provider) => (
          <div 
            key={provider.name}
            className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/30"
          >
            <div className="flex items-center gap-3">
              {getStatusIcon(provider.status)}
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{provider.name}</span>
                  {!provider.hasKey && (
                    <Badge variant="outline" className="text-xs">Non configurato</Badge>
                  )}
                </div>
                {provider.details && (
                  <p className="text-xs text-muted-foreground">{provider.details}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {provider.usagePercent !== undefined && (
                <div className="w-20">
                  <Progress value={provider.usagePercent} className="h-2" />
                  <span className="text-xs text-muted-foreground">{provider.usagePercent}%</span>
                </div>
              )}
              {provider.creditsUsd !== undefined && (
                <span className="text-sm font-medium text-green-500">
                  ${provider.creditsUsd.toFixed(2)}
                </span>
              )}
              {getStatusBadge(provider.status)}
            </div>
          </div>
        ))}

        <div className="pt-2 border-t border-border/30">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Zap className="h-3 w-3" />
            <span>Il fallback automatico a PiAPI è attivo quando AIML API esaurisce i crediti</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
