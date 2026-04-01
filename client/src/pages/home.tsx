import { useState, useEffect, useRef, useCallback } from "react";
import { trackFeature } from "@/hooks/use-analytics";
import { ScriptImport } from "@/components/script-import";
import { RoleSelector } from "@/components/role-selector";
import { RecentScripts } from "@/components/recent-scripts";
import { SideMenu } from "@/components/side-menu";
import { Logo } from "@/components/logo";
import { useSessionContext } from "@/context/session-context";
import { useAuth } from "@/hooks/use-auth";
import { useProAccess } from "@/hooks/use-pro-access";
import { Button } from "@/components/ui/button";
import { AuthModal } from "@/components/auth-modal";
import { Users, Flame, TrendingUp, BookOpen, X, Crown, Trophy, ClipboardPaste, UserCheck, Mic, BarChart3, BookOpen as LibraryIcon } from "lucide-react";
import { ProfileAvatar } from "@/components/profile-avatar";
import { useRecentScripts, type RecentScript } from "@/hooks/use-recent-scripts";
import { useUserStats } from "@/hooks/use-user-stats";
import { getDeviceFingerprint } from "@/lib/device-fingerprint";
import { cn } from "@/lib/utils";
import { TrialBanner } from "@/components/trial-banner";
import { InvitePartnerInline } from "@/components/invite-partner";
import { LockedFeatureCard } from "@/components/pro-gate";


type Step = "import" | "role-select";

interface HomePageProps {
  onSessionReady: () => void;
  onMultiplayer?: () => void;
  onTableRead?: () => void;
  onNavigate?: (page: string) => void;
}

function getPersonalizedNudge(stats: ReturnType<typeof useUserStats>["stats"], scriptCount: number): { icon: "flame" | "trending" | "book"; message: string } | null {
  if (stats.currentStreak >= 3) {
    return { icon: "flame", message: `You're on a ${stats.currentStreak}-day streak. Keep it going!` };
  }
  if (stats.totalRunsCompleted > 0 && stats.currentStreak >= 1) {
    return { icon: "trending", message: `${stats.totalLinesRehearsed.toLocaleString()} lines rehearsed so far. Nice work!` };
  }
  if (scriptCount >= 2) {
    return { icon: "book", message: `You've worked on ${scriptCount} scripts. Ready for the next one?` };
  }
  if (stats.totalSessions >= 1) {
    return { icon: "trending", message: `${stats.totalRunsCompleted} run${stats.totalRunsCompleted !== 1 ? "s" : ""} completed. Let's add another!` };
  }
  return null;
}

const nudgeIcons = {
  flame: Flame,
  trending: TrendingUp,
  book: BookOpen,
};

