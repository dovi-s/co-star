import { useState, useEffect } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { ScriptImport } from "@/components/script-import";
import { RoleSelector } from "@/components/role-selector";
import { useSession } from "@/hooks/use-session";

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
    return (
      <RoleSelector 
        roles={session.roles} 
        onRoleSelect={handleRoleSelect} 
        onBack={handleBackToImport}
        scriptName={session.name}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col" data-testid="home-page">
      <header className="flex items-center justify-between px-5 py-4 sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border/40 safe-top">
        <span className="font-semibold text-base text-foreground">
          CastMate
        </span>
        <ThemeToggle />
      </header>

      <main className="flex-1 flex flex-col">
        <div className="px-5 pt-10 pb-8 space-y-3">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Rehearse with AI
          </h1>
          <p className="text-muted-foreground text-sm">
            Paste your script, pick your role, start rehearsing.
          </p>
        </div>

        <div className="flex-1 px-4 pb-6">
          <ScriptImport onImport={handleImport} isLoading={isLoading} error={error} />
        </div>
      </main>

      <footer className="px-5 py-4 border-t border-border/40 safe-bottom">
        <p className="text-[11px] text-muted-foreground/60 text-center">
          All data stays on your device.
        </p>
      </footer>
    </div>
  );
}
