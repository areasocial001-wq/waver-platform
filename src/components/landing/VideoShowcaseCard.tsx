import { useState, useRef } from "react";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";
import { motion } from "framer-motion";

interface VideoShowcaseCardProps {
  videoUrl: string;
  posterUrl: string;
  title: string;
  className?: string;
}

export function VideoShowcaseCard({ videoUrl, posterUrl, title, className = "" }: VideoShowcaseCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  return (
    <div className={`relative rounded-xl overflow-hidden border border-[hsl(224,30%,15%)] group cursor-pointer ${className}`}>
      {/* Poster image shown when not playing */}
      {!isPlaying && (
        <img
          src={posterUrl}
          alt={title}
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
        />
      )}
      <video
        ref={videoRef}
        src={videoUrl}
        muted={isMuted}
        loop
        playsInline
        preload="metadata"
        className={`w-full h-full object-cover ${!isPlaying ? "opacity-0" : "opacity-100"}`}
        onEnded={() => setIsPlaying(false)}
      />

      {/* Play overlay */}
      {!isPlaying && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 bg-[hsl(225,25%,5%/0.4)] flex items-center justify-center"
        >
          <button
            onClick={togglePlay}
            className="w-12 h-12 rounded-full bg-[hsl(217,91%,60%/0.9)] backdrop-blur-sm flex items-center justify-center shadow-[0_0_20px_hsl(217,91%,60%/0.4)] hover:scale-110 transition-transform"
          >
            <Play className="w-5 h-5 text-white ml-0.5" />
          </button>
        </motion.div>
      )}

      {/* Controls overlay */}
      {isPlaying && (
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-[hsl(225,25%,5%/0.8)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
          <button onClick={togglePlay} className="w-8 h-8 rounded-full bg-[hsl(224,30%,15%/0.8)] flex items-center justify-center hover:bg-[hsl(224,30%,20%)]">
            <Pause className="w-4 h-4 text-white" />
          </button>
          <button onClick={toggleMute} className="w-8 h-8 rounded-full bg-[hsl(224,30%,15%/0.8)] flex items-center justify-center hover:bg-[hsl(224,30%,20%)]">
            {isMuted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
          </button>
          <span className="ml-auto text-[10px] text-[hsl(215,20%,65%)] font-medium">{title}</span>
        </div>
      )}
    </div>
  );
}
