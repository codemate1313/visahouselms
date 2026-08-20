import { useEffect, useRef, useState } from "react";
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
  /** Called if the photo frames cannot load, so the caller can fall back. */
  onUnavailable?: () => void;
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
  onUnavailable,
}: PhotoExaminerAvatarProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const avatarRef = useRef<any>(null);
  const attachedTo = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const fallbackRef = useRef(false);
  const [avatarReady, setAvatarReady] = useState(false);
  const onUnavailableRef = useRef(onUnavailable);
  useEffect(() => {
    onUnavailableRef.current = onUnavailable;
  }, [onUnavailable]);

  // Build the avatar once per frame set.
  useEffect(() => {
    if (!mountRef.current) return;
    setAvatarReady(false);
    const avatar = new TalkingAvatar(mountRef.current, {
      ...set.options,
      frames: framesFor(set),
      blinkFrames: blinkFramesFor(set),
    });
    avatarRef.current = avatar;
    // Hang the engine off its own node - no global - so the mouth can be
    // inspected live in DevTools when someone reports a still examiner.
    (mountRef.current as unknown as { __avatar?: unknown }).__avatar = avatar;

    // Resume AudioContext synchronously on click of the avatar container to bypass browser restrictions
    const handleContainerClick = () => {
      if (avatarRef.current?.ctx) {
        avatarRef.current.ctx.resume().catch(() => {});
      }
    };
    const node = mountRef.current;
    node.addEventListener("click", handleContainerClick);

    let alive = true;
    avatar.load().then(() => {
      if (alive && avatarRef.current === avatar) setAvatarReady(true);
    }).catch(() => {
      // A missing or unreachable frame used to leave the mount empty and the
      // examiner permanently still. Tell the caller so it can show the vector
      // examiner, which animates from the viseme timeline instead.
      if (!alive) return;
      avatarRef.current = null;
      onUnavailableRef.current?.();
    });
    return () => {
      alive = false;
      node.removeEventListener("click", handleContainerClick);
      avatar.destroy();
      avatarRef.current = null;
      attachedTo.current = null;
      fallbackRef.current = false;
      setAvatarReady(false);
    };
  }, [set]);

  // Tap the audio element. createMediaElementSource may only be called once per
  // element, so this is guarded by which element we already attached to.
  //
  // This listens on the element rather than reacting to `isPlaying`, because
  // `audioRef` is a ref: its `.current` filling in never re-runs an effect. The
  // <audio> element is created only once the prompt has been fetched, which is
  // usually after the frames have finished loading - so an attach that waits on
  // React state can miss its window entirely and leave the mouth still.
  useEffect(() => {
    const avatar = avatarRef.current;
    if (!avatarReady || !avatar) return;

    const attach = () => {
      const audio = audioRef.current;
      if (!audio || attachedTo.current === audio) return;
      try {
        avatar.attachMediaElement(audio);
        attachedTo.current = audio;
      } catch {
        // Already routed elsewhere, or Web Audio is unavailable: the viseme
        // timeline below takes over.
        fallbackRef.current = true;
      }
    };

    attach();
    const audio = audioRef.current;
    audio?.addEventListener("playing", attach);
    return () => audio?.removeEventListener("playing", attach);
  }, [audioRef, isPlaying, avatarReady]);

  // Playback state: resume the context (browsers start it suspended), blink on
  // wake, and run the viseme fallback ticker while speaking.
  useEffect(() => {
    const avatar = avatarRef.current;
    if (!avatarReady || !avatar) return;

    if (!isPlaying) {
      avatar.audioDriven = false;
      avatar.releaseDrive();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      if (mountRef.current) mountRef.current.dataset.driver = "silent";
      return;
    }

    avatar.ctx?.resume?.();
    avatar.audioDriven = true;
    avatar.blinkNow();

    const startedAt = performance.now();
    const tick = () => {
      const audio = audioRef.current;
      if (!audio) return;

      const useVisemes = Boolean(visemes && visemes.length > 0);

      if (useVisemes) {
        const t = audio.currentTime;
        let active = 0;
        for (const frame of visemes!) {
          if (t >= frame.time) active = frame.viseme;
          else break;
        }
        const shape = VISEME_TO_MOUTH[active] ?? VISEME_TO_MOUTH[0];
        avatar.drive(shape.level, shape.tilt);
      } else {
        // Fall back to analyser if no visemes
        if (!fallbackRef.current && !avatar.analyser) {
          fallbackRef.current = true;
        } else if (!fallbackRef.current && performance.now() - startedAt > 1000 && avatar.raw === 0) {
          fallbackRef.current = true;
        }

        if (fallbackRef.current) {
          avatar.releaseDrive(); // Let it remain still if we have no fallback content either
        } else {
          avatar.releaseDrive(); // Let analyser drive
        }
      }

      // Publish what is actually driving the mouth right now: `analyser` means
      // the examiner's voice is being measured, `visemes` means the timeline is
      // standing in for it, `idle` means nothing is driving it at all. Visible
      // on the element as data-driver / data-level.
      const node = mountRef.current;
      if (node) {
        node.dataset.driver = useVisemes
          ? "visemes"
          : fallbackRef.current
            ? "visemes-fallback"
            : avatar.analyser
              ? "analyser"
              : "idle";
        node.dataset.level = String(Math.round((avatar.level ?? 0) * 100));
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [isPlaying, visemes, audioRef, avatarReady]);

  return <div ref={mountRef} className="photo-examiner-avatar" aria-hidden="true" />;
}
