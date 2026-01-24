import { cn } from "@/lib/utils";

export type SpotMood = 
  | "happy" 
  | "excited" 
  | "encouraging" 
  | "thinking" 
  | "celebrating" 
  | "waving"
  | "listening"
  | "proud";

interface SpotMascotProps {
  mood?: SpotMood;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  animate?: boolean;
}

const sizeClasses = {
  xs: "w-8 h-8",
  sm: "w-12 h-12",
  md: "w-20 h-20",
  lg: "w-28 h-28",
  xl: "w-36 h-36",
};

const moodAnimations: Record<SpotMood, string> = {
  happy: "animate-spot-float",
  excited: "animate-spot-bounce",
  encouraging: "animate-spot-nod",
  thinking: "animate-spot-think",
  celebrating: "animate-spot-dance",
  waving: "animate-spot-wave",
  listening: "animate-spot-pulse",
  proud: "animate-spot-glow",
};

export function SpotMascot({ 
  mood = "happy", 
  size = "md", 
  className,
  animate = true 
}: SpotMascotProps) {
  const animation = animate ? moodAnimations[mood] : "";
  
  const getEyeExpression = () => {
    switch (mood) {
      case "excited":
      case "celebrating":
        return { leftY: 42, rightY: 42, height: 6 };
      case "thinking":
        return { leftY: 44, rightY: 42, height: 4 };
      case "waving":
      case "happy":
        return { leftY: 43, rightY: 43, height: 5 };
      case "listening":
        return { leftY: 44, rightY: 44, height: 6 };
      case "proud":
        return { leftY: 42, rightY: 42, height: 4 };
      default:
        return { leftY: 43, rightY: 43, height: 5 };
    }
  };

  const getMouthExpression = () => {
    switch (mood) {
      case "excited":
      case "celebrating":
        return "M 42 52 Q 50 58 58 52";
      case "thinking":
        return "M 45 53 Q 50 53 55 53";
      case "happy":
      case "waving":
      case "proud":
        return "M 43 51 Q 50 56 57 51";
      case "listening":
        return "M 46 52 Q 50 54 54 52";
      default:
        return "M 44 52 Q 50 55 56 52";
    }
  };

  const eyes = getEyeExpression();
  const mouth = getMouthExpression();

  return (
    <div 
      className={cn("relative inline-flex items-center justify-center", className)} 
      data-testid="spot-mascot"
    >
      <div className={cn(sizeClasses[size], animation, "relative")}>
        <svg
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-lg"
        >
          <defs>
            <linearGradient id="spotBodyGradient" x1="50%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%" stopColor="#FCD34D" />
              <stop offset="50%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#D97706" />
            </linearGradient>
            <linearGradient id="spotLightBeam" x1="50%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%" stopColor="#FEF3C7" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#FDE68A" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="spotShine" x1="30%" y1="0%" x2="70%" y2="100%">
              <stop offset="0%" stopColor="#FEF9C3" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#FCD34D" stopOpacity="0" />
            </linearGradient>
            <filter id="spotGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          
          <ellipse
            cx="50"
            cy="85"
            rx="20"
            ry="4"
            fill="#000"
            opacity="0.1"
            className="animate-spot-shadow"
          />
          
          <path
            d="M 30 75 L 50 95 L 70 75 L 65 75 L 50 88 L 35 75 Z"
            fill="#78716C"
            opacity="0.6"
          />
          <rect x="46" y="70" width="8" height="8" rx="1" fill="#A8A29E" />
          
          <ellipse
            cx="50"
            cy="45"
            rx="28"
            ry="30"
            fill="url(#spotBodyGradient)"
            filter="url(#spotGlow)"
          />
          
          <ellipse
            cx="42"
            cy="35"
            rx="12"
            ry="10"
            fill="url(#spotShine)"
          />
          
          <circle cx="50" cy="20" r="6" fill="#78716C" />
          <rect x="48" y="12" width="4" height="6" rx="2" fill="#A8A29E" />
          
          <g className="spot-face">
            <ellipse
              cx="40"
              cy={eyes.leftY}
              rx="5"
              ry={eyes.height}
              fill="#1F2937"
            />
            <ellipse
              cx="60"
              cy={eyes.rightY}
              rx="5"
              ry={eyes.height}
              fill="#1F2937"
            />
            
            <circle cx="38" cy={eyes.leftY - 1} r="1.5" fill="white" opacity="0.9" />
            <circle cx="58" cy={eyes.rightY - 1} r="1.5" fill="white" opacity="0.9" />
            
            {mood === "excited" && (
              <>
                <circle cx="32" cy="44" r="4" fill="#FBBF24" opacity="0.5" />
                <circle cx="68" cy="44" r="4" fill="#FBBF24" opacity="0.5" />
              </>
            )}
          </g>
          
          <path
            d={mouth}
            stroke="#1F2937"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
          />
          
          {(mood === "waving" || mood === "celebrating") && (
            <g className="spot-arm animate-spot-arm-wave">
              <ellipse
                cx="82"
                cy="45"
                rx="8"
                ry="6"
                fill="#F59E0B"
                transform="rotate(-20 82 45)"
              />
            </g>
          )}
          
          {mood === "celebrating" && (
            <>
              <circle cx="25" cy="25" r="2" fill="#EC4899" className="animate-ping" />
              <circle cx="75" cy="20" r="2" fill="#8B5CF6" className="animate-ping" style={{ animationDelay: '0.2s' }} />
              <circle cx="80" cy="35" r="1.5" fill="#06B6D4" className="animate-ping" style={{ animationDelay: '0.4s' }} />
              <circle cx="20" cy="40" r="1.5" fill="#10B981" className="animate-ping" style={{ animationDelay: '0.3s' }} />
            </>
          )}
          
          {mood === "thinking" && (
            <g className="thought-bubbles">
              <circle cx="78" cy="30" r="3" fill="#E5E7EB" />
              <circle cx="85" cy="22" r="4" fill="#E5E7EB" />
              <circle cx="90" cy="12" r="5" fill="#E5E7EB" />
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}

export function SpotMessage({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn(
      "relative bg-card border rounded-2xl px-4 py-2 text-sm font-medium shadow-sm",
      "before:absolute before:left-1/2 before:-translate-x-1/2 before:-top-2",
      "before:border-8 before:border-transparent before:border-b-card",
      className
    )}>
      {children}
    </div>
  );
}
