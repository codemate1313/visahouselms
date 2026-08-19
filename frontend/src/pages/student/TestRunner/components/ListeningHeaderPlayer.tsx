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
  /** Final Test only: the compact PeopleCert transport replaces the wide bar. */
  languageCertSkin?: boolean;
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

/** The filled pause disc the exam transport shows while a recording runs.
 *  It is indication only - the candidate cannot pause an exam recording. */
function LcPauseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="currentColor" />
      <rect x="8.75" y="7.5" width="2.2" height="9" rx="0.6" fill="#fff" />
      <rect x="13.05" y="7.5" width="2.2" height="9" rx="0.6" fill="#fff" />
    </svg>
  );
}

function LcSpeakerIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true">
      <path d="M4 9.5v5h3.2L12 18.6V5.4L7.2 9.5H4z" />
      <path d="M14.6 8.4a.85.85 0 0 1 1.2.06 5.2 5.2 0 0 1 0 7.08.85.85 0 1 1-1.26-1.14 3.5 3.5 0 0 0 0-4.8.85.85 0 0 1 .06-1.2z" />
      <path d="M17.1 5.7a.85.85 0 0 1 1.2.02 8.9 8.9 0 0 1 0 12.56.85.85 0 1 1-1.22-1.18 7.2 7.2 0 0 0 0-10.2.85.85 0 0 1 .02-1.2z" />
    </svg>
  );
}

function audioCompletedKey(attemptId: number, partId: number) {
  return `vh:listening:completed:${attemptId}:${partId}`;
}

export function ListeningHeaderPlayer({
  attemptId,
  currentPart,
  onAudioLockChange,
  onAudioComplete,
  autoAdvance = false,
  languageCertSkin = false,
}: ListeningHeaderPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const completedKey = audioCompletedKey(attemptId, currentPart.id);
  const isCompletedInitial = typeof window !== "undefined" && sessionStorage.getItem(completedKey) === "true";
  const wasCompletedOnMountRef = useRef(isCompletedInitial);

  const [phase, setPhase] = useState<"waiting" | "playing" | "finished">(
    isCompletedInitial ? "finished" : "waiting"
  );
  const [countdown, setCountdown] = useState(START_DELAY_SECONDS);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(readStoredVolume);
  const [playlistIndex, setPlaylistIndex] = useState(0);
  const resumedRef = useRef(false);

  // Determine audio tracks
  // 1) Part-level media asset (Heading MP3 or full continuous MP3)
  const partAsset = currentPart.assets?.find((a) => a.url);
  const partAssetUrl = partAsset?.url
    ? (partAsset.url.startsWith("http") ? partAsset.url : `${API_BASE_URL}${partAsset.url}`)
    : null;

  // 2) Per-question audio assets / audio_path clips
  const questionTracks = currentPart.questions
    .map((q) => {
      const raw = (q.interaction as any)?.audio_url || (q.interaction as any)?.audio_path || q.audio_path;
      if (!raw) return null;
      return raw.startsWith("http") ? raw : `${API_BASE_URL}${raw.startsWith("/") ? "" : "/"}${raw}`;
    })
    .filter((url): url is string => Boolean(url));

  const isPerQuestion = currentPart.answer_constraints?.audio_mode === "per_question" || questionTracks.length > 0;

  // In Option 2, playlist starts with Heading Audio (if uploaded), then plays each question track
  const playlist: string[] = isPerQuestion
    ? [...(partAssetUrl ? [partAssetUrl] : []), ...questionTracks]
    : [...(partAssetUrl ? [partAssetUrl] : [])];

  const currentAudioUrl = playlist[playlistIndex] ?? null;
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

    if (isCompletedInitial) {
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
    if (playlistIndex < playlist.length - 1) {
      setPlaylistIndex((prev) => prev + 1);
      return;
    }
    // Keeping the end position would resume a finished part at its last second
    // and immediately end it again.
    sessionStorage.removeItem(storageKey);
    sessionStorage.setItem(completedKey, "true");
    setPhase("finished");
    onAudioLockChange?.(false);
  };

  /* Once the recording is over the part is done, so the candidate is moved on
     after a short pause rather than being left on a section they can no longer
     answer. */
  useEffect(() => {
    if (phase !== "finished" || !onAudioComplete || wasCompletedOnMountRef.current) return;
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

  const audioElement = (
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
  );

  /* The exam transport is deliberately tiny and inert: a pause disc that
     reports state without accepting a click, and a volume slider. Elapsed
     time is shown as a hairline under the disc rather than a full scrubber,
     because knowing how much recording is left is itself an advantage the
     real exam does not hand out. */
  if (languageCertSkin) {
    const elapsed = phase === "finished" ? 1 : (duration > 0 ? Math.min(1, currentTime / duration) : 0);
    return (
      <div className="lc-audio" aria-label="Listening Master Audio Track">
        {audioElement}
        <div className="lc-audio-box">
          <div className={`lc-audio-transport${phase === "playing" ? " is-playing" : ""}`}>
            <span className="lc-audio-pause" role="img" aria-label={phase === "playing" ? "Audio playing" : "Audio stopped"}>
              <LcPauseIcon />
            </span>
          </div>
          <div className="lc-audio-volume">
            <LcSpeakerIcon />
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
          <div className="lc-audio-track" aria-hidden="true">
            <div className="lc-audio-track-fill" style={{ width: `${elapsed * 100}%` }} />
          </div>
        </div>
        {statusText && <p className="lc-audio-status" role="status">{statusText}</p>}
      </div>
    );
  }

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
              style={{ width: `${phase === "finished" ? 100 : (duration > 0 ? (currentTime / duration) * 100 : 0)}%` }}
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
