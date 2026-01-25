import { useState, useEffect, useRef, useCallback } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { ScriptImport } from "@/components/script-import";
import { RoleSelector } from "@/components/role-selector";
import { Logo } from "@/components/logo";
import { useSession } from "@/hooks/use-session";
import { cn } from "@/lib/utils";

type Step = "import" | "role-select";
type Direction = "forward" | "back";

interface HomePageProps {
  onSessionReady: () => void;
}

export function HomePage({ onSessionReady }: HomePageProps) {
  const { session, createSession, setUserRole, isLoading, error } = useSession();
  const [currentStep, setCurrentStep] = useState<Step>("import");
  const [nextStep, setNextStep] = useState<Step | null>(null);
  const [direction, setDirection] = useState<Direction>("forward");
  const [animationPhase, setAnimationPhase] = useState<"idle" | "ready" | "animating">("idle");
  const transitionLock = useRef(false);

  // If we have a session with script but no role selected, go to role selection
  useEffect(() => {
    if (session && session.scenes.length > 0 && !session.userRoleId) {
      setCurrentStep("role-select");
    }
  }, []);

  useEffect(() => {
    if (session && session.userRoleId) {
      onSessionReady();
    }
  }, [session, onSessionReady]);

  const transitionTo = useCallback((newStep: Step, dir: Direction) => {
    if (transitionLock.current || newStep === currentStep) return;
    
    transitionLock.current = true;
    setDirection(dir);
    setNextStep(newStep);
    setAnimationPhase("ready");
    
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setAnimationPhase("animating");
      });
    });
  }, [currentStep]);

  // Handle transition completion
  useEffect(() => {
    if (animationPhase !== "animating" || !nextStep) return;
    
    const timer = setTimeout(() => {
      setCurrentStep(nextStep);
      setNextStep(null);
      setAnimationPhase("idle");
      transitionLock.current = false;
    }, 300);
    
    return () => clearTimeout(timer);
  }, [animationPhase, nextStep]);

  const handleImport = (name: string, rawScript: string) => {
    const newSession = createSession(name, rawScript);
    if (newSession) {
      transitionTo("role-select", "forward");
    }
  };

  const handleRoleSelect = (roleId: string) => {
    setUserRole(roleId);
  };

  const handleBackToImport = () => {
    transitionTo("import", "back");
  };

  const getStepClasses = (isCurrentStep: boolean) => {
    if (animationPhase === "idle") {
      return isCurrentStep 
        ? "opacity-100 translate-x-0 scale-100" 
        : "opacity-0 pointer-events-none";
    }
    
    if (isCurrentStep) {
      if (animationPhase === "animating") {
        return direction === "forward"
          ? "opacity-0 -translate-x-8 scale-[0.98]"
          : "opacity-0 translate-x-8 scale-[0.98]";
      }
      return "opacity-100 translate-x-0 scale-100";
    } else {
      if (animationPhase === "animating") {
        return "opacity-100 translate-x-0 scale-100";
      }
      return direction === "forward"
        ? "opacity-0 translate-x-8 scale-[0.98]"
        : "opacity-0 -translate-x-8 scale-[0.98]";
    }
  };

  const renderImportStep = () => (
    <div 
      className="min-h-screen flex flex-col bg-background"
      data-testid="home-page"
    >
      <header className="flex items-center justify-between px-5 py-4 sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border/40 safe-top animate-fade-in">
        <Logo size="sm" animated showWordmark />
        <ThemeToggle />
      </header>

      <main className="flex-1 flex flex-col">
        <div className="px-5 pt-10 pb-5 animate-fade-in-up relative">
          <div className="absolute -top-6 left-0 right-0 h-32 bg-gradient-to-b from-primary/[0.07] via-primary/[0.03] to-transparent pointer-events-none" />
          <h1 className="text-2xl font-semibold text-foreground relative tracking-tight">
            Rehearse with AI
          </h1>
          <p className="text-muted-foreground text-sm mt-2 relative leading-relaxed">
            Paste a script. Pick your role. Start rehearsing.
          </p>
        </div>

        <div className="flex-1 px-4 pb-6 animate-fade-in-up stagger-1">
          <ScriptImport 
            onImport={handleImport} 
            isLoading={isLoading} 
            error={error}
            initialScript={session?.scenes.map(s => 
              s.lines.map(l => `${l.roleName}: ${l.direction ? `[${l.direction}] ` : ''}${l.text}`).join('\n')
            ).join('\n\n') || ''}
          />
        </div>
      </main>

      <footer className="px-5 py-6 pb-8 border-t border-border/40 safe-bottom animate-fade-in stagger-3">
        <p className="text-[11px] text-muted-foreground/60 text-center">
          All data stays on your device.
        </p>
      </footer>
    </div>
  );

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Current step */}
      <div
        className={cn(
          "absolute inset-0",
          "transition-all duration-300 ease-out",
          getStepClasses(true)
        )}
      >
        {currentStep === "import" 
          ? renderImportStep()
          : session && (
              <RoleSelector 
                roles={session.roles} 
                onRoleSelect={handleRoleSelect} 
                onBack={handleBackToImport}
                scriptName={session.name}
              />
            )
        }
      </div>
      
      {/* Next step (during transition) */}
      {nextStep && (
        <div
          className={cn(
            "absolute inset-0",
            "transition-all duration-300 ease-out",
            getStepClasses(false)
          )}
        >
          {nextStep === "import" 
            ? renderImportStep()
            : session && (
                <RoleSelector 
                  roles={session.roles} 
                  onRoleSelect={handleRoleSelect} 
                  onBack={handleBackToImport}
                  scriptName={session.name}
                />
              )
          }
        </div>
      )}
    </div>
  );
}
