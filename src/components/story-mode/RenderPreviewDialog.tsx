import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, Film, Music, Mic, Volume2, Sparkles, AlertTriangle, Check, Layers, RefreshCw, Wind, Sliders } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import type { StoryScene, StoryScript, StoryModeInput } from "./types";
import { TransitionTimelinePreview } from "./TransitionTimelinePreview";
import { getAudioMix } from "@/lib/storyModeAudioMix";

export interface RenderVolumes {
  narrationVolume: number; // 0-100
  sfxVolume: number;       // 0-100
  musicVolume: number;     // 0-100
  ambienceVolume?: number; // 0-100 — separate continuous beds (wind/sea); optional for back-compat
  autoMix?: boolean;
  lufsTarget?: number;
}

interface RenderPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scenes: StoryScene[];
  script: StoryScript;
  input: StoryModeInput;
  backgroundMusicUrl: string | null;
  onConfirmRender: (volumes: RenderVolumes) => void;
  /** Inline regeneration handler — called when user clicks "Rigenera ora" on a non-compliant scene */
  onRegenerateScene?: (sceneIndex: number, type: "image" | "video") => Promise<void> | void;
  /** Inline regeneration of expired blob: audio assets (narration / sfx / music) */
  onRegenerateAudio?: (target: { type: "narration" | "sfx" | "music"; sceneIndex?: number }) => Promise<void> | void;
}

interface PreviewSummary {
  totalScenes: number;
  totalDuration: number;
  rawDuration?: number;
  aspectRatio: string;
  resolution: string;
  fps: string;
  narrationScenes: number;
  sfxScenes: number;
  ambienceScenes?: number;
  hasBackgroundMusic: boolean;
  hasIntro: boolean;
  hasOutro: boolean;
  transitionType: string;
  tracks: { track: number; clips: number; type: string }[];
  narrationVolume: number;
  sfxVolume: number;
  ambienceVolume?: number;
  musicVolume: number;
  autoMix?: boolean;
  lufsTarget?: number;
  effectiveVolumes?: { narration: number; sfx: number; ambience: number; music: number };
  placedClips?: { video: number; narration: number; sfx: number; ambience?: number; music: number };
  requestedClips?: { narration: number; sfx: number; ambience?: number; music: number };
  skippedAssets?: { type: string; index?: number; url: string; reason: string }[];
  sceneStarts?: number[];
}

