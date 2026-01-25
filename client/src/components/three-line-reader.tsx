import { useState, useEffect, useMemo } from "react";
import type { ScriptLine, Role, MemorizationMode, Scene } from "@shared/schema";
import { Bookmark, BookmarkCheck, User, Mic, Volume2, Eye, EyeOff, Film, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { matchWords } from "@/lib/word-matcher";

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
  userTranscript?: string;
  isListening?: boolean;
  isSpeaking?: boolean;
  speakingWordIndex?: number;
  currentScene?: Scene;
  isFirstLineOfScene?: boolean;
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
      display: "[ Speak from memory ]",
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
  userTranscript,
  isListening,
  isSpeaking,
  speakingWordIndex = -1,
  currentScene,
  isFirstLineOfScene = false,
}: ThreeLineReaderProps) {
  const [showHint, setShowHint] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const fontSizeClass = fontSize === 0 ? "text-base" : fontSize === 1 ? "text-lg" : "text-xl";

  useEffect(() => {
    setShowHint(false);
    setShowContext(false);
  }, [currentLine?.id, currentScene?.id]);

  const wordMatchResult = useMemo(() => {
    if (!currentLine || !isUserLine || !userTranscript) return null;
    return matchWords(currentLine.text, userTranscript);
  }, [currentLine, isUserLine, userTranscript]);

  const renderLine = (
    line: ScriptLine | null,
    type: "previous" | "current" | "next",
    isUser: boolean
  ) => {
    if (!line) {
      return (
        <div
          className={cn(
            "min-h-[4rem] flex items-center justify-center rounded-lg transition-all duration-300",
            type === "previous" && "opacity-20",
            type === "next" && "opacity-25"
          )}
        >
          <span className="text-muted-foreground/50 text-xs">
            {type === "previous" ? "Start" : type === "next" ? "End" : ""}
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
          "relative py-4 px-4 rounded-lg transition-all duration-300 cursor-pointer",
          type === "previous" && "opacity-30 scale-[0.98]",
          type === "next" && "opacity-35 scale-[0.98]",
          isCurrent && isUser && "bg-foreground text-background",
          isCurrent && !isUser && "bg-card border border-border/60"
        )}
        data-testid={`line-${type}`}
      >
        <div className="flex items-start gap-3">
          {isCurrent && (
            <div
              className={cn(
                "flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center",
                isUser 
                  ? "bg-background/20" 
                  : "bg-muted/60"
              )}
            >
              {isUser ? (
                <Mic className={cn("h-4 w-4", isUser ? "text-background" : "text-foreground")} />
              ) : (
                <Volume2 className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          )}
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className={cn(
                  "font-medium text-xs uppercase tracking-wide",
                  isCurrent && isUser && "text-background/80",
                  isCurrent && !isUser && "text-muted-foreground",
                  !isCurrent && "text-muted-foreground/50"
                )}
              >
                {line.roleName}
              </span>
              {isUser && isCurrent && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-background/20 text-background/90">
                  You
                </span>
              )}
              {showDirections && line.direction && (
                <span className={cn(
                  "text-[10px] italic px-1.5 py-0.5 rounded",
                  isCurrent && isUser ? "bg-background/10 text-background/70" : "bg-muted/50 text-muted-foreground/70"
                )}>
                  {line.direction}
                </span>
              )}
            </div>
            
            <p
              className={cn(
                fontSizeClass,
                "leading-relaxed transition-all duration-300",
                isCurrent && isUser && "text-background",
                isCurrent && !isUser && "text-foreground",
                !isCurrent && "text-muted-foreground",
                shouldMask && !showHint && "italic opacity-70"
              )}
            >
              {shouldMask && !showHint ? maskedContent?.display : (
                isCurrent && isUser && wordMatchResult && isListening ? (
                  // User speaking - highlight matched words (no layout shift)
                  wordMatchResult.words.map((w, i) => (
                    <span
                      key={i}
                      className={cn(
                        "transition-opacity duration-150",
                        w.matched ? "opacity-100" : "opacity-50"
                      )}
                    >
                      {w.word}{i < wordMatchResult.words.length - 1 ? " " : ""}
                    </span>
                  ))
                ) : line.text
              )}
            </p>
            
            {shouldMask && maskedContent?.hint && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { e.stopPropagation(); setShowHint(!showHint); }}
                className={cn(
                  "mt-2 h-7 gap-1.5",
                  isUser && "text-background/80 hover:text-background hover:bg-background/10"
                )}
                data-testid="button-show-hint"
              >
                {showHint ? (
                  <>
                    <EyeOff className="h-3 w-3" />
                    Hide
                  </>
                ) : (
                  <>
                    <Eye className="h-3 w-3" />
                    Show line
                  </>
                )}
              </Button>
            )}
            
            {/* Context peek - show action/stage direction preceding this line */}
            {isCurrent && line.context && !shouldMask && (
              <div className="mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); setShowContext(!showContext); }}
                  className={cn(
                    "gap-1 text-[10px]",
                    isUser && "text-background/60"
                  )}
                  data-testid="button-show-context"
                >
                  <Film className="w-3 h-3" />
                  <span>Action</span>
                  {showContext ? (
                    <ChevronUp className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                </Button>
                {showContext && (
                  <p className={cn(
                    "mt-2 text-xs italic leading-relaxed px-3 py-2 rounded-md",
                    isUser 
                      ? "bg-background/10 text-background/70" 
                      : "bg-muted/40 text-muted-foreground/80"
                  )}>
                    {line.context}
                  </p>
                )}
              </div>
            )}
            
            {/* User's turn indicator with transcript feedback */}
            {isCurrent && isUser && isPlaying && !shouldMask && (
              <div className="mt-3 space-y-2">
                {/* Listening status */}
                <div className="flex items-center gap-2">
                  {isListening ? (
                    <>
                      <div className="flex items-center gap-0.5">
                        <span className="w-1.5 h-3 rounded-full bg-red-400 animate-pulse" />
                        <span className="w-1.5 h-4 rounded-full bg-red-400 animate-pulse" style={{ animationDelay: '0.1s' }} />
                        <span className="w-1.5 h-2.5 rounded-full bg-red-400 animate-pulse" style={{ animationDelay: '0.2s' }} />
                        <span className="w-1.5 h-3.5 rounded-full bg-red-400 animate-pulse" style={{ animationDelay: '0.15s' }} />
                      </div>
                      <span className="text-xs text-background/90 font-medium">
                        Listening...
                      </span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-3 h-3 text-background/60" />
                      <span className="text-xs text-background/70">
                        Your turn to speak
                      </span>
                    </>
                  )}
                </div>
                
                {/* Show progress */}
                {wordMatchResult && userTranscript && (
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1.5 bg-background/20 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-green-400 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, wordMatchResult.percentMatched)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-background/70 font-medium">
                      {Math.round(wordMatchResult.percentMatched)}%
                    </span>
                  </div>
                )}
              </div>
            )}
            
            {/* Memory mode hint */}
            {isCurrent && isUser && isPlaying && shouldMask && (
              <div className="mt-3 text-xs text-background/70">
                Say your line from memory
              </div>
            )}
            
            {/* AI speaking indicator */}
            {isCurrent && !isUser && isPlaying && (
              <div className="mt-2 flex items-center gap-2">
                <div className="speaking-wave">
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
                <span className="text-[10px] text-muted-foreground/70">Speaking...</span>
              </div>
            )}
          </div>
          
          {/* Bookmark */}
          {isCurrent && (
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "flex-shrink-0",
                isUser && "text-background/70 hover:text-background hover:bg-background/10"
              )}
              onClick={(e) => { e.stopPropagation(); onToggleBookmark(line.id); }}
              data-testid="button-bookmark"
            >
              {line.isBookmarked ? (
                <BookmarkCheck className="h-4 w-4" />
              ) : (
                <Bookmark className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3" data-testid="three-line-reader">
      {/* Scene transition card - shows when entering a new scene */}
      {isFirstLineOfScene && currentScene && (
        <div 
          className="px-4 py-3 rounded-lg bg-muted/30 border border-border/40 animate-in fade-in slide-in-from-top-2 duration-300"
          data-testid="scene-transition-card"
        >
          <div className="flex items-center gap-2 mb-1">
            <Film className="w-3.5 h-3.5 text-muted-foreground/70" />
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
              Scene
            </span>
          </div>
          <p className="text-sm font-medium text-foreground/90 leading-snug">
            {currentScene.name}
          </p>
          {currentScene.description && (
            <p className="mt-1.5 text-xs text-muted-foreground/70 leading-relaxed italic">
              {currentScene.description}
            </p>
          )}
        </div>
      )}
      
      <div className="flex gap-3">
        {/* Timeline indicator */}
        <div className="flex flex-col items-center py-6 flex-shrink-0">
          {/* Previous dot */}
          <div className={cn(
            "w-2 h-2 rounded-full transition-all duration-300",
            previousLine ? "bg-muted-foreground/30" : "bg-transparent"
          )} />
          
          {/* Line connecting to current */}
          <div className={cn(
            "w-0.5 flex-1 transition-all duration-300",
            previousLine ? "bg-muted-foreground/20" : "bg-transparent"
          )} />
          
          {/* Current dot - larger and highlighted */}
          <div className={cn(
            "w-3.5 h-3.5 rounded-full flex items-center justify-center transition-all duration-300",
            isUserLine 
              ? "bg-foreground ring-2 ring-foreground/20" 
              : "bg-primary ring-2 ring-primary/20"
          )}>
            {isPlaying && (
              <div className={cn(
                "w-1.5 h-1.5 rounded-full animate-pulse",
                isUserLine ? "bg-background" : "bg-primary-foreground"
              )} />
            )}
          </div>
          
          {/* Line connecting to next */}
          <div className={cn(
            "w-0.5 flex-1 transition-all duration-300",
            nextLine ? "bg-muted-foreground/20" : "bg-transparent"
          )} />
          
          {/* Next dot */}
          <div className={cn(
            "w-2 h-2 rounded-full transition-all duration-300",
            nextLine ? "bg-muted-foreground/30" : "bg-transparent"
          )} />
        </div>
        
        {/* Lines */}
        <div className="flex-1 flex flex-col gap-2 min-w-0">
          {renderLine(previousLine, "previous", false)}
          {renderLine(currentLine, "current", isUserLine)}
          {renderLine(nextLine, "next", false)}
        </div>
      </div>
    </div>
  );
}
