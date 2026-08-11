import { useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "@/api/client";
import type { Attempt } from "@/api/types";

interface ListeningHeaderPlayerProps {
  attemptId: number;
  currentPart: Attempt["parts"][number];
  onAudioLockChange?: (isLocked: boolean) => void;
  /** Called once the recording has finished and the settling delay has passed. */
  onAudioComplete?: () => void;
  /** Whether finishing this part moves the candidate on by itself. */
  autoAdvance?: boolean;
}

/** Seconds of silence before the recording starts, so the candidate can read
 *  the instructions first - the exam does the same. */
const START_DELAY_SECONDS = 5;
/** Seconds to leave the finished part on screen before moving on. */
const END_DELAY_SECONDS = 5;
/** Volume is a preference, so it outlives the tab. */
const VOLUME_KEY = "vh:listening:volume";

/* Playback position is per attempt, per part, per track, and only for this
   tab - a reload mid-recording must not hand the candidate a second listen,
   so it resumes where it was rather than starting over. */
function positionKey(attemptId: number, partId: number, trackIndex: number) {
  return `vh:listening:position:${attemptId}:${partId}:${trackIndex}`;
}

function readStoredVolume() {
  const stored = Number(localStorage.getItem(VOLUME_KEY));
  return Number.isFinite(stored) && stored >= 0 && stored <= 1 ? stored : 1;
}

function readStoredPosition(key: string) {
  const stored = Number(sessionStorage.getItem(key));
  return Number.isFinite(stored) && stored > 0 ? stored : 0;
}

function VolumeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M11 5 6 9H3v6h3l5 4V5z" strokeLinejoin="round" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" strokeLinecap="round" />
    </svg>
  );
}

export function ListeningHeaderPlayer({
  attemptId,
  currentPart,
  onAudioLockChange,
  onAudioComplete,
  autoAdvance = false,
}: ListeningHeaderPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [phase, setPhase] = useState<"waiting" | "playing" | "finished">("waiting");
  const [countdown, setCountdown] = useState(START_DELAY_SECONDS);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(readStoredVolume);
  const [playlistIndex, setPlaylistIndex] = useState(0);
  const resumedRef = useRef(false);

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
  const storageKey = positionKey(attemptId, currentPart.id, playlistIndex);
  /* Latched once per track. Reading storage on every render would change this
     value as playback writes to it, restarting the effect below - and with it
     the countdown - several times a second. */
  const resumeRef = useRef<{ key: string; at: number } | null>(null);
  if (resumeRef.current?.key !== storageKey) {
    resumeRef.current = { key: storageKey, at: readStoredPosition(storageKey) };
  }
  const resumeFrom = resumeRef.current.at;
  /* Only the first track waits, and only on a first listen: a playlist runs on
     without a gap, and a reload picks up mid-recording rather than granting
     another five seconds of reading time. */
  const waitsBeforeStart = playlistIndex === 0 && resumeFrom === 0;

  /* The countdown holds the part locked before a note is played, then starts
     the recording. Navigation stays locked from the moment the part opens so
     nobody can skip ahead during the silence. */
  useEffect(() => {
    if (!currentAudioUrl) {
      onAudioLockChange?.(false);
      return;
    }

    onAudioLockChange?.(true);
    const start = () => {
      setPhase("playing");
      const audioEl = audioRef.current;
      if (audioEl && resumeFrom > 0 && !resumedRef.current) {
        resumedRef.current = true;
        // A track that has not reported its length yet rejects a seek, so wait.
        if (audioEl.readyState > 0) audioEl.currentTime = resumeFrom;
        else audioEl.addEventListener(
          "loadedmetadata",
          () => { audioEl.currentTime = resumeFrom; },
          { once: true },
        );
      }
      audioRef.current?.play().catch((err) => {
        // Autoplay policy fallback: if the browser blocks autoplay, the first
        // interaction with the page unlocks it.
        console.warn("Autoplay blocked by browser policy:", err);
      });
    };

    if (!waitsBeforeStart) {
      start();
      return () => onAudioLockChange?.(false);
    }

    setPhase("waiting");
    setCountdown(START_DELAY_SECONDS);
    // The ticker only drives the visible count; the start has its own timer so
    // playback is never kicked off from inside a state update.
    const ticker = window.setInterval(() => {
      setCountdown((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    const starter = window.setTimeout(() => {
      window.clearInterval(ticker);
      start();
    }, START_DELAY_SECONDS * 1000);

    return () => {
      window.clearInterval(ticker);
      window.clearTimeout(starter);
      onAudioLockChange?.(false);
    };
  }, [currentAudioUrl, waitsBeforeStart, resumeFrom, onAudioLockChange]);

  // A new track gets its own single resume.
  useEffect(() => { resumedRef.current = false; }, [storageKey]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
    localStorage.setItem(VOLUME_KEY, String(volume));
  }, [volume, currentAudioUrl]);

  const handleTimeUpdate = () => {
    const audioEl = audioRef.current;
    if (!audioEl) return;
    setCurrentTime(audioEl.currentTime);
    setDuration(audioEl.duration || 0);
    sessionStorage.setItem(storageKey, String(Math.floor(audioEl.currentTime)));
  };

  const handleEnded = () => {
    if (isPlaylist && playlistIndex < questionTracks.length - 1) {
      setPlaylistIndex((prev) => prev + 1);
      return;
    }
    // Keeping the end position would resume a finished part at its last second
    // and immediately end it again.
    sessionStorage.removeItem(storageKey);
    setPhase("finished");
    onAudioLockChange?.(false);
  };

  /* Once the recording is over the part is done, so the candidate is moved on
     after a short pause rather than being left on a section they can no longer
     answer. */
  useEffect(() => {
    if (phase !== "finished" || !onAudioComplete) return;
    const timer = window.setTimeout(() => onAudioComplete(), END_DELAY_SECONDS * 1000);
    return () => window.clearTimeout(timer);
  }, [phase, onAudioComplete]);

  if (!currentAudioUrl) return null;

  /* Nothing is announced while the recording runs: the pulsing dot and the
     moving progress bar already say it, and the words only crowded the bar.
     The states the candidate cannot see for themselves still speak. */
  const statusText = phase === "waiting"
    ? `Audio starts in ${countdown}s`
    : phase === "finished"
      ? autoAdvance ? "Audio complete — moving to the next part" : "Audio complete"
      : "";

  return (
    <div className="lca-listening-header-player" aria-label="Listening Master Audio Track">
      <audio
        ref={audioRef}
        src={currentAudioUrl}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onPlay={() => {
          setPhase("playing");
          onAudioLockChange?.(true);
        }}
      />
      <div className="lca-listening-player-bar">
        {/* Status indicator */}
        <div className="lca-listening-status">
          <span className={`lca-listening-pulse${phase === "playing" ? " is-active" : ""}`} />
          {statusText && <span className="lca-listening-status-text" role="status">{statusText}</span>}
        </div>

        {/* Locked progress bar */}
        <div className="lca-listening-progress-wrapper">
          <div className="lca-listening-progress-bar">
            <div
              className="lca-listening-progress-fill"
              style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Volume - the one audio control the candidate is allowed */}
        <div className="lca-listening-volume">
          <VolumeIcon />
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            aria-label="Audio volume"
            onChange={(event) => setVolume(Number(event.target.value))}
          />
        </div>
      </div>
    </div>
  );
}
