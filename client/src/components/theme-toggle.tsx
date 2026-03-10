import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/theme-provider";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
      data-testid="button-theme-toggle"
      className="rounded-xl text-muted-foreground"
    >
      <div className="relative w-5 h-5" style={{ perspective: "60px" }}>
        <Sun 
          className={cn(
            "h-5 w-5 absolute inset-0",
            theme === "light" 
              ? "opacity-0 scale-0" 
              : "opacity-100 scale-100"
          )}
          style={{
            transition: "opacity 0.4s cubic-bezier(0.4,0,0.2,1), transform 0.5s cubic-bezier(0.34,1.56,0.64,1)",
            transform: theme === "light" ? "rotate(180deg) scale(0)" : "rotate(0deg) scale(1)",
          }}
        />
        <Moon 
          className={cn(
            "h-5 w-5 absolute inset-0",
            theme === "light" 
              ? "opacity-100 scale-100" 
              : "opacity-0 scale-0"
          )}
          style={{
            transition: "opacity 0.4s cubic-bezier(0.4,0,0.2,1), transform 0.5s cubic-bezier(0.34,1.56,0.64,1)",
            transform: theme === "light" ? "rotate(0deg) scale(1)" : "rotate(-180deg) scale(0)",
          }}
        />
      </div>
    </Button>
  );
}
