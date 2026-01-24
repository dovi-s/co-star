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
        {/* Repeat button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onRepeat}
          title="Repeat (R)"
          className="rounded-full"
          data-testid="button-repeat"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>

        {/* Main controls */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            disabled={!canGoBack}
            onClick={onBack}
            title="Previous (←)"
            className="rounded-full"
            data-testid="button-prev-line"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>

          {/* Play button with progress ring */}
          <div className="relative mx-1">
            <svg 
              className="w-16 h-16 -rotate-90"
              viewBox="0 0 64 64"
            >
              {/* Background track */}
              <circle
                cx="32"
                cy="32"
                r="28"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-muted/30"
              />
              {/* Progress arc */}
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
                  isAtEnd ? "text-green-500" : "text-foreground"
                )}
              />
            </svg>
            
            <button
              onClick={onPlayPause}
              title="Play/Pause (Space)"
              data-testid="button-play-pause"
              className={cn(
                "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
                "w-11 h-11 rounded-full flex items-center justify-center",
                "transition-all duration-200 active:scale-95",
                isPlaying 
                  ? "bg-muted/80 text-foreground" 
                  : "bg-foreground text-background"
              )}
            >
              {isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5 ml-0.5" />
              )}
            </button>
          </div>

          <Button
            variant="ghost"
            size="icon"
            disabled={!canGoNext}
            onClick={onNext}
            title="Next (→)"
            className="rounded-full"
            data-testid="button-next-line"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Line counter */}
        <div className="flex flex-col items-center min-w-[40px]">
          <span 
            className={cn(
              "text-sm font-semibold tabular-nums",
              isAtEnd ? "text-green-500" : "text-foreground"
            )}
            data-testid="text-line-counter"
          >
            {currentLine + 1}
          </span>
          <span className="text-[10px] text-muted-foreground/50">
            of {totalLines}
          </span>
        </div>
      </div>
      
      {/* Keyboard hints */}
      <div className="flex items-center justify-center gap-4 mt-3 opacity-40">
        <div className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-muted/50 text-muted-foreground">Space</kbd>
          <span className="text-[9px] text-muted-foreground">play</span>
        </div>
        <div className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-muted/50 text-muted-foreground">←→</kbd>
          <span className="text-[9px] text-muted-foreground">navigate</span>
        </div>
      </div>
    </div>
  );
}
