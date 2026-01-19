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

  return (
    <div className="w-full" data-testid="transport-bar">
      <div className="relative h-1 bg-border rounded-full mb-4 overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full bg-primary rounded-full transition-all duration-200 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium tabular-nums min-w-[60px]" data-testid="text-progress">
          {currentLine + 1} / {totalLines}
        </span>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            disabled={!canGoBack}
            onClick={onBack}
            className="transport-btn"
            data-testid="button-back"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>

          <Button
            size="icon"
            onClick={onPlayPause}
            className={cn(
              "h-14 w-14 rounded-full transport-btn",
              isPlaying ? "bg-accent hover:bg-accent/90" : "bg-primary hover:bg-primary/90"
            )}
            data-testid="button-play-pause"
          >
            {isPlaying ? (
              <Pause className="h-7 w-7" />
            ) : (
              <Play className="h-7 w-7 ml-0.5" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            disabled={!canGoNext}
            onClick={onNext}
            className="transport-btn"
            data-testid="button-next"
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={onRepeat}
          className="transport-btn"
          data-testid="button-repeat"
        >
          <RotateCcw className="h-5 w-5 text-muted-foreground" />
        </Button>
      </div>
    </div>
  );
}
