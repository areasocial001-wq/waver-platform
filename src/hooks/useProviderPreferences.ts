import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  ProviderPreferences, 
  OperationType, 
  ProviderType, 
  DEFAULT_PREFERENCES,
  resolveAutoProvider 
} from "@/lib/providerConfig";

const LOCAL_STORAGE_KEY = "ai-provider-preferences";

export function useProviderPreferences() {
  const [preferences, setPreferences] = useState<ProviderPreferences>(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // Load preferences from localStorage on mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        // Check for authenticated user
        const { data: { user } } = await supabase.auth.getUser();
        setUserId(user?.id || null);

        // Load from localStorage
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          setPreferences({ ...DEFAULT_PREFERENCES, ...parsed });
        }
      } catch (error) {
        console.error("Error loading provider preferences:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPreferences();
  }, []);

  // Save preferences to localStorage
  const savePreferences = useCallback((newPreferences: ProviderPreferences) => {
    setPreferences(newPreferences);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newPreferences));
  }, []);

  // Update a single preference
  const setProviderForOperation = useCallback((
    operation: OperationType, 
    provider: ProviderType
  ) => {
    const newPreferences = { ...preferences, [operation]: provider };
    savePreferences(newPreferences);
  }, [preferences, savePreferences]);

  // Get the effective provider for an operation (resolves 'auto')
  const getEffectiveProvider = useCallback((operation: OperationType): ProviderType => {
    const pref = preferences[operation];
    if (pref === 'auto') {
      return resolveAutoProvider(operation);
    }
    return pref;
  }, [preferences]);

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    savePreferences(DEFAULT_PREFERENCES);
  }, [savePreferences]);

  return {
    preferences,
    isLoading,
    userId,
    setProviderForOperation,
    getEffectiveProvider,
    resetToDefaults,
    savePreferences,
  };
}
