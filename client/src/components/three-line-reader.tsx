import type { ScriptLine, Role } from "@shared/schema";
import { Bookmark, BookmarkCheck, User, Mic, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ThreeLineReaderProps {
  previousLine: ScriptLine | null;
  currentLine: ScriptLine | null;
  nextLine: ScriptLine | null;
  isUserLine: boolean;
  isPlaying: boolean;
  showDirections: boolean;
  fontSize: number;
  onToggleBookmark: (lineId: string) => void;
  getRoleById: (roleId: string) => Role | undefined;
}

export function ThreeLineReader({
  previousLine,
  currentLine,
  nextLine,
  isUserLine,
  isPlaying,
  showDirections,
  fontSize,
  onToggleBookmark,
  getRoleById,
}: ThreeLineReaderProps) {
  const fontSizeClass = fontSize === 0 ? "text-lg" : fontSize === 1 ? "text-xl" : "text-2xl";

  const renderLine = (
    line: ScriptLine | null,
    type: "previous" | "current" | "next",
    isUser: boolean
  ) => {
    if (!line) {
      return (
        <div
          className={cn(
            "min-h-[5rem] flex items-center justify-center rounded-2xl",
            type === "previous" && "opacity-30",
            type === "next" && "opacity-40"
          )}
        >
          <span className="text-muted-foreground italic text-sm">
            {type === "previous" ? "Beginning of scene" : type === "next" ? "End of scene" : ""}
          </span>
        </div>
      );
    }

    const isCurrent = type === "current";
    const role = getRoleById(line.roleId);

    return (
      <div
        className={cn(
          "relative py-5 px-5 rounded-2xl transition-all duration-300",
          type === "previous" && "opacity-40 scale-[0.97]",
          type === "next" && "opacity-50 scale-[0.97]",
          isCurrent && isUser && "bg-gradient-to-br from-primary/10 to-accent/5 border-2 border-primary/30 your-turn-glow shadow-sm",
          isCurrent && !isUser && "bg-card border border-border shadow-sm"
        )}
        data-testid={`line-${type}`}
      >
        <div className="flex items-start gap-4">
          {isCurrent && (
            <div
              className={cn(
                "flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200",
                isUser 
                  ? "bg-primary text-primary-foreground shadow-sm" 
                  : "bg-accent/10 text-accent"
              )}
            >
              {isUser ? <Mic className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </div>
          )}
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span
                className={cn(
                  "font-bold text-sm uppercase tracking-wide",
                  isCurrent && isUser && "text-primary",
                  isCurrent && !isUser && "text-accent",
                  !isCurrent && "text-muted-foreground"
                )}
              >
                {line.roleName}
              </span>
              {isUser && isCurrent && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold uppercase tracking-wider">
                  <User className="h-2.5 w-2.5" />
                  You
                </span>
              )}
              {showDirections && line.direction && (
                <span className="text-xs text-muted-foreground italic bg-muted/50 px-2 py-0.5 rounded-md">
                  {line.direction}
                </span>
              )}
            </div>
            <p
              className={cn(
                fontSizeClass,
                "leading-relaxed",
                isCurrent && "font-medium text-foreground",
                !isCurrent && "text-muted-foreground"
              )}
            >
              {line.text}
            </p>
            
            {isCurrent && isUser && isPlaying && (
              <div className="mt-4 flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-primary/10 border border-primary/20 animate-fade-in">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: '0.2s' }} />
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: '0.4s' }} />
                </div>
                <span className="text-sm font-medium text-primary">
                  Your turn — speak your line, then tap Next
                </span>
              </div>
            )}
            
            {isCurrent && !isUser && isPlaying && (
              <div className="mt-3 flex items-center gap-2 animate-fade-in">
                <div className="speaking-wave">
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
                <span className="text-xs text-muted-foreground">Speaking...</span>
              </div>
            )}
          </div>
          
          {isCurrent && (
            <Button
              variant="ghost"
              size="icon"
              className="flex-shrink-0 -mr-2 -mt-1 rounded-xl"
              onClick={() => onToggleBookmark(line.id)}
              data-testid="button-bookmark"
            >
              {line.isBookmarked ? (
                <BookmarkCheck className="h-5 w-5 text-accent" />
              ) : (
                <Bookmark className="h-5 w-5 text-muted-foreground" />
              )}
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-3" data-testid="three-line-reader">
      {renderLine(previousLine, "previous", false)}
      {renderLine(currentLine, "current", isUserLine)}
      {renderLine(nextLine, "next", false)}
    </div>
  );
}
