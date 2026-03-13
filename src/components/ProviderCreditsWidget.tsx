import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RefreshCw, AlertTriangle, CheckCircle, XCircle, DollarSign, Zap, Bell, BellOff, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface ProviderStatus {
  name: string;
  hasKey: boolean;
  status: "active" | "exhausted" | "error" | "unknown" | "loading";
  credits?: number;
  creditsUsd?: number;
  usagePercent?: number;
  details?: string;
  supportedModels?: string[];
}

interface CreditThresholds {
  piapiUsd: number;
  elevenlabsPercent: number;
  enabled: boolean;
}

const DEFAULT_THRESHOLDS: CreditThresholds = {
  piapiUsd: 1.00,
  elevenlabsPercent: 80,
  enabled: true,
};

const STORAGE_KEY = "credit-alert-thresholds";

export const ProviderCreditsWidget = () => {
  const [providers, setProviders] = useState<ProviderStatus[]>([
    { name: "AIML API", hasKey: false, status: "loading" },
    { name: "PiAPI", hasKey: false, status: "loading" },
    { name: "ElevenLabs", hasKey: false, status: "loading" },
    { name: "Freepik", hasKey: false, status: "loading" },
    { name: "Google AI", hasKey: false, status: "loading" },
    { name: "Vidu", hasKey: false, status: "loading" },
    { name: "LTX Video", hasKey: false, status: "loading" },
  ]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [thresholds, setThresholds] = useState<CreditThresholds>(DEFAULT_THRESHOLDS);
  
  const { isEnabled: notificationsEnabled, showNotification, requestPermission } = usePushNotifications();
  
  // Track which alerts have been sent to avoid spam
  const alertsSent = useRef<Set<string>>(new Set());

  // Load thresholds from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setThresholds(JSON.parse(saved));
      } catch {
        // Use defaults
      }
    }
  }, []);

  // Save thresholds to localStorage
  const saveThresholds = (newThresholds: CreditThresholds) => {
    setThresholds(newThresholds);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newThresholds));
    toast.success("Soglie salvate!");
  };

  // Check thresholds and send notifications
  const checkThresholdsAndNotify = useCallback((results: ProviderStatus[]) => {
    if (!thresholds.enabled || !notificationsEnabled) return;

    results.forEach(provider => {
      const alertKey = `${provider.name}-${Date.now().toString().slice(0, -5)}`; // Reset every ~30 seconds
      
      // AIML exhausted alert
      if (provider.name === "AIML API" && provider.status === "exhausted") {
        const key = "aiml-exhausted";
        if (!alertsSent.current.has(key)) {
          showNotification(
            "⚠️ AIML API - Crediti Esauriti",
            "I crediti AIML sono esauriti. Il sistema utilizzerà automaticamente PiAPI come fallback."
          );
          alertsSent.current.add(key);
        }
      }

      // PiAPI low balance alert
      if (provider.name === "PiAPI" && provider.creditsUsd !== undefined) {
        if (provider.creditsUsd <= thresholds.piapiUsd && provider.creditsUsd > 0) {
          const key = "piapi-low";
          if (!alertsSent.current.has(key)) {
            showNotification(
              "💰 PiAPI - Crediti Bassi",
              `Il saldo PiAPI è sceso a $${provider.creditsUsd.toFixed(2)}. Considera di ricaricare.`
            );
            alertsSent.current.add(key);
          }
        }
        if (provider.creditsUsd <= 0) {
          const key = "piapi-exhausted";
          if (!alertsSent.current.has(key)) {
            showNotification(
              "🚨 PiAPI - Crediti Esauriti",
              "I crediti PiAPI sono esauriti! La generazione video potrebbe non funzionare."
            );
            alertsSent.current.add(key);
          }
        }
      }

      // ElevenLabs high usage alert
      if (provider.name === "ElevenLabs" && provider.usagePercent !== undefined) {
        if (provider.usagePercent >= thresholds.elevenlabsPercent) {
          const key = "elevenlabs-high";
          if (!alertsSent.current.has(key)) {
            showNotification(
              "🎙️ ElevenLabs - Utilizzo Elevato",
              `Hai utilizzato il ${provider.usagePercent}% della quota mensile ElevenLabs.`
            );
            alertsSent.current.add(key);
          }
        }
      }
    });
  }, [thresholds, notificationsEnabled, showNotification]);

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
          details: aimlData?.status === "exhausted" ? "Crediti esauriti" : undefined,
          supportedModels: ["Wan", "Kling", "Flux"]
        });
      } catch {
        results.push({ name: "AIML API", hasKey: healthData?.hasAIMLKey || false, status: "error", supportedModels: ["Wan", "Kling", "Flux"] });
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
          details: `$${piapiData?.equivalent_in_usd?.toFixed(2) || '0.00'} disponibili`,
          supportedModels: ["Wan", "Kling", "Luma", "SkyReels", "Framepack"]
        });
      } catch {
        results.push({ name: "PiAPI", hasKey: healthData?.hasPiAPIKey || false, status: "error", supportedModels: ["Wan", "Kling", "Luma", "SkyReels", "Framepack"] });
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
            : undefined,
          supportedModels: ["TTS", "Voice Clone", "Music"]
        });
      } catch {
        results.push({ name: "ElevenLabs", hasKey: false, status: "error", supportedModels: ["TTS", "Voice Clone", "Music"] });
      }

      // Freepik
      results.push({
        name: "Freepik",
        hasKey: healthData?.hasFreepikKey || false,
        status: healthData?.hasFreepikKey ? "active" : "unknown",
        details: healthData?.hasFreepikKey ? "Chiave configurata" : "Non configurato",
        supportedModels: ["Magnific", "Image", "Video", "Stock"]
      });

      // Google AI
      results.push({
        name: "Google AI",
        hasKey: healthData?.hasGoogleKey || false,
        status: healthData?.hasGoogleKey ? "active" : "unknown",
        details: healthData?.hasGoogleKey ? "Chiave configurata" : "Non configurato",
        supportedModels: ["Gemini", "Veo"]
      });

      // Vidu Account Info
      try {
        const { data: viduData } = await supabase.functions.invoke('vidu-video', {
          body: { action: 'account' }
        });
        const hasViduKey = !!viduData && !viduData.error;
        results.push({
          name: "Vidu",
          hasKey: hasViduKey,
          status: hasViduKey ? "active" : "unknown",
          credits: viduData?.credits,
          details: hasViduKey 
            ? `${viduData?.credits ?? 'N/A'} crediti disponibili`
            : "Non configurato",
          supportedModels: ["Q3 Pro", "Q3 Turbo", "Q2", "Q1"]
        });
      } catch {
        results.push({ name: "Vidu", hasKey: false, status: "error", supportedModels: ["Q3 Pro", "Q3 Turbo", "Q2", "Q1"] });
      }

      // LTX Video Health Check
      try {
        const { data: ltxData } = await supabase.functions.invoke('ltx-video', {
          body: { healthCheck: true }
        });
        const hasLtxKey = !!ltxData && ltxData.hasKey;
        results.push({
          name: "LTX Video",
          hasKey: hasLtxKey,
          status: hasLtxKey ? "active" : "unknown",
          details: hasLtxKey ? "Chiave configurata" : "Non configurato",
          supportedModels: ["2.3 Pro", "2.3 Fast", "2 Pro", "2 Fast"]
        });
      } catch {
        results.push({ name: "LTX Video", hasKey: false, status: "error", supportedModels: ["2.3 Pro", "2.3 Fast", "2 Pro", "2 Fast"] });
      }

    } catch (error) {
      console.error("Error fetching provider balances:", error);
    }

    setProviders(results);
    setLastUpdate(new Date());
    setIsRefreshing(false);

    // Check thresholds and send notifications
    checkThresholdsAndNotify(results);
  }, [checkThresholdsAndNotify]);

  useEffect(() => {
    fetchAllBalances();
    // Refresh every 5 minutes
    const interval = setInterval(fetchAllBalances, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchAllBalances]);

  // Reset alerts when thresholds change
  useEffect(() => {
    alertsSent.current.clear();
  }, [thresholds]);

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

  const handleEnableNotifications = async () => {
    const granted = await requestPermission();
    if (granted) {
      saveThresholds({ ...thresholds, enabled: true });
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
          <div className="flex items-center gap-2">
            {/* Notification Settings Popover */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="relative">
                  {thresholds.enabled && notificationsEnabled ? (
                    <Bell className="h-4 w-4 text-green-500" />
                  ) : (
                    <BellOff className="h-4 w-4 text-muted-foreground" />
                  )}
                  {thresholds.enabled && notificationsEnabled && (
                    <span className="absolute -top-1 -right-1 h-2 w-2 bg-green-500 rounded-full" />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    <h4 className="font-medium">Soglie di Allerta</h4>
                  </div>

                  {!notificationsEnabled ? (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Abilita le notifiche per ricevere avvisi quando i crediti scendono sotto le soglie critiche.
                      </p>
                      <Button onClick={handleEnableNotifications} className="w-full">
                        <Bell className="h-4 w-4 mr-2" />
                        Abilita Notifiche
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="alerts-enabled" className="text-sm">Notifiche Attive</Label>
                        <Switch
                          id="alerts-enabled"
                          checked={thresholds.enabled}
                          onCheckedChange={(checked) => saveThresholds({ ...thresholds, enabled: checked })}
                        />
                      </div>

                      <div className="space-y-3 pt-2 border-t">
                        <div className="space-y-2">
                          <Label htmlFor="piapi-threshold" className="text-sm">
                            PiAPI - Soglia USD
                          </Label>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">$</span>
                            <Input
                              id="piapi-threshold"
                              type="number"
                              step="0.5"
                              min="0"
                              value={thresholds.piapiUsd}
                              onChange={(e) => saveThresholds({ 
                                ...thresholds, 
                                piapiUsd: parseFloat(e.target.value) || 0 
                              })}
                              className="h-8"
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Notifica quando il saldo scende sotto questa soglia
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="elevenlabs-threshold" className="text-sm">
                            ElevenLabs - Utilizzo %
                          </Label>
                          <div className="flex items-center gap-2">
                            <Input
                              id="elevenlabs-threshold"
                              type="number"
                              step="5"
                              min="0"
                              max="100"
                              value={thresholds.elevenlabsPercent}
                              onChange={(e) => saveThresholds({ 
                                ...thresholds, 
                                elevenlabsPercent: parseInt(e.target.value) || 0 
                              })}
                              className="h-8"
                            />
                            <span className="text-muted-foreground">%</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Notifica quando l'utilizzo supera questa percentuale
                          </p>
                        </div>
                      </div>

                      <div className="pt-2 text-xs text-muted-foreground">
                        💡 Le notifiche per AIML esaurito sono sempre attive
                      </div>
                    </>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            <Button 
              variant="ghost" 
              size="sm" 
              onClick={fetchAllBalances}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
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
                  {provider.supportedModels && provider.supportedModels.length > 0 && (
                    <div className="flex gap-1">
                      {provider.supportedModels.map((model) => (
                        <Badge 
                          key={model} 
                          variant="secondary" 
                          className="text-[10px] px-1.5 py-0 h-4 bg-primary/10 text-primary border-primary/20"
                        >
                          {model}
                        </Badge>
                      ))}
                    </div>
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
                  <Progress 
                    value={provider.usagePercent} 
                    className={`h-2 ${provider.usagePercent >= thresholds.elevenlabsPercent ? '[&>div]:bg-orange-500' : ''}`} 
                  />
                  <span className={`text-xs ${provider.usagePercent >= thresholds.elevenlabsPercent ? 'text-orange-500' : 'text-muted-foreground'}`}>
                    {provider.usagePercent}%
                  </span>
                </div>
              )}
              {provider.creditsUsd !== undefined && (
                <span className={`text-sm font-medium ${
                  provider.creditsUsd <= thresholds.piapiUsd 
                    ? provider.creditsUsd <= 0 ? 'text-red-500' : 'text-orange-500'
                    : 'text-green-500'
                }`}>
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
          {thresholds.enabled && notificationsEnabled && (
            <div className="flex items-center gap-2 text-xs text-green-600 mt-1">
              <Bell className="h-3 w-3" />
              <span>Notifiche attive per soglie critiche</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
