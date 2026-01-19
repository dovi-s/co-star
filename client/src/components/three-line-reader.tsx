import { useState, useEffect } from "react";
import type { ScriptLine, Role } from "@shared/schema";
import { Bookmark, BookmarkCheck, User } from "lucide-react";
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
            "min-h-[4rem] flex items-center justify-center",
            type === "previous" && "opacity-30",
            type === "next" && "opacity-40"
          )}
        >
          <span className="text-muted-foreground italic text-sm">
            {type === "previous" ? "Start of scene" : type === "next" ? "End of scene" : ""}
          </span>
        </div>
      );
    }

    const isCurrent = type === "current";
    const role = getRoleById(line.roleId);

    return (
      <div
        className={cn(
          "relative py-4 px-4 rounded-lg line-transition",
          type === "previous" && "opacity-40",
          type === "next" && "opacity-50",
          isCurrent && isUser && "bg-primary/10 border border-primary/20",
          isCurrent && !isUser && "bg-card border border-card-border"
        )}
        data-testid={`line-${type}`}
      >
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className={cn(
                  "font-semibold text-sm uppercase tracking-wide",
                  isCurrent && isUser && "text-primary",
                  isCurrent && !isUser && "text-accent",
                  !isCurrent && "text-muted-foreground"
                )}
              >
                {line.roleName}
              </span>
              {isUser && isCurrent && (
                <span className="flex items-center gap-1 text-xs text-primary">
                  <User className="h-3 w-3" />
                  You
                </span>
              )}
              {showDirections && line.direction && (
                <span className="text-xs text-muted-foreground italic">
                  [{line.direction}]
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
          </div>
          
          {isCurrent && (
            <Button
              variant="ghost"
              size="icon"
              className="flex-shrink-0 -mr-2"
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

        {isCurrent && isUser && isPlaying && (
          <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-full cue-pulse" />
        )}
      </div>
    );
  };

  const userLineForPrev = previousLine ? previousLine.roleId === currentLine?.roleId && isUserLine : false;
  const userLineForNext = nextLine && currentLine ? nextLine.roleId === currentLine?.roleId && isUserLine : false;

  return (
    <div className="flex flex-col gap-2" data-testid="three-line-reader">
      {renderLine(previousLine, "previous", false)}
      {renderLine(currentLine, "current", isUserLine)}
      {renderLine(nextLine, "next", false)}
    </div>
  );
}