export const RenderPreviewDialog: React.FC<RenderPreviewDialogProps> = ({
  open, onOpenChange, scenes, script, input, backgroundMusicUrl, onConfirmRender, onRegenerateScene, onRegenerateAudio,
}) => {
  const [loading, setLoading] = useState(false);
  const [regeneratingAudio, setRegeneratingAudio] = useState<string | null>(null);
  const [ignoreBlobAssets, setIgnoreBlobAssets] = useState(false);
  const [summary, setSummary] = useState<PreviewSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ignoreAspectWarnings, setIgnoreAspectWarnings] = useState(false);
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);

  // Editable volumes — initialised from global Audio Mix preferences
  const globalMix = React.useMemo(() => getAudioMix(), []);
  const [narrationVol, setNarrationVol] = useState(script.narrationVolume ?? globalMix.narrationVolume);
  const [sfxVol, setSfxVol] = useState(globalMix.sfxVolume);
  const [ambienceVol, setAmbienceVol] = useState(globalMix.ambienceVolume);
  const [musicVol, setMusicVol] = useState(script.musicVolume ?? globalMix.musicVolume);
  const [autoMix, setAutoMix] = useState(globalMix.autoMix);
  const [lufsTarget, setLufsTarget] = useState(globalMix.lufsTarget);
  const [musicAudible, setMusicAudible] = useState<null | boolean>(null);
  const [verifyingMusic, setVerifyingMusic] = useState(false);

  // Identify scenes whose generated assets don't match the requested aspect ratio
  const nonCompliantScenes = scenes
    .map((s, i) => ({ scene: s, index: i }))
    .filter(({ scene }) =>
      (scene.videoStatus === "completed" && !!scene.videoAspectWarning) ||
      (!!scene.imageAspectWarning && (!scene.videoStatus || scene.videoStatus !== "completed")),
    );
  const hasNonCompliantBlocking = nonCompliantScenes.length > 0 && !ignoreAspectWarnings;

  const vids = scenes.filter(s => s.videoStatus === "completed" && s.videoUrl);

  // Detect blob: URLs in audio assets — these CANNOT be reached by the server
  // and will be silently skipped by video-concat, leaving the final video without those tracks.
  const isBlob = (u?: string | null) => !!u && u.startsWith("blob:");
  const blobNarrations = vids
    .map((s, i) => ({ scene: s, index: i }))
    .filter(({ scene }) => isBlob(scene.audioUrl));
  const blobSfx = vids
    .map((s, i) => ({ scene: s, index: i }))
    .filter(({ scene }) => isBlob(scene.sfxUrl));
  const blobMusic = isBlob(backgroundMusicUrl);
  const totalBlobAssets = blobNarrations.length + blobSfx.length + (blobMusic ? 1 : 0);
  const hasBlobAssetsBlocking = totalBlobAssets > 0;

  const fetchPreview = async () => {
    setLoading(true);
    setError(null);
    setSummary(null);
    try {
      const narrationUrls = vids.map(s => s.audioUrl || "");
      const sfxUrls = vids.map(s => s.sfxUrl || "");
      const transitions = vids.map(s => ({
        type: s.transition || "crossfade",
        duration: s.transitionDuration || 0.5,
      }));
      const videoUrls = vids.map(s => s.videoUrl!);
      const clipDurations = vids.map(s => Math.min(s.duration, 10));

      const { data, error: fnError } = await supabase.functions.invoke("video-concat", {
        body: {
          videoUrls,
          clipDurations,
          transition: transitions[0]?.type || "crossfade",
          transitionDuration: transitions[0]?.duration || 0.5,
          transitions,
          resolution: input.videoQuality || "hd",
          aspectRatio: input.videoAspectRatio || "16:9",
          fps: input.videoFps || "24",
          audioUrls: narrationUrls.some(u => !!u) ? narrationUrls : undefined,
          sfxUrls: sfxUrls.some(u => !!u) ? sfxUrls : undefined,
          sfxVolume: sfxVol / 100,
          ambienceUrls: sfxUrls.some(u => !!u) ? sfxUrls : undefined,
          ambienceVolume: ambienceVol / 100,
          backgroundMusicUrl: backgroundMusicUrl || undefined,
          musicVolume: musicVol / 100,
          narrationVolume: narrationVol / 100,
          autoMix,
          lufsTarget,
          dryRun: true,
        },
      });

      if (fnError) throw fnError;
      if (data?.summary) {
        setSummary(data.summary);
      } else {
        setError("Impossibile ottenere l'anteprima del montaggio.");
      }
    } catch (err: any) {
      setError(err.message || "Errore durante l'anteprima");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (open && !summary && !loading) {
      const g = getAudioMix();
      setNarrationVol(script.narrationVolume ?? g.narrationVolume);
      setMusicVol(script.musicVolume ?? g.musicVolume);
      setSfxVol(g.sfxVolume);
      setAmbienceVol(g.ambienceVolume);
      setAutoMix(g.autoMix);
      setLufsTarget(g.lufsTarget);
      fetchPreview();
    }
    if (!open) {
      setSummary(null);
      setError(null);
      setIgnoreAspectWarnings(false);
      setIgnoreBlobAssets(false);
      setMusicAudible(null);
    }
  }, [open]);

  const issues: string[] = [];
  if (summary) {
    if (summary.narrationScenes === 0) issues.push("Nessuna narrazione vocale");
    if (summary.sfxScenes === 0) issues.push("Nessun effetto sonoro (SFX)");
    if (!summary.hasBackgroundMusic) issues.push("Nessuna musica di sottofondo");
    if (summary.narrationScenes > 0 && summary.narrationScenes < summary.totalScenes) {
      issues.push(`Voce solo su ${summary.narrationScenes}/${summary.totalScenes} scene`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Film className="w-5 h-5 text-primary" />
            Anteprima Montaggio
          </DialogTitle>
          <DialogDescription>
            Verifica la composizione e regola i volumi prima del rendering.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-8 gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Analisi montaggio...</span>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/5 text-sm">
            <p className="text-destructive">{error}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={fetchPreview}>Riprova</Button>
          </div>
        )}

        {summary && (() => {
          // Compute output pixel dimensions matching video-concat (full-frame, no letterbox)
          const ar = summary.aspectRatio;
          const tier = summary.resolution === "fhd" ? "fhd" : summary.resolution === "hd" ? "hd" : "sd";
          const sizeMap: Record<string, Record<string, [number, number]>> = {
            "16:9": { fhd: [1920, 1080], hd: [1280, 720], sd: [854, 480] },
            "9:16": { fhd: [1080, 1920], hd: [720, 1280], sd: [480, 854] },
            "1:1":  { fhd: [1080, 1080], hd: [720, 720],  sd: [480, 480] },
          };
          const [outW, outH] = sizeMap[ar]?.[tier] || [1280, 720];
          const orientation = outW > outH ? "orizzontale" : outW < outH ? "verticale" : "quadrato";
          const platformHint = ar === "9:16" ? "Instagram Reels / TikTok / Shorts" : ar === "1:1" ? "Instagram Feed" : "YouTube / TV";
          // First scene's image (if available) for the live thumbnail preview
          const firstThumbUrl = vids[0]?.imageUrl || scenes[0]?.imageUrl;
          // Tailwind aspect class — fall back to inline style for unusual ratios
          const aspectClass = ar === "9:16" ? "aspect-[9/16]" : ar === "1:1" ? "aspect-square" : "aspect-video";

          return (
          <div className="space-y-4">
            {/* Output dimensions badge — explicit pixel size + platform hint + thumbnail */}
            <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/30 bg-primary/5">
              {/* Thumbnail scaled to the EXACT requested aspect ratio so user sees orientation immediately */}
              <div className={cn("shrink-0 rounded-md overflow-hidden bg-muted/40 border border-border/60", aspectClass, ar === "9:16" ? "h-24 w-auto" : "w-32 h-auto")}>
                {firstThumbUrl ? (
                  <img
                    src={firstThumbUrl}
                    alt="Anteprima primo frame"
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <Film className="w-5 h-5" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-sm font-semibold tabular-nums truncate">
                    {outW} × {outH} px
                  </p>
                  <Badge variant="default" className="shrink-0">{ar}</Badge>
                </div>
                <p className="text-xs text-muted-foreground capitalize">{orientation}</p>
                <p className="text-xs text-muted-foreground truncate">Per {platformHint}</p>
              </div>
            </div>

            {/* Timeline preview with zoom on transition zones — helps spot frozen frames before render */}
            <TransitionTimelinePreview scenes={scenes} aspectRatio={input.videoAspectRatio} />


            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 rounded-lg bg-muted/30">
                <p className="text-2xl font-bold text-primary">{summary.totalScenes}</p>
                <p className="text-xs text-muted-foreground">Scene</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/30">
                <p className="text-2xl font-bold text-primary">{summary.totalDuration}s</p>
                <p className="text-xs text-muted-foreground">Durata</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/30">
                <p className="text-2xl font-bold text-primary">{summary.aspectRatio}</p>
                <p className="text-xs text-muted-foreground">Formato</p>
              </div>
            </div>

            {/* Volume controls */}
            <div className="space-y-3 p-3 rounded-lg border border-border bg-muted/20">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <Volume2 className="w-4 h-4" /> Regola Volumi
                </p>
              </div>

              {/* Presets */}
              <div className="flex gap-1.5 flex-wrap">
                {[
                  { label: "🎙️ Voce forte", narration: 100, sfx: 15, music: 18 },
                  { label: "🎵 Solo musica", narration: 0, sfx: 0, music: 100 },
                  { label: "⚖️ Bilanciato", narration: 85, sfx: 18, music: 28 },
                  { label: "🎬 Cinematico", narration: 78, sfx: 22, music: 32 },
                ].map(p => (
                  <Button
                    key={p.label}
                    variant="outline"
                    size="sm"
                    className="text-xs h-7 px-2"
                    onClick={() => { setNarrationVol(p.narration); setSfxVol(p.sfx); setMusicVol(p.music); }}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>


              {/* Narration volume */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs flex items-center gap-1.5">
                    <Mic className="w-3 h-3 text-primary" /> Narrazione
                  </Label>
                  <span className="text-xs font-medium tabular-nums">{narrationVol}%</span>
                </div>
                <Slider
                  value={[narrationVol]}
                  min={0} max={100} step={5}
                  onValueChange={v => setNarrationVol(v[0])}
                  disabled={summary.narrationScenes === 0}
                />
              </div>

              {/* SFX volume */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-yellow-400" /> Effetti Sonori
                  </Label>
                  <span className="text-xs font-medium tabular-nums">{sfxVol}%</span>
                </div>
                <Slider
                  value={[sfxVol]}
                  min={0} max={100} step={5}
                  onValueChange={v => setSfxVol(v[0])}
                  disabled={summary.sfxScenes === 0}
                />
              </div>

              {/* Music volume */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs flex items-center gap-1.5">
                    <Music className="w-3 h-3 text-green-400" /> Musica
                  </Label>
                  <span className="text-xs font-medium tabular-nums">{musicVol}%</span>
                </div>
                <Slider
                  value={[musicVol]}
                  min={0} max={100} step={5}
                  onValueChange={v => setMusicVol(v[0])}
                  disabled={!summary.hasBackgroundMusic}
                />
              </div>
            </div>

            {/* Transition info */}
            <div className="flex items-center justify-between text-sm p-2 rounded bg-muted/20">
              <span>Transizione</span>
              <Badge variant="outline" className="capitalize">{summary.transitionType.replace("_", " ")}</Badge>
            </div>

            {/* Tech specs */}
            <div className="flex gap-2 flex-wrap">
              <Badge variant="secondary">{summary.resolution.toUpperCase()}</Badge>
              <Badge variant="secondary">{summary.fps} FPS</Badge>
              <Badge variant="secondary">{summary.tracks.length} tracce</Badge>
            </div>

            {/* Detailed render log — exposes what video-concat actually placed in the timeline */}
            {summary.placedClips && (
              <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-1.5">
                <p className="text-xs font-medium flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-primary" />
                  Riepilogo timeline (video-concat)
                </p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                  <span className="text-muted-foreground">🎬 Clip video</span>
                  <span className="font-mono text-foreground text-right">{summary.placedClips.video}</span>
                  <span className="text-muted-foreground">🎙️ Clip narrazione</span>
                  <span className="font-mono text-right">
                    <span className={summary.placedClips.narration < (summary.requestedClips?.narration || 0) ? "text-orange-400" : "text-foreground"}>
                      {summary.placedClips.narration}
                    </span>
                    {summary.requestedClips && summary.requestedClips.narration !== summary.placedClips.narration && (
                      <span className="text-muted-foreground"> / {summary.requestedClips.narration} richiesti</span>
                    )}
                  </span>
                  <span className="text-muted-foreground">✨ Clip SFX</span>
                  <span className="font-mono text-right">
                    <span className={summary.placedClips.sfx < (summary.requestedClips?.sfx || 0) ? "text-orange-400" : "text-foreground"}>
                      {summary.placedClips.sfx}
                    </span>
                    {summary.requestedClips && summary.requestedClips.sfx !== summary.placedClips.sfx && (
                      <span className="text-muted-foreground"> / {summary.requestedClips.sfx} richiesti</span>
                    )}
                  </span>
                  <span className="text-muted-foreground">🎵 Musica</span>
                  <span className="font-mono text-foreground text-right">
                    {summary.placedClips.music ? "1 traccia" : "—"}
                  </span>
                  <span className="text-muted-foreground">⏱️ Durata effettiva</span>
                  <span className="font-mono text-foreground text-right">{summary.totalDuration}s</span>
                  {summary.rawDuration && summary.rawDuration !== summary.totalDuration && (
                    <>
                      <span className="text-muted-foreground/70">↳ senza overlap</span>
                      <span className="font-mono text-muted-foreground/70 text-right">{summary.rawDuration}s</span>
                    </>
                  )}
                </div>
                {summary.skippedAssets && summary.skippedAssets.length > 0 && (
                  <p className="text-[10px] text-orange-400 pt-1 border-t border-border/40">
                    ⚠️ {summary.skippedAssets.length} asset scartati (non raggiungibili dal server)
                  </p>
                )}
              </div>
            )}

            {/* Aspect-ratio non-compliance — BLOCKING unless explicitly ignored */}
            {nonCompliantScenes.length > 0 && (
              <div className={cn(
                "p-3 rounded-lg border space-y-2",
                ignoreAspectWarnings
                  ? "border-muted bg-muted/20"
                  : "border-destructive/50 bg-destructive/5",
              )}>
                <p className={cn(
                  "text-sm font-medium flex items-center gap-1.5",
                  ignoreAspectWarnings ? "text-muted-foreground" : "text-destructive",
                )}>
                  <AlertTriangle className="w-4 h-4" />
                  {nonCompliantScenes.length} {nonCompliantScenes.length === 1 ? "scena non conforme" : "scene non conformi"} al formato richiesto ({input.videoAspectRatio})
                </p>
                <ul className="text-xs space-y-1 max-h-40 overflow-y-auto pl-1">
                  {nonCompliantScenes.map(({ scene, index }) => {
                    const isVideoIssue = !!scene.videoAspectWarning;
                    const w = isVideoIssue ? scene.videoWidth : scene.imageWidth;
                    const h = isVideoIssue ? scene.videoHeight : scene.imageHeight;
                    const isRegenThis = regeneratingIndex === index;
                    return (
                      <li key={index} className="flex items-center gap-1.5 text-muted-foreground py-0.5">
                        <span className="font-mono text-foreground shrink-0">#{scene.sceneNumber}</span>
                        <Badge variant="outline" className="h-4 px-1 text-[9px] shrink-0">{isVideoIssue ? "VIDEO" : "IMG"}</Badge>
                        <span className="tabular-nums shrink-0">{w}×{h}</span>
                        <span className="text-muted-foreground/70 truncate flex-1">— {scene.narration?.slice(0, 30)}…</span>
                        {onRegenerateScene && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-[10px] shrink-0"
                            disabled={regeneratingIndex !== null}
                            onClick={async () => {
                              setRegeneratingIndex(index);
                              try {
                                await onRegenerateScene(index, isVideoIssue ? "video" : "image");
                              } finally {
                                setRegeneratingIndex(null);
                              }
                            }}
                            title={`Rigenera ${isVideoIssue ? "video" : "immagine"} scena #${scene.sceneNumber}`}
                          >
                            {isRegenThis ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <><RefreshCw className="w-3 h-3 mr-1" />Rigenera</>
                            )}
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <p className="text-xs text-muted-foreground">
                  {ignoreAspectWarnings
                    ? "Procedendo, le scene non conformi verranno scalate/ritagliate dal renderer."
                    : "Risolvi rigenerando le scene problematiche dal toolbar, oppure ignora per procedere comunque."}
                </p>
                <Button
                  variant={ignoreAspectWarnings ? "outline" : "secondary"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setIgnoreAspectWarnings(v => !v)}
                >
                  {ignoreAspectWarnings ? "Riattiva controllo formato" : "Ignora e procedi comunque"}
                </Button>
              </div>
            )}

            {/* Blob audio assets banner — assets unreachable from Shotstack server */}
            {totalBlobAssets > 0 && (
              <div className={cn(
                "p-3 rounded-lg border space-y-2",
                ignoreBlobAssets
                  ? "border-muted bg-muted/20"
                  : "border-orange-500/40 bg-orange-500/5",
              )}>
                <p className={cn(
                  "text-sm font-medium flex items-center gap-1.5",
                  ignoreBlobAssets ? "text-muted-foreground" : "text-orange-400",
                )}>
                  <AlertTriangle className="w-4 h-4" />
                  {totalBlobAssets} {totalBlobAssets === 1 ? "asset audio scaduto" : "asset audio scaduti"} (URL temporaneo del browser)
                </p>
                <p className="text-xs text-muted-foreground">
                  Questi asset NON saranno inclusi nel video finale perché Shotstack non può raggiungerli.
                  Rigenerali ora oppure procedi comunque (il video finale sarà incompleto).
                </p>
                <ul className="text-xs space-y-1 max-h-40 overflow-y-auto pl-1">
                  {blobNarrations.map(({ scene, index }) => {
                    const key = `narration-${index}`;
                    const isThis = regeneratingAudio === key;
                    return (
                      <li key={key} className="flex items-center gap-1.5 text-muted-foreground py-0.5">
                        <Mic className="w-3 h-3 text-primary shrink-0" />
                        <span className="font-mono text-foreground shrink-0">#{scene.sceneNumber}</span>
                        <Badge variant="outline" className="h-4 px-1 text-[9px] shrink-0">VOCE</Badge>
                        <span className="text-muted-foreground/70 truncate flex-1">— {scene.narration?.slice(0, 30)}…</span>
                        {onRegenerateAudio && (
                          <Button
                            variant="outline" size="sm" className="h-6 px-2 text-[10px] shrink-0"
                            disabled={regeneratingAudio !== null}
                            onClick={async () => {
                              setRegeneratingAudio(key);
                              try { await onRegenerateAudio({ type: "narration", sceneIndex: index }); }
                              finally { setRegeneratingAudio(null); }
                            }}
                          >
                            {isThis ? <Loader2 className="w-3 h-3 animate-spin" /> : <><RefreshCw className="w-3 h-3 mr-1" />Rigenera</>}
                          </Button>
                        )}
                      </li>
                    );
                  })}
                  {blobSfx.map(({ scene, index }) => {
                    const key = `sfx-${index}`;
                    const isThis = regeneratingAudio === key;
                    return (
                      <li key={key} className="flex items-center gap-1.5 text-muted-foreground py-0.5">
                        <Sparkles className="w-3 h-3 text-yellow-400 shrink-0" />
                        <span className="font-mono text-foreground shrink-0">#{scene.sceneNumber}</span>
                        <Badge variant="outline" className="h-4 px-1 text-[9px] shrink-0">SFX</Badge>
                        <span className="text-muted-foreground/70 truncate flex-1">— {scene.sfxPrompt?.slice(0, 30) || "effetto"}…</span>
                        {onRegenerateAudio && (
                          <Button
                            variant="outline" size="sm" className="h-6 px-2 text-[10px] shrink-0"
                            disabled={regeneratingAudio !== null}
                            onClick={async () => {
                              setRegeneratingAudio(key);
                              try { await onRegenerateAudio({ type: "sfx", sceneIndex: index }); }
                              finally { setRegeneratingAudio(null); }
                            }}
                          >
                            {isThis ? <Loader2 className="w-3 h-3 animate-spin" /> : <><RefreshCw className="w-3 h-3 mr-1" />Rigenera</>}
                          </Button>
                        )}
                      </li>
                    );
                  })}
                  {blobMusic && (
                    <li className="flex items-center gap-1.5 text-muted-foreground py-0.5">
                      <Music className="w-3 h-3 text-green-400 shrink-0" />
                      <Badge variant="outline" className="h-4 px-1 text-[9px] shrink-0">MUSICA</Badge>
                      <span className="text-muted-foreground/70 truncate flex-1">— colonna sonora di sottofondo</span>
                      {onRegenerateAudio && (
                        <Button
                          variant="outline" size="sm" className="h-6 px-2 text-[10px] shrink-0"
                          disabled={regeneratingAudio !== null}
                          onClick={async () => {
                            setRegeneratingAudio("music");
                            try { await onRegenerateAudio({ type: "music" }); }
                            finally { setRegeneratingAudio(null); }
                          }}
                        >
                          {regeneratingAudio === "music" ? <Loader2 className="w-3 h-3 animate-spin" /> : <><RefreshCw className="w-3 h-3 mr-1" />Rigenera</>}
                        </Button>
                      )}
                    </li>
                  )}
                </ul>
                <Button
                  variant={ignoreBlobAssets ? "outline" : "secondary"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setIgnoreBlobAssets(v => !v)}
                >
                  {ignoreBlobAssets ? "Riattiva controllo audio" : "Ignora e procedi senza questi audio"}
                </Button>
              </div>
            )}

            {/* Warnings */}
            {issues.length > 0 && (
              <div className="p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 space-y-1">
                <p className="text-sm font-medium flex items-center gap-1.5 text-yellow-400">
                  <AlertTriangle className="w-4 h-4" />Attenzione
                </p>
                <ul className="text-xs text-muted-foreground space-y-0.5">
                  {issues.map((issue, i) => <li key={i}>• {issue}</li>)}
                </ul>
              </div>
            )}
          </div>
          );
        })()}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              onConfirmRender({ narrationVolume: narrationVol, sfxVolume: sfxVol, musicVolume: musicVol });
            }}
            disabled={loading || !!error || hasNonCompliantBlocking || (hasBlobAssetsBlocking && !ignoreBlobAssets)}
            title={
              hasNonCompliantBlocking
                ? "Risolvi le scene non conformi o premi 'Ignora e procedi'"
                : (hasBlobAssetsBlocking && !ignoreBlobAssets)
                  ? "Rigenera gli audio scaduti o premi 'Ignora e procedi senza questi audio'"
                  : undefined
            }
          >
            <Film className="w-4 h-4 mr-2" />
            {hasNonCompliantBlocking
              ? `Bloccato (${nonCompliantScenes.length} non conformi)`
              : (hasBlobAssetsBlocking && !ignoreBlobAssets)
                ? `Bloccato (${totalBlobAssets} audio scaduti)`
                : "Avvia Rendering"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
