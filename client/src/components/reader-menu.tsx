import { useState, useMemo, useRef, useEffect } from "react";
import { Settings2, Plus, Minus, Eye, EyeOff, List, Bookmark, Type, Search, X } from "lucide-react";
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
import { cn } from "@/lib/utils";

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
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const currentScene = scenes[currentSceneIndex];

  // Focus search input when dialog opens
  useEffect(() => {
    if (jumpDialogOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    } else {
      setSearchQuery(""); // Clear search when closing
    }
  }, [jumpDialogOpen]);

  // Filter lines based on search - searches across ALL scenes
  const filteredLines = useMemo(() => {
    // Flatten all lines from all scenes with scene index tracking
    const allLines: { line: ScriptLine; lineIndex: number; sceneIndex: number; sceneName: string }[] = [];
    scenes.forEach((scene, sceneIdx) => {
      scene.lines.forEach((line, lineIdx) => {
        allLines.push({ line, lineIndex: lineIdx, sceneIndex: sceneIdx, sceneName: scene.name });
      });
    });
    
    if (!searchQuery.trim()) {
      // When no search, just show current scene lines
      if (!currentScene?.lines) return [];
      return currentScene.lines.map((line, index) => ({ 
        line, 
        lineIndex: index, 
        sceneIndex: currentSceneIndex,
        sceneName: currentScene.name 
      }));
    }
    
    const query = searchQuery.toLowerCase();
    return allLines.filter(({ line }) => 
      line.text.toLowerCase().includes(query) ||
      line.roleName.toLowerCase().includes(query)
    );
  }, [scenes, currentScene?.lines, currentSceneIndex, searchQuery]);

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
            className="text-muted-foreground rounded-xl"
            data-testid="button-reader-menu"
          >
            <Settings2 className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52 rounded-xl p-2">
          <DropdownMenuLabel className="text-xs text-muted-foreground font-semibold uppercase tracking-wider px-2">
            Reader Settings
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="my-2" />
          
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50 mb-2">
            <div className="flex items-center gap-2">
              <Type className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Font Size</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onFontSizeChange(Math.max(0, fontSize - 1))}
                disabled={fontSize === 0}
                data-testid="button-font-decrease"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="text-sm font-semibold w-7 text-center">
                {["S", "M", "L"][fontSize]}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onFontSizeChange(Math.min(2, fontSize + 1))}
                disabled={fontSize === 2}
                data-testid="button-font-increase"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <DropdownMenuItem
            onClick={onToggleDirections}
            className="rounded-lg p-3"
            data-testid="menu-toggle-directions"
          >
            {showDirections ? (
              <>
                <EyeOff className="h-4 w-4 mr-3" />
                Hide Stage Directions
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-3" />
                Show Stage Directions
              </>
            )}
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => setJumpDialogOpen(true)}
            className="rounded-lg p-3"
            data-testid="menu-jump-to"
          >
            <List className="h-4 w-4 mr-3" />
            Jump to Line...
          </DropdownMenuItem>

          {bookmarkedLines.length > 0 && (
            <>
              <DropdownMenuSeparator className="my-2" />
              <DropdownMenuLabel className="text-xs text-muted-foreground flex items-center gap-1.5 px-2">
                <Bookmark className="h-3 w-3 text-accent" />
                Bookmarks ({bookmarkedLines.length})
              </DropdownMenuLabel>
              {bookmarkedLines.slice(0, 5).map(({ line, index }) => (
                <DropdownMenuItem
                  key={line.id}
                  onClick={() => onJumpToLine(index)}
                  className="text-xs rounded-lg p-2"
                  data-testid={`menu-bookmark-${line.id}`}
                >
                  <span className="truncate">
                    <span className="font-medium text-accent">{line.roleName}:</span> {line.text.substring(0, 25)}...
                  </span>
                </DropdownMenuItem>
              ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={jumpDialogOpen} onOpenChange={setJumpDialogOpen}>
        <DialogContent className="max-w-md max-h-[80vh] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Jump to Line</DialogTitle>
          </DialogHeader>
          
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search lines..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-9 pr-9 rounded-lg bg-muted/50 border-0 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              data-testid="input-search-lines"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                data-testid="button-clear-search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          
          <ScrollArea className="max-h-[55vh] pr-4 custom-scrollbar">
            <div className="space-y-1">
              {filteredLines.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">
                  No lines match your search
                </p>
              ) : (
                filteredLines.map(({ line, lineIndex, sceneIndex, sceneName }) => (
                  <button
                    key={`${sceneIndex}-${line.id}`}
                    onClick={() => {
                      onJumpToLine(lineIndex, sceneIndex);
                      setJumpDialogOpen(false);
                    }}
                    className={cn(
                      "w-full text-left px-4 py-3 rounded-xl text-sm transition-all duration-200",
                      "hover:bg-muted flex items-start gap-3"
                    )}
                    data-testid={`jump-line-${sceneIndex}-${lineIndex}`}
                  >
                    <span className="text-xs text-muted-foreground tabular-nums flex-shrink-0 w-7 h-7 rounded-lg bg-muted flex items-center justify-center font-medium">
                      {lineIndex + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-accent">{line.roleName}</span>
                      {searchQuery.trim() && sceneIndex !== currentSceneIndex && (
                        <span className="text-xs text-muted-foreground ml-2">({sceneName})</span>
                      )}
                      <p className="text-muted-foreground mt-0.5 line-clamp-2">
                        {line.text}
                      </p>
                    </div>
                    {line.isBookmarked && (
                      <Bookmark className="h-4 w-4 text-accent flex-shrink-0 mt-1" />
                    )}
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
