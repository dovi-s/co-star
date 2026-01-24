import { useState } from "react";
import { Check, User, ChevronLeft, Volume2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  const selectedRole = roles.find(r => r.id === selectedRoleId);

  const handleContinue = () => {
    if (selectedRoleId) {
      onRoleSelect(selectedRoleId);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background" data-testid="role-selector">
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
          <h1 className="font-medium text-sm truncate text-foreground">
            {scriptName || "Your Script"}
          </h1>
          <p className="text-[11px] text-muted-foreground">
            {roles.length} characters
          </p>
        </div>
      </header>

      <div className="flex-1 flex flex-col">
        <div className="px-5 pt-6 pb-4">
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
                onClick={() => setSelectedRoleId(role.id)}
                className={cn(
                  "w-full flex items-center gap-3 p-4 text-left cursor-pointer",
                  "transition-all duration-200 hover-elevate",
                  isSelected && "ring-2 ring-foreground"
                )}
                data-testid={`card-role-${role.name}`}
              >
                <div
                  className={cn(
                    "flex items-center justify-center w-9 h-9 rounded-md transition-all",
                    isSelected
                      ? "bg-foreground text-background"
                      : "bg-muted"
                  )}
                >
                  {isSelected ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <User className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-foreground">
                      {role.name}
                    </span>
                    {isLead && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-muted text-muted-foreground">
                        Lead
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {role.lineCount} lines ({linePercentage}%)
                  </div>
                </div>

                {!isSelected && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Volume2 className="h-3.5 w-3.5" />
                    <span className="text-[10px] font-medium">AI</span>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      <div className="p-4 border-t border-border/40 bg-background safe-bottom">
        <Button
          onClick={handleContinue}
          disabled={!selectedRoleId}
          size="lg"
          className="w-full gap-2"
          data-testid="button-start-rehearsal"
        >
          {selectedRoleId ? (
            <>
              Start rehearsing
              <ArrowRight className="h-4 w-4" />
            </>
          ) : (
            "Select a role"
          )}
        </Button>
        
        {selectedRole && (
          <p className="text-center text-xs text-muted-foreground mt-2">
            Playing as {selectedRole.name}
          </p>
        )}
      </div>
    </div>
  );
}
