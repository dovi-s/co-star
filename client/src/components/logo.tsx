import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  animated?: boolean;
  showWordmark?: boolean;
  className?: string;
}

const sizeClasses = {
  xs: { container: "w-6 h-6", text: "text-sm" },
  sm: { container: "w-7 h-7", text: "text-base" },
  md: { container: "w-9 h-9", text: "text-lg" },
  lg: { container: "w-12 h-12", text: "text-xl" },
  xl: { container: "w-16 h-16", text: "text-2xl" },
};

export function Logo({ size = "md", animated = true, showWordmark = false, className }: LogoProps) {
  const { container, text } = sizeClasses[size];
  
  return (
    <div className={cn("flex items-center gap-2", className)} data-testid="logo">
      <div className={cn(
        container,
        "relative flex items-center justify-center",
        animated && "transition-transform duration-200 hover:scale-105"
      )}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          <circle 
            cx="12" 
            cy="12" 
            r="10" 
            className="fill-foreground"
          />
          <circle 
            cx="12" 
            cy="12" 
            r="4" 
            className="fill-background"
          />
        </svg>
      </div>
      
      {showWordmark && (
        <span className={cn("font-semibold tracking-tight", text)}>
          CastMate
        </span>
      )}
    </div>
  );
}

export function LogoIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-full h-full", className)}
    >
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <circle cx="12" cy="12" r="4" fill="hsl(var(--background))" />
    </svg>
  );
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
        <circle cx="12" cy="12" r="10" fill="currentColor" />
        <circle cx="12" cy="12" r="4" fill="hsl(var(--background))" />
      </svg>
    </div>
  );
}
