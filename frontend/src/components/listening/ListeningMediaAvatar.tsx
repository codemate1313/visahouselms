import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_BASE_URL } from "@/api/client";
import type { AttemptAsset } from "@/api/types";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui";
import { ExaminerAvatarSvg } from "@/components/speaking/ExaminerAvatarSvg";
import "./ListeningMediaAvatar.css";

interface ListeningMediaAvatarProps {
  asset: AttemptAsset;
}

export function extractVoiceMetadata(transcript: string): Record<string, "male" | "female" | "auto"> {
  const match = transcript.match(/^\[Voices:\s*(.*?)\]/);
  if (!match) return {};
  try {
    return JSON.parse(match[1]);
  } catch (e) {
    return {};
  }
}

export function stripVoiceMetadata(transcript: string): string {
  return transcript.replace(/^\[Voices: .*?\]\s*/, "");
}

interface SpeechLine {
  speaker: string;
  text: string;
  speakerIndex: number;
}

const KNOWN_MALE_VOICES = ["daniel", "alex", "fred", "rishi", "oliver", "david", "george", "mark", "aaron", "arthur", "bruce"];
const KNOWN_FEMALE_VOICES = ["samantha", "victoria", "karen", "moira", "fiona", "tessa", "zira", "hazel", "susan", "alice", "catherine", "lucinda", "marie", "martha", "nicky", "stephanie"];

export function findVoiceByGender(voices: SpeechSynthesisVoice[], locale: string, gender: "male" | "female" | "auto"): { voice: SpeechSynthesisVoice | null, pitch: number } {
  const matchingLocale = voices.filter((v) => v.lang.toLowerCase() === locale);
  
  if (gender === "auto") {
    return { voice: matchingLocale.length ? matchingLocale[0] : (voices[0] ?? null), pitch: 1.0 };
  }
  
  const target = gender.toLowerCase();
  const knownNames = gender === "male" ? KNOWN_MALE_VOICES : KNOWN_FEMALE_VOICES;

  const findInList = (list: SpeechSynthesisVoice[]) => {
    for (const v of list) {
      if (v.name.toLowerCase().includes(target)) return v;
    }
    for (const v of list) {
      const name = v.name.toLowerCase();
      if (knownNames.some((known) => name.includes(known))) return v;
    }
    return null;
  };

  const localeMatch = findInList(matchingLocale);
  if (localeMatch) return { voice: localeMatch, pitch: 1.0 };

  const globalMatch = findInList(voices);
  if (globalMatch) return { voice: globalMatch, pitch: 1.0 };
  
  if (matchingLocale.length > 1 && gender === "female") {
     return { voice: matchingLocale[1], pitch: 1.0 };
  }
  if (voices.length > 1 && gender === "female") {
     return { voice: voices[1], pitch: 1.0 };
  }
  
  // Extreme Fallback: the OS likely only has one English voice.
  // We use the default voice, but alter the pitch to simulate gender.
  const fallbackVoice = matchingLocale[0] || voices[0] || null;
  const fallbackPitch = gender === "male" ? 0.7 : 1.3;
  
  return { voice: fallbackVoice, pitch: fallbackPitch };
}

function parseSpeechLines(transcript: string): SpeechLine[] {
  const speakerIndexes = new Map<string, number>();
  const cleanTranscript = stripVoiceMetadata(transcript);
  return cleanTranscript
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^([^:]{1,40}):\s*(.+)$/);
      const speaker = match?.[1].trim() || "Narrator";
      const text = match?.[2].trim() || line;
      if (!speakerIndexes.has(speaker)) speakerIndexes.set(speaker, speakerIndexes.size);
      return { speaker, text, speakerIndex: speakerIndexes.get(speaker) ?? 0 };
    });
}

function speechRate(rate: string | null): number {
  const percentage = Number.parseInt(rate ?? "0", 10);
  return Math.min(1.5, Math.max(0.65, 1 + (Number.isFinite(percentage) ? percentage / 100 : 0)));
}

