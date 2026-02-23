import { useState, useEffect, useRef, useCallback } from "react";
import { trackFeature } from "@/hooks/use-analytics";
import { ScriptImport } from "@/components/script-import";
import { RoleSelector } from "@/components/role-selector";
import { RecentScripts } from "@/components/recent-scripts";
import { SideMenu } from "@/components/side-menu";
import { Logo } from "@/components/logo";
import { useSessionContext } from "@/context/session-context";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { AuthModal } from "@/components/auth-modal";
import { Users, Repeat, Clock, Volume2 } from "lucide-react";
import { ProfileAvatar } from "@/components/profile-avatar";
import { useRecentScripts, type RecentScript } from "@/hooks/use-recent-scripts";

type Step = "import" | "role-select";

interface HomePageProps {
  onSessionReady: () => void;
  onMultiplayer?: () => void;
  onTableRead?: () => void;
  onNavigate?: (page: string) => void;
}

export function HomePage({ onSessionReady, onMultiplayer, onTableRead, onNavigate }: HomePageProps) {
  const { session, lastRawScript, createSession, createSessionFromParsed, setUserRole, isLoading, error, clearError } = useSessionContext();
  const { isAuthenticated, user } = useAuth();
  const hasExistingSession = session && session.scenes?.length > 0 && !session.userRoleId;
  const [step, setStep] = useState<Step>(hasExistingSession ? "role-select" : "import");
  const userWentBackRef = useRef(false);
  const { scripts: recentScripts, refresh: refreshRecent, save: saveRecentScript, update: recentUpdate, remove: recentRemove } = useRecentScripts();
  const [menuOpen, setMenuOpen] = useState(false);

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
    const overrideName = recentNameOverride.current;
    recentNameOverride.current = null;
    const newSession = await createSession(overrideName || name, rawScript);
    if (newSession) {
      const totalLines = newSession.scenes.reduce((s, sc) => s + sc.lines.length, 0);
      saveRecentScript({
        name: newSession.name,
        rawScript,
        roleCount: newSession.roles.length,
        lineCount: totalLines,
      });
      refreshRecent();
      setStep("role-select");
    }
  };

  const handleImportParsed = (name: string, parsed: { roles: any[], scenes: any[] }, rawScript?: string) => {
    userWentBackRef.current = false;
    const overrideName = recentNameOverride.current;
    recentNameOverride.current = null;
    const newSession = createSessionFromParsed(overrideName || name, parsed, rawScript);
    if (newSession) {
      const totalLines = newSession.scenes.reduce((s, sc) => s + sc.lines.length, 0);
      trackFeature("script-import", "success", { roles: newSession.roles.length, lines: totalLines });
      saveRecentScript({
        name: newSession.name,
        rawScript: rawScript || "",
        roleCount: newSession.roles.length,
        lineCount: totalLines,
      });
      refreshRecent();
      console.log('[Home] Session created, advancing to role-select');
      setStep("role-select");
    }
  };

  const handleRoleSelect = (roleId: string) => {
    if (session) {
      const role = session.roles.find(r => r.id === roleId);
      if (role) {
        const currentRaw = lastRawScript || "";
        const existing = recentScripts.find(
          s => s.rawScript === currentRaw
        );
        if (existing) {
          saveRecentScript({
            name: existing.name,
            rawScript: existing.rawScript,
            roleCount: existing.roleCount,
            lineCount: existing.lineCount,
            lastRole: role.name,
          });
          refreshRecent();
        }
      }
    }
    setUserRole(roleId);
  };

  const [prefillKey, setPrefillKey] = useState(0);
  const [prefillScript, setPrefillScript] = useState<string | undefined>(() => {
    const pending = sessionStorage.getItem("costar-pending-script");
    if (pending) {
      sessionStorage.removeItem("costar-pending-script");
      sessionStorage.removeItem("costar-pending-filename");
      return pending;
    }
    return undefined;
  });
  const [dailyLimitResetsAt, setDailyLimitResetsAt] = useState<string | null>(null);
  const [isLimitReached, setIsLimitReached] = useState(false);
  const [showLimitBanner, setShowLimitBanner] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const recentNameOverride = useRef<string | null>(null);

  const handleSelectRecent = (script: RecentScript) => {
    recentNameOverride.current = script.name;
    setPrefillScript(script.rawScript);
    setPrefillKey((k) => k + 1);
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
              className="text-muted-foreground"
            >
              <Users className="h-5 w-5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            title="Profile"
            onClick={() => setMenuOpen(true)}
            data-testid="button-profile"
            className="text-muted-foreground"
          >
            <ProfileAvatar size="sm" />
          </Button>
        </div>
      </header>

      <SideMenu open={menuOpen} onOpenChange={setMenuOpen} onNavigate={onNavigate} />

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
            {isAuthenticated && user?.firstName
              ? `What are we rehearsing today, ${user.firstName}?`
              : "Your on demand scene partner."}
          </h1>
          <p className="text-muted-foreground text-sm mt-2 relative leading-relaxed">
            {isAuthenticated && user?.firstName
              ? "Paste a script, upload a file, or pick up where you left off."
              : "Paste a script. Pick your role. Start rehearsing."}
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
            key={prefillKey}
            onImport={handleImport}
            onImportParsed={handleImportParsed}
            isLoading={isLoading} 
            error={error}
            onClearError={clearError}
            initialScript={prefillScript ?? lastRawScript}
            onAuthRequired={() => setShowAuthModal(true)}
            onUpgradeRequired={(resetsAt) => {
              setDailyLimitResetsAt(resetsAt);
              setIsLimitReached(true);
              setShowLimitBanner(true);
            }}
            dailyLimitResetsAt={showLimitBanner ? dailyLimitResetsAt : null}
            isLimitReached={isLimitReached}
            onDismissLimit={() => setShowLimitBanner(false)}
            onUpgradeClick={() => onNavigate?.("subscription")}
            autoSubmit={pendingSubmit}
            onAutoSubmitHandled={() => setPendingSubmit(false)}
          />
        </div>

        {recentScripts.length > 0 && (
          <div className="px-4 pb-6 relative z-10">
            <RecentScripts
              scripts={recentScripts}
              onSelect={handleSelectRecent}
              onUpdate={recentUpdate}
              onDelete={recentRemove}
            />
          </div>
        )}
      </main>

      <footer className="px-5 py-6 pb-8 border-t border-border/40 safe-bottom">
        <p className="text-[11px] text-muted-foreground/60 text-center">
          {isAuthenticated ? "Your data can be saved to the cloud." : "All data stays on your device."}
        </p>
      </footer>

      <AuthModal
        open={showAuthModal}
        onOpenChange={setShowAuthModal}
        onSuccess={() => setPendingSubmit(true)}
      />

    </div>
  );
}
