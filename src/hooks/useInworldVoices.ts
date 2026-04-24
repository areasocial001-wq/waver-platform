import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface InworldVoice {
  voiceId: string;          // ID to send to inworld-tts
  displayName: string;      // Human-readable name
  description?: string;
  langCode?: string;
  tags?: string[];
  source: "SYSTEM" | "IVC"; // IVC = Instant Voice Cloned
}

interface CacheEntry {
  ts: number;
  voices: InworldVoice[];
}

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: CacheEntry | null = null;
const listeners = new Set<(v: InworldVoice[]) => void>();

function normalize(raw: any): InworldVoice {
  return {
    voiceId: String(raw.voiceId ?? raw.voice_id ?? raw.name ?? ""),
    displayName: String(raw.displayName ?? raw.display_name ?? raw.name ?? raw.voiceId ?? "Voice"),
    description: raw.description ?? undefined,
    langCode: raw.langCode ?? raw.lang_code ?? undefined,
    tags: Array.isArray(raw.tags) ? raw.tags : undefined,
    source: raw.source === "IVC" ? "IVC" : "SYSTEM",
  };
}

/**
 * Hook: load Inworld voices (SYSTEM + IVC) from the inworld-list-voices edge
 * function and keep them cached in-memory across the app.
 */
export function useInworldVoices(opts: { autoload?: boolean } = { autoload: true }) {
  const [voices, setVoices] = useState<InworldVoice[]>(cache?.voices ?? []);
  const [isLoading, setIsLoading] = useState<boolean>(!cache);
  const [error, setError] = useState<string | null>(null);

  const fetchVoices = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && cache && now - cache.ts < CACHE_TTL_MS) {
      setVoices(cache.voices);
      setIsLoading(false);
      return cache.voices;
    }
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("inworld-list-voices", {
        method: "GET",
      });
      if (fnError) throw fnError;
      const raw: any[] = Array.isArray(data?.voices) ? data.voices : [];
      const normalized = raw.map(normalize).filter(v => v.voiceId);
      cache = { ts: now, voices: normalized };
      setVoices(normalized);
      listeners.forEach(l => l(normalized));
      return normalized;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[useInworldVoices] error:", message);
      setError(message);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (opts.autoload !== false) fetchVoices();
    const listener = (v: InworldVoice[]) => setVoices(v);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, [fetchVoices, opts.autoload]);

  const systemVoices = voices.filter(v => v.source === "SYSTEM");
  const ivcVoices = voices.filter(v => v.source === "IVC");

  return {
    voices,
    systemVoices,
    ivcVoices,
    isLoading,
    error,
    refresh: () => fetchVoices(true),
  };
}

/**
 * Fetch a base64-encoded preview MP3 for an Inworld voice. Returns the blob URL
 * (caller is responsible for revoking it).
 */
export async function fetchInworldVoicePreview(
  voiceId: string,
  opts: { langCode?: string; text?: string } = {},
): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Sessione non valida");

  const params = new URLSearchParams({ voiceId });
  // Default to Italian so cloned voices (IVC) like "Marina Official" preview
  // in their native language/accent instead of the server-side English default.
  params.set("langCode", opts.langCode ?? "IT");
  if (opts.text) params.set("text", opts.text);
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/inworld-voice-preview?${params.toString()}`;
  const resp = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`Preview fallita: ${resp.status} ${body.slice(0, 180)}`);
  }
  const json = await resp.json();
  if (!json?.audioContent) throw new Error("Preview senza audio");
  const binary = atob(json.audioContent);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: "audio/mpeg" });
  return URL.createObjectURL(blob);
}
