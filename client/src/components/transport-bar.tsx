import { ChevronLeft, Play, Pause, ChevronRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TransportBarProps {
  isPlaying: boolean;
  canGoBack: boolean;
  canGoNext: boolean;
  currentLine: number;
  totalLines: number;
  onBack: () => void;
  onPlayPause: () => void;
  onNext: () => void;
  onRepeat: () => void;
  cameraMode?: boolean;
}

export function TransportBar({
  isPlaying,
  canGoBack,
  canGoNext,
  currentLine,
  totalLines,
  onBack,
  onPlayPause,
  onNext,
  onRepeat,
  cameraMode = false,
}: TransportBarProps) {
  const progress = totalLines > 0 ? ((currentLine + 1) / totalLines) * 100 : 0;
  const circumference = 2 * Math.PI * 28;
  const strokeDashoffset = circumference - (progress / 100) * circumference;
  const isComplete = currentLine + 1 === totalLines;

  return (
    <div className="w-full" data-testid="transport-bar">
      <div className="flex items-center justify-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onRepeat}
          title="Start Over (R)"
          className={cn(
            "rounded-full icon-btn-press",
            cameraMode && "text-white/80 hover:text-white hover:bg-white/10"
          )}
          data-testid="button-start-over"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!canGoBack}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (canGoBack) onBack();
            }}
            onTouchEnd={(e) => {
              if (canGoBack) {
                e.preventDefault();
                onBack();
              }
            }}
            title="Previous"
            className={cn(
              "p-3 rounded-full touch-manipulation select-none icon-btn-press",
              cameraMode 
                ? "hover:bg-white/10 active:bg-white/20" 
                : "hover:bg-muted active:bg-muted/80",
              canGoBack 
                ? (cameraMode ? "text-white" : "text-foreground") 
                : (cameraMode ? "text-white/30 pointer-events-none" : "text-muted-foreground/40 pointer-events-none")
            )}
            style={{ minWidth: 48, minHeight: 48, touchAction: 'manipulation' }}
            data-testid="button-prev-line"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div className="relative mx-1">
            <svg 
              className="w-[68px] h-[68px] -rotate-90"
              viewBox="0 0 64 64"
            >
              <circle
                cx="32"
                cy="32"
                r="28"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={cameraMode ? "text-white/20" : "text-border"}
              />
              <circle
                cx="32"
                cy="32"
                r="28"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className={cn(
                  "transition-all duration-500 ease-out",
                  isComplete ? "text-success" : "text-primary"
                )}
              />
            </svg>
            
            <Button
              onClick={onPlayPause}
              title="Play/Pause (Space)"
              size="icon"
              variant={isPlaying ? "secondary" : "default"}
              data-testid="button-play-pause"
              className={cn(
                "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full w-11 h-11",
                "transition-transform duration-100 active:scale-90"
              )}
            >
              <div className={cn(
                "transition-all duration-200",
                isPlaying ? "scale-100" : "scale-100"
              )}>
                {isPlaying ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5 ml-0.5" />
                )}
              </div>
            </Button>
          </div>

          <button
            type="button"
            disabled={!canGoNext}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (canGoNext) onNext();
            }}
            onTouchEnd={(e) => {
              if (canGoNext) {
                e.preventDefault();
                onNext();
              }
            }}
            title="Next"
            className={cn(
              "p-3 rounded-full touch-manipulation select-none icon-btn-press",
              cameraMode 
                ? "hover:bg-white/10 active:bg-white/20" 
                : "hover:bg-muted active:bg-muted/80",
              canGoNext 
                ? (cameraMode ? "text-white" : "text-foreground") 
                : (cameraMode ? "text-white/30 pointer-events-none" : "text-muted-foreground/40 pointer-events-none")
            )}
            style={{ minWidth: 48, minHeight: 48, touchAction: 'manipulation' }}
            data-testid="button-next-line"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col items-center min-w-[44px]">
          <span 
            className={cn(
              "text-sm font-medium tabular-nums transition-colors",
              isComplete ? "text-green-500" : (cameraMode ? "text-white" : "text-foreground")
            )}
            data-testid="text-line-counter"
          >
            {currentLine + 1}
          </span>
          <span className={cn(
            "text-[10px]",
            cameraMode ? "text-white/60" : "text-muted-foreground"
          )}>
            of {totalLines}
          </span>
        </div>
      </div>
      
      <div className="flex items-center justify-center gap-4 mt-3">
        <kbd className={cn(
          "px-2 py-0.5 rounded text-[9px] font-medium",
          cameraMode ? "bg-white/10 text-white/60" : "bg-muted text-muted-foreground/70"
        )}>
          Space
        </kbd>
        <kbd className={cn(
          "px-2 py-0.5 rounded text-[9px] font-medium",
          cameraMode ? "bg-white/10 text-white/60" : "bg-muted text-muted-foreground/70"
        )}>
          Arrows
        </kbd>
      </div>
    </div>
  );
}
