import { ThemeToggle } from "@/components/theme-toggle";
import { ReaderMenu } from "@/components/reader-menu";
import { RoleChip } from "@/components/role-chip";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import type { Role, Scene } from "@shared/schema";

interface HeaderProps {
  sessionName: string;
  userRole: Role | null;
  showReaderMenu?: boolean;
  fontSize?: number;
  showDirections?: boolean;
  scenes?: Scene[];
  currentSceneIndex?: number;
  streak?: number;
  dailyGoal?: number;
  todayLines?: number;
  onBack?: () => void;
  onFontSizeChange?: (size: number) => void;
  onToggleDirections?: () => void;
  onJumpToLine?: (lineIndex: number) => void;
}

export function Header({
  sessionName,
  userRole,
  showReaderMenu,
  fontSize = 1,
  showDirections = true,
  scenes = [],
  currentSceneIndex = 0,
  onBack,
  onFontSizeChange,
  onToggleDirections,
  onJumpToLine,
}: HeaderProps) {
  return (
    <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border/40 bg-background/95 backdrop-blur-sm sticky top-0 z-50 safe-top">
      <div className="flex items-center gap-3 min-w-0">
        {onBack && (
          <button
            type="button"
            onClick={() => {
              console.log("[Header] Back button clicked");
              onBack();
            }}
            className="shrink-0 touch-manipulation -ml-2 p-3 rounded-md hover:bg-accent/80 active:bg-accent transition-colors"
            style={{ minWidth: 44, minHeight: 44, touchAction: 'manipulation' }}
            data-testid="button-back-home"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        
        <div className="min-w-0">
          <h1 className="font-medium text-sm truncate text-foreground" data-testid="text-session-name">
            {sessionName}
          </h1>
        </div>

        {userRole && (
          <RoleChip role={userRole} isUserRole />
        )}
      </div>

      <div className="flex items-center gap-1">
        {showReaderMenu && onFontSizeChange && onToggleDirections && onJumpToLine && (
          <ReaderMenu
            fontSize={fontSize}
            showDirections={showDirections}
            scenes={scenes}
            currentSceneIndex={currentSceneIndex}
            onFontSizeChange={onFontSizeChange}
            onToggleDirections={onToggleDirections}
            onJumpToLine={onJumpToLine}
          />
        )}
        <ThemeToggle />
      </div>
    </header>
  );
}
