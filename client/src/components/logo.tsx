import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showWordmark?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: "w-8 h-8",
  md: "w-10 h-10",
  lg: "w-14 h-14",
  xl: "w-20 h-20",
};

export function Logo({ size = "md", showWordmark = false, className }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-3", className)} data-testid="logo">
      <div className={cn(
        sizeClasses[size],
        "rounded-xl bg-slate-800 dark:bg-slate-900 flex items-center justify-center shadow-lg overflow-hidden"
      )}>
        <svg
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full p-2"
        >
          <defs>
            <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#60A5FA" />
              <stop offset="100%" stopColor="#3B82F6" />
            </linearGradient>
          </defs>
          
          <g className="script-lines">
            <rect x="6" y="14" width="12" height="2.5" rx="1.25" fill="url(#logoGradient)" opacity="0.7" />
            <rect x="6" y="20" width="14" height="2.5" rx="1.25" fill="url(#logoGradient)" opacity="0.85" />
            <rect x="6" y="26" width="10" height="2.5" rx="1.25" fill="url(#logoGradient)" opacity="0.6" />
          </g>
          
          <g className="sound-bars">
            <rect x="22" y="18" width="3" height="12" rx="1.5" fill="white" opacity="0.9" />
            <rect x="27" y="12" width="3" height="24" rx="1.5" fill="white" />
            <rect x="32" y="16" width="3" height="16" rx="1.5" fill="white" opacity="0.85" />
            <rect x="37" y="20" width="3" height="8" rx="1.5" fill="white" opacity="0.7" />
          </g>
          
          <path
            d="M16 21L20 24L16 27V21Z"
            fill="url(#logoGradient)"
            className="play-button"
          />
        </svg>
      </div>
      
      {showWordmark && (
        <div className="flex flex-col">
          <span className="font-bold text-lg tracking-tight leading-none">CastMate</span>
          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-[0.2em]">Studio</span>
        </div>
      )}
    </div>
  );
}

export function LogoIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-full h-full", className)}
    >
      <defs>
        <linearGradient id="logoIconGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#60A5FA" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>
      </defs>
      
      <g className="script-lines">
        <rect x="6" y="14" width="12" height="2.5" rx="1.25" fill="url(#logoIconGradient)" opacity="0.7" />
        <rect x="6" y="20" width="14" height="2.5" rx="1.25" fill="url(#logoIconGradient)" opacity="0.85" />
        <rect x="6" y="26" width="10" height="2.5" rx="1.25" fill="url(#logoIconGradient)" opacity="0.6" />
      </g>
      
      <g className="sound-bars">
        <rect x="22" y="18" width="3" height="12" rx="1.5" fill="currentColor" opacity="0.9" />
        <rect x="27" y="12" width="3" height="24" rx="1.5" fill="currentColor" />
        <rect x="32" y="16" width="3" height="16" rx="1.5" fill="currentColor" opacity="0.85" />
        <rect x="37" y="20" width="3" height="8" rx="1.5" fill="currentColor" opacity="0.7" />
      </g>
      
      <path
        d="M16 21L20 24L16 27V21Z"
        fill="url(#logoIconGradient)"
      />
    </svg>
  );
}
