import { useState, useEffect, useCallback, useId } from "react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme-provider";

interface LogoProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  animated?: boolean;
  showWordmark?: boolean;
  className?: string;
  onClick?: () => void;
}

const sizeClasses = {
  xs: { container: "w-7 h-7", text: "text-base" },
  sm: { container: "w-10 h-10", text: "text-lg" },
  md: { container: "w-14 h-14", text: "text-xl" },
  lg: { container: "w-18 h-18", text: "text-2xl" },
  xl: { container: "w-22 h-22", text: "text-3xl" },
};

function useIsDark() {
  const { theme } = useTheme();
  return theme === "dark";
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return reduced;
}

function PremiumStar({ size = 100, color, uid }: { size: number; color: string; uid: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden="true"
      style={{ overflow: "visible" }}
    >
      <defs>
        <linearGradient id={`fill-${uid}`} x1="10" y1="10" x2="88" y2="92" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={color} />
          <stop offset="72%" stopColor={color} />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.28" />
        </linearGradient>
        <radialGradient
          id={`shine-${uid}`}
          cx="0" cy="0" r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(35 24) rotate(45) scale(34 22)"
        >
          <stop stopColor="rgba(255,255,255,0.2)" />
          <stop offset="1" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        <filter id={`shadow-${uid}`} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="4.5" result="blur" />
          <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 0.26 0" />
        </filter>
      </defs>
      <path d="M50 3 L59 41 L97 50 L59 59 L50 97 L41 59 L3 50 L41 41 Z" fill={`url(#fill-${uid})`} filter={`url(#shadow-${uid})`} />
      <path d="M50 3 L59 41 L97 50 L59 59 L50 97 L41 59 L3 50 L41 41 Z" fill={`url(#fill-${uid})`} />
      <path d="M50 3 L59 41 L97 50 L59 59 L50 97 L41 59 L3 50 L41 41 Z" fill={`url(#shine-${uid})`} opacity="0.92" />
      <path d="M50 3 L59 41 L97 50 L59 59 L50 97 L41 59 L3 50 L41 41 Z" stroke="rgba(255,255,255,0.13)" strokeWidth="1" fill="none" />
    </svg>
  );
}

function CoStarMark({ className }: { className?: string }) {
  const isDark = useIsDark();
  const uid = useId();
  const blue = isDark ? "#5BA3FF" : "#1A73E8";
  const bronze = isDark ? "#C4956D" : "#B08763";

  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id={`main-${uid}`} x1="5" y1="5" x2="37" y2="37" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={blue} />
          <stop offset="72%" stopColor={blue} />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.28" />
        </linearGradient>
        <radialGradient id={`shine-${uid}`} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(16 12) rotate(45) scale(14 9)">
          <stop stopColor="rgba(255,255,255,0.22)" />
          <stop offset="1" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        <linearGradient id={`comp-${uid}`} x1="28" y1="28" x2="42" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={bronze} />
          <stop offset="72%" stopColor={bronze} />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.22" />
        </linearGradient>
      </defs>
      <path
        d="M21 7 Q25 17 35 21 Q25 25 21 35 Q17 25 7 21 Q17 17 21 7 Z"
        fill={`url(#main-${uid})`}
      />
      <path
        d="M21 7 Q25 17 35 21 Q25 25 21 35 Q17 25 7 21 Q17 17 21 7 Z"
        fill={`url(#shine-${uid})`}
        opacity="0.9"
      />
      <path
        d="M21 7 Q25 17 35 21 Q25 25 21 35 Q17 25 7 21 Q17 17 21 7 Z"
        stroke="rgba(255,255,255,0.1)"
        strokeWidth="0.5"
        fill="none"
      />
      <path
        d="M35 29.5 Q36.5 33.5 40.5 35 Q36.5 36.5 35 40.5 Q33.5 36.5 29.5 35 Q33.5 33.5 35 29.5 Z"
        fill={`url(#comp-${uid})`}
        opacity="0.9"
      />
    </svg>
  );
}