export function HomePage({ onSessionReady, onMultiplayer, onTableRead, onNavigate }: HomePageProps) {
  const { session, lastRawScript, createSession, createSessionFromParsed, setUserRole, isLoading, error, clearError } = useSessionContext();
  const { isAuthenticated, user } = useAuth();
  const { isPro: userIsPro } = useProAccess();
  const { stats } = useUserStats(user?.id);
  const hasExistingSession = session && session.scenes?.length > 0 && !session.userRoleId;
  const [step, setStep] = useState<Step>(hasExistingSession ? "role-select" : "import");
  const userWentBackRef = useRef(false);
  const { scripts: recentScripts, refresh: refreshRecent, save: saveRecentScript, update: recentUpdate, remove: recentRemove } = useRecentScripts();
  const [menuOpen, setMenuOpen] = useState(false);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const [liveUsage, setLiveUsage] = useState<{ used: number; limit: number | null; resetsAt: string | null; isPro: boolean; limitReached: boolean } | null>(() => {
    try {
      const stored = sessionStorage.getItem("costar-usage");
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });

  useEffect(() => {
    if (!isAuthenticated) { setLiveUsage(null); return; }
    let cancelled = false;
    const fetchUsage = async () => {
      try {
        const dfp = await getDeviceFingerprint();
        const res = await fetch(`/api/script-usage?deviceFingerprint=${encodeURIComponent(dfp)}`, { credentials: "include" });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) {
          setLiveUsage(data);
          try { sessionStorage.setItem("costar-usage", JSON.stringify(data)); } catch {}
        }
      } catch {}
    };
    fetchUsage();
    const interval = setInterval(fetchUsage, 60000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [isAuthenticated]);

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

  const currentLastRole = (() => {
    const currentRaw = lastRawScript || "";
    const match = recentScripts.find(s => s.rawScript === currentRaw);
    return match?.lastRole;
  })();

  if (step === "role-select" && session) {
    return (
      <RoleSelector
        roles={session.roles}
        scenes={session.scenes}
        onRoleSelect={handleRoleSelect}
        onBack={handleBackToImport}
        onTableRead={onTableRead}
        scriptName={session.name}
        lastRole={currentLastRole}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background" data-testid="home-page">
      <header className="flex items-center justify-between content-inset py-3 sticky top-0 z-50 glass-surface safe-top rounded-none">
        <Logo size="xs" animated={false} showWordmark onClick={() => { setStep("import"); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
        <div className="flex items-center gap-2">
          {stats.currentStreak > 0 && (
            <div
              className={cn(
                "flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-bold",
                stats.currentStreak >= 7
                  ? "bg-orange-500/15 text-orange-600 dark:text-orange-400"
                  : "bg-orange-500/10 text-orange-600 dark:text-orange-400"
              )}
              data-testid="badge-streak"
              title={`${stats.currentStreak}-day streak`}
            >
              <Flame className={cn("h-3 w-3", stats.currentStreak >= 3 && "animate-pulse")} />
              <span>{stats.currentStreak}</span>
              {stats.currentStreak >= 7 && <Trophy className="h-3 w-3" />}
            </div>
          )}
          {isAuthenticated && user && (() => {
            const isPro = liveUsage ? liveUsage.isPro : userIsPro;
            const limit = liveUsage?.limit ?? (3 + (user.scriptUsageLimitBonus ?? 0));
            const used = liveUsage?.used ?? (user.scriptUsageCount ?? 0);
            const remaining = Math.max(0, limit - used);
            const maxed = liveUsage?.limitReached ?? (remaining === 0);
            const resetAt = liveUsage?.resetsAt ? new Date(liveUsage.resetsAt) : (user.scriptUsageResetAt ? new Date(user.scriptUsageResetAt) : null);
            const resetLabel = maxed && resetAt ? (() => {
              const now = new Date();
              const diffMs = resetAt.getTime() - now.getTime();
              if (diffMs <= 0) return null;
              const hours = Math.floor(diffMs / 3600000);
              const mins = Math.floor((diffMs % 3600000) / 60000);
              return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
            })() : null;
            const tierLabel = user.subscriptionTier === "internal" ? "Internal"
              : user.subscriptionTier === "comp" ? "Comp"
              : "Pro";
            return isPro ? (
              <button
                onClick={() => onNavigate?.("subscription")}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium text-primary/80 bg-primary/[0.08] transition-colors hover:bg-primary/[0.12]"
                data-testid="badge-plan-pro"
                aria-label={`${tierLabel} plan`}
              >
                <Crown className="h-3 w-3" />
                {tierLabel}
              </button>
            ) : (
              <button
                onClick={() => onNavigate?.("subscription")}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors",
                  maxed
                    ? "text-destructive bg-destructive/[0.08] hover:bg-destructive/[0.12]"
                    : "text-muted-foreground hover:bg-muted/50"
                )}
                data-testid="badge-plan-free"
                aria-label={maxed ? `Daily limit reached, resets in ${resetLabel || "soon"}` : `Free plan, ${used} of ${limit} daily scripts used`}
                title={maxed ? `Resets in ${resetLabel || "soon"}. Tap to upgrade.` : `${remaining} of ${limit} scripts left today`}
              >
                {maxed ? (
                  <>
                    <span>{used}/{limit}</span>
                    {resetLabel && (
                      <>
                        <span className="text-destructive/70">·</span>
                        <span>{resetLabel}</span>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <span>{used}/{limit} today</span>
                  </>
                )}
              </button>
            );
          })()}
          {onMultiplayer && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onMultiplayer}
              title="Table Read"
              aria-label="Table Read"
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
            aria-label="Open profile menu"
            onClick={() => setMenuOpen(true)}
            data-testid="button-profile"
            className="text-muted-foreground"
          >
            <ProfileAvatar size="sm" />
          </Button>
        </div>
      </header>

      <SideMenu open={menuOpen} onOpenChange={setMenuOpen} onNavigate={onNavigate} activePage="home" />

      <main id="main-content" className="flex-1 flex flex-col onboarding-glow relative overflow-x-hidden">
        {isAuthenticated && (
          <div className="content-inset pt-3 pb-0 relative z-10">
            <TrialBanner onUpgrade={() => onNavigate?.("subscription")} />
          </div>
        )}

        <div className="content-inset pt-6 pb-2 relative z-10 hero-enter">
          <h1 className="text-2xl font-semibold text-foreground relative tracking-tight">
            {isAuthenticated && user?.firstName
              ? `What are we rehearsing today, ${user.firstName}?`
              : "Your on demand scene partner."}
          </h1>
          <p className="text-muted-foreground text-sm mt-1 relative leading-relaxed hero-enter-delay-1">
            {isAuthenticated && user?.firstName
              ? "Paste a script, upload a file, or pick up where you left off."
              : "Unlimited takes, always available, zero judgment."}
          </p>
          {!isAuthenticated && (
            <div className="flex items-center gap-8 mt-4 hero-enter-delay-2" data-testid="value-prop-steps">
              <div className="flex items-center gap-2">
                <ClipboardPaste className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs text-muted-foreground">Paste script</span>
              </div>
              <div className="flex items-center gap-2">
                <UserCheck className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs text-muted-foreground">Pick role</span>
              </div>
              <div className="flex items-center gap-2">
                <Mic className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs text-muted-foreground">Rehearse</span>
              </div>
            </div>
          )}
        </div>

        {(() => {
          const nudge = isAuthenticated && !nudgeDismissed ? getPersonalizedNudge(stats, recentScripts.length) : null;
          if (!nudge) return null;
          const NudgeIcon = nudgeIcons[nudge.icon];
          return (
            <div className="content-inset pb-3 relative z-10" data-testid="personalized-nudge">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-card/60 border border-border/40">
                <NudgeIcon className="h-3.5 w-3.5 text-foreground/70 shrink-0" data-testid="nudge-icon" />
                <span className="text-[13px] text-foreground/80 flex-1" data-testid="nudge-message">{nudge.message}</span>
                <button
                  onClick={() => setNudgeDismissed(true)}
                  aria-label="Dismiss"
                  data-testid="button-dismiss-nudge"
                  className="text-muted-foreground shrink-0 p-1 min-w-[28px] min-h-[28px] flex items-center justify-center"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          );
        })()}

        <div className="flex-1 content-inset pb-4 relative z-10 hero-enter-delay-2">
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

        <div className="content-inset pt-4 pb-4 relative z-10 zone-separator-subtle">
          <RecentScripts
            scripts={recentScripts}
            onSelect={handleSelectRecent}
            onUpdate={recentUpdate}
            onDelete={recentRemove}
          />
        </div>

        {isAuthenticated && (
          <div className="content-inset pb-4 relative z-10 space-y-3">
            <InvitePartnerInline scriptName={session?.name} className="w-full justify-center" />

            {!userIsPro && (
              <div className="space-y-2" data-testid="pro-feature-glimpses">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Unlock with Pro</p>
                <LockedFeatureCard
                  icon={Mic}
                  title="Recordings"
                  description="Record your takes and track your improvement over time."
                  onUpgrade={() => onNavigate?.("subscription")}
                />
                <LockedFeatureCard
                  icon={BarChart3}
                  title="Performance Analytics"
                  description="See your accuracy, pacing, and emotional range."
                  onUpgrade={() => onNavigate?.("subscription")}
                />
                <LockedFeatureCard
                  icon={LibraryIcon}
                  title="Cloud Script Library"
                  description="Save unlimited scripts and access them from any device."
                  onUpgrade={() => onNavigate?.("subscription")}
                />
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="content-inset py-4 pb-6 border-t border-border/40 safe-bottom">
        <p className="text-[11px] text-muted-foreground text-center">
          {isAuthenticated ? "Your data can be saved to the cloud." : "For actors who want to rehearse anytime, anywhere."}
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
