import React, { useMemo, useState, useCallback, useRef, useEffect } from "react";
import type { StoryScene } from "./types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Film, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { TransitionPreview } from "./TransitionPreview";

/* ──────────────────────────────────────────────────────────────────────────
 * TransitionTimelinePreview
 * ──────────────────────────────────────────────────────────────────────────
 * A horizontal timeline ribbon of all completed scene clips with their
 * transition zones (crossfade / dissolve / wipe / fade-to-black) highlighted.
 *
 * The user can:
 *  • zoom in/out of the entire timeline (1x → 12x)
 *  • click any transition junction to "snap-zoom" on that crossfade
 *  • scrub a virtual playhead through the focused junction to inspect frames
 *    side-by-side (last frame outgoing | first frame incoming) — this is the
 *    fastest way to spot a frozen frame BEFORE wasting credits on a render.
 *
 * Pure presentation — no API calls. Uses real <video currentTime> seeking
 * on the source clip URLs (when reachable) to extract still frames in-place.
 * ────────────────────────────────────────────────────────────────────────── */

interface TransitionTimelinePreviewProps {
  scenes: StoryScene[];
  /** Aspect ratio hint for the frame thumbs ("16:9" | "9:16" | "1:1") */
  aspectRatio?: string;
}

interface ClipBlock {
  index: number;            // index in scenes[]
  scene: StoryScene;
  start: number;            // sec from t=0
  end: number;              // sec from t=0
  visualDuration: number;   // = end - start
}

interface TransitionZone {
  /** index of the OUTGOING clip in scenes[] */
  outIndex: number;
  /** seconds in timeline where transition starts (overlap begins) */
  startSec: number;
  endSec: number;
  duration: number;
  type: NonNullable<StoryScene["transition"]>;
}

const PX_PER_SEC_BASE = 36; // base pixels per second @ 1x zoom

