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
  const isAtEnd = currentLine + 1 === totalLines;

  return (
    <div className="w-full" data-testid="transport-bar">
      <div className="flex items-center justify-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onRepeat}
          title="Repeat (R)"
          data-testid="button-repeat"
        >
          <RotateCcw className="h-5 w-5 text-muted-foreground" />
        </Button>

        <div className="flex items-center gap-0">
          <Button
            variant="ghost"
            size="icon"
            disabled={!canGoBack}
            onClick={onBack}
            title="Previous (←)"
            data-testid="button-prev-line"
          >
            <ChevronLeft className="h-7 w-7" />
          </Button>

          <div className="relative mx-1">
            <svg 
              className="w-[76px] h-[76px] -rotate-90"
              viewBox="0 0 64 64"
            >
              <circle
                cx="32"
                cy="32"
                r="28"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                className="text-border/50"
              />
              <circle
                cx="32"
                cy="32"
                r="28"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className={cn(
                  "transition-all duration-500 ease-out",
                  isAtEnd ? "text-green-500" : "text-primary"
                )}
              />
            </svg>
            
            <Button
              size="lg"
              onClick={onPlayPause}
              className={cn(
                "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
                "rounded-full shadow-lg",
                isPlaying && "bg-muted text-foreground"
              )}
              title="Play/Pause (Space)"
              data-testid="button-play-pause"
            >
              {isPlaying ? (
                <Pause className="h-6 w-6" />
              ) : (
                <Play className="h-6 w-6 ml-0.5" />
              )}
            </Button>
          </div>

          <Button
            variant="ghost"
            size="icon"
            disabled={!canGoNext}
            onClick={onNext}
            title="Next (→)"
            data-testid="button-next-line"
          >
            <ChevronRight className="h-7 w-7" />
          </Button>
        </div>

        <div className="flex flex-col items-center min-w-[48px]">
          <span 
            className={cn(
              "text-sm font-bold tabular-nums transition-colors",
              isAtEnd ? "text-green-500" : "text-foreground"
            )}
            data-testid="text-line-counter"
          >
            {currentLine + 1}
          </span>
          <span className="text-[10px] text-muted-foreground font-medium">
            of {totalLines}
          </span>
        </div>
      </div>
      
      <div className="flex items-center justify-center gap-4 mt-2 text-[10px] text-muted-foreground/60">
        <span>Space: play/pause</span>
        <span>Arrows: navigate</span>
      </div>
    </div>
  );
}
