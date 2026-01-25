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
  const [exitDirection, setExitDirection] = useState<"left" | "right">("left");
  const pendingView = useRef<View | null>(null);

  const navigate = useCallback((to: View, direction: "forward" | "back" = "forward") => {
    if (isTransitioning || to === view) return;
    
    pendingView.current = to;
    setExitDirection(direction === "forward" ? "left" : "right");
    setIsTransitioning(true);
  }, [isTransitioning, view]);

  const handleTransitionEnd = useCallback(() => {
    if (pendingView.current) {
      setView(pendingView.current);
      pendingView.current = null;
    }
    setIsTransitioning(false);
  }, []);

  const handleSessionReady = useCallback(() => {
    navigate("rehearsal", "forward");
  }, [navigate]);

  const handleBackToHome = useCallback(() => {
    navigate("home", "back");
  }, [navigate]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <div className="min-h-screen bg-background text-foreground overflow-hidden">
            <div
              className={cn(
                "min-h-screen will-change-transform",
                isTransitioning && exitDirection === "left" && "animate-exit-left",
                isTransitioning && exitDirection === "right" && "animate-exit-right",
                !isTransitioning && "animate-enter"
              )}
              onAnimationEnd={handleTransitionEnd}
            >
              {view === "home" 
                ? <HomePage onSessionReady={handleSessionReady} />
                : <RehearsalPage onBack={handleBackToHome} />
              }
            </div>
          </div>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
