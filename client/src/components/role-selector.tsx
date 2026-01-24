import { useState } from "react";
import { Check, User, ChevronLeft, Sparkles, Volume2, Star, Crown, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Role } from "@shared/schema";
import { SpotMascot } from "@/components/spot-mascot";
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
        <div className="px-6 py-8 text-center space-y-4 bg-gradient-to-b from-amber-500/10 via-orange-500/5 to-transparent dark:from-amber-500/15">
          <div className="animate-fade-in">
            <SpotMascot mood="encouraging" size="lg" />
          </div>
          
          <div className="space-y-2 animate-fade-in-up stagger-1">
            <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-widest">
              Spot asks:
            </p>
            <h2 className="text-2xl font-bold tracking-tight">
              Who Will You Be Tonight?
            </h2>
            <p className="text-muted-foreground text-sm max-w-[300px] mx-auto leading-relaxed">
              Choose who you'll be. Your scene partners will come to life with natural AI voices.
            </p>
          </div>
          
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 text-xs font-medium animate-fade-in-up stagger-2">
            <Sparkles className="h-3 w-3 text-amber-600 dark:text-amber-400" />
            <span className="text-foreground/90">Smart Cast</span>
            <span className="text-muted-foreground/70">auto-assigns voices</span>
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
                  "w-full flex items-center gap-4 p-4 rounded-2xl text-left",
                  "transition-all duration-300",
                  "animate-fade-in-up",
                  isSelected
                    ? "bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent border-2 border-amber-500/40 shadow-lg shadow-amber-500/10"
                    : "bg-card/60 border border-border/50 hover:border-amber-500/30 hover:bg-card"
                )}
                style={{ animationDelay: `${index * 0.08}s` }}
                data-testid={`card-role-${role.name}`}
              >
                <div
                  className={cn(
                    "relative flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-300",
                    isSelected
                      ? "bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/25"
                      : "bg-muted/60 text-muted-foreground"
                  )}
                >
                  {isSelected ? (
                    <Check className="h-6 w-6" />
                  ) : (
                    <User className="h-6 w-6" />
                  )}
                  {isLead && !isSelected && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-sm">
                      <Crown className="h-2.5 w-2.5 text-white" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-base">
                      {role.name}
                    </span>
                    {isLead && (
                      <span className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full bg-gradient-to-r from-yellow-400/20 to-amber-500/20 text-amber-700 dark:text-amber-300 font-semibold uppercase tracking-wide border border-amber-400/30">
                        <Star className="h-2 w-2 fill-current" />
                        Lead
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium">{role.lineCount} line{role.lineCount !== 1 ? "s" : ""}</span>
                    <span className="text-muted-foreground/40">•</span>
                    <span>{linePercentage}% of scene</span>
                  </div>
                  
                  <div className="mt-2 h-1.5 rounded-full bg-muted/40 overflow-hidden">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all duration-700 ease-out",
                        isSelected 
                          ? "bg-gradient-to-r from-amber-500 to-orange-500" 
                          : "bg-muted-foreground/15"
                      )}
                      style={{ 
                        width: `${linePercentage}%`,
                        transitionDelay: `${index * 0.05}s`
                      }}
                    />
                  </div>
                </div>

                {!isSelected && (
                  <div className="flex flex-col items-center gap-0.5 text-muted-foreground/50">
                    <Volume2 className="h-4 w-4" />
                    <span className="text-[9px] font-medium uppercase tracking-wide">AI</span>
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
          <button
            onClick={handleContinue}
            disabled={!selectedRoleId}
            className={cn(
              "w-full h-14 rounded-2xl font-semibold text-base flex items-center justify-center gap-2",
              "transition-all duration-300",
              selectedRoleId
                ? "bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/25 hover:shadow-xl hover:shadow-amber-500/30 active:scale-[0.98]"
                : "bg-muted/50 text-muted-foreground cursor-not-allowed"
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
          </button>
        </div>
      </div>
    </div>
  );
}
