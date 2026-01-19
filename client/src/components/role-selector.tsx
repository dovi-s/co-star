import { useState } from "react";
import { Check, User, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { SmartCastBadge } from "@/components/smart-cast-badge";
import type { Role } from "@shared/schema";
import { cn } from "@/lib/utils";

interface RoleSelectorProps {
  roles: Role[];
  onRoleSelect: (roleId: string) => void;
  onBack: () => void;
}

export function RoleSelector({ roles, onRoleSelect, onBack }: RoleSelectorProps) {
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(
    roles.length === 1 ? roles[0].id : null
  );

  const sortedRoles = [...roles].sort((a, b) => b.lineCount - a.lineCount);

  return (
    <div className="flex flex-col h-full" data-testid="role-selector">
      <div className="flex-1 flex flex-col gap-6 px-4 py-6">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-2">
            <Users className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Pick Your Role</h1>
          <p className="text-muted-foreground text-sm max-w-[280px] mx-auto">
            Select the character you'll be reading. Everyone else will be auto-cast with natural voices.
          </p>
          <div className="flex justify-center">
            <SmartCastBadge />
          </div>
        </div>

        <RadioGroup
          value={selectedRoleId ?? ""}
          onValueChange={setSelectedRoleId}
          className="grid gap-3"
        >
          {sortedRoles.map((role) => (
            <Label
              key={role.id}
              htmlFor={role.id}
              className={cn(
                "flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-all",
                "hover-elevate active-elevate-2",
                selectedRoleId === role.id
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card"
              )}
              data-testid={`radio-role-${role.id}`}
            >
              <RadioGroupItem value={role.id} id={role.id} className="sr-only" />
              
              <div
                className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-full transition-colors",
                  selectedRoleId === role.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {selectedRoleId === role.id ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <User className="h-5 w-5" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="font-semibold text-foreground">{role.name}</div>
                <div className="text-sm text-muted-foreground">
                  {role.lineCount} line{role.lineCount !== 1 ? "s" : ""}
                </div>
              </div>
            </Label>
          ))}
        </RadioGroup>
      </div>

      <div className="p-4 border-t bg-background/80 backdrop-blur-sm space-y-3">
        <Button
          onClick={() => selectedRoleId && onRoleSelect(selectedRoleId)}
          disabled={!selectedRoleId}
          className="w-full h-12 text-base font-semibold"
          data-testid="button-start-rehearsal"
        >
          Start Rehearsal
        </Button>
        <Button
          variant="ghost"
          onClick={onBack}
          className="w-full"
          data-testid="button-back-to-import"
        >
          Back to Script
        </Button>
      </div>
    </div>
  );
}
