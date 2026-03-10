import { useState, useRef, useEffect, useCallback } from "react";
import { Check, ChevronLeft, Users, AlertTriangle, FileText, Theater } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Role, Scene } from "@shared/schema";
import { cn } from "@/lib/utils";

interface RoleSelectorProps {
  roles: Role[];
  scenes?: Scene[];
  onRoleSelect: (roleId: string) => void;
  onBack: () => void;
  onTableRead?: () => void;
  scriptName?: string;
  lastRole?: string;
}

function getParseWarnings(roles: Role[], scenes: Scene[], totalLines: number): string[] {
  const warnings: string[] = [];
  if (roles.length === 1) {
    warnings.push("Only 1 role detected — the AI will have no lines to read. Check that character names parsed correctly.");
  }
  if (totalLines < 5) {
    warnings.push("Very few lines detected. The script may not have parsed correctly.");
  }
  if (roles.length > 0 && roles.some(r => r.lineCount === 0)) {
    const emptyRoles = roles.filter(r => r.lineCount === 0).map(r => r.name);
    warnings.push(`${emptyRoles.join(", ")} ${emptyRoles.length === 1 ? "has" : "have"} 0 lines — may be a parsing artifact.`);
  }
  return warnings;
}

export function RoleSelector({ roles, scenes = [], onRoleSelect, onBack, onTableRead, scriptName, lastRole }: RoleSelectorProps) {
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
  }, [scriptName]);

  const resolveInitialRole = (): string | null => {
    if (roles.length === 1) return roles[0].id;
    if (lastRole) {
      const match = roles.find(r => r.name === lastRole);
      if (match) return match.id;
    }
    return null;
  };

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(resolveInitialRole());
  const isReturning = !!lastRole && roles.some(r => r.name === lastRole);
  const [isExiting, setIsExiting] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const listRef = useRef<HTMLDivElement>(null);

  const sortedRoles = [...roles].sort((a, b) => b.lineCount - a.lineCount);
  const totalLines = roles.reduce((sum, r) => sum + r.lineCount, 0);
  const selectedRole = roles.find(r => r.id === selectedRoleId);
  const warnings = getParseWarnings(roles, scenes, totalLines);

  const previewLines = scenes.length > 0
    ? scenes[0].lines.slice(0, 3).map(l => ({ roleName: l.roleName, text: l.text }))
    : [];

  const handleContinue = () => {
    if (selectedRoleId) {
      setIsExiting(true);
      setTimeout(() => onRoleSelect(selectedRoleId), 250);
    }
  };

  const handleCardClick = (roleId: string) => {
    setSelectedRoleId(roleId);
  };

  const handleListKeyDown = useCallback((e: React.KeyboardEvent) => {
    const count = sortedRoles.length;
    if (count === 0) return;

    let newIndex = focusedIndex;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      newIndex = focusedIndex < count - 1 ? focusedIndex + 1 : 0;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      newIndex = focusedIndex > 0 ? focusedIndex - 1 : count - 1;
    } else if (e.key === 'Home') {
      e.preventDefault();
      newIndex = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      newIndex = count - 1;
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (focusedIndex >= 0 && focusedIndex < count) {
        setSelectedRoleId(sortedRoles[focusedIndex].id);
      }
      return;
    } else {
      return;
    }

    setFocusedIndex(newIndex);
    setSelectedRoleId(sortedRoles[newIndex].id);

    const listEl = listRef.current;
    if (listEl) {
      const child = listEl.children[newIndex] as HTMLElement;
      child?.focus();
    }
  }, [focusedIndex, sortedRoles]);

  return (
    <div 
      className={cn(
        "min-h-screen flex flex-col bg-background transition-all duration-250",
        isExiting && "opacity-0 scale-98"
      )} 
      data-testid="role-selector"
    >
      <header className="flex items-center justify-between gap-3 px-4 py-3 sticky top-0 z-50 glass-surface safe-top animate-fade-in rounded-none">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Back to import"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onBack();
            }}
            className="shrink-0 touch-manipulation transition-transform active:scale-95"
            data-testid="button-back-to-import"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 overflow-hidden">
            <h1
              ref={titleRef}
              className={cn(
                "font-medium text-sm text-foreground whitespace-nowrap",
                titleOverflows ? "animate-marquee" : "truncate"
              )}
            >
              {scriptName || "Your Script"}
            </h1>
            <p className="text-[11px] text-muted-foreground">
              {roles.length} {roles.length === 1 ? "character" : "characters"}
            </p>
          </div>
        </div>
        <ThemeToggle />
      </header>

      <div className="flex-1 flex flex-col">
        <div className="px-5 pt-3 pb-3 animate-fade-in-up relative">
          <div className="absolute -top-4 left-0 right-0 h-32 bg-gradient-to-b from-primary/[0.06] via-primary/[0.02] to-transparent pointer-events-none" />
          <h2 className="text-xl font-semibold text-foreground relative tracking-tight">
            {isReturning ? "Welcome back" : "Select your role"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1 relative leading-relaxed">
            {isReturning
              ? `Pick up where you left off, or choose a different role.`
              : "Your scene partner reads the other parts."}
          </p>

          <div className="flex items-center gap-2 flex-wrap mt-3" data-testid="script-preview-summary">
            <Badge variant="secondary" className="gap-1.5" data-testid="badge-roles-count">
              <Users className="h-3 w-3" />
              {roles.length} {roles.length === 1 ? "role" : "roles"}
            </Badge>
            <Badge variant="secondary" className="gap-1.5" data-testid="badge-lines-count">
              <FileText className="h-3 w-3" />
              {totalLines} {totalLines === 1 ? "line" : "lines"}
            </Badge>
            {scenes.length > 0 && (
              <Badge variant="secondary" className="gap-1.5" data-testid="badge-scenes-count">
                <Theater className="h-3 w-3" />
                {scenes.length} {scenes.length === 1 ? "scene" : "scenes"}
              </Badge>
            )}
          </div>

          {previewLines.length > 0 && (
            <div className="mt-3 rounded-md bg-muted/50 px-3 py-2 space-y-1" data-testid="script-preview-lines">
              {previewLines.map((line, i) => (
                <p key={i} className="text-xs leading-relaxed truncate" data-testid={`preview-line-${i}`}>
                  <span className="font-semibold text-foreground/80">{line.roleName}:</span>{" "}
                  <span className="text-muted-foreground">{line.text}</span>
                </p>
              ))}
            </div>
          )}

          {warnings.length > 0 && (
            <div className="space-y-2 mt-2" data-testid="script-warnings">
              {warnings.map((warning, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 rounded-md bg-destructive/10 dark:bg-destructive/15 px-3 py-2 text-xs text-destructive animate-fade-in"
                  data-testid={`warning-${i}`}
                >
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>{warning}</span>
                </div>
              ))}
            </div>
          )}

          {scenes.length > 1 && (
            <div className="space-y-1.5 mt-2" data-testid="scene-preview">
              <p className="text-xs font-medium text-muted-foreground">Scenes</p>
              <div className="flex flex-wrap gap-1.5">
                {scenes.map((scene, i) => (
                  <Badge
                    key={scene.id}
                    variant="outline"
                    className="text-[11px] font-normal"
                    data-testid={`badge-scene-${i}`}
                  >
                    {scene.name} · {scene.lines.length}L
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <div
          ref={listRef}
          role="listbox"
          aria-label="Select your role"
          aria-activedescendant={focusedIndex >= 0 ? `role-option-${sortedRoles[focusedIndex]?.id}` : undefined}
          tabIndex={0}
          onKeyDown={handleListKeyDown}
          onFocus={() => {
            if (focusedIndex < 0) {
              const idx = selectedRoleId ? sortedRoles.findIndex(r => r.id === selectedRoleId) : 0;
              setFocusedIndex(idx >= 0 ? idx : 0);
            }
          }}
          className="flex-1 px-4 pt-1 pb-3 space-y-1.5 overflow-y-auto outline-none"
        >
          {sortedRoles.map((role, index) => {
            const isSelected = selectedRoleId === role.id;
            const isFocused = focusedIndex === index;
            const linePercentage = Math.round((role.lineCount / totalLines) * 100);
            const isLead = index === 0;
            
            return (
              <Card
                key={role.id}
                id={`role-option-${role.id}`}
                role="option"
                aria-selected={isSelected}
                tabIndex={-1}
                onClick={() => {
                  handleCardClick(role.id);
                  setFocusedIndex(index);
                }}
                className={cn(
                  "w-full flex items-center gap-3 p-3 text-left cursor-pointer",
                  "transition-all duration-200 hover-elevate press-effect",
                  "animate-fade-in-up rounded-xl outline-none",
                  isSelected && "ring-2 ring-primary shadow-sm bg-primary/[0.03]",
                  isFocused && !isSelected && "ring-1 ring-primary/50",
                )}
                style={{ animationDelay: `${index * 50}ms` }}
                data-testid={`card-role-${role.name}`}
              >
                <div
                  className={cn(
                    "circle-badge w-10 h-10 transition-all duration-200",
                    isSelected
                      ? "bg-primary text-primary-foreground scale-105"
                      : "bg-muted"
                  )}
                >
                  {isSelected ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <span className="text-sm font-semibold text-muted-foreground">
                      {role.name.charAt(0)}
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <span className={cn(
                    "font-medium text-sm transition-colors block",
                    isSelected ? "text-foreground" : "text-foreground/90"
                  )}>
                    {role.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {role.lineCount} lines {isLead && <span className="text-foreground/70">· lead</span>}
                  </span>
                </div>

                <span className="text-xs text-muted-foreground tabular-nums">
                  {linePercentage}%
                </span>
              </Card>
            );
          })}
        </div>
      </div>

      <div className="sticky bottom-0 px-4 pt-3 pb-4 glass-surface animate-slide-up z-40 space-y-2 rounded-none">
        <Button
          onClick={handleContinue}
          disabled={!selectedRoleId}
          size="lg"
          className="w-full"
          data-testid="button-start-rehearsal"
        >
          {!selectedRoleId
            ? "Select a role"
            : isReturning && selectedRole?.name === lastRole
              ? `Resume as ${selectedRole.name}`
              : "Start Solo"}
        </Button>
        
        {onTableRead && (
          <Button
            onClick={onTableRead}
            variant="outline"
            size="lg"
            className="w-full"
            data-testid="button-table-read"
          >
            <Users className="h-4 w-4 mr-2" />
            Table Read with Friends
          </Button>
        )}
        
        {selectedRole && !isReturning && (
          <p className="text-center text-xs text-muted-foreground mt-1 animate-fade-in">
            Playing as <span className="font-medium text-foreground">{selectedRole.name}</span>
          </p>
        )}
      </div>
    </div>
  );
}
