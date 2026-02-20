import { useEffect, useRef, RefObject, useMemo } from 'react';
import { cn } from '@/lib/utils';

// Polyfill for roundRect (Safari compatibility)
function drawRoundRect(
  ctx: CanvasRenderingContext2D, 
  x: number, 
  y: number, 
  width: number, 
  height: number, 
  radius: number
) {
  if (ctx.roundRect) {
    ctx.roundRect(x, y, width, height, radius);
  } else {
    // Fallback for browsers without roundRect
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.arcTo(x + width, y, x + width, y + radius, radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
    ctx.lineTo(x + radius, y + height);
    ctx.arcTo(x, y + height, x, y + height - radius, radius);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + radius, y, radius);
    ctx.closePath();
  }
}

export interface OverlayData {
  currentLine?: {
    text: string;
    roleName: string;
    direction?: string;
    isUserLine: boolean;
  };
  previousLine?: {
    text: string;
    roleName: string;
  };
  nextLine?: {
    text: string;
    roleName: string;
  };
}

interface VideoBackgroundProps {
  stream: MediaStream | null;
  videoRef: RefObject<HTMLVideoElement>;
  canvasRef: RefObject<HTMLCanvasElement>;
  isRecording: boolean;
  overlayData?: OverlayData;
  showOverlayOnCanvas?: boolean;
  dimmed?: boolean;
  onTap?: () => void;
  className?: string;
}

export function VideoBackground({ 
  stream, 
  videoRef, 
  canvasRef,
  isRecording,
  overlayData,
  showOverlayOnCanvas = false,
  dimmed = false,
  onTap,
  className 
}: VideoBackgroundProps) {
  const overlayDataRef = useRef<OverlayData | undefined>(overlayData);
  
  useEffect(() => {
    overlayDataRef.current = overlayData;
  }, [overlayData]);
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

      const overlay = overlayDataRef.current;
      if (showOverlayOnCanvas && overlay?.currentLine) {
        const padding = 24;
        const lineHeight = 28;
        const boxWidth = Math.min(canvas.width - padding * 2, 600);
        const boxX = (canvas.width - boxWidth) / 2;
        
        // Calculate box height based on content
        let lines = 1; // current line
        if (overlay.previousLine) lines++;
        if (overlay.nextLine) lines++;
        const boxHeight = lines * (lineHeight + 8) + padding * 2 + 30; // extra for role label
        const boxY = canvas.height - boxHeight - 100; // position above bottom controls

        // Draw semi-transparent backdrop
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.beginPath();
        drawRoundRect(ctx, boxX, boxY, boxWidth, boxHeight, 12);
        ctx.fill();
        
        // Draw subtle border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();

        let textY = boxY + padding;

        // Draw previous line (dimmed)
        if (overlay.previousLine) {
          ctx.font = '500 16px Inter, system-ui, sans-serif';
          ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
          const prevText = `${overlay.previousLine.roleName}: ${overlay.previousLine.text}`;
          ctx.fillText(truncateText(ctx, prevText, boxWidth - padding * 2), boxX + padding, textY + 16);
          textY += lineHeight + 8;
        }

        // Draw current line (highlighted)
        const current = overlay.currentLine;
        
        // Role badge
        ctx.font = 'bold 12px Inter, system-ui, sans-serif';
        const badgeColor = current.isUserLine ? 'rgba(255, 255, 255, 0.9)' : 'rgba(99, 102, 241, 0.9)';
        ctx.fillStyle = badgeColor;
        const roleWidth = ctx.measureText(current.roleName).width + 16;
        ctx.beginPath();
        drawRoundRect(ctx, boxX + padding, textY, roleWidth, 22, 4);
        ctx.fill();
        
        ctx.fillStyle = current.isUserLine ? 'rgba(0, 0, 0, 0.9)' : 'rgba(255, 255, 255, 0.95)';
        ctx.fillText(current.roleName, boxX + padding + 8, textY + 15);
        
        // Direction hint if present
        if (current.direction) {
          ctx.font = 'italic 12px Inter, system-ui, sans-serif';
          ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
          ctx.fillText(`(${current.direction})`, boxX + padding + roleWidth + 8, textY + 15);
        }
        
        textY += 28;
        
        // Line text
        ctx.font = '500 18px Inter, system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.fillText(truncateText(ctx, current.text, boxWidth - padding * 2), boxX + padding, textY + 18);
        textY += lineHeight + 12;

        // Draw next line (ghost)
        if (overlay.nextLine) {
          ctx.font = '500 16px Inter, system-ui, sans-serif';
          ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
          const nextText = `${overlay.nextLine.roleName}: ${overlay.nextLine.text}`;
          ctx.fillText(truncateText(ctx, nextText, boxWidth - padding * 2), boxX + padding, textY + 16);
        }
      }

      animationRef.current = requestAnimationFrame(drawFrame);
    };
    
    // Helper to truncate text that's too long (optimized with binary search)
    function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
      // Early return for short text
      if (ctx.measureText(text).width <= maxWidth) return text;
      
      // Pre-truncate very long strings to avoid excessive iterations
      const maxChars = Math.floor(maxWidth / 6); // rough estimate: ~6px per char
      let truncated = text.length > maxChars * 2 ? text.slice(0, maxChars * 2) : text;
      
      // Binary search for optimal truncation point
      let low = 0;
      let high = truncated.length;
      while (low < high) {
        const mid = Math.floor((low + high + 1) / 2);
        if (ctx.measureText(truncated.slice(0, mid) + '...').width <= maxWidth) {
          low = mid;
        } else {
          high = mid - 1;
        }
      }
      return truncated.slice(0, low) + '...';
    }

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
        className={cn(
          "w-full h-full object-cover transition-all duration-300 ease-out",
          dimmed && "brightness-75"
        )}
        onClick={onTap}
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
