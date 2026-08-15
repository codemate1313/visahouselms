import { useEffect, useRef } from "react";
// @ts-expect-error - plain JS engine, no type declarations
import { TalkingAvatar } from "@/lib/talking-avatar.js";
import {
  type ExaminerPhotoSet,
  blinkFramesFor,
  framesFor,
  VISEME_TO_MOUTH,
} from "./examinerPhotoSets";
import "./PhotoExaminerAvatar.css";

interface VisemeFrame {
  time: number;
  viseme: number;
}

interface PhotoExaminerAvatarProps {
  set: ExaminerPhotoSet;
  /** The <audio> element playing the examiner prompt. */
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
  /** Backend viseme timeline — used only if audio analysis is unavailable. */
  visemes?: VisemeFrame[];
}

/**
 * Photo-based speaking examiner.
 *
 * One still head with the mouth region cross-faded between four photographs,
 * driven by how loud the examiner's voice is right now. Blinking and a little
 * head drift run on their own clocks so it reads as footage rather than a
 * photo with a moving mouth.
 *
 * There is deliberately nothing to configure here: the frame set arrives
 * pre-calibrated from `examinerPhotoSets.ts`.
 *
 * Audio path: the engine taps the same <audio> element the component above
 * already owns, via a Web Audio AnalyserNode. Prompt audio is same-origin (Vite
 * proxies /storage in dev, one host in production) so the analyser can read it.
 * If it ever cannot — a cross-origin deployment would silence it — the
 * component notices within a second and falls back to the backend's viseme
 * timeline instead of freezing.
 */
export function PhotoExaminerAvatar({
  set,
  audioRef,
  isPlaying,
  visemes,
}: PhotoExaminerAvatarProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const avatarRef = useRef<any>(null);
  const attachedTo = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const fallbackRef = useRef(false);

  // Build the avatar once per frame set.
  useEffect(() => {
    if (!mountRef.current) return;
    const avatar = new TalkingAvatar(mountRef.current, {
      ...set.options,
      frames: framesFor(set),
      blinkFrames: blinkFramesFor(set),
    });
    avatarRef.current = avatar;
    let alive = true;
    avatar.load().catch(() => {
      // A missing frame leaves the mount empty rather than throwing into React.
      if (alive) avatarRef.current = null;
    });
    return () => {
      alive = false;
      avatar.destroy();
      avatarRef.current = null;
      attachedTo.current = null;
      fallbackRef.current = false;
    };
  }, [set]);

  // Tap the audio element. createMediaElementSource may only be called once per
  // element, so this is guarded by which element we already attached to.
  useEffect(() => {
    const avatar = avatarRef.current;
    const audio = audioRef.current;
    if (!avatar || !audio || attachedTo.current === audio) return;
    try {
      avatar.attachMediaElement(audio);
      attachedTo.current = audio;
    } catch {
      fallbackRef.current = true;
    }
  }, [audioRef, isPlaying]);

  // Playback state: resume the context (browsers start it suspended), blink on
  // wake, and run the viseme fallback ticker while speaking.
  useEffect(() => {
    const avatar = avatarRef.current;
    if (!avatar) return;

    if (!isPlaying) {
      avatar.audioDriven = false;
      avatar.releaseDrive();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }

    avatar.ctx?.resume?.();
    avatar.audioDriven = true;
    avatar.blinkNow();

    const startedAt = performance.now();
    const tick = () => {
      const audio = audioRef.current;
      if (!audio) return;

      // If a second of playback goes by with the analyser reading pure silence,
      // it is not seeing the audio — switch to the viseme timeline for good.
      if (!fallbackRef.current && performance.now() - startedAt > 1000 && avatar.raw === 0) {
        fallbackRef.current = true;
      }

      if (fallbackRef.current && visemes?.length) {
        const t = audio.currentTime;
        let active = 0;
        for (const frame of visemes) {
          if (t >= frame.time) active = frame.viseme;
          else break;
        }
        const shape = VISEME_TO_MOUTH[active] ?? VISEME_TO_MOUTH[0];
        avatar.drive(shape.level, shape.tilt);
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [isPlaying, visemes, audioRef]);

  return <div ref={mountRef} className="photo-examiner-avatar" aria-hidden="true" />;
}
