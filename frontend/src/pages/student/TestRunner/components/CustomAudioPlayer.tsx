import { useEffect, useRef, useState } from "react";
import { IconButton } from "@/components/ui/IconButton/IconButton";
import "./CustomAudioPlayer.css";

interface CustomAudioPlayerProps {
  src: string;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  preload?: "none" | "metadata" | "auto";
  className?: string;
}

export function CustomAudioPlayer({
  src,
  onPlay,
  onPause,
  onEnded,
  preload = "metadata",
  className = "",
}: CustomAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isScrubbing, setIsScrubbing] = useState(false);

  // Sync state with HTML5 audio events
  const handleTimeUpdate = () => {
    if (!audioRef.current || isScrubbing) return;
    setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    setDuration(audioRef.current.duration || 0);
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (onEnded) onEnded();
  };

  const handleAudioPlay = () => {
    setIsPlaying(true);
    if (onPlay) onPlay();
  };

  const handleAudioPause = () => {
    setIsPlaying(false);
    if (onPause) onPause();
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch((err) => {
        console.warn("Audio playback failed:", err);
      });
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setVolume(val);
    if (audioRef.current) {
      audioRef.current.volume = val;
    }
  };

  // Scrubbing/seeking logic
  const seekToPosition = (clientX: number) => {
    if (!progressBarRef.current || !audioRef.current || duration === 0) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const width = rect.width;
    const percentage = Math.max(0, Math.min(1, clickX / width));
    const targetTime = percentage * duration;
    setCurrentTime(targetTime);
    audioRef.current.currentTime = targetTime;
  };

  const handleProgressMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsScrubbing(true);
    seekToPosition(e.clientX);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      seekToPosition(moveEvent.clientX);
    };

    const handleMouseUp = () => {
      setIsScrubbing(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  // Handle source change: reset player state
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [src]);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={`custom-audio-player-container ${className}`}>
      <audio
        ref={audioRef}
        src={src}
        preload={preload}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleAudioEnded}
        onPlay={handleAudioPlay}
        onPause={handleAudioPause}
      />

      <div className="custom-audio-player-controls">
        {/* Play/Pause Button */}
        <IconButton
          className="custom-audio-play-btn"
          onClick={togglePlay}
          label={isPlaying ? "Pause audio" : "Play audio"}
          icon={
            isPlaying ? (
              // Pause Icon
              <svg viewBox="0 0 24 24" className="custom-audio-icon-pause" fill="currentColor">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            ) : (
              // Play Icon
              <svg viewBox="0 0 24 24" className="custom-audio-icon-play" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            )
          }
        />

        {/* Volume Controls */}
        <div className="custom-audio-volume-section">
          <svg viewBox="0 0 24 24" className="custom-audio-icon-volume" fill="currentColor">
            {volume === 0 ? (
              // Mute speaker
              <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
            ) : volume < 0.5 ? (
              // Low volume
              <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" />
            ) : (
              // High volume
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
            )}
          </svg>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={handleVolumeChange}
            className="custom-audio-volume-slider"
            aria-label="Volume level"
          />
        </div>
      </div>

      {/* Full-width bottom progress bar */}
      <div
        ref={progressBarRef}
        className="custom-audio-progress-bar"
        onMouseDown={handleProgressMouseDown}
      >
        <div
          className="custom-audio-progress-fill"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
}
