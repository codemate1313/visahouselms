import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { Icon } from "@/components/icons";
import {
  createSpeakingMediaRecorder,
  getSpeakingMicrophoneStream,
  releaseSpeakingMicrophone,
} from "@/media/speakingMicrophone";
import "./MicrophoneCheck.css";

interface MicrophoneCheckProps {
  testTitle?: string;
  onReady: () => void;
  onCancel?: () => void;
}

type CheckState = "idle" | "checking" | "passed" | "failed";

export function MicrophoneCheck({ testTitle, onReady, onCancel }: MicrophoneCheckProps) {
  const [state, setState] = useState<CheckState>("idle");
  const [secondsLeft, setSecondsLeft] = useState(3);
  const [level, setLevel] = useState(0);
  const [sampleUrl, setSampleUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sampleUrlRef = useRef<string | null>(null);
  const runningRef = useRef(false);

  useEffect(() => () => {
    if (sampleUrlRef.current) URL.revokeObjectURL(sampleUrlRef.current);
  }, []);

  const replaceSampleUrl = (next: string | null) => {
    if (sampleUrlRef.current) URL.revokeObjectURL(sampleUrlRef.current);
    sampleUrlRef.current = next;
    setSampleUrl(next);
  };

  const runCheck = async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setState("checking");
    setSecondsLeft(3);
    setLevel(0);
    setError(null);
    replaceSampleUrl(null);

    let audioContext: AudioContext | null = null;
    let sampleStream: MediaStream | null = null;
    let animationFrame = 0;
    let countdown = 0;
    try {
      const sourceStream = await getSpeakingMicrophoneStream();
      sampleStream = new MediaStream(sourceStream.getAudioTracks().map((track) => track.clone()));
      const recorder = createSpeakingMediaRecorder(sampleStream);
      const chunks: BlobPart[] = [];
      let peak = 0;

      audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      audioContext.createMediaStreamSource(sourceStream).connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      const readLevel = () => {
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (const sample of samples) {
          const normalized = (sample - 128) / 128;
          sum += normalized * normalized;
        }
        const rms = Math.sqrt(sum / samples.length);
        peak = Math.max(peak, rms);
        setLevel(Math.min(100, Math.round(rms * 700)));
        animationFrame = requestAnimationFrame(readLevel);
      };

      const recording = new Promise<Blob>((resolve, reject) => {
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunks.push(event.data);
        };
        recorder.onerror = () => reject(new Error("The browser could not record the microphone sample."));
        recorder.onstop = () => {
          const contentType = (recorder.mimeType || "audio/webm").split(";")[0];
          resolve(new Blob(chunks, { type: contentType }));
        };
      });

      recorder.start(250);
      readLevel();
      countdown = window.setInterval(() => setSecondsLeft((value) => Math.max(0, value - 1)), 1000);
      await new Promise((resolve) => window.setTimeout(resolve, 3200));
      if (recorder.state === "recording") recorder.stop();
      const blob = await recording;
      sampleStream.getTracks().forEach((track) => track.stop());
      sampleStream = null;

      if (blob.size < 1000 || peak < 0.004) {
        setState("failed");
        setError("No clear voice was detected. Select the correct microphone, speak normally, and try again.");
        return;
      }
      const url = URL.createObjectURL(blob);
      replaceSampleUrl(url);
      setLevel(100);
      setState("passed");
    } catch (err: unknown) {
      releaseSpeakingMicrophone();
      setState("failed");
      setError(err instanceof Error ? err.message : "Microphone access was blocked. Allow it in browser settings and retry.");
    } finally {
      runningRef.current = false;
      if (countdown) window.clearInterval(countdown);
      if (animationFrame) cancelAnimationFrame(animationFrame);
      sampleStream?.getTracks().forEach((track) => track.stop());
      await audioContext?.close().catch(() => {});
    }
  };

  const cancel = () => {
    releaseSpeakingMicrophone();
    replaceSampleUrl(null);
    onCancel?.();
  };

  return (
    <div className="microphone-check-page" role="dialog" aria-modal="true" aria-labelledby="microphone-check-title">
      <section className="microphone-check-card">
        <div className="microphone-check-icon"><Icon name="microphone" /></div>
        <span className="page-eyebrow">Audio setup</span>
        <h1 id="microphone-check-title">Check your microphone</h1>
        <p>
          {testTitle ? `${testTitle} includes recorded answers. ` : ""}
          Record a three-second sample and speak clearly. Your test will not start until sound is detected.
        </p>

        <div className={`microphone-level is-${state}`}>
          <span style={{ width: `${level}%` }} />
        </div>
        <strong className="microphone-check-status">
          {state === "checking"
            ? `Speak now — ${secondsLeft}`
            : state === "passed"
              ? "Microphone is working"
              : state === "failed"
                ? "Microphone check failed"
                : "Ready to test your microphone"}
        </strong>

        {error && <p className="microphone-check-error">{error}</p>}
        {sampleUrl && <audio className="microphone-sample" controls src={sampleUrl} />}

        <div className="microphone-check-actions">
          {onCancel && <Button variant="secondary" onClick={cancel} disabled={state === "checking"}>Cancel</Button>}
          {state !== "passed" && (
            <Button onClick={runCheck} loading={state === "checking"} disabled={state === "checking"}>
              {state === "failed" ? "Try microphone again" : "Record test sample"}
            </Button>
          )}
          {state === "passed" && <Button onClick={onReady}>Start test</Button>}
        </div>
      </section>
    </div>
  );
}
