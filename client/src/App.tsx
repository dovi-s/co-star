import { useState, useCallback, useRef } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme-provider";
import { HomePage } from "@/pages/home";
import { RehearsalPage } from "@/pages/rehearsal";

type View = "home" | "rehearsal";
type CurtainState = "idle" | "closing" | "opening";

function App() {
  const [view, setView] = useState<View>(() => {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem("castmate-session");
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

  const [curtainState, setCurtainState] = useState<CurtainState>("idle");
  const pendingViewRef = useRef<View | null>(null);

  const transitionTo = useCallback((newView: View) => {
    if (curtainState !== "idle") return;
    
    pendingViewRef.current = newView;
    setCurtainState("closing");
    
    // After curtains close, switch view and open
    setTimeout(() => {
      setView(newView);
      setCurtainState("opening");
      
      // After curtains open, reset state
      setTimeout(() => {
        setCurtainState("idle");
        pendingViewRef.current = null;
      }, 350);
    }, 280);
  }, [curtainState]);

  const handleSessionReady = useCallback(() => {
    transitionTo("rehearsal");
  }, [transitionTo]);

  const handleBackToHome = useCallback(() => {
    transitionTo("home");
  }, [transitionTo]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          {/* Curtain overlay */}
          {curtainState !== "idle" && (
            <div className={`curtain-overlay ${curtainState === "closing" ? "curtain-closing" : "curtain-opening"}`}>
              <div className="curtain-left" />
              <div className="curtain-right" />
            </div>
          )}
          
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
