import { ThemeToggle } from "@/components/theme-toggle";
import { ReaderMenu } from "@/components/reader-menu";
import { RoleChip } from "@/components/role-chip";
import { StreakDisplay } from "@/components/streak-display";
import { BrandLogo } from "@/components/brand-logo";
import { SpotMascot } from "@/components/spot-mascot";
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
  streak = 0,
  dailyGoal = 50,
  todayLines = 0,
  onBack,
  onFontSizeChange,
  onToggleDirections,
  onJumpToLine,
}: HeaderProps) {
  return (
    <header className="flex items-center justify-between gap-3 px-4 py-3 border-b glass sticky top-0 z-50 safe-top">
      <div className="flex items-center gap-3 min-w-0">
        {onBack ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="shrink-0"
            data-testid="button-back-home"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        ) : (
          <BrandLogo size="sm" />
        )}
        <SpotMascot mood="listening" size="xs" animate={false} />
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
