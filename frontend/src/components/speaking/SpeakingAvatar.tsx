import { useEffect, useMemo, useRef, useState } from "react";
import { API_BASE_URL, apiClient } from "../../api/client";
import { ExaminerAvatarSvg } from "./ExaminerAvatarSvg";
import { PhotoExaminerAvatar } from "./PhotoExaminerAvatar";
import { getExaminerPhotoSet } from "./examinerPhotoSets";
import { Button } from "@/components/ui/Button/Button";

import "./SpeakingAvatar.css";

interface Examiner {
  id: string;
  name: string;
  title: string;
  gender: string;
  voice: string;
  accent: string;
  avatar_image: string;
}

interface VisemeFrame {
  time: number;
  viseme: number;
  word?: string | null;
}

interface AvatarData {
  examiner: Examiner;
  prompt_text: string;
  audio_url: string;
  video_url?: string | null;
  duration: number;
  visemes: VisemeFrame[];
  /* A Speaking 2 prompt is announced before it is asked: the examiner speaks
     the role-play situation, pauses, then asks. The heading arrives as its own
     clip so the authored pause stays a number rather than baked-in silence. */
  heading_text?: string | null;
  heading_audio_url?: string | null;
  heading_duration?: number;
  heading_visemes?: VisemeFrame[];
  heading_gap_seconds?: number;
}

interface PromptSegment {
  url: string;
  visemes: VisemeFrame[];
  /** Seconds the examiner waits before the next segment. */
  gapAfter: number;
}

const SONIA: Examiner = {
  id: "sonia",
  name: "Instructor",
  title: "Senior Language CERT Speaking Examiner",
  gender: "female",
  voice: "en-GB-SoniaNeural",
  accent: "British English",
  avatar_image: "/storage/avatars/examiner_female.svg",
};

interface SpeakingAvatarProps {
  attemptId: number;
  partId: number;
  questionId?: number;
  isCandidateRecording?: boolean;
  avatarOnly?: boolean;
  onAudioEnded?: () => void;
  /** True while the examiner is speaking or holding the pause between a
      heading and its question - the stretch in which the candidate is meant to
      be listening rather than answering. */
  onExaminerBusyChange?: (busy: boolean) => void;
  /** 0-1 playback position of the current clip, for a progress bar. Resets to
      0 at the start of every segment rather than tracking across the whole
      prompt, since a heading and its question are separate clips. */
  onAudioProgress?: (ratio: number) => void;
}

