import { useState, useEffect } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { ScriptImport } from "@/components/script-import";
import { RoleSelector } from "@/components/role-selector";
import { useSession } from "@/hooks/use-session";
import { Mic, Theater, Lock, Sparkles, Heart, Star, Zap } from "lucide-react";

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
  const [showWelcome, setShowWelcome] = useState(true);

  useEffect(() => {
    if (session && session.userRoleId) {
      onSessionReady();
    }
  }, [session, onSessionReady]);

  useEffect(() => {
    const timer = setTimeout(() => setShowWelcome(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleImport = (name: string, rawScript: string) => {
    const newSession = createSession(name, rawScript);
    if (newSession) {
      setIsAnimating(true);
      setTimeout(() => {
        setStep("role-select");
        setIsAnimating(false);
      }, 400);
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
      <div className={`transition-all duration-500 ${isAnimating ? "opacity-0 scale-95" : "opacity-100 scale-100"}`}>
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
      className={`min-h-screen flex flex-col transition-all duration-500 ${isAnimating ? "opacity-0 scale-95" : "opacity-100 scale-100"}`} 
      data-testid="home-page"
    >
      <header className="flex items-center justify-between px-4 py-3 border-b glass sticky top-0 z-50 safe-top">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary via-primary to-accent flex items-center justify-center shadow-md">
              <Theater className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-background animate-pulse" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight">CastMate</h1>
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">Studio</p>
          </div>
        </div>
        <ThemeToggle />
      </header>

      <main className="flex-1 flex flex-col">
        <div className="px-6 py-8 text-center space-y-6 bg-gradient-to-b from-primary/8 via-accent/5 to-transparent relative overflow-hidden">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-4 left-8 w-2 h-2 rounded-full bg-primary/20 animate-float" style={{ animationDelay: '0s' }} />
            <div className="absolute top-12 right-12 w-1.5 h-1.5 rounded-full bg-accent/30 animate-float" style={{ animationDelay: '0.5s' }} />
            <div className="absolute bottom-8 left-16 w-1 h-1 rounded-full bg-primary/15 animate-float" style={{ animationDelay: '1s' }} />
            <div className="absolute top-20 left-1/3 w-1.5 h-1.5 rounded-full bg-accent/20 animate-float" style={{ animationDelay: '1.5s' }} />
          </div>
          
          <div className="relative animate-fade-in-up">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br from-primary/20 via-primary/10 to-accent/15 mb-2 relative">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/10 to-transparent animate-pulse" style={{ animationDuration: '3s' }} />
              <Mic className="h-12 w-12 text-primary relative z-10" />
            </div>
          </div>
          
          <div className="space-y-4 animate-fade-in-up stagger-1">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-primary uppercase tracking-widest">Welcome to</p>
              <h2 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground to-muted-foreground bg-clip-text">
                Your Private Stage
              </h2>
            </div>
            <p className="text-muted-foreground text-base max-w-[340px] mx-auto leading-relaxed">
              Rehearse with AI scene partners who read with <em>real emotion</em>. 
              No judgment, no scheduling, no limits.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-1 animate-fade-in-up stagger-2">
            <FeaturePill icon={<Zap className="h-3 w-3" />} label="Instant Setup" />
            <FeaturePill icon={<Sparkles className="h-3 w-3" />} label="Smart Voices" />
            <FeaturePill icon={<Lock className="h-3 w-3" />} label="100% Private" />
          </div>
        </div>

        <div className="flex-1 px-4 py-6 animate-fade-in-up stagger-3">
          <ScriptImport onImport={handleImport} isLoading={isLoading} error={error} />
        </div>
      </main>

      <footer className="px-4 py-4 text-center border-t safe-bottom">
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" />
            <span>Your scripts never leave this device</span>
          </div>
          <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground/60">
            <span>Made with</span>
            <Heart className="h-2.5 w-2.5 text-red-500/60" />
            <span>for actors everywhere</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeaturePill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card/80 border text-xs font-medium text-muted-foreground backdrop-blur-sm">
      <span className="text-primary">{icon}</span>
      {label}
    </div>
  );
}
