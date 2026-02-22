import { useState, useCallback, useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme-provider";
import { SessionProvider, useSessionContext } from "@/context/session-context";
import { ProfileProvider, useProfile } from "@/context/profile-context";
import { useAuth } from "@/hooks/use-auth";
import { HomePage } from "@/pages/home";
import { RehearsalPage } from "@/pages/rehearsal";
import MultiplayerPage from "@/pages/multiplayer";
import { HowItWorksPage } from "@/pages/how-it-works";
import { ComparePage } from "@/pages/compare";
import { RoadmapPage } from "@/pages/roadmap";
import { AuthPage } from "@/pages/auth";
import { LibraryPage } from "@/pages/library";
import { HistoryPage } from "@/pages/history";
import { FeatureBoardPage } from "@/pages/feature-board";
import { OnboardingPage } from "@/pages/onboarding";
import { ActorProfilePage } from "@/pages/actor-profile";
import { SubscriptionPage } from "@/pages/subscription";
import type { SavedScript } from "@shared/models/auth";

type View = "home" | "rehearsal" | "multiplayer" | "how-it-works" | "compare" | "roadmap" | "signin" | "library" | "history" | "feature-board" | "onboarding" | "profile" | "subscription";
type MultiplayerInitialView = "create" | "join";

function AppContent() {
  const { session, createSessionFromParsed, setUserRole } = useSessionContext();
  const { syncFromServer } = useProfile();
  const { user } = useAuth();
  const [view, setView] = useState<View>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success" || params.get("view") === "subscription") {
      window.history.replaceState({}, "", "/");
      return "subscription";
    }
    return "home";
  });

  useEffect(() => {
    if (user) {
      const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
      syncFromServer(user.profileImageUrl || null, name || undefined);
    }
  }, [user, syncFromServer]);
  const [multiplayerInitialView, setMultiplayerInitialView] = useState<MultiplayerInitialView>("join");

  const handleSessionReady = useCallback(() => {
    setView("rehearsal");
  }, []);

  const handleBackToHome = useCallback(() => {
    setView("home");
  }, []);

  const handleTableReadFromRoleSelector = useCallback(() => {
    setMultiplayerInitialView("create");
    setView("multiplayer");
  }, []);

  const handleMultiplayerFromHome = useCallback(() => {
    setMultiplayerInitialView("join");
    setView("multiplayer");
  }, []);

  const handleNavigate = useCallback((page: string) => {
    if (page === "how-it-works" || page === "compare" || page === "roadmap" || page === "signin" || page === "library" || page === "history" || page === "feature-board" || page === "onboarding" || page === "profile" || page === "subscription") {
      setView(page as View);
    }
  }, []);

  const handleLoadScript = useCallback((script: SavedScript) => {
    if (script.rolesJson && script.scenesJson) {
      const loaded = createSessionFromParsed(
        script.name,
        { roles: script.rolesJson as any, scenes: script.scenesJson as any },
        script.rawScript,
      );
      if (loaded && script.userRoleId) {
        setUserRole(script.userRoleId);
      }
      setView("rehearsal");
    }
  }, [createSessionFromParsed, setUserRole]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {view === "home" && (
        <HomePage 
          key="home" 
          onSessionReady={handleSessionReady} 
          onMultiplayer={handleMultiplayerFromHome}
          onTableRead={handleTableReadFromRoleSelector}
          onNavigate={handleNavigate}
        />
      )}
      {view === "rehearsal" && (
        <RehearsalPage key="rehearsal" onBack={handleBackToHome} />
      )}
      {view === "multiplayer" && (
        <MultiplayerPage 
          key={`multiplayer-${multiplayerInitialView}`}
          onBack={handleBackToHome}
          initialView={multiplayerInitialView}
        />
      )}
      {view === "how-it-works" && (
        <HowItWorksPage onBack={handleBackToHome} />
      )}
      {view === "compare" && (
        <ComparePage onBack={handleBackToHome} />
      )}
      {view === "roadmap" && (
        <RoadmapPage onBack={handleBackToHome} onNavigate={handleNavigate} />
      )}
      {view === "signin" && (
        <AuthPage onBack={handleBackToHome} onSignUp={() => setView("onboarding")} />
      )}
      {view === "library" && (
        <LibraryPage onBack={handleBackToHome} onLoadScript={handleLoadScript} />
      )}
      {view === "history" && (
        <HistoryPage onBack={handleBackToHome} />
      )}
      {view === "feature-board" && (
        <FeatureBoardPage onBack={handleBackToHome} />
      )}
      {view === "onboarding" && (
        <OnboardingPage onComplete={handleBackToHome} />
      )}
      {view === "profile" && (
        <ActorProfilePage onBack={handleBackToHome} />
      )}
      {view === "subscription" && (
        <SubscriptionPage onBack={handleBackToHome} />
      )}
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <ProfileProvider>
            <SessionProvider>
              <AppContent />
            </SessionProvider>
          </ProfileProvider>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
