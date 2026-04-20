import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { TransitionType } from "./types";

interface TransitionPreviewProps {
  type: TransitionType;
  /** Transition duration in seconds (used to time the animation). */
  duration?: number;
  /** Visual size in px. */
  size?: number;
  className?: string;
}

/**
 * Tiny looping preview that simulates a transition between two abstract "scenes"
 * (a teal gradient → a violet gradient). Helps the user instantly tell apart
 * crossfade / fade-to-black / dissolve / wipes.
 *
 * Implementation: pure CSS using two stacked layers and a key-driven re-mount
 * to restart the keyframe loop whenever `type` or `duration` changes.
 */
export function TransitionPreview({
  type,
  duration = 0.5,
  size = 56,
  className,
}: TransitionPreviewProps) {
  // Bump key on type/duration change → re-triggers CSS animation cleanly.
  const [iter, setIter] = useState(0);
  useEffect(() => {
    setIter((n) => n + 1);
  }, [type, duration]);

  // Total loop = hold A (0.6s) + transition (duration) + hold B (0.6s) + transition back (duration)
  const hold = 0.6;
  const total = hold * 2 + duration * 2;
  // Percentages of the total loop where keyframes happen
  const p = {
    holdAEnd: (hold / total) * 100,
    transAEnd: ((hold + duration) / total) * 100,
    holdBEnd: ((hold * 2 + duration) / total) * 100,
  };

  // Build keyframes per transition type
  const keyframes = buildKeyframes(type, p);
  const animationName = `transitionPreview_${type}_${iter}`;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded border border-border/50 bg-black shrink-0",
        className
      )}
      style={{ width: size, height: Math.round(size * 0.6) }}
      aria-label={`Anteprima transizione ${type}`}
    >
      <style>{`
        @keyframes ${animationName}_b { ${keyframes.layerB} }
        @keyframes ${animationName}_overlay { ${keyframes.overlay} }
      `}</style>

      {/* Layer A — bottom (always visible) */}
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(135deg, hsl(180 70% 45%), hsl(200 80% 35%))",
        }}
      />

      {/* Layer B — top (animated in/out) */}
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(135deg, hsl(280 70% 55%), hsl(320 75% 45%))",
          animation: `${animationName}_b ${total}s ease-in-out infinite`,
          willChange: "opacity, clip-path, transform",
        }}
      />

      {/* Black overlay — only used by fade_black */}
      {type === "fade_black" && (
        <div
          className="absolute inset-0 bg-black"
          style={{
            animation: `${animationName}_overlay ${total}s ease-in-out infinite`,
            willChange: "opacity",
          }}
        />
      )}
    </div>
  );
}

/** Build the keyframe CSS body for layer B and the optional black overlay. */
function buildKeyframes(
  type: TransitionType,
  p: { holdAEnd: number; transAEnd: number; holdBEnd: number }
): { layerB: string; overlay: string } {
  const { holdAEnd, transAEnd, holdBEnd } = p;
  const fmt = (n: number) => `${n.toFixed(2)}%`;

  switch (type) {
    case "crossfade":
    case "dissolve":
      // Simple opacity blend
      return {
        layerB: `
          0% { opacity: 0; }
          ${fmt(holdAEnd)} { opacity: 0; }
          ${fmt(transAEnd)} { opacity: 1; }
          ${fmt(holdBEnd)} { opacity: 1; }
          100% { opacity: 0; }
        `,
        overlay: ``,
      };

    case "fade_black":
      // Layer B appears instantly at midpoint; black overlay fades up then down
      return {
        layerB: `
          0%, ${fmt((holdAEnd + transAEnd) / 2)} { opacity: 0; }
          ${fmt((holdAEnd + transAEnd) / 2 + 0.01)} { opacity: 1; }
          ${fmt(holdBEnd)} { opacity: 1; }
          ${fmt((holdBEnd + 100) / 2)} { opacity: 1; }
          ${fmt((holdBEnd + 100) / 2 + 0.01)} { opacity: 0; }
          100% { opacity: 0; }
        `,
        overlay: `
          0% { opacity: 0; }
          ${fmt(holdAEnd)} { opacity: 0; }
          ${fmt((holdAEnd + transAEnd) / 2)} { opacity: 1; }
          ${fmt(transAEnd)} { opacity: 0; }
          ${fmt(holdBEnd)} { opacity: 0; }
          ${fmt((holdBEnd + 100) / 2)} { opacity: 1; }
          100% { opacity: 0; }
        `,
      };

    case "wipe_left":
      // Layer B wipes in from the right going left
      return {
        layerB: `
          0% { clip-path: inset(0 0 0 100%); opacity: 1; }
          ${fmt(holdAEnd)} { clip-path: inset(0 0 0 100%); opacity: 1; }
          ${fmt(transAEnd)} { clip-path: inset(0 0 0 0%); opacity: 1; }
          ${fmt(holdBEnd)} { clip-path: inset(0 0 0 0%); opacity: 1; }
          100% { clip-path: inset(0 100% 0 0); opacity: 1; }
        `,
        overlay: ``,
      };

    case "wipe_right":
      return {
        layerB: `
          0% { clip-path: inset(0 100% 0 0); opacity: 1; }
          ${fmt(holdAEnd)} { clip-path: inset(0 100% 0 0); opacity: 1; }
          ${fmt(transAEnd)} { clip-path: inset(0 0 0 0%); opacity: 1; }
          ${fmt(holdBEnd)} { clip-path: inset(0 0 0 0%); opacity: 1; }
          100% { clip-path: inset(0 0 0 100%); opacity: 1; }
        `,
        overlay: ``,
      };

    case "none":
    default:
      // Hard cut
      return {
        layerB: `
          0%, ${fmt(holdAEnd)} { opacity: 0; }
          ${fmt(holdAEnd + 0.01)} { opacity: 1; }
          ${fmt(holdBEnd)} { opacity: 1; }
          ${fmt(holdBEnd + 0.01)} { opacity: 0; }
          100% { opacity: 0; }
        `,
        overlay: ``,
      };
  }
}
