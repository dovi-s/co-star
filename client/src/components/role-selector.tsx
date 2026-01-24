import { useState } from "react";
import { Check, User, ChevronLeft, Sparkles, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

  const sortedRoles = [...roles].sort((a, b) => b.lineCount - a.lineCount);
  const totalLines = roles.reduce((sum, r) => sum + r.lineCount, 0);

  const handleContinue = () => {
    if (selectedRoleId) {
      onRoleSelect(selectedRoleId);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background" data-testid="role-selector">
      <header className="flex items-center gap-3 px-4 py-3 border-b glass sticky top-0 z-50 safe-top">
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
          <h1 className="font-semibold text-base truncate">
            {scriptName || "Your Script"}
          </h1>
          <p className="text-xs text-muted-foreground">
            {roles.length} character{roles.length !== 1 ? "s" : ""} found
          </p>
        </div>
      </header>

      <div className="flex-1 flex flex-col">
        <div className="px-6 py-8 text-center space-y-4 animate-fade-in-up">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/15 to-accent/10 mb-2">
            <User className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">Who are you playing?</h2>
            <p className="text-muted-foreground text-sm max-w-[280px] mx-auto">
              Pick your character. Everyone else gets an AI voice.
            </p>
          </div>
          
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
            <Sparkles className="h-3.5 w-3.5" />
            Smart Cast enabled
          </div>
        </div>

        <div className="flex-1 px-4 pb-4 space-y-3 overflow-y-auto custom-scrollbar">
          {sortedRoles.map((role, index) => {
            const isSelected = selectedRoleId === role.id;
            const linePercentage = Math.round((role.lineCount / totalLines) * 100);
            
            return (
              <button
                key={role.id}
                onClick={() => setSelectedRoleId(role.id)}
                className={cn(
                  "w-full flex items-center gap-4 p-4 rounded-xl border text-left",
                  "transition-all duration-200 hover-lift",
                  "animate-fade-in-up",
                  isSelected
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border bg-card hover:border-primary/30"
                )}
                style={{ animationDelay: `${index * 0.05}s` }}
                data-testid={`radio-role-${role.id}`}
              >
                <div
                  className={cn(
                    "flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-200",
                    isSelected
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {isSelected ? (
                    <Check className="h-6 w-6" />
                  ) : (
                    <User className="h-6 w-6" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground text-lg">
                      {role.name}
                    </span>
                    {index === 0 && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        Lead
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                    <span>{role.lineCount} line{role.lineCount !== 1 ? "s" : ""}</span>
                    <span className="text-border">|</span>
                    <span>{linePercentage}% of script</span>
                  </div>
                  
                  <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        isSelected ? "bg-primary" : "bg-muted-foreground/30"
                      )}
                      style={{ width: `${linePercentage}%` }}
                    />
                  </div>
                </div>

                {!isSelected && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Volume2 className="h-4 w-4" />
                    <span className="text-xs">AI</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-4 border-t glass safe-bottom">
        <div className="space-y-3 animate-slide-up">
          {selectedRoleId && (
            <p className="text-center text-sm text-muted-foreground animate-fade-in">
              You'll read <span className="font-medium text-foreground">
                {roles.find(r => r.id === selectedRoleId)?.name}
              </span>'s lines. Everyone else speaks automatically.
            </p>
          )}
          <Button
            onClick={handleContinue}
            disabled={!selectedRoleId}
            size="lg"
            className={cn(
              "w-full h-14 text-base font-semibold rounded-xl transition-all duration-200",
              selectedRoleId && "animate-glow-pulse"
            )}
            data-testid="button-start-rehearsal"
          >
            {selectedRoleId ? "Start Rehearsing" : "Select a character"}
          </Button>
        </div>
      </div>
    </div>
  );
}
