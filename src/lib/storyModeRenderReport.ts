/**
 * Post-render automated audio QA for Story Mode.
 *
 * After a successful render we:
 *   1. Probe the rendered MP4 server-side to confirm the audio track is audible
 *      (delegated to the `video-concat` `verifyMusic` action — already wired).
 *   2. Decode every per-scene voice/SFX/music asset client-side via Web Audio API
 *      and compute RMS / peak / approx-LUFS using `analyseAudioUrl`.
 *   3. Apply the user's headroom limits + sensible defaults to flag:
 *        - missing music in the final render
 *        - voice / SFX dB ratio < 3 dB (SFX risks overpowering voice)
 *        - any channel exceeding its max RMS (clipping risk)
 *        - any peak >= -0.5 dBFS (true clipping)
 *   4. Return a typed report the wizard can render and the user can read.
 */

import { analyseAudioUrl, isUsableUrl, type ChannelLevels } from "./audioLevels";
import type { AudioHeadroom } from "./storyModeAudioMix";

export type CheckSeverity = "pass" | "warn" | "fail";

export interface ReportCheck {
  id: string;
  label: string;
  severity: CheckSeverity;
  detail: string;
}

export interface RenderReport {
  generatedAt: number;
  videoUrl: string;
  /** Server probe outcome (from video-concat verifyMusic). null when not run. */
  musicAudible: boolean | null;
  /** Per-scene measurements. */
  scenes: Array<{
    sceneNumber: number;
    voice?: ChannelLevels;
    ambience?: ChannelLevels;
    sfx?: ChannelLevels;
  }>;
  /** Music track measurement (single global asset). */
  music?: ChannelLevels;
  checks: ReportCheck[];
  /** Convenience aggregates. */
  summary: {
    pass: number;
    warn: number;
    fail: number;
  };
}

interface SceneInput {
  sceneNumber?: number;
  audioUrl?: string;
  ambienceUrl?: string;
  sfxUrl?: string;
}

export interface RunReportInput {
  videoUrl: string;
  scenes: SceneInput[];
  backgroundMusicUrl?: string | null;
  headroom: AudioHeadroom;
  /** Optional already-known result of the server probe to avoid duplicate calls. */
  musicAudible?: boolean | null;
}

const PEAK_CLIP_DBFS = -0.5;

/** Run the full report. Decoding errors degrade gracefully — they show up as
 *  "warn" checks rather than throwing. */
