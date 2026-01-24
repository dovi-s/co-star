import { useState } from "react";
import { Check, User, ChevronLeft, Sparkles, Volume2, Star, Crown, Play, AudioLines } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Role } from "@shared/schema";
import { LogoIcon } from "@/components/logo";
import { cn } from "@/lib/utils";

interface RoleSelectorProps {
  roles: Role[];
  onRoleSelect: (roleId: string) => void;
  onBack: () => void;
  scriptName?: string;
}

const ROLE_DESCRIPTIONS = [
  "The spotlight's waiting for you",
  "This is your moment",
  "Time to become the character",
  "Own this role",
  "Make it yours",
];

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
      setTimeout(() => onRoleSelect(selectedRoleId), 400);
    }
  };

  return (
    <div 
      className={cn(
        "min-h-screen flex flex-col bg-background transition-all duration-500",
        isExiting && "opacity-0 scale-95"
      )} 
      data-testid="role-selector"
    >
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
            Cast of {roles.length} • {totalLines} lines total
          </p>
        </div>
      </header>

      <div className="flex-1 flex flex-col">
        <div className="px-6 py-8 text-center space-y-4 bg-gradient-to-b from-slate-900/5 via-primary/5 to-transparent dark:from-slate-800/20">
          <div className="animate-fade-in">
            <div className="w-16 h-16 mx-auto rounded-xl bg-slate-800 dark:bg-slate-900 shadow-lg p-3">
              <LogoIcon className="text-white" />
            </div>
          </div>
          
          <div className="space-y-2 animate-fade-in-up stagger-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20">
              <AudioLines className="h-2.5 w-2.5 text-primary" />
              <span className="text-[9px] font-semibold text-primary uppercase tracking-wider">Scene IQ Ready</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight">
              Select Your Role
            </h2>
            <p className="text-muted-foreground text-sm max-w-[300px] mx-auto leading-relaxed">
              Choose who you'll be. Your scene partners will come to life with natural AI voices.
            </p>
          </div>
          
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 text-xs font-medium animate-fade-in-up stagger-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-foreground">Smart Cast</span>
            <span className="text-muted-foreground">auto-assigns voices</span>
          </div>
        </div>

        <div className="flex-1 px-4 pb-4 space-y-3 overflow-y-auto custom-scrollbar">
          {sortedRoles.map((role, index) => {
            const isSelected = selectedRoleId === role.id;
            const linePercentage = Math.round((role.lineCount / totalLines) * 100);
            const isLead = index === 0;
            
            return (
              <button
                key={role.id}
                onClick={() => setSelectedRoleId(role.id)}
                className={cn(
                  "w-full flex items-center gap-4 p-4 rounded-2xl border text-left",
                  "transition-all duration-300 hover-lift",
                  "animate-fade-in-up",
                  isSelected
                    ? "border-primary bg-gradient-to-br from-primary/8 to-accent/5 shadow-md shadow-primary/10"
                    : "border-border bg-card hover:border-primary/30"
                )}
                style={{ animationDelay: `${index * 0.08}s` }}
                data-testid={`card-role-${role.name}`}
              >
                <div
                  className={cn(
                    "relative flex items-center justify-center w-14 h-14 rounded-xl transition-all duration-300",
                    isSelected
                      ? "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {isSelected ? (
                    <Check className="h-7 w-7" />
                  ) : (
                    <User className="h-7 w-7" />
                  )}
                  {isLead && !isSelected && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-yellow-500 flex items-center justify-center shadow">
                      <Crown className="h-2.5 w-2.5 text-white" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn(
                      "font-bold text-lg transition-colors",
                      isSelected ? "text-foreground" : "text-foreground"
                    )}>
                      {role.name}
                    </span>
                    {isLead && (
                      <Badge variant="secondary" className="text-[10px] px-2 py-0 gap-1 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20">
                        <Star className="h-2 w-2 fill-current" />
                        Lead
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="font-medium">{role.lineCount} line{role.lineCount !== 1 ? "s" : ""}</span>
                    <span className="w-1 h-1 rounded-full bg-border" />
                    <span>{linePercentage}% of scene</span>
                  </div>
                  
                  <div className="mt-2.5 h-2 rounded-full bg-muted/50 overflow-hidden">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all duration-700 ease-out",
                        isSelected 
                          ? "bg-gradient-to-r from-primary to-primary/70" 
                          : "bg-muted-foreground/20"
                      )}
                      style={{ 
                        width: `${linePercentage}%`,
                        transitionDelay: `${index * 0.05}s`
                      }}
                    />
                  </div>
                </div>

                {!isSelected && (
                  <div className="flex flex-col items-center gap-0.5 text-muted-foreground/60">
                    <Volume2 className="h-5 w-5" />
                    <span className="text-[10px] font-medium uppercase tracking-wide">AI</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-4 border-t glass safe-bottom">
        <div className="space-y-3">
          {selectedRole && (
            <div className="text-center space-y-1 animate-fade-in">
              <p className="text-sm text-muted-foreground">
                Playing as <span className="font-semibold text-foreground">{selectedRole.name}</span>
              </p>
              <p className="text-xs text-muted-foreground/70">
                {ROLE_DESCRIPTIONS[Math.floor(Math.random() * ROLE_DESCRIPTIONS.length)]}
              </p>
            </div>
          )}
          <Button
            onClick={handleContinue}
            disabled={!selectedRoleId}
            size="lg"
            className={cn(
              "w-full h-14 text-base font-semibold rounded-xl gap-2 transition-all duration-300",
              selectedRoleId && "shadow-lg shadow-primary/25"
            )}
            data-testid="button-start-rehearsal"
          >
            {selectedRoleId ? (
              <>
                <Play className="h-5 w-5" />
                Enter the Scene
              </>
            ) : (
              "Choose your character"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
