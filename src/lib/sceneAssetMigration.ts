import { supabase } from "@/integrations/supabase/client";
import type { StoryScene } from "@/components/story-mode/types";

/**
 * Detects whether a URL is a heavy inline asset that should be uploaded to storage.
 * - data:* URIs (base64) — can be megabytes per scene
 * - blob:* URIs — local-only, become invalid across sessions
 */
const isHeavyInlineUrl = (url: string | undefined | null): url is string =>
  !!url && (url.startsWith("data:") || url.startsWith("blob:"));

const guessExtension = (url: string, fallback: string): string => {
  // From data: URI, e.g. data:audio/mpeg;base64,...
  const m = url.match(/^data:([^;]+);/);
  if (m) {
    const mime = m[1];
    if (mime.includes("png")) return "png";
    if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
    if (mime.includes("webp")) return "webp";
    if (mime.includes("mp4")) return "mp4";
    if (mime.includes("webm")) return "webm";
    if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
    if (mime.includes("wav")) return "wav";
  }
  return fallback;
};

const guessContentType = (url: string, kind: AssetKind): string => {
  const m = url.match(/^data:([^;]+);/);
  if (m) return m[1];
  switch (kind) {
    case "image": return "image/jpeg";
    case "video": return "video/mp4";
    case "audio":
    case "sfx": return "audio/mpeg";
  }
};

type AssetKind = "image" | "video" | "audio" | "sfx";

const defaultExtFor: Record<AssetKind, string> = {
  image: "jpg",
  video: "mp4",
  audio: "mp3",
  sfx: "mp3",
};

/**
 * Uploads a single inline asset (base64 / blob) to the story-references bucket
 * and returns the public URL. Returns null on failure (caller should keep original).
 */
async function uploadInlineAsset(
  userId: string,
  projectId: string,
  sceneNumber: number,
  kind: AssetKind,
  inlineUrl: string,
): Promise<string | null> {
  try {
    const res = await fetch(inlineUrl);
    const blob = await res.blob();

    // Skip tiny payloads (likely empty or placeholder)
    if (blob.size < 100) return null;

    const ext = guessExtension(inlineUrl, defaultExtFor[kind]);
    const contentType = guessContentType(inlineUrl, kind);
    const path = `${userId}/${projectId}/scene-${sceneNumber}-${kind}-${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from("story-references")
      .upload(path, blob, { contentType, upsert: true });

    if (error) {
      console.warn(`[sceneAssetMigration] Upload failed for ${kind}:`, error.message);
      return null;
    }

    const { data } = supabase.storage.from("story-references").getPublicUrl(path);
    return data.publicUrl || null;
  } catch (err) {
    console.warn(`[sceneAssetMigration] Failed to migrate ${kind} for scene ${sceneNumber}:`, err);
    return null;
  }
}

/**
 * Walks the scenes of a project and migrates any inline (data:/blob:) asset
 * to Supabase storage. Mutates and returns a new scenes array.
 *
 * Returns { scenes, migratedCount }.
 * Persistence to DB is the caller's responsibility (it also knows the project row).
 */
export async function migrateSceneAssets(
  scenes: StoryScene[],
  projectId: string,
  userId: string,
): Promise<{ scenes: StoryScene[]; migratedCount: number }> {
  let migratedCount = 0;
  const next: StoryScene[] = [];

  for (const scene of scenes) {
    const updated: StoryScene = { ...scene };

    const fields: Array<{ key: keyof StoryScene; kind: AssetKind }> = [
      { key: "imageUrl", kind: "image" },
      { key: "videoUrl", kind: "video" },
      { key: "audioUrl", kind: "audio" },
      { key: "sfxUrl", kind: "sfx" },
    ];

    for (const { key, kind } of fields) {
      const value = updated[key] as string | undefined;
      if (!isHeavyInlineUrl(value)) continue;

      // blob: URLs from a previous session are dead — clear them, don't try to upload
      if (value.startsWith("blob:")) {
        (updated as any)[key] = "";
        continue;
      }

      const newUrl = await uploadInlineAsset(userId, projectId, scene.sceneNumber, kind, value);
      if (newUrl) {
        (updated as any)[key] = newUrl;
        migratedCount++;
      }
    }

    next.push(updated);
  }

  return { scenes: next, migratedCount };
}
