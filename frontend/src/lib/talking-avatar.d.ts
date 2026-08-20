declare module "@/lib/talking-avatar.js" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export class TalkingAvatar {
    constructor(mount: HTMLElement, options?: Record<string, unknown>);
    [key: string]: any;
  }

  /** Create (if needed) and resume the shared AudioContext driving every
   *  examiner avatar's lip-sync and audio output. Call synchronously from a
   *  real click/tap handler - see the implementation for why. */
  export function unlockSharedAudioContext(): AudioContext | null;
}
