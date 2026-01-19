import { useState, useEffect } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { ScriptImport } from "@/components/script-import";
import { RoleSelector } from "@/components/role-selector";
import { useSession } from "@/hooks/use-session";
import { FileText, Sparkles, Play, Shield } from "lucide-react";

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

  useEffect(() => {
    if (session && session.userRoleId) {
      onSessionReady();
    }
  }, [session, onSessionReady]);

  const handleImport = (name: string, rawScript: string) => {
    const newSession = createSession(name, rawScript);
    if (newSession) {
      setStep("role-select");
    }
  };

  const handleRoleSelect = (roleId: string) => {
    setUserRole(roleId);
    onSessionReady();
  };

  const handleBackToImport = () => {
    clearSession();
    setStep("import");
  };

  if (step === "role-select" && session) {
    return <RoleSelector roles={session.roles} onRoleSelect={handleRoleSelect} onBack={handleBackToImport} />;
  }

  return (
    <div className="min-h-screen flex flex-col" data-testid="home-page">
      <header className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-lg">C</span>
          </div>
          <div>
            <h1 className="font-bold text-lg">CastMate Studio</h1>
            <p className="text-xs text-muted-foreground -mt-0.5">Rehearse on cue</p>
          </div>
        </div>
        <ThemeToggle />
      </header>

      <main className="flex-1 flex flex-col">
        <div className="px-4 py-8 text-center space-y-4 border-b bg-gradient-to-b from-primary/5 to-transparent">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 mb-2">
            <FileText className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-2xl font-bold">Import Your Script</h2>
          <p className="text-muted-foreground text-sm max-w-[300px] mx-auto">
            Paste or upload your sides. Pick your role. Start rehearsing with natural AI scene partners.
          </p>

          <div className="flex items-center justify-center gap-6 pt-4">
            <Feature icon={<Sparkles className="h-4 w-4" />} text="Smart Cast" />
            <Feature icon={<Play className="h-4 w-4" />} text="Natural Voices" />
            <Feature icon={<Shield className="h-4 w-4" />} text="Private" />
          </div>
        </div>

        <div className="flex-1 px-4 py-6">
          <ScriptImport onImport={handleImport} isLoading={isLoading} error={error} />
        </div>
      </main>

      <footer className="px-4 py-4 text-center text-xs text-muted-foreground border-t">
        Your scripts stay on your device. Nothing uploads unless you share.
      </footer>
    </div>
  );
}

function Feature({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="text-primary">{icon}</span>
      {text}
    </div>
  );
}
