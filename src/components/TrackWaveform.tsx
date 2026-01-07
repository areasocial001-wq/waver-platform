import React, { useEffect, useRef, useState, memo } from "react";
import { Loader2 } from "lucide-react";

interface TrackWaveformProps {
  audioUrl: string;
  color: string;
  trimStart: number;
  trimEnd: number;
  isPlaying?: boolean;
  currentTime?: number;
  startTime?: number;
  height?: number;
}

export const TrackWaveform = memo(function TrackWaveform({ 
  audioUrl, 
  color,
  trimStart,
  trimEnd,
  isPlaying = false, 
  currentTime = 0,
  startTime = 0,
  height = 40
}: TrackWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [audioDuration, setAudioDuration] = useState(0);
  const animationRef = useRef<number | null>(null);

  // Generate waveform data from audio
  useEffect(() => {
    let cancelled = false;
    
    const generateWaveform = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        if (cancelled) {
          audioContext.close();
          return;
        }
        
        setAudioDuration(audioBuffer.duration);
        
        // Get audio data
        const rawData = audioBuffer.getChannelData(0);
        const samples = 80; // Number of bars in waveform
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
        const maxVal = Math.max(...filteredData);
        const multiplier = maxVal > 0 ? 1 / maxVal : 1;
        const normalizedData = filteredData.map(n => n * multiplier);
        
        setWaveformData(normalizedData);
        audioContext.close();
      } catch (error) {
        console.error("Error generating waveform:", error);
        // Generate placeholder data on error
        setWaveformData(Array(80).fill(0).map(() => 0.3 + Math.random() * 0.4));
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    if (audioUrl) {
      generateWaveform();
    }
    
    return () => {
      cancelled = true;
    };
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
      const canvasHeight = rect.height;
      const barWidth = width / waveformData.length;
      const gap = 1;
      
      ctx.clearRect(0, 0, width, canvasHeight);
      
      // Calculate effective duration
      const effectiveDuration = Math.max(0.1, audioDuration - trimStart - trimEnd);
      
      // Calculate progress within this track
      const localTime = currentTime - startTime;
      const progress = effectiveDuration > 0 ? Math.max(0, Math.min(1, localTime / effectiveDuration)) : 0;
      const progressX = progress * width;
      
      // Determine which bars are in the trimmed region
      const trimStartPercent = audioDuration > 0 ? trimStart / audioDuration : 0;
      const trimEndPercent = audioDuration > 0 ? trimEnd / audioDuration : 0;
      
      waveformData.forEach((value, index) => {
        const x = index * barWidth;
        const barHeight = Math.max(value * (canvasHeight * 0.9), 2);
        const y = (canvasHeight - barHeight) / 2;
        
        // Check if bar is in trimmed region
        const barPercent = index / waveformData.length;
        const isTrimmedStart = barPercent < trimStartPercent;
        const isTrimmedEnd = barPercent > (1 - trimEndPercent);
        
        // Determine color based on progress and trim
        const isPast = x < progressX;
        
        if (isTrimmedStart || isTrimmedEnd) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        } else if (isPast && isPlaying) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        } else {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        }
        
        // Draw rounded bar
        const radius = Math.min(barWidth - gap, 2) / 2;
        ctx.beginPath();
        ctx.roundRect(x + gap / 2, y, barWidth - gap, barHeight, radius);
        ctx.fill();
      });
      
      // Add playhead indicator when playing
      if (isPlaying && progressX > 0 && progressX < width) {
        ctx.beginPath();
        ctx.moveTo(progressX, 0);
        ctx.lineTo(progressX, canvasHeight);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 1;
        ctx.stroke();
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
  }, [waveformData, isPlaying, currentTime, audioDuration, trimStart, trimEnd, startTime]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full w-full">
        <Loader2 className="w-4 h-4 animate-spin text-white/50" />
      </div>
    );
  }

  return (
    <canvas 
      ref={canvasRef} 
      className="w-full h-full"
      style={{ height: `${height}px` }}
    />
  );
});

export default TrackWaveform;
