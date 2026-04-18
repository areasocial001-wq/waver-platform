import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { Button } from "@/components/ui/button";
import { Play, Pause, AlertTriangle, Loader2 } from "lucide-react";

interface AssetWaveformProps {
  url: string | null;
  height?: number;
  waveColor?: string;
  progressColor?: string;
}

/**
 * Inline waveform visualizer using wavesurfer.js.
 * Replaces the native <audio> player for asset previews so the user can
 * see duration and intensity at a glance.
 */
export function AssetWaveform({
  url,
  height = 48,
  waveColor = "hsl(var(--muted-foreground) / 0.5)",
  progressColor = "hsl(var(--primary))",
}: AssetWaveformProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    if (!url || !containerRef.current) return;

    setIsReady(false);
    setHasError(false);
    setIsPlaying(false);

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor,
      progressColor,
      cursorColor: "hsl(var(--primary))",
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height,
      normalize: true,
      url,
    });

    wsRef.current = ws;

    ws.on("ready", () => {
      setIsReady(true);
      setDuration(ws.getDuration());
    });
    ws.on("play", () => setIsPlaying(true));
    ws.on("pause", () => setIsPlaying(false));
    ws.on("finish", () => setIsPlaying(false));
    ws.on("audioprocess", (t) => setCurrentTime(t));
    ws.on("error", () => {
      setHasError(true);
      setIsReady(false);
    });

    return () => {
      try { ws.destroy(); } catch { /* noop */ }
      wsRef.current = null;
    };
  }, [url, height, waveColor, progressColor]);

  const togglePlay = () => {
    if (!wsRef.current) return;
    wsRef.current.playPause();
  };

  const fmt = (s: number) => {
    if (!isFinite(s) || s < 0) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  if (!url) {
    return (
      <div className="text-xs text-muted-foreground italic">
        Nessuna URL disponibile per la preview
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="flex items-center gap-2 text-xs text-destructive italic">
        <AlertTriangle className="h-3 w-3" />
        Audio non riproducibile (URL scaduto o non raggiungibile)
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 w-full">
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8 shrink-0"
        onClick={togglePlay}
        disabled={!isReady}
        type="button"
      >
        {!isReady ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isPlaying ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
      </Button>
      <div ref={containerRef} className="flex-1 min-w-0" />
      <span className="text-[10px] text-muted-foreground tabular-nums shrink-0 w-16 text-right">
        {fmt(currentTime)} / {fmt(duration)}
      </span>
    </div>
  );
}

export default AssetWaveform;
