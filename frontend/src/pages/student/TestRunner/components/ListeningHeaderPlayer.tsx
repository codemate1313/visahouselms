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
  userEmail?: string;
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

function readStorage(storage: Storage | undefined, key: string) {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeStorage(storage: Storage | undefined, key: string, value: string) {
  try {
    storage?.setItem(key, value);
  } catch {
    /* storage is best-effort during exams */
  }
}

function removeStorage(storage: Storage | undefined, key: string) {
  try {
    storage?.removeItem(key);
  } catch {
    /* storage is best-effort during exams */
  }
}

function getLocalStorage() {
  return typeof window === "undefined" ? undefined : window.localStorage;
}

function getSessionStorage() {
  return typeof window === "undefined" ? undefined : window.sessionStorage;
}

function readStoredVolume() {
  const stored = Number(readStorage(getLocalStorage(), VOLUME_KEY));
  return Number.isFinite(stored) && stored >= 0 && stored <= 1 ? stored : 1;
}

function readStoredPosition(key: string) {
  const stored = Number(readStorage(getSessionStorage(), key));
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

/* The transport disc: a red ring with the glyph drawn inside it, not a filled
   disc. Indication only - an exam recording cannot be paused or restarted, so
   the glyph reports what the audio is doing rather than offering a control. */
function LcTransportIcon({ playing }: { playing: boolean }) {
  return (
    <svg viewBox="0 0 26 26" width="26" height="26" aria-hidden="true">
      <circle cx="13" cy="13" r="11.5" fill="#ffffff" stroke="currentColor" strokeWidth="2.2" />
      {playing ? (
        <>
          <rect x="9.5" y="8.2" width="2.7" height="9.6" rx="0.4" fill="currentColor" />
          <rect x="13.8" y="8.2" width="2.7" height="9.6" rx="0.4" fill="currentColor" />
        </>
      ) : (
        <path d="M10.5 8.1 18 13l-7.5 4.9z" fill="currentColor" />
      )}
    </svg>
  );
}

function LcSpeakerIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
      <path d="M3.6 9.3v5.4h3.4L12.2 19V5L7 9.3H3.6z" />
      <path d="M14.8 8.1a.95.95 0 0 1 1.34.07 5.8 5.8 0 0 1 0 7.66.95.95 0 1 1-1.41-1.27 3.9 3.9 0 0 0 0-5.12.95.95 0 0 1 .07-1.34z" />
      <path d="M17.5 5.3a.95.95 0 0 1 1.34.02 9.9 9.9 0 0 1 0 13.36.95.95 0 1 1-1.36-1.32 8 8 0 0 0 0-10.72.95.95 0 0 1 .02-1.34z" />
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
  userEmail,
}: ListeningHeaderPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const completedKey = audioCompletedKey(attemptId, currentPart.id);
  const allCompletedKey = `vh:listening:all_completed:${attemptId}`;
  const isCompletedInitial =
    readStorage(getLocalStorage(), completedKey) === "true" ||
    readStorage(getLocalStorage(), allCompletedKey) === "true";
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
  }, [currentAudioUrl, waitsBeforeStart, resumeFrom, isCompletedInitial, onAudioLockChange]);

  // A new track gets its own single resume.
  useEffect(() => { resumedRef.current = false; }, [storageKey]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
    writeStorage(getLocalStorage(), VOLUME_KEY, String(volume));
  }, [volume, currentAudioUrl]);

  /* Duration arrives on its own event, not with the first time update. Reading
     it only inside `timeupdate` left it at 0 for the opening seconds - and for
     any encoding that reports it late, permanently - so the progress bar had no
     denominator and never moved off zero. `Infinity` is what a stream reports
     and is no more usable than 0, so both are treated as "not known yet". */
  const readDuration = (audioEl: HTMLAudioElement) => {
    setDuration(Number.isFinite(audioEl.duration) && audioEl.duration > 0 ? audioEl.duration : 0);
  };

  const handleDurationChange = () => {
    const audioEl = audioRef.current;
    if (audioEl) readDuration(audioEl);
  };

  /* A playlist part swaps the source under the same element, and the readout
     has to start over with it - otherwise the bar keeps the finished track's
     fill until the new one reports its first update. */
  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
  }, [currentAudioUrl]);

  const handleTimeUpdate = () => {
    const audioEl = audioRef.current;
    if (!audioEl) return;
    setCurrentTime(audioEl.currentTime);
    readDuration(audioEl);
    writeStorage(getSessionStorage(), storageKey, String(Math.floor(audioEl.currentTime)));
  };

  const handleEnded = () => {
    if (playlistIndex < playlist.length - 1) {
      setPlaylistIndex((prev) => prev + 1);
      return;
    }
    // Keeping the end position would resume a finished part at its last second
    // and immediately end it again.
    removeStorage(getSessionStorage(), storageKey);
    writeStorage(getLocalStorage(), completedKey, "true");
    setPhase("finished");
    /* The lock deliberately stays on here. Releasing it the moment the
       recording ended opened a five-second hole - the settle before the part
       hands over - in which the candidate could jump to another part, and on
       a paper where each recording plays once that is a way back into a
       section they have already heard. It is released below, at the point the
       part actually hands over. */
  };

  const handleSkipAudio = () => {
    playlist.forEach((_, idx) => {
      removeStorage(getSessionStorage(), positionKey(attemptId, currentPart.id, idx));
    });
    writeStorage(getLocalStorage(), completedKey, "true");
    setPlaylistIndex(playlist.length - 1);
    setPhase("finished");
    onAudioLockChange?.(false);
    onAudioComplete?.();
  };

  /* Once the recording is over the part is done, so the candidate is moved on
     after a short pause rather than being left on a section they can no longer
     answer. Navigation stays locked for the whole of that pause and is only
     released as the handover happens, so there is no moment between the last
     note and the next part in which the rail is live. */
  useEffect(() => {
    if (phase !== "finished") return;
    /* A part whose recording had already finished before this mount is one the
       candidate is revisiting. Nothing is about to play, so nothing should
       hold them on it. */
    if (wasCompletedOnMountRef.current) {
      onAudioLockChange?.(false);
      return;
    }
    const timer = window.setTimeout(() => {
      onAudioLockChange?.(false);
      onAudioComplete?.();
    }, END_DELAY_SECONDS * 1000);
    return () => window.clearTimeout(timer);
  }, [phase, onAudioComplete, onAudioLockChange]);

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
      onLoadedMetadata={handleDurationChange}
      onDurationChange={handleDurationChange}
      onEnded={handleEnded}
      onPlay={() => {
        setPhase("playing");
        onAudioLockChange?.(true);
      }}
    />
  );

  /* The exam transport is deliberately tiny and inert: a pause disc that
     reports state without accepting a click, and a volume slider. Elapsed
     time runs as a bar along the foot of the box. */
  if (languageCertSkin) {
    /* Progress through the whole part, not through the clip currently loaded.
       A per-question part is a playlist, and measuring only the active track
       sent the bar back to zero at every clip boundary - filling, snapping
       back, filling again, which is what read as the bar sticking. Each track
       is treated as an equal share of the part, so the value only ever
       increases and still lands exactly on 100% at the end. Track lengths are
       not known until each one loads, so equal shares is the only division
       available up front; for the single-track parts that are the common case
       it is exact. */
    const trackFraction = duration > 0 ? Math.min(1, currentTime / duration) : 0;
    const trackCount = Math.max(1, playlist.length);
    const elapsed = phase === "finished"
      ? 1
      : Math.min(1, (playlistIndex + trackFraction) / trackCount);
    return (
      <div className="lc-audio" aria-label="Listening Master Audio Track">
        {audioElement}
        <div className="lc-audio-box">
          <div className={`lc-audio-transport${phase === "playing" ? " is-playing" : ""}`}>
            <span className="lc-audio-pause" role="img" aria-label={phase === "playing" ? "Audio playing" : "Audio stopped"}>
              <LcTransportIcon playing={phase === "playing"} />
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
          {userEmail === "mehtanavish60@gmail.com" && (
            <button
              type="button"
              onClick={handleSkipAudio}
              style={{
                marginLeft: "12px",
                padding: "4px 8px",
                background: "#ee3124",
                color: "#ffffff",
                border: "none",
                borderRadius: "3px",
                fontSize: "11px",
                fontWeight: "bold",
                cursor: "pointer",
                whiteSpace: "nowrap",
                display: "inline-flex",
                alignItems: "center"
              }}
            >
              Skip Audio
            </button>
          )}
          <div className="lc-audio-track" aria-hidden="true">
            <div className="lc-audio-track-fill" style={{ width: `${elapsed * 100}%` }} />
          </div>
        </div>
        {/* Rendered unconditionally - see `.lc-audio-status`. The element
            holds its line whether or not there is anything to announce, so the
            paper below does not shift when the message changes. */}
        <p className="lc-audio-status" role="status">{statusText}</p>
      </div>
    );
  }

  return (
    <div className="lca-listening-header-player" aria-label="Listening Master Audio Track">
      <audio
        ref={audioRef}
        src={currentAudioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleDurationChange}
        onDurationChange={handleDurationChange}
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
        {userEmail === "mehtanavish60@gmail.com" && (
          <button
            type="button"
            onClick={handleSkipAudio}
            style={{
              marginLeft: "12px",
              padding: "6px 12px",
              background: "#ee3124",
              color: "#ffffff",
              border: "none",
              borderRadius: "4px",
              fontSize: "12px",
              fontWeight: "bold",
              cursor: "pointer",
              whiteSpace: "nowrap"
            }}
          >
            Skip Audio
          </button>
        )}
      </div>
    </div>
  );
}
