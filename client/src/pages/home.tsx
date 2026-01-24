import { useState, useEffect } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { ScriptImport } from "@/components/script-import";
import { RoleSelector } from "@/components/role-selector";
import { Logo } from "@/components/logo";
import { useSession } from "@/hooks/use-session";
import { cn } from "@/lib/utils";

type Step = "import" | "role-select";

interface HomePageProps {
  onSessionReady: () => void;
}

export function HomePage({ onSessionReady }: HomePageProps) {
  const { session, createSession, setUserRole, clearSession, isLoading, error } = useSession();
  const [step, setStep] = useState<Step>("import");
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (session && !session.userRoleId) {
      clearSession();
    }
  }, []);

  useEffect(() => {
    if (session && session.userRoleId) {
      onSessionReady();
    }
  }, [session, onSessionReady]);

  const handleImport = (name: string, rawScript: string) => {
    const newSession = createSession(name, rawScript);
    if (newSession) {
      setIsTransitioning(true);
      setTimeout(() => {
        setStep("role-select");
        setIsTransitioning(false);
      }, 200);
    }
  };

  const handleRoleSelect = (roleId: string) => {
    // Just set the role - the useEffect watching session.userRoleId will trigger navigation
    setUserRole(roleId);
  };

  const handleBackToImport = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      clearSession();
      setStep("import");
      setIsTransitioning(false);
    }, 200);
  };

  if (step === "role-select" && session) {
    return (
      <div className={cn(
        "transition-all duration-200",
        isTransitioning ? "opacity-0 scale-98" : "opacity-100 scale-100"
      )}>
        <RoleSelector 
          roles={session.roles} 
          onRoleSelect={handleRoleSelect} 
          onBack={handleBackToImport}
          scriptName={session.name}
        />
      </div>
    );
  }

  return (
    <div 
      className={cn(
        "min-h-screen flex flex-col transition-all duration-200",
        isTransitioning ? "opacity-0 scale-98" : "opacity-100 scale-100"
      )}
      data-testid="home-page"
    >
      <header className="flex items-center justify-between px-5 py-4 sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border/40 safe-top animate-fade-in">
        <Logo size="sm" animated showWordmark />
        <ThemeToggle />
      </header>

      <main className="flex-1 flex flex-col">
        <div className="px-5 pt-8 pb-4 animate-fade-in-up">
          <h1 className="text-xl font-medium text-foreground">
            Rehearse with AI
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Paste a script. Pick your role. Start rehearsing.
          </p>
        </div>

        <div className="flex-1 px-4 pb-6 animate-fade-in-up stagger-1">
          <ScriptImport onImport={handleImport} isLoading={isLoading} error={error} />
        </div>
      </main>

      <footer className="px-5 py-4 border-t border-border/40 safe-bottom animate-fade-in stagger-3">
        <p className="text-[11px] text-muted-foreground/60 text-center">
          All data stays on your device.
        </p>
      </footer>
    </div>
  );
}
