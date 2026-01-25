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
type Direction = "forward" | "back";
type TransitionPhase = "idle" | "exiting" | "entering";

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

  const [phase, setPhase] = useState<TransitionPhase>("idle");
  const [direction, setDirection] = useState<Direction>("forward");
  const pendingViewRef = useRef<View | null>(null);

  const transitionTo = useCallback((newView: View, dir: Direction) => {
    if (phase !== "idle") return;
    
    pendingViewRef.current = newView;
    setDirection(dir);
    setPhase("exiting");
    
    // Exit animation
    setTimeout(() => {
      setView(newView);
      setPhase("entering");
      
      // Enter animation complete
      setTimeout(() => {
        setPhase("idle");
        pendingViewRef.current = null;
      }, 180);
    }, 120);
  }, [phase]);

  const handleSessionReady = useCallback(() => {
    transitionTo("rehearsal", "forward");
  }, [transitionTo]);

  const handleBackToHome = useCallback(() => {
    transitionTo("home", "back");
  }, [transitionTo]);

  // Transition styles based on phase and direction
  const getTransitionClass = () => {
    if (phase === "idle") return "opacity-100 translate-x-0";
    
    if (phase === "exiting") {
      return direction === "forward" 
        ? "opacity-0 -translate-x-3" 
        : "opacity-0 translate-x-3";
    }
    
    if (phase === "entering") {
      return "opacity-100 translate-x-0";
    }
    
    return "";
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <div className={cn(
            "min-h-screen bg-background text-foreground transition-all duration-150 ease-out",
            getTransitionClass()
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