export const TransitionTimelinePreview: React.FC<TransitionTimelinePreviewProps> = ({
  scenes,
  aspectRatio = "16:9",
}) => {
  // Only completed scenes contribute to the timeline; mirror video-concat logic
  const validScenes = useMemo(() => scenes.filter((s) => s.videoUrl), [scenes]);

  // Build clip blocks — assume sequential layout, transition durations come from each scene
  const { clips, totalDuration, transitions } = useMemo(() => {
    const out: ClipBlock[] = [];
    const tz: TransitionZone[] = [];
    let cursor = 0;
    validScenes.forEach((s, i) => {
      const dur = Math.min(s.duration ?? 5, 10);
      const start = cursor;
      const end = cursor + dur;
      out.push({ index: i, scene: s, start, end, visualDuration: dur });
      // After this clip (except the last), there is a transition with the next clip
      if (i < validScenes.length - 1) {
        const tDur = Math.max(0, Math.min(s.transitionDuration ?? 0.5, 2));
        const tType = (s.transition || "crossfade") as TransitionZone["type"];
        tz.push({
          outIndex: i,
          startSec: end - tDur,
          endSec: end,
          duration: tDur,
          type: tType,
        });
      }
      cursor = end;
    });
    return { clips: out, totalDuration: cursor, transitions: tz };
  }, [validScenes]);

  const [zoom, setZoom] = useState(1.5);
  const [focusedTzIdx, setFocusedTzIdx] = useState<number | null>(transitions.length ? 0 : null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // When focus changes, scroll the timeline to center the transition zone
  useEffect(() => {
    if (focusedTzIdx == null) return;
    const tz = transitions[focusedTzIdx];
    if (!tz || !scrollRef.current) return;
    const center = ((tz.startSec + tz.endSec) / 2) * PX_PER_SEC_BASE * zoom;
    const viewport = scrollRef.current.clientWidth;
    scrollRef.current.scrollTo({ left: Math.max(0, center - viewport / 2), behavior: "smooth" });
  }, [focusedTzIdx, zoom, transitions]);

  const pxPerSec = PX_PER_SEC_BASE * zoom;
  const timelineWidth = Math.max(totalDuration * pxPerSec, 200);

  const focusedTz = focusedTzIdx != null ? transitions[focusedTzIdx] : null;
  const aspectClass = aspectRatio === "9:16" ? "aspect-[9/16]" : aspectRatio === "1:1" ? "aspect-square" : "aspect-video";

  if (validScenes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Genera almeno una scena per vedere l'anteprima della timeline.
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border bg-card/50 p-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Film className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Timeline transizioni</span>
          <Badge variant="outline" className="text-[10px]">
            {validScenes.length} clip · {totalDuration.toFixed(1)}s · {transitions.length} transizioni
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setZoom((z) => Math.max(0.5, z - 0.5))} disabled={zoom <= 0.5}>
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
          <div className="w-28">
            <Slider value={[zoom]} min={0.5} max={12} step={0.5} onValueChange={(v) => setZoom(v[0])} />
          </div>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setZoom((z) => Math.min(12, z + 0.5))} disabled={zoom >= 12}>
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>
          <Badge variant="outline" className="text-[10px] tabular-nums w-12 justify-center">{zoom.toFixed(1)}x</Badge>
        </div>
      </div>

      {/* Scrollable timeline ribbon */}
      <div
        ref={scrollRef}
        className="relative overflow-x-auto overflow-y-hidden bg-background/40 rounded border border-border/40"
        style={{ height: 84 }}
      >
        <div className="relative" style={{ width: timelineWidth, height: "100%" }}>
          {/* Clips */}
          {clips.map((c) => (
            <div
              key={`clip-${c.index}`}
              className="absolute top-2 bottom-2 rounded border border-primary/40 bg-primary/10 flex items-center justify-center text-[10px] text-primary-foreground/80 overflow-hidden"
              style={{
                left: c.start * pxPerSec,
                width: Math.max(c.visualDuration * pxPerSec - 2, 2),
              }}
              title={`Scena ${c.scene.sceneNumber} · ${c.visualDuration}s`}
            >
              <span className="truncate px-1 font-medium text-foreground/70">
                S{c.scene.sceneNumber}
              </span>
            </div>
          ))}

          {/* Transition zones — overlay the boundary between adjacent clips */}
          {transitions.map((tz, idx) => {
            const left = tz.startSec * pxPerSec;
            const width = Math.max(tz.duration * pxPerSec, 6);
            const focused = focusedTzIdx === idx;
            return (
              <button
                key={`tz-${idx}`}
                onClick={() => setFocusedTzIdx(idx)}
                className={cn(
                  "absolute top-0 bottom-0 z-10 transition-all border-x",
                  focused
                    ? "bg-yellow-500/30 border-yellow-400/70 shadow-[0_0_0_2px] shadow-yellow-400/40"
                    : "bg-yellow-500/15 border-yellow-500/40 hover:bg-yellow-500/25",
                )}
                style={{ left, width }}
                title={`Transizione ${tz.type} · ${tz.duration}s — clicca per zoomare`}
              >
                <span className="absolute top-0.5 left-1 text-[9px] font-mono text-yellow-300/90 leading-none">
                  {tz.type.replace("_", "·")}
                </span>
              </button>
            );
          })}

          {/* Time ruler */}
          <div className="absolute bottom-0 left-0 right-0 h-3 border-t border-border/40 bg-background/60">
            {Array.from({ length: Math.ceil(totalDuration) + 1 }, (_, i) => i).map((s) => (
              <div
                key={`tick-${s}`}
                className="absolute top-0 bottom-0 border-l border-border/30 text-[8px] text-muted-foreground/70 pl-0.5 leading-3 font-mono"
                style={{ left: s * pxPerSec }}
              >
                {s}s
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Focused zone navigator + frame inspector */}
      {focusedTz && (
        <div className="rounded-md border border-yellow-500/30 bg-yellow-500/5 p-3 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="outline" className="border-yellow-500/40 text-yellow-300">
                {focusedTz.type} · {focusedTz.duration}s
              </Badge>
              <span className="text-muted-foreground text-xs">
                fra scena {validScenes[focusedTz.outIndex].sceneNumber} → {validScenes[focusedTz.outIndex + 1].sceneNumber}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setFocusedTzIdx((i) => (i != null && i > 0 ? i - 1 : i))}
                disabled={focusedTzIdx === 0}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <Badge variant="outline" className="text-[10px] tabular-nums">
                {focusedTzIdx! + 1} / {transitions.length}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setFocusedTzIdx((i) => (i != null && i < transitions.length - 1 ? i + 1 : i))}
                disabled={focusedTzIdx === transitions.length - 1}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          <CrossfadeInspector
            outScene={validScenes[focusedTz.outIndex]}
            inScene={validScenes[focusedTz.outIndex + 1]}
            transitionDuration={focusedTz.duration}
            transitionType={focusedTz.type}
            aspectClass={aspectClass}
          />
        </div>
      )}
    </div>
  );
};

/* ──────────────────────────────────────────────────────────────────────────
 * CrossfadeInspector
 * Side-by-side last-frame / first-frame view + scrubber to walk through the
 * crossfade region. Helps detect a "frozen frame" if the outgoing clip ends
 * before the transition completes.
 * ────────────────────────────────────────────────────────────────────────── */

interface CrossfadeInspectorProps {
  outScene: StoryScene;
  inScene: StoryScene;
  transitionDuration: number;
  transitionType: NonNullable<StoryScene["transition"]>;
  aspectClass: string;
}

