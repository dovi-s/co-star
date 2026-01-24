import { useState } from "react";
import { Check, User, ChevronLeft, Volume2, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SpotMascot } from "@/components/spot-mascot";
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
      {/* Animated header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border/40 sticky top-0 z-50 bg-background/95 backdrop-blur-sm safe-top animate-fade-in">
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
        <SpotMascot size="xs" mood="thinking" />
      </header>

      <div className="flex-1 flex flex-col">
        {/* Fun section header */}
        <div className="px-5 pt-6 pb-4 animate-fade-in-up">
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Who will you be?
          </h2>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Pick your character. AI handles everyone else.
          </p>
        </div>

        {/* Role cards with stagger animations */}
        <div className="flex-1 px-4 pb-4 space-y-2.5 overflow-y-auto">
          {sortedRoles.map((role, index) => {
            const isSelected = selectedRoleId === role.id;
            const linePercentage = Math.round((role.lineCount / totalLines) * 100);
            const isLead = index === 0;
            
            return (
              <button
                key={role.id}
                onClick={() => setSelectedRoleId(role.id)}
                className={cn(
                  "w-full flex items-center gap-3.5 p-4 rounded-xl text-left animate-fade-in-up",
                  "transition-all duration-200 hover-lift",
                  isSelected
                    ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white ring-2 ring-amber-500/50 shadow-lg shadow-amber-500/20"
                    : "bg-card hover:bg-muted/50 border border-border/60",
                  `stagger-${Math.min(index + 1, 6)}`
                )}
                data-testid={`card-role-${role.name}`}
              >
                {/* Selection indicator */}
                <div
                  className={cn(
                    "flex items-center justify-center w-11 h-11 rounded-xl transition-all",
                    isSelected
                      ? "bg-white/20 scale-110"
                      : "bg-muted/50"
                  )}
                >
                  {isSelected ? (
                    <Check className="h-5 w-5 text-white" />
                  ) : (
                    <User className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>

                {/* Role info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "font-semibold text-base",
                      isSelected ? "text-white" : "text-foreground"
                    )}>
                      {role.name}
                    </span>
                    {isLead && (
                      <span className={cn(
                        "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide",
                        isSelected 
                          ? "bg-white/20 text-white" 
                          : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      )}>
                        Lead
                      </span>
                    )}
                  </div>
                  <div className={cn(
                    "text-xs mt-0.5 font-medium",
                    isSelected ? "text-white/80" : "text-muted-foreground"
                  )}>
                    {role.lineCount} lines · {linePercentage}% of script
                  </div>
                </div>

                {/* AI voice indicator for unselected */}
                {!isSelected && (
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400">
                    <Volume2 className="h-3 w-3" />
                    <span className="text-[10px] font-bold uppercase">AI</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Vibrant footer */}
      <div className="p-4 border-t border-border/40 bg-background safe-bottom animate-slide-up">
        <button
          onClick={handleContinue}
          disabled={!selectedRoleId}
          className={cn(
            "w-full h-13 rounded-xl font-bold text-base flex items-center justify-center gap-2",
            "transition-all duration-300",
            selectedRoleId
              ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:shadow-lg hover:shadow-amber-500/30 active:scale-[0.98]"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          )}
          data-testid="button-start-rehearsal"
        >
          {selectedRoleId ? (
            <>
              <Sparkles className="h-4 w-4" />
              Let's rehearse
              <ArrowRight className="h-4 w-4" />
            </>
          ) : (
            "Pick a character above"
          )}
        </button>
        
        {selectedRole && (
          <p className="text-center text-xs text-muted-foreground mt-2">
            You're playing <span className="font-semibold text-foreground">{selectedRole.name}</span>
          </p>
        )}
      </div>
    </div>
  );
}
