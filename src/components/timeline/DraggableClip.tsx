import React, { useState, useRef, useCallback } from 'react';
import { TimelineItem } from './types';
import { TrackWaveform } from '@/components/TrackWaveform';

interface DraggableClipProps {
  item: TimelineItem;
  pixelsPerSecond: number;
  isSelected: boolean;
  isMuted: boolean;
  snapInterval: number;
  onSelect: (id: string) => void;
  onMove: (itemId: string, newStartTime: number) => void;
  onResize: (itemId: string, newStartTime: number, newDuration: number) => void;
}

export function DraggableClip({
  item,
  pixelsPerSecond,
  isSelected,
  isMuted,
  snapInterval,
  onSelect,
  onMove,
  onResize,
}: DraggableClipProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);
  const dragStartX = useRef(0);
  const originalStart = useRef(0);
  const originalDuration = useRef(0);

  const snap = (time: number) => Math.max(0, Math.round(time / snapInterval) * snapInterval);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect(item.id);
    setIsDragging(true);
    dragStartX.current = e.clientX;
    originalStart.current = item.startTime;

    const handleMouseMove = (ev: MouseEvent) => {
      const dx = ev.clientX - dragStartX.current;
      const dt = dx / pixelsPerSecond;
      const newStart = snap(originalStart.current + dt);
      onMove(item.id, newStart);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [item.id, item.startTime, pixelsPerSecond, snapInterval, onMove, onSelect]);

  const handleResizeLeft = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect(item.id);
    setIsResizingLeft(true);
    dragStartX.current = e.clientX;
    originalStart.current = item.startTime;
    originalDuration.current = item.duration;

    const handleMouseMove = (ev: MouseEvent) => {
      const dx = ev.clientX - dragStartX.current;
      const dt = dx / pixelsPerSecond;
      const newStart = snap(originalStart.current + dt);
      const maxStart = originalStart.current + originalDuration.current - 0.5;
      const clampedStart = Math.min(newStart, maxStart);
      const newDuration = originalDuration.current - (clampedStart - originalStart.current);
      onResize(item.id, clampedStart, Math.max(0.5, newDuration));
    };

    const handleMouseUp = () => {
      setIsResizingLeft(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [item.id, item.startTime, item.duration, pixelsPerSecond, snapInterval, onResize, onSelect]);

  const handleResizeRight = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect(item.id);
    setIsResizingRight(true);
    dragStartX.current = e.clientX;
    originalDuration.current = item.duration;

    const handleMouseMove = (ev: MouseEvent) => {
      const dx = ev.clientX - dragStartX.current;
      const dt = dx / pixelsPerSecond;
      const newDuration = snap(originalDuration.current + dt);
      onResize(item.id, item.startTime, Math.max(0.5, newDuration));
    };

    const handleMouseUp = () => {
      setIsResizingRight(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [item.id, item.startTime, item.duration, pixelsPerSecond, snapInterval, onResize, onSelect]);

  const width = Math.max(item.duration * pixelsPerSecond, 24);
  const left = item.startTime * pixelsPerSecond;

  return (
    <div
      className={`absolute top-1.5 bottom-1.5 rounded-md border transition-shadow select-none
        ${isSelected ? 'ring-2 ring-primary shadow-lg z-10' : 'hover:brightness-110'}
        ${isMuted ? 'opacity-40' : ''}
        ${isDragging ? 'cursor-grabbing z-20 shadow-xl' : 'cursor-grab'}`}
      style={{
        left: `${left}px`,
        width: `${width}px`,
        backgroundColor: `${item.color}33`,
        borderColor: item.color,
      }}
      onMouseDown={handleMouseDown}
    >
      <div className="flex items-center h-full px-1.5 overflow-hidden pointer-events-none">
        {item.url && item.sourceType === 'upload' ? (
          <TrackWaveform
            audioUrl={item.url}
            color={item.color}
            trimStart={0}
            trimEnd={0}
            height={40}
          />
        ) : (
          <span className="text-[10px] font-medium truncate text-foreground">
            {item.name}
          </span>
        )}
      </div>

      {/* Left resize handle */}
      <div
        className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-primary/50 rounded-l z-10"
        onMouseDown={handleResizeLeft}
      />
      {/* Right resize handle */}
      <div
        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-primary/50 rounded-r z-10"
        onMouseDown={handleResizeRight}
      />

      {/* Snap indicator lines */}
      {(isDragging || isResizingLeft || isResizingRight) && (
        <>
          <div className="absolute -top-[100vh] left-0 w-px h-[200vh] bg-primary/30 pointer-events-none" />
          <div className="absolute -top-[100vh] right-0 w-px h-[200vh] bg-primary/30 pointer-events-none" />
        </>
      )}
    </div>
  );
}
