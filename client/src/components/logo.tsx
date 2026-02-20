import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  animated?: boolean;
  showWordmark?: boolean;
  className?: string;
}

const sizeClasses = {
  xs: { container: "w-7 h-7", text: "text-base" },
  sm: { container: "w-10 h-10", text: "text-lg" },
  md: { container: "w-14 h-14", text: "text-xl" },
  lg: { container: "w-18 h-18", text: "text-2xl" },
  xl: { container: "w-22 h-22", text: "text-3xl" },
};

function CoStarMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M21 7 Q25 17 35 21 Q25 25 21 35 Q17 25 7 21 Q17 17 21 7 Z"
        fill="currentColor"
      />
      <path
        d="M35 29.5 Q36.5 33.5 40.5 35 Q36.5 36.5 35 40.5 Q33.5 36.5 29.5 35 Q33.5 33.5 35 29.5 Z"
        fill="currentColor"
        opacity="0.55"
      />
    </svg>
  );
}

export function Logo({ size = "md", animated = true, showWordmark = false, className }: LogoProps) {
  const { container, text } = sizeClasses[size];
  
  return (
    <div className={cn("flex items-center gap-2", className)} data-testid="logo">
      <div className={cn(
        container,
        "relative flex items-center justify-center",
        animated && "transition-transform duration-200 hover:scale-105"
      )}>
        <CoStarMark className="w-full h-full text-foreground" />
      </div>
      
      {showWordmark && (
        <span className={cn("font-medium tracking-[0.08em] text-foreground/90 wordmark-shimmer", text)}>
          co-star
        </span>
      )}
    </div>
  );
}

export function LogoIcon({ className }: { className?: string }) {
  return (
    <CoStarMark className={cn("w-full h-full text-foreground", className)} />
  );
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <CoStarMark className="w-full h-full text-foreground" />
    </div>
  );
}
