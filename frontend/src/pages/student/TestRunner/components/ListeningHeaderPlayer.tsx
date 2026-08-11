import { useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "@/api/client";
import type { Attempt } from "@/api/types";

interface ListeningHeaderPlayerProps {
  currentPart: Attempt["parts"][number];
  onAudioLockChange?: (isLocked: boolean) => void;
}

export function ListeningHeaderPlayer({ currentPart, onAudioLockChange }: ListeningHeaderPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playlistIndex, setPlaylistIndex] = useState(0);

  // Determine audio tracks
  // 1) Part-level media asset (concatenated MP3)
  const partAsset = currentPart.assets?.find((a) => a.url);
  
  // 2) Per-question audio assets / audio_path clips
  const questionTracks = currentPart.questions
    .map((q) => q.audio_path)
    .filter((url): url is string => Boolean(url));

  const isPlaylist = !partAsset && questionTracks.length > 0;
  const currentAudioUrl = partAsset
    ? `${API_BASE_URL}${partAsset.url}`
    : isPlaylist && questionTracks[playlistIndex]
      ? `${API_BASE_URL}${questionTracks[playlistIndex]}`
      : null;

  // Track & lock audio state
  useEffect(() => {
    if (!currentAudioUrl) {
      onAudioLockChange?.(false);
      return;
    }

    onAudioLockChange?.(true);
    setIsPlaying(true);

    const audioEl = audioRef.current;
    if (audioEl) {
      audioEl.play().catch((err) => {
        // Autoplay policy fallback: if browser blocks autoplay, user interaction unlocks it
        console.warn("Autoplay blocked by browser policy:", err);
      });
    }

    return () => {
      onAudioLockChange?.(false);
    };
  }, [currentAudioUrl, onAudioLockChange]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      setDuration(audioRef.current.duration || 0);
    }
  };

  const handleEnded = () => {
    if (isPlaylist && playlistIndex < questionTracks.length - 1) {
      setPlaylistIndex((prev) => prev + 1);
    } else {
      setIsPlaying(false);
      onAudioLockChange?.(false);
    }
  };

  if (!currentAudioUrl) return null;

  const formatSecs = (sec: number) => {
    if (!sec || Number.isNaN(sec)) return "00:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="lca-listening-header-player" aria-label="Listening Master Audio Track">
      <audio
        ref={audioRef}
        src={currentAudioUrl}
        autoPlay
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onPlay={() => {
          setIsPlaying(true);
          onAudioLockChange?.(true);
        }}
      />
      <div className="lca-listening-player-bar">
        {/* Status indicator */}
        <div className="lca-listening-status">
          <span className={`lca-listening-pulse${isPlaying ? " is-active" : ""}`} />
          <span className="lca-listening-status-text">
            {isPlaying ? "Audio Playing (Exam Controls Locked)" : "Audio Complete"}
          </span>
        </div>

        {/* Locked progress bar */}
        <div className="lca-listening-progress-wrapper">
          <div className="lca-listening-progress-bar">
            <div
              className="lca-listening-progress-fill"
              style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
            />
          </div>
          <div className="lca-listening-time-display">
            <span>{formatSecs(currentTime)}</span> / <span>{formatSecs(duration)}</span>
          </div>
        </div>

        {/* Lock Badge Notice */}
        <div className="lca-listening-lock-badge">
          🔒 Locked
        </div>
      </div>
    </div>
  );
}
