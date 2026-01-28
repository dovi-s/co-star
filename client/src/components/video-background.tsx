import { useEffect, useRef, RefObject } from 'react';
import { cn } from '@/lib/utils';

interface VideoBackgroundProps {
  stream: MediaStream | null;
  videoRef: RefObject<HTMLVideoElement>;
  canvasRef: RefObject<HTMLCanvasElement>;
  isRecording: boolean;
  className?: string;
}

export function VideoBackground({ 
  stream, 
  videoRef, 
  canvasRef,
  isRecording,
  className 
}: VideoBackgroundProps) {
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (!stream || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    video.srcObject = stream;
    video.play().catch(console.error);

    const drawFrame = () => {
      if (!video.videoWidth || !video.videoHeight) {
        animationRef.current = requestAnimationFrame(drawFrame);
        return;
      }

      const containerWidth = window.innerWidth;
      const containerHeight = window.innerHeight;
      
      canvas.width = containerWidth;
      canvas.height = containerHeight;

      const videoAspect = video.videoWidth / video.videoHeight;
      const containerAspect = containerWidth / containerHeight;

      let drawWidth, drawHeight, drawX, drawY;

      if (containerAspect > videoAspect) {
        drawWidth = containerWidth;
        drawHeight = containerWidth / videoAspect;
        drawX = 0;
        drawY = (containerHeight - drawHeight) / 2;
      } else {
        drawHeight = containerHeight;
        drawWidth = containerHeight * videoAspect;
        drawX = (containerWidth - drawWidth) / 2;
        drawY = 0;
      }

      ctx.save();
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, canvas.width - drawX - drawWidth, drawY, drawWidth, drawHeight);
      ctx.restore();

      const gradient = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) * 0.3,
        canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) * 0.7
      );
      gradient.addColorStop(0, 'rgba(0,0,0,0)');
      gradient.addColorStop(1, 'rgba(0,0,0,0.4)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      animationRef.current = requestAnimationFrame(drawFrame);
    };

    video.onloadedmetadata = () => {
      animationRef.current = requestAnimationFrame(drawFrame);
    };

    if (video.readyState >= 2) {
      animationRef.current = requestAnimationFrame(drawFrame);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [stream, videoRef, canvasRef]);

  if (!stream) return null;

  return (
    <div className={cn(
      "fixed inset-0 z-0 bg-black transition-opacity duration-500",
      className
    )}>
      <video
        ref={videoRef}
        className="hidden"
        playsInline
        muted
        autoPlay
      />
      <canvas
        ref={canvasRef}
        className="w-full h-full object-cover"
      />
      
      {isRecording && (
        <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-black/60 backdrop-blur-sm rounded-full z-50">
          <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
          <span className="text-white text-xs font-medium">REC</span>
        </div>
      )}
    </div>
  );
}
