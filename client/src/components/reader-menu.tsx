import { useState, useMemo, useRef, useEffect } from "react";
import { Settings2, Plus, Minus, Eye, EyeOff, List, Bookmark, Type, Search, X, Film } from "lucide-react";
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

  // Build organized structure with scenes and lines
  const organizedContent = useMemo(() => {
    type LineItem = { type: 'line'; line: ScriptLine; lineIndex: number; sceneIndex: number; sceneName: string };
    type SceneItem = { type: 'scene'; sceneIndex: number; sceneName: string; lineCount: number };
    type ContentItem = LineItem | SceneItem;
    
    const items: ContentItem[] = [];
    
    if (!searchQuery.trim()) {
      // When no search, show all scenes with their lines grouped
      scenes.forEach((scene, sceneIdx) => {
        // Add scene header
        items.push({ 
          type: 'scene', 
          sceneIndex: sceneIdx, 
          sceneName: scene.name,
          lineCount: scene.lines.length 
        });
        // Add lines for this scene
        scene.lines.forEach((line, lineIdx) => {
          items.push({ 
            type: 'line', 
            line, 
            lineIndex: lineIdx, 
            sceneIndex: sceneIdx, 
            sceneName: scene.name 
          });
        });
      });
    } else {
      // When searching, show matching lines from all scenes
      const query = searchQuery.toLowerCase();
      scenes.forEach((scene, sceneIdx) => {
        scene.lines.forEach((line, lineIdx) => {
          if (line.text.toLowerCase().includes(query) || line.roleName.toLowerCase().includes(query)) {
            items.push({ 
              type: 'line', 
              line, 
              lineIndex: lineIdx, 
              sceneIndex: sceneIdx, 
              sceneName: scene.name 
            });
          }
        });
      });
    }
    
    return items;
  }, [scenes, searchQuery]);

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
            aria-label="Reader settings"
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
                aria-label="Decrease font size"
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
                aria-label="Increase font size"
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
            <DialogTitle className="text-xl font-bold">Jump to Scene or Line</DialogTitle>
          </DialogHeader>
          
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground transition-colors"
                data-testid="button-clear-search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          
          <ScrollArea className="max-h-[55vh] pr-4 custom-scrollbar">
            <div className="space-y-1">
              {organizedContent.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center animate-fade-in-up">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                    <Search className="h-5 w-5 text-primary" />
                  </div>
                  <p className="text-sm font-semibold text-foreground mb-1">No matches found</p>
                  <p className="text-xs text-muted-foreground max-w-[200px] leading-relaxed">
                    Try a different character name or line of dialogue.
                  </p>
                </div>
              ) : (
                organizedContent.map((item, idx) => {
                  if (item.type === 'scene') {
                    // Scene header - clickable to jump to start of scene
                    return (
                      <button
                        key={`scene-${item.sceneIndex}`}
                        onClick={() => {
                          onJumpToLine(0, item.sceneIndex);
                          setJumpDialogOpen(false);
                        }}
                        className={cn(
                          "w-full text-left px-4 py-3 rounded-xl text-sm transition-all duration-200",
                          "hover:bg-primary/10 flex items-center gap-3 group",
                          item.sceneIndex === currentSceneIndex && "bg-primary/5"
                        )}
                        data-testid={`jump-scene-${item.sceneIndex}`}
                      >
                        <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Film className="h-3.5 w-3.5 text-primary" />
                        </span>
                        <div className="flex-1 min-w-0">
                          <span className="font-semibold text-foreground">{item.sceneName}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {item.lineCount} lines
                          </span>
                        </div>
                        {item.sceneIndex === currentSceneIndex && (
                          <span className="text-xs text-primary font-medium">Current</span>
                        )}
                      </button>
                    );
                  }
                  
                  // Line item
                  const { line, lineIndex, sceneIndex, sceneName } = item;
                  return (
                    <button
                      key={`${sceneIndex}-${line.id}`}
                      onClick={() => {
                        onJumpToLine(lineIndex, sceneIndex);
                        setJumpDialogOpen(false);
                      }}
                      className={cn(
                        "w-full text-left px-4 py-2.5 rounded-xl text-sm transition-all duration-200",
                        "hover:bg-muted flex items-start gap-3 ml-4"
                      )}
                      data-testid={`jump-line-${sceneIndex}-${lineIndex}`}
                    >
                      <span className="text-xs text-muted-foreground tabular-nums flex-shrink-0 w-6 h-6 rounded-md bg-muted/50 flex items-center justify-center font-medium">
                        {lineIndex + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold text-accent text-xs">{line.roleName}</span>
                        {searchQuery.trim() && (
                          <span className="text-xs text-muted-foreground ml-2">({sceneName})</span>
                        )}
                        <p className="text-muted-foreground text-xs mt-0.5 line-clamp-1">
                          {line.text}
                        </p>
                      </div>
                      {line.isBookmarked && (
                        <Bookmark className="h-3.5 w-3.5 text-accent flex-shrink-0 mt-0.5" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
