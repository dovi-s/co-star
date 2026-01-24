import { useState, useEffect } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { ScriptImport } from "@/components/script-import";
import { RoleSelector } from "@/components/role-selector";
import { useSession } from "@/hooks/use-session";
import { Lock, Mic, Zap } from "lucide-react";

type Step = "import" | "role-select";

interface HomePageProps {
  onSessionReady: () => void;
}

export function HomePage({ onSessionReady }: HomePageProps) {
  const { session, createSession, setUserRole, clearSession, isLoading, error } = useSession();
  const [step, setStep] = useState<Step>(() => {
    if (session && !session.userRoleId) return "role-select";
    return "import";
  });
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (session && session.userRoleId) {
      onSessionReady();
    }
  }, [session, onSessionReady]);

  const handleImport = (name: string, rawScript: string) => {
    const newSession = createSession(name, rawScript);
    if (newSession) {
      setIsAnimating(true);
      setTimeout(() => {
        setStep("role-select");
        setIsAnimating(false);
      }, 300);
    }
  };

  const handleRoleSelect = (roleId: string) => {
    setUserRole(roleId);
    onSessionReady();
  };

  const handleBackToImport = () => {
    setIsAnimating(true);
    setTimeout(() => {
      clearSession();
      setStep("import");
      setIsAnimating(false);
    }, 300);
  };

  if (step === "role-select" && session) {
    return (
      <div className={`transition-all duration-300 ${isAnimating ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"}`}>
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
      className={`min-h-screen flex flex-col transition-all duration-300 ${isAnimating ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"}`} 
      data-testid="home-page"
    >
      {/* Minimal header */}
      <header className="flex items-center justify-between px-5 py-4 sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border/40 safe-top">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-foreground flex items-center justify-center">
            <Mic className="h-4 w-4 text-background" />
          </div>
          <span className="font-semibold text-sm">CastMate</span>
        </div>
        <ThemeToggle />
      </header>

      <main className="flex-1 flex flex-col">
        {/* Hero - clean and sophisticated */}
        <div className="px-5 pt-12 pb-8 space-y-4">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
              Rehearse with AI<br />scene partners
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-[320px]">
              Paste your script, pick your role, and start practicing. Every character gets a natural voice.
            </p>
          </div>

          {/* Feature indicators - minimal */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground/70">
            <div className="flex items-center gap-1.5">
              <Zap className="h-3 w-3" />
              <span>Instant</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Mic className="h-3 w-3" />
              <span>Natural voices</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Lock className="h-3 w-3" />
              <span>Private</span>
            </div>
          </div>
        </div>

        {/* Script import section */}
        <div className="flex-1 px-4 pb-6">
          <ScriptImport onImport={handleImport} isLoading={isLoading} error={error} />
        </div>
      </main>

      {/* Clean footer */}
      <footer className="px-5 py-4 border-t border-border/40 safe-bottom">
        <p className="text-[11px] text-muted-foreground/50 text-center">
          Your scripts stay on this device
        </p>
      </footer>
    </div>
  );
}
