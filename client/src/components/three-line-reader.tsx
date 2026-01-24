import { useState, useEffect, useMemo } from "react";
import type { ScriptLine, Role, MemorizationMode } from "@shared/schema";
import { Bookmark, BookmarkCheck, User, Mic, Volume2, Eye, EyeOff } from "lucide-react";
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
}: ThreeLineReaderProps) {
  const [showHint, setShowHint] = useState(false);
  const fontSizeClass = fontSize === 0 ? "text-base" : fontSize === 1 ? "text-lg" : "text-xl";

  useEffect(() => {
    setShowHint(false);
  }, [currentLine?.id]);

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
                  // User speaking - highlight matched words
                  wordMatchResult.words.map((w, i) => (
                    <span
                      key={i}
                      className={cn(
                        "transition-all duration-200",
                        w.matched && "bg-background/30 text-background font-medium rounded px-0.5"
                      )}
                    >
                      {w.word}{i < wordMatchResult.words.length - 1 ? " " : ""}
                    </span>
                  ))
                ) : isCurrent && !isUser && isSpeaking && speakingWordIndex >= 0 ? (
                  // AI speaking - highlight current word
                  line.text.split(/(\s+)/).map((segment, i) => {
                    const isSpace = /^\s+$/.test(segment);
                    if (isSpace) return <span key={i}>{segment}</span>;
                    
                    // Count actual words up to this point
                    const wordsBefore = line.text.split(/(\s+)/).slice(0, i).filter(s => !/^\s+$/.test(s)).length;
                    const isCurrentWord = wordsBefore === speakingWordIndex;
                    const isPastWord = wordsBefore < speakingWordIndex;
                    
                    return (
                      <span
                        key={i}
                        className={cn(
                          "transition-all duration-150",
                          isCurrentWord && "text-foreground font-medium",
                          isPastWord && "text-muted-foreground/60",
                          !isCurrentWord && !isPastWord && "text-muted-foreground/40"
                        )}
                      >
                        {segment}
                      </span>
                    );
                  })
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
                Speak, then tap Next
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
    <div className="flex gap-3" data-testid="three-line-reader">
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
  );
}
