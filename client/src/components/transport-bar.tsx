import { ChevronLeft, Play, Pause, ChevronRight, RotateCcw, SkipForward } from "lucide-react";
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
  const circumference = 2 * Math.PI * 26;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="w-full" data-testid="transport-bar">
      <div className="flex items-center justify-between gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onRepeat}
          className="transport-btn rounded-xl h-11 w-11"
          data-testid="button-repeat"
        >
          <RotateCcw className="h-5 w-5 text-muted-foreground" />
        </Button>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            disabled={!canGoBack}
            onClick={onBack}
            className="transport-btn rounded-xl h-12 w-12"
            data-testid="button-back"
          >
            <ChevronLeft className="h-7 w-7" />
          </Button>

          <div className="relative">
            <svg 
              className="w-[72px] h-[72px] -rotate-90"
              viewBox="0 0 60 60"
            >
              <circle
                cx="30"
                cy="30"
                r="26"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                className="text-border"
              />
              <circle
                cx="30"
                cy="30"
                r="26"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className="text-primary transition-all duration-300 ease-out"
              />
            </svg>
            
            <Button
              size="icon"
              onClick={onPlayPause}
              className={cn(
                "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
                "h-14 w-14 rounded-full transport-btn shadow-lg transition-all duration-200",
                isPlaying 
                  ? "bg-accent hover:bg-accent/90" 
                  : "bg-primary hover:bg-primary/90"
              )}
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
            className="transport-btn rounded-xl h-12 w-12"
            data-testid="button-next"
          >
            <ChevronRight className="h-7 w-7" />
          </Button>
        </div>

        <div className="flex flex-col items-center min-w-[50px]">
          <span 
            className="text-sm font-semibold tabular-nums text-foreground" 
            data-testid="text-progress"
          >
            {currentLine + 1}
          </span>
          <span className="text-xs text-muted-foreground">
            of {totalLines}
          </span>
        </div>
      </div>
    </div>
  );
}
