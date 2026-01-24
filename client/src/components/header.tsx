import { ThemeToggle } from "@/components/theme-toggle";
import { ReaderMenu } from "@/components/reader-menu";
import { RoleChip } from "@/components/role-chip";
import { StreakDisplay } from "@/components/streak-display";
import { Logo } from "@/components/logo";
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
  streak = 0,
  dailyGoal = 50,
  todayLines = 0,
  onFontSizeChange,
  onToggleDirections,
  onJumpToLine,
}: HeaderProps) {
  return (
    <header className="flex items-center justify-between gap-3 px-4 py-3 border-b glass sticky top-0 z-50 safe-top">
      <div className="flex items-center gap-3 min-w-0">
        <Logo size="sm" />
        <div className="hidden sm:block">
          <h1 className="font-semibold text-sm truncate max-w-[120px]" data-testid="text-session-name">
            {sessionName}
          </h1>
          <p className="text-[10px] text-muted-foreground -mt-0.5">Rehearsing</p>
        </div>

        {userRole && (
          <RoleChip role={userRole} isUserRole />
        )}
        
        <div className="hidden sm:block">
          <StreakDisplay streak={streak} dailyGoal={dailyGoal} todayLines={todayLines} compact />
        </div>
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
