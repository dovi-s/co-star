import { useState, useEffect, useMemo } from "react";
import type { ScriptLine, Role, MemorizationMode, Scene } from "@shared/schema";
import { Bookmark, BookmarkCheck, User, Mic, Volume2, Eye, EyeOff, Film, ChevronDown, ChevronUp, Play, Hand } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { matchWordsSequential } from "@/lib/word-matcher";

// Parse and render text with emphasis formatting
// Supports _underlined_, *bold*, ALL CAPS, and {stage directions} / (parentheticals)
function renderFormattedText(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  
  // Regex to match various formatting patterns:
  // - {stage directions} or (parentheticals) - italic, muted
  // - _underlined_ or *bold* text
  // - ALL CAPS words (4+ letters) as emphasis
  const formattingRegex = /(\{[^}]+\}|\([^)]+\)|_([^_]+)_|\*([^*]+)\*|\b([A-Z]{4,})\b)/g;
  
  let lastIndex = 0;
  let match;
  let key = 0;
  
  while ((match = formattingRegex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    
    const fullMatch = match[0];
    
    if (fullMatch.startsWith("{") || fullMatch.startsWith("(")) {
      // Stage direction in {braces} or (parentheses) - render as italic, smaller, muted
      parts.push(
        <span key={key++} className="italic text-[0.9em] opacity-70">
          {fullMatch}
        </span>
      );
    } else if (match[2]) {
      // _underlined_ text - render as italic
      parts.push(
        <em key={key++} className="italic">
          {match[2]}
        </em>
      );
    } else if (match[3]) {
      // *bold* text - render as semibold
      parts.push(
        <strong key={key++} className="font-semibold">
          {match[3]}
        </strong>
      );
    } else if (match[4]) {
      // ALL CAPS - render with slight emphasis
      parts.push(
        <span key={key++} className="font-medium tracking-wide">
          {match[4]}
        </span>
      );
    }
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  
  return parts.length > 0 ? parts : [text];
}

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
  onPlayFromHere?: (line: ScriptLine) => void;
  userTranscript?: string;
  isListening?: boolean;
  isSpeaking?: boolean;
  speakingWordIndex?: number;
  currentScene?: Scene;
  isFirstLineOfScene?: boolean;
  onRestartListening?: () => void;
  cameraMode?: boolean;
  tapMode?: boolean;
  onTapAdvance?: () => void;
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
  onPlayFromHere,
  userTranscript,
  isListening,
  isSpeaking,
  speakingWordIndex = -1,
  currentScene,
  isFirstLineOfScene = false,
  onRestartListening,
  cameraMode = false,
  tapMode = false,
  onTapAdvance,
}: ThreeLineReaderProps) {
  const [showHint, setShowHint] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const fontSizeClass = fontSize === 0 ? "text-base md:text-lg" : fontSize === 1 ? "text-lg md:text-xl" : "text-xl md:text-2xl";

  useEffect(() => {
    setShowHint(false);
    setShowContext(false);
    setDescriptionExpanded(false);
  }, [currentLine?.id, currentScene?.id]);

  const wordMatchResult = useMemo(() => {
    if (!currentLine || !isUserLine || !userTranscript) return null;
    return matchWordsSequential(currentLine.text, userTranscript);
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
          "relative py-4 px-4 rounded-xl transition-all duration-300 cursor-pointer group",
          type === "previous" && "opacity-30 scale-[0.98]",
          type === "next" && "opacity-35 scale-[0.98]",
          isCurrent && isUser && !cameraMode && "bg-foreground text-background",
          isCurrent && isUser && cameraMode && "bg-black/70 backdrop-blur-xl text-white border border-white/20",
          isCurrent && !isUser && !cameraMode && "bg-card border border-border/60",
          isCurrent && !isUser && cameraMode && "bg-black/60 backdrop-blur-xl text-white border border-white/15"
        )}
        data-testid={`line-${type}`}
      >
        {isCurrent && !isUser && isSpeaking && !cameraMode && (
          <div className="absolute inset-0 rounded-xl energy-directional energy-directional-speaking pointer-events-none" aria-hidden="true" />
        )}
        {isCurrent && isUser && isListening && !cameraMode && (
          <div className="absolute inset-0 rounded-xl energy-directional energy-directional-listening pointer-events-none" aria-hidden="true" />
        )}
        <div className="flex items-start gap-3 relative">
          {isCurrent && (
            <div
              className={cn(
                "flex-shrink-0 w-8 h-8 circle-badge transition-all duration-300",
                isUser && !cameraMode && "bg-background/20",
                isUser && cameraMode && "bg-white/20",
                !isUser && !cameraMode && "bg-muted/60",
                !isUser && cameraMode && "bg-white/10",
                isSpeaking && !isUser && "energy-ring speaking",
                isListening && isUser && "gradient-ripple"
              )}
            >
              {isUser ? (
                <Mic className={cn("h-4 w-4", cameraMode ? "text-white" : isUser ? "text-background" : "text-foreground")} />
              ) : (
                <Volume2 className={cn("h-4 w-4", cameraMode ? "text-white/70" : "text-muted-foreground")} />
              )}
              {isListening && isUser && (
                <span className="absolute inset-[-5px] rounded-full border border-[hsl(var(--success)/0.25)] pointer-events-none" style={{ animation: 'arc-ripple-3 2.2s ease-out infinite 1.2s' }} />
              )}
            </div>
          )}
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className={cn(
                  "font-medium text-xs uppercase tracking-wide",
                  isCurrent && isUser && !cameraMode && "text-background/80",
                  isCurrent && isUser && cameraMode && "text-white/80",
                  isCurrent && !isUser && !cameraMode && "text-muted-foreground",
                  isCurrent && !isUser && cameraMode && "text-white/70",
                  !isCurrent && "text-muted-foreground/50"
                )}
              >
                {line.roleName}
              </span>
              {isUser && isCurrent && (
                <span className={cn(
                  "px-1.5 py-0.5 rounded text-[9px] font-medium",
                  cameraMode ? "bg-white/20 text-white/90" : "bg-background/20 text-background/90"
                )}>
                  You
                </span>
              )}
              {showDirections && line.direction && (
                <span className={cn(
                  "text-[11px] italic",
                  isCurrent && isUser && !cameraMode && "text-background/60",
                  isCurrent && isUser && cameraMode && "text-white/60",
                  isCurrent && !isUser && !cameraMode && "text-muted-foreground/60",
                  isCurrent && !isUser && cameraMode && "text-white/50",
                  !isCurrent && !cameraMode && "text-muted-foreground/40",
                  !isCurrent && cameraMode && "text-white/30"
                )}>
                  {line.direction}
                </span>
              )}
            </div>
            
            <p
              className={cn(
                fontSizeClass,
                "leading-[1.8] transition-all duration-300",
                isCurrent && isUser && !cameraMode && "text-background",
                isCurrent && isUser && cameraMode && "text-white",
                isCurrent && !isUser && !cameraMode && "text-foreground",
                isCurrent && !isUser && cameraMode && "text-white",
                !isCurrent && !cameraMode && "text-muted-foreground",
                !isCurrent && cameraMode && "text-white/50",
                shouldMask && !showHint && "italic opacity-70",
                isCurrent && "max-h-[45vh] overflow-y-auto pr-1",
                !isCurrent && "line-clamp-2"
              )}
            >
              {shouldMask && !showHint ? maskedContent?.display : (
                isCurrent && isUser && wordMatchResult && isListening ? (
                  wordMatchResult.words.map((w, i) => (
                    <span
                      key={i}
                      className={cn(
                        "transition-opacity duration-200",
                        w.status === 'matched' && "opacity-100",
                        w.status === 'skipped' && "opacity-70",
                        w.status === 'ahead' && "opacity-40"
                      )}
                      style={w.status === 'skipped' ? {
                        textDecorationLine: 'underline',
                        textDecorationStyle: 'dotted',
                        textDecorationColor: 'currentColor',
                        textUnderlineOffset: '4px',
                        textDecorationThickness: '1.5px',
                      } : undefined}
                    >
                      {w.word}{i < wordMatchResult.words.length - 1 ? " " : ""}
                    </span>
                  ))
                ) : renderFormattedText(line.text)
              )}
            </p>
            
            {!isCurrent && onPlayFromHere && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { e.stopPropagation(); onPlayFromHere(line); }}
                className={cn(
                  "mt-1.5 gap-1 text-[10px] px-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity",
                  cameraMode ? "text-white/50" : "text-muted-foreground/60"
                )}
                data-testid={`button-play-from-${type}`}
              >
                <Play className="h-3 w-3" />
                Play from here
              </Button>
            )}
            
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
                {tapMode ? (
                  <button 
                    onClick={(e) => { e.stopPropagation(); onTapAdvance?.(); }}
                    className="flex items-center gap-2 px-3 py-2 -mx-2 rounded-lg bg-background/15 hover:bg-background/25 active:bg-background/30 transition-colors"
                    data-testid="button-tap-advance"
                  >
                    <Hand className="w-3.5 h-3.5 text-background/80" />
                    <span className="text-xs text-background/90 font-medium">
                      Tap when ready
                    </span>
                  </button>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      {isListening ? (
                        <>
                          <div className="speaking-energy speaking-energy-success">
                            <span />
                            <span />
                            <span />
                            <span />
                            <span />
                          </div>
                          <span className="text-xs text-background/90 font-medium">
                            Listening
                          </span>
                        </>
                      ) : (
                        <button 
                          onClick={(e) => { e.stopPropagation(); onRestartListening?.(); }}
                          className="flex items-center gap-2 px-2 py-1 -mx-2 -my-1 rounded hover:bg-background/10 transition-colors"
                          data-testid="button-restart-listening"
                        >
                          <Mic className="w-3 h-3 text-background/60" />
                          <span className="text-xs text-background/70">
                            Tap to speak
                          </span>
                        </button>
                      )}
                    </div>
                    
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
                  </>
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
                <div className="speaking-energy">
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
                <span className="text-[10px] text-muted-foreground/70">Speaking</span>
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
          className={cn(
            "px-4 py-3 rounded-xl animate-in fade-in slide-in-from-top-2 duration-300 scene-energy",
            cameraMode 
              ? "bg-black/50 backdrop-blur-xl border border-white/20" 
              : "bg-muted/30 border border-border/40"
          )}
          data-testid="scene-transition-card"
        >
          <div className="flex items-center gap-2 mb-1">
            <div className={cn(
              "circle-badge w-5 h-5",
              cameraMode ? "bg-white/10" : "bg-primary/10"
            )}>
              <Film className={cn(
                "w-3 h-3",
                cameraMode ? "text-white/70" : "text-primary/70"
              )} />
            </div>
            <span className={cn(
              "text-[11px] font-medium uppercase tracking-wide",
              cameraMode ? "text-white/70" : "text-muted-foreground/70"
            )}>
              Scene
            </span>
          </div>
          <p className={cn(
            "text-sm font-medium leading-snug",
            cameraMode ? "text-white" : "text-foreground/90"
          )}>
            {currentScene.name}
          </p>
          {currentScene.description && (
            <div 
              className="mt-1.5 cursor-pointer group"
              onClick={() => setDescriptionExpanded(!descriptionExpanded)}
              data-testid="scene-description-toggle"
            >
              {descriptionExpanded ? (
                <p className={cn(
                  "text-xs leading-relaxed italic",
                  cameraMode ? "text-white/60" : "text-muted-foreground/70"
                )}>
                  {currentScene.description}
                </p>
              ) : (
                <div className="overflow-hidden relative">
                  <div 
                    className={cn(
                      "whitespace-nowrap text-xs italic",
                      cameraMode ? "text-white/60" : "text-muted-foreground/70",
                      currentScene.description.length > 60 && "animate-marquee"
                    )}
                    style={{
                      animation: currentScene.description.length > 60 
                        ? `marquee ${Math.max(8, currentScene.description.length / 10)}s linear infinite` 
                        : undefined
                    }}
                  >
                    {currentScene.description}
                    {currentScene.description.length > 60 && (
                      <span className="mx-8 opacity-50">|</span>
                    )}
                    {currentScene.description.length > 60 && currentScene.description}
                  </div>
                  {currentScene.description.length > 60 && (
                    <div className={cn(
                      "absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l pointer-events-none",
                      cameraMode ? "from-black/60" : "from-muted/30"
                    )} />
                  )}
                </div>
              )}
              {currentScene.description.length > 60 && (
                <div className={cn(
                  "flex items-center gap-1 mt-1 text-[10px]",
                  cameraMode ? "text-white/40" : "text-muted-foreground/50"
                )}>
                  {descriptionExpanded ? (
                    <>
                      <ChevronUp className="h-3 w-3" />
                      <span>Collapse</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3 w-3" />
                      <span>Expand</span>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      <div className="flex gap-3">
        {/* Timeline indicator */}
        <div className="flex flex-col items-center py-6 flex-shrink-0">
          {/* Previous dot */}
          <div className={cn(
            "w-2 h-2 rounded-full transition-all duration-300",
            previousLine 
              ? (cameraMode ? "bg-white/30" : "bg-muted-foreground/30") 
              : "bg-transparent"
          )} />
          
          {/* Line connecting to current */}
          <div className={cn(
            "w-0.5 flex-1 transition-all duration-300",
            previousLine 
              ? (cameraMode ? "bg-white/20" : "bg-muted-foreground/20") 
              : "bg-transparent"
          )} />
          
          {/* Current dot - larger and highlighted */}
          <div className={cn(
            "w-3.5 h-3.5 rounded-full flex items-center justify-center transition-all duration-300",
            isUserLine 
              ? (cameraMode ? "bg-white ring-2 ring-white/30" : "bg-foreground ring-2 ring-foreground/20")
              : "bg-primary ring-2 ring-primary/20"
          )}>
            {isPlaying && (
              <div className={cn(
                "w-1.5 h-1.5 rounded-full animate-pulse",
                isUserLine ? (cameraMode ? "bg-black" : "bg-background") : "bg-primary-foreground"
              )} />
            )}
          </div>
          
          {/* Line connecting to next */}
          <div className={cn(
            "w-0.5 flex-1 transition-all duration-300",
            nextLine 
              ? (cameraMode ? "bg-white/20" : "bg-muted-foreground/20") 
              : "bg-transparent"
          )} />
          
          {/* Next dot */}
          <div className={cn(
            "w-2 h-2 rounded-full transition-all duration-300",
            nextLine 
              ? (cameraMode ? "bg-white/30" : "bg-muted-foreground/30") 
              : "bg-transparent"
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
