import { useState, useCallback, useEffect, useRef } from "react";
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
import { AdminDashboard } from "@/pages/admin-dashboard";
import { BrandPage } from "@/pages/brand";
import { WhoIsItForPage } from "@/pages/who-is-it-for";
import { Logo } from "@/components/logo";
import { usePageTracking } from "@/hooks/use-tracking";
import "@/hooks/use-analytics";
import type { SavedScript } from "@shared/models/auth";

type View = "home" | "rehearsal" | "multiplayer" | "how-it-works" | "who-is-it-for" | "compare" | "roadmap" | "signin" | "library" | "history" | "feature-board" | "onboarding" | "profile" | "subscription" | "admin" | "brand";
type MultiplayerInitialView = "create" | "join";

function AppContent() {
  const { session, createSessionFromParsed, setUserRole } = useSessionContext();
  const { syncFromServer } = useProfile();
  const { user } = useAuth();
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [view, setView] = useState<View>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("reset-token")) {
      return "signin";
    }
    if (params.get("checkout") === "success") {
      window.history.replaceState({}, "", "/");
      setCheckoutSuccess(true);
      return "subscription";
    }
    if (params.get("view") === "subscription") {
      window.history.replaceState({}, "", "/");
      return "subscription";
    }
    if (params.get("view") === "admin") {
      window.history.replaceState({}, "", "/");
      return "admin";
    }
    const viewParam = params.get("view");
    if (viewParam === "brand" || viewParam === "how-it-works" || viewParam === "who-is-it-for" || viewParam === "compare" || viewParam === "roadmap" || viewParam === "feature-board") {
      window.history.replaceState({}, "", "/");
      return viewParam as View;
    }
    return "home";
  });

  const [isExiting, setIsExiting] = useState(false);
  const pendingViewRef = useRef<View | null>(null);

  const transitionTo = useCallback((nextView: View) => {
    if (nextView === view && !isExiting) return;
    if (isExiting) {
      pendingViewRef.current = nextView;
      return;
    }
    setIsExiting(true);
    pendingViewRef.current = nextView;
  }, [view, isExiting]);

  useEffect(() => {
    if (!isExiting) return;
    const timer = setTimeout(() => {
      if (pendingViewRef.current) {
        setView(pendingViewRef.current);
        pendingViewRef.current = null;
      }
      setIsExiting(false);
    }, 180);
    return () => clearTimeout(timer);
  }, [isExiting]);

  usePageTracking(view);

  useEffect(() => {
    const titles: Record<View, string> = {
      home: "Co-star Studio",
      rehearsal: "Rehearsal - Co-star Studio",
      multiplayer: "Table Read - Co-star Studio",
      "how-it-works": "How It Works - Co-star Studio",
      "who-is-it-for": "Who Is It For - Co-star Studio",
      compare: "Compare Plans - Co-star Studio",
      roadmap: "Roadmap - Co-star Studio",
      signin: "Sign In - Co-star Studio",
      library: "Library - Co-star Studio",
      history: "History - Co-star Studio",
      "feature-board": "Feature Board - Co-star Studio",
      onboarding: "Welcome - Co-star Studio",
      profile: "Profile - Co-star Studio",
      subscription: "Subscription - Co-star Studio",
      admin: "Admin - Co-star Studio",
      brand: "Brand - Co-star Studio",
    };
    document.title = titles[view] || "Co-star Studio";
  }, [view]);

  useEffect(() => {
    if (user) {
      const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
      syncFromServer(user.profileImageUrl || null, name || undefined);
    }
  }, [user, syncFromServer]);
  const [multiplayerInitialView, setMultiplayerInitialView] = useState<MultiplayerInitialView>("join");

  const handleSessionReady = useCallback(() => {
    transitionTo("rehearsal");
  }, [transitionTo]);

  const handleBackToHome = useCallback(() => {
    transitionTo("home");
  }, [transitionTo]);

  const handleTableReadFromRoleSelector = useCallback(() => {
    setMultiplayerInitialView("create");
    transitionTo("multiplayer");
  }, [transitionTo]);

  const handleMultiplayerFromHome = useCallback(() => {
    setMultiplayerInitialView("join");
    transitionTo("multiplayer");
  }, [transitionTo]);

  const handleNavigate = useCallback((page: string) => {
    if (page === "home") {
      transitionTo("home");
      return;
    }
    if (page === "how-it-works" || page === "who-is-it-for" || page === "compare" || page === "roadmap" || page === "signin" || page === "library" || page === "history" || page === "feature-board" || page === "onboarding" || page === "profile" || page === "subscription" || page === "admin" || page === "brand") {
      transitionTo(page as View);
    }
  }, [transitionTo]);

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
    <div className={`min-h-screen bg-background text-foreground ${isExiting ? "animate-page-exit" : ""}`}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
        data-testid="link-skip-to-content"
      >
        Skip to content
      </a>
      <div id="main-content">
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
      {view === "who-is-it-for" && (
        <WhoIsItForPage onBack={handleBackToHome} />
      )}
      {view === "compare" && (
        <ComparePage onBack={handleBackToHome} />
      )}
      {view === "roadmap" && (
        <RoadmapPage onBack={handleBackToHome} onNavigate={handleNavigate} />
      )}
      {view === "signin" && (
        <AuthPage 
          onBack={handleBackToHome} 
          onSignUp={() => {
            const hasPendingScript = !!sessionStorage.getItem("costar-pending-script");
            setView(hasPendingScript ? "home" : "onboarding");
          }}
        />
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
        <SubscriptionPage onBack={handleBackToHome} checkoutSuccess={checkoutSuccess} />
      )}
      {view === "admin" && (
        <AdminDashboard onBack={handleBackToHome} />
      )}
      {view === "brand" && (
        <BrandPage onBack={handleBackToHome} />
      )}
      </div>
    </div>
  );
}

function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState<"enter" | "exit">("enter");

  useEffect(() => {
    const showTimer = setTimeout(() => setPhase("exit"), 600);
    const doneTimer = setTimeout(onComplete, 900);
    return () => { clearTimeout(showTimer); clearTimeout(doneTimer); };
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-background transition-opacity duration-300 ${phase === "exit" ? "opacity-0" : "opacity-100"}`}
      data-testid="splash-screen"
    >
      <div className={`transition-transform duration-500 ease-out ${phase === "enter" ? "scale-100 opacity-100" : "scale-110 opacity-0"}`}>
        <Logo size="xl" showWordmark animated={false} className="pointer-events-none" />
      </div>
    </div>
  );
}

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const handleSplashComplete = useCallback(() => setShowSplash(false), []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <ProfileProvider>
            <SessionProvider>
              {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
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
