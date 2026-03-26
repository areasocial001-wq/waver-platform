import React from 'react';

export interface TimelineItem {
  id: string;
  name: string;
  startTime: number; // seconds
  duration: number;
  url?: string;
  color: string;
  volume?: number;
  thumbnail?: string;
  sourceType?: 'storyboard' | 'upload' | 'generated';
  sourceId?: string;
}

export interface TimelineTrack {
  id: string;
  type: 'video' | 'voiceover' | 'music' | 'sfx';
  label: string;
  icon: React.ReactNode;
  items: TimelineItem[];
  muted: boolean;
  locked: boolean;
  visible: boolean;
  volume: number;
  color: string;
}

export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const frames = Math.floor((seconds % 1) * 30);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
};
