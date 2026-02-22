import { cn } from "@/lib/utils";

interface BrandLogoProps {
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
  variant?: "full" | "icon";
  className?: string;
}

const sizeClasses = {
  sm: "w-9 h-9",
  md: "w-11 h-11",
  lg: "w-14 h-14",
};

const wordmarkSizes = {
  sm: "text-base",
  md: "text-lg",
  lg: "text-xl",
};

function CoStarAppIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="costarBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1A73E8" />
          <stop offset="100%" stopColor="#1557B0" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="12" fill="url(#costarBg)" />
      <path
        d="M21 7 Q25 17 35 21 Q25 25 21 35 Q17 25 7 21 Q17 17 21 7 Z"
        fill="white"
        opacity="0.95"
      />
      <path
        d="M35 29.5 Q36.5 33.5 40.5 35 Q36.5 36.5 35 40.5 Q33.5 36.5 29.5 35 Q33.5 33.5 35 29.5 Z"
        fill="#D4A574"
        opacity="0.85"
      />
    </svg>
  );
}

export function BrandLogo({ 
  size = "md", 
  showWordmark = false, 
  variant = "full",
  className 
}: BrandLogoProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)} data-testid="brand-logo">
      <div className={cn(
        sizeClasses[size],
        "relative rounded-xl overflow-hidden shadow-lg"
      )}>
        <CoStarAppIcon className="w-full h-full" />
      </div>
      
      {showWordmark && (
        <div className="flex flex-col leading-none">
          <span className={cn("tracking-tight", wordmarkSizes[size])}>
            <span className="font-normal">Co-star</span>{" "}
            <span className="font-bold">Studio</span>
          </span>
        </div>
      )}
    </div>
  );
}

export function BrandIcon({ className }: { className?: string }) {
  return <CoStarAppIcon className={cn("w-full h-full", className)} />;
}
