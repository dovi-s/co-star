import { useState, useCallback, useRef, useEffect } from "react";
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

function App() {
  const [currentView, setCurrentView] = useState<View>(() => {
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

  const [nextView, setNextView] = useState<View | null>(null);
  const [direction, setDirection] = useState<Direction>("forward");
  const [animationPhase, setAnimationPhase] = useState<"idle" | "ready" | "animating">("idle");
  const transitionLock = useRef(false);

  const transitionTo = useCallback((newView: View, dir: Direction) => {
    if (transitionLock.current || newView === currentView) return;
    
    transitionLock.current = true;
    setDirection(dir);
    setNextView(newView);
    setAnimationPhase("ready");
    
    // Next frame: start animation
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setAnimationPhase("animating");
      });
    });
  }, [currentView]);

  // Handle transition completion
  useEffect(() => {
    if (animationPhase !== "animating" || !nextView) return;
    
    const timer = setTimeout(() => {
      setCurrentView(nextView);
      setNextView(null);
      setAnimationPhase("idle");
      transitionLock.current = false;
    }, 350);
    
    return () => clearTimeout(timer);
  }, [animationPhase, nextView]);

  const handleSessionReady = useCallback(() => {
    transitionTo("rehearsal", "forward");
  }, [transitionTo]);

  const handleBackToHome = useCallback(() => {
    transitionTo("home", "back");
  }, [transitionTo]);

  const getViewClasses = (isCurrentView: boolean) => {
    // Not transitioning - show current view normally
    if (animationPhase === "idle") {
      return isCurrentView 
        ? "opacity-100 translate-x-0 scale-100" 
        : "opacity-0 pointer-events-none";
    }
    
    // Transitioning
    if (isCurrentView) {
      // Current view exits
      if (animationPhase === "animating") {
        return direction === "forward"
          ? "opacity-0 -translate-x-8 scale-[0.98]"
          : "opacity-0 translate-x-8 scale-[0.98]";
      }
      return "opacity-100 translate-x-0 scale-100";
    } else {
      // Next view enters
      if (animationPhase === "animating") {
        return "opacity-100 translate-x-0 scale-100";
      }
      return direction === "forward"
        ? "opacity-0 translate-x-8 scale-[0.98]"
        : "opacity-0 -translate-x-8 scale-[0.98]";
    }
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <div className="relative min-h-screen bg-background text-foreground overflow-hidden">
            {/* Current view */}
            <div
              className={cn(
                "absolute inset-0 bg-background",
                "transition-all duration-300 ease-out",
                getViewClasses(true)
              )}
            >
              {currentView === "home" 
                ? <HomePage onSessionReady={handleSessionReady} />
                : <RehearsalPage onBack={handleBackToHome} />
              }
            </div>
            
            {/* Next view (during transition) */}
            {nextView && (
              <div
                className={cn(
                  "absolute inset-0 bg-background",
                  "transition-all duration-300 ease-out",
                  getViewClasses(false)
                )}
              >
                {nextView === "home" 
                  ? <HomePage onSessionReady={handleSessionReady} />
                  : <RehearsalPage onBack={handleBackToHome} />
                }
              </div>
            )}
          </div>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