export const buildRenderReport = async (input: RunReportInput): Promise<RenderReport> => {
  const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
  const ctx = new Ctx();
  const checks: ReportCheck[] = [];
  const scenes: RenderReport["scenes"] = [];
  let music: ChannelLevels | undefined;

  try {
    for (let i = 0; i < (input.scenes ?? []).length; i++) {
      const s = input.scenes[i];
      const sceneNumber = s.sceneNumber ?? i + 1;
      const row: RenderReport["scenes"][number] = { sceneNumber };
      const tasks: Array<{ key: "voice" | "ambience" | "sfx"; url?: string }> = [
        { key: "voice", url: s.audioUrl },
        { key: "ambience", url: s.ambienceUrl },
        { key: "sfx", url: s.sfxUrl },
      ];
      for (const t of tasks) {
        if (!isUsableUrl(t.url)) continue;
        try {
          const lvl = await analyseAudioUrl(t.url, ctx);
          row[t.key] = lvl;
        } catch (err) {
          checks.push({
            id: `decode-${sceneNumber}-${t.key}`,
            label: `Decodifica ${t.key} scena ${sceneNumber}`,
            severity: "warn",
            detail: `Impossibile analizzare l'asset: ${(err as Error)?.message ?? "errore"}.`,
          });
        }
      }
      scenes.push(row);
    }

    if (isUsableUrl(input.backgroundMusicUrl)) {
      try {
        music = await analyseAudioUrl(input.backgroundMusicUrl, ctx);
      } catch (err) {
        checks.push({
          id: "decode-music",
          label: "Decodifica musica",
          severity: "warn",
          detail: `Impossibile analizzare la musica: ${(err as Error)?.message ?? "errore"}.`,
        });
      }
    }
  } finally {
    void ctx.close().catch(() => undefined);
  }

  // ── Check 1: server probe says music is in the rendered MP4 ──
  if (typeof input.musicAudible === "boolean") {
    if (input.backgroundMusicUrl) {
      checks.push({
        id: "music-present",
        label: "Musica presente nel render",
        severity: input.musicAudible ? "pass" : "fail",
        detail: input.musicAudible
          ? "Il server ha rilevato la traccia audio nel video finale."
          : "Il probe del server NON ha trovato la traccia musicale nel video finale.",
      });
    }
  } else if (input.backgroundMusicUrl) {
    checks.push({
      id: "music-present",
      label: "Musica presente nel render",
      severity: "warn",
      detail: "Verifica server non eseguita — esegui un retry per controllare.",
    });
  }

  // ── Check 2: voice vs SFX ratio (per scene, then summary) ──
  const ratioFails: string[] = [];
  scenes.forEach((row) => {
    if (row.voice && row.sfx) {
      const dv = (row.voice.rmsDb ?? -Infinity) - (row.sfx.rmsDb ?? -Infinity);
      if (Number.isFinite(dv) && dv < 3) {
        ratioFails.push(`scena ${row.sceneNumber} (Δ ${dv.toFixed(1)} dB)`);
      }
    }
  });
  if (ratioFails.length > 0) {
    checks.push({
      id: "voice-sfx-ratio",
      label: "Voce ben sopra SFX",
      severity: ratioFails.length > 1 ? "fail" : "warn",
      detail: `SFX troppo vicini al livello voce in: ${ratioFails.join(", ")}. Consigliato ≥ 6 dB.`,
    });
  } else if (scenes.some((s) => s.voice && s.sfx)) {
    checks.push({
      id: "voice-sfx-ratio",
      label: "Voce ben sopra SFX",
      severity: "pass",
      detail: "Nessuna scena con SFX troppo vicini alla voce.",
    });
  }

  // ── Check 3: clipping (peak >= -0.5 dBFS anywhere) ──
  const clipped: string[] = [];
  const checkPeak = (label: string, lvl?: ChannelLevels) => {
    if (lvl && Number.isFinite(lvl.peakDb) && lvl.peakDb >= PEAK_CLIP_DBFS) {
      clipped.push(`${label} (${lvl.peakDb.toFixed(1)} dBFS)`);
    }
  };
  scenes.forEach((row) => {
    checkPeak(`voce s${row.sceneNumber}`, row.voice);
    checkPeak(`ambience s${row.sceneNumber}`, row.ambience);
    checkPeak(`sfx s${row.sceneNumber}`, row.sfx);
  });
  checkPeak("musica", music);
  if (clipped.length > 0) {
    checks.push({
      id: "clipping",
      label: "Assenza di clipping",
      severity: "fail",
      detail: `Picchi al limite o oltre in: ${clipped.join(", ")}. Riduci i volumi o abilita auto-mix.`,
    });
  } else if (scenes.length > 0) {
    checks.push({
      id: "clipping",
      label: "Assenza di clipping",
      severity: "pass",
      detail: "Nessun picco oltre -0.5 dBFS rilevato.",
    });
  }

  // ── Check 4: headroom limits per channel ──
  const overHeadroom = (key: "voice" | "ambience" | "sfx" | "music", lvl?: ChannelLevels): string | null => {
    if (!lvl || !Number.isFinite(lvl.rmsDb)) return null;
    const limit = key === "voice" ? input.headroom.voiceMaxDb
      : key === "ambience" ? input.headroom.ambienceMaxDb
      : key === "sfx" ? input.headroom.sfxMaxDb
      : input.headroom.musicMaxDb;
    if (lvl.rmsDb > limit) return `${key}: RMS ${lvl.rmsDb.toFixed(1)} > limite ${limit} dBFS`;
    return null;
  };
  const overs: string[] = [];
  scenes.forEach((row) => {
    const v = overHeadroom("voice", row.voice);
    const a = overHeadroom("ambience", row.ambience);
    const s = overHeadroom("sfx", row.sfx);
    [v, a, s].forEach((m) => { if (m) overs.push(`s${row.sceneNumber} ${m}`); });
  });
  const mh = overHeadroom("music", music);
  if (mh) overs.push(mh);
  if (overs.length > 0) {
    checks.push({
      id: "headroom",
      label: "Headroom rispettato",
      severity: "warn",
      detail: `Canali oltre il limite di headroom configurato: ${overs.join("; ")}.`,
    });
  } else if (scenes.length > 0) {
    checks.push({
      id: "headroom",
      label: "Headroom rispettato",
      severity: "pass",
      detail: "Tutti i canali sono entro i limiti configurati.",
    });
  }

  const summary = {
    pass: checks.filter((c) => c.severity === "pass").length,
    warn: checks.filter((c) => c.severity === "warn").length,
    fail: checks.filter((c) => c.severity === "fail").length,
  };

  return {
    generatedAt: Date.now(),
    videoUrl: input.videoUrl,
    musicAudible: input.musicAudible ?? null,
    scenes,
    music,
    checks,
    summary,
  };
};

/** Pretty plain-text export. */
export const reportToText = (r: RenderReport): string => {
  const lines: string[] = [];
  lines.push("STORY MODE — REPORT AUDIO POST-RENDER");
  lines.push(`Generato: ${new Date(r.generatedAt).toISOString()}`);
  lines.push(`Video: ${r.videoUrl}`);
  lines.push("");
  lines.push(`Risultato: ✅ ${r.summary.pass}  ⚠️ ${r.summary.warn}  ❌ ${r.summary.fail}`);
  lines.push("");
  for (const c of r.checks) {
    const icon = c.severity === "pass" ? "✅" : c.severity === "warn" ? "⚠️ " : "❌";
    lines.push(`${icon} ${c.label} — ${c.detail}`);
  }
  lines.push("");
  lines.push("MISURE PER SCENA");
  for (const s of r.scenes) {
    const v = s.voice ? `voce RMS ${s.voice.rmsDb.toFixed(1)}/peak ${s.voice.peakDb.toFixed(1)}/${s.voice.lufs.toFixed(1)}LUFS` : "voce —";
    const a = s.ambience ? `amb ${s.ambience.rmsDb.toFixed(1)}/${s.ambience.peakDb.toFixed(1)}` : "amb —";
    const sf = s.sfx ? `sfx ${s.sfx.rmsDb.toFixed(1)}/${s.sfx.peakDb.toFixed(1)}` : "sfx —";
    lines.push(`  scena ${s.sceneNumber}: ${v} · ${a} · ${sf}`);
  }
  if (r.music) {
    lines.push(`  musica: RMS ${r.music.rmsDb.toFixed(1)} · peak ${r.music.peakDb.toFixed(1)} · ${r.music.lufs.toFixed(1)} LUFS`);
  }
  return lines.join("\n");
};
