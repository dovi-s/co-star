import { useState, useRef, useEffect } from "react";
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

export function RoleSelector({ roles, scenes = [], onRoleSelect, onBack, onTableRead, scriptName }: RoleSelectorProps) {
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

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(
    roles.length === 1 ? roles[0].id : null
  );
  const [isExiting, setIsExiting] = useState(false);

  const sortedRoles = [...roles].sort((a, b) => b.lineCount - a.lineCount);
  const totalLines = roles.reduce((sum, r) => sum + r.lineCount, 0);
  const selectedRole = roles.find(r => r.id === selectedRoleId);
  const warnings = getParseWarnings(roles, scenes, totalLines);

  const handleContinue = () => {
    if (selectedRoleId) {
      setIsExiting(true);
      setTimeout(() => onRoleSelect(selectedRoleId), 250);
    }
  };

  const handleCardClick = (roleId: string) => {
    setSelectedRoleId(roleId);
  };

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
        <div className="px-5 pt-8 pb-5 animate-fade-in-up relative">
          <div className="absolute -top-4 left-0 right-0 h-32 bg-gradient-to-b from-primary/[0.06] via-primary/[0.02] to-transparent pointer-events-none" />
          <h2 className="text-xl font-semibold text-foreground relative tracking-tight">
            Select your role
          </h2>
          <p className="text-sm text-muted-foreground mt-1.5 relative leading-relaxed">
            Your scene partner reads the other parts.
          </p>

          <div className="flex items-center gap-2 flex-wrap mt-4" data-testid="script-preview-summary">
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

          {warnings.length > 0 && (
            <div className="space-y-2 mt-3" data-testid="script-warnings">
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
            <div className="space-y-1.5 mt-3" data-testid="scene-preview">
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

        <div className="flex-1 px-4 pt-2 pb-4 space-y-2 overflow-y-auto">
          {sortedRoles.map((role, index) => {
            const isSelected = selectedRoleId === role.id;
            const linePercentage = Math.round((role.lineCount / totalLines) * 100);
            const isLead = index === 0;
            
            return (
              <Card
                key={role.id}
                onClick={() => handleCardClick(role.id)}
                className={cn(
                  "w-full flex items-center gap-3 p-4 text-left cursor-pointer",
                  "transition-all duration-200 hover-elevate press-effect",
                  "animate-fade-in-up rounded-xl",
                  isSelected && "ring-2 ring-primary shadow-sm bg-primary/[0.03]",
                )}
                style={{ animationDelay: `${index * 40}ms` }}
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
                    {role.lineCount} lines {isLead && <span className="text-foreground/50">· lead</span>}
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
          {selectedRoleId ? "Start Solo" : "Select a role"}
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
        
        {selectedRole && (
          <p className="text-center text-xs text-muted-foreground mt-1.5 animate-fade-in">
            Playing as <span className="font-medium text-foreground">{selectedRole.name}</span>
          </p>
        )}
      </div>
    </div>
  );
}
