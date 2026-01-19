import { useState } from "react";
import { Settings2, Plus, Minus, Eye, EyeOff, List, Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ScriptLine, Scene } from "@shared/schema";

interface ReaderMenuProps {
  fontSize: number;
  showDirections: boolean;
  scenes: Scene[];
  currentSceneIndex: number;
  onFontSizeChange: (size: number) => void;
  onToggleDirections: () => void;
  onJumpToLine: (lineIndex: number, sceneIndex?: number) => void;
}

export function ReaderMenu({
  fontSize,
  showDirections,
  scenes,
  currentSceneIndex,
  onFontSizeChange,
  onToggleDirections,
  onJumpToLine,
}: ReaderMenuProps) {
  const [jumpDialogOpen, setJumpDialogOpen] = useState(false);
  const currentScene = scenes[currentSceneIndex];

  const bookmarkedLines = currentScene?.lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => line.isBookmarked) ?? [];

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground"
            data-testid="button-reader-menu"
          >
            <Settings2 className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Reader Settings
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-sm">Font Size</span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onFontSizeChange(Math.max(0, fontSize - 1))}
                disabled={fontSize === 0}
                data-testid="button-font-decrease"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground w-6 text-center">
                {["S", "M", "L"][fontSize]}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onFontSizeChange(Math.min(2, fontSize + 1))}
                disabled={fontSize === 2}
                data-testid="button-font-increase"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={onToggleDirections}
            data-testid="menu-toggle-directions"
          >
            {showDirections ? (
              <>
                <EyeOff className="h-4 w-4 mr-2" />
                Hide Directions
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-2" />
                Show Directions
              </>
            )}
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => setJumpDialogOpen(true)}
            data-testid="menu-jump-to"
          >
            <List className="h-4 w-4 mr-2" />
            Jump to...
          </DropdownMenuItem>

          {bookmarkedLines.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Bookmark className="h-3 w-3" />
                Bookmarks
              </DropdownMenuLabel>
              {bookmarkedLines.slice(0, 5).map(({ line, index }) => (
                <DropdownMenuItem
                  key={line.id}
                  onClick={() => onJumpToLine(index)}
                  className="text-xs"
                  data-testid={`menu-bookmark-${line.id}`}
                >
                  <span className="truncate">
                    {line.roleName}: {line.text.substring(0, 30)}...
                  </span>
                </DropdownMenuItem>
              ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={jumpDialogOpen} onOpenChange={setJumpDialogOpen}>
        <DialogContent className="max-w-md max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Jump to Line</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4 custom-scrollbar">
            <div className="space-y-1">
              {currentScene?.lines.map((line, index) => (
                <button
                  key={line.id}
                  onClick={() => {
                    onJumpToLine(index);
                    setJumpDialogOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-md text-sm hover-elevate transition-colors flex items-start gap-3"
                  data-testid={`jump-line-${index}`}
                >
                  <span className="text-xs text-muted-foreground tabular-nums flex-shrink-0 w-6">
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-accent">{line.roleName}:</span>
                    <span className="text-muted-foreground ml-2 truncate block">
                      {line.text.substring(0, 60)}
                      {line.text.length > 60 && "..."}
                    </span>
                  </div>
                  {line.isBookmarked && (
                    <Bookmark className="h-4 w-4 text-accent flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
