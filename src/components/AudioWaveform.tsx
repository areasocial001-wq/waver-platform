import React, { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

interface AudioWaveformProps {
  audioUrl: string;
  isPlaying?: boolean;
  currentTime?: number;
  duration?: number;
}

export function AudioWaveform({ audioUrl, isPlaying = false, currentTime = 0, duration = 0 }: AudioWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [audioDuration, setAudioDuration] = useState(0);
  const animationRef = useRef<number | null>(null);

  // Generate waveform data from audio
  useEffect(() => {
    const generateWaveform = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        setAudioDuration(audioBuffer.duration);
        
        // Get audio data
        const rawData = audioBuffer.getChannelData(0);
        const samples = 100; // Number of bars in waveform
        const blockSize = Math.floor(rawData.length / samples);
        const filteredData: number[] = [];
        
        for (let i = 0; i < samples; i++) {
          let blockStart = blockSize * i;
          let sum = 0;
          for (let j = 0; j < blockSize; j++) {
            sum += Math.abs(rawData[blockStart + j]);
          }
          filteredData.push(sum / blockSize);
        }
        
        // Normalize the data
        const multiplier = Math.max(...filteredData) ** -1;
        const normalizedData = filteredData.map(n => n * multiplier);
        
        setWaveformData(normalizedData);
        audioContext.close();
      } catch (error) {
        console.error("Error generating waveform:", error);
        // Generate placeholder data on error
        setWaveformData(Array(100).fill(0.5));
      } finally {
        setIsLoading(false);
      }
    };

    if (audioUrl) {
      generateWaveform();
    }
  }, [audioUrl]);

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || waveformData.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      
      const width = rect.width;
      const height = rect.height;
      const barWidth = width / waveformData.length;
      const gap = 2;
      
      ctx.clearRect(0, 0, width, height);
      
      // Calculate progress
      const effectiveDuration = duration > 0 ? duration : audioDuration;
      const progress = effectiveDuration > 0 ? currentTime / effectiveDuration : 0;
      const progressX = progress * width;
      
      waveformData.forEach((value, index) => {
        const x = index * barWidth;
        const barHeight = Math.max(value * (height * 0.8), 4);
        const y = (height - barHeight) / 2;
        
        // Determine color based on progress
        const isPast = x < progressX;
        
        // Get computed CSS custom properties
        const computedStyle = getComputedStyle(document.documentElement);
        const primaryColor = computedStyle.getPropertyValue('--primary').trim();
        const mutedForeground = computedStyle.getPropertyValue('--muted-foreground').trim();
        
        if (isPast) {
          ctx.fillStyle = `hsl(${primaryColor})`;
        } else {
          ctx.fillStyle = `hsl(${mutedForeground} / 0.4)`;
        }
        
        // Draw rounded bar
        const radius = Math.min(barWidth - gap, 3) / 2;
        ctx.beginPath();
        ctx.roundRect(x + gap / 2, y, barWidth - gap, barHeight, radius);
        ctx.fill();
      });
      
      // Add glow effect at progress position when playing
      if (isPlaying && progressX > 0 && progressX < width) {
        const computedStyle = getComputedStyle(document.documentElement);
        const primaryColor = computedStyle.getPropertyValue('--primary').trim();
        
        ctx.beginPath();
        ctx.arc(progressX, height / 2, 4, 0, Math.PI * 2);
        ctx.fillStyle = `hsl(${primaryColor})`;
        ctx.fill();
        
        // Glow
        ctx.shadowColor = `hsl(${primaryColor})`;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(progressX, height / 2, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    };

    draw();
    
    // Animate when playing
    if (isPlaying) {
      const animate = () => {
        draw();
        animationRef.current = requestAnimationFrame(animate);
      };
      animationRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [waveformData, isPlaying, currentTime, duration, audioDuration]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-16 bg-muted/30 rounded-lg">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Caricamento forma d'onda...</span>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <canvas 
        ref={canvasRef} 
        className="w-full h-16 rounded-lg bg-muted/30"
        style={{ imageRendering: 'crisp-edges' }}
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>0:00</span>
        <span className="text-primary">{formatDuration(currentTime)}</span>
        <span>{formatDuration(duration > 0 ? duration : audioDuration)}</span>
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