export function SpeakingAvatar({
  attemptId,
  partId,
  questionId,
  isCandidateRecording = false,
  avatarOnly = true,
  onAudioEnded,
  onExaminerBusyChange,
  onAudioProgress,
}: SpeakingAvatarProps) {
  const [avatarData, setAvatarData] = useState<AvatarData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [hasPlayedPrompt, setHasPlayedPrompt] = useState<boolean>(false);
  const [currentViseme, setCurrentViseme] = useState<number>(0);
  // Set if the photographic examiner cannot load its frames. The vector
  // examiner is then used instead: it animates from the viseme timeline, so a
  // missing photo costs fidelity rather than leaving a motionless face.
  const [photoUnavailable, setPhotoUnavailable] = useState<boolean>(false);
  // Which clip of this prompt is loaded, and whether the examiner is currently
  // in the authored pause between two of them.
  const [segmentIndex, setSegmentIndex] = useState<number>(0);
  const [inGap, setInGap] = useState<boolean>(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const gapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sonia is the fixed examiner. Authors control only what she says, never the
  // candidate-facing examiner identity or voice.
  useEffect(() => {
    let isMounted = true;
    async function loadAvatar() {
      audioRef.current?.pause();
      setLoading(true);
      setIsPlaying(false);
      setCurrentViseme(0);
      try {
        const headers: Record<string, string> = {};
        const attemptToken = sessionStorage.getItem(`final-test:${attemptId}:token`);
        if (attemptToken) {
          headers["X-Attempt-Token"] = attemptToken;
        }
        const { data } = await apiClient.get<AvatarData>(
          `/student/attempts/${attemptId}/speaking-avatar/${partId}`,
          {
            params: { examiner_id: SONIA.id, question_id: questionId },
            headers,
          }
        );
        if (isMounted) {
          setAvatarData(data);
        }
      } catch {
        if (isMounted) {
          setAvatarData(null);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (attemptId && partId) {
      loadAvatar();
    }

    return () => {
      isMounted = false;
    };
  }, [attemptId, partId, questionId]);

  useEffect(() => {
    const audio = audioRef.current;
    return () => audio?.pause();
  }, [avatarData]);

  // The prompt plays as one clip or two: a spoken heading, the authored pause,
  // then the question. Two clips rather than one so the pause stays a number
  // the author can change without re-synthesising the whole prompt.
  const segments = useMemo<PromptSegment[]>(() => {
    if (!avatarData?.audio_url) return [];
    const list: PromptSegment[] = [];
    if (avatarData.heading_audio_url) {
      list.push({
        url: avatarData.heading_audio_url,
        visemes: avatarData.heading_visemes ?? [],
        gapAfter: Math.max(0, avatarData.heading_gap_seconds ?? 0),
      });
    }
    list.push({ url: avatarData.audio_url, visemes: avatarData.visemes, gapAfter: 0 });
    return list;
  }, [avatarData]);

  useEffect(() => {
    // A new prompt starts from its first clip, and any pause still counting
    // down belongs to the prompt that was just replaced.
    if (gapTimerRef.current) clearTimeout(gapTimerRef.current);
    setSegmentIndex(0);
    setInGap(false);
  }, [segments]);

  useEffect(() => () => { if (gapTimerRef.current) clearTimeout(gapTimerRef.current); }, []);

  const currentSegment = segments[segmentIndex] ?? null;
  const isLastSegment = segmentIndex >= segments.length - 1;

  useEffect(() => {
    onExaminerBusyChange?.(isPlaying || inGap);
  }, [isPlaying, inGap, onExaminerBusyChange]);

  // Drives the progress bar in the control dock. Reset on every new clip so a
  // heading that finished at 100% does not flash as "already played" progress
  // on the question clip that follows it.
  useEffect(() => {
    onAudioProgress?.(0);
  }, [currentSegment?.url, onAudioProgress]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !onAudioProgress) return undefined;
    const reportProgress = () => {
      const duration = audio.duration;
      if (!duration || !Number.isFinite(duration)) return;
      onAudioProgress(Math.min(1, audio.currentTime / duration));
    };
    audio.addEventListener("timeupdate", reportProgress);
    return () => audio.removeEventListener("timeupdate", reportProgress);
  }, [onAudioProgress, currentSegment?.url]);

  // Handle viseme animation ticker during audio playback
  useEffect(() => {
    if (!isPlaying || !currentSegment?.visemes.length || !audioRef.current) {
      setCurrentViseme(0);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      return;
    }

    const updateVisemeFrame = () => {
      if (!audioRef.current || audioRef.current.paused) {
        setCurrentViseme(0);
        setIsPlaying(false);
        return;
      }

      const currentTime = audioRef.current.currentTime;
      const visemes = currentSegment.visemes;

      // Find active viseme for currentTime
      let activeViseme = 0;
      for (let i = 0; i < visemes.length; i++) {
        if (currentTime >= visemes[i].time) {
          activeViseme = visemes[i].viseme;
        } else {
          break;
        }
      }

      setCurrentViseme(activeViseme);
      animationFrameRef.current = requestAnimationFrame(updateVisemeFrame);
    };

    animationFrameRef.current = requestAnimationFrame(updateVisemeFrame);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, currentSegment]);

  const examiner = avatarData?.examiner || SONIA;
  // Photo avatar when this examiner has a frame set; vector avatar otherwise.
  const photoSet = photoUnavailable ? null : getExaminerPhotoSet(examiner?.id);
  const audioFullUrl = currentSegment ? `${API_BASE_URL}${currentSegment.url}` : "";
  // Keyed on the question, not on the words. Two prompts can legitimately share
  // wording - and prompt audio is cached by a hash of its text, so they would
  // share a URL too. Keying on the text alone meant the second one counted as
  // already played and was never spoken.
  const promptPlayKey = avatarData
    ? `speaking-avatar-played:${attemptId}:${partId}:${questionId ?? "intro"}:${SONIA.id}`
    : "";

  useEffect(() => {
    if (!promptPlayKey) {
      setHasPlayedPrompt(false);
      return;
    }
    setHasPlayedPrompt(sessionStorage.getItem(promptPlayKey) === "true");
  }, [promptPlayKey]);

  useEffect(() => {
    if (audioRef.current && audioFullUrl && promptPlayKey) {
      // Past the first clip the candidate has already heard the examiner start,
      // so the question after the pause plays regardless of what the prompt's
      // "already played" flag says - that flag is only set once the whole
      // prompt has been spoken.
      const alreadyPlayed = segmentIndex === 0 && sessionStorage.getItem(promptPlayKey) === "true";
      if (!alreadyPlayed) {
        audioRef.current.currentTime = 0;
        audioRef.current.play()
          .then(() => setIsPlaying(true))
          .catch(() => {
            // Autoplay refusal is expected until the user interacts; nothing to report.
            setIsPlaying(false);
          });
      }
    }
  }, [audioFullUrl, promptPlayKey, segmentIndex]);

  const togglePlay = () => {
    if (!audioRef.current || !audioFullUrl) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }
    if (hasPlayedPrompt) return;
    audioRef.current.currentTime = 0;
    audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setCurrentViseme(0);
    onAudioProgress?.(1);
    // The heading has finished, not the prompt. Hold for the authored pause,
    // then play the question - and leave the prompt unmarked until it has
    // actually been asked, or a refresh during the pause would skip it.
    if (!isLastSegment) {
      const gapMs = Math.max(0, currentSegment?.gapAfter ?? 0) * 1000;
      setInGap(true);
      if (gapTimerRef.current) clearTimeout(gapTimerRef.current);
      gapTimerRef.current = setTimeout(() => {
        setInGap(false);
        setSegmentIndex((index) => index + 1);
      }, gapMs);
      return;
    }
    setHasPlayedPrompt(true);
    if (promptPlayKey) {
      sessionStorage.setItem(promptPlayKey, "true");
    }
    if (onAudioEnded) {
      onAudioEnded();
    }
  };

  if (avatarOnly) {
    return (
      <div className="speaking-avatar-only-wrapper">
        <div className="speaking-avatar-stage-box">
          <div
            className={`avatar-portrait-container ${isPlaying ? "speaking" : ""}`}
            onClick={togglePlay}
            title={
              audioFullUrl
                ? hasPlayedPrompt
                  ? "Examiner audio already played for this question"
                  : isPlaying
                    ? "Pause examiner audio"
                    : "Click to listen to examiner"
                : undefined
            }
            style={{ cursor: audioFullUrl && !hasPlayedPrompt ? "pointer" : "default" }}
          >
            <div className="avatar-portrait-frame">
              {photoSet ? (
                <PhotoExaminerAvatar
                  set={photoSet}
                  audioRef={audioRef}
                  isPlaying={isPlaying}
                  visemes={currentSegment?.visemes}
                  onUnavailable={() => setPhotoUnavailable(true)}
                />
              ) : (
                <ExaminerAvatarSvg
                  gender={examiner?.gender}
                  viseme={currentViseme}
                  isPlaying={isPlaying}
                />
              )}
            </div>
          </div>

          {/* Floating Elegant Status Tag */}
          <div
            className="avatar-floating-status-pill"
            onClick={togglePlay}
            style={{ cursor: audioFullUrl && !hasPlayedPrompt ? "pointer" : "default" }}
          >
            {isPlaying ? (
              <span className="examiner-status-badge active">
                <span className="audio-wave-bar">
                  <span className="wave-line active" />
                  <span className="wave-line active" />
                  <span className="wave-line active" />
                  <span className="wave-line active" />
                  <span className="wave-line active" />
                </span>
                Examiner Speaking...
              </span>
            ) : (
              <span className="examiner-status-badge">
                <span className="status-dot-pulse" />
                {inGap ? "Examiner Pausing..." : hasPlayedPrompt ? "Examiner Audio Played" : audioFullUrl ? "Click Avatar to Listen" : "Language CERT Examiner Ready"}
              </span>
            )}
          </div>
        </div>

        {audioFullUrl && (
          <audio
            ref={audioRef}
            src={audioFullUrl}
            onEnded={handleAudioEnded}
            onPause={() => setIsPlaying(false)}
            preload="auto"
          />
        )}
      </div>
    );
  }

  return (
    <div className="speaking-avatar-card">
      <div className="avatar-stage">
        {/* Examiner Vector Stage Container */}
        <div className={`avatar-portrait-container ${isPlaying ? "speaking" : ""}`}>
          <div className="avatar-portrait-frame">
            {photoSet ? (
              <PhotoExaminerAvatar
                set={photoSet}
                audioRef={audioRef}
                isPlaying={isPlaying}
                visemes={currentSegment?.visemes}
                onUnavailable={() => setPhotoUnavailable(true)}
              />
            ) : (
              <ExaminerAvatarSvg
                gender={examiner?.gender}
                viseme={currentViseme}
                isPlaying={isPlaying}
              />
            )}
          </div>
        </div>

        {/* Examiner Information & Prompt Content */}
        <div className="avatar-info-panel">
          <div className="avatar-badge-row">
            <span className="examiner-role-tag">Language CERT Live Examiner</span>

            {isCandidateRecording ? (
              <span className="examiner-status-badge recording">
                <span className="wave-line active" />
                Candidate Recording...
              </span>
            ) : isPlaying ? (
              <span className="examiner-status-badge active">
                <span className="audio-wave-bar">
                  <span className="wave-line active" />
                  <span className="wave-line active" />
                  <span className="wave-line active" />
                  <span className="wave-line active" />
                  <span className="wave-line active" />
                </span>
                Examiner Speaking...
              </span>
            ) : (
              <span className="examiner-status-badge">Ready</span>
            )}

          </div>

          <h3 className="examiner-name-title">
            {examiner ? `${examiner.name} — ${examiner.title}` : "Language CERT Senior Examiner"}
          </h3>

          <p className="prompt-text-display">
            {loading ? "Preparing Instructor's audio..." : "Listen carefully to Instructor, then record your answer."}
          </p>

          {/* Avatar Audio Controls */}
          {audioFullUrl && (
            <div className="avatar-controls-row">
              <Button
                type="button"
                className={`avatar-btn ${isPlaying ? "avatar-btn-secondary" : "avatar-btn-primary"}`}
                onClick={togglePlay}
                disabled={loading || hasPlayedPrompt}
              >
                {isPlaying ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="6" y="4" width="4" height="16" rx="1" />
                      <rect x="14" y="4" width="4" height="16" rx="1" />
                    </svg>
                    Pause Examiner
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    {hasPlayedPrompt ? "Audio Played" : "Listen to Examiner"}
                  </>
                )}
              </Button>

              <audio
                ref={audioRef}
                src={audioFullUrl}
                onEnded={handleAudioEnded}
                onPause={() => setIsPlaying(false)}
                preload="auto"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
