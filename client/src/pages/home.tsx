import { useState, useEffect } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { ScriptImport } from "@/components/script-import";
import { RoleSelector } from "@/components/role-selector";
import { SpotMascot } from "@/components/spot-mascot";
import { useSession } from "@/hooks/use-session";
import { Lock, Sparkles, Zap } from "lucide-react";

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
      {/* Animated header with Spot */}
      <header className="flex items-center justify-between px-5 py-4 sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border/40 safe-top animate-fade-in">
        <div className="flex items-center gap-2.5">
          <SpotMascot size="xs" mood="happy" />
          <span className="font-bold text-base bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
            CastMate
          </span>
        </div>
        <ThemeToggle />
      </header>

      <main className="flex-1 flex flex-col">
        {/* Hero with personality */}
        <div className="px-5 pt-8 pb-6 space-y-5 animate-fade-in-up">
          {/* Spot greeting */}
          <div className="flex items-start gap-4">
            <SpotMascot size="lg" mood="waving" className="flex-shrink-0" />
            <div className="space-y-2 pt-2">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Your AI Scene Partner
              </h1>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Paste a script, pick your role, and rehearse with lifelike voices. It's like having a drama partner in your pocket.
              </p>
            </div>
          </div>

          {/* Feature pills - fun and bouncy */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 text-xs font-medium text-amber-700 dark:text-amber-400 animate-fade-in stagger-1">
              <Zap className="h-3 w-3" />
              <span>Instant Setup</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/20 text-xs font-medium text-violet-700 dark:text-violet-400 animate-fade-in stagger-2">
              <Sparkles className="h-3 w-3" />
              <span>Natural Voices</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-emerald-500/10 to-green-500/10 border border-emerald-500/20 text-xs font-medium text-emerald-700 dark:text-emerald-400 animate-fade-in stagger-3">
              <Lock className="h-3 w-3" />
              <span>100% Private</span>
            </div>
          </div>
        </div>

        {/* Script import section */}
        <div className="flex-1 px-4 pb-6 animate-fade-in-up stagger-2">
          <ScriptImport onImport={handleImport} isLoading={isLoading} error={error} />
        </div>
      </main>

      {/* Fun footer */}
      <footer className="px-5 py-4 border-t border-border/40 safe-bottom animate-fade-in">
        <p className="text-[11px] text-muted-foreground/60 text-center">
          Your scripts never leave this device. Privacy first, always.
        </p>
      </footer>
    </div>
  );
}
