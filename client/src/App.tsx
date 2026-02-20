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

type View = "home" | "rehearsal" | "multiplayer";
type MultiplayerInitialView = "create" | "join";

function AppContent() {
  const { session } = useSessionContext();
  const [view, setView] = useState<View>(() => {
    // Start at home - session context will have the data
    return "home";
  });
  const [multiplayerInitialView, setMultiplayerInitialView] = useState<MultiplayerInitialView>("join");

  const handleSessionReady = useCallback(() => {
    setView("rehearsal");
  }, []);

  const handleBackToHome = useCallback(() => {
    setView("home");
  }, []);

  // From role selector: go directly to create room
  const handleTableReadFromRoleSelector = useCallback(() => {
    setMultiplayerInitialView("create");
    setView("multiplayer");
  }, []);

  // From home header: go directly to join (skip menu screen)
  const handleMultiplayerFromHome = useCallback(() => {
    setMultiplayerInitialView("join");
    setView("multiplayer");
  }, []);

  // Auto-navigate to rehearsal if session is ready with a user role
  // This handles page refresh (though session won't persist for large scripts)
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