export function Logo({ size = "md", animated = true, showWordmark = false, className, onClick }: LogoProps) {
  const { container, text } = sizeClasses[size];
  const isClickable = !!onClick;
  
  return (
    <button
      type="button"
      className={cn("flex items-center gap-2", isClickable ? "cursor-pointer" : "cursor-default", className)}
      data-testid="logo"
      onClick={onClick}
    >
      <div className={cn(
        container,
        "relative flex items-center justify-center",
        animated && "transition-transform duration-200 hover:scale-105"
      )}>
        <CoStarMark className="w-full h-full text-foreground" />
      </div>
      {showWordmark && (
        <span className={cn("tracking-[0.08em] text-foreground/90", text)}>
          <span className="font-normal">Co-star</span>{" "}
          <span className="font-semibold">Studio</span>
        </span>
      )}
    </button>
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

interface SplashAnimationProps {
  iconSize?: number;
  onComplete?: () => void;
  showReplay?: boolean;
  autoPlay?: boolean;
}

export function CoStarSplashAnimation({ iconSize = 120, onComplete, showReplay = false, autoPlay = true }: SplashAnimationProps) {
  const [phase, setPhase] = useState(0);
  const [replayKey, setReplayKey] = useState(0);
  const isDark = useIsDark();
  const reducedMotion = usePrefersReducedMotion();
  const mainUid = useId();
  const compUid = useId();

  const blue = isDark ? "#5BA3FF" : "#1A73E8";
  const bronze = isDark ? "#C4956D" : "#B08763";
  const blueGlow = isDark ? "rgba(91,163,255,0.18)" : "rgba(26,115,232,0.12)";
  const bronzeGlow = isDark ? "rgba(196,149,109,0.18)" : "rgba(176,135,99,0.12)";
  const lineColor = isDark ? "rgba(243,247,252,0.10)" : "rgba(15,23,42,0.08)";

  useEffect(() => {
    if (!autoPlay) return;

    if (reducedMotion) {
      setPhase(4);
      if (onComplete) {
        const t = setTimeout(onComplete, 50);
        return () => clearTimeout(t);
      }
      return;
    }

    const timers = [
      setTimeout(() => setPhase(1), 100),
      setTimeout(() => setPhase(2), 700),
      setTimeout(() => setPhase(3), 1400),
      setTimeout(() => setPhase(4), 1800),
    ];

    let completeTimer: ReturnType<typeof setTimeout>;
    if (onComplete) {
      completeTimer = setTimeout(onComplete, 2200);
    }

    return () => {
      timers.forEach(clearTimeout);
      if (completeTimer) clearTimeout(completeTimer);
    };
  }, [replayKey, autoPlay, onComplete, reducedMotion]);

  const replay = useCallback(() => {
    setPhase(0);
    setReplayKey((k) => k + 1);
  }, []);

  const mainStarSize = iconSize;
  const companionSize = iconSize * 0.33;
  const noMotion = reducedMotion;

  return (
    <div className="relative inline-flex flex-col items-center justify-center" data-testid="splash-animation">
      <div className="relative flex items-center justify-center" style={{ width: iconSize * 1.5, height: iconSize * 1.5 }}>
        {!noMotion && (
          <>
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 rounded-full blur-3xl"
              style={{
                width: iconSize * 0.9,
                height: iconSize * 0.9,
                background: blueGlow,
                opacity: phase >= 1 ? 1 : 0,
                transform: "translate(-50%, -50%)",
                transition: "opacity 500ms ease",
              }}
            />
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 rounded-full blur-2xl"
              style={{
                width: iconSize * 0.4,
                height: iconSize * 0.4,
                background: bronzeGlow,
                opacity: phase >= 2 ? 1 : 0,
                transform: `translate(-50%, calc(-50% - ${iconSize * 0.38}px))`,
                transition: "opacity 500ms ease",
              }}
            />
          </>
        )}

        {!noMotion && (
          <svg
            viewBox="0 0 200 200"
            className="absolute inset-0 w-full h-full"
            aria-hidden="true"
          >
            <path
              d="M100 100 C 80 72, 80 42, 100 24"
              fill="none"
              stroke={lineColor}
              strokeWidth="1"
              strokeLinecap="round"
              strokeDasharray="220"
              strokeDashoffset={phase >= 2 ? "0" : "220"}
              style={{
                opacity: phase >= 2 ? 1 : 0,
                transition: "stroke-dashoffset 600ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms ease",
              }}
            />
          </svg>
        )}

        <div
          style={{
            position: "absolute",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: noMotion || phase >= 1 ? 1 : 0,
            transform: noMotion || phase >= 1
              ? "scale(1) rotate(0deg)"
              : "scale(0.2) rotate(-90deg)",
            filter: noMotion || phase >= 1 ? "blur(0)" : "blur(12px)",
            transition: noMotion ? "none" : "all 800ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          <PremiumStar size={mainStarSize} color={blue} uid={`main-${mainUid}`} />
        </div>

        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            marginLeft: -companionSize / 2,
            opacity: noMotion || phase >= 2 ? 1 : 0,
            transform: noMotion || phase >= 2
              ? `translateY(${-iconSize * 0.6}px) scale(1) rotate(0deg)`
              : `translateY(0px) scale(0.2) rotate(20deg)`,
            filter: noMotion || phase >= 2 ? "blur(0)" : "blur(8px)",
            transition: noMotion ? "none" : "all 800ms cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        >
          <PremiumStar size={companionSize} color={bronze} uid={`comp-${compUid}`} />
        </div>
      </div>

      {(noMotion || phase >= 3) && (
        <div
          className="flex items-center gap-1.5 mt-1"
          style={{
            opacity: noMotion || phase >= 3 ? 1 : 0,
            transform: noMotion || phase >= 3 ? "translateY(0)" : "translateY(8px)",
            transition: noMotion ? "none" : "all 400ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          <span className="tracking-[0.08em] text-foreground/90 text-xl">
            <span className="font-normal">Co-star</span>{" "}
            <span className="font-semibold">Studio</span>
          </span>
        </div>
      )}

      {showReplay && !noMotion && (
        <button
          onClick={replay}
          className="mt-6 px-4 py-2 rounded-lg text-[11px] uppercase tracking-[0.18em] font-bold text-muted-foreground border border-border/40 hover:bg-muted/30 transition-colors"
          data-testid="button-replay-animation"
        >
          Replay
        </button>
      )}
    </div>
  );
}

interface AuthAnimationProps {
  iconSize?: number;
}

export function CoStarAuthAnimation({ iconSize = 72 }: AuthAnimationProps) {
  const [phase, setPhase] = useState(0);
  const isDark = useIsDark();
  const reducedMotion = usePrefersReducedMotion();
  const mainUid = useId();
  const compUid = useId();

  const blue = isDark ? "#5BA3FF" : "#1A73E8";
  const bronze = isDark ? "#C4956D" : "#B08763";

  useEffect(() => {
    if (reducedMotion) {
      setPhase(2);
      return;
    }
    const t1 = setTimeout(() => setPhase(1), 100);
    const t2 = setTimeout(() => setPhase(2), 600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [reducedMotion]);

  const companionSize = iconSize * 0.33;
  const noMotion = reducedMotion;

  return (
    <div className="relative inline-flex items-center justify-center" data-testid="auth-animation" style={{ width: iconSize * 1.3, height: iconSize * 1.3 }}>
      <div
        style={{
          position: "absolute",
          opacity: noMotion || phase >= 1 ? 1 : 0,
          transform: noMotion || phase >= 1 ? "scale(1)" : "scale(0.5)",
          filter: noMotion || phase >= 1 ? "blur(0)" : "blur(6px)",
          transition: noMotion ? "none" : "all 600ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <PremiumStar size={iconSize} color={blue} uid={`auth-main-${mainUid}`} />
      </div>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          marginLeft: -companionSize / 2,
          opacity: noMotion || phase >= 2 ? 1 : 0,
          transform: noMotion || phase >= 2
            ? `translateY(${-iconSize * 0.55}px) scale(1)`
            : `translateY(0px) scale(0.3)`,
          filter: noMotion || phase >= 2 ? "blur(0)" : "blur(4px)",
          transition: noMotion ? "none" : "all 600ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        <PremiumStar size={companionSize} color={bronze} uid={`auth-comp-${compUid}`} />
      </div>
    </div>
  );
}
