import { useState, useCallback } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme-provider";
import { SessionProvider, useSessionContext } from "@/context/session-context";
import { HomePage } from "@/pages/home";
import { RehearsalPage } from "@/pages/rehearsal";
import MultiplayerPage from "@/pages/multiplayer";
import { HowItWorksPage } from "@/pages/how-it-works";
import { ComparePage } from "@/pages/compare";
import { RoadmapPage } from "@/pages/roadmap";

type View = "home" | "rehearsal" | "multiplayer" | "how-it-works" | "compare" | "roadmap";
type MultiplayerInitialView = "create" | "join";

function AppContent() {
  const { session } = useSessionContext();
  const [view, setView] = useState<View>(() => {
    return "home";
  });
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
    if (page === "how-it-works" || page === "compare" || page === "roadmap") {
      setView(page);
    }
  }, []);

  if (view === "home" && session?.userRoleId) {
    setView("rehearsal");
  }

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
        <RoadmapPage onBack={handleBackToHome} />
      )}
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <SessionProvider>
            <AppContent />
          </SessionProvider>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
