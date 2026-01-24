import { cn } from "@/lib/utils";

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
  type?: "fade" | "slide-up" | "slide-right" | "scale" | "curtain";
  delay?: number;
}

export function PageTransition({ 
  children, 
  className,
  type = "fade",
  delay = 0
}: PageTransitionProps) {
  const animations = {
    fade: "animate-fade-in",
    "slide-up": "animate-fade-in-up",
    "slide-right": "animate-slide-in-right",
    scale: "animate-scale-in",
    curtain: "curtain-enter",
  };

  const delayStyles = delay > 0 ? { animationDelay: `${delay}ms` } : {};

  return (
    <div 
      className={cn(animations[type], className)}
      style={delayStyles}
    >
      {children}
    </div>
  );
}

interface StaggerContainerProps {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
}

export function StaggerContainer({ 
  children, 
  className,
  staggerDelay = 50 
}: StaggerContainerProps) {
  return (
    <div 
      className={cn("stagger-list", className)}
      style={{ "--stagger-delay": `${staggerDelay}ms` } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
