import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

interface CountdownOverlayProps {
  onComplete: () => void;
  onCancel: () => void;
  cameraMode?: boolean;
}

export function CountdownOverlay({ onComplete, onCancel, cameraMode }: CountdownOverlayProps) {
  const [count, setCount] = useState(3);

  useEffect(() => {
    if (count <= 0) {
      onComplete();
      return;
    }
    const timer = setTimeout(() => setCount(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [count, onComplete]);

  const handleClick = useCallback(() => {
    onCancel();
  }, [onCancel]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center",
        cameraMode ? "bg-black/80" : "bg-background/80 backdrop-blur-sm"
      )}
      onClick={handleClick}
      data-testid="countdown-overlay"
    >
      <div className="flex flex-col items-center gap-6">
        <div
          className={cn(
            "w-28 h-28 rounded-full flex items-center justify-center",
            "transition-all duration-300 animate-in zoom-in-50",
            cameraMode
              ? "bg-white/10 border-2 border-white/30 text-white"
              : "bg-primary/10 border-2 border-primary/30 text-primary"
          )}
          key={count}
        >
          <span className="text-5xl font-bold tabular-nums animate-in zoom-in-75 duration-300">
            {count}
          </span>
        </div>
        <p className={cn(
          "text-sm",
          cameraMode ? "text-white/50" : "text-muted-foreground"
        )}>
          Tap anywhere to cancel
        </p>
      </div>
    </div>
  );
}
