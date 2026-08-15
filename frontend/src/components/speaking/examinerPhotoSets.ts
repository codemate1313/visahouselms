/**
 * Photo examiner avatars.
 *
 * Each entry is a complete, already-calibrated frame set: one opaque head plus
 * three mouth-only overlays, and an eight-step eyelid animation. The numbers
 * below were measured from the photos themselves (mouth centre by image diff,
 * eye rectangles by hand) — nothing here is meant to be tuned at runtime, which
 * is why there is no settings UI.
 *
 * To add another examiner, shoot four frames of the same person under identical
 * light (mouth closed / just parted / open / wide), run
 *   tools/build_mouth_overlays.py  and  tools/build_blink_frames.py
 * from the talking-avatar project, drop the output in
 * `public/examiner-avatar/<key>/`, and add an entry here. Genders with no entry
 * fall back to the original vector examiner automatically.
 */

export interface ExaminerPhotoSet {
  /** Folder under /public, no trailing slash. */
  base: string;
  /** Engine options — see frontend/src/lib/talking-avatar.js DEFAULTS. */
  options: Record<string, unknown>;
}

const SONIA: ExaminerPhotoSet = {
  base: "/examiner-avatar",
  options: {
    // How far the mouth opens. Lower sensitivity caps the peak; higher gamma
    // means only the loud parts reach the wide-open frame. At 1.0 / 0.72 the
    // mouth sat in the wide band ~80% of the time, which read as gawping.
    sensitivity: 0.85,
    gamma: 0.8,
    // where the mouth sits in the 768px frames, so shaping pivots on it
    mouth: { cx: 359, cy: 401 },
    // measured eye rectangles (only used by the CSS fallback lid; the
    // pre-rendered blink sequence below supersedes them)
    eyes: {
      left: { x: 280, y: 241, w: 64, h: 30 },
      right: { x: 386, y: 239, w: 62, h: 29 },
      donorOffsetY: -44,
    },
  },
};

/**
 * gender -> photo set. `male` has no photo frames yet, so male examiners keep
 * the vector avatar until a male frame set is shot.
 */
const SETS: Record<string, ExaminerPhotoSet | undefined> = {
  female: SONIA,
  male: undefined,
};

export function getExaminerPhotoSet(gender?: string | null): ExaminerPhotoSet | null {
  if (!gender) return null;
  return SETS[gender.toLowerCase()] ?? null;
}

/** Build the frame URLs the engine expects from a set's base folder. */
export function framesFor(set: ExaminerPhotoSet) {
  return {
    closed: `${set.base}/avatar_closed.png`,
    small: `${set.base}/avatar_small_open.png`,
    medium: `${set.base}/avatar_medium_open.png`,
    wide: `${set.base}/avatar_wide_open.png`,
  };
}

export function blinkFramesFor(set: ExaminerPhotoSet) {
  return Array.from({ length: 8 }, (_, i) => `${set.base}/avatar_blink_${i + 1}.png`);
}

/**
 * The backend's viseme ids (see backend/app/services/avatar_service.py):
 *   0 rest · 1 A/O wide · 2 E/I smile · 3 U/W round · 4 M/P/B closed · 5 L/N/T/D
 * mapped to how far the mouth opens and how wide vs round it is.
 * Only used when audio analysis is unavailable.
 */
export const VISEME_TO_MOUTH: Record<number, { level: number; tilt: number }> = {
  0: { level: 0.0, tilt: 0 },
  1: { level: 1.0, tilt: -0.2 },
  2: { level: 0.55, tilt: 1 },
  3: { level: 0.35, tilt: -1 },
  4: { level: 0.0, tilt: 0 },
  5: { level: 0.45, tilt: 0.4 },
};
