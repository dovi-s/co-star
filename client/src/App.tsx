import { useState, useCallback, useEffect, useRef, Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
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
import { MyRehearsalsPage } from "@/pages/my-rehearsals";
import { OnboardingPage } from "@/pages/onboarding";
import { ActorProfilePage } from "@/pages/actor-profile";
import { SubscriptionPage } from "@/pages/subscription";
import { AdminDashboard } from "@/pages/admin-dashboard";
import { BrandPage } from "@/pages/brand";
import { WhoIsItForPage } from "@/pages/who-is-it-for";
import { Logo, CoStarSplashAnimation } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { usePageTracking } from "@/hooks/use-tracking";
import "@/hooks/use-analytics";
import type { SavedScript } from "@shared/models/auth";
import { AlertTriangle, RotateCcw, WifiOff, Play } from "lucide-react";
import { useSwipeBack } from "@/hooks/use-swipe-back";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="min-h-screen bg-background text-foreground flex items-center justify-center p-6"
          data-testid="error-boundary-fallback"
        >
          <div className="flex flex-col items-center gap-4 max-w-md text-center">
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-destructive/10">
              <AlertTriangle className="w-7 h-7 text-destructive" />
            </div>
            <h1 className="text-xl font-semibold" data-testid="text-error-title">
              Something went wrong
            </h1>
            <p className="text-muted-foreground text-sm" data-testid="text-error-message">
              An unexpected error occurred. Please try again.
            </p>
            <Button
              onClick={this.handleRetry}
              data-testid="button-retry"
              className="gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Try Again
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

type View = "home" | "rehearsal" | "multiplayer" | "how-it-works" | "who-is-it-for" | "compare" | "roadmap" | "signin" | "library" | "history" | "my-rehearsals" | "feature-board" | "onboarding" | "profile" | "subscription" | "admin" | "brand" | "whats-new";
type MultiplayerInitialView = "create" | "join";

const viewToPath: Record<View, string> = {
  home: "/",
  rehearsal: "/rehearsal",
  multiplayer: "/multiplayer",
  "how-it-works": "/how-it-works",
  "who-is-it-for": "/who-is-it-for",
  compare: "/compare",
  roadmap: "/roadmap",
  signin: "/signin",
  library: "/library",
  history: "/history",
  "my-rehearsals": "/my-rehearsals",
  "feature-board": "/feature-board",
  onboarding: "/onboarding",
  profile: "/profile",
  subscription: "/subscription",
  admin: "/admin",
  brand: "/brand",
  "whats-new": "/whats-new",
};

const pathToView: Record<string, View> = Object.fromEntries(
  Object.entries(viewToPath).map(([v, p]) => [p, v as View])
) as Record<string, View>;

function resolveInitialView(): { view: View; checkoutSuccess: boolean } {
  const params = new URLSearchParams(window.location.search);

  if (params.get("reset-token")) {
    return { view: "signin", checkoutSuccess: false };
  }
  if (params.get("checkout") === "success") {
    window.history.replaceState({ view: "subscription" }, "", "/subscription");
    return { view: "subscription", checkoutSuccess: true };
  }
  if (params.get("checkout") === "cancel") {
    window.history.replaceState({ view: "subscription" }, "", "/subscription");
    return { view: "subscription", checkoutSuccess: false };
  }

  const viewParam = params.get("view");
  if (viewParam && viewParam in viewToPath) {
    const v = viewParam as View;
    window.history.replaceState({ view: v }, "", viewToPath[v]);
    return { view: v, checkoutSuccess: false };
  }

  const pathname = window.location.pathname;
  const matched = pathToView[pathname];
  if (matched) {
    window.history.replaceState({ view: matched }, "", pathname);
    return { view: matched, checkoutSuccess: false };
  }

  window.history.replaceState({ view: "home" }, "", "/");
  return { view: "home", checkoutSuccess: false };
}

function AppContent() {
  const { session, createSessionFromParsed, setUserRole } = useSessionContext();
  const { syncFromServer } = useProfile();
  const { user } = useAuth();
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const isPopstateNav = useRef(false);
  const [view, setView] = useState<View>(() => {
    const initial = resolveInitialView();
    if (initial.checkoutSuccess) {
      setTimeout(() => setCheckoutSuccess(true), 0);
    }
    return initial.view;
  });

  const [isExiting, setIsExiting] = useState(false);
  const pendingViewRef = useRef<View | null>(null);

  const transitionTo = useCallback((nextView: View) => {
    if (nextView === view && !isExiting) {
      isPopstateNav.current = false;
      return;
    }
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
        const newView = pendingViewRef.current;
        pendingViewRef.current = null;

        if (!isPopstateNav.current) {
          const path = viewToPath[newView] || "/";
          window.history.pushState({ view: newView }, "", path);
        }
        isPopstateNav.current = false;

        setView(newView);
        requestAnimationFrame(() => {
          window.scrollTo(0, 0);
          const main = document.querySelector("[data-main-content]") as HTMLElement | null;
          if (main) main.focus({ preventScroll: true });
        });
      }
      setIsExiting(false);
    }, 180);
    return () => clearTimeout(timer);
  }, [isExiting]);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const targetView: View = event.state?.view || pathToView[window.location.pathname] || "home";
      isPopstateNav.current = true;
      transitionTo(targetView);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [transitionTo]);

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
      "my-rehearsals": "My Rehearsals - Co-star Studio",
      "feature-board": "Feature Board - Co-star Studio",
      onboarding: "Welcome - Co-star Studio",
      profile: "Profile - Co-star Studio",
      subscription: "Subscription - Co-star Studio",
      admin: "Admin - Co-star Studio",
      brand: "Brand - Co-star Studio",
      "whats-new": "What's New - Co-star Studio",
    };
    document.title = titles[view] || "Co-star Studio";
  }, [view]);

  useEffect(() => {
    if (user) {
      const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
      syncFromServer(user.profileImageUrl || null, name || undefined);
      if (user.onboardingComplete !== "true" && view !== "onboarding" && view !== "signin") {
        window.history.replaceState({ view: "onboarding" }, "", "/onboarding");
        setView("onboarding");
      }
      const refCode = new URLSearchParams(window.location.search).get("ref");
      if (refCode) {
        fetch("/api/accept-invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: refCode }),
          credentials: "include",
        }).catch(() => {});
        const url = new URL(window.location.href);
        url.searchParams.delete("ref");
        window.history.replaceState(null, "", url.toString());
      }
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
    if (page === "how-it-works" || page === "who-is-it-for" || page === "compare" || page === "roadmap" || page === "signin" || page === "library" || page === "history" || page === "my-rehearsals" || page === "feature-board" || page === "onboarding" || page === "profile" || page === "subscription" || page === "admin" || page === "brand" || page === "whats-new") {
      transitionTo(page as View);
    }
  }, [transitionTo]);

  const viewsWithBack: View[] = ["rehearsal", "multiplayer", "how-it-works", "who-is-it-for", "compare", "roadmap", "signin", "library", "history", "my-rehearsals", "feature-board", "profile", "subscription", "admin", "brand", "whats-new"];
  const swipeBackHandler = viewsWithBack.includes(view) ? handleBackToHome : undefined;
  useSwipeBack(swipeBackHandler);

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
      window.history.pushState({ view: "rehearsal" }, "", "/rehearsal");
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
      <div id="main-content" data-main-content tabIndex={-1} className="outline-none">
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
        <RehearsalPage key="rehearsal" onBack={handleBackToHome} onNavigate={handleNavigate} />
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
        <RoadmapPage onBack={handleBackToHome} />
      )}
      {view === "signin" && (
        <AuthPage 
          onBack={handleBackToHome} 
          onSignUp={() => {
            const hasPendingScript = !!sessionStorage.getItem("costar-pending-script");
            const target: View = hasPendingScript ? "home" : "onboarding";
            window.history.pushState({ view: target }, "", viewToPath[target]);
            setView(target);
          }}
        />
      )}
      {view === "library" && (
        <LibraryPage onBack={handleBackToHome} onLoadScript={handleLoadScript} onNavigate={handleNavigate} />
      )}
      {view === "history" && (
        <HistoryPage onBack={handleBackToHome} onNavigate={handleNavigate} />
      )}
      {view === "my-rehearsals" && (
        <MyRehearsalsPage onBack={handleBackToHome} onLoadScript={handleLoadScript} onNavigate={handleNavigate} />
      )}
      {view === "feature-board" && (
        <RoadmapPage onBack={handleBackToHome} initialTab="ideas" />
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
      {view === "whats-new" && (
        <RoadmapPage onBack={handleBackToHome} initialTab="roadmap" />
      )}
      </div>
      {session && session.userRoleId && view !== "rehearsal" && (
        <NowRehearsingPill
          scriptName={session.name}
          onResume={() => transitionTo("rehearsal")}
        />
      )}
    </div>
  );
}

