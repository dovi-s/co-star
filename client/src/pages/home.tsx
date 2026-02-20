import { useState, useEffect, useRef } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { ScriptImport } from "@/components/script-import";
import { RoleSelector } from "@/components/role-selector";
import { Logo } from "@/components/logo";
import { useSessionContext } from "@/context/session-context";
import { Button } from "@/components/ui/button";
import { Users, Repeat, Clock, Volume2 } from "lucide-react";

type Step = "import" | "role-select";

interface HomePageProps {
  onSessionReady: () => void;
  onMultiplayer?: () => void;
  onTableRead?: () => void;
}

export function HomePage({ onSessionReady, onMultiplayer, onTableRead }: HomePageProps) {
  const { session, createSession, createSessionFromParsed, setUserRole, isLoading, error, clearError } = useSessionContext();
  const hasExistingSession = session && session.scenes?.length > 0 && !session.userRoleId;
  const [step, setStep] = useState<Step>(hasExistingSession ? "role-select" : "import");
  const userWentBackRef = useRef(false);
  const lastRawScriptRef = useRef("");

  useEffect(() => {
    if (session && session.scenes?.length > 0 && !session.userRoleId && !userWentBackRef.current) {
      setStep("role-select");
    }
  }, [session]);

  useEffect(() => {
    if (session && session.userRoleId) {
      onSessionReady();
    }
  }, [session, onSessionReady]);

  const handleImport = async (name: string, rawScript: string) => {
    userWentBackRef.current = false;
    lastRawScriptRef.current = rawScript;
    const newSession = await createSession(name, rawScript);
    if (newSession) {
      setStep("role-select");
    }
  };

  const handleImportParsed = (name: string, parsed: { roles: any[], scenes: any[] }, rawScript?: string) => {
    userWentBackRef.current = false;
    if (rawScript) lastRawScriptRef.current = rawScript;
    const newSession = createSessionFromParsed(name, parsed);
    if (newSession) {
      console.log('[Home] Session created, advancing to role-select');
      setStep("role-select");
    }
  };

  const handleRoleSelect = (roleId: string) => {
    setUserRole(roleId);
  };

  const handleBackToImport = () => {
    userWentBackRef.current = true;
    setStep("import");
  };

  if (step === "role-select" && session) {
    return (
      <RoleSelector
        roles={session.roles}
        onRoleSelect={handleRoleSelect}
        onBack={handleBackToImport}
        onTableRead={onTableRead}
        scriptName={session.name}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background" data-testid="home-page">
      <header className="flex items-center justify-between px-4 py-3 sticky top-0 z-50 glass-surface safe-top rounded-none">
        <Logo size="xs" animated showWordmark />
        <div className="flex items-center gap-2">
          {onMultiplayer && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onMultiplayer}
              title="Table Read"
              data-testid="button-multiplayer"
            >
              <Users className="h-5 w-5" />
            </Button>
          )}
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 flex flex-col onboarding-glow relative">
        <div className="absolute top-1/3 left-1/3 w-[40%] h-[40%] rounded-full pointer-events-none z-0 opacity-60"
          style={{
            background: 'radial-gradient(ellipse at 50% 50%, hsl(28 35% 54% / 0.10) 0%, hsl(47 96% 53% / 0.06) 40%, transparent 70%)',
            animation: 'spectrum-drift-1 16s ease-in-out infinite -3s',
          }}
        />
        <div className="px-5 pt-10 pb-5 relative z-10">
          <div className="absolute -top-6 left-0 right-0 h-40 bg-gradient-to-b from-primary/[0.06] via-primary/[0.02] to-transparent pointer-events-none" />
          <h1 className="text-2xl font-semibold text-foreground relative tracking-tight">
            Your on demand scene partner.
          </h1>
          <p className="text-muted-foreground text-sm mt-2 relative leading-relaxed">
            Paste a script. Pick your role. Start rehearsing.
          </p>
          <div className="flex items-center gap-4 mt-4 relative" data-testid="value-props">
            <div className="flex items-center gap-1.5 text-muted-foreground/50" data-testid="value-prop-unlimited-takes">
              <Repeat className="h-3 w-3" />
              <span className="text-[11px]">Unlimited takes</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground/50" data-testid="value-prop-always-available">
              <Clock className="h-3 w-3" />
              <span className="text-[11px]">Always available</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground/50" data-testid="value-prop-zero-judgment">
              <Volume2 className="h-3 w-3" />
              <span className="text-[11px]">Zero judgment</span>
            </div>
          </div>
        </div>

        <div className="flex-1 px-4 pb-6 relative z-10">
          <ScriptImport 
            onImport={handleImport}
            onImportParsed={handleImportParsed}
            isLoading={isLoading} 
            error={error}
            onClearError={clearError}
            initialScript={lastRawScriptRef.current || ''}
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
