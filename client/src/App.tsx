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
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [direction, setDirection] = useState<Direction>("forward");
  const [showNext, setShowNext] = useState(false);
  const transitionLock = useRef(false);

  const transitionTo = useCallback((newView: View, dir: Direction) => {
    if (transitionLock.current || newView === currentView) return;
    
    transitionLock.current = true;
    setDirection(dir);
    setNextView(newView);
    setIsTransitioning(true);
    
    // Small delay to ensure next view is mounted before animating
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setShowNext(true);
      });
    });
  }, [currentView]);

  // Handle transition completion
  useEffect(() => {
    if (!showNext || !nextView) return;
    
    const timer = setTimeout(() => {
      setCurrentView(nextView);
      setNextView(null);
      setIsTransitioning(false);
      setShowNext(false);
      transitionLock.current = false;
    }, 350); // Match CSS transition duration
    
    return () => clearTimeout(timer);
  }, [showNext, nextView]);

  const handleSessionReady = useCallback(() => {
    transitionTo("rehearsal", "forward");
  }, [transitionTo]);

  const handleBackToHome = useCallback(() => {
    transitionTo("home", "back");
  }, [transitionTo]);

  const renderView = (view: View, isOutgoing: boolean) => {
    const ViewComponent = view === "home" 
      ? <HomePage onSessionReady={handleSessionReady} />
      : <RehearsalPage onBack={handleBackToHome} />;

    return (
      <div
        className={cn(
          "absolute inset-0 bg-background",
          "transition-all duration-350 ease-smooth",
          isOutgoing ? (
            showNext 
              ? direction === "forward"
                ? "opacity-0 -translate-x-6 scale-[0.98] blur-[2px]"
                : "opacity-0 translate-x-6 scale-[0.98] blur-[2px]"
              : "opacity-100 translate-x-0 scale-100 blur-0"
          ) : (
            showNext
              ? "opacity-100 translate-x-0 scale-100 blur-0"
              : direction === "forward"
                ? "opacity-0 translate-x-8 scale-[0.98] blur-[2px]"
                : "opacity-0 -translate-x-8 scale-[0.98] blur-[2px]"
          )
        )}
      >
        {ViewComponent}
      </div>
    );
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <div className="relative min-h-screen bg-background text-foreground overflow-hidden">
            {/* Current view */}
            {renderView(currentView, isTransitioning)}
            
            {/* Next view (during transition) */}
            {nextView && renderView(nextView, false)}
          </div>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
