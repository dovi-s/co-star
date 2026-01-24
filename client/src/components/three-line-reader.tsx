import { useState, useEffect } from "react";
import type { ScriptLine, Role, MemorizationMode } from "@shared/schema";
import { Bookmark, BookmarkCheck, User, Mic, Volume2, Eye, EyeOff, Lightbulb } from "lucide-react";
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
  memorizationMode: MemorizationMode;
  onToggleBookmark: (lineId: string) => void;
  getRoleById: (roleId: string) => Role | undefined;
  onLineClick?: (line: ScriptLine) => void;
}

function maskText(text: string, mode: MemorizationMode): { display: string; hint?: string } {
  if (mode === "off") return { display: text };
  
  const words = text.split(" ");
  
  if (mode === "cue") {
    const firstWords = words.slice(0, Math.min(2, words.length)).join(" ");
    return { 
      display: firstWords + "...",
      hint: text
    };
  }
  
  if (mode === "partial") {
    const visible = Math.ceil(words.length / 2);
    const shown = words.slice(0, visible).join(" ");
    const hidden = words.slice(visible).map(w => "____").join(" ");
    return { 
      display: shown + " " + hidden,
      hint: text
    };
  }
  
  if (mode === "full") {
    return { 
      display: "[ Your line — speak from memory ]",
      hint: text
    };
  }
  
  return { display: text };
}

export function ThreeLineReader({
  previousLine,
  currentLine,
  nextLine,
  isUserLine,
  isPlaying,
  showDirections,
  fontSize,
  memorizationMode,
  onToggleBookmark,
  getRoleById,
  onLineClick,
}: ThreeLineReaderProps) {
  const [showHint, setShowHint] = useState(false);
  const fontSizeClass = fontSize === 0 ? "text-lg" : fontSize === 1 ? "text-xl" : "text-2xl";

  useEffect(() => {
    setShowHint(false);
  }, [currentLine?.id]);

  const renderLine = (
    line: ScriptLine | null,
    type: "previous" | "current" | "next",
    isUser: boolean
  ) => {
    if (!line) {
      return (
        <div
          className={cn(
            "min-h-[5rem] flex items-center justify-center rounded-2xl transition-all duration-500",
            type === "previous" && "opacity-20",
            type === "next" && "opacity-30"
          )}
        >
          <span className="text-muted-foreground/60 italic text-sm">
            {type === "previous" ? "Top of scene" : type === "next" ? "Scene complete" : ""}
          </span>
        </div>
      );
    }

    const isCurrent = type === "current";
    const role = getRoleById(line.roleId);
    const shouldMask = isCurrent && isUser && memorizationMode !== "off";
    const maskedContent = shouldMask ? maskText(line.text, memorizationMode) : null;

    return (
      <div
        onClick={() => onLineClick?.(line)}
        className={cn(
          "relative py-5 px-5 rounded-2xl transition-all duration-500 cursor-pointer",
          type === "previous" && "opacity-35 scale-[0.96] hover:opacity-50",
          type === "next" && "opacity-45 scale-[0.96] hover:opacity-60",
          isCurrent && isUser && "bg-gradient-to-br from-primary/12 via-primary/8 to-accent/5 border-2 border-primary/40 shadow-lg shadow-primary/10",
          isCurrent && !isUser && "bg-card border border-border shadow-sm"
        )}
        data-testid={`line-${type}`}
      >
        <div className="flex items-start gap-4">
          {isCurrent && (
            <div
              className={cn(
                "flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300",
                isUser 
                  ? "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-md" 
                  : "bg-accent/15 text-accent"
              )}
            >
              {isUser ? <Mic className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </div>
          )}
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span
                className={cn(
                  "font-bold text-sm uppercase tracking-wider",
                  isCurrent && isUser && "text-primary",
                  isCurrent && !isUser && "text-accent",
                  !isCurrent && "text-muted-foreground/70"
                )}
              >
                {line.roleName}
              </span>
              {isUser && isCurrent && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider shadow-sm">
                  <User className="h-2.5 w-2.5" />
                  You
                </span>
              )}
              {showDirections && line.direction && (
                <span className="text-xs text-muted-foreground/80 italic bg-muted/40 px-2 py-0.5 rounded-md">
                  {line.direction}
                </span>
              )}
            </div>
            
            <p
              className={cn(
                fontSizeClass,
                "leading-relaxed transition-all duration-300",
                isCurrent && "font-medium text-foreground",
                !isCurrent && "text-muted-foreground",
                shouldMask && !showHint && "italic text-muted-foreground"
              )}
            >
              {shouldMask && !showHint ? maskedContent?.display : line.text}
            </p>
            
            {shouldMask && maskedContent?.hint && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { e.stopPropagation(); setShowHint(!showHint); }}
                className="mt-3 gap-1.5 text-xs h-8 text-muted-foreground"
              >
                {showHint ? (
                  <>
                    <EyeOff className="h-3.5 w-3.5" />
                    Hide line
                  </>
                ) : (
                  <>
                    <Lightbulb className="h-3.5 w-3.5" />
                    Need a hint?
                  </>
                )}
              </Button>
            )}
            
            {isCurrent && isUser && isPlaying && !shouldMask && (
              <div className="mt-4 flex items-center justify-center gap-3 py-3.5 px-4 rounded-xl bg-gradient-to-r from-primary/15 to-primary/10 border border-primary/25 animate-fade-in">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: '0.15s' }} />
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: '0.3s' }} />
                </div>
                <span className="text-sm font-medium text-primary">
                  Your cue — deliver your line
                </span>
              </div>
            )}
            
            {isCurrent && isUser && isPlaying && shouldMask && (
              <div className="mt-4 flex items-center justify-center gap-3 py-3.5 px-4 rounded-xl bg-gradient-to-r from-accent/15 to-accent/10 border border-accent/25 animate-fade-in">
                <span className="text-sm font-medium text-accent">
                  Recall your line, then tap Next when ready
                </span>
              </div>
            )}
            
            {isCurrent && !isUser && isPlaying && (
              <div className="mt-3 flex items-center gap-2.5 animate-fade-in">
                <div className="speaking-wave">
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
                <span className="text-xs text-muted-foreground font-medium">Speaking...</span>
              </div>
            )}
          </div>
          
          {isCurrent && (
            <Button
              variant="ghost"
              size="icon"
              className="flex-shrink-0 -mr-2 -mt-1 rounded-xl"
              onClick={(e) => { e.stopPropagation(); onToggleBookmark(line.id); }}
              data-testid="button-bookmark"
            >
              {line.isBookmarked ? (
                <BookmarkCheck className="h-5 w-5 text-accent" />
              ) : (
                <Bookmark className="h-5 w-5 text-muted-foreground/50" />
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
