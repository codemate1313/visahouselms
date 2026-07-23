import { useEffect, useRef, useState } from "react";
import { API_BASE_URL, apiClient } from "../../api/client";
import { ExaminerAvatarSvg } from "./ExaminerAvatarSvg";
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
}

interface SpeakingAvatarProps {
  attemptId: number;
  partId: number;
  isCandidateRecording?: boolean;
  avatarOnly?: boolean;
}

export function SpeakingAvatar({ attemptId, partId, isCandidateRecording = false, avatarOnly = true }: SpeakingAvatarProps) {
  const [examiners, setExaminers] = useState<Examiner[]>([]);
  const [selectedExaminer, setSelectedExaminer] = useState<string>("sonia");
  const [avatarData, setAvatarData] = useState<AvatarData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentViseme, setCurrentViseme] = useState<number>(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Load available examiner list
  useEffect(() => {
    async function loadExaminers() {
      try {
        const { data } = await apiClient.get<Examiner[]>("/student/speaking-examiners");
        setExaminers(data);
      } catch {
        // Fallback default
      }
    }
    loadExaminers();
  }, []);

  // Fetch avatar payload for part & selected examiner
  useEffect(() => {
    let isMounted = true;
    async function loadAvatar() {
      setLoading(true);
      setIsPlaying(false);
      setCurrentViseme(0);
      try {
        const { data } = await apiClient.get<AvatarData>(
          `/student/attempts/${attemptId}/speaking-avatar/${partId}`,
          { params: { examiner_id: selectedExaminer } }
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
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [attemptId, partId, selectedExaminer]);

  // Handle viseme animation ticker during audio playback
  useEffect(() => {
    if (!isPlaying || !avatarData || !avatarData.visemes.length || !audioRef.current) {
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
      const visemes = avatarData.visemes;

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
  }, [isPlaying, avatarData]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.currentTime = 0;
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setCurrentViseme(0);
  };

  const examiner = avatarData?.examiner || examiners.find((e) => e.id === selectedExaminer);
  const audioFullUrl = avatarData?.audio_url ? `${API_BASE_URL}${avatarData.audio_url}` : "";

  if (avatarOnly) {
    return (
      <div className="speaking-avatar-only-wrapper">
        <div className="speaking-avatar-stage-box">
          <div
            className={`avatar-portrait-container ${isPlaying ? "speaking" : ""}`}
            onClick={togglePlay}
            title={audioFullUrl ? (isPlaying ? "Pause examiner audio" : "Click to listen to examiner") : undefined}
            style={{ cursor: audioFullUrl ? "pointer" : "default" }}
          >
            <div className="avatar-portrait-frame">
              <ExaminerAvatarSvg
                gender={examiner?.gender}
                viseme={currentViseme}
                isPlaying={isPlaying}
              />
            </div>
          </div>

          {/* Floating Elegant Status Tag */}
          <div className="avatar-floating-status-pill" onClick={togglePlay} style={{ cursor: audioFullUrl ? "pointer" : "default" }}>
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
                {audioFullUrl ? "Click Avatar to Listen" : "IELTS Examiner Ready"}
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
            <ExaminerAvatarSvg
              gender={examiner?.gender}
              viseme={currentViseme}
              isPlaying={isPlaying}
            />
          </div>
        </div>

        {/* Examiner Information & Prompt Content */}
        <div className="avatar-info-panel">
          <div className="avatar-badge-row">
            <span className="examiner-role-tag">IELTS Live Examiner</span>

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

            {/* Examiner Selector */}
            {examiners.length > 0 && (
              <select
                className="examiner-select-dropdown"
                value={selectedExaminer}
                onChange={(e) => setSelectedExaminer(e.target.value)}
                disabled={isPlaying}
                aria-label="Select IELTS Examiner Voice"
              >
                {examiners.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name} ({ex.accent})
                  </option>
                ))}
              </select>
            )}
          </div>

          <h3 className="examiner-name-title">
            {examiner ? `${examiner.name} — ${examiner.title}` : "IELTS Senior Examiner"}
          </h3>

          <p className="prompt-text-display">
            {loading
              ? "Preparing examiner audio..."
              : avatarData?.prompt_text || "Listen to the examiner prompt and speak your answer clearly."}
          </p>

          {/* Avatar Audio Controls */}
          {audioFullUrl && (
            <div className="avatar-controls-row">
              <button
                type="button"
                className={`avatar-btn ${isPlaying ? "avatar-btn-secondary" : "avatar-btn-primary"}`}
                onClick={togglePlay}
                disabled={loading}
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
                    {isPlaying ? "Replay Examiner" : "Listen to Examiner"}
                  </>
                )}
              </button>

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
