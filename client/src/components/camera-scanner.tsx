import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Camera, RotateCcw } from "lucide-react";

interface CameraScannerProps {
  onCapture: (file: File) => void;
  onClose: () => void;
}

export function CameraScanner({ onCapture, onClose }: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async (facing: "environment" | "user") => {
    try {
      stopStream();
      setError(null);
      setReady(false);

      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Camera is not available in this browser.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1440 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => setReady(true);
      }
    } catch (e: any) {
      console.error("Camera error:", e);
      if (e.name === "NotAllowedError") {
        setError("Camera permission was denied. Please allow camera access in your browser settings.");
      } else if (e.name === "NotFoundError") {
        setError("No camera found on this device.");
      } else {
        setError("Could not access camera. Try uploading a photo instead.");
      }
    }
  }, [stopStream]);

  useEffect(() => {
    startCamera(facingMode);
    return stopStream;
  }, []);

  const flipCamera = useCallback(() => {
    const next = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    startCamera(next);
  }, [facingMode, startCamera]);

  const takePhoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) {
      console.error("[Camera] No video or canvas element");
      return;
    }

    console.log(`[Camera] Capturing - video: ${video.videoWidth}x${video.videoHeight}, readyState: ${video.readyState}`);
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.error("[Camera] Could not get canvas 2d context");
      return;
    }

    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) {
        console.log(`[Camera] Photo captured: ${blob.size} bytes, type: ${blob.type}`);
        const file = new File([blob], `script-scan-${Date.now()}.jpg`, { type: "image/jpeg" });
        stopStream();
        onCapture(file);
      } else {
        console.error("[Camera] canvas.toBlob returned null");
      }
    }, "image/jpeg", 0.92);
  }, [onCapture, stopStream]);

  const handleClose = useCallback(() => {
    stopStream();
    onClose();
  }, [onClose, stopStream]);

  return (
    <div
      className="fixed inset-0 z-[100] bg-black flex flex-col"
      data-testid="camera-scanner"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="flex items-center justify-between p-3 safe-top" style={{ zIndex: 10 }}>
        <button
          onClick={handleClose}
          aria-label="Close scanner"
          className="w-10 h-10 flex items-center justify-center text-white rounded-full bg-white/10 active:bg-white/20"
          data-testid="button-close-scanner"
        >
          <X className="h-5 w-5" />
        </button>
        <span className="text-white/60 text-xs font-medium">Scan script page</span>
        <button
          onClick={flipCamera}
          aria-label="Flip camera"
          className="w-10 h-10 flex items-center justify-center text-white/80 rounded-full bg-white/10 active:bg-white/20"
          data-testid="button-flip-camera"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 relative overflow-hidden">
        {error ? (
          <div className="flex flex-col items-center justify-center h-full px-6 gap-4">
            <p className="text-white/60 text-sm text-center leading-relaxed">{error}</p>
            <button
              onClick={handleClose}
              className="px-8 py-3 rounded-lg bg-white/10 text-white text-sm font-medium active:bg-white/20 min-h-[48px]"
              data-testid="button-go-back"
            >
              Go back
            </button>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        )}
        {ready && !error && (
          <div className="absolute inset-8 border-2 border-white/20 rounded-lg pointer-events-none" />
        )}
      </div>

      <div className="flex items-center justify-center p-6 pb-8 safe-bottom">
        <button
          onClick={takePhoto}
          disabled={!ready || !!error}
          aria-label="Take photo"
          className="w-16 h-16 rounded-full border-4 border-white/80 bg-white/20 backdrop-blur-sm flex items-center justify-center disabled:opacity-30 press-effect"
          data-testid="button-take-photo"
        >
          <Camera className="h-6 w-6 text-white" />
        </button>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
