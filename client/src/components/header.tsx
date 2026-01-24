import { ThemeToggle } from "@/components/theme-toggle";
import { ReaderMenu } from "@/components/reader-menu";
import { RoleChip } from "@/components/role-chip";
import { Mic } from "lucide-react";
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
    <header className="flex items-center justify-between gap-3 px-4 py-3 border-b glass sticky top-0 z-50 safe-top">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-sm">
              <Mic className="h-4.5 w-4.5 text-primary-foreground" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-accent border-2 border-background" />
          </div>
          <div className="hidden sm:block">
            <h1 className="font-semibold text-sm truncate max-w-[120px]" data-testid="text-session-name">
              {sessionName}
            </h1>
            <p className="text-[10px] text-muted-foreground -mt-0.5">Rehearsing</p>
          </div>
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
