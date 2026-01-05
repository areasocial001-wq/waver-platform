import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePushNotifications } from "./usePushNotifications";
import { toast } from "sonner";

export interface ApiThresholds {
  warning: number;
  critical: number;
}

export interface ThresholdSettings {
  [apiName: string]: ApiThresholds;
}

export interface ApiStatus {
  name: string;
  status: "online" | "offline" | "degraded" | "checking" | "retrying";
  lastCheck: Date | null;
  responseTime?: number;
  description: string;
  retryCount: number;
  nextRetryIn?: number;
}

export interface ApiHistoryEntry {
  api_name: string;
  status: string;
  response_time: number | null;
  checked_at: string;
}

const MAX_RETRIES = 3;
const BASE_DELAY = 2000;
const DEFAULT_THRESHOLDS: ThresholdSettings = {
  Replicate: { warning: 1000, critical: 3000 },
  Freepik: { warning: 1000, critical: 3000 },
  Shotstack: { warning: 1000, critical: 3000 },
  ElevenLabs: { warning: 1000, critical: 3000 },
  "PIAPI Video": { warning: 1500, critical: 4000 },
  "PIAPI Image": { warning: 1500, critical: 4000 },
  "PIAPI Audio": { warning: 1500, critical: 4000 },
};

export const useApiMonitoring = () => {
  const [apis, setApis] = useState<ApiStatus[]>([
    { name: "Replicate", status: "checking", lastCheck: null, description: "Video AI (Waver)", retryCount: 0 },
    { name: "Freepik", status: "checking", lastCheck: null, description: "Image & Video", retryCount: 0 },
    { name: "Shotstack", status: "checking", lastCheck: null, description: "Video Concat", retryCount: 0 },
    { name: "ElevenLabs", status: "checking", lastCheck: null, description: "Audio/TTS/Music", retryCount: 0 },
    { name: "PIAPI Video", status: "checking", lastCheck: null, description: "Kling/Hailuo/Luma/Sora", retryCount: 0 },
    { name: "PIAPI Image", status: "checking", lastCheck: null, description: "Flux/Qwen/Nano", retryCount: 0 },
    { name: "PIAPI Audio", status: "checking", lastCheck: null, description: "Udio/DiffRhythm", retryCount: 0 },
  ]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [thresholds, setThresholds] = useState<ThresholdSettings>(DEFAULT_THRESHOLDS);
  const [notifyOnChange, setNotifyOnChange] = useState(true);
  const [history, setHistory] = useState<ApiHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  
  const retryTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const previousStatus = useRef<Map<string, string>>(new Map());
  const { showNotification, isEnabled: notificationsEnabled } = usePushNotifications();

  const getBackoffDelay = (retryCount: number): number => {
    return Math.min(BASE_DELAY * Math.pow(2, retryCount), 30000);
  };

  // Load user settings
  const loadSettings = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("api_threshold_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) {
        const thresholdsData = data.thresholds as unknown as ThresholdSettings;
        setThresholds(thresholdsData);
        setNotifyOnChange(data.notify_on_status_change);
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  }, []);

  // Save user settings
  const saveSettings = useCallback(async (newThresholds: ThresholdSettings, notify: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if settings exist
      const { data: existing } = await supabase
        .from("api_threshold_settings")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        // Update existing
        await supabase
          .from("api_threshold_settings")
          .update({
            thresholds: JSON.parse(JSON.stringify(newThresholds)),
            notify_on_status_change: notify,
          })
          .eq("user_id", user.id)
          .throwOnError();
      } else {
        // Insert new
        await supabase
          .from("api_threshold_settings")
          .insert([{
            user_id: user.id,
            thresholds: JSON.parse(JSON.stringify(newThresholds)),
            notify_on_status_change: notify,
          }])
          .throwOnError();
      }
      
      setThresholds(newThresholds);
      setNotifyOnChange(notify);
      toast.success("Impostazioni salvate");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Errore nel salvataggio");
    }
  }, []);

  // Load history for the last 24 hours
  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

      const { data } = await supabase
        .from("api_status_history")
        .select("api_name, status, response_time, checked_at")
        .eq("user_id", user.id)
        .gte("checked_at", twentyFourHoursAgo.toISOString())
        .order("checked_at", { ascending: true });

      if (data) {
        setHistory(data);
      }
    } catch (error) {
      console.error("Error loading history:", error);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  // Save status to history
  const saveToHistory = useCallback(async (apiName: string, status: string, responseTime?: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from("api_status_history").insert({
        user_id: user.id,
        api_name: apiName,
        status,
        response_time: responseTime || null,
      });
    } catch (error) {
      console.error("Error saving to history:", error);
    }
  }, []);

  // Check status change and send notification
  const checkStatusChange = useCallback((apiName: string, newStatus: string) => {
    const oldStatus = previousStatus.current.get(apiName);
    
    if (oldStatus && oldStatus !== newStatus && notifyOnChange && notificationsEnabled) {
      if (newStatus === "offline" && oldStatus === "online") {
        showNotification(
          `⚠️ ${apiName} Offline`,
          `Il servizio ${apiName} non è più raggiungibile. Verificheremo automaticamente.`
        );
      } else if (newStatus === "online" && oldStatus === "offline") {
        showNotification(
          `✅ ${apiName} Online`,
          `Il servizio ${apiName} è tornato operativo.`
        );
      }
    }
    
    previousStatus.current.set(apiName, newStatus);
  }, [notifyOnChange, notificationsEnabled, showNotification]);

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
        case "PIAPI Video":
          result = await supabase.functions.invoke("generate-video", {
            body: { healthCheck: true, provider: "kling" }
          });
          break;
        case "PIAPI Image":
          result = await supabase.functions.invoke("piapi-image", {
            body: { healthCheck: true }
          });
          break;
        case "PIAPI Audio":
          result = await supabase.functions.invoke("piapi-audio", {
            body: { healthCheck: true }
          });
          break;
      }
      
      responseTime = Date.now() - apiStartTime;
      
      // Check thresholds
      const apiThresholds = thresholds[apiName];
      if (result?.error) {
        status = "degraded";
      } else if (apiThresholds && responseTime >= apiThresholds.critical) {
        status = "degraded";
      } else {
        status = "online";
      }
    } catch {
      status = "offline";
      responseTime = Date.now() - apiStartTime;
    }

    return { status, responseTime, lastCheck: new Date() };
  }, [thresholds]);

  const retryApiCheck = useCallback(async (apiName: string, currentRetryCount: number) => {
    if (currentRetryCount >= MAX_RETRIES) {
      setApis(prev => prev.map(api => 
        api.name === apiName 
          ? { ...api, status: "offline" as const, retryCount: currentRetryCount, nextRetryIn: undefined }
          : api
      ));
      checkStatusChange(apiName, "offline");
      saveToHistory(apiName, "offline");
      toast.error(`${apiName}: Connessione fallita dopo ${MAX_RETRIES} tentativi`);
      return;
    }

    const delay = getBackoffDelay(currentRetryCount);
    
    setApis(prev => prev.map(api => 
      api.name === apiName 
        ? { ...api, status: "retrying" as const, retryCount: currentRetryCount, nextRetryIn: delay / 1000 }
        : api
    ));

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

    const timeout = setTimeout(async () => {
      clearInterval(countdownInterval);
      
      setApis(prev => prev.map(api => 
        api.name === apiName 
          ? { ...api, status: "checking" as const, nextRetryIn: undefined }
          : api
      ));

      const result = await checkSingleApi(apiName);
      
      if (result.status === "offline" || result.status === "degraded") {
        retryApiCheck(apiName, currentRetryCount + 1);
      } else {
        setApis(prev => prev.map(api => 
          api.name === apiName 
            ? { ...api, ...result, retryCount: 0, nextRetryIn: undefined }
            : api
        ));
        checkStatusChange(apiName, result.status || "online");
        saveToHistory(apiName, result.status || "online", result.responseTime);
        if (currentRetryCount > 0) {
          toast.success(`${apiName}: Connessione ripristinata`);
        }
      }
    }, delay);

    retryTimeouts.current.set(apiName, timeout);
  }, [checkSingleApi, checkStatusChange, saveToHistory]);

  const checkApiStatus = useCallback(async () => {
    retryTimeouts.current.forEach(timeout => clearTimeout(timeout));
    retryTimeouts.current.clear();

    setIsRefreshing(true);
    
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

    // Save to history and check for notifications
    results.forEach(result => {
      checkStatusChange(result.name, result.status || "offline");
      saveToHistory(result.name, result.status || "offline", result.responseTime);
      
      if (result.status === "offline" || result.status === "degraded") {
        retryApiCheck(result.name, 0);
      }
    });

    setIsRefreshing(false);
    loadHistory(); // Refresh history after check
  }, [apis, checkSingleApi, retryApiCheck, checkStatusChange, saveToHistory, loadHistory]);

  useEffect(() => {
    loadSettings();
    loadHistory();
  }, [loadSettings, loadHistory]);

  useEffect(() => {
    checkApiStatus();
    
    const interval = setInterval(checkApiStatus, 5 * 60 * 1000);
    
    return () => {
      clearInterval(interval);
      retryTimeouts.current.forEach(timeout => clearTimeout(timeout));
    };
  }, []);

  return {
    apis,
    isRefreshing,
    thresholds,
    notifyOnChange,
    history,
    loadingHistory,
    checkApiStatus,
    saveSettings,
  };
};
