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
          className="rounded-full transition-transform active:scale-90"
          data-testid="button-start-over"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={!canGoBack}
            onClick={() => {
              console.log("[Transport] Back clicked");
              onBack();
            }}
            title="Previous"
            className={cn(
              "p-3 rounded-full transition-all active:scale-90 touch-manipulation",
              "hover:bg-accent/80 active:bg-accent",
              !canGoBack && "opacity-40 pointer-events-none"
            )}
            style={{ minWidth: 44, minHeight: 44 }}
            data-testid="button-prev-line"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div className="relative mx-2">
            <svg 
              className="w-16 h-16 -rotate-90"
              viewBox="0 0 64 64"
            >
              <circle
                cx="32"
                cy="32"
                r="28"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-muted/30"
              />
              <circle
                cx="32"
                cy="32"
                r="28"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className={cn(
                  "transition-all duration-300 ease-out",
                  isComplete ? "text-green-500" : "text-primary"
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
                "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full",
                "transition-all duration-150 active:scale-90",
                isPlaying && "animate-pulse-subtle"
              )}
            >
              {isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5 ml-0.5" />
              )}
            </Button>
          </div>

          <button
            type="button"
            disabled={!canGoNext}
            onClick={() => {
              console.log("[Transport] Next clicked");
              onNext();
            }}
            title="Next"
            className={cn(
              "p-3 rounded-full transition-all active:scale-90 touch-manipulation",
              "hover:bg-accent/80 active:bg-accent",
              !canGoNext && "opacity-40 pointer-events-none"
            )}
            style={{ minWidth: 44, minHeight: 44 }}
            data-testid="button-next-line"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col items-center min-w-[44px]">
          <span 
            className={cn(
              "text-sm font-medium tabular-nums transition-colors",
              isComplete ? "text-green-500" : "text-foreground"
            )}
            data-testid="text-line-counter"
          >
            {currentLine + 1}
          </span>
          <span className="text-[10px] text-muted-foreground">
            of {totalLines}
          </span>
        </div>
      </div>
      
      <div className="flex items-center justify-center gap-4 mt-3">
        <kbd className="px-2 py-0.5 rounded text-[9px] font-medium bg-muted text-muted-foreground/70">
          Space
        </kbd>
        <kbd className="px-2 py-0.5 rounded text-[9px] font-medium bg-muted text-muted-foreground/70">
          Arrows
        </kbd>
      </div>
    </div>
  );
}
