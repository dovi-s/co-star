import { useState, useEffect } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { ScriptImport } from "@/components/script-import";
import { RoleSelector } from "@/components/role-selector";
import { useSession } from "@/hooks/use-session";
import { Mic, Sparkles, Shield, ChevronRight } from "lucide-react";

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
      }, 200);
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
    }, 200);
  };

  if (step === "role-select" && session) {
    return (
      <div className={isAnimating ? "opacity-0" : "animate-fade-in"}>
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
      className={`min-h-screen flex flex-col ${isAnimating ? "opacity-0" : ""}`} 
      data-testid="home-page"
    >
      <header className="flex items-center justify-between px-4 py-3 border-b glass sticky top-0 z-50 safe-top">
        <div className="flex items-center gap-3 animate-fade-in">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-sm">
              <Mic className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-accent border-2 border-background" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight">CastMate</h1>
            <p className="text-xs text-muted-foreground -mt-0.5">Rehearse on cue</p>
          </div>
        </div>
        <ThemeToggle />
      </header>

      <main className="flex-1 flex flex-col">
        <div className="px-6 py-10 text-center space-y-5 border-b bg-gradient-to-b from-primary/5 via-transparent to-transparent">
          <div className="animate-fade-in-up">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/15 to-accent/10 mb-4 animate-float">
              <Mic className="h-10 w-10 text-primary" />
            </div>
          </div>
          
          <div className="space-y-3 animate-fade-in-up stagger-1">
            <h2 className="text-3xl font-bold tracking-tight">
              Your AI Scene Partner
            </h2>
            <p className="text-muted-foreground text-base max-w-[320px] mx-auto leading-relaxed">
              Paste your script, pick your role, and start rehearsing with intelligent voices.
            </p>
          </div>

          <div className="flex items-center justify-center gap-4 pt-2 animate-fade-in-up stagger-2">
            <FeaturePill icon={<Sparkles className="h-3.5 w-3.5" />} text="Smart Cast" />
            <FeaturePill icon={<Mic className="h-3.5 w-3.5" />} text="Natural Voices" />
            <FeaturePill icon={<Shield className="h-3.5 w-3.5" />} text="Private" />
          </div>
        </div>

        <div className="flex-1 px-4 py-6 animate-fade-in-up stagger-3">
          <ScriptImport onImport={handleImport} isLoading={isLoading} error={error} />
        </div>
      </main>

      <footer className="px-4 py-4 text-center border-t safe-bottom animate-fade-in stagger-4">
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Shield className="h-3.5 w-3.5" />
          <span>Everything stays on your device</span>
        </div>
      </footer>
    </div>
  );
}

function FeaturePill({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border text-xs font-medium text-muted-foreground transition-smooth hover-lift">
      <span className="text-primary">{icon}</span>
      {text}
    </div>
  );
}
