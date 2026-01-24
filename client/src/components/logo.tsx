import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  animated?: boolean;
  showWordmark?: boolean;
  className?: string;
}

const sizeClasses = {
  xs: { container: "w-7 h-7", text: "text-sm" },
  sm: { container: "w-8 h-8", text: "text-base" },
  md: { container: "w-10 h-10", text: "text-lg" },
  lg: { container: "w-14 h-14", text: "text-xl" },
  xl: { container: "w-20 h-20", text: "text-2xl" },
};

export function Logo({ size = "md", animated = true, showWordmark = false, className }: LogoProps) {
  const { container, text } = sizeClasses[size];
  
  return (
    <div className={cn("flex items-center gap-2.5", className)} data-testid="logo">
      <div className={cn(
        container,
        "relative rounded-xl flex items-center justify-center overflow-visible",
        animated && "group"
      )}>
        <svg
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={cn(
            "w-full h-full transition-transform duration-300",
            animated && "group-hover:scale-105"
          )}
        >
          <defs>
            <linearGradient id="spotlightBeam" x1="50%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.9" />
              <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="spotlightHead" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--foreground))" />
              <stop offset="100%" stopColor="hsl(var(--muted-foreground))" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          
          <path
            d="M16 18 L24 46 L32 18"
            fill="url(#spotlightBeam)"
            className={cn(animated && "logo-beam")}
          />
          
          <circle
            cx="24"
            cy="14"
            r="12"
            fill="url(#spotlightHead)"
            filter={animated ? "url(#glow)" : undefined}
          />
          
          <ellipse
            cx="24"
            cy="14"
            rx="6"
            ry="5"
            fill="hsl(var(--background))"
          />
          
          <ellipse
            cx="24"
            cy="14"
            rx="4"
            ry="3.5"
            fill="hsl(var(--primary))"
            className={cn(animated && "logo-lens")}
          />
          
          <circle cx="22" cy="12.5" r="1" fill="hsl(var(--background))" opacity="0.8" />
        </svg>
        
        {animated && (
          <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
            <div className="absolute inset-0 bg-primary/10 rounded-xl animate-pulse" />
          </div>
        )}
      </div>
      
      {showWordmark && (
        <div className="flex flex-col">
          <span className={cn("font-bold tracking-tight leading-none", text)}>
            CastMate
          </span>
          <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-[0.15em] mt-0.5">
            Studio
          </span>
        </div>
      )}
    </div>
  );
}

export function LogoIcon({ className, animated = false }: { className?: string; animated?: boolean }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-full h-full", className)}
    >
      <defs>
        <linearGradient id="spotlightBeamIcon" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.8" />
          <stop offset="60%" stopColor="hsl(var(--primary))" stopOpacity="0.2" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </linearGradient>
      </defs>
      
      <path
        d="M16 18 L24 46 L32 18"
        fill="url(#spotlightBeamIcon)"
        className={cn(animated && "logo-beam")}
      />
      
      <circle cx="24" cy="14" r="12" fill="currentColor" />
      <ellipse cx="24" cy="14" rx="6" ry="5" fill="hsl(var(--background))" />
      <ellipse cx="24" cy="14" rx="4" ry="3.5" fill="hsl(var(--primary))" />
      <circle cx="22" cy="12.5" r="1" fill="hsl(var(--background))" opacity="0.7" />
    </svg>
  );
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <svg viewBox="0 0 32 32" fill="none" className="w-full h-full">
        <circle cx="16" cy="10" r="8" fill="currentColor" />
        <ellipse cx="16" cy="10" rx="4" ry="3.5" fill="hsl(var(--background))" />
        <ellipse cx="16" cy="10" rx="2.5" ry="2" fill="hsl(var(--primary))" />
        <path
          d="M10 12 L16 30 L22 12"
          fill="hsl(var(--primary))"
          opacity="0.3"
        />
      </svg>
    </div>
  );
}
