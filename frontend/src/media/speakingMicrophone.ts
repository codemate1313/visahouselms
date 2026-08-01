let speakingMicrophoneStream: MediaStream | null = null;

function hasLiveAudioTrack(stream: MediaStream | null): boolean {
  return Boolean(stream?.getAudioTracks().some((track) => track.readyState === "live" && track.enabled));
}

export function hasVerifiedSpeakingMicrophone(): boolean {
  return hasLiveAudioTrack(speakingMicrophoneStream);
}

export async function getSpeakingMicrophoneStream(): Promise<MediaStream> {
  if (speakingMicrophoneStream && hasLiveAudioTrack(speakingMicrophoneStream)) return speakingMicrophoneStream;
  speakingMicrophoneStream?.getTracks().forEach((track) => track.stop());
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("This browser does not support microphone recording.");
  }
  speakingMicrophoneStream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  if (!hasLiveAudioTrack(speakingMicrophoneStream)) {
    releaseSpeakingMicrophone();
    throw new Error("No active microphone was detected.");
  }
  return speakingMicrophoneStream;
}

export function createSpeakingMediaRecorder(stream: MediaStream): MediaRecorder {
  if (typeof MediaRecorder === "undefined") {
    throw new Error("This browser does not support audio recording.");
  }
  const preferredTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  const mimeType = preferredTypes.find((type) => MediaRecorder.isTypeSupported(type));
  return mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
}

export function cloneSpeakingMicrophoneStream(source?: MediaStream | null): MediaStream {
  const stream = source && hasLiveAudioTrack(source) ? source : speakingMicrophoneStream;
  const track = stream?.getAudioTracks().find((item) => item.readyState === "live" && item.enabled);
  if (!track) throw new Error("No active microphone was detected.");
  return new MediaStream([track.clone()]);
}

export function releaseSpeakingMicrophone(): void {
  speakingMicrophoneStream?.getTracks().forEach((track) => track.stop());
  speakingMicrophoneStream = null;
}
