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
  const circumference = 2 * Math.PI * 32;
  const strokeDashoffset = circumference - (progress / 100) * circumference;
  const isAtEnd = currentLine + 1 === totalLines;

  return (
    <div className="w-full" data-testid="transport-bar">
      <div className="flex items-center justify-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onRepeat}
          title="Repeat (R)"
          className="h-11 w-11 rounded-full text-muted-foreground/70 hover:text-foreground hover:bg-muted/60"
          data-testid="button-repeat"
        >
          <RotateCcw className="h-4.5 w-4.5" />
        </Button>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            disabled={!canGoBack}
            onClick={onBack}
            title="Previous (←)"
            className="h-12 w-12 rounded-full hover:bg-muted/60 disabled:opacity-30"
            data-testid="button-prev-line"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>

          <div className="relative mx-2">
            <div className={cn(
              "absolute inset-0 rounded-full blur-xl transition-all duration-500",
              isPlaying ? "bg-amber-500/20" : "bg-transparent"
            )} />
            <svg 
              className="w-20 h-20 -rotate-90 relative"
              viewBox="0 0 72 72"
            >
              <circle
                cx="36"
                cy="36"
                r="32"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className="text-muted/40"
              />
              <circle
                cx="36"
                cy="36"
                r="32"
                fill="none"
                stroke="url(#progressGradient)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-500 ease-out"
              />
              <defs>
                <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={isAtEnd ? "#22c55e" : "#f59e0b"} />
                  <stop offset="100%" stopColor={isAtEnd ? "#16a34a" : "#ea580c"} />
                </linearGradient>
              </defs>
            </svg>
            
            <button
              onClick={onPlayPause}
              title="Play/Pause (Space)"
              data-testid="button-play-pause"
              className={cn(
                "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
                "w-14 h-14 rounded-full flex items-center justify-center",
                "transition-all duration-200 active:scale-95",
                isPlaying 
                  ? "bg-muted/90 text-foreground shadow-inner" 
                  : "bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/25"
              )}
            >
              {isPlaying ? (
                <Pause className="h-6 w-6" />
              ) : (
                <Play className="h-6 w-6 ml-0.5" />
              )}
            </button>
          </div>

          <Button
            variant="ghost"
            size="icon"
            disabled={!canGoNext}
            onClick={onNext}
            title="Next (→)"
            className="h-12 w-12 rounded-full hover:bg-muted/60 disabled:opacity-30"
            data-testid="button-next-line"
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        </div>

        <div className="flex flex-col items-center min-w-[44px]">
          <span 
            className={cn(
              "text-base font-bold tabular-nums transition-colors",
              isAtEnd ? "text-green-500" : "text-amber-600 dark:text-amber-400"
            )}
            data-testid="text-line-counter"
          >
            {currentLine + 1}
          </span>
          <span className="text-[10px] text-muted-foreground/70 font-medium">
            of {totalLines}
          </span>
        </div>
      </div>
      
      <div className="flex items-center justify-center gap-3 mt-3 opacity-50">
        <kbd className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-muted/60 text-muted-foreground border border-border/50">Space</kbd>
        <span className="text-[9px] text-muted-foreground">play</span>
        <span className="text-muted-foreground/30">•</span>
        <kbd className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-muted/60 text-muted-foreground border border-border/50">←→</kbd>
        <span className="text-[9px] text-muted-foreground">navigate</span>
      </div>
    </div>
  );
}