const CrossfadeInspector: React.FC<CrossfadeInspectorProps> = ({
  outScene,
  inScene,
  transitionDuration,
  transitionType,
  aspectClass,
}) => {
  // Scrubber position: 0 = start of transition (outgoing 100% visible)
  //                    1 = end of transition (incoming 100% visible)
  const [t, setT] = useState(0.5);
  const [playing, setPlaying] = useState(false);
  const outVidRef = useRef<HTMLVideoElement>(null);
  const inVidRef = useRef<HTMLVideoElement>(null);

  // Outgoing clip: seek near its very end (clip duration - (1-t)*transition)
  // Incoming clip: seek near its start (t * transition)
  const outDur = Math.min(outScene.duration ?? 5, 10);
  useEffect(() => {
    const outV = outVidRef.current;
    const inV = inVidRef.current;
    if (outV && isFinite(outV.duration) && outV.duration > 0) {
      const seek = Math.max(0, Math.min(outV.duration, outDur - (1 - t) * transitionDuration));
      try { outV.currentTime = seek; } catch { /* ignore */ }
    }
    if (inV && isFinite(inV.duration) && inV.duration > 0) {
      const seek = Math.max(0, Math.min(inV.duration, t * transitionDuration));
      try { inV.currentTime = seek; } catch { /* ignore */ }
    }
  }, [t, outDur, transitionDuration]);

  // Auto-play loop through the crossfade region
  useEffect(() => {
    if (!playing) return;
    const interval = window.setInterval(() => {
      setT((prev) => {
        const next = prev + 0.05;
        return next > 1 ? 0 : next;
      });
    }, 80);
    return () => window.clearInterval(interval);
  }, [playing]);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-3">
        <FramePane
          label={`Ultimo frame · S${outScene.sceneNumber}`}
          videoUrl={outScene.videoUrl}
          imageUrl={outScene.imageUrl}
          videoRef={outVidRef}
          aspectClass={aspectClass}
          opacity={transitionType === "fade_black" ? 1 : Math.max(0, 1 - t)}
          tint={transitionType === "fade_black" ? `rgba(0,0,0,${Math.min(1, t * 1.6)})` : undefined}
        />
        <FramePane
          label={`Primo frame · S${inScene.sceneNumber}`}
          videoUrl={inScene.videoUrl}
          imageUrl={inScene.imageUrl}
          videoRef={inVidRef}
          aspectClass={aspectClass}
          opacity={transitionType === "fade_black" ? 1 : Math.min(1, t)}
          tint={transitionType === "fade_black" ? `rgba(0,0,0,${Math.min(1, (1 - t) * 1.6)})` : undefined}
        />
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-7 p-0 shrink-0"
          onClick={() => setPlaying((p) => !p)}
          title={playing ? "Pausa scrub auto" : "Loop scrub auto"}
        >
          {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </Button>
        <div className="flex-1">
          <Slider value={[t * 100]} min={0} max={100} step={1} onValueChange={(v) => { setPlaying(false); setT(v[0] / 100); }} />
        </div>
        <Badge variant="outline" className="text-[10px] tabular-nums w-16 justify-center">
          {(t * transitionDuration).toFixed(2)}s
        </Badge>
        <TransitionPreview type={transitionType} duration={transitionDuration} size={48} />
      </div>

      <p className="text-[11px] text-muted-foreground">
        Sposta lo slider per esplorare il crossfade frame per frame. Se vedi <span className="text-yellow-400">lo stesso fotogramma</span> per
        più posizioni dello slider sul lato uscente, quel clip è arrivato a fine prima della fine del crossfade
        (frame bloccato): allunga la scena oppure riduci la durata della transizione.
      </p>
    </div>
  );
};

/* ──────────────────────────────────────────────────────────────────────────
 * FramePane — single video frame with overlay opacity + optional tint
 * ────────────────────────────────────────────────────────────────────────── */
interface FramePaneProps {
  label: string;
  videoUrl?: string;
  imageUrl?: string;
  videoRef: React.RefObject<HTMLVideoElement>;
  aspectClass: string;
  opacity: number;
  tint?: string;
}

const FramePane: React.FC<FramePaneProps> = ({ label, videoUrl, imageUrl, videoRef, aspectClass, opacity, tint }) => {
  const reachable = !!videoUrl && /^https?:\/\//i.test(videoUrl);
  return (
    <div className="space-y-1">
      <div className="text-[10px] text-muted-foreground font-mono truncate">{label}</div>
      <div className={cn("relative w-full overflow-hidden rounded border border-border/50 bg-black", aspectClass)}>
        {reachable ? (
          <video
            ref={videoRef}
            src={videoUrl}
            preload="metadata"
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
            style={{ opacity }}
            onLoadedMetadata={(e) => {
              // Force initial seek once metadata is ready
              const v = e.currentTarget;
              if (isFinite(v.duration) && v.duration > 0) {
                try { v.currentTime = Math.min(v.duration, 0.01); } catch { /* ignore */ }
              }
            }}
          />
        ) : imageUrl ? (
          <img src={imageUrl} alt={label} className="absolute inset-0 w-full h-full object-cover" style={{ opacity }} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground">no preview</div>
        )}
        {tint && <div className="absolute inset-0 pointer-events-none" style={{ background: tint }} />}
      </div>
    </div>
  );
};

export default TransitionTimelinePreview;
