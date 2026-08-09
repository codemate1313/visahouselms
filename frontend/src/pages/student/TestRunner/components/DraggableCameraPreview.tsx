import { useEffect, useRef, useState, type PointerEvent } from "react";

interface DraggableCameraPreviewProps {
  stream: MediaStream;
}

const PREVIEW_WIDTH = 192;
const PREVIEW_HEIGHT = 144;
const VIEWPORT_MARGIN = 18;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function defaultPosition() {
  return {
    x: maxX(),
    y: Math.max(VIEWPORT_MARGIN, window.innerHeight - PREVIEW_HEIGHT - 86),
  };
}

function maxX() {
  return Math.max(VIEWPORT_MARGIN, window.innerWidth - PREVIEW_WIDTH - VIEWPORT_MARGIN);
}

function maxY() {
  return Math.max(VIEWPORT_MARGIN, window.innerHeight - PREVIEW_HEIGHT - VIEWPORT_MARGIN);
}

export function DraggableCameraPreview({ stream }: DraggableCameraPreviewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const dragRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null);
  const [position, setPosition] = useState(defaultPosition);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    video.play().catch(() => {});
    return () => {
      video.srcObject = null;
    };
  }, [stream]);

  useEffect(() => {
    const onResize = () => {
      setPosition((current) => ({
        x: clamp(current.x, VIEWPORT_MARGIN, maxX()),
        y: clamp(current.y, VIEWPORT_MARGIN, maxY()),
      }));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setPosition({
      x: clamp(event.clientX - drag.offsetX, VIEWPORT_MARGIN, maxX()),
      y: clamp(event.clientY - drag.offsetY, VIEWPORT_MARGIN, maxY()),
    });
  }

  function onPointerEnd(event: PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return (
    <div
      className="test-camera-preview"
      style={{ left: position.x, top: position.y }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      role="region"
      aria-label="Live camera preview"
    >
      <video ref={videoRef} muted playsInline />
      <span>Live camera</span>
    </div>
  );
}
