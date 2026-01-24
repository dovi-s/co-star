import { useState } from "react";
import { Check, User, ChevronLeft, Volume2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
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
      setTimeout(() => onRoleSelect(selectedRoleId), 300);
    }
  };

  return (
    <div 
      className={cn(
        "min-h-screen flex flex-col bg-background transition-all duration-300",
        isExiting && "opacity-0 translate-y-2"
      )} 
      data-testid="role-selector"
    >
      {/* Minimal header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border/40 sticky top-0 z-50 bg-background/95 backdrop-blur-sm safe-top">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="shrink-0"
          data-testid="button-back-to-import"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="font-medium text-sm truncate text-foreground/90">
            {scriptName || "Your Script"}
          </h1>
          <p className="text-[11px] text-muted-foreground/60">
            {roles.length} characters · {totalLines} lines
          </p>
        </div>
      </header>

      <div className="flex-1 flex flex-col">
        {/* Clean section header */}
        <div className="px-5 pt-6 pb-4">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Choose your role
          </h2>
          <p className="text-sm text-muted-foreground/70 mt-0.5">
            AI will voice the other characters
          </p>
        </div>

        {/* Role cards - clean, professional design */}
        <div className="flex-1 px-4 pb-4 space-y-2 overflow-y-auto">
          {sortedRoles.map((role, index) => {
            const isSelected = selectedRoleId === role.id;
            const linePercentage = Math.round((role.lineCount / totalLines) * 100);
            const isLead = index === 0;
            
            return (
              <button
                key={role.id}
                onClick={() => setSelectedRoleId(role.id)}
                className={cn(
                  "w-full flex items-center gap-3.5 p-3.5 rounded-xl text-left",
                  "transition-all duration-200",
                  isSelected
                    ? "bg-foreground text-background ring-1 ring-foreground"
                    : "bg-card hover:bg-muted/50 border border-border/60"
                )}
                data-testid={`card-role-${role.name}`}
              >
                {/* Selection indicator */}
                <div
                  className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-lg transition-colors",
                    isSelected
                      ? "bg-background/20"
                      : "bg-muted/50"
                  )}
                >
                  {isSelected ? (
                    <Check className={cn("h-5 w-5", isSelected ? "text-background" : "text-foreground")} />
                  ) : (
                    <User className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>

                {/* Role info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "font-medium",
                      isSelected ? "text-background" : "text-foreground"
                    )}>
                      {role.name}
                    </span>
                    {isLead && (
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded font-medium",
                        isSelected 
                          ? "bg-background/20 text-background/90" 
                          : "bg-muted text-muted-foreground"
                      )}>
                        Lead
                      </span>
                    )}
                  </div>
                  <div className={cn(
                    "text-xs mt-0.5",
                    isSelected ? "text-background/70" : "text-muted-foreground"
                  )}>
                    {role.lineCount} lines · {linePercentage}%
                  </div>
                </div>

                {/* AI voice indicator for unselected */}
                {!isSelected && (
                  <div className="flex items-center gap-1 text-muted-foreground/50">
                    <Volume2 className="h-3.5 w-3.5" />
                    <span className="text-[10px] font-medium">AI</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Clean footer */}
      <div className="p-4 border-t border-border/40 bg-background safe-bottom">
        <button
          onClick={handleContinue}
          disabled={!selectedRoleId}
          className={cn(
            "w-full h-12 rounded-xl font-medium text-sm flex items-center justify-center gap-2",
            "transition-all duration-200",
            selectedRoleId
              ? "bg-foreground text-background hover:opacity-90 active:scale-[0.98]"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          )}
          data-testid="button-start-rehearsal"
        >
          {selectedRoleId ? (
            <>
              Start rehearsal
              <ArrowRight className="h-4 w-4" />
            </>
          ) : (
            "Select a role to continue"
          )}
        </button>
        
        {selectedRole && (
          <p className="text-center text-xs text-muted-foreground/60 mt-2">
            You'll play {selectedRole.name}
          </p>
        )}
      </div>
    </div>
  );
}
