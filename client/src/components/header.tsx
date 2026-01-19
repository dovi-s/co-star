import { ThemeToggle } from "@/components/theme-toggle";
import { ReaderMenu } from "@/components/reader-menu";
import { RoleChip } from "@/components/role-chip";
import { SmartCastBadge } from "@/components/smart-cast-badge";
import type { Role, Scene } from "@shared/schema";

interface HeaderProps {
  sessionName: string;
  userRole: Role | null;
  showReaderMenu?: boolean;
  fontSize?: number;
  showDirections?: boolean;
  scenes?: Scene[];
  currentSceneIndex?: number;
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
  onFontSizeChange,
  onToggleDirections,
  onJumpToLine,
}: HeaderProps) {
  return (
    <header className="flex items-center justify-between gap-3 px-4 py-3 border-b bg-background/95 backdrop-blur-sm sticky top-0 z-50">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">C</span>
          </div>
          <div className="hidden sm:block">
            <h1 className="font-semibold text-sm truncate max-w-[140px]" data-testid="text-session-name">
              {sessionName}
            </h1>
          </div>
        </div>

        {userRole && (
          <RoleChip role={userRole} isUserRole />
        )}

        <SmartCastBadge />
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