export function ListeningMediaAvatar({ asset }: ListeningMediaAvatarProps) {
  const isBrowserNarration = asset.asset_type === "tts_text";
  const speechLines = useMemo(() => parseSpeechLines(asset.transcript ?? ""), [asset.transcript]);
  const voiceMetadata = useMemo(() => extractVoiceMetadata(asset.transcript ?? ""), [asset.transcript]);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speaker, setSpeaker] = useState("Narrator");
  const [speakerIndex, setSpeakerIndex] = useState(0);
  const [viseme, setViseme] = useState(0);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const runRef = useRef(0);
  const mouthTimerRef = useRef<number | null>(null);
  const utterancesRef = useRef<SpeechSynthesisUtterance[]>([]);
  const speechSupported = typeof window !== "undefined"
    && "speechSynthesis" in window
    && "SpeechSynthesisUtterance" in window;

  const stopMouth = useCallback(() => {
    if (mouthTimerRef.current !== null) window.clearInterval(mouthTimerRef.current);
    mouthTimerRef.current = null;
    setViseme(0);
  }, []);

  const startMouth = useCallback(() => {
    stopMouth();
    mouthTimerRef.current = window.setInterval(() => {
      setViseme((current) => (current % 5) + 1);
    }, 135);
  }, [stopMouth]);

  useEffect(() => {
    if (!speechSupported || !isBrowserNarration) return undefined;
    const loadVoices = () => setVoices(window.speechSynthesis.getVoices());
    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
  }, [isBrowserNarration, speechSupported]);

  const stopSpeech = useCallback(() => {
    runRef.current += 1;
    if (speechSupported) window.speechSynthesis.cancel();
    utterancesRef.current = [];
    stopMouth();
    setIsPlaying(false);
    setIsPaused(false);
  }, [speechSupported, stopMouth]);

  useEffect(() => stopSpeech, [asset.id, stopSpeech]);

  const startSpeech = useCallback(() => {
    if (!speechSupported || !speechLines.length) return;
    const synth = window.speechSynthesis;
    const run = runRef.current + 1;
    runRef.current = run;
    synth.cancel();
    setSpeechError(null);
    setIsPaused(false);

    const englishVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith("en"));
    const preferredLocale = (asset.tts_voice || "en-GB").toLowerCase();
    const preferredVoices = englishVoices.filter(
      (voice) => voice.lang.toLowerCase() === preferredLocale,
    );
    const usableVoices = preferredVoices.length ? preferredVoices : englishVoices;

    const utterances = speechLines.map((line, index) => {
      const utterance = new SpeechSynthesisUtterance(line.text);
      utterance.lang = asset.tts_voice || "en-GB";
      utterance.rate = speechRate(asset.tts_rate);
      
      const roleGender = voiceMetadata[line.speaker] || "auto";
      const targetVoiceResult = roleGender === "auto" 
        ? { voice: (usableVoices[line.speakerIndex % Math.max(usableVoices.length, 1)] ?? null), pitch: 1.0 }
        : findVoiceByGender(englishVoices, preferredLocale, roleGender as any);
        
      if (targetVoiceResult.voice) utterance.voice = targetVoiceResult.voice;
      utterance.pitch = targetVoiceResult.pitch;
      
      utterance.onstart = () => {
        if (runRef.current !== run) return;
        setSpeaker(line.speaker);
        setSpeakerIndex(line.speakerIndex);
        setIsPlaying(true);
        startMouth();
      };
      utterance.onend = () => {
        if (runRef.current !== run || index !== speechLines.length - 1) return;
        stopMouth();
        setIsPlaying(false);
        setIsPaused(false);
        utterancesRef.current = [];
      };
      utterance.onerror = (event) => {
        if (runRef.current !== run || event.error === "canceled") return;
        stopMouth();
        setIsPlaying(false);
        setSpeechError("Browser narration could not play. Check your system voice settings.");
      };
      return utterance;
    });
    utterancesRef.current = utterances;
    utterances.forEach((utterance) => synth.speak(utterance));
  }, [
    asset.tts_rate,
    asset.tts_voice,
    speechLines,
    speechSupported,
    startMouth,
    stopMouth,
    voices,
  ]);

  const toggleSpeech = () => {
    if (!speechSupported) return;
    if (!isPlaying) {
      startSpeech();
      return;
    }
    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      startMouth();
    } else {
      window.speechSynthesis.pause();
      setIsPaused(true);
      stopMouth();
    }
  };

  return (
    <div className={`listening-avatar-player${isBrowserNarration ? "" : " has-no-portrait"}`}>
      {/* The portrait lip-syncs to speech synthesis, so it only means anything
          for browser narration. Against an uploaded mp3 it never moves. */}
      {isBrowserNarration && (
        <div className={`listening-avatar-portrait${isPlaying && !isPaused ? " is-speaking" : ""}`}>
          <ExaminerAvatarSvg
            gender={speakerIndex % 2 ? "male" : "female"}
            isPlaying={isPlaying && !isPaused}
            viseme={viseme}
          />
        </div>
      )}
      <div className="listening-avatar-media">
        <div className="listening-avatar-heading">
          <div>
            <span>{isBrowserNarration ? "Browser narration" : "Listening audio"}</span>
            <strong>{asset.title}</strong>
          </div>
          <span className={isPlaying && !isPaused ? "is-active" : ""}>
            {isPlaying ? (isPaused ? "Paused" : `${speaker} speaking`) : "Ready"}
          </span>
        </div>

        {isBrowserNarration ? (
          <>
            {speechSupported ? (
              <div className="listening-browser-controls">
                <Button
                  leftIcon={<Icon name={isPlaying && !isPaused ? "pause" : "play"} />}
                  onClick={toggleSpeech}
                  size="sm"
                  variant={isPlaying ? "secondary" : "primary"}
                >
                  {isPlaying ? (isPaused ? "Resume" : "Pause") : "Play narration"}
                </Button>
                {isPlaying && (
                  <Button onClick={stopSpeech} size="sm" variant="text">
                    Stop
                  </Button>
                )}
                <span>{asset.tts_voice || "en-GB"} · system voice</span>
              </div>
            ) : (
              <p className="listening-avatar-error">
                Browser narration is unavailable. Use a current version of Chrome, Edge, or Safari.
              </p>
            )}
          </>
        ) : asset.url ? (
          <audio
            controls
            onEnded={() => {
              setIsPlaying(false);
              stopMouth();
            }}
            onPause={() => {
              setIsPlaying(false);
              stopMouth();
            }}
            onPlay={() => {
              setIsPlaying(true);
              startMouth();
            }}
            preload="metadata"
            src={`${API_BASE_URL}${asset.url}`}
          />
        ) : null}
        {speechError && <p className="listening-avatar-error">{speechError}</p>}
      </div>
    </div>
  );
}