function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [fading, setFading] = useState(false);
  const reducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const handleAnimComplete = useCallback(() => {
    if (reducedMotion) {
      onComplete();
      return;
    }
    setFading(true);
    setTimeout(onComplete, 400);
  }, [onComplete, reducedMotion]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-background ${fading ? "opacity-0" : "opacity-100"}`}
      style={{ transition: reducedMotion ? "none" : "opacity 400ms ease" }}
      data-testid="splash-screen"
    >
      <CoStarSplashAnimation iconSize={100} onComplete={handleAnimComplete} />
    </div>
  );
}

function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[200] flex items-center justify-center gap-2 px-4 py-2 bg-muted dark:bg-muted text-muted-foreground text-sm font-medium border-b border-border"
      role="status"
      aria-live="polite"
      data-testid="banner-offline"
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>You're offline — rehearsal still works with device voices</span>
    </div>
  );
}

function NowRehearsingPill({ scriptName, onResume }: { scriptName: string; onResume: () => void }) {
  return (
    <button
      onClick={onResume}
      className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[90] flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary text-primary-foreground shadow-lg animate-in slide-in-from-bottom-4 fade-in duration-300 cursor-pointer"
      data-testid="button-now-rehearsing"
      aria-label={`Resume rehearsal: ${scriptName}`}
    >
      <Play className="w-4 h-4 fill-current" />
      <span className="text-sm font-medium truncate max-w-[200px]" data-testid="text-now-rehearsing-title">
        {scriptName}
      </span>
    </button>
  );
}

function usePreventHorizontalScroll() {
  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let isHorizontal: boolean | null = null;

    const onTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      isHorizontal = null;
    };

    const onTouchMove = (e: TouchEvent) => {
      const dx = Math.abs(e.touches[0].clientX - startX);
      const dy = Math.abs(e.touches[0].clientY - startY);

      if (isHorizontal === null && (dx > 5 || dy > 5)) {
        isHorizontal = dx > dy;
      }

      if (isHorizontal) {
        let el = e.target as HTMLElement | null;
        let hasHorizontalScroll = false;
        while (el) {
          if (el.scrollWidth > el.clientWidth + 1) {
            const style = window.getComputedStyle(el);
            if (style.overflowX === "auto" || style.overflowX === "scroll") {
              hasHorizontalScroll = true;
              break;
            }
          }
          el = el.parentElement;
        }
        if (!hasHorizontalScroll) {
          e.preventDefault();
        }
      }
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });

    const onScroll = () => {
      if (window.scrollX !== 0) {
        window.scrollTo(0, window.scrollY);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);
}

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const handleSplashComplete = useCallback(() => setShowSplash(false), []);
  usePreventHorizontalScroll();

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <TooltipProvider>
            <ProfileProvider>
              <SessionProvider>
                {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
                <OfflineBanner />
                <AppContent />
              </SessionProvider>
            </ProfileProvider>
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
