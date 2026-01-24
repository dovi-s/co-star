import { useState, useEffect } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { ScriptImport } from "@/components/script-import";
import { RoleSelector } from "@/components/role-selector";
import { useSession } from "@/hooks/use-session";
import { BrandLogo } from "@/components/brand-logo";
import { SpotMascot } from "@/components/spot-mascot";
import { Lock, Sparkles, Heart, Zap, AudioLines, Mic } from "lucide-react";

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
        <BrandLogo size="md" showWordmark />
        <ThemeToggle />
      </header>

      <main className="flex-1 flex flex-col">
        <div className="px-6 py-10 text-center space-y-6 bg-gradient-to-b from-amber-500/10 via-orange-500/5 to-transparent dark:from-amber-500/15 dark:via-orange-500/8 relative overflow-hidden">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-8 left-8 w-2 h-2 rounded-full bg-amber-400/30 animate-float" style={{ animationDelay: '0s' }} />
            <div className="absolute top-16 right-12 w-1.5 h-1.5 rounded-full bg-orange-400/40 animate-float" style={{ animationDelay: '0.5s' }} />
            <div className="absolute bottom-12 left-16 w-1 h-1 rounded-full bg-yellow-400/25 animate-float" style={{ animationDelay: '1s' }} />
          </div>
          
          <div className="relative animate-fade-in-up">
            <SpotMascot 
              mood={showWelcome ? "waving" : "happy"} 
              size="xl"
            />
          </div>
          
          <div className="space-y-4 animate-fade-in-up stagger-1">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-widest">
                Spot says: "Ready to rehearse?"
              </p>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
                Your Scene Partner Awaits
              </h2>
            </div>
            <p className="text-muted-foreground text-base max-w-[340px] mx-auto leading-relaxed">
              Paste your script and I'll bring every character to life with <em>emotion and perfect timing</em>.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-1 animate-fade-in-up stagger-2">
            <FeaturePill icon={<Zap className="h-3 w-3" />} label="Instant Setup" />
            <FeaturePill icon={<Mic className="h-3 w-3" />} label="Smart Voices" />
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
            <span>for actors by Spot</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeaturePill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card/60 border border-border/40 text-[11px] font-medium text-muted-foreground/90 backdrop-blur-sm shadow-sm">
      <span className="text-amber-600 dark:text-amber-400">{icon}</span>
      {label}
    </div>
  );
}
