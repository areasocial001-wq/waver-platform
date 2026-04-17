import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Loader2, Film, Music, Mic, Volume2, Sparkles, AlertTriangle, Check, Layers } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import type { StoryScene, StoryScript, StoryModeInput } from "./types";

export interface RenderVolumes {
  narrationVolume: number; // 0-100
  sfxVolume: number;       // 0-100
  musicVolume: number;     // 0-100
}

interface RenderPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scenes: StoryScene[];
  script: StoryScript;
  input: StoryModeInput;
  backgroundMusicUrl: string | null;
  onConfirmRender: (volumes: RenderVolumes) => void;
}

interface PreviewSummary {
  totalScenes: number;
  totalDuration: number;
  aspectRatio: string;
  resolution: string;
  fps: string;
  narrationScenes: number;
  sfxScenes: number;
  hasBackgroundMusic: boolean;
  hasIntro: boolean;
  hasOutro: boolean;
  transitionType: string;
  tracks: { track: number; clips: number; type: string }[];
  narrationVolume: number;
  sfxVolume: number;
  musicVolume: number;
}

export const RenderPreviewDialog: React.FC<RenderPreviewDialogProps> = ({
  open, onOpenChange, scenes, script, input, backgroundMusicUrl, onConfirmRender,
}) => {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<PreviewSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Editable volumes
  const [narrationVol, setNarrationVol] = useState(script.narrationVolume ?? 100);
  const [sfxVol, setSfxVol] = useState(70);
  const [musicVol, setMusicVol] = useState(script.musicVolume ?? 25);

  const vids = scenes.filter(s => s.videoStatus === "completed" && s.videoUrl);

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
          backgroundMusicUrl: backgroundMusicUrl || undefined,
          musicVolume: musicVol / 100,
          narrationVolume: narrationVol / 100,
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
      setNarrationVol(script.narrationVolume ?? 100);
      setMusicVol(script.musicVolume ?? 25);
      setSfxVol(70);
      fetchPreview();
    }
    if (!open) {
      setSummary(null);
      setError(null);
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
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
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

            {/* Main stats */}
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
                  { label: "🎙️ Voce forte", narration: 100, sfx: 30, music: 15 },
                  { label: "🎵 Solo musica", narration: 0, sfx: 0, music: 100 },
                  { label: "⚖️ Bilanciato", narration: 80, sfx: 50, music: 35 },
                  { label: "🎬 Cinematico", narration: 70, sfx: 80, music: 50 },
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
            disabled={loading || !!error}
          >
            <Film className="w-4 h-4 mr-2" />Avvia Rendering
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
