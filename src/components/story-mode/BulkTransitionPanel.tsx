import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wand2 } from "lucide-react";
import { TransitionType } from "./types";
import { TransitionPreview } from "./TransitionPreview";

interface BulkTransitionPanelProps {
  /** Number of scenes that will be affected (used in the action label). */
  sceneCount: number;
  /** Apply the chosen type+duration to every scene. */
  onApply: (type: TransitionType, duration: number) => void;
}

const TRANSITIONS: { value: TransitionType; label: string; icon: string }[] = [
  { value: "crossfade", label: "Crossfade", icon: "✦" },
  { value: "fade_black", label: "Fade Nero", icon: "◼" },
  { value: "dissolve", label: "Dissolve", icon: "◇" },
  { value: "wipe_left", label: "Wipe ←", icon: "◁" },
  { value: "wipe_right", label: "Wipe →", icon: "▷" },
  { value: "none", label: "Nessuna", icon: "—" },
];

const DURATIONS = [0.3, 0.5, 0.8, 1.0, 1.5];

export function BulkTransitionPanel({ sceneCount, onApply }: BulkTransitionPanelProps) {
  const [type, setType] = useState<TransitionType>("crossfade");
  const [duration, setDuration] = useState<number>(0.5);

  return (
    <Card className="border-primary/20 bg-primary/[0.03]">
      <CardContent className="py-3 px-4 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-primary shrink-0" />
          <Label className="text-xs font-medium whitespace-nowrap">
            Applica transizione a tutte le scene
          </Label>
        </div>

        <Select value={type} onValueChange={(v) => setType(v as TransitionType)}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {TRANSITIONS.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))}>
          <SelectTrigger className="w-20 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {DURATIONS.map((d) => (
              <SelectItem key={d} value={String(d)}>{d}s</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <TransitionPreview type={type} duration={duration} size={64} />

        <Button
          size="sm"
          variant="default"
          className="h-8"
          onClick={() => onApply(type, duration)}
          disabled={sceneCount === 0}
        >
          Applica a {sceneCount} scene
        </Button>
      </CardContent>
    </Card>
  );
}
