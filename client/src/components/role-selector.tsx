import { useState } from "react";
import { Check, User, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Role } from "@shared/schema";
import { cn } from "@/lib/utils";

interface RoleSelectorProps {
  roles: Role[];
  onRoleSelect: (roleId: string) => void;
  onBack: () => void;
  scriptName?: string;
}

export function RoleSelector({ roles, onRoleSelect, onBack, scriptName }: RoleSelectorProps) {
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(
    roles.length === 1 ? roles[0].id : null
  );
  const [isExiting, setIsExiting] = useState(false);

  const sortedRoles = [...roles].sort((a, b) => b.lineCount - a.lineCount);
  const totalLines = roles.reduce((sum, r) => sum + r.lineCount, 0);
  const selectedRole = roles.find(r => r.id === selectedRoleId);

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
      <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border/40 sticky top-0 z-50 bg-background/95 backdrop-blur-sm safe-top animate-fade-in">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
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
          <div className="min-w-0">
            <h1 className="font-medium text-sm truncate text-foreground">
              {scriptName || "Your Script"}
            </h1>
            <p className="text-[11px] text-muted-foreground">
              {roles.length} characters
            </p>
          </div>
        </div>
        <ThemeToggle />
      </header>

      <div className="flex-1 flex flex-col">
        <div className="px-5 pt-6 pb-4 animate-fade-in-up">
          <h2 className="text-lg font-semibold text-foreground">
            Select your role
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            AI will read the other parts.
          </p>
        </div>

        <div className="flex-1 px-4 pb-4 space-y-2 overflow-y-auto">
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
                  "transition-all duration-150 hover-elevate press-effect",
                  "animate-fade-in-up",
                  isSelected && "ring-2 ring-primary shadow-sm bg-primary/[0.03]",
                )}
                style={{ animationDelay: `${index * 40}ms` }}
                data-testid={`card-role-${role.name}`}
              >
                <div
                  className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200",
                    isSelected
                      ? "bg-primary text-primary-foreground scale-105"
                      : "bg-muted"
                  )}
                >
                  {isSelected ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <User className="h-4 w-4 text-muted-foreground" />
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

      <div className="sticky bottom-0 px-4 pt-3 pb-4 border-t border-border/40 bg-background animate-slide-up z-40">
        <Button
          onClick={handleContinue}
          disabled={!selectedRoleId}
          size="lg"
          className="w-full"
          data-testid="button-start-rehearsal"
        >
          {selectedRoleId ? "Start" : "Select a role"}
        </Button>
        
        {selectedRole && (
          <p className="text-center text-xs text-muted-foreground mt-1.5 animate-fade-in">
            Playing as <span className="font-medium text-foreground">{selectedRole.name}</span>
          </p>
        )}
      </div>
    </div>
  );
}
