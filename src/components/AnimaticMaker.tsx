import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  Play, Pause, SkipBack, SkipForward, Image as ImageIcon,
  Clock, ArrowRight, Film, Settings2, Maximize2, Download, Loader2
} from 'lucide-react';
import { toast } from 'sonner';

interface AnimaticPanel {
  id: string;
  imageUrl: string;
  caption: string;
  duration: number; // seconds per panel
  transition: TransitionType;
}

type TransitionType = 'cut' | 'fade' | 'dissolve' | 'wipe-left' | 'wipe-right' | 'zoom-in' | 'zoom-out' | 'slide-up';

const TRANSITIONS: { value: TransitionType; label: string }[] = [
  { value: 'cut', label: 'Taglio netto' },
  { value: 'fade', label: 'Dissolvenza' },
  { value: 'dissolve', label: 'Cross-dissolve' },
  { value: 'wipe-left', label: 'Wipe ←' },
  { value: 'wipe-right', label: 'Wipe →' },
  { value: 'zoom-in', label: 'Zoom In' },
  { value: 'zoom-out', label: 'Zoom Out' },
  { value: 'slide-up', label: 'Slide Up' },
];

interface AnimaticMakerProps {
  panels?: Array<{ id: string; imageUrl: string | null; caption: string }>;
}

