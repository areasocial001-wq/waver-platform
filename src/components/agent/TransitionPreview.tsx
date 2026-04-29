import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Frame = { url: string; thumb?: string; keyword?: string; duration?: number };

const TRANSITION_MS: Record<string, number> = {
  none: 0,
  subtle: 300,
  medium: 600,
  bold: 800,
};

/**
 * Lightweight in-wizard mini-player: simulates crossfade / clip-loop
 * transitions between scene thumbnails using only CSS opacity, so we can
 * give live feedback without rendering anything server-side.
 */
export function TransitionPreview({
  frames,
  transitionLevel = "medium",
  aspectRatio = "16:9",
}: {
  frames: Frame[];
  transitionLevel?: string;
  aspectRatio?: string;
}) {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const timer = useRef<number | null>(null);
  const transMs = TRANSITION_MS[transitionLevel] ?? 600;

  const aspectClass = useMemo(() => {
    if (aspectRatio === "9:16") return "aspect-[9/16] max-w-[220px]";
    if (aspectRatio === "1:1") return "aspect-square max-w-[320px]";
    return "aspect-video";
  }, [aspectRatio]);

  useEffect(() => {
    if (!playing || frames.length < 2) return;
    const dwell = Math.max(800, (frames[idx]?.duration ?? 3) * 1000);
    timer.current = window.setTimeout(() => {
      setIdx((i) => (i + 1) % frames.length);
    }, dwell);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [idx, playing, frames]);

  if (!frames.length) {
    return (
      <div className="text-xs text-muted-foreground border border-dashed border-border rounded-md p-4 text-center">
        Nessuna immagine selezionata: scegli una miniatura per scena per vedere l'anteprima.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="text-[10px]">
            Transizione: {transitionLevel} · {transMs}ms
          </Badge>
          <span>
            Scena {idx + 1} / {frames.length} {frames[idx]?.keyword ? `· ${frames[idx]?.keyword}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setPlaying((p) => !p)}>
            {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setIdx(0)}>
            <RotateCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className={`relative w-full ${aspectClass} mx-auto bg-black rounded-md overflow-hidden border border-border`}>
        {frames.map((f, i) => {
          const active = i === idx;
          // Loop "Ken Burns" subtle zoom for clip-loop feel.
          return (
            <img
              key={i}
              src={f.thumb || f.url}
              alt={f.keyword || `Scena ${i + 1}`}
              className="absolute inset-0 w-full h-full object-cover"
              style={{
                opacity: active ? 1 : 0,
                transition: `opacity ${transMs}ms ease-in-out, transform 4s ease-out`,
                transform: active ? "scale(1.04)" : "scale(1)",
              }}
              loading="lazy"
            />
          );
        })}
        {transitionLevel === "none" && (
          <div className="absolute bottom-2 left-2 text-[10px] text-white/70 bg-black/40 px-2 py-0.5 rounded">
            Cut secco — nessuna dissolvenza
          </div>
        )}
      </div>

      {/* Thumbstrip */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {frames.map((f, i) => (
          <button
            key={i}
            type="button"
            onClick={() => { setIdx(i); setPlaying(false); }}
            className={`shrink-0 w-12 h-8 rounded overflow-hidden border-2 transition ${
              i === idx ? "border-primary" : "border-transparent opacity-60 hover:opacity-100"
            }`}
            title={f.keyword || `Scena ${i + 1}`}
          >
            <img src={f.thumb || f.url} alt="" className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}
