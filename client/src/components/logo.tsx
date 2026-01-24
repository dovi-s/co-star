import { cn } from "@/lib/utils";
import logoImage from "@assets/castmate_icon_transparent_512_1769295148528.png";

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
        <img 
          src={logoImage} 
          alt="CastMate" 
          className="w-full h-full object-contain dark:invert-0 invert"
        />
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
    <img 
      src={logoImage} 
      alt="CastMate" 
      className={cn("w-full h-full object-contain dark:invert-0 invert", className)}
    />
  );
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <img 
        src={logoImage} 
        alt="CastMate" 
        className="w-full h-full object-contain dark:invert-0 invert"
      />
    </div>
  );
}
