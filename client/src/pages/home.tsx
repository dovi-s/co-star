import { useState, useEffect } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { ScriptImport } from "@/components/script-import";
import { RoleSelector } from "@/components/role-selector";
import { useSession } from "@/hooks/use-session";
import { Logo, LogoIcon } from "@/components/logo";
import { Lock, Sparkles, Heart, Zap, AudioLines, Brain } from "lucide-react";

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
        <Logo size="md" showWordmark />
        <ThemeToggle />
      </header>

      <main className="flex-1 flex flex-col">
        <div className="px-6 py-10 text-center space-y-6 bg-gradient-to-b from-slate-900/5 via-primary/5 to-transparent dark:from-slate-800/20 dark:via-primary/10 relative overflow-hidden">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-6 left-10 w-0.5 h-8 bg-primary/20 rounded-full" />
            <div className="absolute top-10 left-14 w-0.5 h-12 bg-primary/30 rounded-full" />
            <div className="absolute top-8 left-18 w-0.5 h-6 bg-primary/15 rounded-full" />
            <div className="absolute top-6 right-10 w-0.5 h-10 bg-primary/25 rounded-full" />
            <div className="absolute top-12 right-14 w-0.5 h-8 bg-primary/20 rounded-full" />
            <div className="absolute top-8 right-18 w-0.5 h-5 bg-primary/15 rounded-full" />
          </div>
          
          <div className="relative animate-fade-in-up">
            <div className="w-24 h-24 mx-auto rounded-2xl bg-slate-800 dark:bg-slate-900 shadow-2xl shadow-slate-900/30 p-4">
              <LogoIcon className="text-white" />
            </div>
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-green-500/90 text-[9px] font-bold text-white uppercase tracking-wider">
              Ready
            </div>
          </div>
          
          <div className="space-y-4 animate-fade-in-up stagger-1">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
                <Brain className="h-3 w-3 text-primary" />
                <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">Scene IQ Technology</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
                Your Intelligent Scene Partner
              </h2>
            </div>
            <p className="text-muted-foreground text-base max-w-[340px] mx-auto leading-relaxed">
              Paste your script. We analyze every line, detect emotion, and deliver your cues with <em>natural timing and prosody</em>.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-1 animate-fade-in-up stagger-2">
            <FeaturePill icon={<Zap className="h-3 w-3" />} label="Zero Setup" />
            <FeaturePill icon={<AudioLines className="h-3 w-3" />} label="Voice-First" />
            <FeaturePill icon={<Lock className="h-3 w-3" />} label="Private by Default" />
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
            <span>for actors</span>
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
