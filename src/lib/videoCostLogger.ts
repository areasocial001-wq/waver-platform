import { supabase } from "@/integrations/supabase/client";
import { getPricePerSecond } from "./videoCostEstimator";

export interface LogVideoCostParams {
  provider: string;
  secondsBilled: number;
  storyProjectId?: string | null;
  sceneIndex?: number | null;
  status?: "success" | "failed" | "retry";
  metadata?: Record<string, unknown>;
}

/**
 * Logga il costo stimato di una generazione video nel DB.
 * Best-effort: non lancia eccezioni che possano bloccare la UI.
 */
export async function logVideoCost(params: LogVideoCostParams): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const pricePerSec = getPricePerSecond(params.provider);
    const costEur = +(params.secondsBilled * pricePerSec).toFixed(4);

    await supabase.from("video_cost_log").insert([{
      user_id: user.id,
      provider: params.provider,
      seconds_billed: params.secondsBilled,
      cost_eur: costEur,
      story_project_id: params.storyProjectId ?? null,
      scene_index: params.sceneIndex ?? null,
      status: params.status ?? "success",
      metadata: (params.metadata ?? {}) as never,
    }]);
  } catch (err) {
    // Solo log, non blocchiamo la UI
    console.warn("[videoCostLogger] Failed to log cost:", err);
  }
}

/**
 * Recupera la spesa totale stimata del mese corrente per l'utente.
 */
export async function getMonthlySpend(): Promise<number> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from("video_cost_log")
      .select("cost_eur")
      .eq("user_id", user.id)
      .gte("created_at", startOfMonth.toISOString());

    if (error || !data) return 0;
    return data.reduce((sum, row) => sum + Number(row.cost_eur || 0), 0);
  } catch {
    return 0;
  }
}
