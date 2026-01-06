import { useState, useEffect } from "react";

const STORAGE_KEY = "video-provider-preference";

export const useProviderPreference = (defaultValue: string = "auto") => {
  const [preferredProvider, setPreferredProvider] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved || defaultValue;
    }
    return defaultValue;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, preferredProvider);
  }, [preferredProvider]);

  return [preferredProvider, setPreferredProvider] as const;
};
