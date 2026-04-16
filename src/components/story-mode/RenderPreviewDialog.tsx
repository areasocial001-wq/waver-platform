import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Film, Music, Mic, Volume2, Sparkles, AlertTriangle, Check, Layers } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { StoryScene, StoryScript, StoryModeInput } from "./types";

interface RenderPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scenes: StoryScene[];
  script: StoryScript;
  input: StoryModeInput;
  backgroundMusicUrl: string | null;
  onConfirmRender: () => void;
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
          sfxVolume: 0.7,
          backgroundMusicUrl: backgroundMusicUrl || undefined,
          musicVolume: (script.musicVolume ?? 25) / 100,
          narrationVolume: (script.narrationVolume ?? 100) / 100,
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
      fetchPreview();
    }
    if (!open) {
      setSummary(null);
      setError(null);
    }
  }, [open]);

  const trackTypeLabel = (type: string) => {
    switch (type) {
      case "video": return "🎬 Video";
      case "audio": return "🔊 Audio";
      case "html": return "📝 Titolo";
      default: return type;
    }
  };

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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Film className="w-5 h-5 text-primary" />
            Anteprima Montaggio
          </DialogTitle>
          <DialogDescription>
            Verifica la composizione del video finale prima di inviarlo al rendering.
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

        {summary && (
          <div className="space-y-4">
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

            {/* Audio tracks */}
            <div className="space-y-2">
              <p className="text-sm font-medium flex items-center gap-1.5"><Layers className="w-4 h-4" />Tracce audio</p>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm p-2 rounded bg-muted/20">
                  <span className="flex items-center gap-2"><Mic className="w-3.5 h-3.5" />Narrazione</span>
                  <span className="flex items-center gap-1.5">
                    {summary.narrationScenes > 0 ? (
                      <><Badge variant="outline" className="text-xs">{summary.narrationScenes} scene</Badge>
                      <Volume2 className="w-3 h-3" /><span className="text-xs">{Math.round(summary.narrationVolume * 100)}%</span></>
                    ) : <Badge variant="destructive" className="text-xs">Assente</Badge>}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm p-2 rounded bg-muted/20">
                  <span className="flex items-center gap-2"><Sparkles className="w-3.5 h-3.5" />Effetti sonori</span>
                  <span className="flex items-center gap-1.5">
                    {summary.sfxScenes > 0 ? (
                      <><Badge variant="outline" className="text-xs">{summary.sfxScenes} scene</Badge>
                      <Volume2 className="w-3 h-3" /><span className="text-xs">{Math.round(summary.sfxVolume * 100)}%</span></>
                    ) : <Badge variant="secondary" className="text-xs">Assente</Badge>}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm p-2 rounded bg-muted/20">
                  <span className="flex items-center gap-2"><Music className="w-3.5 h-3.5" />Musica</span>
                  <span className="flex items-center gap-1.5">
                    {summary.hasBackgroundMusic ? (
                      <><Check className="w-3.5 h-3.5 text-green-400" />
                      <Volume2 className="w-3 h-3" /><span className="text-xs">{Math.round(summary.musicVolume * 100)}%</span></>
                    ) : <Badge variant="secondary" className="text-xs">Assente</Badge>}
                  </span>
                </div>
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
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button
            onClick={() => { onOpenChange(false); onConfirmRender(); }}
            disabled={loading || !!error}
          >
            <Film className="w-4 h-4 mr-2" />Avvia Rendering
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
