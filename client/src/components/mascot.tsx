import { cn } from "@/lib/utils";

export type MascotMood = 
  | "idle" 
  | "excited" 
  | "encouraging" 
  | "celebrating" 
  | "thinking" 
  | "waving"
  | "proud"
  | "cheering";

interface MascotProps {
  mood?: MascotMood;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  message?: string;
  showMessage?: boolean;
}

const sizeClasses = {
  sm: "w-12 h-12",
  md: "w-20 h-20",
  lg: "w-32 h-32",
  xl: "w-48 h-48",
};

const moodAnimations: Record<MascotMood, string> = {
  idle: "mascot-float",
  excited: "mascot-bounce",
  encouraging: "mascot-nod",
  celebrating: "mascot-dance",
  thinking: "mascot-think",
  waving: "mascot-wave",
  proud: "mascot-proud",
  cheering: "mascot-cheer",
};

export function Mascot({ 
  mood = "idle", 
  size = "md", 
  className,
  message,
  showMessage = true,
}: MascotProps) {
  const animation = moodAnimations[mood];
  
  return (
    <div className={cn("relative inline-flex flex-col items-center", className)} data-testid="mascot-container">
      <div className={cn(sizeClasses[size], animation, "relative")} style={{ transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)" }}>
        <svg
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-lg"
        >
          <defs>
            <linearGradient id="spotlight-body" x1="50" y1="0" x2="50" y2="100" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFD93D" />
              <stop offset="100%" stopColor="#FF9500" />
            </linearGradient>
            <linearGradient id="spotlight-shine" x1="30" y1="20" x2="70" y2="80" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </linearGradient>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          
          <g filter="url(#glow)">
            <circle 
              cx="50" 
              cy="50" 
              r="38" 
              fill="url(#spotlight-body)"
              className="drop-shadow-md"
            />
            
            <ellipse 
              cx="42" 
              cy="42" 
              rx="12" 
              ry="8" 
              fill="url(#spotlight-shine)"
              transform="rotate(-20 42 42)"
            />
          </g>
          
          <g className={cn(
            mood === "celebrating" && "mascot-eyes-sparkle",
            mood === "thinking" && "mascot-eyes-look-up"
          )}>
            <ellipse 
              cx="38" 
              cy="48" 
              rx="6" 
              ry={mood === "excited" || mood === "celebrating" ? "7" : "6"} 
              fill="#1a1a2e"
            />
            <ellipse 
              cx="62" 
              cy="48" 
              rx="6" 
              ry={mood === "excited" || mood === "celebrating" ? "7" : "6"} 
              fill="#1a1a2e"
            />
            
            <circle cx="36" cy="46" r="2.5" fill="white" />
            <circle cx="60" cy="46" r="2.5" fill="white" />
            <circle cx="40" cy="50" r="1.5" fill="white" opacity="0.6" />
            <circle cx="64" cy="50" r="1.5" fill="white" opacity="0.6" />
          </g>
          
          {(mood === "excited" || mood === "celebrating") && (
            <g className="mascot-sparkles">
              <path d="M20 25 L23 30 L20 35 L17 30 Z" fill="#FFD93D" className="mascot-sparkle-1" />
              <path d="M80 20 L83 25 L80 30 L77 25 Z" fill="#FFD93D" className="mascot-sparkle-2" />
              <path d="M75 70 L78 75 L75 80 L72 75 Z" fill="#FFD93D" className="mascot-sparkle-3" />
            </g>
          )}
          
          <g>
            {mood === "excited" || mood === "celebrating" || mood === "cheering" ? (
              <path 
                d="M35 62 Q50 72 65 62" 
                stroke="#1a1a2e" 
                strokeWidth="3" 
                strokeLinecap="round"
                fill="none"
              />
            ) : mood === "thinking" ? (
              <ellipse cx="50" cy="64" rx="4" ry="3" fill="#1a1a2e" />
            ) : mood === "encouraging" || mood === "proud" ? (
              <path 
                d="M38 62 Q50 68 62 62" 
                stroke="#1a1a2e" 
                strokeWidth="2.5" 
                strokeLinecap="round"
                fill="none"
              />
            ) : (
              <path 
                d="M40 62 Q50 66 60 62" 
                stroke="#1a1a2e" 
                strokeWidth="2" 
                strokeLinecap="round"
                fill="none"
              />
            )}
          </g>
          
          {(mood === "excited" || mood === "celebrating") && (
            <>
              <ellipse cx="28" cy="55" rx="5" ry="3" fill="#FF6B6B" opacity="0.5" />
              <ellipse cx="72" cy="55" rx="5" ry="3" fill="#FF6B6B" opacity="0.5" />
            </>
          )}
          
          {mood === "waving" && (
            <g className="mascot-hand-wave">
              <ellipse cx="85" cy="40" rx="8" ry="6" fill="url(#spotlight-body)" />
            </g>
          )}
          
          <ellipse 
            cx="50" 
            cy="92" 
            rx="20" 
            ry="4" 
            fill="rgba(0,0,0,0.15)"
            className="mascot-shadow"
          />
        </svg>
      </div>
      
      {showMessage && message && (
        <div className="mt-2 px-4 py-2 bg-card border rounded-2xl shadow-lg text-center max-w-[200px] animate-fade-in">
          <p className="text-sm font-medium">{message}</p>
        </div>
      )}
    </div>
  );
}

export function MascotName() {
  return (
    <span className="font-bold bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent">
      Cue
    </span>
  );
}