export function AnimaticMaker({ panels: inputPanels }: AnimaticMakerProps) {
  const [panels, setPanels] = useState<AnimaticPanel[]>(() => {
    if (inputPanels?.length) {
      return inputPanels
        .filter(p => p.imageUrl)
        .map(p => ({
          id: p.id,
          imageUrl: p.imageUrl!,
          caption: p.caption,
          duration: 3,
          transition: 'dissolve' as TransitionType,
        }));
    }
    return [];
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0-1 within current panel
  const [globalTransition, setGlobalTransition] = useState<TransitionType>('dissolve');
  const [globalDuration, setGlobalDuration] = useState(3);
  const [transitionDuration, setTransitionDuration] = useState(0.5);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  const totalDuration = panels.reduce((sum, p) => sum + p.duration, 0);

  // Apply global settings
  const applyGlobalSettings = () => {
    setPanels(prev => prev.map(p => ({
      ...p,
      duration: globalDuration,
      transition: globalTransition,
    })));
    toast.success('Impostazioni applicate a tutti i pannelli');
  };

  // Playback
  const play = useCallback(() => {
    if (panels.length === 0) return;
    setIsPlaying(true);
    lastTimeRef.current = performance.now();

    const animate = (time: number) => {
      const dt = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;

      setProgress(prev => {
        const currentPanel = panels[currentIndex];
        if (!currentPanel) return 0;
        const newProgress = prev + dt / currentPanel.duration;

        if (newProgress >= 1) {
          setCurrentIndex(ci => {
            if (ci >= panels.length - 1) {
              setIsPlaying(false);
              return 0;
            }
            return ci + 1;
          });
          return 0;
        }
        return newProgress;
      });

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);
  }, [panels, currentIndex]);

  const pause = () => {
    setIsPlaying(false);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
  };

  const goToStart = () => {
    pause();
    setCurrentIndex(0);
    setProgress(0);
  };

  const goToEnd = () => {
    pause();
    setCurrentIndex(Math.max(0, panels.length - 1));
    setProgress(0);
  };

  useEffect(() => {
    if (isPlaying) play();
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, play]);

  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || panels.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const currentPanel = panels[currentIndex];
    if (!currentPanel) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Background
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Apply transition effect
      const t = currentPanel.transition;
      const p = progress;
      const transProgress = Math.min(p / (transitionDuration / currentPanel.duration), 1);

      ctx.save();

      if (t === 'fade' && transProgress < 1) {
        ctx.globalAlpha = transProgress;
      } else if (t === 'zoom-in') {
        const scale = 1 + (1 - transProgress) * 0.3;
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(scale, scale);
        ctx.translate(-canvas.width / 2, -canvas.height / 2);
      } else if (t === 'zoom-out') {
        const scale = 0.7 + transProgress * 0.3;
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(scale, scale);
        ctx.translate(-canvas.width / 2, -canvas.height / 2);
      } else if (t === 'wipe-left') {
        ctx.beginPath();
        ctx.rect(0, 0, canvas.width * transProgress, canvas.height);
        ctx.clip();
      } else if (t === 'wipe-right') {
        ctx.beginPath();
        ctx.rect(canvas.width * (1 - transProgress), 0, canvas.width * transProgress, canvas.height);
        ctx.clip();
      } else if (t === 'slide-up') {
        const offset = canvas.height * (1 - transProgress);
        ctx.translate(0, offset);
      }

      // Draw image with cover fit
      const imgRatio = img.width / img.height;
      const canvasRatio = canvas.width / canvas.height;
      let drawW, drawH, drawX, drawY;

      if (imgRatio > canvasRatio) {
        drawH = canvas.height;
        drawW = drawH * imgRatio;
        drawX = (canvas.width - drawW) / 2;
        drawY = 0;
      } else {
        drawW = canvas.width;
        drawH = drawW / imgRatio;
        drawX = 0;
        drawY = (canvas.height - drawH) / 2;
      }

      // Subtle Ken Burns
      const kbScale = 1 + p * 0.05;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.scale(kbScale, kbScale);
      ctx.translate(-canvas.width / 2, -canvas.height / 2);

      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      ctx.restore();

      // Caption overlay
      if (currentPanel.caption) {
        const gradient = ctx.createLinearGradient(0, canvas.height - 100, 0, canvas.height);
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(1, 'rgba(0,0,0,0.7)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, canvas.height - 100, canvas.width, 100);

        ctx.fillStyle = '#fff';
        ctx.font = '16px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(currentPanel.caption, canvas.width / 2, canvas.height - 20, canvas.width - 40);
      }

      // Panel counter
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(10, 10, 60, 24);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${currentIndex + 1}/${panels.length}`, 18, 26);
    };
    img.src = currentPanel.imageUrl;
  }, [currentIndex, progress, panels, transitionDuration]);

  const elapsedTime = panels.slice(0, currentIndex).reduce((sum, p) => sum + p.duration, 0) + (panels[currentIndex]?.duration || 0) * progress;

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (panels.length === 0) {
    return (
      <Card className="border-primary/20 bg-card/50">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Film className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Animatic Maker</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            Aggiungi immagini ai pannelli dello storyboard per creare un'anteprima animatic con timing e transizioni.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 bg-card/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Film className="w-5 h-5 text-primary" />
          Animatic Maker
        </CardTitle>
        <CardDescription>
          Anteprima dello storyboard con timing e transizioni — {panels.length} pannelli, {formatTime(totalDuration)} totali
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Preview Canvas */}
        <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
          <canvas
            ref={canvasRef}
            width={960}
            height={540}
            className="w-full h-full"
          />
        </div>

        {/* Transport */}
        <div className="flex items-center justify-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToStart}>
            <SkipBack className="w-4 h-4" />
          </Button>
          <Button variant="default" size="icon" className="h-10 w-10" onClick={() => isPlaying ? pause() : play()}>
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToEnd}>
            <SkipForward className="w-4 h-4" />
          </Button>
          <span className="ml-3 text-sm font-mono text-muted-foreground tabular-nums">
            {formatTime(elapsedTime)} / {formatTime(totalDuration)}
          </span>
        </div>

        {/* Progress bar */}
        <div className="flex gap-0.5 h-2 rounded-full overflow-hidden bg-muted">
          {panels.map((panel, i) => {
            const widthPct = (panel.duration / totalDuration) * 100;
            let fillPct = 0;
            if (i < currentIndex) fillPct = 100;
            else if (i === currentIndex) fillPct = progress * 100;

            return (
              <div
                key={panel.id}
                className="relative h-full cursor-pointer hover:brightness-125 transition-all"
                style={{ width: `${widthPct}%`, backgroundColor: 'hsl(var(--muted))' }}
                onClick={() => { setCurrentIndex(i); setProgress(0); }}
              >
                <div
                  className="absolute inset-0 rounded-sm"
                  style={{
                    width: `${fillPct}%`,
                    background: 'var(--gradient-primary)',
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* Global Settings */}
        <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-muted/50 border border-border/50">
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">
              Durata per pannello
            </label>
            <div className="flex items-center gap-2">
              <Slider
                value={[globalDuration]}
                onValueChange={([v]) => setGlobalDuration(v)}
                min={1}
                max={10}
                step={0.5}
                className="flex-1"
              />
              <span className="text-xs font-mono text-foreground w-8 text-right">{globalDuration}s</span>
            </div>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">
              Transizione globale
            </label>
            <Select value={globalTransition} onValueChange={(v) => setGlobalTransition(v as TransitionType)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRANSITIONS.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button variant="outline" size="sm" className="h-8 w-full text-xs" onClick={applyGlobalSettings}>
              <Settings2 className="w-3.5 h-3.5 mr-1.5" />
              Applica a tutti
            </Button>
          </div>
        </div>

        {/* Panel thumbnails strip */}
        <ScrollArea className="w-full">
          <div className="flex gap-2 pb-2">
            {panels.map((panel, i) => (
              <div
                key={panel.id}
                className={`flex-shrink-0 cursor-pointer transition-all rounded-md overflow-hidden border-2
                  ${i === currentIndex ? 'border-primary ring-2 ring-primary/30 scale-105' : 'border-border/50 hover:border-primary/50'}`}
                onClick={() => { setCurrentIndex(i); setProgress(0); }}
              >
                <div className="relative w-24 h-14">
                  <img src={panel.imageUrl} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/20 flex items-end justify-between p-1">
                    <Badge variant="secondary" className="text-[8px] h-3.5 px-1">
                      {panel.duration}s
                    </Badge>
                    <span className="text-[8px] text-white font-bold">#{i + 1}</span>
                  </div>
                </div>
                {i < panels.length - 1 && (
                  <div className="flex items-center justify-center py-0.5 bg-muted">
                    <ArrowRight className="w-2.5 h-2.5 text-muted-foreground" />
                    <span className="text-[8px] text-muted-foreground ml-0.5">{panel.transition}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
