import { useState, useCallback, useRef } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme-provider";
import { HomePage } from "@/pages/home";
import { RehearsalPage } from "@/pages/rehearsal";
import { cn } from "@/lib/utils";

type View = "home" | "rehearsal";

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

  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showContent, setShowContent] = useState(true);
  const pendingViewRef = useRef<View | null>(null);

  const transitionTo = useCallback((newView: View) => {
    if (isTransitioning) return;
    
    pendingViewRef.current = newView;
    setIsTransitioning(true);
    setShowContent(false);
    
    // Quick fade out, then switch and fade in
    setTimeout(() => {
      setView(newView);
      setShowContent(true);
      
      setTimeout(() => {
        setIsTransitioning(false);
        pendingViewRef.current = null;
      }, 200);
    }, 150);
  }, [isTransitioning]);

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
          <div className={cn(
            "min-h-screen bg-background text-foreground transition-all duration-200",
            showContent ? "opacity-100 scale-100" : "opacity-0 scale-[0.99]"
          )}>
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
