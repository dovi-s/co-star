import { useState, useEffect } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { ScriptImport } from "@/components/script-import";
import { RoleSelector } from "@/components/role-selector";
import { Logo } from "@/components/logo";
import { useSession } from "@/hooks/use-session";

type Step = "import" | "role-select";

interface HomePageProps {
  onSessionReady: () => void;
}

export function HomePage({ onSessionReady }: HomePageProps) {
  const { session, createSession, setUserRole, isLoading, error } = useSession();
  const [step, setStep] = useState<Step>(() => {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem("castmate-session");
      if (stored) {
        try {
          const s = JSON.parse(stored);
          if (s && s.scenes?.length > 0 && !s.userRoleId) {
            return "role-select";
          }
        } catch {}
      }
    }
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
  };

  const handleBackToImport = () => {
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
    <div className="min-h-screen flex flex-col bg-background" data-testid="home-page">
      <header className="flex items-center justify-between px-5 py-4 sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border/40 safe-top">
        <Logo size="sm" animated showWordmark />
        <ThemeToggle />
      </header>

      <main className="flex-1 flex flex-col">
        <div className="px-5 pt-10 pb-5 relative">
          <div className="absolute -top-6 left-0 right-0 h-32 bg-gradient-to-b from-primary/[0.07] via-primary/[0.03] to-transparent pointer-events-none" />
          <h1 className="text-2xl font-semibold text-foreground relative tracking-tight">
            Rehearse with AI
          </h1>
          <p className="text-muted-foreground text-sm mt-2 relative leading-relaxed">
            Paste a script. Pick your role. Start rehearsing.
          </p>
        </div>

        <div className="flex-1 px-4 pb-6">
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

      <footer className="px-5 py-6 pb-8 border-t border-border/40 safe-bottom">
        <p className="text-[11px] text-muted-foreground/60 text-center">
          All data stays on your device.
        </p>
      </footer>
    </div>
  );
}
