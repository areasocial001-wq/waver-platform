import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Weekly cleanup job: scans the `story-references/generated/{userId}/` folders
 * and deletes any file whose public URL is no longer referenced by ANY of the
 * user's records in story_mode_projects, storyboards, talking_avatar_projects,
 * or storyboard_characters.
 *
 * Safety:
 *  - Only touches files older than 24h (gives in-flight uploads breathing room).
 *  - Only scans `generated/{userId}/` subfolders (the path our generators use).
 *  - Hard-caps the scan at MAX_USERS_PER_RUN per invocation.
 */

const BUCKET = "story-references";
const PREFIX = "generated";
const MIN_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_USERS_PER_RUN = 200;
const PAGE_SIZE = 1000;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // List user folders inside generated/
    const { data: userFolders, error: listErr } = await admin.storage
      .from(BUCKET)
      .list(PREFIX, { limit: MAX_USERS_PER_RUN, sortBy: { column: "name", order: "asc" } });

    if (listErr) {
      console.error("Failed to list user folders:", listErr);
      throw listErr;
    }

    let totalScanned = 0;
    let totalDeleted = 0;
    let totalBytesFreed = 0;
    const usersProcessed: Array<{ userId: string; scanned: number; deleted: number; bytes: number }> = [];

    for (const folder of userFolders || []) {
      // Folders show up as entries with no metadata in supabase storage list output
      const userId = folder.name;
      if (!userId || folder.id) continue; // skip files at root

      // Pull all files under generated/{userId}/
      const userPrefix = `${PREFIX}/${userId}`;
      const { data: files, error: filesErr } = await admin.storage
        .from(BUCKET)
        .list(userPrefix, { limit: PAGE_SIZE, sortBy: { column: "name", order: "asc" } });

      if (filesErr) {
        console.warn(`Failed to list files for ${userId}:`, filesErr.message);
        continue;
      }
      if (!files || files.length === 0) continue;

      // Build the set of all public URLs referenced by this user across all relevant tables
      const referencedUrls = await collectReferencedUrls(admin, userId);

      const toDelete: string[] = [];
      let bytesForUser = 0;
      const now = Date.now();

      for (const f of files) {
        if (!f.id) continue; // skip subfolders
        const createdAt = f.created_at ? new Date(f.created_at).getTime() : now;
        if (now - createdAt < MIN_AGE_MS) continue; // too fresh, skip

        const fullPath = `${userPrefix}/${f.name}`;
        const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(fullPath);
        const publicUrl = pub?.publicUrl;
        if (!publicUrl) continue;

        // Check both the full URL and the path fragment (in case schemes differ)
        const isReferenced =
          referencedUrls.has(publicUrl) ||
          [...referencedUrls].some((u) => u.includes(fullPath));

        if (!isReferenced) {
          toDelete.push(fullPath);
          bytesForUser += (f.metadata as any)?.size || 0;
        }
      }

      totalScanned += files.length;

      if (toDelete.length > 0) {
        // Delete in chunks of 100 to avoid hitting payload limits
        for (let i = 0; i < toDelete.length; i += 100) {
          const chunk = toDelete.slice(i, i + 100);
          const { error: delErr } = await admin.storage.from(BUCKET).remove(chunk);
          if (delErr) {
            console.warn(`Delete chunk failed for ${userId}:`, delErr.message);
          } else {
            totalDeleted += chunk.length;
          }
        }
        totalBytesFreed += bytesForUser;
      }

      usersProcessed.push({
        userId,
        scanned: files.length,
        deleted: toDelete.length,
        bytes: bytesForUser,
      });
    }

    const summary = {
      success: true,
      users_processed: usersProcessed.length,
      files_scanned: totalScanned,
      files_deleted: totalDeleted,
      bytes_freed: totalBytesFreed,
      mb_freed: +(totalBytesFreed / 1024 / 1024).toFixed(2),
      details: usersProcessed.slice(0, 50),
      ran_at: new Date().toISOString(),
    };

    console.log("[cleanup-orphan-assets] done:", JSON.stringify(summary));

    // Persist a record into maintenance_log so the admin dashboard can show
    // the most recent storage cleanup run without having to parse edge logs.
    try {
      await admin.from("maintenance_log").insert({
        operation: "storage_cleanup",
        status: "success",
        triggered_by: req.headers.get("Authorization") ? "manual" : "cron_weekly",
        tables_processed: usersProcessed.length,
        total_freed_bytes: totalBytesFreed,
        duration_ms: 0,
        details: {
          files_scanned: totalScanned,
          files_deleted: totalDeleted,
          mb_freed: summary.mb_freed,
          users: usersProcessed.slice(0, 50),
        },
      });
    } catch (logErr) {
      console.warn("[cleanup-orphan-assets] failed to write maintenance_log:", logErr);
    }

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("cleanup-orphan-assets error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Walk every JSONB / text column in user-owned tables that may contain
 * a reference to a generated/{userId}/ asset, and return the union as a Set.
 */
async function collectReferencedUrls(
  admin: ReturnType<typeof createClient>,
  userId: string,
): Promise<Set<string>> {
  const urls = new Set<string>();

  const sources: Array<{ table: string; columns: string[] }> = [
    { table: "story_mode_projects", columns: ["scenes", "background_music_url", "final_video_url"] },
    { table: "storyboards", columns: ["panels"] },
    { table: "storyboard_characters", columns: ["reference_images"] },
    { table: "talking_avatar_projects", columns: ["scenes", "timeline_clips", "reference_images", "background_music_url"] },
  ];

  for (const src of sources) {
    const { data, error } = await admin
      .from(src.table)
      .select(src.columns.join(","))
      .eq("user_id", userId);

    if (error) {
      console.warn(`Could not read ${src.table} for ${userId}:`, error.message);
      continue;
    }
    if (!data) continue;

    for (const row of data as any[]) {
      for (const col of src.columns) {
        extractUrls(row[col], urls);
      }
    }
  }

  return urls;
}

/**
 * Recursively walk any JSON-ish value and add every string that looks like a URL
 * (or contains the storage path fragment) to the set.
 */
function extractUrls(value: unknown, out: Set<string>): void {
  if (value == null) return;
  if (typeof value === "string") {
    if (value.includes("/story-references/") || value.includes(`${PREFIX}/`)) {
      out.add(value);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) extractUrls(v, out);
    return;
  }
  if (typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) extractUrls(v, out);
  }
}
