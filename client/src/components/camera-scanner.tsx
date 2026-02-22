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

  const startCamera = useCallback(async (facing: "environment" | "user") => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      setError(null);
      setReady(false);
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
      setError("Could not access camera. Please allow camera permission and try again.");
    }
  }, []);

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const flipCamera = useCallback(() => {
    const next = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    startCamera(next);
  }, [facingMode, startCamera]);

  const takePhoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `script-scan-${Date.now()}.jpg`, { type: "image/jpeg" });
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
        }
        onCapture(file);
      }
    }, "image/jpeg", 0.92);
  }, [onCapture]);

  const handleClose = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    onClose();
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col" data-testid="camera-scanner">
      <div className="flex items-center justify-between p-3 safe-top">
        <Button
          variant="ghost"
          size="icon"
          className="text-white/80"
          onClick={handleClose}
          data-testid="button-close-scanner"
        >
          <X className="h-5 w-5" />
        </Button>
        <span className="text-white/60 text-xs font-medium">Scan script page</span>
        <Button
          variant="ghost"
          size="icon"
          className="text-white/80"
          onClick={flipCamera}
          data-testid="button-flip-camera"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 relative overflow-hidden">
        {error ? (
          <div className="flex items-center justify-center h-full px-6">
            <p className="text-white/60 text-sm text-center">{error}</p>
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
