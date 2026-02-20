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
        "relative rounded-xl overflow-hidden shadow-lg",
        "bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500"
      )}>
        <svg
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          <defs>
            <linearGradient id="logoSpotlight" x1="50%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%" stopColor="white" stopOpacity="0.95" />
              <stop offset="100%" stopColor="white" stopOpacity="0.7" />
            </linearGradient>
          </defs>
          
          <path
            d="M 16 38 L 24 44 L 32 38 L 30 38 L 24 42 L 18 38 Z"
            fill="white"
            opacity="0.5"
          />
          <rect x="22" y="34" width="4" height="5" rx="1" fill="white" opacity="0.7" />
          
          <ellipse
            cx="24"
            cy="22"
            rx="14"
            ry="15"
            fill="url(#logoSpotlight)"
          />
          
          <ellipse cx="18" cy="17" rx="6" ry="5" fill="white" opacity="0.4" />
          
          <ellipse cx="19" cy="22" rx="2.5" ry="3" fill="#1F2937" />
          <ellipse cx="29" cy="22" rx="2.5" ry="3" fill="#1F2937" />
          
          <circle cx="18" cy="21" r="0.8" fill="white" />
          <circle cx="28" cy="21" r="0.8" fill="white" />
          
          <path
            d="M 20 27 Q 24 30 28 27"
            stroke="#1F2937"
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      </div>
      
      {showWordmark && (
        <div className="flex flex-col leading-none">
          <span className={cn("font-bold tracking-tight", wordmarkSizes[size])}>
            co-star
          </span>
        </div>
      )}
    </div>
  );
}

export function BrandIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-full h-full", className)}
    >
      <defs>
        <linearGradient id="iconBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FBBF24" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
      </defs>
      
      <rect width="48" height="48" rx="12" fill="url(#iconBg)" />
      
      <path
        d="M 16 38 L 24 44 L 32 38 L 30 38 L 24 42 L 18 38 Z"
        fill="white"
        opacity="0.5"
      />
      <rect x="22" y="34" width="4" height="5" rx="1" fill="white" opacity="0.7" />
      
      <ellipse
        cx="24"
        cy="22"
        rx="14"
        ry="15"
        fill="white"
        opacity="0.95"
      />
      
      <ellipse cx="18" cy="17" rx="6" ry="5" fill="white" opacity="0.5" />
      
      <ellipse cx="19" cy="22" rx="2.5" ry="3" fill="#1F2937" />
      <ellipse cx="29" cy="22" rx="2.5" ry="3" fill="#1F2937" />
      
      <circle cx="18" cy="21" r="0.8" fill="white" />
      <circle cx="28" cy="21" r="0.8" fill="white" />
      
      <path
        d="M 20 27 Q 24 30 28 27"
        stroke="#1F2937"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
