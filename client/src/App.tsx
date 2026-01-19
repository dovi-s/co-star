import { useState, useCallback } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme-provider";
import { HomePage } from "@/pages/home";
import { RehearsalPage } from "@/pages/rehearsal";

type View = "home" | "rehearsal";

function App() {
  const [view, setView] = useState<View>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("castmate-session");
      if (stored) {
        try {
          const session = JSON.parse(stored);
          if (session && session.userRoleId) {
            return "rehearsal";
          }
        } catch {}
      }
    }
    return "home";
  });

  const handleSessionReady = useCallback(() => {
    setView("rehearsal");
  }, []);

  const handleBackToHome = useCallback(() => {
    setView("home");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <div className="min-h-screen bg-background text-foreground">
            {view === "home" ? (
              <HomePage onSessionReady={handleSessionReady} />
            ) : (
              <RehearsalPage onBack={handleBackToHome} />
            )}
          </div>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
