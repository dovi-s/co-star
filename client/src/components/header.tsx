import { useState, useRef, useEffect } from "react";
import { ReaderMenu } from "@/components/reader-menu";
import { RoleChip } from "@/components/role-chip";
import { SideMenu } from "@/components/side-menu";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronLeft, Share2, Download, Copy, Send, Save, Check } from "lucide-react";
import { ProfileAvatar } from "@/components/profile-avatar";
import type { Role, Scene } from "@shared/schema";
import { cn } from "@/lib/utils";
import { DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

function formatScriptForExport(sessionName: string, scenes: Scene[]): string {
  const output: string[] = [];
  output.push(sessionName.toUpperCase());
  output.push("=".repeat(Math.max(sessionName.length, 1)));
  output.push("");

  for (const scene of scenes) {
    output.push(`--- ${scene.name} ---`);
    if (scene.description) {
      output.push(scene.description);
    }
    output.push("");

    for (const line of scene.lines) {
      if (line.context) {
        output.push(`(${line.context})`);
      }
      if (line.direction) {
        output.push(`[${line.direction}]`);
      }
      if (line.text) {
        output.push(`${line.roleName}: ${line.text}`);
      }
    }
    output.push("");
  }

  return output.join("\n").trim();
}

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
  onJumpToLine?: (lineIndex: number, sceneIndex?: number) => void;
  cameraMode?: boolean;
  onToast?: (msg: string) => void;
  onNavigate?: (page: string) => void;
  onSaveScript?: () => void;
  savingScript?: boolean;
  scriptSaved?: boolean;
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
  cameraMode = false,
  onToast,
  onNavigate,
  onSaveScript,
  savingScript = false,
  scriptSaved = false,
}: HeaderProps) {
  const [shareOpen, setShareOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const titleRef = useRef<HTMLHeadingElement>(null);
  const [titleOverflows, setTitleOverflows] = useState(false);

  useEffect(() => {
    const checkOverflow = () => {
      const el = titleRef.current;
      if (el) {
        const overflows = el.scrollWidth > el.clientWidth;
        setTitleOverflows(overflows);
        if (overflows) {
          const overflow = el.scrollWidth - el.clientWidth;
          el.style.setProperty('--marquee-distance', `-${overflow}px`);
        }
      }
    };
    checkOverflow();
    const timer = setTimeout(checkOverflow, 100);
    return () => clearTimeout(timer);
  }, [sessionName]);

  const showShareMenu = scenes.length > 0 && scenes.some(s => s.lines.length > 0);

  const getExportText = () => formatScriptForExport(sessionName, scenes);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(getExportText());
      onToast?.("Script copied to clipboard");
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = getExportText();
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      onToast?.("Script copied to clipboard");
    }
  };

  const handleDownload = () => {
    const text = getExportText();
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeName = sessionName.replace(/[^a-zA-Z0-9\s-]/g, "").replace(/\s+/g, "_").toLowerCase();
    a.download = `${safeName || "script"}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onToast?.("Script downloaded");
  };

  const handleShare = async () => {
    const text = getExportText();
    if (navigator.share) {
      try {
        await navigator.share({
          title: sessionName,
          text: text,
        });
      } catch (e: any) {
        if (e.name !== "AbortError") {
          handleCopy();
        }
      }
    } else {
      handleCopy();
    }
  };

  return (
    <header className={`flex items-center justify-between gap-3 px-4 py-3 sticky top-0 z-50 safe-top rounded-none ${
      cameraMode 
        ? "glass-surface-clear bg-black/40" 
        : "glass-surface"
    }`}>
      <div className="flex items-center gap-3 min-w-0">
        {onBack && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => {
              onBack();
            }}
            className={`shrink-0 -ml-1 icon-btn-press ${cameraMode ? "text-white hover:bg-white/10" : ""}`}
            data-testid="button-back-home"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        )}
        
        <div className="min-w-0 overflow-hidden">
          <h1
            ref={titleRef}
            className={cn(
              "font-medium text-sm whitespace-nowrap",
              cameraMode ? "text-white" : "text-foreground",
              titleOverflows ? "animate-marquee" : "truncate"
            )}
            data-testid="text-session-name"
          >
            {sessionName}
          </h1>
        </div>

        {userRole && (
          <RoleChip role={userRole} isUserRole />
        )}
      </div>

      <div className="flex items-center gap-1">
        {showShareMenu && (
          <DropdownMenu open={shareOpen} onOpenChange={setShareOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 text-muted-foreground"
                data-testid="button-share-menu"
              >
                <Share2 className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={handleCopy}
                data-testid="button-copy-script"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy script
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleDownload}
                data-testid="button-download-script"
              >
                <Download className="h-4 w-4 mr-2" />
                Download as file
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleShare}
                data-testid="button-share-script"
              >
                <Send className="h-4 w-4 mr-2" />
                Send to...
              </DropdownMenuItem>
              {onSaveScript && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={scriptSaved ? undefined : onSaveScript}
                    disabled={savingScript || scriptSaved}
                    data-testid="button-save-script-menu"
                  >
                    {scriptSaved ? (
                      <>
                        <Check className="h-4 w-4 mr-2 text-green-600 dark:text-green-400" />
                        <span className="text-green-600 dark:text-green-400">Saved to library</span>
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        {savingScript ? "Saving..." : "Save to library"}
                      </>
                    )}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
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
        <Button
          variant="ghost"
          size="icon"
          title="Profile"
          onClick={() => setMenuOpen(true)}
          data-testid="button-profile"
          className={`shrink-0 ${cameraMode ? "text-white" : "text-muted-foreground"}`}
        >
          <ProfileAvatar size="sm" className={cameraMode ? "text-white" : ""} />
        </Button>
      </div>

      <SideMenu open={menuOpen} onOpenChange={setMenuOpen} onNavigate={onNavigate} />
    </header>
  );
}
