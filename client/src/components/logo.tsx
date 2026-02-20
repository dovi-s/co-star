import { cn } from "@/lib/utils";
import logoImage from "@assets/castmate_icon_transparent_512_1769295148528.png";

interface LogoProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  animated?: boolean;
  showWordmark?: boolean;
  className?: string;
}

const sizeClasses = {
  xs: { container: "w-8 h-8", text: "text-sm" },
  sm: { container: "w-12 h-12", text: "text-lg" },
  md: { container: "w-14 h-14", text: "text-xl" },
  lg: { container: "w-18 h-18", text: "text-2xl" },
  xl: { container: "w-22 h-22", text: "text-3xl" },
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
        <img 
          src={logoImage} 
          alt="co-star" 
          className="w-full h-full object-contain dark:invert-0 invert"
        />
      </div>
      
      {showWordmark && (
        <span className={cn("font-semibold tracking-wide", text)}>
          co-star
        </span>
      )}
    </div>
  );
}

export function LogoIcon({ className }: { className?: string }) {
  return (
    <img 
      src={logoImage} 
      alt="co-star" 
      className={cn("w-full h-full object-contain dark:invert-0 invert", className)}
    />
  );
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <img 
        src={logoImage} 
        alt="co-star" 
        className="w-full h-full object-contain dark:invert-0 invert"
      />
    </div>
  );
}
